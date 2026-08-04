import Order from '../models/Order';
import {
  extractCustomerName,
  extractCustomerPhone,
  resolveFulfillment
} from '../utils/dashboard-ops.util';
import {
  AdminPaymentsListFilters,
  CsvPaymentRow,
  FUNNEL_LABEL_HE,
  FunnelBucket,
  JERUSALEM_TZ,
  PAYMENTS_MISSING_FIELDS_NOTE,
  PAYMENTS_NOT_SHOWN_NOTE,
  averageTransactionAmount,
  buildActualRevenueInRangeMatch,
  buildActualRevenueMatch,
  buildPaymentTimeline,
  buildPaymentsCsv,
  buildPaymentsMatch,
  evaluatePaymentExceptions,
  exceptionSeverityTone,
  filterRowsByExceptionSeverity,
  getCustomerDetails,
  hasActiveCaptureLock,
  mapOrderToPaymentRow,
  parseListQuery,
  percentOf,
  previousPeriodRange,
  roundMoney,
  toJerusalemDateKey,
  ACTUAL_REVENUE_DATE_BASIS
} from '../utils/admin-payments.util';
import {
  effectivePaidAtMongoExpr,
  revenueAmountMongoExpr
} from '../utils/order-actual-revenue.util';
import { listPaymentHistoryForOrder } from './payment-audit.service';

export { parseListQuery as parseAdminPaymentsQuery, buildPaymentsCsv as buildAdminPaymentsCsv };

const LIST_SELECT =
  '_id orderNumber orderType status paymentStatus totalPrice adminPriceOverride transactionId createdAt updatedAt confirmationEmailSentAt customerDetails authorizedAmount isDeleted paidAt capturedAt captureLockId paymentExceptionResolvedAt';

const DETAIL_SELECT = `${LIST_SELECT} items subtotal deliveryFee cateringKind eventType guestCount venue mealTime mealTypes adminNotes numberOfPortions`;

/**
 * Revenue KPI scope: SSOT paid definition + effectivePaidAt range.
 * Operational list filters (orderType / fulfillment) may narrow; createdAt list dates are NOT used.
 */
function buildPaidRevenueMatch(filters: AdminPaymentsListFilters): Record<string, unknown> {
  const base =
    filters.dateFrom && filters.dateTo
      ? buildActualRevenueInRangeMatch(filters.dateFrom, filters.dateTo)
      : buildActualRevenueMatch();
  const and: Record<string, unknown>[] = [base];
  if (filters.orderType === 'shabbat' || filters.orderType === 'catering') {
    and.push({ orderType: filters.orderType });
  }
  if (filters.fulfillment === 'delivery' || filters.fulfillment === 'pickup') {
    and.push({
      $or: [
        { 'customerDetails.deliveryType': filters.fulfillment },
        { 'customerDetails.deliveryMethod': filters.fulfillment }
      ]
    });
  }
  return and.length === 1 ? base : { $and: and };
}

const LOCK_SELECT = '+captureLockId +captureStartedAt';

const FUNNEL_STAGES: FunnelBucket[] = [
  'all',
  'paid',
  'pending',
  'failed_cancelled',
  'exceptions'
];

/** Overview cards ignore status / funnel / exception / pagination filters. */
function overviewScope(filters: AdminPaymentsListFilters): AdminPaymentsListFilters {
  const scope: AdminPaymentsListFilters = { ...filters };
  delete scope.paymentStatus;
  delete scope.funnelBucket;
  delete scope.exceptionFilter;
  delete scope.exceptionsOnly;
  delete scope.page;
  delete scope.limit;
  delete scope.sortBy;
  delete scope.sortDir;
  return scope;
}

function needsExceptionRefine(filters: AdminPaymentsListFilters): boolean {
  return (
    filters.funnelBucket === 'exceptions' ||
    filters.exceptionsOnly === true ||
    (filters.exceptionFilter != null && filters.exceptionFilter !== 'all')
  );
}

async function paidAggregate(match: Record<string, unknown>) {
  const rows = await Order.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        count: { $sum: 1 },
        amount: { $sum: revenueAmountMongoExpr() },
        deletedCount: {
          $sum: { $cond: [{ $eq: ['$isDeleted', true] }, 1, 0] }
        }
      }
    }
  ]);
  const row = rows[0];
  return {
    count: Number(row?.count) || 0,
    amount: roundMoney(row?.amount),
    deletedCount: Number(row?.deletedCount) || 0
  };
}

async function dailyPaidSeries(
  match: Record<string, unknown>
): Promise<Array<{ date: string; amount: number; count: number }>> {
  const rows = await Order.aggregate([
    { $match: match },
    {
      $group: {
        _id: {
          $dateToString: {
            format: '%Y-%m-%d',
            date: effectivePaidAtMongoExpr(),
            timezone: JERUSALEM_TZ
          }
        },
        amount: { $sum: revenueAmountMongoExpr() },
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]);
  return rows.map((r) => ({
    date: String(r._id),
    amount: roundMoney(r.amount),
    count: Number(r.count) || 0
  }));
}

function revenueChangePercent(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function rangeHintDays(dateFrom?: Date, dateTo?: Date): number | null {
  if (!dateFrom || !dateTo) return null;
  const ms = dateTo.getTime() - dateFrom.getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

export function buildExportFilename(filters: AdminPaymentsListFilters): string {
  const from = filters.dateFrom ? toJerusalemDateKey(filters.dateFrom) : 'all';
  const to = filters.dateTo ? toJerusalemDateKey(filters.dateTo) : 'all';
  return `payments-${from}-to-${to}.csv`;
}

export async function getAdminPaymentsSummary(filters: AdminPaymentsListFilters) {
  const scope = overviewScope(filters);
  const match = buildPaymentsMatch(scope);
  const paidRevenueMatch = buildPaidRevenueMatch(scope);
  const now = new Date();

  const exMatch = buildPaymentsMatch({ ...scope, funnelBucket: 'exceptions' }, now);
  const exceptionDocs = await Order.find(exMatch)
    .select(LIST_SELECT)
    .select(LOCK_SELECT)
    .limit(2000)
    .lean();

  const [
    byStatus,
    manualReviewCount,
    capturedStats,
    paid,
    totalTransactions
  ] = await Promise.all([
    Order.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$paymentStatus',
          count: { $sum: 1 },
          amount: { $sum: { $ifNull: ['$totalPrice', 0] } }
        }
      }
    ]),
    Order.countDocuments({
      $and: [match, { captureLockId: { $type: 'string', $ne: '' } }]
    }),
    Order.aggregate([
      { $match: { $and: [match, { paymentStatus: 'captured' }] } },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          amount: { $sum: { $ifNull: ['$totalPrice', 0] } }
        }
      }
    ]),
    paidAggregate(paidRevenueMatch),
    Order.countDocuments(match)
  ]);

  const statusMap = new Map<string, { count: number; amount: number }>();
  for (const row of byStatus) {
    statusMap.set(String(row._id || 'pending'), {
      count: Number(row.count) || 0,
      amount: roundMoney(row.amount)
    });
  }
  const bucket = (status: string) => statusMap.get(status) || { count: 0, amount: 0 };

  const captured = capturedStats[0]
    ? {
        count: Number(capturedStats[0].count) || 0,
        amount: roundMoney(capturedStats[0].amount)
      }
    : { count: 0, amount: 0 };

  let criticalCount = 0;
  let warningCount = 0;
  let infoCount = 0;
  const allExceptions = [];
  let exceptionRowCount = 0;
  for (const doc of exceptionDocs) {
    const raw = doc as unknown as Record<string, unknown>;
    const exs = evaluatePaymentExceptions(raw, now);
    if (!exs.length) continue;
    exceptionRowCount += 1;
    allExceptions.push(...exs);
    const sev = exs[0].severity;
    if (sev === 'critical') criticalCount += 1;
    else if (sev === 'warning') warningCount += 1;
    else infoCount += 1;
  }

  let previousPeriod: {
    dateFrom: string;
    dateTo: string;
    paid: { count: number; amount: number };
  } | null = null;
  let changePercent: number | null = null;

  if (scope.dateFrom && scope.dateTo) {
    const prev = previousPeriodRange(scope.dateFrom, scope.dateTo);
    if (prev) {
      const prevMatch = buildPaidRevenueMatch({
        ...scope,
        dateFrom: prev.dateFrom,
        dateTo: prev.dateTo
      });
      const prevPaid = await paidAggregate(prevMatch);
      previousPeriod = {
        dateFrom: prev.dateFrom.toISOString(),
        dateTo: prev.dateTo.toISOString(),
        paid: { count: prevPaid.count, amount: prevPaid.amount }
      };
      changePercent = revenueChangePercent(paid.amount, prevPaid.amount);
    }
  }

  return {
    generatedAt: now.toISOString(),
    range: {
      dateFrom: scope.dateFrom ? scope.dateFrom.toISOString() : null,
      dateTo: scope.dateTo ? scope.dateTo.toISOString() : null
    },
    totalReceived: paid.amount,
    paid,
    captured,
    authorized: bucket('authorized'),
    awaitingPayment: {
      count: bucket('awaiting_payment').count,
      amount: bucket('awaiting_payment').amount
    },
    failed: { count: bucket('failed').count },
    voided: { count: bucket('voided').count },
    pending: { count: bucket('pending').count },
    manualReview: { count: manualReviewCount },
    exceptions: {
      count: exceptionRowCount,
      tone: exceptionSeverityTone(allExceptions),
      criticalCount,
      warningCount,
      infoCount
    },
    averageTransactionAmount: averageTransactionAmount(paid.amount, paid.count),
    totalTransactions,
    previousPeriod,
    revenueChangePercent: changePercent,
    missingFields: PAYMENTS_MISSING_FIELDS_NOTE,
    notShown: PAYMENTS_NOT_SHOWN_NOTE,
    notes: {
      paymentAt:
        'effectivePaidAt = paidAt ?? capturedAt ?? createdAt (legacy). תצוגת שורה עדיין יכולה להציג confirmationEmailSentAt/updatedAt',
      refunded: 'סטטוס refunded אינו קיים במודל Order — לא מוצג בסיכום',
      paymentMethod: 'אמצעי תשלום מנוחש מ־transactionId / customerDetails.isPaid',
      paid:
        'הכנסה שנגבתה (SSOT): לא test + הוכחת תשלום (paidAt|capturedAt|captured|isPaid) + adminPriceOverride??totalPrice. ארכיון ו־status תפעולי לא משפיעים.',
      deletedScope:
        'הכנסה כוללת הזמנות מחוקות; סינון רשימה תפעולית נשאר לפי includeDeletedPayments',
      exceptions: 'חריגות מחושבות לתצוגה בלבד ממסננות מקורבות ב־Mongo ואז מזוקקות ב־JS',
      dateBasis: `סינון וסדרות הכנסה לפי ${ACTUAL_REVENUE_DATE_BASIS}; רשימות תפעוליות לפי createdAt (Asia/Jerusalem)`
    }
  };
}

export async function getAdminPaymentsFunnel(filters: AdminPaymentsListFilters) {
  const scope = overviewScope(filters);
  const now = new Date();
  const baseMatch = buildPaymentsMatch(scope, now);

  const stages = [];
  let allCount = 0;
  let allAmount = 0;

  for (const key of FUNNEL_STAGES) {
    if (key === 'all') {
      const rows = await Order.aggregate([
        { $match: baseMatch },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            amount: { $sum: { $ifNull: ['$totalPrice', 0] } }
          }
        }
      ]);
      allCount = Number(rows[0]?.count) || 0;
      allAmount = roundMoney(rows[0]?.amount);
      stages.push({
        key,
        labelHe: FUNNEL_LABEL_HE[key],
        count: allCount,
        amount: allAmount,
        percent: 100
      });
      continue;
    }

    if (key === 'exceptions') {
      const exMatch = buildPaymentsMatch({ ...scope, funnelBucket: 'exceptions' }, now);
      const docs = await Order.find(exMatch)
        .select(LIST_SELECT)
        .select(LOCK_SELECT)
        .limit(2000)
        .lean();
      let count = 0;
      let amount = 0;
      for (const doc of docs) {
        const raw = doc as unknown as Record<string, unknown>;
        const exs = evaluatePaymentExceptions(raw, now);
        if (!exs.length) continue;
        count += 1;
        amount += Number(raw.totalPrice) || 0;
      }
      amount = roundMoney(amount);
      stages.push({
        key,
        labelHe: FUNNEL_LABEL_HE[key],
        count,
        amount,
        percent: percentOf(count, allCount)
      });
      continue;
    }

    const match = buildPaymentsMatch({ ...scope, funnelBucket: key }, now);
    const rows = await Order.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          amount: { $sum: { $ifNull: ['$totalPrice', 0] } }
        }
      }
    ]);
    const count = Number(rows[0]?.count) || 0;
    const amount = roundMoney(rows[0]?.amount);
    stages.push({
      key,
      labelHe: FUNNEL_LABEL_HE[key],
      count,
      amount,
      percent: percentOf(count, allCount)
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    range: {
      dateFrom: scope.dateFrom ? scope.dateFrom.toISOString() : null,
      dateTo: scope.dateTo ? scope.dateTo.toISOString() : null
    },
    stages,
    notes: {
      paid: 'שולם להכנסה = SSOT (paidAt|capturedAt|captured|isPaid, לא test)',
      exceptions: 'דלי חריגות מזוקק ב־JS אחרי שאילתה מקורבת'
    }
  };
}

export async function getAdminPaymentsRevenueSeries(filters: AdminPaymentsListFilters) {
  const scope = overviewScope(filters);
  const match = buildPaidRevenueMatch(scope);
  const points = await dailyPaidSeries(match);

  let previousPoints: Array<{ date: string; amount: number; count: number }> | null = null;
  if (scope.dateFrom && scope.dateTo) {
    const prev = previousPeriodRange(scope.dateFrom, scope.dateTo);
    if (prev) {
      const prevMatch = buildPaidRevenueMatch({
        ...scope,
        dateFrom: prev.dateFrom,
        dateTo: prev.dateTo
      });
      previousPoints = await dailyPaidSeries(prevMatch);
    }
  }

  const days = rangeHintDays(scope.dateFrom, scope.dateTo);
  const granularity: 'day' | 'week' = days != null && days > 45 ? 'week' : 'day';

  return {
    generatedAt: new Date().toISOString(),
    range: {
      dateFrom: scope.dateFrom ? scope.dateFrom.toISOString() : null,
      dateTo: scope.dateTo ? scope.dateTo.toISOString() : null
    },
    granularity,
    timezone: JERUSALEM_TZ,
    points,
    previousPoints,
    notes: {
      dateBasis: `סדרת ההכנסה מקובצת לפי ${ACTUAL_REVENUE_DATE_BASIS} (Asia/Jerusalem)`,
      paid: 'נקודות כוללות רק הזמנות שעומדות בהגדרת הכנסה שנגבתה (SSOT)'
    }
  };
}

export async function listAdminPaymentExceptions(filters: AdminPaymentsListFilters) {
  const now = new Date();
  const scope = overviewScope(filters);
  const exMatch = buildPaymentsMatch({ ...scope, funnelBucket: 'exceptions' }, now);
  const docs = await Order.find(exMatch)
    .select(LIST_SELECT)
    .select(LOCK_SELECT)
    .sort({ createdAt: -1 })
    .limit(2000)
    .lean();

  let rows = docs
    .map((d) => mapOrderToPaymentRow(d as unknown as Record<string, unknown>, now))
    .filter((r) => r.hasException);

  const severity = filters.exceptionFilter || 'all';
  rows = filterRowsByExceptionSeverity(rows, severity);
  rows = rows.slice(0, 200).map((r) => ({
    ...r,
    canCapture: false,
    canVoid: false,
    canRefund: false
  }));

  return {
    data: rows,
    meta: {
      total: rows.length,
      limit: 200,
      refinedFrom: docs.length
    }
  };
}

export async function listAdminPayments(filters: AdminPaymentsListFilters) {
  const page = filters.page || 1;
  const limit = filters.limit || 25;
  const sortField = filters.sortBy || 'createdAt';
  const sortDir: 1 | -1 = filters.sortDir === 'asc' ? 1 : -1;
  const now = new Date();
  const match = buildPaymentsMatch(filters, now);

  if (needsExceptionRefine(filters)) {
    const docs = await Order.find(match)
      .select(LIST_SELECT)
      .select(LOCK_SELECT)
      .sort({ [sortField]: sortDir })
      .limit(2000)
      .lean();

    let rows = docs.map((d) =>
      mapOrderToPaymentRow(d as unknown as Record<string, unknown>, now)
    );

    if (filters.funnelBucket === 'exceptions' || filters.exceptionsOnly) {
      rows = rows.filter((r) => r.hasException);
    }
    if (filters.exceptionFilter && filters.exceptionFilter !== 'all') {
      rows = filterRowsByExceptionSeverity(rows, filters.exceptionFilter);
    }

    const total = rows.length;
    const start = (page - 1) * limit;
    const data = rows.slice(start, start + limit).map((r) => ({
      ...r,
      canCapture: false,
      canVoid: false,
      canRefund: false
    }));

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit) || 1)
      }
    };
  }

  const [total, docs] = await Promise.all([
    Order.countDocuments(match),
    Order.find(match)
      .select(LIST_SELECT)
      .select(LOCK_SELECT)
      .sort({ [sortField]: sortDir })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean()
  ]);

  const data = docs.map((d) => {
    const row = mapOrderToPaymentRow(d as unknown as Record<string, unknown>, now);
    return { ...row, canCapture: false, canVoid: false, canRefund: false };
  });

  return {
    data,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit) || 1)
    }
  };
}

export async function getAdminPaymentDetail(orderId: string) {
  const doc = await Order.findById(orderId)
    .select(DETAIL_SELECT)
    .select(LOCK_SELECT)
    .lean();

  if (!doc) return null;

  const raw = doc as unknown as Record<string, unknown>;
  const now = new Date();
  const row = mapOrderToPaymentRow(raw, now);
  const exceptions = evaluatePaymentExceptions(raw, now);
  const details = getCustomerDetails(raw);

  const safeCustomer = {
    fullName: extractCustomerName(details) || 'לקוח',
    phone: extractCustomerPhone(details),
    email: details.email ? String(details.email) : null,
    address: details.address ? String(details.address) : null,
    deliveryType: resolveFulfillment(details),
    notes: details.notes ? String(details.notes) : null,
    eventDate: details.eventDate ? String(details.eventDate) : null
  };

  const safeItems = Array.isArray(raw.items)
    ? (raw.items as Array<Record<string, unknown>>).map((item) => ({
        name: String(item.name || ''),
        quantity: Number(item.quantity) || 0,
        price: roundMoney(Number(item.price) || 0),
        category: item.category ? String(item.category) : undefined
      }))
    : [];

  const paymentHistory = await listPaymentHistoryForOrder(String(orderId));
  const timeline = buildPaymentTimeline(raw);

  return {
    ...row,
    canCapture: false,
    canVoid: false,
    canRefund: false,
    exceptions,
    operationalStatus: raw.status ? String(raw.status) : null,
    authorizedAmount:
      raw.authorizedAmount != null ? roundMoney(Number(raw.authorizedAmount)) : null,
    subtotal: raw.subtotal != null ? roundMoney(Number(raw.subtotal)) : null,
    deliveryFee: raw.deliveryFee != null ? roundMoney(Number(raw.deliveryFee)) : null,
    cateringKind: raw.cateringKind ? String(raw.cateringKind) : null,
    eventType: raw.eventType ? String(raw.eventType) : null,
    guestCount: raw.guestCount != null ? Number(raw.guestCount) : null,
    venue: raw.venue ? String(raw.venue) : null,
    mealTime: raw.mealTime ? String(raw.mealTime) : null,
    mealTypes: Array.isArray(raw.mealTypes) ? raw.mealTypes.map(String) : null,
    adminNotes: raw.adminNotes ? String(raw.adminNotes) : null,
    numberOfPortions: raw.numberOfPortions != null ? Number(raw.numberOfPortions) : null,
    customer: safeCustomer,
    items: safeItems,
    paymentHistory,
    timeline,
    historySource: paymentHistory.length > 0 ? 'audit' : 'fallback_timeline',
    hasCaptureLock: hasActiveCaptureLock(raw),
    orderAdminPath: '/admin/orders'
  };
}

export async function exportAdminPaymentsCsv(filters: AdminPaymentsListFilters): Promise<string> {
  const now = new Date();
  // Full accounting dump for the selected range: archived/past included, no funnel narrowing.
  const exportFilters: AdminPaymentsListFilters = {
    ...filters,
    forExport: true,
    includeDeletedPayments: true,
    dateBasis: 'activity',
    funnelBucket: 'all',
    exceptionFilter: 'all',
    exceptionsOnly: false,
    search: undefined,
    paymentStatus: undefined
  };
  const match = buildPaymentsMatch(exportFilters, now);
  const sortField = exportFilters.sortBy || 'createdAt';
  const sortDir = exportFilters.sortDir === 'asc' ? 1 : -1;

  const docs = await Order.find(match)
    .select(LIST_SELECT)
    .select(LOCK_SELECT)
    .sort({ [sortField]: sortDir })
    .limit(10000)
    .lean();

  const mapped: CsvPaymentRow[] = docs.map((d) => {
    const raw = d as unknown as Record<string, unknown>;
    const row = mapOrderToPaymentRow(raw, now);
    const details = getCustomerDetails(raw);
    return {
      ...row,
      customerEmail: details.email ? String(details.email) : null,
      canCapture: false,
      canVoid: false,
      canRefund: false
    };
  });

  return buildPaymentsCsv(mapped);
}
