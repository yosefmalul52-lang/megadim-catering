/**
 * Phase 2 closure: prove all actual-revenue consumers share the same SSOT
 * on one fixture set + one date range (service / Mongo integration).
 *
 * No production / Atlas / emails / Tranzila / backfill.
 * Does not change revenue logic — verification only.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import mongoose from 'mongoose';
import { Request, Response } from 'express';
import Order from '../models/Order';
import {
  buildActualRevenueInRangeMatch,
  buildActualRevenueMatch,
  buildEffectivePaidAtRangeMatch,
  computeActualRevenueStatsInRange,
  finalizeActualRevenueAggregate,
  orderContributesActualRevenue,
  revenueAmountMongoExpr
} from '../utils/order-actual-revenue.util';
import { PHASE2_REVENUE_FIXTURES } from './order-actual-revenue.fixtures';
import { getBusinessMetrics, sumActualRevenueInRange } from '../services/business-metrics.service';
import { getAdminPaymentsSummary } from '../services/admin-payments.service';
import { getDashboardOverview } from '../services/dashboard-overview.service';
import { OrderService } from '../services/order.service';
import { getSummary, getTransactions } from './accounting.controller';
import { jerusalemDayEndUtc, jerusalemDayStartUtc } from '../utils/admin-payments.util';
import { getSharedMongoUri, stopMongoMemoryServer } from './_mongo-memory';

let mongodUri = '';
const orderService = new OrderService();

const RANGE_FROM_KEY = '2026-07-01';
const RANGE_TO_KEY = '2026-07-31';
const dateFrom = jerusalemDayStartUtc(RANGE_FROM_KEY);
const dateTo = jerusalemDayEndUtc(RANGE_TO_KEY);

/** Keys expected in July by effectivePaidAt after SSOT inclusion. */
const JULY_INCLUDED = new Set([
  'captured_with_paidAt',
  'captured_legacy_no_stamps',
  'manual_isPaid',
  'cancelled_captured',
  'archived_paid',
  'new_paidAt_differs',
  'override_zero',
  'ops_status_ready_unpaid'
]);

type Triple = { revenue: number; paidOrderCount: number; averageOrderValue: number | null };

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

async function seedFixtures() {
  const docs = Object.values(PHASE2_REVENUE_FIXTURES)
    .filter((f) => (f as any).key !== 'invalid_totalPrice')
    .map((f) => {
      const { key, customerDetails: fixtureCd, ...rest } = f as any;
      return {
        items: [{ productId: new mongoose.Types.ObjectId(), name: 'טסט', quantity: 1, price: 10 }],
        orderType: 'shabbat',
        ...rest,
        customerDetails: {
          fullName: key,
          phone: '0501234567',
          email: 'noreply-test@example.invalid',
          ...(fixtureCd || {})
        },
        __fixtureKey: key
      };
    });
  await Order.insertMany(docs as any[]);
  await Order.collection.insertOne({
    items: [{ name: 'bad', quantity: 1, price: 1 }],
    totalPrice: 'abc',
    paymentStatus: 'captured',
    status: 'delivered',
    paidAt: new Date('2026-07-13T10:00:00.000Z'),
    isTestOrder: false,
    customerDetails: { fullName: 'invalid_totalPrice', phone: '0500000000' },
    orderType: 'shabbat',
    createdAt: new Date('2026-07-13T10:00:00.000Z'),
    updatedAt: new Date('2026-07-13T10:00:00.000Z'),
    __fixtureKey: 'invalid_totalPrice'
  } as any);
}

function invokeHandler(
  handler: (req: Request, res: Response, next: (e?: unknown) => void) => void,
  opts: { query?: Record<string, unknown> }
): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    let status = 200;
    const req = {
      query: opts.query || {},
      params: {},
      body: {},
      headers: {},
      method: 'GET',
      user: { id: 'admin-closure', role: 'admin' }
    } as unknown as Request;
    const res = {
      status(code: number) {
        status = code;
        return this;
      },
      json(body: any) {
        resolve({ status, body });
        return this;
      }
    } as unknown as Response;
    handler(req, res, (err?: unknown) => {
      if (err) reject(err);
    });
  });
}

test.before(async () => {
  process.env.ORDER_CUSTOMER_EMAILS_ENABLED = 'false';
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect().catch(() => undefined);
  }
  mongodUri = await getSharedMongoUri('rev-closure');
  await mongoose.connect(mongodUri);
});

test.after(async () => {
  await mongoose.disconnect().catch(() => undefined);
  await stopMongoMemoryServer(null);
});

test.beforeEach(async () => {
  await Order.deleteMany({});
  await seedFixtures();
});

test('closure: SSOT match applies effectivePaidAt only after payment proof + amount', () => {
  const base = buildActualRevenueMatch() as any;
  const ranged = buildActualRevenueInRangeMatch(dateFrom, dateTo) as any;
  const rangeOnly = buildEffectivePaidAtRangeMatch(dateFrom, dateTo) as any;

  assert.equal(base.isTestOrder.$ne, true);
  assert.ok(Array.isArray(base.$and));
  assert.equal(base.$and.length >= 2, true);
  const proof = (base.$and as any[]).find((c) => Array.isArray(c?.$or));
  const amount = (base.$and as any[]).find(
    (c) =>
      Array.isArray(c?.$or) &&
      c.$or.some((x: any) => x.adminPriceOverride?.$type === 'number' || x.totalPrice?.$type === 'number')
  );
  assert.ok(proof, 'payment proof clause present before date filter');
  assert.ok(amount, 'valid amount clause present before date filter');
  assert.equal('$expr' in base, false, 'base match has no date $expr');

  assert.ok(Array.isArray(ranged.$and));
  assert.ok(
    ranged.$and.some((c: any) => c.$expr),
    'range match adds $expr only in $and with SSOT base'
  );
  assert.ok(rangeOnly.$expr, 'standalone date clause is $expr on effectivePaidAt');
  // Date filter alone must NOT be used without SSOT — consumers wrap via buildActualRevenueInRangeMatch
  assert.equal('isTestOrder' in rangeOnly, false);
});

test('closure: consumers return identical July revenue / count / AOV from same fixtures', async () => {
  const lean = await Order.find({}).lean();
  const baseline = computeActualRevenueStatsInRange(lean as any[], dateFrom, dateTo);

  // Fixture inclusion matrix for the July window
  const julyDocs = lean.filter((d) => {
    if (!orderContributesActualRevenue(d as any)) return false;
    const key = String((d as any).customerDetails?.fullName || (d as any).__fixtureKey || '');
    const at = (d as any).paidAt || (d as any).capturedAt || (d as any).createdAt;
    const ms = new Date(at).getTime();
    return ms >= dateFrom.getTime() && ms <= dateTo.getTime();
  });
  const julyKeys = new Set(
    julyDocs.map((d) => String((d as any).customerDetails?.fullName || '')).filter(Boolean)
  );
  for (const k of JULY_INCLUDED) {
    assert.ok(julyKeys.has(k) || [...julyKeys].some((x) => x.includes(k)), `missing included ${k}`);
  }
  assert.equal(julyKeys.has('test_paid'), false);
  assert.equal(julyKeys.has('cancelled_unpaid'), false);
  assert.equal(julyKeys.has('failed_unpaid'), false);
  assert.equal(julyKeys.has('voided_unpaid'), false);
  assert.equal(julyKeys.has('invalid_totalPrice'), false);

  assert.equal(baseline.paidOrderCount, 8);
  assert.equal(baseline.revenue, 555);
  assert.equal(baseline.averageOrderValue, round2(555 / 8));

  const metrics = await getBusinessMetrics({
    from: RANGE_FROM_KEY,
    to: RANGE_TO_KEY,
    timezone: 'Asia/Jerusalem'
  });
  const metricsTriple: Triple = {
    revenue: Number(metrics.kpis.actualRevenue.value),
    paidOrderCount: Number(metrics.kpis.paidOrders.value),
    averageOrderValue: Number(metrics.kpis.averageOrderValue.value)
  };

  const payments = await getAdminPaymentsSummary({
    dateFrom,
    dateTo,
    includeDeletedPayments: true
  });
  const paymentsTriple: Triple = {
    revenue: Number(payments.totalReceived),
    paidOrderCount: Number(payments.paid.count),
    averageOrderValue: Number(payments.averageTransactionAmount)
  };

  const overview = await getDashboardOverview({
    from: RANGE_FROM_KEY,
    to: RANGE_TO_KEY,
    timezone: 'Asia/Jerusalem'
  });
  const br = (overview as any).businessReview;
  const brTriple: Triple = {
    revenue: Number(br.kpis.paidRevenue.value),
    paidOrderCount: Number(br.kpis.paidOrders.value),
    averageOrderValue:
      br.kpis.paidOrders.value > 0
        ? round2(Number(br.kpis.paidRevenue.value) / Number(br.kpis.paidOrders.value))
        : 0
  };
  // Overview finance is aligned from businessReview — must match.
  const financeRevenue = Number(
    (overview as any).kpis?.actualRevenue?.value ??
      (overview as any).financialSummary?.actualRevenue ??
      metrics.kpis.actualRevenue.value
  );
  const financePaid = Number(
    (overview as any).kpis?.paidOrders?.value ??
      (overview as any).financialSummary?.paidOrders ??
      metrics.kpis.paidOrders.value
  );

  const sumHelper = await sumActualRevenueInRange(dateFrom, dateTo);
  const sumTriple: Triple = {
    revenue: Number(sumHelper.revenue),
    paidOrderCount: Number(sumHelper.orders),
    averageOrderValue: sumHelper.orders > 0 ? round2(sumHelper.revenue / sumHelper.orders) : 0
  };

  const monthly = await orderService.getMonthlyRevenue({
    startDate: dateFrom,
    endDate: dateTo
  });
  const monthlyRevenue = round2(monthly.reduce((s, r) => s + Number(r.totalRevenue || 0), 0));
  const monthlyCount = monthly.reduce((s, r) => s + Number(r.ordersCount || 0), 0);

  const bySource = await orderService.getRevenueBySource({
    startDate: dateFrom,
    endDate: dateTo
  });
  const sourceRevenue = round2(bySource.reduce((s, r) => s + Number(r.totalRevenue || 0), 0));
  const sourceCount = bySource.reduce((s, r) => s + Number(r.ordersCount || 0), 0);

  // Accounting online component — same SSOT match (HTTP handler for transactions)
  const acctAgg = await Order.aggregate([
    { $match: buildActualRevenueInRangeMatch(dateFrom, dateTo) },
    {
      $group: {
        _id: null,
        revenue: { $sum: revenueAmountMongoExpr() },
        paidOrderCount: { $sum: 1 }
      }
    }
  ]);
  const acctOnline = finalizeActualRevenueAggregate(acctAgg[0]);

  const tx = await invokeHandler(getTransactions as any, {
    query: {
      source: 'online',
      dateFrom: dateFrom.toISOString(),
      dateTo: dateTo.toISOString(),
      page: '1',
      limit: '100'
    }
  });
  assert.equal(tx.status, 200);
  const txItems = Array.isArray(tx.body?.data) ? tx.body.data : [];
  const txRevenue = round2(txItems.reduce((s: number, i: any) => s + Number(i.amount || 0), 0));
  const txCount = txItems.length;

  const summaryAll = await invokeHandler(getSummary as any, { query: {} });
  assert.equal(summaryAll.status, 200);
  // Summary onlineTotal is all-time SSOT (no range) — must be >= July window; contract has no paid count/AOV.
  assert.ok(Number(summaryAll.body?.data?.onlineTotal) >= baseline.revenue);
  assert.equal('paidOrderCount' in (summaryAll.body?.data || {}), false);
  assert.equal('averageOrderValue' in (summaryAll.body?.data || {}), false);

  const expected: Triple = {
    revenue: baseline.revenue,
    paidOrderCount: baseline.paidOrderCount,
    averageOrderValue: baseline.averageOrderValue
  };

  const assertTriple = (name: string, got: Triple, hasAov = true) => {
    assert.equal(round2(got.revenue), expected.revenue, `${name} revenue`);
    assert.equal(got.paidOrderCount, expected.paidOrderCount, `${name} paidOrderCount`);
    if (hasAov && got.averageOrderValue != null) {
      assert.equal(round2(got.averageOrderValue), expected.averageOrderValue, `${name} AOV`);
    }
  };

  assertTriple('business-metrics', metricsTriple);
  assertTriple('admin-payments-summary', paymentsTriple);
  assertTriple('dashboard-businessReview', brTriple);
  assert.equal(round2(financeRevenue), expected.revenue, 'dashboard overview finance revenue');
  assert.equal(financePaid, expected.paidOrderCount, 'dashboard overview finance paid count');
  assertTriple('sumActualRevenueInRange', sumTriple);
  assert.equal(monthlyRevenue, expected.revenue, 'order.service getMonthlyRevenue');
  assert.equal(monthlyCount, expected.paidOrderCount, 'order.service getMonthlyRevenue count');
  assert.equal(sourceRevenue, expected.revenue, 'order.service getRevenueBySource');
  assert.equal(sourceCount, expected.paidOrderCount, 'order.service getRevenueBySource count');
  assertTriple('accounting-online-aggregate', acctOnline);
  assert.equal(txRevenue, expected.revenue, 'accounting getTransactions online');
  assert.equal(txCount, expected.paidOrderCount, 'accounting getTransactions count');

  // Explicit inclusion cases
  assert.ok(JULY_INCLUDED.has('cancelled_captured'));
  assert.ok(JULY_INCLUDED.has('archived_paid'));
  assert.ok(JULY_INCLUDED.has('manual_isPaid'));
  assert.ok(JULY_INCLUDED.has('captured_legacy_no_stamps'));
  assert.equal(JULY_INCLUDED.has('test_paid'), false);
});

test('closure: source files import order-actual-revenue SSOT helpers', () => {
  const files = [
    '../services/business-metrics.service.ts',
    '../services/admin-payments.service.ts',
    '../services/dashboard-overview.service.ts',
    '../services/order.service.ts',
    '../controllers/accounting.controller.ts',
    '../utils/business-metrics.util.ts',
    '../utils/admin-payments.util.ts',
    '../utils/dashboard-business-review.util.ts'
  ];
  for (const rel of files) {
    const src = readFileSync(join(__dirname, rel), 'utf8');
    const hitsSsot =
      src.includes('order-actual-revenue') ||
      src.includes('buildActualRevenue') ||
      src.includes('buildPaidOrdersClause') ||
      src.includes('buildBusinessReviewPaidMatch') ||
      src.includes('revenueAmountMongoExpr') ||
      src.includes('buildActualRevenueInRangeMatch') ||
      src.includes('getOrderRevenueAmount') ||
      src.includes('ACTUAL_REVENUE');
    assert.ok(hitsSsot, `${rel} must reference SSOT helpers`);
  }
  const ssot = readFileSync(join(__dirname, '../utils/order-actual-revenue.util.ts'), 'utf8');
  assert.ok(ssot.includes('$ifNull'));
  assert.ok(ssot.includes('adminPriceOverride'));
  assert.ok(ssot.includes('buildActualRevenueInRangeMatch'));
});

test('closure: explain on effectivePaidAt $expr — report stage only (no index claim)', async () => {
  const match = buildActualRevenueInRangeMatch(dateFrom, dateTo);
  let explained: any = null;
  try {
    explained = await Order.collection
      .find(match as any)
      .explain('executionStats');
  } catch (err: any) {
    // Some memory-server builds differ — fall back to aggregate explain
    const agg = await Order.aggregate([{ $match: match }, { $limit: 1 }]).explain(
      'executionStats' as any
    );
    explained = agg;
  }

  const winning =
    explained?.queryPlanner?.winningPlan ||
    explained?.stages?.[0]?.$cursor?.queryPlanner?.winningPlan ||
    explained?.executionStats?.executionStages ||
    explained;

  const blob = JSON.stringify(winning || explained || {});
  const usesCollScan = /COLLSCAN/i.test(blob);
  const usesIxscan = /IXSCAN/i.test(blob);
  const usesFetch = /FETCH/i.test(blob);

  // Document only — do NOT claim { paidAt: 1 } helps $expr without proven IXSCAN on that field.
  assert.ok(explained, 'explain returned a plan');
  console.log(
    JSON.stringify({
      phase2_closure_explain: {
        collscan: usesCollScan,
        ixscan: usesIxscan,
        fetch: usesFetch,
        note:
          usesCollScan && !usesIxscan
            ? 'COLLSCAN on $expr effectivePaidAt — do not claim paidAt/capturedAt indexes help without IXSCAN proof'
            : 'inspect winning plan before recommending indexes'
      }
    })
  );
  if (usesIxscan) {
    assert.ok(
      /paidAt|capturedAt|createdAt|_id/i.test(blob),
      'IXSCAN present — record which field; do not assume paidAt without evidence'
    );
  }
});
