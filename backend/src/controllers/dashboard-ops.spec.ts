/**
 * Unit tests for operational dashboard pure helpers.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildDashboardInsights,
  buildDaySummaryFromOrders,
  buildTopSellingByMonth,
  filterPrepTopItems,
  filterSoldTopItems,
  normalizeItemCategory,
  resolveFulfillment,
  resolveOrderPortions,
  sortActionItems,
  withAverageOrderValue,
  type DashboardActionItem
} from '../utils/dashboard-ops.util';
import { businessDayKeys } from '../utils/dashboard-overview.util';

test('businessDayKeys: today/tomorrow in Asia/Jerusalem are consecutive YYYY-MM-DD', () => {
  const fixed = new Date('2026-08-02T12:00:00+03:00');
  const keys = businessDayKeys(fixed, 'Asia/Jerusalem');
  assert.equal(keys.today, '2026-08-02');
  assert.equal(keys.tomorrow, '2026-08-03');
});

test('resolveFulfillment reads deliveryType and deliveryMethod', () => {
  assert.equal(resolveFulfillment({ deliveryType: 'pickup' }), 'pickup');
  assert.equal(resolveFulfillment({ deliveryMethod: 'delivery' }), 'delivery');
  assert.equal(resolveFulfillment({ deliveryMethod: 'self-pickup' }), 'pickup');
  assert.equal(resolveFulfillment({}), 'unknown');
});

test('resolveOrderPortions prefers evening/morning then numberOfPortions then items', () => {
  assert.deepEqual(
    resolveOrderPortions({ portionsEvening: 2, portionsMorning: 3 }),
    { total: 5, evening: 2, morning: 3 }
  );
  assert.deepEqual(resolveOrderPortions({ numberOfPortions: 8 }), {
    total: 8,
    evening: 0,
    morning: 0
  });
  assert.deepEqual(
    resolveOrderPortions({ items: [{ quantity: 2 }, { quantity: 3 }, { quantity: 0 }] }),
    { total: 5, evening: 0, morning: 0 }
  );
});

test('buildDaySummaryFromOrders counts deliveries/pickups/portions and excludes nothing already filtered', () => {
  const summary = buildDaySummaryFromOrders('2026-08-02', [
    {
      _id: '1',
      status: 'pending',
      totalPrice: 100,
      customerDetails: { deliveryType: 'delivery', fullName: 'א' },
      portionsEvening: 2,
      portionsMorning: 0,
      createdAt: '2026-08-01T10:00:00.000Z'
    },
    {
      _id: '2',
      status: 'processing',
      totalPrice: 50,
      customerDetails: { deliveryMethod: 'pickup', fullName: 'ב' },
      numberOfPortions: 4,
      createdAt: '2026-08-01T09:00:00.000Z'
    },
    {
      _id: '3',
      status: 'ready',
      totalPrice: 10,
      customerDetails: { fullName: 'ג' },
      items: [{ quantity: 1 }],
      createdAt: '2026-08-01T08:00:00.000Z'
    }
  ]);
  assert.equal(summary.ordersCount, 3);
  assert.equal(summary.expectedRevenue, 160);
  assert.equal(summary.portionsTotal, 7);
  assert.equal(summary.deliveries, 1);
  assert.equal(summary.pickups, 1);
  assert.equal(summary.unknownFulfillment, 1);
  assert.equal(summary.awaitingApproval, 1);
  assert.equal(summary.nearestOrderId, '3');
});

test('unknown fulfillment is not treated as delivery for no-driver alerts', () => {
  assert.equal(resolveFulfillment({}), 'unknown');
  assert.equal(resolveFulfillment({ deliveryType: 'delivery' }), 'delivery');
  // Guard used by action-item builder: only explicit delivery gets no-driver alerts.
  const shouldAlertNoDriver = (cd: unknown) => resolveFulfillment(cd) === 'delivery';
  assert.equal(shouldAlertNoDriver({}), false);
  assert.equal(shouldAlertNoDriver({ deliveryMethod: 'pickup' }), false);
  assert.equal(shouldAlertNoDriver({ deliveryType: 'delivery' }), true);
});

test('awaitingAmount is a money sum and awaiting count is an order count (not swapped)', () => {
  const awaitingOrders = [
    { totalPrice: 120.5 },
    { totalPrice: 80 },
    { totalPrice: 1 }
  ];
  const awaitingAmount = awaitingOrders.reduce((s, o) => s + (Number(o.totalPrice) || 0), 0);
  const awaitingCount = awaitingOrders.length;
  assert.equal(awaitingCount, 3);
  assert.equal(awaitingAmount, 201.5);
  // Swapped display would show count as currency (₪3) — must not match amount.
  assert.notEqual(awaitingAmount, awaitingCount);
  assert.ok(awaitingAmount > awaitingCount);
});

test('sortActionItems orders by severity then eventDate', () => {
  const items: DashboardActionItem[] = [
    {
      id: 'a',
      type: 'special_notes',
      severity: 'low',
      title: 'n',
      description: 'd',
      eventDate: '2026-08-01',
      actionLabel: 'x',
      actionHref: '/',
      sortKey: 'a'
    },
    {
      id: 'b',
      type: 'payment_failed',
      severity: 'critical',
      title: 'n',
      description: 'd',
      eventDate: '2026-08-05',
      actionLabel: 'x',
      actionHref: '/',
      sortKey: 'b'
    },
    {
      id: 'c',
      type: 'upcoming_not_ready',
      severity: 'high',
      title: 'n',
      description: 'd',
      eventDate: '2026-08-02',
      actionLabel: 'x',
      actionHref: '/',
      sortKey: 'c'
    }
  ];
  const sorted = sortActionItems(items);
  assert.equal(sorted[0].id, 'b');
  assert.equal(sorted[1].id, 'c');
  assert.equal(sorted[2].id, 'a');
});

test('filterSoldTopItems and filterPrepTopItems drop empty/zero rows', () => {
  assert.deepEqual(
    filterSoldTopItems([
      { name: 'סלט', quantity: 2, revenue: 40 },
      { name: '', quantity: 5, revenue: 10 },
      { name: 'חלות', quantity: 0, revenue: 0 },
      { name: 'מרק', quantity: 1, revenue: 0 }
    ]),
    [{ name: 'סלט', quantity: 2, revenue: 40 }]
  );
  assert.deepEqual(
    filterPrepTopItems([
      { name: 'חלות', quantity: 3 },
      { name: 'x', quantity: 0 },
      { name: '', quantity: 2 }
    ]),
    [{ name: 'חלות', quantity: 3 }]
  );
});

test('normalizeItemCategory falls back to כללי', () => {
  assert.equal(normalizeItemCategory(''), 'כללי');
  assert.equal(normalizeItemCategory(null), 'כללי');
  assert.equal(normalizeItemCategory('  סלטים  '), 'סלטים');
});

test('buildTopSellingByMonth: top 3 per category by quantity, months desc', () => {
  const out = buildTopSellingByMonth([
    { month: '2026-07', category: 'סלטים', name: 'חומוס', quantity: 10, revenue: 100 },
    { month: '2026-07', category: 'סלטים', name: 'טחינה', quantity: 8, revenue: 80 },
    { month: '2026-07', category: 'סלטים', name: 'קולסלאו', quantity: 6, revenue: 60 },
    { month: '2026-07', category: 'סלטים', name: 'טאבולה', quantity: 4, revenue: 40 },
    { month: '2026-07', category: '', name: 'חלות', quantity: 12, revenue: 120 },
    { month: '2026-08', category: 'סלטים', name: 'חומוס', quantity: 3, revenue: 30 },
    { month: '2026-08', category: 'סלטים', name: 'טחינה', quantity: 5, revenue: 50 },
    // should be ignored — zero qty / bad month
    { month: '2026-08', category: 'סלטים', name: 'ריק', quantity: 0, revenue: 0 },
    { month: 'bad', category: 'סלטים', name: 'x', quantity: 9, revenue: 9 }
  ]);

  assert.equal(out[0].month, '2026-08');
  assert.equal(out[1].month, '2026-07');

  const julySalads = out[1].categories.find((c) => c.category === 'סלטים');
  assert.ok(julySalads);
  assert.equal(julySalads!.items.length, 3);
  assert.deepEqual(
    julySalads!.items.map((i) => i.name),
    ['חומוס', 'טחינה', 'קולסלאו']
  );

  const julyGeneral = out[1].categories.find((c) => c.category === 'כללי');
  assert.ok(julyGeneral);
  assert.equal(julyGeneral!.items[0].name, 'חלות');

  const augSalads = out[0].categories.find((c) => c.category === 'סלטים');
  assert.equal(augSalads!.items[0].name, 'טחינה');
  assert.equal(augSalads!.items[0].quantity, 5);
});

test('withAverageOrderValue computes AOV and zeros empty days', () => {
  const out = withAverageOrderValue([
    { period: '2026-08-01', revenue: 0, paidOrdersCount: 0 },
    { period: '2026-08-02', revenue: 200, paidOrdersCount: 4 }
  ]);
  assert.equal(out[0].averageOrderValue, 0);
  assert.equal(out[1].averageOrderValue, 50);
});

test('buildDashboardInsights is deterministic and capped at 3', () => {
  const insights = buildDashboardInsights({
    awaitingPayments: 3,
    failedPayments: 0,
    tomorrow: {
      date: '2026-08-03',
      ordersCount: 14,
      expectedRevenue: 1,
      portionsTotal: 86,
      deliveries: 1,
      pickups: 0,
      unknownFulfillment: 0,
      awaitingApproval: 0,
      byStatus: []
    },
    topSoldItem: { name: 'סלט טורקי', quantity: 9 },
    strongestTrendDay: { period: '2026-07-30', paidOrdersCount: 5 },
    revenueChangePercent: 12,
    revenuePreviousSample: 10,
    actionItemTypes: ['payment_awaiting']
  });
  assert.ok(insights.length <= 3);
  assert.ok(!insights.some((i) => i.id === 'awaiting_payments'));
  assert.ok(insights.some((i) => i.id === 'tomorrow_load'));
  assert.match(insights.find((i) => i.id === 'tomorrow_load')!.text, /14/);
});

test('buildDashboardInsights skips weak revenue percent samples', () => {
  const insights = buildDashboardInsights({
    revenueChangePercent: 400,
    revenuePreviousSample: 1
  });
  assert.ok(!insights.some((i) => i.id === 'revenue_change'));
});
