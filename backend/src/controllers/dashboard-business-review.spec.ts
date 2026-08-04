/**
 * Dashboard businessReview — util + route surface tests.
 * Paid definition must stay aligned with admin-payments.util.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import {
  averageTransactionAmount,
  buildPaidOrdersClause,
  isPaidOrder,
  previousPeriodRange,
  resolveDatePresetRange
} from '../utils/admin-payments.util';
import {
  assertPaidRevenueConsistency,
  alignPaidFinanceFromBusinessReview,
  assertDashboardPaidFinanceAreasConsistent,
  buildBusinessReviewPaidMatch,
  computeReturningCustomersList,
  customerReturningIdentity,
  isHealthyOrderForCustomerStats,
  mapOverviewPresetToBusinessReview,
  mergeBusinessReviewAlerts,
  resolveBusinessReviewRange,
  uniqueOrderIdsInAlerts
} from '../utils/dashboard-business-review.util';

test('businessReview paid match uses SSOT + effectivePaidAt range', () => {
  const from = new Date('2026-08-01T00:00:00+03:00');
  const to = new Date('2026-08-31T23:59:59.999+03:00');
  const match = buildBusinessReviewPaidMatch({ dateFrom: from, dateTo: to });
  const and = (match as any).$and as any[];
  assert.ok(Array.isArray(and));
  assert.ok(and.some((c) => c.isTestOrder?.$ne === true || c.isTestOrder === undefined));
  const base = and.find((c) => c.isTestOrder?.$ne === true);
  assert.ok(base);
  assert.equal('status' in (base || {}), false);
  assert.ok(and.some((c) => c.$expr));
  const clause = buildPaidOrdersClause() as any;
  assert.equal(clause.isTestOrder.$ne, true);
  assert.ok(Array.isArray(clause.$and));
});

test('paid matches isPaidOrder / buildPaidOrdersClause', () => {
  const samples = [
    { paymentStatus: 'captured', totalPrice: 100, customerDetails: {} },
    { paymentStatus: 'pending', totalPrice: 50, customerDetails: { isPaid: true } },
    { paymentStatus: 'authorized', totalPrice: 80, customerDetails: {} },
    { paymentStatus: 'failed', totalPrice: 20, customerDetails: {} }
  ];
  const paid = samples.filter((d) => isPaidOrder(d));
  assert.equal(paid.length, 2);
  assert.equal(averageTransactionAmount(150, 2), 75);
  const consistency = assertPaidRevenueConsistency(samples);
  assert.equal(consistency.paidSum, 150);
  assert.equal(consistency.paidCount, 2);
  assert.equal(consistency.clauseAligned, true);
});

test('averagePaidOrder is 0 when no paid', () => {
  assert.equal(averageTransactionAmount(0, 0), 0);
  assert.equal(averageTransactionAmount(100, 0), 0);
});

test('previous period length matches current duration', () => {
  const range = resolveDatePresetRange('last7', new Date('2026-08-03T12:00:00+03:00'));
  const prev = previousPeriodRange(range.dateFrom, range.dateTo);
  assert.ok(prev);
  const curMs = range.dateTo.getTime() - range.dateFrom.getTime();
  const prevMs = prev!.dateTo.getTime() - prev!.dateFrom.getTime();
  assert.equal(prevMs, curMs);
  assert.ok(prev!.dateTo.getTime() < range.dateFrom.getTime());
});

test('returning identity never name-only', () => {
  assert.equal(
    customerReturningIdentity({
      customerDetails: { fullName: 'יוסי בלבד' }
    }),
    null
  );
  assert.equal(
    customerReturningIdentity({
      userId: '507f1f77bcf86cd799439011',
      customerDetails: { fullName: 'יוסי' }
    }),
    'u:507f1f77bcf86cd799439011'
  );
  assert.equal(
    customerReturningIdentity({
      customerDetails: { phone: '050-123-4567', fullName: 'יוסי' }
    }),
    'p:0501234567'
  );
  assert.equal(
    customerReturningIdentity({
      customerDetails: { email: '  A@B.COM ', fullName: 'יוסי' }
    }),
    'e:a@b.com'
  );
});

test('cancelled/deleted excluded from returning customer stats', () => {
  assert.equal(isHealthyOrderForCustomerStats({ status: 'cancelled', customerDetails: {} }), false);
  assert.equal(isHealthyOrderForCustomerStats({ isDeleted: true, customerDetails: {} }), false);
  assert.equal(isHealthyOrderForCustomerStats({ isTestOrder: true, customerDetails: {} }), false);
  assert.equal(isHealthyOrderForCustomerStats({ status: 'confirmed', customerDetails: {} }), true);

  const orders = [
    {
      status: 'confirmed',
      customerDetails: { phone: '0501111111', fullName: 'A' },
      totalPrice: 10,
      paymentStatus: 'captured',
      createdAt: '2026-08-01T10:00:00.000Z'
    },
    {
      status: 'cancelled',
      customerDetails: { phone: '0501111111', fullName: 'A' },
      totalPrice: 10,
      paymentStatus: 'captured',
      createdAt: '2026-08-02T10:00:00.000Z'
    },
    {
      status: 'confirmed',
      isDeleted: true,
      customerDetails: { phone: '0501111111', fullName: 'A' },
      totalPrice: 10,
      paymentStatus: 'captured',
      createdAt: '2026-08-03T10:00:00.000Z'
    }
  ];
  const list = computeReturningCustomersList(orders, {});
  // Only one healthy in-range → not returning without lifetime map
  assert.equal(list.length, 0);

  const withLifetime = computeReturningCustomersList(orders, {
    lifetimeHealthyCountByKey: new Map([['p:0501111111', 3]])
  });
  assert.equal(withLifetime.length, 1);
  assert.ok(withLifetime[0].identityKeyHash);
  assert.equal(withLifetime[0].identityKeyHash.length, 16);
});

test('archive never appears in dashboard attention alerts (manual/phone close)', () => {
  const archived = {
    _id: 'ord1',
    orderNumber: 'MG-1',
    paymentStatus: 'awaiting_payment',
    status: 'processing',
    totalPrice: 200,
    isDeleted: true,
    createdAt: new Date('2026-06-01'),
    customerDetails: { fullName: 'דני', phone: '0501234567', eventDate: '2026-08-14' }
  };
  const alerts = mergeBusinessReviewAlerts([archived], { max: 30 });
  assert.equal(alerts.length, 0);
});

test('payment alerts only for failed/abandoned tab — not stale awaiting outside that tab', () => {
  const now = new Date('2026-08-04T12:00:00.000Z');
  const notOnFailedTab = {
    _id: 'ord2',
    orderNumber: 'MG-319923',
    paymentStatus: 'awaiting_payment',
    status: 'processing',
    totalPrice: 1982,
    isDeleted: false,
    // no paymentAwaitingStartedAt ⇒ not on failed tab
    createdAt: new Date('2026-08-01T10:00:00.000Z'),
    customerDetails: { fullName: 'גיא', phone: '0509999999', eventDate: '2026-08-14' }
  };
  const onFailedTab = {
    _id: 'ord3',
    orderNumber: 'MG-FAIL',
    paymentStatus: 'awaiting_payment',
    status: 'pending',
    totalPrice: 100,
    isDeleted: false,
    paymentAwaitingStartedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
    createdAt: new Date(now.getTime() - 3 * 60 * 60 * 1000),
    customerDetails: { fullName: 'לקוח', phone: '0501111111' }
  };
  const alerts = mergeBusinessReviewAlerts([notOnFailedTab, onFailedTab], { now, max: 30 });
  assert.equal(
    alerts.some((a) => a.orderNumber === 'MG-319923' && (a.type === 'awaiting_abandoned' || a.type === 'stale_pending')),
    false
  );
  assert.ok(alerts.some((a) => a.orderNumber === 'MG-FAIL' && a.type === 'awaiting_abandoned'));
  assert.equal(
    alerts.some((a) => a.type === 'unknown_order_status' && a.orderNumber === 'MG-319923'),
    false
  );
});

test('processing is a known ops status — no unknown_order_status alert', () => {
  const doc = {
    _id: 'ord4',
    orderNumber: 'MG-P',
    paymentStatus: 'captured',
    status: 'processing',
    isDeleted: false,
    createdAt: new Date('2026-08-01'),
    customerDetails: { fullName: 'א', phone: '0502222222' }
  };
  const alerts = mergeBusinessReviewAlerts([doc], { max: 30 });
  assert.equal(alerts.some((a) => a.type === 'unknown_order_status'), false);
});

test('preset mapping: month/week → this_month/last7; admin presets pass through', () => {
  assert.equal(mapOverviewPresetToBusinessReview('month').preset, 'this_month');
  assert.equal(mapOverviewPresetToBusinessReview('week').preset, 'last7');
  assert.equal(mapOverviewPresetToBusinessReview('last7').preset, 'last7');
  assert.equal(mapOverviewPresetToBusinessReview('this_month').preset, 'this_month');
  assert.equal(mapOverviewPresetToBusinessReview('last30').preset, 'last30');
  const custom = mapOverviewPresetToBusinessReview(undefined, '2026-01-01', '2026-01-31');
  assert.equal(custom.preset, 'custom');
  const range = resolveBusinessReviewRange({ preset: 'week' });
  assert.equal(range.preset, 'last7');
  assert.equal(range.timezone, 'Asia/Jerusalem');
  assert.equal(range.dateBasis, 'effectivePaidAt');
});

test('consistency: sample docs paid revenue equals isPaidOrder sum', () => {
  const docs = [
    { paymentStatus: 'captured', totalPrice: 120.5, customerDetails: {}, isDeleted: true },
    { paymentStatus: 'pending', totalPrice: 30, customerDetails: { isPaid: true } },
    { paymentStatus: 'pending', totalPrice: 99, customerDetails: {} },
    { paymentStatus: 'captured', totalPrice: 10, customerDetails: { isPaid: true } }
  ];
  const { paidSum, paidCount, clauseAligned } = assertPaidRevenueConsistency(docs);
  assert.equal(paidCount, 3);
  assert.equal(paidSum, 160.5);
  assert.equal(clauseAligned, true);
  const viaFilter = docs.filter(isPaidOrder).reduce((s, d) => s + Number(d.totalPrice), 0);
  assert.equal(viaFilter, paidSum);
});

test('GET route still only GET for dashboard-overview', () => {
  const candidates = [
    join(process.cwd(), 'src/routes/order.routes.ts'),
    join(__dirname, '../routes/order.routes.ts')
  ];
  let src = '';
  for (const p of candidates) {
    try {
      src = readFileSync(p, 'utf8');
      break;
    } catch {
      /* next */
    }
  }
  assert.ok(src.includes("'/dashboard-overview'"));
  assert.ok(/router\.get\(\s*'\s*\/dashboard-overview'/.test(src));
  assert.equal(/router\.(post|put|patch|delete)\(\s*'\s*\/dashboard-overview'/.test(src), false);

  const svcSrc = readFileSync(join(__dirname, '../services/dashboard-overview.service.ts'), 'utf8');
  assert.ok(svcSrc.includes('businessReview'));
  assert.ok(svcSrc.includes('buildBusinessReview'));
  assert.ok(svcSrc.includes('buildBusinessReviewPaidMatch'));
  // No Tranzila / payment.controller coupling in new path
  assert.equal(svcSrc.includes('tranzila.service'), false);
  assert.equal(svcSrc.includes('payment.controller'), false);
});

test('overview service keeps existing fields and adds businessReview', () => {
  const svcSrc = readFileSync(join(__dirname, '../services/dashboard-overview.service.ts'), 'utf8');
  for (const field of [
    'todaySummary',
    'actionItems',
    'paymentAlerts',
    'financialSummary',
    'trend',
    'businessReview'
  ]) {
    assert.ok(svcSrc.includes(field), `missing ${field}`);
  }
  assert.ok(svcSrc.includes('alignPaidFinanceFromBusinessReview'));
  assert.ok(svcSrc.includes('assertDashboardPaidFinanceAreasConsistent'));
});

test('alignPaidFinanceFromBusinessReview makes finance board match businessReview paid KPIs', () => {
  const businessReview = {
    kpis: {
      paidRevenue: { value: 1250.5, previousValue: 1000, changePercent: 25 },
      paidOrders: { value: 5, previousValue: 4, changePercent: 25 },
      averagePaidOrder: { value: 250.1, previousValue: 250, changePercent: 0.04 }
    }
  };
  const metrics = {
    kpis: {
      actualRevenue: { value: 999, previousValue: 1, changePercent: 0 },
      capturedRevenue: { value: 999, previousValue: 1, changePercent: 0 },
      paidOrders: { value: 1, previousValue: 1, changePercent: 0 },
      averageOrderValue: { value: 1, previousValue: 1, changePercent: 0 }
    },
    financialSummary: {
      actualRevenue: 999,
      capturedRevenue: 999,
      paidOrders: 1,
      averageOrderValue: 1
    }
  };
  alignPaidFinanceFromBusinessReview(metrics, businessReview);
  assertDashboardPaidFinanceAreasConsistent({
    businessReview,
    financialSummary: metrics.financialSummary as any,
    kpis: metrics.kpis as any
  });
  assert.equal(metrics.financialSummary.actualRevenue, 1250.5);
  assert.equal(metrics.financialSummary.paidOrders, 5);
  assert.equal(metrics.financialSummary.averageOrderValue, 250.1);
});

test('assertDashboardPaidFinanceAreasConsistent fails when finance board diverges', () => {
  assert.throws(
    () =>
      assertDashboardPaidFinanceAreasConsistent({
        businessReview: {
          kpis: {
            paidRevenue: { value: 100 },
            paidOrders: { value: 2 },
            averagePaidOrder: { value: 50 }
          }
        },
        financialSummary: {
          actualRevenue: 90,
          paidOrders: 2,
          averageOrderValue: 50
        },
        kpis: {
          actualRevenue: { value: 100 },
          paidOrders: { value: 2 },
          averageOrderValue: { value: 50 }
        }
      }),
    /inconsistent/
  );
});
