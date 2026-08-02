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
  trendGranularity,
  businessDayKeys
} from '../utils/dashboard-overview.util';
import {
  buildDashboardInsights,
  buildDaySummaryFromOrders,
  DashboardActionItem,
  extractCustomerName,
  extractCustomerPhone,
  extractEventDate,
  buildTopSellingByMonth,
  filterPrepTopItems,
  filterSoldTopItems,
  hasSpecialNotes,
  isPrepReadyStatus,
  notePreview,
  normalizeItemCategory,
  resolveFulfillment,
  resolveOrderPortions,
  sortActionItems,
  TopSellingMonth,
  UpcomingOrderRow,
  withAverageOrderValue
} from '../utils/dashboard-ops.util';

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
                { $isNumber: '$items.quantity' },
                { $gte: ['$items.quantity', 0] }
              ]
            },
            '$items.quantity',
            null
          ]
        },
        // Precedence: items.price (incl. 0) → selectedOption.price → null. Never items.total.
        // Use $isNumber so BSON int/long/double all match (not only type alias "number").
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
                    { $isNumber: '$$rootPrice' },
                    { $gte: ['$$rootPrice', 0] }
                  ]
                },
                '$$rootPrice',
                {
                  $cond: [
                    {
                      $and: [
                        { $isNumber: '$$optionPrice' },
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

/**
 * Top 3 sold items per category per calendar month (Asia/Jerusalem).
 * Independent of the KPI date range — uses captured orders up to now (last 36 months).
 */
async function topSellingByMonthSeries(
  timezone = 'Asia/Jerusalem',
  monthsBack = 36
): Promise<TopSellingMonth[]> {
  const now = new Date();
  const from = new Date(now);
  from.setUTCMonth(from.getUTCMonth() - monthsBack);

  const rows = await Order.aggregate([
    {
      $match: {
        ...DASHBOARD_MATCH.capturedRevenue,
        createdAt: { $gte: from, $lte: now }
      }
    },
    { $unwind: { path: '$items', preserveNullAndEmptyArrays: false } },
    {
      $project: {
        month: {
          $dateToString: {
            format: '%Y-%m',
            date: '$createdAt',
            timezone
          }
        },
        categoryRaw: {
          $trim: {
            input: { $toString: { $ifNull: ['$items.category', ''] } }
          }
        },
        name: {
          $trim: {
            input: { $toString: { $ifNull: ['$items.name', ''] } }
          }
        },
        qty: {
          $cond: [
            {
              $and: [
                { $isNumber: '$items.quantity' },
                { $gte: ['$items.quantity', 0] }
              ]
            },
            '$items.quantity',
            null
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
                  $and: [
                    { $isNumber: '$$rootPrice' },
                    { $gte: ['$$rootPrice', 0] }
                  ]
                },
                '$$rootPrice',
                {
                  $cond: [
                    {
                      $and: [
                        { $isNumber: '$$optionPrice' },
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
        category: {
          $cond: [{ $eq: ['$categoryRaw', ''] }, 'כללי', '$categoryRaw']
        },
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
        _id: { month: '$month', category: '$category', name: '$name' },
        quantity: { $sum: '$qtyForSum' },
        revenue: { $sum: '$lineRevenue' }
      }
    },
    {
      $project: {
        _id: 0,
        month: '$_id.month',
        category: '$_id.category',
        name: '$_id.name',
        quantity: 1,
        revenue: 1
      }
    }
  ]);

  return buildTopSellingByMonth(
    (rows || []).map((r: { month?: string; category?: string; name?: string; quantity?: number; revenue?: number }) => ({
      month: r.month,
      category: normalizeItemCategory(r.category),
      name: r.name,
      quantity: r.quantity,
      revenue: r.revenue
    })),
    3
  );
}

/** Recent payment-attention orders for admin dashboard (safe fields only). */
async function paymentAlertItems(limit = 20) {
  const rows = await Order.find({
    ...DASHBOARD_MATCH.notTest,
    isDeleted: { $ne: true },
    paymentStatus: { $in: ['awaiting_payment', 'authorized', 'failed'] }
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .select('_id orderNumber paymentStatus status totalPrice createdAt')
    .lean();

  return rows.map((r: any) => ({
    id: String(r._id),
    orderNumber: r.orderNumber ? String(r.orderNumber) : undefined,
    paymentStatus: String(r.paymentStatus || ''),
    status: String(r.status || ''),
    totalPrice: Number(r.totalPrice) || 0,
    createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : null
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

const OPS_ORDER_SELECT =
  '_id orderNumber status paymentStatus totalPrice createdAt isTestOrder isDeleted assignedDriverId assignedDriverName customerDetails portionsEvening portionsMorning numberOfPortions mealTime items.name items.quantity items.description adminNotes orderType cateringKind';

const activeOpsMatch = {
  ...DASHBOARD_MATCH.notTest,
  isDeleted: { $ne: true },
  status: { $ne: 'cancelled' }
};

async function loadOrdersForEventDate(eventDate: string) {
  return Order.find({
    ...activeOpsMatch,
    'customerDetails.eventDate': eventDate
  })
    .select(OPS_ORDER_SELECT)
    .lean();
}

async function sumPaymentAmount(match: Record<string, unknown>): Promise<number> {
  const rows = await Order.aggregate([
    { $match: match },
    { $group: { _id: null, total: { $sum: { $ifNull: ['$totalPrice', 0] } } } }
  ]);
  return rows[0]?.total ?? 0;
}

async function findNearestPrepEventDate(todayKey: string): Promise<string | null> {
  const rows = await Order.aggregate([
    {
      $match: {
        ...activeOpsMatch,
        'customerDetails.eventDate': { $gte: todayKey, $regex: /^\d{4}-\d{2}-\d{2}$/ }
      }
    },
    { $group: { _id: '$customerDetails.eventDate', count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
    { $limit: 1 }
  ]);
  return rows[0]?._id ? String(rows[0]._id) : null;
}

async function buildUpcomingPreparation(todayKey: string) {
  const eventDate = await findNearestPrepEventDate(todayKey);
  if (!eventDate) {
    return {
      eventDate: null,
      ordersCount: 0,
      portionsTotal: 0,
      portionsEvening: 0,
      portionsMorning: 0,
      topItems: [] as Array<{ name: string; quantity: number }>,
      notesOrders: [] as Array<{
        id: string;
        orderNumber?: string;
        customerName?: string;
        notePreview: string;
      }>
    };
  }

  const orders = await loadOrdersForEventDate(eventDate);
  let portionsTotal = 0;
  let portionsEvening = 0;
  let portionsMorning = 0;
  const itemQty = new Map<string, number>();
  const notesOrders: Array<{
    id: string;
    orderNumber?: string;
    customerName?: string;
    notePreview: string;
  }> = [];

  for (const o of orders as any[]) {
    const p = resolveOrderPortions(o);
    portionsTotal += p.total;
    portionsEvening += p.evening;
    portionsMorning += p.morning;
    for (const it of o.items || []) {
      const name = String(it?.name || '').trim();
      const q = Number(it?.quantity);
      if (!name || !Number.isFinite(q) || q <= 0) continue;
      itemQty.set(name, (itemQty.get(name) || 0) + q);
    }
    if (hasSpecialNotes(o) && notesOrders.length < 8) {
      notesOrders.push({
        id: String(o._id),
        orderNumber: o.orderNumber ? String(o.orderNumber) : undefined,
        customerName: extractCustomerName(o.customerDetails) || undefined,
        notePreview: notePreview(o)
      });
    }
  }

  const topItems = filterPrepTopItems(
    Array.from(itemQty.entries()).map(([name, quantity]) => ({ name, quantity }))
  )
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5);

  return {
    eventDate,
    ordersCount: orders.length,
    portionsTotal,
    portionsEvening,
    portionsMorning,
    topItems,
    notesOrders
  };
}

async function loadUpcomingOrders(todayKey: string, limit = 8): Promise<UpcomingOrderRow[]> {
  const rows = await Order.find({
    ...activeOpsMatch,
    'customerDetails.eventDate': { $gte: todayKey, $regex: /^\d{4}-\d{2}-\d{2}$/ }
  })
    .select(OPS_ORDER_SELECT)
    .sort({ 'customerDetails.eventDate': 1, createdAt: 1 })
    .limit(limit)
    .lean();

  return (rows as any[]).map((o) => ({
    id: String(o._id),
    orderNumber: o.orderNumber ? String(o.orderNumber) : undefined,
    customerName: extractCustomerName(o.customerDetails) || undefined,
    eventDate: extractEventDate(o.customerDetails),
    fulfillment: resolveFulfillment(o.customerDetails),
    totalPrice: Number(o.totalPrice) || 0,
    paymentStatus: o.paymentStatus ? String(o.paymentStatus) : undefined,
    status: String(o.status || ''),
    isTestOrder: false
  }));
}

async function buildActionItems(todayKey: string, tomorrowKey: string): Promise<DashboardActionItem[]> {
  const awaitingCutoff = new Date(Date.now() - 6 * 60 * 60 * 1000);
  const soonDates = [todayKey, tomorrowKey];

  const [failed, awaitingStale, pendingNew, upcomingNotReady, noDriver, missingInfo, noted] =
    await Promise.all([
      Order.find({ ...DASHBOARD_MATCH.failedPayment })
        .select(OPS_ORDER_SELECT)
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
      Order.find({
        ...DASHBOARD_MATCH.awaitingPayment,
        createdAt: { $lte: awaitingCutoff }
      })
        .select(OPS_ORDER_SELECT)
        .sort({ createdAt: 1 })
        .limit(10)
        .lean(),
      Order.find({
        ...activeOpsMatch,
        status: { $in: ['pending', 'new'] }
      })
        .select(OPS_ORDER_SELECT)
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
      Order.find({
        ...activeOpsMatch,
        'customerDetails.eventDate': { $in: soonDates },
        status: { $in: ['pending', 'new'] }
      })
        .select(OPS_ORDER_SELECT)
        .sort({ 'customerDetails.eventDate': 1 })
        .limit(10)
        .lean(),
      Order.find({
        ...activeOpsMatch,
        'customerDetails.eventDate': { $in: soonDates },
        $or: [{ assignedDriverId: null }, { assignedDriverId: { $exists: false } }]
      })
        .select(OPS_ORDER_SELECT)
        .sort({ 'customerDetails.eventDate': 1 })
        .limit(20)
        .lean(),
      Order.find({
        ...activeOpsMatch,
        $or: [
          { 'customerDetails.eventDate': { $in: [null, ''] } },
          { 'customerDetails.eventDate': { $exists: false } }
        ]
      })
        .select(OPS_ORDER_SELECT)
        .sort({ createdAt: -1 })
        .limit(8)
        .lean(),
      Order.find({
        ...activeOpsMatch,
        'customerDetails.eventDate': { $in: soonDates },
        $or: [
          { adminNotes: { $exists: true, $nin: [null, ''] } },
          { 'customerDetails.notes': { $exists: true, $nin: [null, ''] } }
        ]
      })
        .select(OPS_ORDER_SELECT)
        .limit(8)
        .lean()
    ]);

  const items: DashboardActionItem[] = [];
  const seen = new Set<string>();

  const pushUnique = (item: DashboardActionItem) => {
    const key = `${item.type}:${item.orderId || item.id}`;
    if (seen.has(key)) return;
    seen.add(key);
    items.push(item);
  };

  const mapOrder = (o: any) => {
    const id = String(o._id);
    const eventDate = extractEventDate(o.customerDetails);
    const customerName = extractCustomerName(o.customerDetails) || undefined;
    const orderNumber = o.orderNumber ? String(o.orderNumber) : undefined;
    return { id, eventDate, customerName, orderNumber, totalPrice: Number(o.totalPrice) || 0 };
  };

  for (const o of failed as any[]) {
    const m = mapOrder(o);
    pushUnique({
      id: `payment_failed:${m.id}`,
      type: 'payment_failed',
      severity: 'critical',
      title: 'תשלום נכשל',
      description: 'נדרש טיפול בתשלום שנכשל',
      orderId: m.id,
      orderNumber: m.orderNumber,
      customerName: m.customerName,
      eventDate: m.eventDate,
      amount: m.totalPrice,
      actionLabel: 'פתח הזמנה',
      actionHref: `/admin/orders?orderId=${m.id}&statusTab=failed`,
      sortKey: String(o.createdAt || '')
    });
  }

  for (const o of awaitingStale as any[]) {
    const m = mapOrder(o);
    pushUnique({
      id: `payment_awaiting:${m.id}`,
      type: 'payment_awaiting',
      severity: 'high',
      title: 'תשלום ממתין',
      description: 'תשלום ממתין או אושר אך טרם נלכד מעל 6 שעות',
      orderId: m.id,
      orderNumber: m.orderNumber,
      customerName: m.customerName,
      eventDate: m.eventDate,
      amount: m.totalPrice,
      actionLabel: 'פתח הזמנה',
      actionHref: `/admin/orders?orderId=${m.id}`,
      sortKey: String(o.createdAt || '')
    });
  }

  for (const o of upcomingNotReady as any[]) {
    const m = mapOrder(o);
    if (isPrepReadyStatus(o.status)) continue;
    pushUnique({
      id: `upcoming_not_ready:${m.id}`,
      type: 'upcoming_not_ready',
      severity: 'high',
      title: 'הזמנה קרובה לא בטיפול',
      description: 'מועד אספקה קרוב ועדיין במצב ממתין',
      orderId: m.id,
      orderNumber: m.orderNumber,
      customerName: m.customerName,
      eventDate: m.eventDate,
      amount: m.totalPrice,
      actionLabel: 'פתח הזמנה',
      actionHref: `/admin/orders?orderId=${m.id}&statusTab=pending`,
      sortKey: m.eventDate || ''
    });
  }

  for (const o of noDriver as any[]) {
    const m = mapOrder(o);
    const fulfillment = resolveFulfillment(o.customerDetails);
    // Only real deliveries — never invent "no driver" for unknown/pickup.
    if (fulfillment !== 'delivery') continue;
    pushUnique({
      id: `delivery_no_driver:${m.id}`,
      type: 'delivery_no_driver',
      severity: 'high',
      title: 'משלוח ללא נהג',
      description: 'משלוח למועד קרוב ללא שיוך נהג',
      orderId: m.id,
      orderNumber: m.orderNumber,
      customerName: m.customerName,
      eventDate: m.eventDate,
      amount: m.totalPrice,
      actionLabel: 'סידור משלוחים',
      actionHref: `/admin/delivery`,
      sortKey: m.eventDate || ''
    });
  }

  // Missing fulfillment type on upcoming orders → missing_info, not delivery alert.
  for (const o of [...(upcomingNotReady as any[]), ...(noDriver as any[]), ...(pendingNew as any[])]) {
    const fulfillment = resolveFulfillment(o.customerDetails);
    if (fulfillment !== 'unknown') continue;
    const m = mapOrder(o);
    pushUnique({
      id: `missing_info:${m.id}`,
      type: 'missing_info',
      severity: 'medium',
      title: 'מידע חסר',
      description: 'חסר: סוג אספקה',
      orderId: m.id,
      orderNumber: m.orderNumber,
      customerName: m.customerName,
      eventDate: m.eventDate,
      amount: m.totalPrice,
      actionLabel: 'פתח הזמנה',
      actionHref: `/admin/orders?orderId=${m.id}`,
      sortKey: m.eventDate || String(o.createdAt || '')
    });
  }

  for (const o of pendingNew as any[]) {
    const m = mapOrder(o);
    pushUnique({
      id: `new_pending:${m.id}`,
      type: 'new_pending',
      severity: 'medium',
      title: 'הזמנה ממתינה לאישור',
      description: 'הזמנה חדשה במצב ממתין',
      orderId: m.id,
      orderNumber: m.orderNumber,
      customerName: m.customerName,
      eventDate: m.eventDate,
      amount: m.totalPrice,
      actionLabel: 'פתח הזמנה',
      actionHref: `/admin/orders?orderId=${m.id}&statusTab=pending`,
      sortKey: String(o.createdAt || '')
    });
  }

  for (const o of missingInfo as any[]) {
    const m = mapOrder(o);
    const phone = extractCustomerPhone(o.customerDetails);
    const eventDate = m.eventDate;
    if (phone && eventDate) continue;
    const missing: string[] = [];
    if (!eventDate) missing.push('מועד אספקה');
    if (!phone) missing.push('טלפון');
    if (!missing.length) continue;
    pushUnique({
      id: `missing_info:${m.id}`,
      type: 'missing_info',
      severity: 'medium',
      title: 'מידע חסר',
      description: `חסר: ${missing.join(', ')}`,
      orderId: m.id,
      orderNumber: m.orderNumber,
      customerName: m.customerName,
      eventDate: m.eventDate,
      amount: m.totalPrice,
      actionLabel: 'פתח הזמנה',
      actionHref: `/admin/orders?orderId=${m.id}`,
      sortKey: String(o.createdAt || '')
    });
  }

  // Also flag upcoming orders missing phone (event date present).
  for (const o of [...(upcomingNotReady as any[]), ...(noDriver as any[])]) {
    const phone = extractCustomerPhone(o.customerDetails);
    if (phone) continue;
    const m = mapOrder(o);
    pushUnique({
      id: `missing_info:${m.id}`,
      type: 'missing_info',
      severity: 'medium',
      title: 'מידע חסר',
      description: 'חסר: טלפון',
      orderId: m.id,
      orderNumber: m.orderNumber,
      customerName: m.customerName,
      eventDate: m.eventDate,
      amount: m.totalPrice,
      actionLabel: 'פתח הזמנה',
      actionHref: `/admin/orders?orderId=${m.id}`,
      sortKey: String(o.createdAt || '')
    });
  }

  for (const o of noted as any[]) {
    const m = mapOrder(o);
    pushUnique({
      id: `special_notes:${m.id}`,
      type: 'special_notes',
      severity: 'low',
      title: 'הערה מיוחדת',
      description: notePreview(o) || 'יש הערת לקוח או מנהל',
      orderId: m.id,
      orderNumber: m.orderNumber,
      customerName: m.customerName,
      eventDate: m.eventDate,
      amount: m.totalPrice,
      actionLabel: 'פתח הזמנה',
      actionHref: `/admin/orders?orderId=${m.id}`,
      sortKey: m.eventDate || ''
    });
  }

  return sortActionItems(items).slice(0, 20);
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
 *
 * Operational sections (today/tomorrow/prep/upcoming) use customerDetails.eventDate.
 */
export async function getDashboardOverview(query: DashboardOverviewQuery) {
  const range = resolveDashboardRange(query);
  const prev = previousRange(range);
  const { today: todayKey, tomorrow: tomorrowKey } = businessDayKeys(new Date(), range.timezone);

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
    awaitingAmount,
    failedAmount,
    alertItems,
    ordersByStatus,
    ordersByType,
    top,
    trend,
    todayOrders,
    tomorrowOrders,
    upcomingPreparation,
    upcomingOrders,
    actionItems,
    topSellingByMonth
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
    sumPaymentAmount(DASHBOARD_MATCH.awaitingPayment),
    sumPaymentAmount(DASHBOARD_MATCH.failedPayment),
    paymentAlertItems(20),
    groupByStatus(range.from, range.to),
    groupByType(range.from, range.to),
    topItems(range.from, range.to),
    trendSeries(range),
    loadOrdersForEventDate(todayKey),
    loadOrdersForEventDate(tomorrowKey),
    buildUpcomingPreparation(todayKey),
    loadUpcomingOrders(todayKey, 8),
    buildActionItems(todayKey, tomorrowKey),
    topSellingByMonthSeries(range.timezone || 'Asia/Jerusalem', 36)
  ]);

  const avg =
    currentCaptured.orders > 0 ? currentCaptured.revenue / currentCaptured.orders : 0;
  const prevAvg =
    previousCaptured.orders > 0 ? previousCaptured.revenue / previousCaptured.orders : 0;

  const todaySummary = buildDaySummaryFromOrders(todayKey, todayOrders as any[]);
  const tomorrowSummary = buildDaySummaryFromOrders(tomorrowKey, tomorrowOrders as any[]);
  const soldTopItems = filterSoldTopItems(top);
  const trendWithAvg = withAverageOrderValue(trend);

  const strongestTrendDay = [...trendWithAvg]
    .filter((p) => /^\d{4}-\d{2}-\d{2}$/.test(p.period))
    .sort((a, b) => b.paidOrdersCount - a.paidOrdersCount)[0] || null;

  const insights = buildDashboardInsights({
    awaitingPayments: awaiting,
    failedPayments: failed,
    tomorrow: tomorrowSummary,
    today: todaySummary,
    topSoldItem: soldTopItems[0]
      ? { name: soldTopItems[0].name, quantity: soldTopItems[0].quantity }
      : null,
    strongestTrendDay: strongestTrendDay
      ? { period: strongestTrendDay.period, paidOrdersCount: strongestTrendDay.paidOrdersCount }
      : null,
    revenueChangePercent: kpiTriple(currentCaptured.revenue, previousCaptured.revenue).changePercent,
    revenuePreviousSample: previousCaptured.orders,
    actionItemTypes: actionItems.map((a) => a.type)
  });

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
      failed,
      /** Recent awaiting/authorized/failed orders — no card/PCI fields. */
      items: alertItems
    },
    trend: trendWithAvg,
    ordersByStatus,
    ordersByType,
    topItems: soldTopItems,
    /** Top 3 per category per month from all captured orders (independent of KPI range). */
    topSellingByMonth,
    /** Additive operational payload for the daily ops dashboard. */
    actionItems,
    todaySummary,
    tomorrowSummary,
    upcomingPreparation,
    financialSummary: {
      capturedRevenue: currentCaptured.revenue,
      paidOrders: currentCaptured.orders,
      averageOrderValue: avg,
      /** Count of orders awaiting_payment | authorized (not a currency value). */
      awaitingPayments: awaiting,
      awaitingCount: awaiting,
      /**
       * Outstanding payment total for awaiting_payment | authorized orders.
       * Partial payments / deposits are ABSENT in this system, so there is no
       * remaining-balance field — awaitingAmount is the sum of full totalPrice.
       */
      awaitingAmount,
      failedPayments: failed,
      failedCount: failed,
      /** Sum of totalPrice for failed payment orders. */
      failedAmount,
      returningCustomers,
      capturedRevenueChange: kpiTriple(currentCaptured.revenue, previousCaptured.revenue),
      paidOrdersChange: kpiTriple(currentCaptured.orders, previousCaptured.orders),
      averageOrderValueChange: kpiTriple(avg, prevAvg)
    },
    upcomingOrders,
    insights,
    insightsData: {
      todayKey,
      tomorrowKey,
      strongestTrendDay: strongestTrendDay
        ? { period: strongestTrendDay.period, paidOrdersCount: strongestTrendDay.paidOrdersCount }
        : null
    },
    generatedAt: new Date().toISOString()
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
