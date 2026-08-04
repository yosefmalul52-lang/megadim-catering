/**
 * Single source of truth for "actual collected revenue" from Orders.
 *
 * Inclusion (paid order for revenue):
 *   1. isTestOrder !== true
 *   2. At least one payment proof:
 *        Classic: paidAt | capturedAt | paymentStatus==='captured' | customerDetails.isPaid===true
 *        Ops-implied (manual/offline settlement used historically):
 *          archive (isDeleted) excluding cancelled, OR status in ready/completed
 *          (NOT out_for_delivery/delivered — drivers can set those without payment)
 *   3. Valid amount basis: adminPriceOverride is a finite number OR totalPrice is a finite number
 *
 * No refund model yet — no refund subtraction.
 *
 * effectivePaidAt = paidAt ?? capturedAt ?? createdAt (legacy fallback only)
 * revenueAmount   = adminPriceOverride ?? totalPrice  (nullish; 0 is valid)
 *
 * Keep JS predicates and Mongo match/exprs in lockstep.
 */
import {
  getEffectiveOrderAmount,
  hasAdminPriceOverride
} from './order-admin-pricing.util';

export const ACTUAL_REVENUE_DATE_BASIS = 'effectivePaidAt' as const;
export const ACTUAL_REVENUE_PRICE_OVERRIDE_FIELD = 'adminPriceOverride' as const;

/**
 * Ops statuses that imply offline/manual settlement (admin kitchen workflow).
 * Intentionally excludes `out_for_delivery` / `delivered` — drivers may set those
 * without payment proof, and must not inflate collected-revenue KPIs.
 */
export const OPS_IMPLIED_PAID_STATUSES = ['ready', 'completed'] as const;

export type ActualRevenueOrderLike = {
  isTestOrder?: unknown;
  status?: unknown;
  isDeleted?: unknown;
  paymentStatus?: unknown;
  totalPrice?: unknown;
  adminPriceOverride?: unknown;
  paidAt?: unknown;
  capturedAt?: unknown;
  createdAt?: unknown;
  completedAt?: unknown;
  readyAt?: unknown;
  cancelledAt?: unknown;
  customerDetails?: unknown;
};

function isFiniteNumber(raw: unknown): boolean {
  if (raw === null || raw === undefined || raw === '') return false;
  return Number.isFinite(Number(raw));
}

/** Coerce stored date-like values; invalid → null. */
export function coerceOrderDate(raw: unknown): Date | null {
  if (raw == null || raw === '') return null;
  if (raw instanceof Date) {
    return Number.isNaN(raw.getTime()) ? null : raw;
  }
  const d = new Date(raw as string | number);
  return Number.isNaN(d.getTime()) ? null : d;
}

function hasStoredDate(raw: unknown): boolean {
  return coerceOrderDate(raw) != null;
}

export function getCustomerIsPaid(order: ActualRevenueOrderLike | null | undefined): boolean {
  const cd =
    order?.customerDetails && typeof order.customerDetails === 'object'
      ? (order.customerDetails as Record<string, unknown>)
      : {};
  return cd.isPaid === true;
}

/**
 * Classic gateway / explicit manual payment proof (not ops-inferred).
 */
export function orderHasClassicPaymentProof(
  order: ActualRevenueOrderLike | null | undefined
): boolean {
  if (!order) return false;
  if (hasStoredDate(order.paidAt)) return true;
  if (hasStoredDate(order.capturedAt)) return true;
  if (String(order.paymentStatus || '').trim() === 'captured') return true;
  if (getCustomerIsPaid(order)) return true;
  return false;
}

/**
 * Business rule for Megadim historical workflow:
 * ready / completed / archive ⇒ treated as paid (often manually outside the site).
 * pending / processing / out_for_delivery / delivered remain unpaid unless classic proof.
 * Cancelled orders are never implied-paid.
 */
export function orderHasOpsImpliedManualPayment(
  order: ActualRevenueOrderLike | null | undefined
): boolean {
  if (!order) return false;
  const status = String(order.status || '').trim();
  if (status === 'cancelled') return false;
  if (order.isDeleted === true) return true;
  return (OPS_IMPLIED_PAID_STATUSES as readonly string[]).includes(status);
}

/**
 * Payment proof only (does not check test / amount).
 * Classic proof OR ops-implied manual settlement.
 */
export function orderHasPaymentProof(order: ActualRevenueOrderLike | null | undefined): boolean {
  if (!order) return false;
  if (orderHasClassicPaymentProof(order)) return true;
  if (orderHasOpsImpliedManualPayment(order)) return true;
  return false;
}

export function orderHasValidRevenueAmountBasis(
  order: ActualRevenueOrderLike | null | undefined
): boolean {
  if (!order) return false;
  if (hasAdminPriceOverride(order as Record<string, unknown>)) return true;
  return isFiniteNumber(order.totalPrice);
}

/**
 * Whether the order contributes to actual collected revenue.
 */
export function orderContributesActualRevenue(
  order: ActualRevenueOrderLike | null | undefined
): boolean {
  if (!order) return false;
  if (order.isTestOrder === true) return false;
  if (!orderHasPaymentProof(order)) return false;
  if (!orderHasValidRevenueAmountBasis(order)) return false;
  return true;
}

/** Alias used by admin-payments funnel / paid clause (same payment-proof + not-test + amount). */
export function isPaidOrder(doc: Record<string, unknown> | null | undefined): boolean {
  return orderContributesActualRevenue(doc as ActualRevenueOrderLike);
}

/**
 * Collection date for period filters.
 * New orders: paidAt (set on capture / manual paid in phase 1).
 * Legacy paid without stamps: createdAt.
 */
export function getEffectivePaidAt(
  order: ActualRevenueOrderLike | null | undefined
): Date | null {
  if (!order) return null;
  return (
    coerceOrderDate(order.paidAt) ??
    coerceOrderDate(order.capturedAt) ??
    coerceOrderDate(order.createdAt)
  );
}

/**
 * Uniform revenue amount: adminPriceOverride ?? totalPrice (nullish).
 * Returns 0 when the order does not contribute.
 */
export function getOrderRevenueAmount(
  order: ActualRevenueOrderLike | null | undefined
): number {
  if (!orderContributesActualRevenue(order)) return 0;
  return getEffectiveOrderAmount(order as Record<string, unknown>);
}

/** @deprecated Prefer getOrderRevenueAmount — kept for existing imports. */
export function actualRevenueAmount(order: ActualRevenueOrderLike | null | undefined): number {
  return getOrderRevenueAmount(order);
}

export function computeActualRevenueStats(
  docs: Array<ActualRevenueOrderLike | null | undefined>
): { revenue: number; paidOrderCount: number; averageOrderValue: number } {
  let revenue = 0;
  let paidOrderCount = 0;
  for (const d of docs) {
    if (!orderContributesActualRevenue(d)) continue;
    paidOrderCount += 1;
    revenue += getOrderRevenueAmount(d);
  }
  // Match admin-payments roundMoney style at the aggregate boundary when callers need it.
  const rounded = Math.round(revenue * 100) / 100;
  return {
    revenue: rounded,
    paidOrderCount,
    averageOrderValue: paidOrderCount > 0 ? Math.round((rounded / paidOrderCount) * 100) / 100 : 0
  };
}

export function computeActualRevenueStatsInRange(
  docs: Array<ActualRevenueOrderLike | null | undefined>,
  from: Date,
  to: Date
): { revenue: number; paidOrderCount: number; averageOrderValue: number } {
  const fromMs = from.getTime();
  const toMs = to.getTime();
  const inRange = docs.filter((d) => {
    if (!orderContributesActualRevenue(d)) return false;
    const at = getEffectivePaidAt(d);
    if (!at) return false;
    const ms = at.getTime();
    return ms >= fromMs && ms <= toMs;
  });
  return computeActualRevenueStats(inRange);
}

/** Mongo $or for payment proof — keep in sync with orderHasPaymentProof. */
export function buildPaymentProofClause(): Record<string, unknown> {
  return {
    $or: [
      { paidAt: { $type: 'date' } },
      { capturedAt: { $type: 'date' } },
      { paymentStatus: 'captured' },
      { 'customerDetails.isPaid': true },
      // Ops-implied: archive / ready / completed only (not driver delivery statuses).
      {
        $and: [
          { status: { $ne: 'cancelled' } },
          {
            $or: [
              { isDeleted: true },
              { status: { $in: [...OPS_IMPLIED_PAID_STATUSES] } }
            ]
          }
        ]
      }
    ]
  };
}

/** Valid amount basis for Mongo — override number OR totalPrice number. */
export function buildValidRevenueAmountClause(): Record<string, unknown> {
  return {
    $or: [{ adminPriceOverride: { $type: 'number' } }, { totalPrice: { $type: 'number' } }]
  };
}

/**
 * Base Mongo $match for actual revenue (no date).
 * Does not filter status or isDeleted.
 */
export function buildActualRevenueMatch(extra: Record<string, unknown> = {}): Record<string, unknown> {
  const extraAnd = Array.isArray(extra.$and) ? (extra.$and as Record<string, unknown>[]) : [];
  const { $and: _ignored, ...rest } = extra;
  void _ignored;
  return {
    isTestOrder: { $ne: true },
    $and: [buildPaymentProofClause(), buildValidRevenueAmountClause(), ...extraAnd],
    ...rest
  };
}

/**
 * Alias for admin-payments paid clause — same as payment proof + not test + amount.
 * Prefer buildActualRevenueMatch for full revenue queries.
 */
export function buildPaidOrdersClause(): Record<string, unknown> {
  return buildActualRevenueMatch();
}

/** Mongo expression: paidAt ?? capturedAt ?? createdAt */
export function effectivePaidAtMongoExpr(): Record<string, unknown> {
  return {
    $ifNull: ['$paidAt', { $ifNull: ['$capturedAt', '$createdAt'] }]
  };
}

/**
 * Date filter on effectivePaidAt via $expr (cannot use a single indexed field).
 * Callers should $and this with buildActualRevenueMatch().
 */
export function buildEffectivePaidAtRangeMatch(from: Date, to: Date): Record<string, unknown> {
  const expr = effectivePaidAtMongoExpr();
  return {
    $expr: {
      $and: [{ $gte: [expr, from] }, { $lte: [expr, to] }]
    }
  };
}

/** Convenience: paid orders whose effectivePaidAt falls in [from, to]. */
export function buildActualRevenueInRangeMatch(
  from: Date,
  to: Date,
  extra: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    $and: [buildActualRevenueMatch(extra), buildEffectivePaidAtRangeMatch(from, to)]
  };
}

/** Mongo sum expression: adminPriceOverride when numeric, else totalPrice. */
export function revenueAmountMongoExpr(): Record<string, unknown> {
  return {
    $cond: [
      {
        $and: [
          { $ne: [{ $type: '$adminPriceOverride' }, 'missing'] },
          { $ne: ['$adminPriceOverride', null] },
          { $isNumber: '$adminPriceOverride' }
        ]
      },
      '$adminPriceOverride',
      { $ifNull: ['$totalPrice', 0] }
    ]
  };
}

export function revenueAmountMongoSumExpr(): Record<string, unknown> {
  return { $sum: revenueAmountMongoExpr() };
}

export type ActualRevenueAggregateResult = {
  revenue: number;
  paidOrderCount: number;
  averageOrderValue: number;
};

export function finalizeActualRevenueAggregate(row?: {
  revenue?: unknown;
  paidOrderCount?: unknown;
  count?: unknown;
} | null): ActualRevenueAggregateResult {
  const revenue = Math.round((Number(row?.revenue) || 0) * 100) / 100;
  const paidOrderCount = Number(row?.paidOrderCount ?? row?.count) || 0;
  return {
    revenue,
    paidOrderCount,
    averageOrderValue:
      paidOrderCount > 0 ? Math.round((revenue / paidOrderCount) * 100) / 100 : 0
  };
}
