import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyPrepDateMove,
  buildPrepSplits,
  filterMergedByOrderKind,
  mergePrepDayAssignments,
  type PrepAssignmentInput
} from '../utils/kitchen-prep-day.util';
import {
  buildKitchenReportDto,
  classifyKitchenOrderKind,
  orderMatchesKitchenOrderKind,
  parseKitchenOrderKindFilter,
  validateKitchenReportQuery
} from '../utils/kitchen-report.util';

test('classifyKitchenOrderKind splits ready-food vs catering Shabbat vs events', () => {
  assert.equal(classifyKitchenOrderKind({ cateringKind: 'events', orderType: 'catering' }), 'events');
  assert.equal(classifyKitchenOrderKind({ orderType: 'catering', cateringKind: 'shabbat' }), 'catering_shabbat');
  assert.equal(classifyKitchenOrderKind({ orderType: 'catering' }), 'catering_shabbat');
  assert.equal(classifyKitchenOrderKind({ orderType: 'shabbat' }), 'shabbat_ready');
  assert.equal(classifyKitchenOrderKind({}), 'shabbat_ready');
});

test('orderKind filter keeps events / shabbat_ready / catering_shabbat / all correct', () => {
  const orders = [
    {
      _id: 'e1',
      status: 'processing',
      cateringKind: 'events',
      orderType: 'catering',
      items: [{ name: 'עוף', quantity: 2, category: 'עיקריות' }],
      customerDetails: { eventDate: '2026-08-10', deliveryMethod: 'delivery', fullName: 'אירוע' }
    },
    {
      _id: 's1',
      status: 'processing',
      orderType: 'shabbat',
      items: [{ name: 'חלות', quantity: 3, category: 'מאפים' }],
      customerDetails: { eventDate: '2026-08-10', deliveryMethod: 'pickup', fullName: 'שבת' }
    },
    {
      _id: 'c1',
      status: 'processing',
      orderType: 'catering',
      cateringKind: 'shabbat',
      items: [{ name: 'חלות', quantity: 1, category: 'מאפים' }],
      customerDetails: { eventDate: '2026-08-10', deliveryMethod: 'delivery', fullName: 'קייטרינג שבת' }
    }
  ];

  const all = buildKitchenReportDto(
    orders,
    validateKitchenReportQuery({ startDate: '2026-08-10', endDate: '2026-08-10', orderKind: 'all' })
  );
  assert.equal(all.summary.activeOrders, 3);
  assert.equal(all.orderNotes.length, 3);

  const events = buildKitchenReportDto(
    orders,
    validateKitchenReportQuery({ startDate: '2026-08-10', endDate: '2026-08-10', orderKind: 'events' })
  );
  assert.equal(events.summary.activeOrders, 1);
  assert.equal(events.orderNotes[0].orderKind, 'events');
  assert.equal(events.orderNotes[0].orderKindLabel, 'קייטרינג לאירועים');

  const shabbat = buildKitchenReportDto(
    orders,
    validateKitchenReportQuery({ startDate: '2026-08-10', endDate: '2026-08-10', orderKind: 'shabbat_ready' })
  );
  assert.equal(shabbat.summary.activeOrders, 1);
  assert.ok(shabbat.orderNotes.every((o) => o.orderKind === 'shabbat_ready'));
  assert.equal(shabbat.orderNotes[0].orderKindLabel, 'אוכל מוכן לשבת וחג');

  const cateringShabbat = buildKitchenReportDto(
    orders,
    validateKitchenReportQuery({
      startDate: '2026-08-10',
      endDate: '2026-08-10',
      orderKind: 'catering_shabbat'
    })
  );
  assert.equal(cateringShabbat.summary.activeOrders, 1);
  assert.equal(cateringShabbat.orderNotes[0].orderKind, 'catering_shabbat');
  assert.equal(cateringShabbat.orderNotes[0].orderKindLabel, 'קייטרינג לאירועי שבת וחג');

  assert.equal(parseKitchenOrderKindFilter('all'), 'all');
  assert.equal(parseKitchenOrderKindFilter('shabbat_catering'), 'catering_shabbat');
  assert.equal(parseKitchenOrderKindFilter('shabbat-events'), 'catering_shabbat');
  assert.ok(orderMatchesKitchenOrderKind(orders[0], 'events'));
  assert.equal(orderMatchesKitchenOrderKind(orders[1], 'events'), false);
  assert.ok(orderMatchesKitchenOrderKind(orders[2], 'catering_shabbat'));
  assert.equal(orderMatchesKitchenOrderKind(orders[1], 'catering_shabbat'), false);
});

test('master report includes all order kinds and print filter mirrors orderKind', () => {
  const orders = [
    {
      _id: 'e1',
      status: 'processing',
      cateringKind: 'events',
      items: [{ name: 'סלט', quantity: 1, category: 'סלטים' }],
      customerDetails: { eventDate: '2026-08-10', deliveryMethod: 'delivery' }
    },
    {
      _id: 's1',
      status: 'processing',
      items: [{ name: 'סלט', quantity: 2, category: 'סלטים' }],
      customerDetails: { eventDate: '2026-08-10', deliveryMethod: 'delivery' }
    },
    {
      _id: 'i1',
      status: 'processing',
      __kitchenOrderKind: 'institutions',
      orderKind: 'institutions',
      items: [{ name: 'מנה רגילה (מוסד)', quantity: 10, category: 'מוסדות' }],
      customerDetails: { eventDate: '2026-08-10', deliveryMethod: 'delivery', fullName: 'מוסד א' }
    }
  ];
  const master = buildKitchenReportDto(
    orders,
    validateKitchenReportQuery({ startDate: '2026-08-10', endDate: '2026-08-10', orderKind: 'all' })
  );
  assert.equal(master.summary.activeOrders, 3);
  assert.equal(master.filters.orderKind, 'all');
  const kinds = new Set(master.orderNotes.map((o) => o.orderKind));
  assert.ok(kinds.has('events'));
  assert.ok(kinds.has('shabbat_ready'));
  assert.ok(kinds.has('institutions'));

  const filtered = buildKitchenReportDto(
    orders,
    validateKitchenReportQuery({ startDate: '2026-08-10', endDate: '2026-08-10', orderKind: 'institutions' })
  );
  assert.equal(filtered.summary.activeOrders, 1);
  assert.equal(filtered.filters.orderKind, 'institutions');
  assert.equal(filtered.orderNotes[0].orderKindLabel, 'מוסדות');
});

test('deliveryDate and preparationDate are separated on order notes', () => {
  const orders = [
    {
      _id: 'p1',
      status: 'processing',
      kitchenPreparationAt: new Date('2026-08-08T09:00:00.000+03:00'),
      items: [{ name: 'מרק', quantity: 1, category: 'מרקים' }],
      customerDetails: { eventDate: '2026-08-10', deliveryMethod: 'delivery', fullName: 'א' }
    }
  ];
  const byDelivery = buildKitchenReportDto(
    orders,
    validateKitchenReportQuery({
      startDate: '2026-08-10',
      endDate: '2026-08-10',
      dateBasis: 'delivery'
    })
  );
  assert.equal(byDelivery.orderNotes.length, 1);
  assert.equal(byDelivery.orderNotes[0].deliveryDate, '2026-08-10');
  assert.equal(byDelivery.orderNotes[0].preparationDate, '2026-08-08');

  const byPrep = buildKitchenReportDto(
    orders,
    validateKitchenReportQuery({
      startDate: '2026-08-08',
      endDate: '2026-08-08',
      dateBasis: 'prep'
    })
  );
  assert.equal(byPrep.orderNotes.length, 1);
});

test('merged prep quantities are correct and expandable by source orders', () => {
  const rows: PrepAssignmentInput[] = [
    {
      id: 'a1',
      orderId: 'o1',
      orderNumber: 'MG-1',
      orderItemKey: 'hummus||r||250||salads',
      dishName: 'חומוס',
      optionLabel: 'רגיל',
      sizeLabel: '250',
      category: 'סלטים',
      quantity: 2,
      prepDate: '2026-08-09',
      deliveryDate: '2026-08-10',
      orderKind: 'shabbat_ready'
    },
    {
      id: 'a2',
      orderId: 'o2',
      orderNumber: 'MG-2',
      orderItemKey: 'hummus||r||250||salads',
      dishName: 'חומוס',
      optionLabel: 'רגיל',
      sizeLabel: '250',
      category: 'סלטים',
      quantity: 3,
      prepDate: '2026-08-09',
      deliveryDate: '2026-08-10',
      orderKind: 'events'
    }
  ];
  const merged = mergePrepDayAssignments(rows);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].quantity, 5);
  assert.equal(merged[0].orderCount, 2);
  assert.equal(merged[0].sources.length, 2);

  const onlyEvents = filterMergedByOrderKind(merged, 'events');
  assert.equal(onlyEvents.length, 1);
  assert.equal(onlyEvents[0].quantity, 3);
  assert.equal(onlyEvents[0].sources.length, 1);
});

test('moving prep day removes from old day without duplicates', () => {
  const rows: PrepAssignmentInput[] = [
    {
      id: 'a1',
      orderId: 'o1',
      orderItemKey: 'k1',
      dishName: 'חלות',
      quantity: 4,
      prepDate: '2026-08-08',
      orderKind: 'shabbat_ready'
    },
    {
      id: 'a2',
      orderId: 'o2',
      orderItemKey: 'k2',
      dishName: 'מרק',
      quantity: 1,
      prepDate: '2026-08-08',
      orderKind: 'shabbat_ready'
    }
  ];
  const moved = applyPrepDateMove(rows, 'a1', '2026-08-09');
  assert.equal(moved.filter((r) => r.id === 'a1').length, 1);
  assert.equal(moved.find((r) => r.id === 'a1')!.prepDate, '2026-08-09');

  const day8 = mergePrepDayAssignments(moved.filter((r) => r.prepDate === '2026-08-08'));
  const day9 = mergePrepDayAssignments(moved.filter((r) => r.prepDate === '2026-08-09'));
  assert.equal(day8.reduce((s, l) => s + l.quantity, 0), 1);
  assert.equal(day9.reduce((s, l) => s + l.quantity, 0), 4);
  assert.equal(day9[0].sources.filter((s) => s.assignmentId === 'a1').length, 1);
});

test('split across days keeps ordered quantity ceiling', () => {
  const splits = buildPrepSplits(
    {
      orderId: 'o1',
      orderItemKey: 'k1',
      dishName: 'עוף',
      category: 'עיקריות',
      orderKind: 'events'
    },
    [
      { prepDate: '2026-08-07', quantity: 2 },
      { prepDate: '2026-08-08', quantity: 3 }
    ],
    5
  );
  assert.equal(splits.length, 2);
  assert.equal(
    splits.reduce((s, x) => s + x.quantity, 0),
    5
  );
  assert.throws(() =>
    buildPrepSplits(
      { orderId: 'o1', orderItemKey: 'k1', dishName: 'עוף' },
      [
        { prepDate: '2026-08-07', quantity: 4 },
        { prepDate: '2026-08-08', quantity: 3 }
      ],
      5
    )
  );
});

test('cancelled orders are excluded from merged prep-like report aggregation', () => {
  const orders = [
    {
      _id: 'live',
      status: 'processing',
      items: [{ name: 'סלט', quantity: 2, category: 'סלטים' }],
      customerDetails: { eventDate: '2026-08-10', deliveryMethod: 'delivery' }
    },
    {
      _id: 'dead',
      status: 'cancelled',
      items: [{ name: 'סלט', quantity: 9, category: 'סלטים' }],
      customerDetails: { eventDate: '2026-08-10', deliveryMethod: 'delivery' }
    }
  ];
  const report = buildKitchenReportDto(
    orders,
    validateKitchenReportQuery({
      startDate: '2026-08-10',
      endDate: '2026-08-10',
      includeCancelled: true
    })
  );
  const dishes = report.preparationGroups.flatMap((g) => g.meals.flatMap((m) => m.dishes));
  const salad = dishes.find((d) => d.name === 'סלט');
  assert.ok(salad);
  assert.equal(salad!.quantity, 2);
  assert.equal(report.summary.cancelledOrders, 1);
});
