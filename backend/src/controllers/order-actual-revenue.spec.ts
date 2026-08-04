import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ACTUAL_REVENUE_PRICE_OVERRIDE_FIELD,
  actualRevenueAmount,
  buildActualRevenueMatch,
  buildPaymentProofClause,
  computeActualRevenueStats,
  computeActualRevenueStatsInRange,
  getEffectivePaidAt,
  getOrderRevenueAmount,
  isPaidOrder,
  orderContributesActualRevenue,
  orderHasPaymentProof
} from '../utils/order-actual-revenue.util';
import { PHASE2_INCLUDED_KEYS, PHASE2_REVENUE_FIXTURES } from './order-actual-revenue.fixtures';

test('phase2: payment proof fixtures inclusion matrix', () => {
  for (const fixture of Object.values(PHASE2_REVENUE_FIXTURES)) {
    const included = orderContributesActualRevenue(fixture as any);
    assert.equal(
      included,
      PHASE2_INCLUDED_KEYS.has(fixture.key),
      `${fixture.key} expected included=${PHASE2_INCLUDED_KEYS.has(fixture.key)}`
    );
  }
});

test('phase2: cancelled captured is included; cancelled unpaid is not', () => {
  assert.equal(orderContributesActualRevenue(PHASE2_REVENUE_FIXTURES.cancelledCaptured as any), true);
  assert.equal(orderContributesActualRevenue(PHASE2_REVENUE_FIXTURES.cancelledUnpaid as any), false);
});

test('phase2: archived paid remains in revenue; archive does not change amount', () => {
  const archived = PHASE2_REVENUE_FIXTURES.archivedPaid as any;
  const active = { ...archived, isDeleted: false };
  assert.equal(orderContributesActualRevenue(archived), true);
  assert.equal(orderContributesActualRevenue(active), true);
  assert.equal(getOrderRevenueAmount(archived), getOrderRevenueAmount(active));
});

test('phase2: ops status ready / archive implies paid (manual offline settlement)', () => {
  assert.equal(orderContributesActualRevenue(PHASE2_REVENUE_FIXTURES.opsStatusOnly as any), true);
  assert.equal(getOrderRevenueAmount(PHASE2_REVENUE_FIXTURES.opsStatusOnly as any), 55);

  // pending/processing without classic proof remains unpaid
  assert.equal(
    orderContributesActualRevenue({
      paymentStatus: 'authorized',
      status: 'processing',
      totalPrice: 55,
      isDeleted: false,
      isTestOrder: false
    } as any),
    false
  );

  // Driver-reachable statuses alone must NOT imply revenue (no classic proof).
  for (const status of ['out_for_delivery', 'delivered'] as const) {
    assert.equal(
      orderContributesActualRevenue({
        paymentStatus: 'awaiting_payment',
        status,
        totalPrice: 120,
        isDeleted: false,
        isTestOrder: false
      } as any),
      false,
      `unpaid ${status} must not count as revenue`
    );
  }

  // classic captured amount is unchanged across ops statuses
  const paidReady = {
    ...PHASE2_REVENUE_FIXTURES.capturedLegacyNoStamps,
    status: 'processing'
  };
  const paidDelivered = { ...paidReady, status: 'delivered' };
  assert.equal(getOrderRevenueAmount(paidReady as any), getOrderRevenueAmount(paidDelivered as any));
});

test('phase2: failed/voided without proof excluded; test excluded', () => {
  assert.equal(orderContributesActualRevenue(PHASE2_REVENUE_FIXTURES.failedUnpaid as any), false);
  assert.equal(orderContributesActualRevenue(PHASE2_REVENUE_FIXTURES.voidedUnpaid as any), false);
  assert.equal(orderContributesActualRevenue(PHASE2_REVENUE_FIXTURES.testPaid as any), false);
});

test('phase2: effectivePaidAt fallback order', () => {
  assert.equal(
    getEffectivePaidAt(PHASE2_REVENUE_FIXTURES.capturedWithPaidAt as any)?.toISOString(),
    '2026-07-15T10:00:00.000Z'
  );
  assert.equal(
    getEffectivePaidAt(PHASE2_REVENUE_FIXTURES.capturedLegacyNoStamps as any)?.toISOString(),
    '2026-07-10T12:00:00.000Z'
  );
  assert.equal(
    getEffectivePaidAt(PHASE2_REVENUE_FIXTURES.newPaidAtDiffersCreatedAt as any)?.toISOString(),
    '2026-07-20T10:00:00.000Z'
  );
  const capturedOnly = {
    paymentStatus: 'captured',
    capturedAt: new Date('2026-07-18T01:00:00.000Z'),
    createdAt: new Date('2026-07-01T01:00:00.000Z'),
    totalPrice: 10
  };
  assert.equal(getEffectivePaidAt(capturedOnly)?.toISOString(), '2026-07-18T01:00:00.000Z');
});

test('phase2: revenue amount uses adminPriceOverride including 0', () => {
  assert.equal(ACTUAL_REVENUE_PRICE_OVERRIDE_FIELD, 'adminPriceOverride');
  assert.equal(getOrderRevenueAmount(PHASE2_REVENUE_FIXTURES.overrideZero as any), 0);
  assert.equal(orderContributesActualRevenue(PHASE2_REVENUE_FIXTURES.overrideZero as any), true);
  assert.equal(getOrderRevenueAmount(PHASE2_REVENUE_FIXTURES.capturedWithPaidAt as any), 100);
  assert.equal(actualRevenueAmount(PHASE2_REVENUE_FIXTURES.invalidTotalPrice as any), 0);
  assert.equal(orderContributesActualRevenue(PHASE2_REVENUE_FIXTURES.invalidTotalPrice as any), false);
});

test('phase2: range uses effectivePaidAt not createdAt for new orders', () => {
  const from = new Date('2026-07-01T00:00:00.000Z');
  const to = new Date('2026-07-31T23:59:59.999Z');
  const juneOnly = new Date('2026-06-01T00:00:00.000Z');
  const juneEnd = new Date('2026-06-30T23:59:59.999Z');

  const julyStats = computeActualRevenueStatsInRange(
    [PHASE2_REVENUE_FIXTURES.newPaidAtDiffersCreatedAt as any],
    from,
    to
  );
  assert.equal(julyStats.paidOrderCount, 1);
  assert.equal(julyStats.revenue, 120);

  const juneStats = computeActualRevenueStatsInRange(
    [PHASE2_REVENUE_FIXTURES.newPaidAtDiffersCreatedAt as any],
    juneOnly,
    juneEnd
  );
  assert.equal(juneStats.paidOrderCount, 0);
  assert.equal(juneStats.revenue, 0);

  const legacyJuly = computeActualRevenueStatsInRange(
    [PHASE2_REVENUE_FIXTURES.capturedLegacyNoStamps as any],
    from,
    to
  );
  assert.equal(legacyJuly.paidOrderCount, 1);
});

test('phase2: aggregate stats match per-order predicates', () => {
  const docs = Object.values(PHASE2_REVENUE_FIXTURES) as any[];
  const stats = computeActualRevenueStats(docs);
  const manual = docs.filter((d) => orderContributesActualRevenue(d));
  assert.equal(stats.paidOrderCount, manual.length);
  assert.equal(
    stats.revenue,
    Math.round(manual.reduce((s, d) => s + getOrderRevenueAmount(d), 0) * 100) / 100
  );
  assert.equal(stats.averageOrderValue, stats.paidOrderCount ? Math.round((stats.revenue / stats.paidOrderCount) * 100) / 100 : 0);
});

test('phase2: isPaidOrder alias matches orderContributesActualRevenue', () => {
  for (const fixture of Object.values(PHASE2_REVENUE_FIXTURES)) {
    assert.equal(isPaidOrder(fixture as any), orderContributesActualRevenue(fixture as any));
  }
});

test('phase2: mongo match shape includes ops-implied proof without top-level status filter', () => {
  const m = buildActualRevenueMatch() as any;
  assert.equal(m.isTestOrder.$ne, true);
  assert.equal('status' in m, false);
  assert.equal('isDeleted' in m, false);
  assert.ok(Array.isArray(m.$and));
  const proof = buildPaymentProofClause() as any;
  assert.ok(proof.$or.some((x: any) => x.paymentStatus === 'captured'));
  assert.ok(proof.$or.some((x: any) => x['customerDetails.isPaid'] === true));
  assert.ok(proof.$or.some((x: any) => x.paidAt?.$type === 'date'));
  assert.ok(proof.$or.some((x: any) => x.capturedAt?.$type === 'date'));
  assert.ok(
    proof.$or.some(
      (x: any) =>
        Array.isArray(x?.$and) &&
        x.$and.some((y: any) => Array.isArray(y?.$or) && y.$or.some((z: any) => z.isDeleted === true))
    )
  );
});

test('phase2: manual isPaid is payment proof even with prior failed status', () => {
  const order = {
    paymentStatus: 'failed',
    customerDetails: { isPaid: true },
    totalPrice: 33,
    createdAt: new Date('2026-07-12T00:00:00.000Z')
  };
  assert.equal(orderHasPaymentProof(order), true);
  assert.equal(orderContributesActualRevenue(order), true);
  assert.equal(getOrderRevenueAmount(order), 33);
});
