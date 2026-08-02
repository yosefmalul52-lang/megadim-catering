import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildKitchenChangeEntry,
  buildKitchenReportDto,
  dishIdentityKey,
  effectiveLineQuantity,
  isCancelledOrder,
  kitchenReportToCsv,
  normalizeFulfillment,
  normalizeMeal,
  resolvePreparation,
  summarizeKitchenChanges,
  validateKitchenDateRange,
  validateKitchenReportQuery,
  withBom
} from '../utils/kitchen-report.util';

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
  assert.ok(isCancelledOrder({ isDeleted: true, status: 'processing' }));
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

test('Jerusalem date range validation and prep fallback', () => {
  assert.throws(() => validateKitchenDateRange('2026-08-01', '2026-09-15'));
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
