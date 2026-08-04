import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildKitchenChangeEntry,
  buildKitchenReportDto,
  buildOpenKitchenEventsAlert,
  dishIdentityKey,
  effectiveLineQuantity,
  isCancelledOrder,
  kitchenReportToCsv,
  normalizeFulfillment,
  normalizeMeal,
  normalizeMeals,
  resolvePreparation,
  summarizeKitchenChanges,
  validateKitchenDateRange,
  validateKitchenReportQuery,
  withBom
} from '../utils/kitchen-report.util';
import { getForbiddenPublicOrderFields } from './order.controller';

test('open orders alert groups by date across kinds and flags overdue', () => {
  const alert = buildOpenKitchenEventsAlert(
    [
      {
        _id: 'e1',
        orderNumber: 'MG-E1',
        status: 'processing',
        cateringKind: 'events',
        customerDetails: { eventDate: '2026-08-01', fullName: 'א' }
      },
      {
        _id: 'e2',
        orderNumber: 'MG-E2',
        status: 'pending',
        cateringKind: 'events',
        customerDetails: { eventDate: '2026-08-12', fullName: 'ב' }
      },
      {
        _id: 'e3',
        orderNumber: 'MG-E3',
        status: 'pending',
        cateringKind: 'events',
        customerDetails: { eventDate: '2026-08-12', fullName: 'ג' }
      },
      {
        _id: 's1',
        status: 'pending',
        orderType: 'shabbat',
        customerDetails: { eventDate: '2026-08-12', fullName: 'שבת' }
      },
      {
        _id: 'done',
        status: 'delivered',
        cateringKind: 'events',
        customerDetails: { eventDate: '2026-08-12', fullName: 'הושלם' }
      }
    ],
    '2026-08-04'
  );
  assert.equal(alert.total, 4);
  assert.equal(alert.overdueCount, 1);
  assert.equal(alert.upcomingCount, 3);
  assert.equal(alert.eventsCount, 3);
  assert.equal(alert.byDate[0].date, '2026-08-01');
  assert.equal(alert.byDate[0].overdue, true);
  assert.equal(alert.byDate[1].date, '2026-08-12');
  assert.equal(alert.byDate[1].count, 3);
});

test('open orders alert ignores archived (isDeleted) orders', () => {
  const alert = buildOpenKitchenEventsAlert(
    [
      {
        _id: 'open1',
        status: 'processing',
        cateringKind: 'events',
        customerDetails: { eventDate: '2026-08-01', fullName: 'פתוח' }
      },
      {
        _id: 'arch1',
        status: 'ready',
        isDeleted: true,
        cateringKind: 'events',
        customerDetails: { eventDate: '2026-08-01', fullName: 'בארכיון' }
      },
      {
        _id: 'arch2',
        status: 'ready',
        isDeleted: true,
        orderType: 'catering',
        cateringKind: 'shabbat',
        customerDetails: { eventDate: '2026-07-26', fullName: 'שבת בארכיון' }
      }
    ],
    '2026-08-04'
  );
  assert.equal(alert.total, 1);
  assert.equal(alert.overdueCount, 1);
  assert.equal(alert.byDate[0].orders[0].orderId, 'open1');
});

test('merges identical dish variants and keeps different sizes separate', () => {
  const orders = [
    {
      _id: 'a1',
      orderNumber: 'MG-1',
      status: 'processing',
      items: [
        { name: 'חומוס', quantity: 2, category: 'סלטים', selectedOption: { label: 'רגיל', amount: '250' } },
        { name: 'חומוס', quantity: 1, category: 'סלטים', selectedOption: { label: 'רגיל', amount: '500' } }
      ],
      customerDetails: { eventDate: '2026-08-10', deliveryMethod: 'delivery', fullName: 'א' }
    },
    {
      _id: 'a2',
      orderNumber: 'MG-2',
      status: 'pending',
      items: [
        { name: 'חומוס', quantity: 3, category: 'סלטים', selectedOption: { label: 'רגיל', amount: '250' } }
      ],
      customerDetails: { eventDate: '2026-08-10', deliveryMethod: 'pickup', fullName: 'ב' }
    }
  ];
  const filters = validateKitchenReportQuery({ startDate: '2026-08-10', endDate: '2026-08-10' });
  const report = buildKitchenReportDto(orders, filters);
  const dishes = report.preparationGroups.flatMap((g) => g.meals.flatMap((m) => m.dishes));
  const small = dishes.find((d) => d.sizeLabel === '250');
  const large = dishes.find((d) => d.sizeLabel === '500');
  assert.ok(small);
  assert.equal(small!.quantity, 5);
  assert.equal(small!.orderCount, 2);
  assert.ok(large);
  assert.equal(large!.quantity, 1);
  assert.notEqual(dishIdentityKey(orders[0].items[0]), dishIdentityKey(orders[0].items[1]));
});

test('normal / shabbat / catering / manual-like orders contribute quantities', () => {
  const orders = [
    {
      _id: 'n1',
      status: 'processing',
      items: [{ name: 'חלות', quantity: 2, category: 'מאפים' }],
      customerDetails: { eventDate: '2026-08-10', deliveryMethod: 'delivery' }
    },
    {
      _id: 's1',
      status: 'processing',
      orderType: 'shabbat',
      mealTime: 'ערב',
      items: [{ name: 'מרק', quantity: 1, category: 'מנות עיקריות ערב' }],
      customerDetails: { eventDate: '2026-08-10', deliveryType: 'pickup' }
    },
    {
      _id: 'c1',
      status: 'processing',
      orderType: 'catering',
      cateringKind: 'events',
      eventType: 'חתונה',
      numberOfPortions: 10,
      items: [{ name: 'סלט', quantity: 1, category: 'סלטים' }],
      customerDetails: { eventDate: '2026-08-10', deliveryMethod: 'delivery' }
    },
    {
      _id: 'm1',
      status: 'processing',
      items: [{ name: 'עוף', quantity: 4, category: 'מנות עיקריות', productId: '' }],
      customerDetails: { eventDate: '2026-08-10', deliveryMethod: 'delivery', isPaid: true }
    }
  ];
  const filters = validateKitchenReportQuery({ startDate: '2026-08-10', endDate: '2026-08-10' });
  const report = buildKitchenReportDto(orders, filters);
  assert.equal(report.summary.activeOrders, 4);
  assert.ok(report.summary.totalPortions >= 2 + 1 + 10 + 4);
  assert.equal(normalizeMeal(orders[2]), 'אירוע');
});

test('cancelled orders excluded from active qty but listed in alerts when includeCancelled', () => {
  const orders = [
    {
      _id: 'x1',
      orderNumber: 'MG-X',
      status: 'cancelled',
      items: [{ name: 'חומוס', quantity: 9, category: 'סלטים' }],
      customerDetails: { eventDate: '2026-08-10', deliveryMethod: 'delivery' }
    },
    {
      _id: 'x2',
      status: 'processing',
      items: [{ name: 'חומוס', quantity: 1, category: 'סלטים' }],
      customerDetails: { eventDate: '2026-08-10', deliveryMethod: 'delivery' }
    }
  ];
  const filters = validateKitchenReportQuery({
    startDate: '2026-08-10',
    endDate: '2026-08-10',
    includeCancelled: true
  });
  const report = buildKitchenReportDto(orders, filters);
  assert.equal(report.summary.activeOrders, 1);
  assert.equal(report.summary.totalPortions, 1);
  assert.equal(report.summary.cancelledOrders, 1);
  assert.ok(report.alerts.some((a) => a.kind === 'cancellation'));
  assert.ok(isCancelledOrder({ status: 'cancelled' }));
  assert.equal(isCancelledOrder({ isDeleted: true, status: 'processing' }), false);
  assert.equal(isCancelledOrder({ isDeleted: true, status: 'ready' }), false);
});

test('archived soft-deleted catering still appears as active kitchen order', () => {
  const orders = [
    {
      _id: 'cat1',
      orderNumber: 'MG-CAT',
      orderType: 'catering',
      cateringKind: 'events',
      status: 'ready',
      isDeleted: true,
      numberOfPortions: 50,
      items: [
        { name: 'חומוס', quantity: 1, category: 'סלטים' },
        { name: 'עוף', quantity: 1, category: 'עיקריות' }
      ],
      customerDetails: { eventDate: '2026-07-26', deliveryMethod: 'delivery', fullName: 'אירוע' }
    },
    {
      _id: 'cat2',
      orderNumber: 'MG-SHAB',
      orderType: 'catering',
      cateringKind: 'shabbat',
      status: 'ready',
      isDeleted: true,
      mealTime: 'both',
      numberOfPortions: 60,
      portionsEvening: 30,
      portionsMorning: 30,
      items: [
        { name: 'חלות', quantity: 1, category: 'מאפים ערב' },
        { name: 'סלט', quantity: 1, category: 'סלטים בוקר' }
      ],
      customerDetails: { eventDate: '2026-07-26', deliveryType: 'pickup', fullName: 'שבת' }
    }
  ];
  const all = buildKitchenReportDto(
    orders,
    validateKitchenReportQuery({ startDate: '2026-07-26', endDate: '2026-07-26', orderKind: 'all' })
  );
  assert.equal(all.summary.activeOrders, 2);
  assert.equal(all.summary.cancelledOrders, 0);
  assert.ok(all.orderNotes.some((o) => o.orderKind === 'events'));
  assert.ok(all.orderNotes.some((o) => o.orderKind === 'catering_shabbat'));
  assert.ok(all.orderNotes.find((o) => o.orderNumber === 'MG-CAT')!.items.length >= 2);

  const events = buildKitchenReportDto(
    orders,
    validateKitchenReportQuery({ startDate: '2026-07-26', endDate: '2026-07-26', orderKind: 'events' })
  );
  assert.equal(events.summary.activeOrders, 1);
  assert.equal(events.orderNotes[0].orderNumber, 'MG-CAT');

  const shabbatCat = buildKitchenReportDto(
    orders,
    validateKitchenReportQuery({
      startDate: '2026-07-26',
      endDate: '2026-07-26',
      orderKind: 'catering_shabbat'
    })
  );
  assert.equal(shabbatCat.summary.activeOrders, 1);
  assert.equal(shabbatCat.orderNotes[0].orderNumber, 'MG-SHAB');
});

test('changed orders use kitchenChangeLog only — old orders without log are not changed', () => {
  const orders = [
    {
      _id: 'old',
      status: 'processing',
      updatedAt: new Date().toISOString(),
      items: [{ name: 'א', quantity: 1, category: 'סלטים' }],
      customerDetails: { eventDate: '2026-08-10', deliveryMethod: 'delivery' }
    },
    {
      _id: 'new',
      status: 'processing',
      kitchenChangeLog: [buildKitchenChangeEntry('items', 'עודכן פריט', 'admin')],
      items: [{ name: 'ב', quantity: 1, category: 'סלטים' }],
      customerDetails: { eventDate: '2026-08-10', deliveryMethod: 'pickup' }
    }
  ];
  const filters = validateKitchenReportQuery({
    startDate: '2026-08-10',
    endDate: '2026-08-10',
    changedOnly: true
  });
  const report = buildKitchenReportDto(orders, filters);
  assert.equal(report.summary.activeOrders, 1);
  assert.equal(report.summary.changedOrders, 1);
  assert.equal(summarizeKitchenChanges(undefined), null);
});

test('fulfillment and allergies/notes separation', () => {
  assert.equal(normalizeFulfillment({ deliveryMethod: 'delivery' }), 'משלוח');
  assert.equal(normalizeFulfillment({ deliveryType: 'pickup' }), 'איסוף עצמי');
  assert.equal(normalizeFulfillment({}), 'לא ידוע');
  const orders = [
    {
      _id: 'al',
      status: 'processing',
      allergies: 'בוטנים',
      adminNotes: 'פנימי',
      specialRequests: 'בלי בצל',
      items: [{ name: 'סלט', quantity: 1, category: 'סלטים', description: 'חריף' }],
      customerDetails: {
        eventDate: '2026-08-10',
        deliveryMethod: 'delivery',
        notes: 'הערת לקוח',
        fullName: 'דנה'
      }
    }
  ];
  const filters = validateKitchenReportQuery({ startDate: '2026-08-10', endDate: '2026-08-10' });
  const report = buildKitchenReportDto(orders, filters);
  assert.equal(report.summary.allergyAlerts, 1);
  assert.ok(report.alerts.some((a) => a.kind === 'allergy' && a.detail.includes('בוטנים')));
  assert.equal(report.orderNotes[0].customerNotes, 'הערת לקוח');
  assert.equal(report.orderNotes[0].adminNotes, 'פנימי');
  assert.equal(report.orderNotes[0].specialRequests, 'בלי בצל');
  assert.equal(report.orderNotes[0].itemNotes[0].note, 'חריף');
});

test('Jerusalem date range validation allows 60 days and rejects 61', () => {
  assert.doesNotThrow(() => validateKitchenDateRange('2026-08-01', '2026-08-31'));
  assert.doesNotThrow(() => validateKitchenDateRange('2026-08-01', '2026-09-29')); // 60 days
  assert.throws(() => validateKitchenDateRange('2026-08-01', '2026-09-30')); // 61 days
  try {
    validateKitchenDateRange('2026-08-01', '2026-09-30');
    assert.fail('expected throw');
  } catch (e: any) {
    assert.match(String(e.message), /60/);
    assert.match(String(e.message), /טווח/);
  }
  const ok = validateKitchenDateRange('2026-08-01', '2026-08-10');
  assert.equal(ok.startDate, '2026-08-01');
  const prepManual = resolvePreparation({
    kitchenPreparationAt: '2026-08-10T08:30:00.000Z',
    customerDetails: { eventDate: '2026-08-11', preferredDeliveryTime: '10:00' }
  });
  assert.equal(prepManual.isManualPreparation, true);
  const prepAuto = resolvePreparation({
    customerDetails: { eventDate: '2026-08-10', preferredDeliveryTime: '11:00-13:00' }
  });
  assert.equal(prepAuto.isManualPreparation, false);
  assert.ok(prepAuto.preparationLabel.includes('לפי אספקה'));
});

test('catering portion scaling uses items only (no double count)', () => {
  const order = {
    orderType: 'catering',
    numberOfPortions: 8,
    portionsEvening: 8,
    salads: ['לא לספור'],
    items: [{ name: 'חומוס', quantity: 1, category: 'סלטים ערב' }]
  };
  assert.equal(effectiveLineQuantity(order, order.items[0]), 8);
});

test('csv has BOM and Hebrew headers', () => {
  const filters = validateKitchenReportQuery({ startDate: '2026-08-10', endDate: '2026-08-10' });
  const report = buildKitchenReportDto(
    [
      {
        _id: '1',
        status: 'processing',
        items: [{ name: 'חלות', quantity: 2, category: 'מאפים' }],
        customerDetails: { eventDate: '2026-08-10', deliveryMethod: 'delivery' }
      }
    ],
    filters
  );
  const csv = kitchenReportToCsv(report);
  assert.ok(csv.includes('מנה'));
  const bom = withBom(csv);
  assert.equal(bom[0], 0xef);
  assert.equal(bom[1], 0xbb);
  assert.equal(bom[2], 0xbf);
});

test('empty state returns zero summary without throwing', () => {
  const filters = validateKitchenReportQuery({ startDate: '2026-08-10', endDate: '2026-08-10' });
  const report = buildKitchenReportDto([], filters);
  assert.equal(report.summary.activeOrders, 0);
  assert.equal(report.preparationGroups.length, 0);
  assert.equal(report.legacyItems.length, 0);
});

test('normalizeMeal covers evening morning thirdMeal both Hebrew and unknown', () => {
  assert.equal(normalizeMeal({ mealTime: 'evening' }), 'ליל שבת');
  assert.equal(normalizeMeal({ mealTime: 'morning' }), 'שבת בבוקר');
  assert.equal(normalizeMeal({ mealTime: 'thirdMeal' }), 'סעודה שלישית');
  assert.deepEqual(normalizeMeals({ mealTime: 'both' }).sort(), ['ליל שבת', 'שבת בבוקר'].sort());
  assert.equal(normalizeMeal({ mealTime: 'ערב' }), 'ליל שבת');
  assert.equal(normalizeMeal({ mealTime: 'בוקר' }), 'שבת בבוקר');
  assert.equal(normalizeMeal({ mealTypes: 'סעודה שלישית' }), 'סעודה שלישית');
  assert.equal(normalizeMeal({ mealTime: 'weird-legacy-value' }), 'ארוחה כללית');
  assert.equal(normalizeMeal({}), 'לא משויך');
  assert.ok(normalizeMeals({ mealTime: 'both' }).length === 2);
  assert.deepEqual(
    normalizeMeals({
      orderType: 'catering',
      cateringKind: 'shabbat',
      items: [{ name: 'סלט', category: 'סלטים ערב' }]
    }).sort(),
    ['ליל שבת'].sort()
  );
  assert.equal(
    normalizeMeal({ orderType: 'catering', cateringKind: 'events', eventType: 'wedding' }),
    'אירוע'
  );
});

test('meal filter recalculates all summaries against filtered orders only', () => {
  const orders = [
    {
      _id: 'e1',
      orderNumber: 'E1',
      status: 'processing',
      mealTime: 'evening',
      items: [{ name: 'מרק ערב', quantity: 2, category: 'מנות עיקריות ערב' }],
      customerDetails: { eventDate: '2026-08-10', deliveryMethod: 'delivery', fullName: 'ערב' },
      allergies: 'גלוטן'
    },
    {
      _id: 'm1',
      orderNumber: 'M1',
      status: 'processing',
      mealTime: 'morning',
      items: [{ name: 'סלט בוקר', quantity: 5, category: 'סלטים בוקר' }],
      customerDetails: { eventDate: '2026-08-10', deliveryMethod: 'pickup', fullName: 'בוקר' }
    },
    {
      _id: 'b1',
      orderNumber: 'B1',
      status: 'processing',
      mealTime: 'both',
      items: [
        { name: 'חלות ערב', quantity: 1, category: 'מאפים ערב' },
        { name: 'חלות בוקר', quantity: 3, category: 'מאפים בוקר' }
      ],
      customerDetails: { eventDate: '2026-08-10', deliveryMethod: 'delivery', fullName: 'שני' },
      kitchenChangeLog: [buildKitchenChangeEntry('items', 'שינוי פריט')]
    }
  ];

  const evening = buildKitchenReportDto(
    orders,
    validateKitchenReportQuery({ startDate: '2026-08-10', endDate: '2026-08-10', meal: 'ליל שבת' })
  );
  assert.equal(evening.summary.activeOrders, 2); // e1 + b1 (evening lines)
  assert.equal(evening.summary.totalPortions, 2 + 1);
  assert.equal(evening.summary.deliveries, 2);
  assert.equal(evening.summary.pickups, 0);
  assert.equal(evening.summary.allergyAlerts, 1);
  assert.equal(evening.summary.changedOrders, 1);
  const eveningDishes = evening.preparationGroups.flatMap((g) => g.meals.flatMap((m) => m.dishes));
  assert.ok(eveningDishes.every((d) => /ערב|ליל/.test(d.category) || d.name.includes('ערב')));
  assert.ok(!eveningDishes.some((d) => d.name.includes('בוקר')));

  const morning = buildKitchenReportDto(
    orders,
    validateKitchenReportQuery({ startDate: '2026-08-10', endDate: '2026-08-10', meal: 'שבת בבוקר' })
  );
  assert.equal(morning.summary.activeOrders, 2);
  assert.equal(morning.summary.totalPortions, 5 + 3);
  assert.equal(morning.summary.pickups, 1);
  assert.equal(morning.summary.allergyAlerts, 0);
});

test('multi-meal both order is not collapsed to a single meal label', () => {
  const order = {
    _id: 'both1',
    status: 'processing',
    mealTime: 'both',
    items: [
      { name: 'עוף', quantity: 1, category: 'עיקריות ערב' },
      { name: 'קוסקוס', quantity: 1, category: 'עיקריות בוקר' }
    ],
    customerDetails: { eventDate: '2026-08-10', deliveryMethod: 'delivery' }
  };
  const report = buildKitchenReportDto(
    [order],
    validateKitchenReportQuery({ startDate: '2026-08-10', endDate: '2026-08-10' })
  );
  assert.equal(report.orderNotes[0].meals.length, 2);
  assert.ok(report.orderNotes[0].meal.includes('ליל שבת'));
  assert.ok(report.orderNotes[0].meal.includes('שבת בבוקר'));
  const meals = report.preparationGroups[0].meals.map((m) => m.meal).sort();
  assert.deepEqual(meals, ['ליל שבת', 'שבת בבוקר'].sort());
});

test('public forbid list blocks kitchen field injection', () => {
  const forbidden = getForbiddenPublicOrderFields({
    customerDetails: { fullName: 'x' },
    kitchenChangeLog: [],
    kitchenPreparationAt: new Date().toISOString(),
    allergies: 'x',
    specialRequests: 'y',
    adminNotes: 'z'
  });
  assert.ok(forbidden.includes('kitchenChangeLog'));
  assert.ok(forbidden.includes('kitchenPreparationAt'));
  assert.ok(forbidden.includes('allergies'));
  assert.ok(forbidden.includes('specialRequests'));
});

test('change entry stores previous and new values when provided', () => {
  const entry = buildKitchenChangeEntry('allergies', 'עודכן', 'admin', new Date('2026-08-10T10:00:00Z'), {
    previousValue: 'ישן',
    newValue: 'חדש'
  });
  assert.equal(entry.previousValue, 'ישן');
  assert.equal(entry.newValue, 'חדש');
  const summarized = summarizeKitchenChanges([entry]);
  assert.equal(summarized?.previousValue, 'ישן');
});

test('csv escaping handles commas quotes and newlines with Hebrew', () => {
  const report = buildKitchenReportDto(
    [
      {
        _id: '1',
        status: 'processing',
        items: [
          {
            name: 'סלט "ביתי", חריף',
            quantity: 1,
            category: 'סלטים',
            selectedOption: { label: 'קו קטן\nשני', amount: '250' }
          }
        ],
        customerDetails: { eventDate: '2026-08-10', deliveryMethod: 'delivery' }
      }
    ],
    validateKitchenReportQuery({ startDate: '2026-08-10', endDate: '2026-08-10' })
  );
  const csv = kitchenReportToCsv(report);
  assert.ok(csv.includes('""'));
  assert.ok(csv.includes('סלט'));
  const bom = withBom(csv);
  assert.equal(bom.subarray(0, 3).toString('utf8'), '\uFEFF');
});
