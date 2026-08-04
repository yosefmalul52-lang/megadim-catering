import assert from 'node:assert/strict';
import test from 'node:test';
import {
  actualRevenueAmount,
  applyOrderKindToMatch,
  buildActualRevenueMatch,
  buildExpectedEventRevenueMatch,
  buildFilteredOrderMatch,
  computeNewAndReturningCustomers,
  customerIdentityKey,
  kpiTriple,
  orderContributesActualRevenue,
  orderIsExpectedEventRevenue,
  orderIsZeroPriceActive,
  previousRange,
  resolveBusinessMetricsRange
} from '../utils/business-metrics.util';

test('captured order is included in actual revenue', () => {
  const order = {
    paymentStatus: 'captured',
    status: 'processing',
    totalPrice: 120,
    isTestOrder: false
  };
  assert.equal(orderContributesActualRevenue(order), true);
  assert.equal(actualRevenueAmount(order), 120);
});

test('manual isPaid order is included even when paymentStatus is pending', () => {
  const order = {
    paymentStatus: 'pending',
    status: 'processing',
    totalPrice: 80,
    customerDetails: { isPaid: true }
  };
  assert.equal(orderContributesActualRevenue(order), true);
  assert.equal(actualRevenueAmount(order), 80);
});

test('manual unpaid is not included', () => {
  const order = {
    paymentStatus: 'pending',
    status: 'processing',
    totalPrice: 80,
    customerDetails: { isPaid: false }
  };
  assert.equal(orderContributesActualRevenue(order), false);
  assert.equal(actualRevenueAmount(order), 0);
});

test('cancelled paid orders are included; test orders are excluded', () => {
  assert.equal(
    orderContributesActualRevenue({
      paymentStatus: 'captured',
      status: 'cancelled',
      totalPrice: 50
    }),
    true
  );
  assert.equal(
    orderContributesActualRevenue({
      paymentStatus: 'captured',
      status: 'processing',
      totalPrice: 50,
      isTestOrder: true
    }),
    false
  );
});

test('totalPrice=0 does not add revenue but can still match inclusion', () => {
  const order = {
    paymentStatus: 'captured',
    status: 'processing',
    totalPrice: 0
  };
  assert.equal(orderContributesActualRevenue(order), true);
  assert.equal(actualRevenueAmount(order), 0);
  assert.equal(orderIsZeroPriceActive(order), true);
});

test('invalid totalPrice is excluded', () => {
  assert.equal(
    orderContributesActualRevenue({
      paymentStatus: 'captured',
      status: 'processing',
      totalPrice: 'abc'
    }),
    false
  );
});

test('expected event revenue is separate from actual', () => {
  const order = {
    cateringKind: 'events',
    paymentStatus: 'pending',
    status: 'processing',
    totalPrice: 5000,
    customerDetails: { isPaid: false }
  };
  assert.equal(orderIsExpectedEventRevenue(order), true);
  assert.equal(orderContributesActualRevenue(order), false);
  assert.equal(
    orderIsExpectedEventRevenue({ ...order, paymentStatus: 'captured' }),
    false
  );
});

test('customer key prefers userId over phone', () => {
  assert.equal(
    customerIdentityKey({
      userId: '507f1f77bcf86cd799439011',
      customerDetails: { phone: '050-1111111' }
    }),
    'u:507f1f77bcf86cd799439011'
  );
  assert.equal(
    customerIdentityKey({
      customerDetails: { phone: '+972501111111' }
    }),
    'p:0501111111'
  );
});

test('new and returning customers use full history, not period-only doubles', () => {
  const from = new Date('2026-08-01T00:00:00.000Z');
  const to = new Date('2026-08-31T23:59:59.999Z');
  const touches = [
    // Returning: ordered in July and again in August
    { key: 'p:0501111111', createdAt: new Date('2026-07-10T10:00:00.000Z') },
    { key: 'p:0501111111', createdAt: new Date('2026-08-05T10:00:00.000Z') },
    // New: first ever order in August
    { key: 'p:0502222222', createdAt: new Date('2026-08-12T10:00:00.000Z') },
    // Two orders inside August only — still NEW (first ever in period), not returning
    { key: 'p:0503333333', createdAt: new Date('2026-08-01T10:00:00.000Z') },
    { key: 'p:0503333333', createdAt: new Date('2026-08-20T10:00:00.000Z') },
    // Outside period only
    { key: 'p:0504444444', createdAt: new Date('2026-06-01T10:00:00.000Z') }
  ];
  const { newCustomers, returningCustomers } = computeNewAndReturningCustomers(touches, from, to);
  assert.equal(returningCustomers, 1);
  assert.equal(newCustomers, 2);
});

test('previous period comparison window is contiguous and same length', () => {
  const range = resolveBusinessMetricsRange({
    from: '2026-08-01',
    to: '2026-08-31',
    timezone: 'Asia/Jerusalem'
  });
  const prev = previousRange(range);
  assert.ok(prev.to.getTime() < range.from.getTime());
  const len = range.to.getTime() - range.from.getTime();
  const prevLen = prev.to.getTime() - prev.from.getTime();
  assert.ok(Math.abs(len - prevLen) < 2000);
  const delta = kpiTriple(200, 100);
  assert.equal(delta.changePercent, 100);
});

test('orderKind and payment filters stay consistent on match builders', () => {
  const base = buildActualRevenueMatch({ createdAt: { $gte: new Date('2026-01-01') } });
  const events = applyOrderKindToMatch(base, 'events');
  assert.equal((events as any).cateringKind, 'events');
  const shabbat = applyOrderKindToMatch(base, 'shabbat_ready');
  assert.deepEqual((shabbat as any).cateringKind, { $ne: 'events' });

  const filtered = buildFilteredOrderMatch(base, { paymentStatus: 'pending' });
  assert.equal(filtered.paymentStatus, 'pending');
  assert.equal('$or' in filtered, false);

  const expected = buildExpectedEventRevenueMatch();
  assert.equal(expected.cateringKind, 'events');
  assert.ok(Array.isArray((expected as any).$nor));
});

test('actual revenue mongo match includes payment proof and excludes test (not cancelled)', () => {
  const m = buildActualRevenueMatch() as any;
  assert.equal(m.isTestOrder.$ne, true);
  assert.equal('status' in m, false);
  assert.ok(Array.isArray(m.$and));
  const proof = m.$and.find((c: any) => Array.isArray(c?.$or));
  assert.ok(proof.$or.some((x: any) => x.paymentStatus === 'captured'));
  assert.ok(proof.$or.some((x: any) => x['customerDetails.isPaid'] === true));
});

test('ExternalInvoice is never part of actual revenue match', () => {
  const src = require('fs').readFileSync(
    require('path').join(__dirname, '../services/business-metrics.service.ts'),
    'utf8'
  );
  assert.ok(src.includes('externalInvoices'));
  assert.ok(src.includes('לא נכלל בהכנסות בפועל'));
  // actual revenue path uses Order only
  assert.match(src, /buildActualRevenueMatch/);
  assert.doesNotMatch(
    src.slice(src.indexOf('async function sumMatch'), src.indexOf('async function countMatch')),
    /ExternalInvoice/
  );
});

test('year preset resolves to calendar year', () => {
  const range = resolveBusinessMetricsRange({
    preset: 'year',
    timezone: 'Asia/Jerusalem',
    now: new Date('2026-08-03T12:00:00.000Z')
  });
  assert.equal(range.preset, 'year');
  assert.ok(range.to.getTime() > range.from.getTime());
  // Jerusalem 2026-01-01 00:00 is still late Dec 2025 in UTC — check span covers Aug 2026.
  const mid = new Date('2026-08-03T12:00:00.000Z').getTime();
  assert.ok(range.from.getTime() <= mid && mid <= range.to.getTime());
});
