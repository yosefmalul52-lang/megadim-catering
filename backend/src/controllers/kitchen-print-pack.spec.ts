/**
 * Kitchen print pack SSOT — P1/P2/P3 + missing-choice gate.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildKitchenReportDto,
  validateKitchenReportQuery
} from '../utils/kitchen-report.util';
import {
  buildKitchenDeltasPrintHtml,
  buildKitchenOrderSheetHtml,
  buildKitchenPrepPrintHtml,
  buildKitchenQtySnapshot,
  collectPrintDeltas,
  countMissingChoiceLines,
  flattenPrepDishes
} from '../utils/kitchen-print-pack.util';
import { buildKitchenPrintPack, buildKitchenPrintHtml } from '../services/kitchen-report.service';

const PRODUCT = '6953f955a1b2c3d4e5f60789';

function sampleOrders() {
  return [
    {
      _id: 'aaaaaaaaaaaaaaaaaaaaaaaa',
      orderNumber: 'MG-PACK-1',
      status: 'processing',
      items: [
        {
          productId: `${PRODUCT}-size-0`,
          name: 'חומוס (250 מ"ל - 250)',
          quantity: 2,
          category: 'סלטים',
          selectedOption: { label: '250 מ"ל', amount: '250', price: 17 }
        },
        {
          productId: `${PRODUCT}-size-1`,
          name: 'חומוס (500 מ"ל - 500)',
          quantity: 3,
          category: 'סלטים',
          selectedOption: { label: '500 מ"ל', amount: '500', price: 29 }
        },
        {
          productId: PRODUCT,
          name: 'טחינה',
          quantity: 1,
          category: 'סלטים',
          selectedOption: { label: 'רגיל', missingForReview: true }
        }
      ],
      customerDetails: {
        eventDate: '2026-08-10',
        deliveryMethod: 'delivery',
        fullName: 'בדיקה',
        phone: '0500000000'
      },
      kitchenChangeLog: [
        {
          at: new Date('2026-08-10T12:00:00Z'),
          type: 'items',
          summary: 'עודכן משקל',
          previousValue: '250',
          newValue: '500'
        }
      ]
    }
  ];
}

function report() {
  return buildKitchenReportDto(
    sampleOrders(),
    validateKitchenReportQuery({
      startDate: '2026-08-10',
      endDate: '2026-08-10',
      includeCancelled: false
    })
  );
}

test('fingerprint keeps 250 and 500 hummus separate in prep flatten', () => {
  const r = report();
  const dishes = flattenPrepDishes(r);
  const hummus = dishes.filter((d) => d.name.includes('חומוס'));
  assert.ok(hummus.length >= 2);
  const amounts = new Set(hummus.map((d) => d.sizeLabel || d.optionLabel));
  assert.ok([...amounts].some((a) => String(a).includes('250')));
  assert.ok([...amounts].some((a) => String(a).includes('500')));
  assert.notEqual(
    hummus.find((d) => String(d.sizeLabel || d.optionLabel).includes('250'))?.quantity,
    hummus.find((d) => String(d.sizeLabel || d.optionLabel).includes('500'))?.quantity
  );
});

test('missingChoiceLines counted and blocks production prep pack', () => {
  const r = report();
  assert.ok(countMissingChoiceLines(r) >= 1);
  assert.ok((r.summary.missingChoiceLines || 0) >= 1);
  const blocked = buildKitchenPrintPack(r, 'prep', { allowMissingDraft: false });
  assert.equal(blocked.blocked, true);
  assert.ok(blocked.html.includes('בחירה חסרה') || blocked.html.includes('לא להדפיס'));
  const draft = buildKitchenPrintPack(r, 'prep', { allowMissingDraft: true });
  assert.equal(draft.blocked, false);
  assert.ok(draft.html.includes('טיוטה'));
});

test('P1 prep HTML has required columns and separate sizes', () => {
  const r = report();
  const html = buildKitchenPrepPrintHtml(r, { allowMissingDraft: true });
  assert.ok(html.includes('dir="rtl"'));
  assert.ok(html.includes('גודל'));
  assert.ok(html.includes('הוכן'));
  assert.ok(html.includes('נארז'));
  assert.ok(html.includes('הערות'));
  assert.ok(html.includes('250'));
  assert.ok(html.includes('500'));
  assert.ok(html.includes('חומוס'));
});

test('P1 prep HTML splits by meal heading', () => {
  const orders = [
    {
      _id: 'aaaaaaaaaaaaaaaaaaaaaaaa',
      orderNumber: 'MG-MEAL-1',
      status: 'processing',
      orderType: 'shabbat',
      mealTime: 'evening',
      items: [{ name: 'חלות', quantity: 2, category: 'מאפים' }],
      customerDetails: {
        eventDate: '2026-08-10',
        deliveryMethod: 'delivery',
        fullName: 'בדיקה'
      }
    },
    {
      _id: 'bbbbbbbbbbbbbbbbbbbbbbbb',
      orderNumber: 'MG-MEAL-2',
      status: 'processing',
      orderType: 'shabbat',
      mealTime: 'morning',
      items: [{ name: 'סלט', quantity: 1, category: 'סלטים' }],
      customerDetails: {
        eventDate: '2026-08-10',
        deliveryMethod: 'pickup',
        fullName: 'בדיקה 2'
      }
    }
  ];
  const r = buildKitchenReportDto(
    orders,
    validateKitchenReportQuery({ startDate: '2026-08-10', endDate: '2026-08-10' })
  );
  const html = buildKitchenPrepPrintHtml(r, { allowMissingDraft: true });
  assert.ok(html.includes('ארוחה: ליל שבת') || html.includes('ליל שבת'));
  assert.ok(html.includes('ארוחה: שבת בבוקר') || html.includes('שבת בבוקר'));
  assert.ok(html.includes('day-block'));
  assert.ok(html.includes('meal-block'));
});

test('P2 order sheet includes size column and allergy-ready structure', () => {
  const r = report();
  const order = r.orderNotes[0];
  assert.ok(order);
  const html = buildKitchenOrderSheetHtml(order);
  assert.ok(html.includes('גודל'));
  assert.ok(html.includes('הוכן'));
  assert.ok(html.includes('נארז'));
});

test('P3 deltas collect changes after print cut', () => {
  const r = report();
  const before = collectPrintDeltas(r.orderNotes, '2026-08-10T11:00:00.000Z');
  assert.ok(before.length >= 1);
  const after = collectPrintDeltas(r.orderNotes, '2026-08-10T13:00:00.000Z');
  assert.equal(after.length, 0);
  const html = buildKitchenDeltasPrintHtml(before, {
    dayLabel: '2026-08-10',
    printedAt: '2026-08-10T11:00:00.000Z'
  });
  assert.ok(html.includes('שינויים'));
  assert.ok(html.includes('עודכן משקל') || html.includes('250'));
});

test('full print HTML SSOT matches prep pack columns; snapshot stable', () => {
  const r = report();
  const a = buildKitchenQtySnapshot(r);
  const b = buildKitchenQtySnapshot(r);
  assert.equal(a, b);
  const html = buildKitchenPrintHtml(r, { allowMissingDraft: true });
  assert.ok(html.includes('רשימת הכנות') || html.includes('גודל'));
  assert.ok(html.includes('250'));
  assert.ok(html.includes('500'));
});
