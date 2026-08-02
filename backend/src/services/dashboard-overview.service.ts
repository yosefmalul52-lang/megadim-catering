import Order from '../models/Order';
import { ORDER_ADMIN_LIST_SELECT } from '../utils/order-projection.util';
import {
  countReturningFromPhoneGroups,
  DASHBOARD_MATCH,
  DateRange,
  fillTrendBuckets,
  kpiTriple,
  previousRange,
  resolveDashboardRange,
  trendGranularity
} from '../utils/dashboard-overview.util';

export type DashboardOverviewQuery = {
  preset?: string;
  from?: string;
  to?: string;
  timezone?: string;
};

function createdAtMatch(from: Date, to: Date) {
  return { createdAt: { $gte: from, $lte: to } };
}

async function sumCaptured(from: Date, to: Date): Promise<{ revenue: number; orders: number }> {
  const rows = await Order.aggregate([
    {
      $match: {
        ...DASHBOARD_MATCH.capturedRevenue,
        ...createdAtMatch(from, to)
      }
    },
    {
      $group: {
        _id: null,
        revenue: { $sum: { $ifNull: ['$totalPrice', 0] } },
        orders: { $sum: 1 }
      }
    }
  ]);
  return {
    revenue: rows[0]?.revenue ?? 0,
    orders: rows[0]?.orders ?? 0
  };
}

async function countTotalCreated(from: Date, to: Date): Promise<number> {
  return Order.countDocuments({
    ...DASHBOARD_MATCH.notTest,
    ...createdAtMatch(from, to)
  });
}

async function countActiveInRange(from: Date, to: Date): Promise<number> {
  return Order.countDocuments({
    ...DASHBOARD_MATCH.activeOrders,
    ...createdAtMatch(from, to)
  });
}

async function countReturning(from: Date, to: Date): Promise<number> {
  // One phone per order (first non-empty among known/legacy paths), then normalize in Node.
  // Result set is one row per distinct raw phone — not full order documents.
  const perOrder = await Order.aggregate([
    {
      $match: {
        ...DASHBOARD_MATCH.capturedRevenue,
        ...createdAtMatch(from, to)
      }
    },
    {
      $project: {
        phone: {
          $let: {
            vars: {
              candidates: [
                '$customerDetails.phone',
                '$customerDetails.deliveryDetails.phone',
                '$customerDetails.customerPhone',
                '$customerDetails.mobile'
              ]
            },
            in: {
              $first: {
                $filter: {
                  input: '$$candidates',
                  as: 'c',
                  cond: {
                    $and: [
                      { $ne: ['$$c', null] },
                      { $ne: [{ $toString: '$$c' }, ''] }
                    ]
                  }
                }
              }
            }
          }
        }
      }
    },
    { $match: { phone: { $ne: null } } },
    {
      $group: {
        _id: { $toString: '$phone' },
        count: { $sum: 1 }
      }
    }
  ]);

  return countReturningFromPhoneGroups(
    perOrder.map((r: { _id: string; count: number }) => ({ phone: r._id, count: r.count }))
  );
}

async function groupByStatus(from: Date, to: Date) {
  const rows = await Order.aggregate([
    {
      $match: {
        ...DASHBOARD_MATCH.notTest,
        ...createdAtMatch(from, to)
      }
    },
    { $group: { _id: { $ifNull: ['$status', 'unknown'] }, count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);
  return rows.map((r: { _id: string; count: number }) => ({ status: r._id, count: r.count }));
}

async function groupByType(from: Date, to: Date) {
  const rows = await Order.aggregate([
    {
      $match: {
        ...DASHBOARD_MATCH.notTest,
        ...createdAtMatch(from, to)
      }
    },
    {
      $group: {
        _id: {
          orderType: { $ifNull: ['$orderType', 'unknown'] },
          cateringKind: { $ifNull: ['$cateringKind', 'unknown'] }
        },
        count: { $sum: 1 }
      }
    },
    { $sort: { count: -1 } }
  ]);
  return rows.map((r: { _id: { orderType: string; cateringKind: string }; count: number }) => ({
    orderType: r._id.orderType,
    cateringKind: r._id.cateringKind,
    count: r.count
  }));
}

async function topItems(from: Date, to: Date, limit = 10) {
  const rows = await Order.aggregate([
    {
      $match: {
        ...DASHBOARD_MATCH.capturedRevenue,
        ...createdAtMatch(from, to)
      }
    },
    { $unwind: { path: '$items', preserveNullAndEmptyArrays: false } },
    {
      $project: {
        name: {
          $trim: {
            input: { $toString: { $ifNull: ['$items.name', ''] } }
          }
        },
        qty: {
          $cond: [
            {
              $and: [
                { $ne: ['$items.quantity', null] },
                { $eq: [{ $type: '$items.quantity' }, 'number'] },
                { $gte: ['$items.quantity', 0] }
              ]
            },
            '$items.quantity',
            null
          ]
        },
        // Precedence: items.price (incl. 0) → selectedOption.price → null. Never items.total.
        unitPrice: {
          $let: {
            vars: {
              rootPrice: '$items.price',
              optionPrice: '$items.selectedOption.price'
            },
            in: {
              $cond: [
                {
                  $and: [
                    { $ne: ['$$rootPrice', null] },
                    { $eq: [{ $type: '$$rootPrice' }, 'number'] },
                    { $gte: ['$$rootPrice', 0] }
                  ]
                },
                '$$rootPrice',
                {
                  $cond: [
                    {
                      $and: [
                        { $ne: ['$$optionPrice', null] },
                        { $eq: [{ $type: '$$optionPrice' }, 'number'] },
                        { $gte: ['$$optionPrice', 0] }
                      ]
                    },
                    '$$optionPrice',
                    null
                  ]
                }
              ]
            }
          }
        }
      }
    },
    {
      $addFields: {
        lineRevenue: {
          $cond: [
            {
              $and: [{ $ne: ['$unitPrice', null] }, { $ne: ['$qty', null] }]
            },
            { $multiply: ['$unitPrice', '$qty'] },
            0
          ]
        },
        qtyForSum: { $ifNull: ['$qty', 0] }
      }
    },
    { $match: { name: { $ne: '' } } },
    {
      $group: {
        _id: '$name',
        quantity: { $sum: '$qtyForSum' },
        revenue: { $sum: '$lineRevenue' }
      }
    },
    { $sort: { quantity: -1, revenue: -1 } },
    { $limit: limit }
  ]);
  return rows.map((r: { _id: string; quantity: number; revenue: number }) => ({
    name: r._id,
    quantity: r.quantity,
    revenue: r.revenue
  }));
}

async function trendSeries(range: DateRange) {
  const granularity = trendGranularity(range);
  const dateFormat = granularity === 'day' ? '%Y-%m-%d' : '%Y-%m';
  const rows = await Order.aggregate([
    {
      $match: {
        ...DASHBOARD_MATCH.capturedRevenue,
        ...createdAtMatch(range.from, range.to)
      }
    },
    {
      $group: {
        _id: {
          $dateToString: {
            format: dateFormat,
            date: '$createdAt',
            timezone: range.timezone
          }
        },
        revenue: { $sum: { $ifNull: ['$totalPrice', 0] } },
        paidOrdersCount: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  const points = rows.map((r: { _id: string; revenue: number; paidOrdersCount: number }) => ({
    key: r._id,
    revenue: r.revenue,
    paidOrdersCount: r.paidOrdersCount
  }));
  return fillTrendBuckets(range, points, granularity);
}

/**
 * Unified business dashboard overview.
 * Uses Mongo aggregations only — never loads full order lists into memory.
 *
 * Revenue definition (documented):
 * - paymentStatus === 'captured'
 * - status !== 'cancelled'
 * - isTestOrder !== true
 * - isDeleted=true (archive) IS included
 * - dateBasis = createdAt (no capturedAt field exists)
 */
export async function getDashboardOverview(query: DashboardOverviewQuery) {
  const range = resolveDashboardRange(query);
  const prev = previousRange(range);

  const [
    currentCaptured,
    previousCaptured,
    totalOrders,
    previousTotalOrders,
    activeOrders,
    previousActiveOrders,
    returningCustomers,
    previousReturning,
    awaiting,
    failed,
    ordersByStatus,
    ordersByType,
    top,
    trend
  ] = await Promise.all([
    sumCaptured(range.from, range.to),
    sumCaptured(prev.from, prev.to),
    countTotalCreated(range.from, range.to),
    countTotalCreated(prev.from, prev.to),
    countActiveInRange(range.from, range.to),
    countActiveInRange(prev.from, prev.to),
    countReturning(range.from, range.to),
    countReturning(prev.from, prev.to),
    Order.countDocuments(DASHBOARD_MATCH.awaitingPayment),
    Order.countDocuments(DASHBOARD_MATCH.failedPayment),
    groupByStatus(range.from, range.to),
    groupByType(range.from, range.to),
    topItems(range.from, range.to),
    trendSeries(range)
  ]);

  const avg =
    currentCaptured.orders > 0 ? currentCaptured.revenue / currentCaptured.orders : 0;
  const prevAvg =
    previousCaptured.orders > 0 ? previousCaptured.revenue / previousCaptured.orders : 0;

  return {
    range: {
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      timezone: range.timezone,
      dateBasis: 'createdAt' as const,
      preset: range.preset || null,
      previous: {
        from: prev.from.toISOString(),
        to: prev.to.toISOString()
      }
    },
    kpis: {
      capturedRevenue: kpiTriple(currentCaptured.revenue, previousCaptured.revenue),
      paidOrders: kpiTriple(currentCaptured.orders, previousCaptured.orders),
      averageOrderValue: kpiTriple(avg, prevAvg),
      totalOrders: kpiTriple(totalOrders, previousTotalOrders),
      activeOrders: kpiTriple(activeOrders, previousActiveOrders),
      returningCustomers: kpiTriple(returningCustomers, previousReturning)
    },
    paymentAlerts: {
      awaiting,
      failed
    },
    trend,
    ordersByStatus,
    ordersByType,
    topItems: top
  };
}

export async function setOrderTestFlag(
  orderId: string,
  isTestOrder: boolean
): Promise<Record<string, unknown> | null> {
  const updated = await Order.findByIdAndUpdate(
    orderId,
    { $set: { isTestOrder: Boolean(isTestOrder) } },
    { returnDocument: 'after' }
  )
    .select(ORDER_ADMIN_LIST_SELECT)
    .lean();
  return updated as unknown as Record<string, unknown> | null;
}
