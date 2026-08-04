/**
 * Canonical business-metrics definitions for Megadim.
 * Actual collected revenue is owned by order-actual-revenue.util (single source of truth).
 * Operational / expected-revenue helpers remain here.
 */
import {
  changePercent,
  kpiTriple,
  normalizePhoneDigits,
  previousRange,
  resolveDashboardRange,
  type DateRange,
  type KpiTriple
} from './dashboard-overview.util';
import {
  actualRevenueAmount,
  buildActualRevenueInRangeMatch,
  buildActualRevenueMatch,
  buildEffectivePaidAtRangeMatch,
  buildPaidOrdersClause,
  buildPaymentProofClause,
  getEffectivePaidAt,
  getOrderRevenueAmount,
  isPaidOrder,
  orderContributesActualRevenue,
  orderHasPaymentProof,
  ACTUAL_REVENUE_DATE_BASIS,
  ACTUAL_REVENUE_PRICE_OVERRIDE_FIELD
} from './order-actual-revenue.util';

export type BusinessOrderKindFilter = 'all' | 'events' | 'shabbat_ready' | 'institutions';

export type BusinessMetricsFilters = {
  orderKind?: BusinessOrderKindFilter;
  status?: string | null;
  paymentStatus?: string | null;
};

/** Extended presets: calendar year + existing dashboard presets. */
export type BusinessMetricsPreset = 'today' | 'week' | 'last30' | 'month' | 'year';

export function isValidTotalPrice(raw: unknown): boolean {
  if (raw === null || raw === undefined || raw === '') return false;
  const n = Number(raw);
  return Number.isFinite(n);
}

export {
  actualRevenueAmount,
  buildActualRevenueInRangeMatch,
  buildActualRevenueMatch,
  buildEffectivePaidAtRangeMatch,
  buildPaidOrdersClause,
  buildPaymentProofClause,
  getEffectivePaidAt,
  getOrderRevenueAmount,
  isPaidOrder,
  orderContributesActualRevenue,
  orderHasPaymentProof,
  ACTUAL_REVENUE_DATE_BASIS,
  ACTUAL_REVENUE_PRICE_OVERRIDE_FIELD
};

/** Events catering estimate not yet paid — never actual revenue. */
export function orderIsExpectedEventRevenue(order: any): boolean {
  if (!order || order.isTestOrder === true) return false;
  if (String(order.status || '').trim() === 'cancelled') return false;
  if (order.cateringKind !== 'events') return false;
  if (orderHasPaymentProof(order)) return false;
  const n = Number(order.totalPrice);
  return Number.isFinite(n) && n > 0;
}

export function orderIsZeroPriceActive(order: any): boolean {
  if (!order || order.isTestOrder === true) return false;
  if (String(order.status || '').trim() === 'cancelled') return false;
  const n = Number(order.totalPrice);
  return !Number.isFinite(n) || n === 0;
}

export function buildBaseOrderMatch(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    isTestOrder: { $ne: true },
    ...extra
  };
}

export function buildExpectedEventRevenueMatch(
  extra: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    isTestOrder: { $ne: true },
    status: { $ne: 'cancelled' },
    cateringKind: 'events',
    totalPrice: { $gt: 0 },
    $nor: [
      { paidAt: { $type: 'date' } },
      { capturedAt: { $type: 'date' } },
      { paymentStatus: 'captured' },
      { 'customerDetails.isPaid': true }
    ],
    ...extra
  };
}

export function buildZeroPriceOrdersMatch(
  extra: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    isTestOrder: { $ne: true },
    status: { $ne: 'cancelled' },
    $or: [{ totalPrice: 0 }, { totalPrice: null }, { totalPrice: { $exists: false } }],
    ...extra
  };
}

export function buildAwaitingPaymentMatch(
  extra: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    isTestOrder: { $ne: true },
    isDeleted: { $ne: true },
    status: { $ne: 'cancelled' },
    paymentStatus: { $in: ['awaiting_payment', 'authorized'] },
    ...extra
  };
}

export function classifyBusinessOrderKind(
  order: any
): 'events' | 'shabbat_ready' | 'institutions' {
  if (order?.__kitchenOrderKind === 'institutions' || order?.orderKind === 'institutions') {
    return 'institutions';
  }
  if (order?.cateringKind === 'events') return 'events';
  return 'shabbat_ready';
}

export function applyOrderKindToMatch(
  match: Record<string, unknown>,
  orderKind?: BusinessOrderKindFilter
): Record<string, unknown> {
  if (!orderKind || orderKind === 'all' || orderKind === 'institutions') return match;
  if (orderKind === 'events') return { ...match, cateringKind: 'events' };
  // shabbat_ready = cart + catering shabbat (everything that is not events)
  return { ...match, cateringKind: { $ne: 'events' } };
}

export function applyStatusPaymentFilters(
  match: Record<string, unknown>,
  filters: BusinessMetricsFilters
): Record<string, unknown> {
  const next = { ...match };
  if (filters.status && filters.status !== 'all') {
    next.status = filters.status;
  }
  if (filters.paymentStatus && filters.paymentStatus !== 'all') {
    next.paymentStatus = filters.paymentStatus;
  }
  return next;
}

/** Operational lists / created-order counts — not actual revenue. */
export function createdAtRangeMatch(from: Date, to: Date): Record<string, unknown> {
  return { createdAt: { $gte: from, $lte: to } };
}

/**
 * Customer identity: prefer userId, else normalized phone.
 * Returns empty string when neither is available (excluded from customer KPIs).
 */
export function customerIdentityKey(order: {
  userId?: unknown;
  customerDetails?: unknown;
}): string {
  const uid = order?.userId;
  if (uid != null && String(uid).trim() && String(uid) !== 'null' && String(uid) !== 'undefined') {
    return `u:${String(uid)}`;
  }
  const cd =
    order?.customerDetails && typeof order.customerDetails === 'object'
      ? (order.customerDetails as Record<string, unknown>)
      : {};
  const nested =
    cd.deliveryDetails && typeof cd.deliveryDetails === 'object'
      ? (cd.deliveryDetails as Record<string, unknown>)
      : {};
  const candidates = [cd.phone, nested.phone, cd.customerPhone, cd.mobile];
  for (const c of candidates) {
    const norm = normalizePhoneDigits(c);
    if (norm) return `p:${norm}`;
  }
  return '';
}

export type CustomerOrderTouch = { key: string; createdAt: Date };

/**
 * New = first-ever order timestamp falls inside [from, to].
 * Returning = at least one order before `from` AND at least one in [from, to].
 * Operates on the full history list (not period-only).
 */
export function computeNewAndReturningCustomers(
  allTouches: CustomerOrderTouch[],
  from: Date,
  to: Date
): { newCustomers: number; returningCustomers: number } {
  const byKey = new Map<string, Date[]>();
  for (const t of allTouches) {
    if (!t.key) continue;
    const at = t.createdAt instanceof Date ? t.createdAt : new Date(t.createdAt);
    if (Number.isNaN(at.getTime())) continue;
    const list = byKey.get(t.key) || [];
    list.push(at);
    byKey.set(t.key, list);
  }

  let newCustomers = 0;
  let returningCustomers = 0;
  const fromMs = from.getTime();
  const toMs = to.getTime();

  for (const dates of byKey.values()) {
    dates.sort((a, b) => a.getTime() - b.getTime());
    const first = dates[0].getTime();
    const inPeriod = dates.some((d) => {
      const ms = d.getTime();
      return ms >= fromMs && ms <= toMs;
    });
    if (!inPeriod) continue;
    if (first >= fromMs && first <= toMs) {
      newCustomers += 1;
      continue;
    }
    if (first < fromMs) {
      returningCustomers += 1;
    }
  }

  return { newCustomers, returningCustomers };
}

export function resolveBusinessMetricsRange(input: {
  preset?: string;
  from?: string;
  to?: string;
  timezone?: string;
  now?: Date;
}): DateRange & { preset?: string } {
  return resolveDashboardRange(input);
}

export { kpiTriple, previousRange, changePercent, normalizePhoneDigits };
export type { DateRange, KpiTriple };

/** Labels for UI / API. */
export const BUSINESS_ORDER_KIND_LABELS: Record<BusinessOrderKindFilter, string> = {
  all: 'הכול',
  events: 'קייטרינג לאירועים',
  shabbat_ready: 'אוכל מוכן לשבת וחג',
  institutions: 'מוסדות'
};

/**
 * When paymentStatus filter is applied on top of actual-revenue match,
 * replace the payment-proof $and clauses so we don't force proof $or.
 */
export function buildFilteredOrderMatch(
  base: Record<string, unknown>,
  filters: BusinessMetricsFilters
): Record<string, unknown> {
  let match = applyOrderKindToMatch(base, filters.orderKind);
  if (filters.status && filters.status !== 'all') {
    match = { ...match, status: filters.status };
  }
  if (filters.paymentStatus && filters.paymentStatus !== 'all') {
    const and = Array.isArray(match.$and) ? [...(match.$and as unknown[])] : [];
    const stripped = and.filter((clause) => {
      if (!clause || typeof clause !== 'object') return true;
      const c = clause as Record<string, unknown>;
      if (Array.isArray(c.$or)) {
        const or = c.$or as Array<Record<string, unknown>>;
        const looksLikeProof = or.some(
          (x) =>
            x.paymentStatus === 'captured' ||
            x['customerDetails.isPaid'] === true ||
            x.paidAt != null ||
            x.capturedAt != null
        );
        return !looksLikeProof;
      }
      return true;
    });
    const { $and: _a, $or: _o, ...rest } = match as Record<string, unknown> & {
      $and?: unknown;
      $or?: unknown;
    };
    void _a;
    void _o;
    match = {
      ...rest,
      paymentStatus: filters.paymentStatus,
      ...(stripped.length ? { $and: stripped } : {})
    };
  }
  return match;
}
