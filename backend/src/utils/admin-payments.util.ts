/**
 * Central calculation + mapping for the admin financial control screen.
 * Single source of truth for paid / pending / failed / exceptions / revenue.
 * No DB access — safe for unit tests. Read-only display helpers only.
 */
import {
  extractCustomerName,
  extractCustomerPhone,
  resolveFulfillment
} from './dashboard-ops.util';
import { getEffectiveOrderAmount } from './order-admin-pricing.util';

export const ADMIN_PAYMENT_STATUSES = [
  'pending',
  'awaiting_payment',
  'authorized',
  'captured',
  'voided',
  'failed'
] as const;

export type AdminPaymentStatus = (typeof ADMIN_PAYMENT_STATUSES)[number];

/** Virtual filter — not a paymentStatus enum value. */
export const MANUAL_REVIEW_FILTER = 'manual_review';

/** Pending / awaiting / authorized older than this are flagged for review. */
export const PENDING_STALE_MS = 24 * 60 * 60 * 1000;

/** Hard cap on date range length (days) for admin queries. */
export const MAX_DATE_RANGE_DAYS = 366;

export const JERUSALEM_TZ = 'Asia/Jerusalem';

export type FunnelBucket = 'all' | 'paid' | 'pending' | 'failed_cancelled' | 'exceptions';
export type ExceptionSeverity = 'critical' | 'warning' | 'info';
export type ExceptionFilter = 'all' | 'critical' | 'warning' | 'info';

export type PaymentExceptionCode =
  | 'payment_failed'
  | 'stale_pending'
  | 'paid_but_deleted'
  | 'invalid_amount'
  | 'conflicting_payment_fields'
  | 'paid_missing_reference'
  | 'unknown_status'
  | 'active_capture_lock';

export type PaymentException = {
  code: PaymentExceptionCode;
  severity: ExceptionSeverity;
  labelHe: string;
  explanationHe: string;
};

export type AdminPaymentsListFilters = {
  dateFrom?: Date;
  dateTo?: Date;
  /**
   * createdAt (default, list UI) — filter by order creation time.
   * activity — createdAt OR paidAt OR capturedAt in range (accounting export / past orders).
   */
  dateBasis?: 'createdAt' | 'activity';
  paymentStatus?: string;
  search?: string;
  orderType?: 'shabbat' | 'catering';
  fulfillment?: 'delivery' | 'pickup';
  /**
   * When true (default): include soft-deleted orders that still carry a payment signal.
   * When false: active (non-deleted) orders only.
   */
  includeDeletedPayments?: boolean;
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'totalPrice' | 'paymentStatus' | 'orderNumber';
  sortDir?: 'asc' | 'desc';
  /** Operational funnel filter (display mapping only). */
  funnelBucket?: FunnelBucket;
  /** Exception severity filter. */
  exceptionFilter?: ExceptionFilter;
  /** When true, only rows that evaluate as exceptions. */
  exceptionsOnly?: boolean;
  /** Accounting CSV export — forces full range dump including archived past orders. */
  forExport?: boolean;
};

export type PaymentListRow = {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  amount: number;
  /** Raw DB paymentStatus (unchanged). */
  paymentStatus: string;
  rawPaymentStatus: string;
  /** Display bucket / label key — never written back to DB. */
  displayStatus: string;
  paymentBucket: FunnelBucket | 'unknown';
  paymentMethod: string | null;
  transactionReference: string | null;
  createdAt: string | null;
  paymentAt: string | null;
  orderType: string | null;
  fulfillment: 'delivery' | 'pickup' | 'unknown';
  requiresManualReview: boolean;
  hasException: boolean;
  primaryException: PaymentException | null;
  exceptionCodes: PaymentExceptionCode[];
  canCapture: boolean;
  canVoid: boolean;
  canRefund: boolean;
  /** Soft-deleted operational order — payment history retained for audit. */
  isOrderDeleted: boolean;
};

export type PaymentTimelineEvent = {
  key: string;
  label: string;
  at: string | null;
};

const SENSITIVE_KEYS = new Set([
  'captureLockId',
  'captureStartedAt',
  'paymentSecurityToken',
  'paymentInitTokenHash',
  'paymentInitTokenExpiresAt',
  'cardToken',
  'authCode',
  'expireMonth',
  'expireYear'
]);

export const STATUS_LABEL_HE: Record<string, string> = {
  pending: 'ממתין לתשלום',
  awaiting_payment: 'ממתין לתשלום',
  authorized: 'אושר (טרם חויב)',
  captured: 'שולם',
  voided: 'בוטל',
  failed: 'נכשל',
  manual_review: 'דורש בדיקה',
  unknown: 'מצב לא ברור'
};

export const FUNNEL_LABEL_HE: Record<FunnelBucket, string> = {
  all: 'כל העסקאות',
  paid: 'שולמו',
  pending: 'ממתינות',
  failed_cancelled: 'נכשלו או בוטלו',
  exceptions: 'דורשות בדיקה'
};

export function roundMoney(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export function averageTransactionAmount(revenue: number, paidCount: number): number {
  if (!paidCount || paidCount <= 0) return 0;
  return roundMoney(revenue / paidCount);
}

export function hasActiveCaptureLock(doc: Record<string, unknown> | null | undefined): boolean {
  const lock = doc?.captureLockId;
  return typeof lock === 'string' && lock.trim().length > 0;
}

export function getCustomerDetails(doc: Record<string, unknown>): Record<string, unknown> {
  return doc.customerDetails && typeof doc.customerDetails === 'object'
    ? (doc.customerDetails as Record<string, unknown>)
    : {};
}

import {
  isPaidOrder,
  buildPaidOrdersClause,
  orderContributesActualRevenue,
  getOrderRevenueAmount,
  getEffectivePaidAt,
  buildActualRevenueMatch,
  buildActualRevenueInRangeMatch,
  buildEffectivePaidAtRangeMatch,
  revenueAmountMongoExpr,
  revenueAmountMongoSumExpr,
  effectivePaidAtMongoExpr,
  ACTUAL_REVENUE_DATE_BASIS,
  ACTUAL_REVENUE_PRICE_OVERRIDE_FIELD,
  orderHasClassicPaymentProof,
  orderHasOpsImpliedManualPayment
} from './order-actual-revenue.util';

/** Canonical paid / actual-revenue definition — owned by order-actual-revenue.util. */
export {
  isPaidOrder,
  buildPaidOrdersClause,
  orderContributesActualRevenue,
  getOrderRevenueAmount,
  getEffectivePaidAt,
  buildActualRevenueMatch,
  buildActualRevenueInRangeMatch,
  buildEffectivePaidAtRangeMatch,
  revenueAmountMongoExpr,
  revenueAmountMongoSumExpr,
  effectivePaidAtMongoExpr,
  ACTUAL_REVENUE_DATE_BASIS,
  ACTUAL_REVENUE_PRICE_OVERRIDE_FIELD,
  orderHasClassicPaymentProof,
  orderHasOpsImpliedManualPayment
};

export function isPendingPayment(doc: Record<string, unknown>): boolean {
  if (isPaidOrder(doc)) return false;
  const s = String(doc.paymentStatus || 'pending');
  return s === 'pending' || s === 'awaiting_payment' || s === 'authorized';
}

export function isFailedOrCancelledPayment(doc: Record<string, unknown>): boolean {
  const s = String(doc.paymentStatus || '');
  return s === 'failed' || s === 'voided';
}

export function isKnownPaymentStatus(status: string): boolean {
  return (ADMIN_PAYMENT_STATUSES as readonly string[]).includes(status);
}

export function resolvePaymentBucket(doc: Record<string, unknown>): FunnelBucket | 'unknown' {
  if (isPaidOrder(doc)) return 'paid';
  if (isPendingPayment(doc)) return 'pending';
  if (isFailedOrCancelledPayment(doc)) return 'failed_cancelled';
  return 'unknown';
}

export function resolvePaymentMethod(doc: Record<string, unknown>): string | null {
  const tx = String(doc.transactionId || '').trim();
  if (tx && !tx.startsWith('ORD-') && !tx.startsWith('MOCK-')) {
    return 'כרטיס אשראי';
  }
  const details = getCustomerDetails(doc);
  if (details.isPaid === true) return 'תשלום ידני';
  if (tx.startsWith('MOCK-')) return 'סימולציה';
  return null;
}

/**
 * No paidAt/capturedAt on Order — best-effort display date only.
 * captured / manual paid → confirmationEmailSentAt || updatedAt || createdAt
 */
export function resolvePaymentAt(doc: Record<string, unknown>): string | null {
  const status = String(doc.paymentStatus || '');
  const confirm = doc.confirmationEmailSentAt
    ? new Date(doc.confirmationEmailSentAt as string | Date).toISOString()
    : null;
  const updated = doc.updatedAt ? new Date(doc.updatedAt as string | Date).toISOString() : null;
  const created = doc.createdAt ? new Date(doc.createdAt as string | Date).toISOString() : null;

  if (status === 'captured' || getCustomerDetails(doc).isPaid === true) {
    return confirm || updated || created;
  }
  if (status === 'authorized' || status === 'voided' || status === 'failed') {
    return updated || created;
  }
  return null;
}

export function isOrderSoftDeleted(doc: Record<string, unknown> | null | undefined): boolean {
  return doc?.isDeleted === true;
}

export const DELETED_ORDER_PAYMENT_SIGNAL_CLAUSES: Record<string, unknown>[] = [
  { paymentStatus: { $exists: true, $ne: null } },
  { 'customerDetails.isPaid': true },
  { transactionId: { $exists: true, $nin: [null, ''] } },
  { authCode: { $exists: true, $nin: [null, ''] } },
  { cardToken: { $exists: true, $nin: [null, ''] } }
];

export function orderHasPaymentSignal(doc: Record<string, unknown>): boolean {
  if (doc.paymentStatus != null && String(doc.paymentStatus).length > 0) return true;
  const details = getCustomerDetails(doc);
  if (details.isPaid === true) return true;
  if (String(doc.transactionId || '').trim()) return true;
  if (String(doc.authCode || '').trim()) return true;
  if (String(doc.cardToken || '').trim()) return true;
  return false;
}

export function buildPaymentsVisibilityClause(
  includeDeletedPayments = true
): Record<string, unknown> {
  if (!includeDeletedPayments) {
    return { isDeleted: { $ne: true } };
  }
  return {
    $or: [
      { isDeleted: { $ne: true } },
      {
        isDeleted: true,
        $or: DELETED_ORDER_PAYMENT_SIGNAL_CLAUSES
      }
    ]
  };
}

export function resolveDisplayStatus(doc: Record<string, unknown>): string {
  if (hasActiveCaptureLock(doc)) return 'manual_review';
  // Ops-implied / classic paid ⇒ show as paid even if paymentStatus still pending.
  if (isPaidOrder(doc)) return 'captured';
  const s = String(doc.paymentStatus || 'pending');
  if (!isKnownPaymentStatus(s)) return 'unknown';
  return s;
}

export function canCapturePayment(doc: Record<string, unknown>): boolean {
  if (isOrderSoftDeleted(doc)) return false;
  return String(doc.paymentStatus || '') === 'authorized' && !hasActiveCaptureLock(doc);
}

export function canVoidPayment(doc: Record<string, unknown>): boolean {
  if (isOrderSoftDeleted(doc)) return false;
  return String(doc.paymentStatus || '') === 'authorized' && !hasActiveCaptureLock(doc);
}

/** Manager already closed this payment exception in the orders tab. */
export function isPaymentExceptionResolved(
  doc: Record<string, unknown> | null | undefined
): boolean {
  return doc?.paymentExceptionResolvedAt != null;
}

/** Evaluate display-only exception rules from existing reliable fields. */
export function evaluatePaymentExceptions(
  doc: Record<string, unknown>,
  now = new Date()
): PaymentException[] {
  const out: PaymentException[] = [];
  const status = String(doc.paymentStatus || '');
  const details = getCustomerDetails(doc);
  const created = doc.createdAt ? new Date(doc.createdAt as string | Date) : null;
  const settled = isPaidOrder(doc);
  const classicPaid = orderHasClassicPaymentProof(doc);
  const opsImplied = orderHasOpsImpliedManualPayment(doc);
  const tx = String(doc.transactionId || '').trim();
  const resolved = isPaymentExceptionResolved(doc);
  const archived = isOrderSoftDeleted(doc);

  // Active capture lock always surfaces — independent of resolution/archive.
  if (hasActiveCaptureLock(doc)) {
    out.push({
      code: 'active_capture_lock',
      severity: 'warning',
      labelHe: 'מצב לא ברור',
      explanationHe: 'נמצא סימן לנעילת חיוב פעילה. מומלץ לבדוק ידנית — אין פעולה אוטומטית במסך זה.'
    });
  }

  // Failed payment only when still open AND not already settled via ops (ready/archive/etc).
  if (status === 'failed' && !resolved && !opsImplied) {
    out.push({
      code: 'payment_failed',
      severity: 'critical',
      labelHe: 'תשלום נכשל',
      explanationHe: 'סטטוס התשלום מסומן כנכשל. מומלץ לבדוק מול הלקוח או מול ספק הסליקה.'
    });
  }

  // Archive of completed work is the normal Megadim workflow — never a warning.
  // (paid_but_deleted intentionally removed.)

  // Invalid amount only for classic payment proof with non-positive effective amount.
  // Ops-implied ₪0 quotes/drafts should not flood the review queue.
  if (classicPaid) {
    const effective = getEffectiveOrderAmount(doc);
    if (!Number.isFinite(effective) || effective <= 0) {
      out.push({
        code: 'invalid_amount',
        severity: 'warning',
        labelHe: 'סכום לא תקין',
        explanationHe: 'חסר סכום תקין לעסקה ששולמה. מומלץ לבדוק את פרטי ההזמנה / תיקון מנהל.'
      });
    }
  }

  if (details.isPaid === true && (status === 'failed' || status === 'voided') && !resolved && !opsImplied) {
    out.push({
      code: 'conflicting_payment_fields',
      severity: 'warning',
      labelHe: 'מידע סותר',
      explanationHe: 'קיים סימון תשלום ידני לצד סטטוס נכשל/בוטל. מצב לא ברור — מומלץ לבדוק.'
    });
  }

  if (classicPaid && !opsImplied && status === 'captured' && !tx && details.isPaid !== true) {
    out.push({
      code: 'paid_missing_reference',
      severity: 'info',
      labelHe: 'חסר מידע',
      explanationHe: 'עסקה ששולמה ללא אסמכתת סליקה שמורה. חסר מידע — מומלץ לבדוק.'
    });
  }

  if (status && !isKnownPaymentStatus(status) && !settled) {
    out.push({
      code: 'unknown_status',
      severity: 'warning',
      labelHe: 'מצב לא מוכר',
      explanationHe: 'סטטוס התשלום אינו מוכר במערכת. מצב לא ברור.'
    });
  }

  // Only open unpaid ops (pending/processing) can be stale — settled/archive never.
  if (
    !settled &&
    !archived &&
    !resolved &&
    isPendingPayment(doc) &&
    created &&
    !Number.isNaN(created.getTime()) &&
    now.getTime() - created.getTime() > PENDING_STALE_MS
  ) {
    out.push({
      code: 'stale_pending',
      severity: 'warning',
      labelHe: 'ממתין זמן ממושך',
      explanationHe: 'העסקה ממתינה לתשלום או לחיוב מעבר ל־24 שעות. מומלץ לבדוק.'
    });
  }

  const severityRank: Record<ExceptionSeverity, number> = {
    critical: 0,
    warning: 1,
    info: 2
  };
  return out.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);
}

export function primaryException(
  doc: Record<string, unknown>,
  now = new Date()
): PaymentException | null {
  return evaluatePaymentExceptions(doc, now)[0] || null;
}

export function exceptionSeverityTone(
  exceptions: PaymentException[]
): ExceptionSeverity | null {
  if (!exceptions.length) return null;
  if (exceptions.some((e) => e.severity === 'critical')) return 'critical';
  if (exceptions.some((e) => e.severity === 'warning')) return 'warning';
  return 'info';
}

/** Mongo approximate match for exception candidates (refined in JS). */
export function buildExceptionsApproximateClause(now = new Date()): Record<string, unknown> {
  const staleBefore = new Date(now.getTime() - PENDING_STALE_MS);
  const unresolved = {
    $or: [
      { paymentExceptionResolvedAt: null },
      { paymentExceptionResolvedAt: { $exists: false } }
    ]
  };
  // Ops-settled orders (archive / ready / completed) are never exception candidates
  // except for an active capture lock.
  const notOpsSettled = {
    $nor: [
      {
        $and: [
          { status: { $ne: 'cancelled' } },
          {
            $or: [
              { isDeleted: true },
              { status: { $in: ['ready', 'out_for_delivery', 'delivered', 'completed'] } }
            ]
          }
        ]
      }
    ]
  };
  return {
    $or: [
      { captureLockId: { $type: 'string', $ne: '' } },
      {
        $and: [{ paymentStatus: 'failed' }, unresolved, notOpsSettled]
      },
      {
        $and: [
          { paymentStatus: 'captured' },
          notOpsSettled,
          {
            $or: [
              { transactionId: null },
              { transactionId: '' },
              { transactionId: { $exists: false } }
            ]
          },
          { 'customerDetails.isPaid': { $ne: true } }
        ]
      },
      {
        $and: [
          { 'customerDetails.isPaid': true },
          { paymentStatus: { $in: ['failed', 'voided'] } },
          unresolved,
          notOpsSettled
        ]
      },
      {
        $and: [
          notOpsSettled,
          { paymentStatus: { $nin: [...ADMIN_PAYMENT_STATUSES, null] } }
        ]
      },
      {
        $and: [
          notOpsSettled,
          { isDeleted: { $ne: true } },
          unresolved,
          { paymentStatus: { $in: ['pending', 'awaiting_payment', 'authorized'] } },
          { 'customerDetails.isPaid': { $ne: true } },
          { createdAt: { $lte: staleBefore } }
        ]
      },
      {
        $and: [
          {
            $or: [{ paymentStatus: 'captured' }, { 'customerDetails.isPaid': true }]
          },
          {
            $or: [
              {
                $and: [
                  {
                    $or: [
                      { adminPriceOverride: null },
                      { adminPriceOverride: { $exists: false } }
                    ]
                  },
                  {
                    $or: [
                      { totalPrice: { $lte: 0 } },
                      { totalPrice: null },
                      { totalPrice: { $exists: false } }
                    ]
                  }
                ]
              },
              { adminPriceOverride: { $lte: 0 } }
            ]
          }
        ]
      }
    ]
  };
}

export function buildFunnelBucketClause(
  bucket: FunnelBucket,
  now = new Date()
): Record<string, unknown> | null {
  if (bucket === 'all') return null;
  if (bucket === 'paid') return buildPaidOrdersClause();
  if (bucket === 'pending') {
    return {
      $and: [
        { paymentStatus: { $in: ['pending', 'awaiting_payment', 'authorized'] } },
        { 'customerDetails.isPaid': { $ne: true } },
        { paidAt: { $not: { $type: 'date' } } },
        { capturedAt: { $not: { $type: 'date' } } }
      ]
    };
  }
  if (bucket === 'failed_cancelled') {
    return { paymentStatus: { $in: ['failed', 'voided'] } };
  }
  if (bucket === 'exceptions') {
    return buildExceptionsApproximateClause(now);
  }
  return null;
}

export function buildPaymentsMatch(
  filters: AdminPaymentsListFilters,
  now = new Date()
): Record<string, unknown> {
  const includeDeleted = filters.includeDeletedPayments !== false;
  const and: Record<string, unknown>[] = [buildPaymentsVisibilityClause(includeDeleted)];

  if (filters.dateFrom || filters.dateTo) {
    const range: Record<string, Date> = {};
    if (filters.dateFrom) range.$gte = filters.dateFrom;
    if (filters.dateTo) range.$lte = filters.dateTo;
    if (filters.dateBasis === 'activity') {
      // Include past/archived orders whose payment or creation falls in the selected range.
      and.push({
        $or: [{ createdAt: range }, { paidAt: range }, { capturedAt: range }]
      });
    } else {
      and.push({ createdAt: range });
    }
  }

  const status = String(filters.paymentStatus || '').trim();
  if (status === MANUAL_REVIEW_FILTER) {
    and.push({ captureLockId: { $type: 'string', $ne: '' } });
  } else if (status && ADMIN_PAYMENT_STATUSES.includes(status as AdminPaymentStatus)) {
    and.push({ paymentStatus: status });
  }

  if (filters.orderType === 'shabbat' || filters.orderType === 'catering') {
    and.push({ orderType: filters.orderType });
  }

  if (filters.fulfillment === 'delivery' || filters.fulfillment === 'pickup') {
    and.push({
      $or: [
        { 'customerDetails.deliveryType': filters.fulfillment },
        { 'customerDetails.deliveryMethod': filters.fulfillment },
        ...(filters.fulfillment === 'pickup'
          ? [
              { 'customerDetails.deliveryType': 'self-pickup' },
              { 'customerDetails.deliveryMethod': 'self-pickup' },
              { 'customerDetails.deliveryType': 'self_pickup' },
              { 'customerDetails.deliveryMethod': 'self_pickup' }
            ]
          : [])
      ]
    });
  }

  const q = String(filters.search || '').trim();
  if (q) {
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rx = new RegExp(escaped, 'i');
    and.push({
      $or: [
        { orderNumber: rx },
        { transactionId: rx },
        { 'customerDetails.fullName': rx },
        { 'customerDetails.name': rx },
        { 'customerDetails.customerName': rx },
        { 'customerDetails.phone': rx },
        { 'customerDetails.email': rx }
      ]
    });
  }

  const bucket = filters.funnelBucket || 'all';
  const bucketClause = buildFunnelBucketClause(bucket, now);
  if (bucketClause) and.push(bucketClause);

  if (filters.exceptionFilter === 'critical' || filters.exceptionFilter === 'warning' || filters.exceptionFilter === 'info') {
    and.push(buildExceptionsApproximateClause(now));
  }

  return and.length === 1 ? and[0] : { $and: and };
}

export function toJerusalemDateKey(input: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: JERUSALEM_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(input);
  const y = parts.find((p) => p.type === 'year')?.value;
  const m = parts.find((p) => p.type === 'month')?.value;
  const d = parts.find((p) => p.type === 'day')?.value;
  return `${y}-${m}-${d}`;
}

export function jerusalemDayStartUtc(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00+03:00`);
}

export function jerusalemDayEndUtc(dateKey: string): Date {
  return new Date(`${dateKey}T23:59:59.999+03:00`);
}

export type DatePreset =
  | 'today'
  | 'last7'
  | 'last30'
  | 'this_month'
  | 'last_month'
  | 'custom';

export function resolveDatePresetRange(
  preset: DatePreset,
  now = new Date(),
  customFrom?: string,
  customTo?: string
): { dateFrom: Date; dateTo: Date; preset: DatePreset } {
  const todayKey = toJerusalemDateKey(now);
  if (preset === 'custom' && customFrom && customTo) {
    const from = /^\d{4}-\d{2}-\d{2}$/.test(customFrom)
      ? jerusalemDayStartUtc(customFrom)
      : new Date(customFrom);
    const to = /^\d{4}-\d{2}-\d{2}$/.test(customTo)
      ? jerusalemDayEndUtc(customTo)
      : new Date(customTo);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return resolveDatePresetRange('this_month', now);
    }
    return { dateFrom: from, dateTo: to, preset: 'custom' };
  }

  if (preset === 'today') {
    return {
      dateFrom: jerusalemDayStartUtc(todayKey),
      dateTo: jerusalemDayEndUtc(todayKey),
      preset: 'today'
    };
  }

  if (preset === 'last7' || preset === 'last30') {
    const days = preset === 'last7' ? 6 : 29;
    const end = jerusalemDayEndUtc(todayKey);
    const startAnchor = jerusalemDayStartUtc(todayKey);
    const startDate = new Date(startAnchor.getTime() - days * 24 * 60 * 60 * 1000);
    const startKey = toJerusalemDateKey(startDate);
    return {
      dateFrom: jerusalemDayStartUtc(startKey),
      dateTo: end,
      preset
    };
  }

  if (preset === 'last_month') {
    const [y, m] = todayKey.split('-').map(Number);
    const prevM = m === 1 ? 12 : m - 1;
    const prevY = m === 1 ? y - 1 : y;
    const startKey = `${prevY}-${String(prevM).padStart(2, '0')}-01`;
    const thisMonthStart = jerusalemDayStartUtc(`${y}-${String(m).padStart(2, '0')}-01`);
    const end = new Date(thisMonthStart.getTime() - 1);
    return {
      dateFrom: jerusalemDayStartUtc(startKey),
      dateTo: end,
      preset: 'last_month'
    };
  }

  const [y, m] = todayKey.split('-').map(Number);
  const startKey = `${y}-${String(m).padStart(2, '0')}-01`;
  return {
    dateFrom: jerusalemDayStartUtc(startKey),
    dateTo: jerusalemDayEndUtc(todayKey),
    preset: 'this_month'
  };
}

/** Previous period of equal length ending just before current from. */
export function previousPeriodRange(
  dateFrom: Date,
  dateTo: Date
): { dateFrom: Date; dateTo: Date } | null {
  const fromMs = dateFrom.getTime();
  const toMs = dateTo.getTime();
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || toMs < fromMs) return null;
  const duration = toMs - fromMs;
  const prevTo = new Date(fromMs - 1);
  const prevFrom = new Date(prevTo.getTime() - duration);
  return { dateFrom: prevFrom, dateTo: prevTo };
}

export function clampDateRange(
  dateFrom?: Date,
  dateTo?: Date
): { dateFrom?: Date; dateTo?: Date; clamped: boolean } {
  if (!dateFrom || !dateTo) return { dateFrom, dateTo, clamped: false };
  const ms = dateTo.getTime() - dateFrom.getTime();
  const maxMs = MAX_DATE_RANGE_DAYS * 24 * 60 * 60 * 1000;
  if (ms <= maxMs) return { dateFrom, dateTo, clamped: false };
  return {
    dateFrom,
    dateTo: new Date(dateFrom.getTime() + maxMs),
    clamped: true
  };
}

export function parseListQuery(query: Record<string, unknown>): AdminPaymentsListFilters {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 25));
  const sortByRaw = String(query.sortBy || 'createdAt');
  let sortBy: NonNullable<AdminPaymentsListFilters['sortBy']> = 'createdAt';
  if (sortByRaw === 'totalPrice' || sortByRaw === 'amount') sortBy = 'totalPrice';
  else if (sortByRaw === 'paymentStatus') sortBy = 'paymentStatus';
  else if (sortByRaw === 'orderNumber') sortBy = 'orderNumber';
  const sortDir = String(query.sortDir || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';

  const presetRaw = String(query.preset || '').trim() as DatePreset | '';
  const validPresets: DatePreset[] = [
    'today',
    'last7',
    'last30',
    'this_month',
    'last_month',
    'custom'
  ];
  let dateFrom: Date | undefined;
  let dateTo: Date | undefined;

  if (presetRaw && validPresets.includes(presetRaw as DatePreset) && presetRaw !== 'custom') {
    const range = resolveDatePresetRange(presetRaw as DatePreset);
    dateFrom = range.dateFrom;
    dateTo = range.dateTo;
  } else if (query.dateFrom || query.dateTo || presetRaw === 'custom') {
    if (query.dateFrom) {
      const raw = String(query.dateFrom);
      if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) dateFrom = jerusalemDayStartUtc(raw);
      else {
        const d = new Date(raw);
        if (!Number.isNaN(d.getTime())) dateFrom = d;
      }
    }
    if (query.dateTo) {
      const raw = String(query.dateTo);
      if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) dateTo = jerusalemDayEndUtc(raw);
      else {
        const d = new Date(raw);
        if (!Number.isNaN(d.getTime())) dateTo = d;
      }
    }
  } else {
    const range = resolveDatePresetRange('this_month');
    dateFrom = range.dateFrom;
    dateTo = range.dateTo;
  }

  const clamped = clampDateRange(dateFrom, dateTo);
  dateFrom = clamped.dateFrom;
  dateTo = clamped.dateTo;

  const orderTypeRaw = String(query.orderType || '');
  const fulfillmentRaw = String(query.fulfillment || '');
  const includeRaw = String(query.includeDeletedPayments ?? 'true').toLowerCase();
  const includeDeletedPayments = !(
    includeRaw === 'false' ||
    includeRaw === '0' ||
    includeRaw === 'active'
  );

  const forExportRaw = String(query.forExport ?? '').toLowerCase();
  const forExport =
    forExportRaw === '1' || forExportRaw === 'true' || forExportRaw === 'yes';

  const dateBasisRaw = String(query.dateBasis || '').trim();
  const dateBasis: 'createdAt' | 'activity' | undefined = forExport
    ? 'activity'
    : dateBasisRaw === 'activity'
      ? 'activity'
      : dateBasisRaw === 'createdAt'
        ? 'createdAt'
        : undefined;

  const funnelRaw = String(query.funnelBucket || query.funnel || 'all');
  const funnelBucket: FunnelBucket =
    funnelRaw === 'paid' ||
    funnelRaw === 'pending' ||
    funnelRaw === 'failed_cancelled' ||
    funnelRaw === 'exceptions'
      ? funnelRaw
      : 'all';

  const exRaw = String(query.exceptionFilter || query.exceptionSeverity || 'all');
  const exceptionFilter: ExceptionFilter =
    exRaw === 'critical' || exRaw === 'warning' || exRaw === 'info' ? exRaw : 'all';

  return {
    page,
    limit,
    sortBy,
    sortDir,
    dateFrom,
    dateTo,
    dateBasis,
    forExport,
    paymentStatus: query.paymentStatus ? String(query.paymentStatus) : undefined,
    search: query.search ? String(query.search).slice(0, 200) : undefined,
    orderType:
      orderTypeRaw === 'shabbat' || orderTypeRaw === 'catering' ? orderTypeRaw : undefined,
    fulfillment:
      fulfillmentRaw === 'delivery' || fulfillmentRaw === 'pickup' ? fulfillmentRaw : undefined,
    // Export always includes archived / past orders with payment signals.
    includeDeletedPayments: forExport ? true : includeDeletedPayments,
    funnelBucket: forExport ? 'all' : funnelBucket,
    exceptionFilter: forExport ? 'all' : exceptionFilter,
    exceptionsOnly: forExport
      ? false
      : exceptionFilter !== 'all' || funnelBucket === 'exceptions'
  };
}

export function mapOrderToPaymentRow(
  doc: Record<string, unknown>,
  now = new Date()
): PaymentListRow {
  const id = String(doc._id || doc.id || '');
  const status = String(doc.paymentStatus || 'pending');
  const exceptions = evaluatePaymentExceptions(doc, now);
  const primary = exceptions[0] || null;
  const isOrderDeleted = isOrderSoftDeleted(doc);
  return {
    id,
    orderNumber: String(doc.orderNumber || id),
    customerName: extractCustomerName(doc.customerDetails) || 'לקוח',
    customerPhone: extractCustomerPhone(doc.customerDetails),
    // SSOT display amount: manager override when set, else charged totalPrice.
    amount: getEffectiveOrderAmount(doc),
    paymentStatus: status,
    rawPaymentStatus: status,
    displayStatus: resolveDisplayStatus(doc),
    paymentBucket: resolvePaymentBucket(doc),
    paymentMethod: resolvePaymentMethod(doc),
    transactionReference: doc.transactionId ? String(doc.transactionId) : null,
    createdAt: doc.createdAt ? new Date(doc.createdAt as string | Date).toISOString() : null,
    paymentAt: resolvePaymentAt(doc),
    orderType: doc.orderType ? String(doc.orderType) : null,
    fulfillment: resolveFulfillment(doc.customerDetails),
    // Manual review badge is only for active capture lock — not every exception.
    requiresManualReview: hasActiveCaptureLock(doc),
    hasException: exceptions.length > 0,
    primaryException: primary,
    exceptionCodes: exceptions.map((e) => e.code),
    canCapture: false,
    canVoid: false,
    canRefund: false,
    isOrderDeleted
  };
}

export function filterRowsByExceptionSeverity(
  rows: PaymentListRow[],
  filter: ExceptionFilter
): PaymentListRow[] {
  if (filter === 'all') return rows;
  return rows.filter((r) => r.primaryException?.severity === filter);
}

export function buildPaymentTimeline(doc: Record<string, unknown>): PaymentTimelineEvent[] {
  const events: PaymentTimelineEvent[] = [
    {
      key: 'created',
      label: 'יצירת הזמנה',
      at: doc.createdAt ? new Date(doc.createdAt as string | Date).toISOString() : null
    }
  ];

  if (doc.confirmationEmailSentAt) {
    events.push({
      key: 'confirmation_email',
      label: 'אימייל אישור נשלח',
      at: new Date(doc.confirmationEmailSentAt as string | Date).toISOString()
    });
  }

  if (hasActiveCaptureLock(doc) && doc.captureStartedAt) {
    events.push({
      key: 'capture_lock',
      label: 'סימן לנעילת חיוב — מומלץ לבדוק ידנית',
      at: new Date(doc.captureStartedAt as string | Date).toISOString()
    });
  }

  const status = String(doc.paymentStatus || '');
  if (status === 'captured' || status === 'voided' || status === 'authorized' || status === 'failed') {
    events.push({
      key: 'status_current',
      label: `סטטוס נוכחי: ${STATUS_LABEL_HE[status] || status}`,
      at: doc.updatedAt ? new Date(doc.updatedAt as string | Date).toISOString() : null
    });
  }

  return events.filter((e) => e.at);
}

export function stripSensitivePaymentFields(doc: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...doc };
  for (const key of SENSITIVE_KEYS) {
    delete out[key];
  }
  if (out.customerDetails && typeof out.customerDetails === 'object') {
    const cd = { ...(out.customerDetails as Record<string, unknown>) };
    delete cd.cardNumber;
    delete cd.cvv;
    out.customerDetails = cd;
  }
  return out;
}

export function assertNoSensitiveLeak(payload: unknown): string[] {
  const found: string[] = [];
  const walk = (node: unknown, path: string) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach((item, i) => walk(item, `${path}[${i}]`));
      return;
    }
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      const p = path ? `${path}.${k}` : k;
      if (SENSITIVE_KEYS.has(k)) found.push(p);
      walk(v, p);
    }
  };
  walk(payload, '');
  return found;
}

export function paymentsCsvEscape(value: unknown): string {
  const s = value == null ? '' : String(value);
  return `"${s.replace(/"/g, '""')}"`;
}

export type CsvPaymentRow = PaymentListRow & {
  customerEmail?: string | null;
};

export function buildPaymentsCsv(rows: CsvPaymentRow[]): string {
  const headers = [
    'תאריך',
    'מספר הזמנה',
    'שם לקוח',
    'טלפון',
    'אימייל',
    'סוג הזמנה',
    'סכום',
    'סטטוס תשלום',
    'אסמכתה',
    'הזמנה מחוקה',
    'סוג חריגה',
    'חומרת חריגה'
  ];
  const orderTypeHe: Record<string, string> = {
    shabbat: 'שבת',
    catering: 'קייטרינג'
  };

  const lines = [
    headers.map(paymentsCsvEscape).join(','),
    ...rows.map((r) =>
      [
        r.paymentAt || r.createdAt || '',
        r.orderNumber,
        r.customerName,
        r.customerPhone || '',
        r.customerEmail || '',
        orderTypeHe[r.orderType || ''] || r.orderType || '',
        r.amount,
        STATUS_LABEL_HE[r.displayStatus] ||
          STATUS_LABEL_HE[r.paymentStatus] ||
          r.paymentStatus,
        r.transactionReference || '',
        r.isOrderDeleted ? 'כן' : 'לא',
        r.primaryException?.labelHe || '',
        r.primaryException?.severity === 'critical'
          ? 'חשוב'
          : r.primaryException?.severity === 'warning'
            ? 'אזהרה'
            : r.primaryException?.severity === 'info'
              ? 'מידע חסר'
              : ''
      ]
        .map(paymentsCsvEscape)
        .join(',')
    )
  ];
  return `\uFEFF${lines.join('\n')}`;
}

export function percentOf(part: number, total: number): number {
  if (!total || total <= 0) return 0;
  return Math.round((part / total) * 1000) / 10;
}

export const PAYMENTS_MISSING_FIELDS_NOTE = [
  'paymentMethod (inferred from transactionId / isPaid)',
  'authCode (select:false — לא מוצג במסך הניהול)',
  'legacy orders may lack paidAt/capturedAt (effectivePaidAt falls back to createdAt)'
];

export const PAYMENTS_NOT_SHOWN_NOTE = [
  'cardToken',
  'expireMonth/expireYear',
  'paymentSecurityToken',
  'paymentInitTokenHash',
  'raw Tranzila request/response',
  'authCode (לא מוצג — רגיש / select:false)'
];
