import Order from '../models/Order';
import ExternalInvoice from '../models/ExternalInvoice';
import InstitutionOrder from '../models/InstitutionOrder';
import {
  applyOrderKindToMatch,
  buildActualRevenueInRangeMatch,
  buildActualRevenueMatch,
  buildAwaitingPaymentMatch,
  buildExpectedEventRevenueMatch,
  buildFilteredOrderMatch,
  buildZeroPriceOrdersMatch,
  BUSINESS_ORDER_KIND_LABELS,
  classifyBusinessOrderKind,
  computeNewAndReturningCustomers,
  createdAtRangeMatch,
  customerIdentityKey,
  kpiTriple,
  previousRange,
  resolveBusinessMetricsRange,
  ACTUAL_REVENUE_DATE_BASIS,
  type BusinessMetricsFilters,
  type BusinessOrderKindFilter,
  type CustomerOrderTouch,
  type KpiTriple
} from '../utils/business-metrics.util';
import {
  effectivePaidAtMongoExpr,
  revenueAmountMongoExpr
} from '../utils/order-actual-revenue.util';
import { fillTrendBuckets, trendGranularity } from '../utils/dashboard-overview.util';

export type BusinessMetricsQuery = {
  preset?: string;
  from?: string;
  to?: string;
  timezone?: string;
  orderKind?: string;
  status?: string;
  paymentStatus?: string;
};

function parseFilters(query: BusinessMetricsQuery): BusinessMetricsFilters {
  const rawKind = String(query.orderKind || 'all').trim().toLowerCase();
  let orderKind: BusinessOrderKindFilter = 'all';
  if (rawKind === 'events' || rawKind === 'event') orderKind = 'events';
  else if (rawKind === 'shabbat_ready' || rawKind === 'shabbat' || rawKind === 'ready') {
    orderKind = 'shabbat_ready';
  } else if (rawKind === 'institutions' || rawKind === 'institution') {
    orderKind = 'institutions';
  }

  return {
    orderKind,
    status: query.status && query.status !== 'all' ? String(query.status) : null,
    paymentStatus:
      query.paymentStatus && query.paymentStatus !== 'all' ? String(query.paymentStatus) : null
  };
}

async function sumMatch(
  match: Record<string, unknown>
): Promise<{ revenue: number; orders: number }> {
  const rows = await Order.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        revenue: { $sum: revenueAmountMongoExpr() },
        orders: { $sum: 1 }
      }
    }
  ]);
  return {
    revenue: rows[0]?.revenue ?? 0,
    orders: rows[0]?.orders ?? 0
  };
}

async function countMatch(match: Record<string, unknown>): Promise<number> {
  return Order.countDocuments(match);
}

async function loadCustomerTouches(): Promise<CustomerOrderTouch[]> {
  const rows = await Order.find({
    isTestOrder: { $ne: true },
    status: { $ne: 'cancelled' }
  })
    .select('userId customerDetails createdAt')
    .lean();
  return (rows as any[]).map((o) => ({
    key: customerIdentityKey(o),
    createdAt: o.createdAt ? new Date(o.createdAt) : new Date(0)
  }));
}

async function topDishes(
  match: Record<string, unknown>,
  limit = 10
): Promise<Array<{ name: string; quantity: number; revenue: number }>> {
  const rows = await Order.aggregate([
    { $match: match },
    { $unwind: { path: '$items', preserveNullAndEmptyArrays: false } },
    {
      $project: {
        name: {
          $trim: { input: { $toString: { $ifNull: ['$items.name', ''] } } }
        },
        qty: {
          $cond: [
            {
              $and: [{ $isNumber: '$items.quantity' }, { $gte: ['$items.quantity', 0] }]
            },
            '$items.quantity',
            0
          ]
        },
        unitPrice: {
          $let: {
            vars: {
              rootPrice: '$items.price',
              optionPrice: '$items.selectedOption.price'
            },
            in: {
              $cond: [
                {
                  $and: [{ $isNumber: '$$rootPrice' }, { $gte: ['$$rootPrice', 0] }]
                },
                '$$rootPrice',
                {
                  $cond: [
                    {
                      $and: [{ $isNumber: '$$optionPrice' }, { $gte: ['$$optionPrice', 0] }]
                    },
                    '$$optionPrice',
                    0
                  ]
                }
              ]
            }
          }
        }
      }
    },
    { $match: { name: { $ne: '' } } },
    {
      $group: {
        _id: '$name',
        quantity: { $sum: '$qty' },
        revenue: { $sum: { $multiply: ['$unitPrice', '$qty'] } }
      }
    },
    { $sort: { quantity: -1, revenue: -1 } },
    { $limit: limit }
  ]);
  return rows.map((r: any) => ({
    name: r._id,
    quantity: r.quantity || 0,
    revenue: r.revenue || 0
  }));
}

async function groupByOrderKind(
  match: Record<string, unknown>
): Promise<Array<{ orderKind: string; orderKindLabel: string; count: number; revenue: number }>> {
  const rows = await Order.aggregate([
    { $match: match },
    {
      $project: {
        kind: {
          $cond: [{ $eq: ['$cateringKind', 'events'] }, 'events', 'shabbat_ready']
        },
        amount: revenueAmountMongoExpr()
      }
    },
    {
      $group: {
        _id: '$kind',
        count: { $sum: 1 },
        revenue: { $sum: '$amount' }
      }
    }
  ]);

  const byKind = new Map(rows.map((r: any) => [r._id, r]));
  const kinds: Array<'events' | 'shabbat_ready'> = ['events', 'shabbat_ready'];
  return kinds.map((k) => ({
    orderKind: k,
    orderKindLabel: BUSINESS_ORDER_KIND_LABELS[k],
    count: byKind.get(k)?.count || 0,
    revenue: byKind.get(k)?.revenue || 0
  }));
}

async function trendSeries(
  range: { from: Date; to: Date; timezone: string },
  revenueMatch: Record<string, unknown>
) {
  const granularity = trendGranularity(range as any);
  const rows = await Order.aggregate([
    {
      $match: {
        $and: [revenueMatch, buildActualRevenueInRangeMatch(range.from, range.to)]
      }
    },
    {
      $group: {
        _id: {
          $dateToString: {
            format: granularity === 'month' ? '%Y-%m' : '%Y-%m-%d',
            date: effectivePaidAtMongoExpr(),
            timezone: range.timezone
          }
        },
        revenue: { $sum: revenueAmountMongoExpr() },
        paidOrdersCount: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  const mapped = rows.map((r: any) => ({
    key: r._id,
    revenue: r.revenue || 0,
    paidOrdersCount: r.paidOrdersCount || 0
  }));
  return fillTrendBuckets(range as any, mapped, granularity).map((p) => ({
    ...p,
    averageOrderValue: p.paidOrdersCount > 0 ? p.revenue / p.paidOrdersCount : 0
  }));
}

async function externalInvoicesTotal(from: Date, to: Date): Promise<{ amount: number; count: number }> {
  const rows = await ExternalInvoice.aggregate([
    { $match: { issueDate: { $gte: from, $lte: to } } },
    {
      $group: {
        _id: null,
        amount: { $sum: { $ifNull: ['$amount', 0] } },
        count: { $sum: 1 }
      }
    }
  ]);
  return { amount: rows[0]?.amount ?? 0, count: rows[0]?.count ?? 0 };
}

async function institutionOrdersCount(from: Date, to: Date): Promise<number> {
  return InstitutionOrder.countDocuments({
    createdAt: { $gte: from, $lte: to }
  });
}

/**
 * Central business metrics entry point.
 * Revenue definition is owned by business-metrics.util — do not duplicate elsewhere.
 */
export async function getBusinessMetrics(query: BusinessMetricsQuery = {}) {
  const range = resolveBusinessMetricsRange(query);
  const prev = previousRange(range);
  const filters = parseFilters(query);

  // Institutions-only: no Order money — return portion/order counts separately.
  if (filters.orderKind === 'institutions') {
    const [instCurrent, instPrev, external] = await Promise.all([
      institutionOrdersCount(range.from, range.to),
      institutionOrdersCount(prev.from, prev.to),
      externalInvoicesTotal(range.from, range.to)
    ]);
    const emptyKpi = (v: number, p: number): KpiTriple => kpiTriple(v, p);
    return {
      range: {
        from: range.from.toISOString(),
        to: range.to.toISOString(),
        timezone: range.timezone,
        dateBasis: ACTUAL_REVENUE_DATE_BASIS,
        preset: range.preset || null,
        previous: { from: prev.from.toISOString(), to: prev.to.toISOString() }
      },
      filters: {
        orderKind: filters.orderKind,
        orderKindLabel: BUSINESS_ORDER_KIND_LABELS.institutions,
        status: filters.status,
        paymentStatus: filters.paymentStatus
      },
      kpis: {
        actualRevenue: emptyKpi(0, 0),
        expectedRevenue: emptyKpi(0, 0),
        totalOrders: emptyKpi(instCurrent, instPrev),
        averageOrderValue: emptyKpi(0, 0),
        newCustomers: emptyKpi(0, 0),
        returningCustomers: emptyKpi(0, 0),
        cancelledOrders: emptyKpi(0, 0),
        awaitingPayments: emptyKpi(0, 0)
      },
      ordersByType: [
        {
          orderKind: 'institutions',
          orderKindLabel: BUSINESS_ORDER_KIND_LABELS.institutions,
          count: instCurrent,
          revenue: 0
        }
      ],
      topItems: [],
      trend: [],
      externalInvoices: {
        amount: external.amount,
        count: external.count,
        note: 'מוצג בנפרד — לא נכלל בהכנסות בפועל'
      },
      alerts: {
        zeroPriceOrders: 0,
        zeroPriceWarning: null as string | null
      },
      paymentAlerts: { awaiting: 0, failed: 0, awaitingAmount: 0, failedAmount: 0 },
      generatedAt: new Date().toISOString()
    };
  }

  const revenueMatch = buildFilteredOrderMatch(
    buildActualRevenueInRangeMatch(range.from, range.to),
    filters
  );
  const prevRevenueMatch = buildFilteredOrderMatch(
    buildActualRevenueInRangeMatch(prev.from, prev.to),
    filters
  );

  const expectedMatch = buildFilteredOrderMatch(
    buildExpectedEventRevenueMatch(createdAtRangeMatch(range.from, range.to)),
    { ...filters, paymentStatus: filters.paymentStatus }
  );
  const prevExpectedMatch = buildFilteredOrderMatch(
    buildExpectedEventRevenueMatch(createdAtRangeMatch(prev.from, prev.to)),
    filters
  );

  // Total orders: all non-test in range by createdAt (operational, not collected revenue)
  let totalOrdersMatch: Record<string, unknown> = {
    isTestOrder: { $ne: true },
    ...createdAtRangeMatch(range.from, range.to)
  };
  totalOrdersMatch = applyOrderKindToMatch(totalOrdersMatch, filters.orderKind);
  if (filters.status) totalOrdersMatch.status = filters.status;
  if (filters.paymentStatus) totalOrdersMatch.paymentStatus = filters.paymentStatus;

  let prevTotalOrdersMatch: Record<string, unknown> = {
    isTestOrder: { $ne: true },
    ...createdAtRangeMatch(prev.from, prev.to)
  };
  prevTotalOrdersMatch = applyOrderKindToMatch(prevTotalOrdersMatch, filters.orderKind);
  if (filters.status) prevTotalOrdersMatch.status = filters.status;
  if (filters.paymentStatus) prevTotalOrdersMatch.paymentStatus = filters.paymentStatus;

  const cancelledMatch = buildFilteredOrderMatch(
    {
      isTestOrder: { $ne: true },
      status: 'cancelled',
      ...createdAtRangeMatch(range.from, range.to)
    },
    { ...filters, status: 'cancelled' }
  );
  const prevCancelledMatch = buildFilteredOrderMatch(
    {
      isTestOrder: { $ne: true },
      status: 'cancelled',
      ...createdAtRangeMatch(prev.from, prev.to)
    },
    { ...filters, status: 'cancelled' }
  );

  const awaitingMatch = buildFilteredOrderMatch(buildAwaitingPaymentMatch(), filters);
  const failedMatch = buildFilteredOrderMatch(
    {
      isTestOrder: { $ne: true },
      isDeleted: { $ne: true },
      paymentStatus: 'failed'
    },
    filters
  );

  const zeroPriceMatch = buildFilteredOrderMatch(
    buildZeroPriceOrdersMatch(createdAtRangeMatch(range.from, range.to)),
    filters
  );

  // Top dishes: include all non-cancelled non-test (so Shabbat totalPrice=0 still counts qty)
  let topMatch: Record<string, unknown> = {
    isTestOrder: { $ne: true },
    status: { $ne: 'cancelled' },
    ...createdAtRangeMatch(range.from, range.to)
  };
  topMatch = applyOrderKindToMatch(topMatch, filters.orderKind);
  if (filters.status && filters.status !== 'cancelled') topMatch.status = filters.status;
  if (filters.paymentStatus) topMatch.paymentStatus = filters.paymentStatus;

  const [
    currentRevenue,
    previousRevenue,
    currentExpected,
    previousExpected,
    totalOrders,
    previousTotalOrders,
    cancelledOrders,
    previousCancelled,
    awaiting,
    failed,
    awaitingAmountRow,
    failedAmountRow,
    zeroPriceOrders,
    topItems,
    ordersByType,
    trend,
    touches,
    external,
    institutionCount
  ] = await Promise.all([
    sumMatch(revenueMatch),
    sumMatch(prevRevenueMatch),
    sumMatch(expectedMatch),
    sumMatch(prevExpectedMatch),
    countMatch(totalOrdersMatch),
    countMatch(prevTotalOrdersMatch),
    countMatch(cancelledMatch),
    countMatch(prevCancelledMatch),
    countMatch(awaitingMatch),
    countMatch(failedMatch),
    sumMatch(awaitingMatch),
    sumMatch(failedMatch),
    countMatch(zeroPriceMatch),
    topDishes(topMatch),
    groupByOrderKind(revenueMatch),
    trendSeries(range, buildFilteredOrderMatch(buildActualRevenueMatch({}), filters)),
    loadCustomerTouches(),
    externalInvoicesTotal(range.from, range.to),
    filters.orderKind === 'all' ? institutionOrdersCount(range.from, range.to) : Promise.resolve(0)
  ]);

  const customers = computeNewAndReturningCustomers(touches, range.from, range.to);
  const prevCustomers = computeNewAndReturningCustomers(touches, prev.from, prev.to);

  const avg =
    currentRevenue.orders > 0 ? currentRevenue.revenue / currentRevenue.orders : 0;
  const prevAvg =
    previousRevenue.orders > 0 ? previousRevenue.revenue / previousRevenue.orders : 0;

  const byType =
    filters.orderKind === 'all'
      ? [
          ...ordersByType,
          {
            orderKind: 'institutions',
            orderKindLabel: BUSINESS_ORDER_KIND_LABELS.institutions,
            count: institutionCount,
            revenue: 0
          }
        ]
      : ordersByType.filter((r) => r.orderKind === filters.orderKind);

  return {
    range: {
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      timezone: range.timezone,
      dateBasis: ACTUAL_REVENUE_DATE_BASIS,
      preset: range.preset || null,
      previous: { from: prev.from.toISOString(), to: prev.to.toISOString() }
    },
    filters: {
      orderKind: filters.orderKind,
      orderKindLabel: BUSINESS_ORDER_KIND_LABELS[filters.orderKind || 'all'],
      status: filters.status,
      paymentStatus: filters.paymentStatus
    },
    kpis: {
      actualRevenue: kpiTriple(currentRevenue.revenue, previousRevenue.revenue),
      /** Alias for older UI that still reads capturedRevenue */
      capturedRevenue: kpiTriple(currentRevenue.revenue, previousRevenue.revenue),
      expectedRevenue: kpiTriple(currentExpected.revenue, previousExpected.revenue),
      paidOrders: kpiTriple(currentRevenue.orders, previousRevenue.orders),
      totalOrders: kpiTriple(totalOrders, previousTotalOrders),
      averageOrderValue: kpiTriple(avg, prevAvg),
      newCustomers: kpiTriple(customers.newCustomers, prevCustomers.newCustomers),
      returningCustomers: kpiTriple(
        customers.returningCustomers,
        prevCustomers.returningCustomers
      ),
      cancelledOrders: kpiTriple(cancelledOrders, previousCancelled),
      awaitingPayments: kpiTriple(awaiting, 0)
    },
    ordersByType: byType,
    topItems,
    trend,
    externalInvoices: {
      amount: external.amount,
      count: external.count,
      note: 'מוצג בנפרד — לא נכלל בהכנסות בפועל (אין קישור להזמנה, אין כפילות)'
    },
    alerts: {
      zeroPriceOrders,
      zeroPriceWarning:
        zeroPriceOrders > 0
          ? `קיימות ${zeroPriceOrders} הזמנות ללא סכום בטווח שנבחר — נתון ההכנסות אינו מלא`
          : null
    },
    paymentAlerts: {
      awaiting,
      failed,
      awaitingAmount: awaitingAmountRow.revenue,
      failedAmount: failedAmountRow.revenue
    },
    financialSummary: {
      actualRevenue: currentRevenue.revenue,
      capturedRevenue: currentRevenue.revenue,
      expectedRevenue: currentExpected.revenue,
      paidOrders: currentRevenue.orders,
      averageOrderValue: avg,
      awaitingPayments: awaiting,
      awaitingCount: awaiting,
      awaitingAmount: awaitingAmountRow.revenue,
      failedPayments: failed,
      failedCount: failed,
      failedAmount: failedAmountRow.revenue,
      newCustomers: customers.newCustomers,
      returningCustomers: customers.returningCustomers,
      cancelledOrders,
      capturedRevenueChange: kpiTriple(currentRevenue.revenue, previousRevenue.revenue),
      paidOrdersChange: kpiTriple(currentRevenue.orders, previousRevenue.orders),
      averageOrderValueChange: kpiTriple(avg, prevAvg),
      newCustomersChange: kpiTriple(customers.newCustomers, prevCustomers.newCustomers),
      returningCustomersChange: kpiTriple(
        customers.returningCustomers,
        prevCustomers.returningCustomers
      )
    },
    generatedAt: new Date().toISOString()
  };
}

/** Shared helper for legacy stats endpoints. */
export async function sumActualRevenueInRange(
  from: Date,
  to: Date
): Promise<{ revenue: number; orders: number }> {
  return sumMatch(buildActualRevenueInRangeMatch(from, to));
}

export { classifyBusinessOrderKind, buildActualRevenueMatch };
