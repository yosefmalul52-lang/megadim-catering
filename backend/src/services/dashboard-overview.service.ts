import Order from '../models/Order';
import { ORDER_ADMIN_LIST_SELECT } from '../utils/order-projection.util';
import {
  DASHBOARD_MATCH,
  DateRange,
  fillTrendBuckets,
  kpiTriple,
  previousRange,
  resolveDashboardRange,
  trendGranularity,
  businessDayKeys,
  countReturningFromPhoneGroups
} from '../utils/dashboard-overview.util';
import {
  buildDashboardInsights,
  buildDaySummaryFromOrders,
  DashboardActionItem,
  extractCustomerName,
  extractCustomerPhone,
  extractEventDate,
  buildTopSellingByCategory,
  filterPrepTopItems,
  filterSoldTopItems,
  hasSpecialNotes,
  isPrepReadyStatus,
  notePreview,
  normalizeItemCategory,
  resolveFulfillment,
  resolveOrderPortions,
  sortActionItems,
  TopSellingCategory,
  UpcomingOrderRow,
  withAverageOrderValue
} from '../utils/dashboard-ops.util';
import { getBusinessMetrics } from './business-metrics.service';
import { createdAtRangeMatch } from '../utils/business-metrics.util';
import {
  buildActualRevenueInRangeMatch,
  effectivePaidAtMongoExpr,
  revenueAmountMongoExpr,
  ACTUAL_REVENUE_DATE_BASIS
} from '../utils/order-actual-revenue.util';
import {
  BUSINESS_REVIEW_NOTES,
  FULFILLMENT_LABEL_HE,
  ORDER_KIND_LABEL_HE,
  STATUS_LABEL_HE_BR,
  activityGranularity,
  addJerusalemCalendarDays,
  alignPaidFinanceFromBusinessReview,
  assertDashboardPaidFinanceAreasConsistent,
  averageTransactionAmount,
  buildBreakdownRows,
  buildBusinessReviewHealthyOrdersMatch,
  buildBusinessReviewOrdersCreatedMatch,
  buildBusinessReviewPaidMatch,
  changePercentRounded,
  computeReturningCustomersList,
  countReturningCustomers,
  customerReturningIdentity,
  fillActivitySeriesPoints,
  isHealthyOrderForCustomerStats,
  mergeBusinessReviewAlerts,
  previousPeriodRange,
  resolveBusinessOrderKind,
  resolveBusinessReviewRange,
  roundMoney,
  toJerusalemDateKey,
  uniqueOrderIdsInAlerts,
  upcomingEventDateWindow,
  JERUSALEM_TZ
} from '../utils/dashboard-business-review.util';
import { buildExceptionsApproximateClause } from '../utils/admin-payments.util';
import { buildAdminFailedTabFilter } from '../utils/order-admin-status.util';

export type DashboardOverviewQuery = {
  preset?: string;
  from?: string;
  to?: string;
  timezone?: string;
  /** Independent date window for topSellingByCategory (defaults to last30). */
  salesPreset?: string;
  salesFrom?: string;
  salesTo?: string;
  orderKind?: string;
  status?: string;
  paymentStatus?: string;
};

function createdAtMatch(from: Date, to: Date) {
  return createdAtRangeMatch(from, to);
}

async function sumCaptured(from: Date, to: Date): Promise<{ revenue: number; orders: number }> {
  const rows = await Order.aggregate([
    {
      $match: buildActualRevenueInRangeMatch(from, to)
    },
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
      $match: buildActualRevenueInRangeMatch(from, to)
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
      $match: buildActualRevenueInRangeMatch(from, to)
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
 * Top 3 sold items per category for the selected KPI date range (createdAt).
 * Defaults to last 30 days when the client uses the last30 preset.
 */
async function topSellingByCategorySeries(from: Date, to: Date): Promise<TopSellingCategory[]> {
  const rows = await Order.aggregate([
    {
      $match: buildActualRevenueInRangeMatch(from, to)
    },
    { $unwind: { path: '$items', preserveNullAndEmptyArrays: false } },
    {
      $project: {
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
        _id: { category: '$category', name: '$name' },
        quantity: { $sum: '$qtyForSum' },
        revenue: { $sum: '$lineRevenue' }
      }
    },
    {
      $project: {
        _id: 0,
        category: '$_id.category',
        name: '$_id.name',
        quantity: 1,
        revenue: 1
      }
    }
  ]);

  return buildTopSellingByCategory(
    (rows || []).map((r: { category?: string; name?: string; quantity?: number; revenue?: number }) => ({
      category: normalizeItemCategory(r.category),
      name: r.name,
      quantity: r.quantity,
      revenue: r.revenue
    })),
    3
  );
}

function paymentAttentionReason(paymentStatus: string): {
  code: 'abandoned_checkout' | 'gateway_failed' | 'authorized_uncaptured' | 'unknown';
  labelHe: string;
  detailHe: string;
  cardEnteredHe: string;
  chargedHe: string;
} {
  if (paymentStatus === 'awaiting_payment') {
    return {
      code: 'abandoned_checkout',
      labelHe: 'ננטש בתשלום',
      detailHe:
        'הלקוח התחיל תשלום באתר אך לא חזר עם אישור מספק הסליקה. אין אישור שהכסף התקבל.',
      cardEnteredHe:
        'לא ידוע בוודאות — ייתכן שהתחיל להזין בדף הסליקה, אך אין אישור במערכת שלנו.',
      chargedHe: 'לא חויב — לא התקבל אישור חיוב/אישור (authorize) במערכת.'
    };
  }
  if (paymentStatus === 'failed') {
    return {
      code: 'gateway_failed',
      labelHe: 'תשלום נכשל',
      detailHe: 'תהליך התשלום הסתיים בכישלון (סטטוס failed). מומלץ לבדוק מול הלקוח.',
      cardEnteredHe: 'סביר שניסה להזין אשראי, אך אין אישור שהעסקה הצליחה.',
      chargedHe: 'לא חויב בהצלחה.'
    };
  }
  if (paymentStatus === 'authorized') {
    return {
      code: 'authorized_uncaptured',
      labelHe: 'אושר וטרם חויב',
      detailHe: 'קיימת הרשאה על הכרטיס שטרם חויבה (capture).',
      cardEnteredHe: 'כן — התקבל אישור הרשאה על הכרטיס.',
      chargedHe: 'לא עדיין — הרשאה בלבד, בלי חיוב סופי.'
    };
  }
  return {
    code: 'unknown',
    labelHe: 'דורש בדיקת תשלום',
    detailHe: 'מצב תשלום דורש בדיקה ידנית.',
    cardEnteredHe: 'לא ידוע.',
    chargedHe: 'לא ידוע.'
  };
}

/** Recent payment-attention orders for admin dashboard (safe fields only). */
async function paymentAlertItems(limit = 20) {
  const rows = await Order.find({
    ...DASHBOARD_MATCH.notTest,
    ...buildAdminFailedTabFilter(new Date())
  } as any)
    .sort({ createdAt: -1 })
    .limit(limit)
    .select('_id orderNumber paymentStatus status totalPrice createdAt customerDetails')
    .lean();

  return rows.map((r: any) => {
    const paymentStatus = String(r.paymentStatus || '');
    const reason = paymentAttentionReason(paymentStatus);
    return {
      id: String(r._id),
      orderNumber: r.orderNumber ? String(r.orderNumber) : undefined,
      customerName: extractCustomerName(r.customerDetails) || undefined,
      paymentStatus,
      status: String(r.status || ''),
      totalPrice: Number(r.totalPrice) || 0,
      createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : null,
      reasonCode: reason.code,
      reasonLabelHe: reason.labelHe,
      reasonDetailHe: reason.detailHe,
      cardEnteredHe: reason.cardEnteredHe,
      chargedHe: reason.chargedHe
    };
  });
}

async function trendSeries(range: DateRange) {
  const granularity = trendGranularity(range);
  const dateFormat = granularity === 'day' ? '%Y-%m-%d' : '%Y-%m';
  const rows = await Order.aggregate([
    {
      $match: buildActualRevenueInRangeMatch(range.from, range.to)
    },
    {
      $group: {
        _id: {
          $dateToString: {
            format: dateFormat,
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
  const soonDates = [todayKey, tomorrowKey];
  const now = new Date();
  const failedTabFilter = {
    ...DASHBOARD_MATCH.notTest,
    ...buildAdminFailedTabFilter(now)
  };

  const [
    failedTabOrders,
    pendingNew,
    upcomingNotReady,
    noDriver,
    missingInfo,
    noted
  ] = await Promise.all([
      Order.find(failedTabFilter as any)
        .select(OPS_ORDER_SELECT)
        .sort({ createdAt: -1 })
        .limit(20)
        .lean(),
      Order.find({
        ...activeOpsMatch,
        status: { $in: ['pending', 'new'] },
        paymentStatus: { $nin: ['failed', 'awaiting_payment'] }
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

  for (const o of failedTabOrders as any[]) {
    const m = mapOrder(o);
    const pay = String(o.paymentStatus || '').trim();
    if (pay === 'failed') {
      const reason = paymentAttentionReason('failed');
      pushUnique({
        id: `payment_failed:${m.id}`,
        type: 'payment_failed',
        severity: 'critical',
        title: reason.labelHe,
        description: reason.detailHe,
        orderId: m.id,
        orderNumber: m.orderNumber,
        customerName: m.customerName,
        eventDate: m.eventDate,
        amount: m.totalPrice,
        actionLabel: 'פתח הזמנה',
        actionHref: `/admin/orders?orderId=${m.id}&statusTab=failed`,
        sortKey: String(o.createdAt || '')
      });
    } else {
      const reason = paymentAttentionReason('awaiting_payment');
      pushUnique({
        id: `payment_abandoned:${m.id}`,
        type: 'payment_abandoned',
        severity: 'high',
        title: reason.labelHe,
        description: reason.detailHe,
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
 * Financial KPIs come from the central business-metrics service (single definition).
 * Operational sections (today/tomorrow/prep/upcoming) use customerDetails.eventDate.
 */
function resolveSalesRange(query: DashboardOverviewQuery): DateRange {
  const timezone = query.timezone;
  const hasSalesBounds = Boolean(query.salesFrom && query.salesTo);
  const hasSalesPreset = Boolean(query.salesPreset);
  if (hasSalesBounds || hasSalesPreset) {
    return resolveDashboardRange({
      preset: query.salesPreset,
      from: query.salesFrom,
      to: query.salesTo,
      timezone
    });
  }
  return resolveDashboardRange({ preset: 'last30', timezone });
}

const BUSINESS_REVIEW_SELECT =
  '_id orderNumber userId status paymentStatus totalPrice adminPriceOverride createdAt updatedAt paidAt capturedAt isTestOrder isDeleted orderType cateringKind customerDetails items.name items.quantity items.price items.category items.selectedOption.price captureLockId';

async function paidKpiAggregate(match: Record<string, unknown>): Promise<{
  revenue: number;
  paidCount: number;
}> {
  const rows = await Order.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        revenue: { $sum: revenueAmountMongoExpr() },
        paidCount: { $sum: 1 }
      }
    }
  ]);
  return {
    revenue: roundMoney(rows[0]?.revenue),
    paidCount: Number(rows[0]?.paidCount) || 0
  };
}

async function buildBusinessReview(query: DashboardOverviewQuery) {
  const now = new Date();
  const brRange = resolveBusinessReviewRange({
    preset: query.preset,
    from: query.from,
    to: query.to,
    now
  });
  const prev = previousPeriodRange(brRange.dateFrom, brRange.dateTo);
  const todayKey = toJerusalemDateKey(now);
  const upcomingWindow = upcomingEventDateWindow(todayKey);
  const granularity = activityGranularity(brRange.dateFrom, brRange.dateTo);
  const dateFormat = granularity === 'day' ? '%Y-%m-%d' : '%Y-%m';

  const paidMatch = buildBusinessReviewPaidMatch({
    dateFrom: brRange.dateFrom,
    dateTo: brRange.dateTo,
    includeDeletedPayments: true
  });
  const prevPaidMatch = prev
    ? buildBusinessReviewPaidMatch({
        dateFrom: prev.dateFrom,
        dateTo: prev.dateTo,
        includeDeletedPayments: true
      })
    : null;

  const createdMatch = buildBusinessReviewOrdersCreatedMatch({
    dateFrom: brRange.dateFrom,
    dateTo: brRange.dateTo
  });
  const healthyMatch = buildBusinessReviewHealthyOrdersMatch({
    dateFrom: brRange.dateFrom,
    dateTo: brRange.dateTo
  });
  const prevCreatedMatch = prev
    ? buildBusinessReviewOrdersCreatedMatch({
        dateFrom: prev.dateFrom,
        dateTo: prev.dateTo
      })
    : null;
  const prevHealthyMatch = prev
    ? buildBusinessReviewHealthyOrdersMatch({
        dateFrom: prev.dateFrom,
        dateTo: prev.dateTo
      })
    : null;

  const alertCandidateMatch = {
    isTestOrder: { $ne: true },
    $or: [
      // Capture locks + other payment anomalies (refined in JS; archive skipped there)
      buildExceptionsApproximateClause(now),
      // Failed / abandoned tab membership (SSOT with orders admin)
      buildAdminFailedTabFilter(now),
      {
        isDeleted: { $ne: true },
        status: { $ne: 'cancelled' },
        'customerDetails.eventDate': {
          $gte: upcomingWindow.fromKey,
          $lte: upcomingWindow.toKey,
          $regex: /^\d{4}-\d{2}-\d{2}$/
        }
      },
      {
        isDeleted: { $ne: true },
        'customerDetails.eventDate': {
          $exists: true,
          $nin: [null, ''],
          $not: { $regex: /^\d{4}-\d{2}-\d{2}$/ }
        }
      }
    ]
  };

  const [
    paidCur,
    paidPrev,
    createdStats,
    createdPrevStats,
    upcomingCount,
    alertDocs,
    healthyInRange,
    activityPaid,
    activityCreated,
    prevActivityPaid,
    prevActivityCreated,
    topDishRows,
    breakdownDocs
  ] = await Promise.all([
    paidKpiAggregate(paidMatch),
    prevPaidMatch ? paidKpiAggregate(prevPaidMatch) : Promise.resolve({ revenue: 0, paidCount: 0 }),
    Order.aggregate([
      { $match: createdMatch },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          cancelledCount: {
            $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
          },
          healthyCount: {
            $sum: { $cond: [{ $ne: ['$status', 'cancelled'] }, 1, 0] }
          }
        }
      }
    ]),
    prevCreatedMatch
      ? Order.aggregate([
          { $match: prevCreatedMatch },
          {
            $group: {
              _id: null,
              healthyCount: {
                $sum: { $cond: [{ $ne: ['$status', 'cancelled'] }, 1, 0] }
              }
            }
          }
        ])
      : Promise.resolve([{ healthyCount: 0 }]),
    Order.countDocuments({
      isTestOrder: { $ne: true },
      isDeleted: { $ne: true },
      status: { $ne: 'cancelled' },
      'customerDetails.eventDate': {
        $gte: upcomingWindow.fromKey,
        $lte: upcomingWindow.toKey,
        $regex: /^\d{4}-\d{2}-\d{2}$/
      }
    }),
    Order.find(alertCandidateMatch as any)
      .select(BUSINESS_REVIEW_SELECT)
      .select('+captureLockId')
      .sort({ createdAt: -1 })
      .limit(400)
      .lean(),
    Order.find(healthyMatch)
      .select(BUSINESS_REVIEW_SELECT)
      .limit(5000)
      .lean(),
    Order.aggregate([
      { $match: paidMatch },
      {
        $group: {
          _id: {
            $dateToString: {
              format: dateFormat,
              date: effectivePaidAtMongoExpr(),
              timezone: JERUSALEM_TZ
            }
          },
          revenue: { $sum: revenueAmountMongoExpr() },
          paidCount: { $sum: 1 }
        }
      }
    ]),
    Order.aggregate([
      { $match: createdMatch },
      {
        $group: {
          _id: {
            $dateToString: {
              format: dateFormat,
              date: '$createdAt',
              timezone: JERUSALEM_TZ
            }
          },
          ordersCreated: { $sum: 1 }
        }
      }
    ]),
    prevPaidMatch
      ? Order.aggregate([
          { $match: prevPaidMatch },
          {
            $group: {
              _id: {
                $dateToString: {
                  format: dateFormat,
                  date: effectivePaidAtMongoExpr(),
                  timezone: JERUSALEM_TZ
                }
              },
              revenue: { $sum: revenueAmountMongoExpr() },
              paidCount: { $sum: 1 }
            }
          }
        ])
      : Promise.resolve([]),
    prevCreatedMatch
      ? Order.aggregate([
          { $match: prevCreatedMatch },
          {
            $group: {
              _id: {
                $dateToString: {
                  format: dateFormat,
                  date: '$createdAt',
                  timezone: JERUSALEM_TZ
                }
              },
              ordersCreated: { $sum: 1 }
            }
          }
        ])
      : Promise.resolve([]),
    Order.aggregate([
      { $match: paidMatch },
      { $unwind: { path: '$items', preserveNullAndEmptyArrays: false } },
      {
        $project: {
          name: {
            $trim: { input: { $toString: { $ifNull: ['$items.name', ''] } } }
          },
          category: {
            $trim: { input: { $toString: { $ifNull: ['$items.category', ''] } } }
          },
          qty: {
            $cond: [
              {
                $and: [{ $isNumber: '$items.quantity' }, { $gte: ['$items.quantity', 0] }]
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
                    $and: [{ $isNumber: '$$rootPrice' }, { $gte: ['$$rootPrice', 0] }]
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
          },
          orderId: '$_id'
        }
      },
      { $match: { name: { $ne: '' } } },
      {
        $group: {
          _id: {
            name: '$name',
            category: '$category'
          },
          quantity: { $sum: { $ifNull: ['$qty', 0] } },
          orderIds: { $addToSet: '$orderId' },
          revenue: {
            $sum: {
              $cond: [
                { $and: [{ $ne: ['$unitPrice', null] }, { $ne: ['$qty', null] }] },
                { $multiply: ['$unitPrice', '$qty'] },
                0
              ]
            }
          },
          reliableLines: {
            $sum: {
              $cond: [
                { $and: [{ $ne: ['$unitPrice', null] }, { $ne: ['$qty', null] }] },
                1,
                0
              ]
            }
          },
          totalLines: { $sum: 1 }
        }
      },
      { $sort: { quantity: -1, revenue: -1 } },
      { $limit: 15 }
    ]),
    Order.find(healthyMatch)
      .select('_id status paymentStatus orderType cateringKind customerDetails totalPrice')
      .limit(5000)
      .lean()
  ]);

  const createdRow = createdStats[0] || { total: 0, cancelledCount: 0, healthyCount: 0 };
  const ordersCreatedValue = Number(createdRow.healthyCount) || 0;
  const cancelledCount = Number(createdRow.cancelledCount) || 0;
  const prevOrdersCreated = Number(createdPrevStats[0]?.healthyCount) || 0;

  const avgPaid = averageTransactionAmount(paidCur.revenue, paidCur.paidCount);
  const avgPaidPrev = averageTransactionAmount(paidPrev.revenue, paidPrev.paidCount);

  // Returning customers: two-pass in memory for ≤5k docs
  const identityKeys = new Set<string>();
  for (const o of healthyInRange as any[]) {
    if (!isHealthyOrderForCustomerStats(o)) continue;
    const key = customerReturningIdentity(o);
    if (key) identityKeys.add(key);
  }

  const lifetimeMap = new Map<string, number>();
  if (identityKeys.size > 0) {
    const historyDocs = await Order.find({
      isTestOrder: { $ne: true },
      isDeleted: { $ne: true },
      status: { $ne: 'cancelled' },
      $or: [
        { userId: { $exists: true, $ne: null } },
        { 'customerDetails.phone': { $exists: true, $nin: [null, ''] } },
        { 'customerDetails.email': { $exists: true, $nin: [null, ''] } }
      ]
    })
      .select(
        '_id userId status paymentStatus totalPrice createdAt isDeleted isTestOrder customerDetails orderType cateringKind'
      )
      .sort({ createdAt: -1 })
      .limit(5000)
      .lean();

    for (const doc of historyDocs as any[]) {
      if (!isHealthyOrderForCustomerStats(doc)) continue;
      const key = customerReturningIdentity(doc);
      if (!key || !identityKeys.has(key)) continue;
      lifetimeMap.set(key, (lifetimeMap.get(key) || 0) + 1);
    }
    // Ensure every in-range identity has at least its in-range count
    const inRangeCount = new Map<string, number>();
    for (const o of healthyInRange as any[]) {
      if (!isHealthyOrderForCustomerStats(o)) continue;
      const key = customerReturningIdentity(o);
      if (!key) continue;
      inRangeCount.set(key, (inRangeCount.get(key) || 0) + 1);
    }
    for (const [key, n] of inRangeCount) {
      lifetimeMap.set(key, Math.max(lifetimeMap.get(key) || 0, n));
    }
  }

  const returningCur = countReturningCustomers(healthyInRange as any[], lifetimeMap);

  let returningPrevValue: number | undefined;
  let returningChange: number | null | undefined;
  if (prevHealthyMatch) {
    const prevHealthy = await Order.find(prevHealthyMatch)
      .select(BUSINESS_REVIEW_SELECT)
      .limit(5000)
      .lean();
    const seenPrev = new Set<string>();
    let prevRet = 0;
    for (const o of prevHealthy as any[]) {
      if (!isHealthyOrderForCustomerStats(o)) continue;
      const key = customerReturningIdentity(o);
      if (!key || seenPrev.has(key)) continue;
      seenPrev.add(key);
      if ((lifetimeMap.get(key) || 0) >= 2) prevRet += 1;
    }
    returningPrevValue = prevRet;
    returningChange = changePercentRounded(returningCur.value, prevRet);
  }

  const returningList = computeReturningCustomersList(healthyInRange as any[], {
    lifetimeHealthyCountByKey: lifetimeMap,
    limit: 15
  });

  const alerts = mergeBusinessReviewAlerts(alertDocs as any[], {
    now,
    todayKey,
    max: 30
  });
  const needsAttention = uniqueOrderIdsInAlerts(alerts);

  // Activity series
  const paidByDate = new Map(
    (activityPaid as any[]).map((r) => [
      String(r._id),
      { revenue: roundMoney(r.revenue), paidCount: Number(r.paidCount) || 0 }
    ])
  );
  const createdByDate = new Map(
    (activityCreated as any[]).map((r) => [String(r._id), Number(r.ordersCreated) || 0])
  );
  const rawPoints = new Set([
    ...paidByDate.keys(),
    ...createdByDate.keys()
  ]);
  const mergedPoints = Array.from(rawPoints).map((date) => ({
    date,
    revenue: paidByDate.get(date)?.revenue ?? 0,
    paidCount: paidByDate.get(date)?.paidCount ?? 0,
    ordersCreated: createdByDate.get(date) ?? 0
  }));
  const points = fillActivitySeriesPoints(
    brRange.dateFrom,
    brRange.dateTo,
    mergedPoints,
    granularity
  );

  let previousPoints: typeof points | null = null;
  if (prev) {
    const prevPaidBy = new Map(
      (prevActivityPaid as any[]).map((r) => [
        String(r._id),
        { revenue: roundMoney(r.revenue), paidCount: Number(r.paidCount) || 0 }
      ])
    );
    const prevCreatedBy = new Map(
      (prevActivityCreated as any[]).map((r) => [String(r._id), Number(r.ordersCreated) || 0])
    );
    const prevKeys = new Set([...prevPaidBy.keys(), ...prevCreatedBy.keys()]);
    previousPoints = fillActivitySeriesPoints(
      prev.dateFrom,
      prev.dateTo,
      Array.from(prevKeys).map((date) => ({
        date,
        revenue: prevPaidBy.get(date)?.revenue ?? 0,
        paidCount: prevPaidBy.get(date)?.paidCount ?? 0,
        ordersCreated: prevCreatedBy.get(date) ?? 0
      })),
      granularity
    );
  }

  const topDishes = (topDishRows as any[]).map((r) => {
    const name = String(r._id?.name || '').trim();
    const category = String(r._id?.category || '').trim();
    const totalLines = Number(r.totalLines) || 0;
    const reliableLines = Number(r.reliableLines) || 0;
    const revenueReliable = totalLines > 0 && reliableLines === totalLines;
    return {
      name,
      category: category || undefined,
      quantity: Number(r.quantity) || 0,
      orderCount: Array.isArray(r.orderIds) ? r.orderIds.length : 0,
      revenue: revenueReliable ? roundMoney(r.revenue) : Number(r.revenue) > 0 ? roundMoney(r.revenue) : null,
      revenueReliable
    };
  });

  // Breakdowns from healthy in-range docs
  const byKind = new Map<string, number>();
  const byFulfillment = new Map<string, number>();
  const byStatus = new Map<string, number>();
  for (const o of breakdownDocs as any[]) {
    const kind = resolveBusinessOrderKind(o);
    byKind.set(kind, (byKind.get(kind) || 0) + 1);
    const ful = resolveFulfillment(o.customerDetails);
    byFulfillment.set(ful, (byFulfillment.get(ful) || 0) + 1);
    const st = String(o.status || 'unknown');
    byStatus.set(st, (byStatus.get(st) || 0) + 1);
  }

  // Upcoming items (next 7 days)
  const upcomingDocs = await Order.find({
    isTestOrder: { $ne: true },
    isDeleted: { $ne: true },
    status: { $ne: 'cancelled' },
    'customerDetails.eventDate': {
      $gte: upcomingWindow.fromKey,
      $lte: upcomingWindow.toKey,
      $regex: /^\d{4}-\d{2}-\d{2}$/
    }
  })
    .select(BUSINESS_REVIEW_SELECT)
    .sort({ 'customerDetails.eventDate': 1, createdAt: 1 })
    .limit(50)
    .lean();

  const tmKey = addJerusalemCalendarDays(todayKey, 1);

  const upcomingItems = (upcomingDocs as any[]).map((o) => {
    const eventDate = extractEventDate(o.customerDetails);
    let window: 'today' | 'tomorrow' | 'next7' = 'next7';
    if (eventDate === todayKey) window = 'today';
    else if (eventDate === tmKey) window = 'tomorrow';
    return {
      id: String(o._id),
      orderNumber: o.orderNumber ? String(o.orderNumber) : undefined,
      customerName: extractCustomerName(o.customerDetails) || undefined,
      eventDate,
      fulfillment: resolveFulfillment(o.customerDetails),
      status: String(o.status || ''),
      paymentStatus: o.paymentStatus ? String(o.paymentStatus) : undefined,
      totalPrice: Number(o.totalPrice) || 0,
      orderKind: resolveBusinessOrderKind(o),
      window
    };
  });

  return {
    generatedAt: now.toISOString(),
    range: {
      dateFrom: brRange.dateFrom.toISOString(),
      dateTo: brRange.dateTo.toISOString(),
      preset: brRange.preset,
      timezone: JERUSALEM_TZ,
      dateBasis: ACTUAL_REVENUE_DATE_BASIS
    },
    previousRange: prev
      ? { dateFrom: prev.dateFrom.toISOString(), dateTo: prev.dateTo.toISOString() }
      : null,
    kpis: {
      paidRevenue: {
        value: paidCur.revenue,
        previousValue: paidPrev.revenue,
        changePercent: changePercentRounded(paidCur.revenue, paidPrev.revenue),
        tooltipHe:
          'הכנסה שנגבתה (SSOT): paidAt|capturedAt|captured|isPaid, לא test. תאריך: effectivePaidAt. ארכיון וסטטוס תפעולי לא משפיעים.',
        dateBasis: ACTUAL_REVENUE_DATE_BASIS
      },
      paidOrders: {
        value: paidCur.paidCount,
        previousValue: paidPrev.paidCount,
        changePercent: changePercentRounded(paidCur.paidCount, paidPrev.paidCount),
        tooltipHe: 'מספר הזמנות שנגבו בפועל (אותה הגדרת SSOT כמו ב־/admin/payments ו־business-metrics).',
        dateBasis: ACTUAL_REVENUE_DATE_BASIS
      },
      ordersCreated: {
        value: ordersCreatedValue,
        previousValue: prevOrdersCreated,
        changePercent: changePercentRounded(ordersCreatedValue, prevOrdersCreated),
        cancelledCount,
        deletedExcluded: true as const,
        tooltipHe:
          'הזמנות שנוצרו בטווח (createdAt), ללא מחוקות. הערך הוא הזמנות שאינן מבוטלות; cancelledCount מדווח בנפרד.',
        dateBasis: 'createdAt' as const
      },
      averagePaidOrder: {
        value: avgPaid,
        previousValue: avgPaidPrev,
        changePercent: changePercentRounded(avgPaid, avgPaidPrev),
        tooltipHe: 'ממוצע לעסקה ששולמה (0 כשאין הזמנות ששולמו).'
      },
      returningCustomers: {
        value: returningCur.value,
        previousValue: returningPrevValue,
        changePercent: returningChange,
        methodHe: BUSINESS_REVIEW_NOTES.customerIdentityMethod,
        insufficientData: returningCur.insufficientData,
        tooltipHe:
          'לקוחות חוזרים: זהות עם הזמנה בריאה בטווח ולפחות 2 הזמנות בריאות בכל הזמן. ללא שם בלבד.'
      },
      upcomingOrders: {
        value: upcomingCount,
        windowDays: 7 as const,
        basisHe: 'eventDate next 7 days',
        tooltipHe: 'הזמנות פעילות עם מועד אספקה ב־7 הימים הקרובים (כולל היום).'
      },
      needsAttention: {
        value: needsAttention,
        tooltipHe: 'מספר הזמנות ייחודיות ברשימת ההתראות המאוחדת.'
      }
    },
    activitySeries: {
      granularity,
      points,
      previousPoints
    },
    alerts,
    upcoming: {
      window: 'next7' as const,
      items: upcomingItems
    },
    topDishes,
    returningCustomersList: returningList,
    breakdown: {
      byOrderKind: buildBreakdownRows(byKind, (k) => ORDER_KIND_LABEL_HE[k as keyof typeof ORDER_KIND_LABEL_HE] || k),
      byFulfillment: buildBreakdownRows(
        byFulfillment,
        (k) => FULFILLMENT_LABEL_HE[k as keyof typeof FULFILLMENT_LABEL_HE] || k
      ),
      byStatus: buildBreakdownRows(byStatus, (k) => STATUS_LABEL_HE_BR[k] || k)
    },
    notes: { ...BUSINESS_REVIEW_NOTES }
  };
}

export async function getDashboardOverview(query: DashboardOverviewQuery) {
  const range = resolveDashboardRange(query);
  const salesRange = resolveSalesRange(query);
  const { today: todayKey, tomorrow: tomorrowKey } = businessDayKeys(new Date(), range.timezone);

  const [
    metrics,
    alertItems,
    ordersByStatus,
    todayOrders,
    tomorrowOrders,
    upcomingPreparation,
    upcomingOrders,
    actionItems,
    topSellingByCategory,
    activeOrders,
    previousActiveOrders,
    businessReview
  ] = await Promise.all([
    getBusinessMetrics({
      preset: query.preset,
      from: query.from,
      to: query.to,
      timezone: query.timezone,
      orderKind: query.orderKind,
      status: query.status,
      paymentStatus: query.paymentStatus
    }),
    paymentAlertItems(20),
    groupByStatus(range.from, range.to),
    loadOrdersForEventDate(todayKey),
    loadOrdersForEventDate(tomorrowKey),
    buildUpcomingPreparation(todayKey),
    loadUpcomingOrders(todayKey, 8),
    buildActionItems(todayKey, tomorrowKey),
    topSellingByCategorySeries(salesRange.from, salesRange.to),
    countActiveInRange(range.from, range.to),
    countActiveInRange(previousRange(range).from, previousRange(range).to),
    buildBusinessReview(query)
  ]);

  // Legacy finance board must reuse admin-payments paid totals (via businessReview).
  alignPaidFinanceFromBusinessReview(metrics as any, businessReview as any);

  const todaySummary = buildDaySummaryFromOrders(todayKey, todayOrders as any[]);
  const tomorrowSummary = buildDaySummaryFromOrders(tomorrowKey, tomorrowOrders as any[]);
  const soldTopItems = (metrics.topItems || [])
    .map((i) => ({
      name: String(i?.name || '').trim(),
      quantity: Number(i?.quantity) || 0,
      revenue: Number(i?.revenue) || 0
    }))
    .filter((i) => i.name && i.quantity > 0);

  // Trend chart paid series from the same admin-payments definition as businessReview.
  const activityPoints = businessReview.activitySeries?.points || [];
  const trendWithAvg = withAverageOrderValue(
    activityPoints.map((p: { date: string; revenue: number; paidCount: number }) => ({
      period: p.date,
      revenue: Number(p.revenue) || 0,
      paidOrdersCount: Number(p.paidCount) || 0
    }))
  );

  const strongestTrendDay = [...trendWithAvg]
    .filter((p) => /^\d{4}-\d{2}-\d{2}$/.test(p.period))
    .sort((a, b) => b.paidOrdersCount - a.paidOrdersCount)[0] || null;

  const insights = buildDashboardInsights({
    awaitingPayments: metrics.paymentAlerts.awaiting,
    failedPayments: metrics.paymentAlerts.failed,
    tomorrow: tomorrowSummary,
    today: todaySummary,
    topSoldItem: soldTopItems[0]
      ? { name: soldTopItems[0].name, quantity: soldTopItems[0].quantity }
      : null,
    strongestTrendDay: strongestTrendDay
      ? { period: strongestTrendDay.period, paidOrdersCount: strongestTrendDay.paidOrdersCount }
      : null,
    revenueChangePercent: metrics.kpis.actualRevenue.changePercent,
    revenuePreviousSample: metrics.kpis.paidOrders.previousValue,
    actionItemTypes: actionItems.map((a) => a.type)
  });

  const kpis = {
    ...metrics.kpis,
    activeOrders: kpiTriple(activeOrders, previousActiveOrders)
  };
  const financialSummary = {
    ...metrics.financialSummary,
    zeroPriceOrders: metrics.alerts.zeroPriceOrders,
    zeroPriceWarning: metrics.alerts.zeroPriceWarning,
    expectedRevenue: metrics.financialSummary.expectedRevenue,
    externalInvoices: metrics.externalInvoices
  };

  assertDashboardPaidFinanceAreasConsistent({
    businessReview: businessReview as any,
    financialSummary: financialSummary as any,
    kpis: kpis as any
  });

  const brRangeOut = businessReview.range;
  const brPrev = businessReview.previousRange;

  return {
    range: {
      from: brRangeOut.dateFrom,
      to: brRangeOut.dateTo,
      timezone: brRangeOut.timezone,
      dateBasis: 'createdAt' as const,
      preset: brRangeOut.preset,
      previous: brPrev
        ? { from: brPrev.dateFrom, to: brPrev.dateTo }
        : metrics.range.previous
    },
    filters: metrics.filters,
    kpis,
    paymentAlerts: {
      awaiting: metrics.paymentAlerts.awaiting,
      failed: metrics.paymentAlerts.failed,
      items: alertItems
    },
    trend: trendWithAvg,
    ordersByStatus,
    ordersByType: metrics.ordersByType,
    topItems: soldTopItems,
    topSellingByCategory,
    actionItems,
    todaySummary,
    tomorrowSummary,
    upcomingPreparation,
    financialSummary,
    alerts: metrics.alerts,
    externalInvoices: metrics.externalInvoices,
    upcomingOrders,
    insights,
    insightsData: {
      todayKey,
      tomorrowKey,
      strongestTrendDay: strongestTrendDay
        ? { period: strongestTrendDay.period, paidOrdersCount: strongestTrendDay.paidOrdersCount }
        : null
    },
    businessReview,
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
