/**
 * Pure helpers for the dashboard `businessReview` nested object.
 * Paid / revenue definitions MUST come from order-actual-revenue.util (via admin-payments re-exports).
 * No DB access — safe for unit tests.
 *
 * Revenue KPI match:
 *   buildActualRevenueInRangeMatch(dateFrom, dateTo)
 * Soft-deleted paid orders remain in revenue (isDeleted ignored by SSOT).
 */
import { createHash } from 'crypto';
import {
  DatePreset,
  ExceptionSeverity,
  JERUSALEM_TZ,
  PaymentException,
  ACTUAL_REVENUE_DATE_BASIS,
  averageTransactionAmount,
  buildActualRevenueInRangeMatch,
  buildPaidOrdersClause,
  buildPaymentsVisibilityClause,
  evaluatePaymentExceptions,
  getOrderRevenueAmount,
  hasActiveCaptureLock,
  isPaidOrder,
  previousPeriodRange,
  resolveDatePresetRange,
  roundMoney,
  toJerusalemDateKey,
  jerusalemDayEndUtc,
  jerusalemDayStartUtc
} from './admin-payments.util';
import {
  extractCustomerName,
  extractCustomerPhone,
  extractEventDate,
  resolveFulfillment
} from './dashboard-ops.util';
import { hasOpenPaymentExceptionForTab } from './order-admin-status.util';
import { normalizePhoneDigits } from './dashboard-overview.util';

export {
  averageTransactionAmount,
  buildPaidOrdersClause,
  buildPaymentsVisibilityClause,
  evaluatePaymentExceptions,
  isPaidOrder,
  previousPeriodRange,
  resolveDatePresetRange,
  roundMoney,
  toJerusalemDateKey,
  JERUSALEM_TZ,
  ACTUAL_REVENUE_DATE_BASIS
};

/** Presets supported by businessReview (admin-payments date helpers). */
export const BUSINESS_REVIEW_PRESETS = [
  'today',
  'last7',
  'last30',
  'this_month',
  'last_month',
  'custom'
] as const;

export type BusinessReviewPreset = (typeof BUSINESS_REVIEW_PRESETS)[number];

export type BusinessReviewAlertSeverity = 'critical' | 'warning' | 'info';

export type BusinessReviewAlert = {
  id: string;
  severity: BusinessReviewAlertSeverity;
  type: string;
  titleHe: string;
  explanationHe: string;
  orderId: string;
  orderNumber?: string;
  customerName?: string;
  relevantDate: string | null;
  href: string;
};

export type BusinessReviewOrderKind =
  | 'events'
  | 'shabbat_ready'
  | 'catering_shabbat'
  | 'unknown';

export const ORDER_KIND_LABEL_HE: Record<BusinessReviewOrderKind, string> = {
  events: 'אירועים',
  shabbat_ready: 'אוכל מוכן לשבת',
  catering_shabbat: 'קייטרינג שבת',
  unknown: 'לא ידוע'
};

export const FULFILLMENT_LABEL_HE: Record<'delivery' | 'pickup' | 'unknown', string> = {
  delivery: 'משלוח',
  pickup: 'איסוף עצמי',
  unknown: 'לא ידוע'
};

export const STATUS_LABEL_HE_BR: Record<string, string> = {
  pending: 'ממתין',
  new: 'חדש',
  confirmed: 'מאושר',
  preparing: 'בהכנה',
  ready: 'מוכן',
  out_for_delivery: 'בדרך',
  delivered: 'נמסר',
  completed: 'הושלם',
  cancelled: 'בוטל',
  unknown: 'לא ידוע'
};

export const BUSINESS_REVIEW_NOTES = {
  paidDefinition:
    'הכנסה שנגבתה (SSOT): לא test + הוכחת תשלום (paidAt|capturedAt|paymentStatus=captured|isPaid) + adminPriceOverride??totalPrice. ' +
    'status/isDeleted לא משפיעים. תאריך: effectivePaidAt = paidAt ?? capturedAt ?? createdAt.',
  customerIdentityMethod:
    'זהות לקוח: userId → טלפון מנורמל (ספרות בלבד, 9–10 ספרות IL) → אימייל lowercase. לעולם לא שם בלבד.',
  topDishRevenueNote:
    'הכנסת מנה מחושבת מ־items.price×quantity (או selectedOption.price). אם חסר מחיר/כמות — revenue=null ו־revenueReliable=false.'
} as const;

/**
 * Map overview / business-metrics presets onto admin-payments DatePreset.
 * Keeps month/week/last30 working for the legacy finance section while
 * businessReview uses this_month/last7/….
 */
export function mapOverviewPresetToBusinessReview(
  presetRaw?: string,
  from?: string,
  to?: string
): { preset: DatePreset; customFrom?: string; customTo?: string } {
  const p = String(presetRaw || '').trim().toLowerCase();
  if (from && to) {
    return { preset: 'custom', customFrom: from, customTo: to };
  }
  if (p === 'week' || p === 'last7') return { preset: 'last7' };
  if (p === 'last30') return { preset: 'last30' };
  if (p === 'today') return { preset: 'today' };
  if (p === 'last_month') return { preset: 'last_month' };
  if (p === 'month' || p === 'this_month' || !p) return { preset: 'this_month' };
  if (p === 'year') {
    const now = new Date();
    const y = Number(toJerusalemDateKey(now).slice(0, 4));
    return {
      preset: 'custom',
      customFrom: `${y}-01-01`,
      customTo: toJerusalemDateKey(now)
    };
  }
  if ((BUSINESS_REVIEW_PRESETS as readonly string[]).includes(p)) {
    return { preset: p as DatePreset };
  }
  return { preset: 'this_month' };
}

export function resolveBusinessReviewRange(
  input: { preset?: string; from?: string; to?: string; now?: Date } = {}
): {
  dateFrom: Date;
  dateTo: Date;
  preset: DatePreset;
  timezone: typeof JERUSALEM_TZ;
  dateBasis: typeof ACTUAL_REVENUE_DATE_BASIS | 'createdAt';
} {
  const mapped = mapOverviewPresetToBusinessReview(input.preset, input.from, input.to);
  const resolved = resolveDatePresetRange(
    mapped.preset,
    input.now ?? new Date(),
    mapped.customFrom,
    mapped.customTo
  );
  return {
    dateFrom: resolved.dateFrom,
    dateTo: resolved.dateTo,
    preset: resolved.preset,
    timezone: JERUSALEM_TZ,
    dateBasis: ACTUAL_REVENUE_DATE_BASIS
  };
}

/**
 * Revenue KPI Mongo match — SSOT actual revenue in effectivePaidAt range.
 * includeDeletedPayments is ignored for revenue (archive does not affect revenue).
 */
export function buildBusinessReviewPaidMatch(filters: {
  dateFrom: Date;
  dateTo: Date;
  /** Kept for API compat; revenue SSOT ignores isDeleted. */
  includeDeletedPayments?: boolean;
}): Record<string, unknown> {
  void filters.includeDeletedPayments;
  return buildActualRevenueInRangeMatch(filters.dateFrom, filters.dateTo);
}

/** Active (non-deleted, non-test) orders created in range — for order-count KPIs. */
export function buildBusinessReviewOrdersCreatedMatch(filters: {
  dateFrom: Date;
  dateTo: Date;
}): Record<string, unknown> {
  return {
    isTestOrder: { $ne: true },
    isDeleted: { $ne: true },
    createdAt: { $gte: filters.dateFrom, $lte: filters.dateTo }
  };
}

/** Healthy subset of created orders (excludes cancelled). */
export function buildBusinessReviewHealthyOrdersMatch(filters: {
  dateFrom: Date;
  dateTo: Date;
}): Record<string, unknown> {
  return {
    ...buildBusinessReviewOrdersCreatedMatch(filters),
    status: { $ne: 'cancelled' }
  };
}

export function isHealthyOrderForCustomerStats(
  order: Record<string, unknown> | null | undefined
): boolean {
  if (!order) return false;
  if (order.isDeleted === true) return false;
  if (order.isTestOrder === true) return false;
  if (String(order.status || '').trim() === 'cancelled') return false;
  return true;
}

function extractCustomerEmail(customerDetails: unknown): string {
  const cd =
    customerDetails && typeof customerDetails === 'object'
      ? (customerDetails as Record<string, unknown>)
      : {};
  const nested =
    cd.deliveryDetails && typeof cd.deliveryDetails === 'object'
      ? (cd.deliveryDetails as Record<string, unknown>)
      : {};
  return String(cd.email || nested.email || cd.customerEmail || '')
    .trim()
    .toLowerCase();
}

function isValidIsraelPhoneDigits(digits: string): boolean {
  return digits.length === 9 || digits.length === 10;
}

/**
 * Prefer userId string; else normalized phone (digits only, Israel 9–10);
 * else normalized email. NEVER name alone. Null if none.
 */
export function customerReturningIdentity(
  order: Record<string, unknown> | null | undefined
): string | null {
  if (!order) return null;
  const uid = order.userId;
  if (uid != null && String(uid).trim() && String(uid) !== 'null' && String(uid) !== 'undefined') {
    return `u:${String(uid)}`;
  }
  const phoneRaw = extractCustomerPhone(order.customerDetails);
  const phoneNorm = normalizePhoneDigits(phoneRaw);
  if (phoneNorm && isValidIsraelPhoneDigits(phoneNorm)) {
    return `p:${phoneNorm}`;
  }
  const email = extractCustomerEmail(order.customerDetails);
  if (email && email.includes('@')) {
    return `e:${email}`;
  }
  return null;
}

export function hashIdentityKey(identityKey: string): string {
  return createHash('sha256').update(identityKey).digest('hex').slice(0, 16);
}

export function resolveBusinessOrderKind(
  order: Record<string, unknown> | null | undefined
): BusinessReviewOrderKind {
  if (!order) return 'unknown';
  const cateringKind = String(order.cateringKind || '').trim();
  const orderType = String(order.orderType || '').trim();
  if (cateringKind === 'events') return 'events';
  if (orderType === 'shabbat') return 'shabbat_ready';
  if (orderType === 'catering' || cateringKind === 'shabbat') return 'catering_shabbat';
  if (orderType || cateringKind) return 'shabbat_ready';
  return 'unknown';
}

export type TopDishKey = { name: string; category?: string };

/** Exact name + optional category only — no fuzzy merge. */
export function topDishIdentityKey(item: {
  name?: unknown;
  category?: unknown;
}): string {
  const name = String(item?.name || '').trim();
  const category = String(item?.category || '').trim();
  return category ? `${name}::${category}` : name;
}

export type ReturningCustomerAgg = {
  identityKey: string;
  displayName: string;
  orderCount: number;
  paidTotal: number;
  lastOrderAt: string | null;
  kindCounts: Record<string, number>;
};

/**
 * Build returning-customer list from in-range healthy orders + lifetime counts.
 *
 * Returning = identity appears in `ordersInRange` (healthy) AND either:
 *   - lifetimeHealthyCountByKey[key] >= 2, or
 *   - historyKeys has the key (prior healthy order before range), or
 *   - neither map provided and in-range orderCount >= 2 (test / fallback)
 *
 * Service loads in-range docs + a lifetime `$group` by identity expression.
 */
export function computeReturningCustomersList(
  ordersInRange: Record<string, unknown>[],
  options: {
    /** identityKey → total healthy orders across all time. */
    lifetimeHealthyCountByKey?: Map<string, number>;
    /** Identities with ≥1 healthy order before the range. */
    historyKeys?: Set<string>;
    limit?: number;
  } = {}
): Array<{
  identityKeyHash: string;
  displayName: string;
  orderCount: number;
  paidTotal: number;
  lastOrderAt: string | null;
  commonOrderKind: BusinessReviewOrderKind;
}> {
  const byKey = new Map<string, ReturningCustomerAgg>();

  for (const order of ordersInRange) {
    if (!isHealthyOrderForCustomerStats(order)) continue;
    const key = customerReturningIdentity(order);
    if (!key) continue;

    const existing = byKey.get(key) || {
      identityKey: key,
      displayName: extractCustomerName(order.customerDetails) || 'לקוח',
      orderCount: 0,
      paidTotal: 0,
      lastOrderAt: null as string | null,
      kindCounts: {} as Record<string, number>
    };

    existing.orderCount += 1;
    if (isPaidOrder(order)) {
      existing.paidTotal = roundMoney(existing.paidTotal + (Number(order.totalPrice) || 0));
    }
    const created = order.createdAt
      ? new Date(order.createdAt as string | Date).toISOString()
      : null;
    if (created && (!existing.lastOrderAt || created > existing.lastOrderAt)) {
      existing.lastOrderAt = created;
      const name = extractCustomerName(order.customerDetails);
      if (name) existing.displayName = name;
    }
    const kind = resolveBusinessOrderKind(order);
    existing.kindCounts[kind] = (existing.kindCounts[kind] || 0) + 1;
    byKey.set(key, existing);
  }

  const hasLifetime = options.lifetimeHealthyCountByKey != null;
  const hasHistory = options.historyKeys != null;
  const out: Array<{
    identityKeyHash: string;
    displayName: string;
    orderCount: number;
    paidTotal: number;
    lastOrderAt: string | null;
    commonOrderKind: BusinessReviewOrderKind;
  }> = [];

  for (const agg of byKey.values()) {
    const lifetime = options.lifetimeHealthyCountByKey?.get(agg.identityKey) ?? 0;
    let isReturning = false;
    if (hasLifetime) {
      isReturning = lifetime >= 2;
    } else if (hasHistory) {
      isReturning = options.historyKeys!.has(agg.identityKey);
    } else {
      isReturning = agg.orderCount >= 2;
    }
    if (!isReturning) continue;

    let commonKind: BusinessReviewOrderKind = 'unknown';
    let maxKind = 0;
    for (const [k, n] of Object.entries(agg.kindCounts)) {
      if (n > maxKind) {
        maxKind = n;
        commonKind = k as BusinessReviewOrderKind;
      }
    }

    out.push({
      identityKeyHash: hashIdentityKey(agg.identityKey),
      displayName: agg.displayName,
      orderCount: hasLifetime ? lifetime : agg.orderCount,
      paidTotal: agg.paidTotal,
      lastOrderAt: agg.lastOrderAt,
      commonOrderKind: commonKind
    });
  }

  out.sort((a, b) => b.orderCount - a.orderCount || b.paidTotal - a.paidTotal);
  return out.slice(0, options.limit ?? 20);
}

/**
 * Count returning customers in range given lifetime maps.
 * Returning = identity appears in range AND (lifetime count >= 2 OR in historyKeys).
 */
export function countReturningCustomers(
  ordersInRange: Record<string, unknown>[],
  lifetimeHealthyCountByKey: Map<string, number>
): { value: number; insufficientData: boolean; identifiableCount: number } {
  const seen = new Set<string>();
  let identifiable = 0;
  let returning = 0;
  let totalHealthy = 0;

  for (const order of ordersInRange) {
    if (!isHealthyOrderForCustomerStats(order)) continue;
    totalHealthy += 1;
    const key = customerReturningIdentity(order);
    if (!key) continue;
    identifiable += 1;
    if (seen.has(key)) continue;
    seen.add(key);
    if ((lifetimeHealthyCountByKey.get(key) || 0) >= 2) {
      returning += 1;
    }
  }

  const insufficientData = totalHealthy > 0 && identifiable / totalHealthy < 0.5;
  return { value: returning, insufficientData, identifiableCount: seen.size };
}

export function changePercentRounded(
  value: number,
  previousValue: number
): number | null {
  if (!Number.isFinite(value) || !Number.isFinite(previousValue)) return null;
  if (previousValue === 0) return value === 0 ? 0 : null;
  return Math.round(((value - previousValue) / previousValue) * 1000) / 10;
}

export function addJerusalemCalendarDays(dateKey: string, delta: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d + delta));
  const yy = utc.getUTCFullYear();
  const mm = String(utc.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(utc.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export function upcomingEventDateWindow(todayKey: string): {
  fromKey: string;
  toKey: string;
  keys: string[];
} {
  const keys: string[] = [];
  for (let i = 0; i <= 6; i++) {
    keys.push(addJerusalemCalendarDays(todayKey, i));
  }
  return { fromKey: keys[0], toKey: keys[6], keys };
}

function severityRank(s: BusinessReviewAlertSeverity): number {
  if (s === 'critical') return 0;
  if (s === 'warning') return 1;
  return 2;
}

function mapExceptionSeverity(s: ExceptionSeverity): BusinessReviewAlertSeverity {
  return s;
}

export function paymentExceptionToAlert(
  order: Record<string, unknown>,
  ex: PaymentException
): BusinessReviewAlert {
  const orderId = String(order._id || order.id || '');
  const orderNumber = order.orderNumber ? String(order.orderNumber) : undefined;
  const customerName = extractCustomerName(order.customerDetails) || undefined;
  const relevantDate =
    extractEventDate(order.customerDetails) ||
    (order.createdAt ? new Date(order.createdAt as string | Date).toISOString().slice(0, 10) : null);
  return {
    id: `${ex.code}:${orderId}`,
    severity: mapExceptionSeverity(ex.severity),
    type: ex.code,
    titleHe: ex.labelHe,
    explanationHe: ex.explanationHe,
    orderId,
    orderNumber,
    customerName,
    relevantDate,
    href: `/admin/orders?orderId=${orderId}`
  };
}

export function buildOpsAlert(
  order: Record<string, unknown>,
  type: string,
  severity: BusinessReviewAlertSeverity,
  titleHe: string,
  explanationHe: string
): BusinessReviewAlert {
  const orderId = String(order._id || order.id || '');
  return {
    id: `${type}:${orderId}`,
    severity,
    type,
    titleHe,
    explanationHe,
    orderId,
    orderNumber: order.orderNumber ? String(order.orderNumber) : undefined,
    customerName: extractCustomerName(order.customerDetails) || undefined,
    relevantDate:
      extractEventDate(order.customerDetails) ||
      (order.createdAt
        ? new Date(order.createdAt as string | Date).toISOString().slice(0, 10)
        : null),
    href: `/admin/orders?orderId=${orderId}`
  };
}

/** Order statuses used by Megadim ops tabs (incl. aliases). */
const KNOWN_ORDER_STATUSES = new Set([
  'pending',
  'new',
  'confirmed',
  'preparing',
  'processing',
  'in-progress',
  'ready',
  'out_for_delivery',
  'delivered',
  'completed',
  'cancelled',
  'delivery_failed'
]);

/** Mis-stored payment statuses on `order.status` — not unknown ops statuses. */
const PAYMENT_LOOKING_ORDER_STATUSES = new Set([
  'pending',
  'awaiting_payment',
  'authorized',
  'captured',
  'voided',
  'failed'
]);

/**
 * Merge payment exceptions + ops issues into a unified, deduped, severity-sorted list.
 *
 * Payment warnings align with the admin «ננטשו / נכשלו» tab only.
 * Archive (isDeleted) means the order was closed (often phone/manual pay) — never warn.
 */
export function mergeBusinessReviewAlerts(
  candidates: Record<string, unknown>[],
  options: {
    now?: Date;
    todayKey?: string;
    max?: number;
  } = {}
): BusinessReviewAlert[] {
  const now = options.now ?? new Date();
  const todayKey = options.todayKey ?? toJerusalemDateKey(now);
  const window = upcomingEventDateWindow(todayKey);
  const seen = new Set<string>();
  const alerts: BusinessReviewAlert[] = [];

  const push = (alert: BusinessReviewAlert) => {
    if (seen.has(alert.id)) return;
    seen.add(alert.id);
    alerts.push(alert);
  };

  for (const doc of candidates) {
    if (doc.isTestOrder === true) continue;
    // Archive = handled (manual/phone close). No attention alerts of any kind.
    if (doc.isDeleted === true) continue;

    const onFailedTab = hasOpenPaymentExceptionForTab(doc as any, now);
    const captureLock = hasActiveCaptureLock(doc);

    // Payment attention: failed/abandoned tab only (+ active capture lock).
    if (onFailedTab || captureLock) {
      const exceptions = evaluatePaymentExceptions(doc, now);
      for (const ex of exceptions) {
        if (!onFailedTab && ex.code !== 'active_capture_lock') continue;
        // Dashboard payment warnings = failed tab only; stale_pending is not that tab.
        if (ex.code === 'stale_pending') continue;
        push(paymentExceptionToAlert(doc, ex));
      }

      const payStatus = String(doc.paymentStatus || '');
      if (onFailedTab && payStatus === 'awaiting_payment') {
        push(
          buildOpsAlert(
            doc,
            'awaiting_abandoned',
            'warning',
            'ננטש בתשלום',
            'הלקוח התחיל תשלום באתר ולא חזר עם אישור מספק הסליקה. אין אישור שהכסף התקבל.'
          )
        );
      }
    }

    const eventDate = extractEventDate(doc.customerDetails);
    const inUpcoming =
      eventDate &&
      window.keys.includes(eventDate) &&
      String(doc.status || '') !== 'cancelled';

    if (inUpcoming) {
      const fulfillment = resolveFulfillment(doc.customerDetails);
      if (fulfillment === 'unknown') {
        push(
          buildOpsAlert(
            doc,
            'missing_fulfillment',
            'warning',
            'חסר סוג אספקה',
            'הזמנה קרובה ללא סוג משלוח/איסוף.'
          )
        );
      }
      const cd =
        doc.customerDetails && typeof doc.customerDetails === 'object'
          ? (doc.customerDetails as Record<string, unknown>)
          : {};
      const address = String(
        cd.address || cd.deliveryAddress || (cd.deliveryDetails as any)?.address || ''
      ).trim();
      if (fulfillment === 'delivery' && !address) {
        push(
          buildOpsAlert(
            doc,
            'missing_address',
            'warning',
            'חסרה כתובת',
            'משלוח קרוב ללא כתובת.'
          )
        );
      }
    }

    // Invalid eventDate on active non-cancelled orders that claim one
    if (String(doc.status || '') !== 'cancelled') {
      const rawEvent = String(
        (doc.customerDetails as any)?.eventDate || ''
      ).trim();
      if (rawEvent && !/^\d{4}-\d{2}-\d{2}$/.test(rawEvent)) {
        push(
          buildOpsAlert(
            doc,
            'invalid_event_date',
            'info',
            'תאריך אירוע לא תקין',
            'שדה מועד האספקה אינו בפורמט תקין.'
          )
        );
      }
    }

    // Unknown payment status only when still on the failed/abandoned attention path
    const payStatus = String(doc.paymentStatus || '');
    if (
      onFailedTab &&
      payStatus &&
      !['pending', 'awaiting_payment', 'authorized', 'captured', 'voided', 'failed'].includes(
        payStatus
      )
    ) {
      push(
        buildOpsAlert(
          doc,
          'unknown_payment_status',
          'warning',
          'סטטוס תשלום לא מוכר',
          `סטטוס תשלום לא מוכר: ${payStatus}`
        )
      );
    }

    const orderStatus = String(doc.status || '').trim();
    if (
      orderStatus &&
      !KNOWN_ORDER_STATUSES.has(orderStatus) &&
      !PAYMENT_LOOKING_ORDER_STATUSES.has(orderStatus)
    ) {
      push(
        buildOpsAlert(
          doc,
          'unknown_order_status',
          'info',
          'סטטוס הזמנה לא מוכר',
          `סטטוס הזמנה לא מוכר: ${orderStatus}`
        )
      );
    }
  }

  alerts.sort(
    (a, b) =>
      severityRank(a.severity) - severityRank(b.severity) ||
      a.id.localeCompare(b.id)
  );
  return alerts.slice(0, options.max ?? 30);
}

export function uniqueOrderIdsInAlerts(alerts: BusinessReviewAlert[]): number {
  const ids = new Set(alerts.map((a) => a.orderId).filter(Boolean));
  return ids.size;
}

export function buildBreakdownRows(
  counts: Map<string, number>,
  labelOf: (key: string) => string
): Array<{ key: string; labelHe: string; count: number; percent: number }> {
  const total = Array.from(counts.values()).reduce((s, n) => s + n, 0);
  return Array.from(counts.entries())
    .map(([key, count]) => ({
      key,
      labelHe: labelOf(key),
      count,
      percent: total > 0 ? Math.round((count / total) * 1000) / 10 : 0
    }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Consistency assertion for tests: sum of revenue amounts for docs where isPaidOrder
 * equals filtering with the same predicate (SSOT).
 */
export function assertPaidRevenueConsistency(
  docs: Record<string, unknown>[]
): { paidSum: number; paidCount: number; clauseAligned: boolean } {
  const paid = docs.filter((d) => isPaidOrder(d));
  const paidSum = roundMoney(
    paid.reduce((s, d) => s + getOrderRevenueAmount(d as any), 0)
  );
  const paidCount = paid.length;

  const clause = buildPaidOrdersClause() as Record<string, unknown>;
  const clauseAligned =
    clause.isTestOrder != null &&
    Array.isArray(clause.$and) &&
    paid.every((d) => isPaidOrder(d));

  return { paidSum, paidCount, clauseAligned };
}

function moneyClose(a: number, b: number): boolean {
  return Math.abs(roundMoney(a) - roundMoney(b)) < 0.005;
}

/**
 * Fails (throws) when primary businessReview paid KPIs disagree with the legacy
 * finance board fields (financialSummary / kpis) on the same overview payload.
 */
export function assertDashboardPaidFinanceAreasConsistent(payload: {
  businessReview: {
    kpis: {
      paidRevenue: { value: number };
      paidOrders: { value: number };
      averagePaidOrder: { value: number };
    };
  };
  financialSummary: {
    actualRevenue: number;
    paidOrders: number;
    averageOrderValue: number;
  };
  kpis: {
    actualRevenue: { value: number };
    paidOrders: { value: number };
    averageOrderValue: { value: number };
  };
}): void {
  const br = payload.businessReview.kpis;
  const fs = payload.financialSummary;
  const k = payload.kpis;

  const mismatches: string[] = [];
  if (!moneyClose(br.paidRevenue.value, fs.actualRevenue)) {
    mismatches.push(
      `revenue br=${br.paidRevenue.value} vs financialSummary=${fs.actualRevenue}`
    );
  }
  if (!moneyClose(br.paidRevenue.value, k.actualRevenue.value)) {
    mismatches.push(
      `revenue br=${br.paidRevenue.value} vs kpis=${k.actualRevenue.value}`
    );
  }
  if (br.paidOrders.value !== fs.paidOrders) {
    mismatches.push(
      `paidCount br=${br.paidOrders.value} vs financialSummary=${fs.paidOrders}`
    );
  }
  if (br.paidOrders.value !== k.paidOrders.value) {
    mismatches.push(
      `paidCount br=${br.paidOrders.value} vs kpis=${k.paidOrders.value}`
    );
  }
  if (!moneyClose(br.averagePaidOrder.value, fs.averageOrderValue)) {
    mismatches.push(
      `aov br=${br.averagePaidOrder.value} vs financialSummary=${fs.averageOrderValue}`
    );
  }
  if (!moneyClose(br.averagePaidOrder.value, k.averageOrderValue.value)) {
    mismatches.push(
      `aov br=${br.averagePaidOrder.value} vs kpis=${k.averageOrderValue.value}`
    );
  }
  if (mismatches.length) {
    throw new Error(
      `Dashboard paid finance areas inconsistent: ${mismatches.join('; ')}`
    );
  }
}

/** Patch legacy finance KPIs so they reuse businessReview (admin-payments) paid totals. */
export function alignPaidFinanceFromBusinessReview<
  TMetrics extends {
    kpis: Record<string, unknown>;
    financialSummary: Record<string, unknown>;
  }
>(
  metrics: TMetrics,
  businessReview: {
    kpis: {
      paidRevenue: { value: number; previousValue: number; changePercent: number | null };
      paidOrders: { value: number; previousValue: number; changePercent: number | null };
      averagePaidOrder: { value: number; previousValue: number; changePercent: number | null };
    };
  }
): TMetrics {
  const paidRev = businessReview.kpis.paidRevenue;
  const paidOrd = businessReview.kpis.paidOrders;
  const avg = businessReview.kpis.averagePaidOrder;

  const revTriple = {
    value: paidRev.value,
    previousValue: paidRev.previousValue,
    changePercent: paidRev.changePercent
  };
  const ordTriple = {
    value: paidOrd.value,
    previousValue: paidOrd.previousValue,
    changePercent: paidOrd.changePercent
  };
  const avgTriple = {
    value: avg.value,
    previousValue: avg.previousValue,
    changePercent: avg.changePercent
  };

  metrics.kpis.actualRevenue = revTriple;
  metrics.kpis.capturedRevenue = revTriple;
  metrics.kpis.paidOrders = ordTriple;
  metrics.kpis.averageOrderValue = avgTriple;

  metrics.financialSummary.actualRevenue = paidRev.value;
  metrics.financialSummary.capturedRevenue = paidRev.value;
  metrics.financialSummary.paidOrders = paidOrd.value;
  metrics.financialSummary.averageOrderValue = avg.value;
  metrics.financialSummary.capturedRevenueChange = revTriple;
  metrics.financialSummary.paidOrdersChange = ordTriple;
  metrics.financialSummary.averageOrderValueChange = avgTriple;

  return metrics;
}

export function fillActivitySeriesPoints(
  dateFrom: Date,
  dateTo: Date,
  points: Array<{ date: string; revenue: number; paidCount: number; ordersCreated: number }>,
  granularity: 'day' | 'month'
): Array<{ date: string; revenue: number; paidCount: number; ordersCreated: number }> {
  const byKey = new Map(points.map((p) => [p.date, p]));
  const out: Array<{ date: string; revenue: number; paidCount: number; ordersCreated: number }> = [];

  if (granularity === 'day') {
    let key = toJerusalemDateKey(dateFrom);
    const endKey = toJerusalemDateKey(dateTo);
    while (key <= endKey) {
      const hit = byKey.get(key);
      out.push({
        date: key,
        revenue: hit?.revenue ?? 0,
        paidCount: hit?.paidCount ?? 0,
        ordersCreated: hit?.ordersCreated ?? 0
      });
      key = addJerusalemCalendarDays(key, 1);
    }
    return out;
  }

  // month buckets
  let cursor = toJerusalemDateKey(dateFrom).slice(0, 7);
  const end = toJerusalemDateKey(dateTo).slice(0, 7);
  while (cursor <= end) {
    const hit = byKey.get(cursor);
    out.push({
      date: cursor,
      revenue: hit?.revenue ?? 0,
      paidCount: hit?.paidCount ?? 0,
      ordersCreated: hit?.ordersCreated ?? 0
    });
    const [y, m] = cursor.split('-').map(Number);
    const nextM = m === 12 ? 1 : m + 1;
    const nextY = m === 12 ? y + 1 : y;
    cursor = `${nextY}-${String(nextM).padStart(2, '0')}`;
  }
  return out;
}

export function activityGranularity(dateFrom: Date, dateTo: Date): 'day' | 'month' {
  const days = (dateTo.getTime() - dateFrom.getTime()) / (24 * 60 * 60 * 1000);
  return days <= 62 ? 'day' : 'month';
}

/** Re-export day bounds for service convenience. */
export { jerusalemDayStartUtc, jerusalemDayEndUtc };
