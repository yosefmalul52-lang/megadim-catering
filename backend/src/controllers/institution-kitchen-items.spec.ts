import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildInstitutionGenericKitchenItems,
  buildInstitutionShabbatKitchenItems,
  buildInstitutionWeekdayKitchenItems,
  portionsForInstitutionMenuCategory
} from '../utils/institution-kitchen-items.util';

test('weekday institution items expand menu dishes with portion rules', () => {
  const items = buildInstitutionWeekdayKitchenItems(
    {
      mainMeat: 'שניצלונים',
      vegetarianMain: 'שניצל חציל',
      carb1: 'אורז לבן',
      carb2: 'סירות תפוחי אדמה',
      side: 'לקט ירקות',
      saladFruit: 'סלט ירקות קצוץ'
    },
    20,
    2
  );
  assert.equal(portionsForInstitutionMenuCategory('mainMeat', 20, 2), 20);
  assert.equal(portionsForInstitutionMenuCategory('vegetarianMain', 20, 2), 2);
  assert.equal(portionsForInstitutionMenuCategory('carb1', 20, 2), 22);
  assert.ok(items.some((i) => i.name === 'שניצלונים' && i.quantity === 20));
  assert.ok(items.some((i) => i.name === 'שניצל חציל' && i.quantity === 2));
  assert.ok(items.some((i) => i.name === 'אורז לבן' && i.quantity === 22));
  assert.equal(items.some((i) => i.name.includes('מנה רגילה')), false);
});

test('weekday falls back to generic labels when menu empty', () => {
  const items = buildInstitutionGenericKitchenItems(20, 2, 'weekday');
  assert.deepEqual(
    items.map((i) => i.name),
    ['מנה רגילה (מוסד)', 'מנה צמחונית (מוסד)']
  );
});

test('shabbat institution items expand package dishes', () => {
  const items = buildInstitutionShabbatKitchenItems(
    {
      hasShabbat: true,
      fridayNight: {
        fish: 'מושט',
        mainMeat: 'אסאדו',
        vegetarianMain: '',
        carb1: 'אורז',
        carb2: '',
        side: 'ירקות'
      },
      shabbatDay: {
        mainMeat: 'פרגית',
        vegetarianMain: '',
        carb1: 'קוסקוס',
        carb2: '',
        side: ''
      },
      seudaShlishit: { carb: '', protein: '' },
      shabbatSalads: ['חומוס', 'טחינה', '', '', '', '']
    },
    { regularCount: 10, vegetarianCount: 0, wantsSeudaShlishit: false, extras: { challahs: 5 } }
  );
  assert.ok(items.some((i) => i.name === 'מושט'));
  assert.ok(items.some((i) => i.name === 'אסאדו' && i.quantity === 10));
  assert.ok(items.some((i) => i.name === 'פרגית'));
  assert.ok(items.some((i) => i.name === 'חומוס'));
  assert.ok(items.some((i) => i.name === 'חלות' && i.quantity === 5));
});
