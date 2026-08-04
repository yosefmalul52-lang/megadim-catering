/**
 * Selection options round-trip + kitchen aggregation by variant fingerprint.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dishIdentityKeyFromItem,
  extractBaseProductId,
  findMatchingPricingOption,
  formatItemDisplayName,
  itemVariantFingerprint,
  kitchenMissingChoiceLabel,
  normalizeSelectedOption,
  parseCompositeSizeIndex,
  parseOptionFromItemName,
  resolveSelectedOptionForUpdate
} from '../utils/order-item-options.util';
import {
  buildKitchenReportDto,
  dishIdentityKey,
  kitchenReportToCsv,
  parseUnitFromItem,
  resolveKitchenOptionLabels,
  sortKitchenLinesByDishThenSize,
  validateKitchenReportQuery
} from '../utils/kitchen-report.util';

const PRODUCT_ID = '6953f955a1b2c3d4e5f60789';

test('parseOptionFromItemName: paren size and dash variant', () => {
  assert.deepEqual(parseOptionFromItemName('טחינה פיקנטית אדומה (250 מ"ל - 250)'), {
    baseName: 'טחינה פיקנטית אדומה',
    label: '250 מ"ל',
    amount: '250'
  });
  assert.deepEqual(parseOptionFromItemName('סלט כרוב (1 ליטר)'), {
    baseName: 'סלט כרוב',
    label: '1 ליטר',
    amount: '1 ליטר'
  });
  assert.deepEqual(parseOptionFromItemName('חומוס - קטן'), {
    baseName: 'חומוס',
    label: 'קטן'
  });
});

test('parseOptionFromItemName: product nickname is not a size (טירשי)', () => {
  assert.deepEqual(parseOptionFromItemName('חמוצי מגדים (טירשי)'), {
    baseName: 'חמוצי מגדים (טירשי)'
  });
  assert.deepEqual(parseOptionFromItemName('חמוצי מגדים (טירשי) (500 מ"ל - 500)'), {
    baseName: 'חמוצי מגדים (טירשי)',
    label: '500 מ"ל',
    amount: '500'
  });
  assert.equal(
    resolveKitchenOptionLabels(
      { name: 'חמוצי מגדים (טירשי)', price: 17, productId: '6953f95562a18d63c3d0db42' },
      [
        { label: '250 מ"ל', amount: '250', price: 17 },
        { label: '500 מ"ל', amount: '500', price: 29 }
      ]
    ).optionLabel,
    '250 מ"ל'
  );
  assert.equal(
    resolveKitchenOptionLabels(
      {
        name: 'חמוצי מגדים (טירשי) (500 מ"ל - 500)',
        price: 29,
        productId: '6953f95562a18d63c3d0db42-size-1'
      },
      [
        { label: '250 מ"ל', amount: '250', price: 17 },
        { label: '500 מ"ל', amount: '500', price: 29 }
      ]
    ).optionLabel,
    '500 מ"ל'
  );
});

test('composite productId size index wins over nickname / missing selectedOption', () => {
  const labels = resolveKitchenOptionLabels(
    {
      name: 'חמוצי מגדים (טירשי)',
      price: 0,
      productId: `${PRODUCT_ID}-size-1`
    },
    [
      { label: '250 מ"ל', amount: '250', price: 17 },
      { label: '500 מ"ל', amount: '500', price: 29 }
    ]
  );
  assert.equal(labels.optionLabel, '500 מ"ל');
  assert.equal(labels.sizeLabel, '500');
});

test('ambiguous price does not invent a size', () => {
  const labels = resolveKitchenOptionLabels(
    { name: 'חמוצי מגדים (טירשי)', price: 0 },
    [
      { label: '250 מ"ל', amount: '250', price: 17 },
      { label: '500 מ"ל', amount: '500', price: 29 }
    ]
  );
  assert.equal(labels.optionLabel, 'בחירה חסרה לבדיקה');
});

test('composite productId size index', () => {
  assert.equal(extractBaseProductId(`${PRODUCT_ID}-size-0`), PRODUCT_ID);
  assert.equal(parseCompositeSizeIndex(`${PRODUCT_ID}-size-0`), 0);
  assert.equal(parseCompositeSizeIndex(`${PRODUCT_ID}-size-3`), 3);
  assert.equal(parseCompositeSizeIndex(PRODUCT_ID), null);
});

test('admin qty-only edit preserves existing selectedOption when field omitted', () => {
  const existing = {
    productId: PRODUCT_ID,
    name: 'סלט כרוב (500 מ"ל)',
    price: 40,
    selectedOption: { label: '500 מ"ל', amount: '500 מ"ל', price: 40, optionId: '0' }
  };
  const resolved = resolveSelectedOptionForUpdate({
    incoming: { productId: PRODUCT_ID, name: 'סלט כרוב (500 מ"ל)', quantity: 7, price: 40 },
    existing,
    hasSelectedOptionKey: false
  });
  assert.equal(resolved?.label, '500 מ"ל');
  assert.equal(resolved?.optionId, '0');
});

test('admin notes-only edit preserves option; explicit option change updates', () => {
  const existing = {
    name: 'סלט כרוב',
    selectedOption: { label: '500 מ"ל', amount: '500 מ"ל', price: 40 }
  };
  const notesOnly = resolveSelectedOptionForUpdate({
    incoming: { name: 'סלט כרוב', description: 'בלי בצל', quantity: 4 },
    existing,
    hasSelectedOptionKey: false
  });
  assert.equal(notesOnly?.label, '500 מ"ל');

  const changed = resolveSelectedOptionForUpdate({
    incoming: {
      name: 'סלט כרוב',
      quantity: 4,
      selectedOption: { label: '1 ליטר', amount: '1 ליטר', price: 55 }
    },
    existing,
    hasSelectedOptionKey: true
  });
  assert.equal(changed?.label, '1 ליטר');
});

test('legacy name-only order recovers option snapshot without auto-migrating ids', () => {
  const fromName = normalizeSelectedOption(undefined, {
    name: 'טחינה פיקנטית אדומה (250 מ"ל - 250)',
    price: 28
  });
  assert.equal(fromName?.label, '250 מ"ל');
  assert.equal(fromName?.amount, '250');
  assert.equal(fromName?.optionId, undefined);
});

test('fingerprint separates same dish different sizes; merges identical choice', () => {
  const a = {
    productId: PRODUCT_ID,
    name: 'סלט כרוב',
    category: 'סלטים',
    selectedOption: { label: '500 מ"ל', amount: '500 מ"ל' }
  };
  const b = {
    productId: PRODUCT_ID,
    name: 'סלט כרוב',
    category: 'סלטים',
    selectedOption: { label: '1 ליטר', amount: '1 ליטר' }
  };
  const c = {
    productId: PRODUCT_ID,
    name: 'סלט כרוב (500 מ"ל)',
    category: 'סלטים',
    selectedOption: { label: '500 מ"ל', amount: '500 מ"ל' }
  };
  assert.notEqual(itemVariantFingerprint(a), itemVariantFingerprint(b));
  assert.equal(itemVariantFingerprint(a), itemVariantFingerprint(c));
  assert.notEqual(dishIdentityKey(a), dishIdentityKey(b));
});

test('kitchen report keeps 500ml×4 and 1L×3 separate; identical rows sum', () => {
  const orders = [
    {
      _id: 'o1',
      orderNumber: 'MG-TEST-1',
      status: 'processing',
      customerDetails: { eventDate: '2026-08-10', fullName: 'א', deliveryType: 'pickup' },
      items: [
        {
          productId: PRODUCT_ID,
          name: 'סלט כרוב',
          quantity: 4,
          category: 'סלטים',
          selectedOption: { label: '500 מ"ל', amount: '500 מ"ל' }
        },
        {
          productId: PRODUCT_ID,
          name: 'סלט כרוב',
          quantity: 3,
          category: 'סלטים',
          selectedOption: { label: '1 ליטר', amount: '1 ליטר' }
        }
      ]
    },
    {
      _id: 'o2',
      orderNumber: 'MG-TEST-2',
      status: 'processing',
      customerDetails: { eventDate: '2026-08-10', fullName: 'ב', deliveryType: 'pickup' },
      items: [
        {
          productId: PRODUCT_ID,
          name: 'סלט כרוב (500 מ"ל)',
          quantity: 2,
          category: 'סלטים',
          selectedOption: { label: '500 מ"ל', amount: '500 מ"ל' }
        }
      ]
    }
  ];

  const filters = validateKitchenReportQuery({ startDate: '2026-08-10', endDate: '2026-08-10' });
  const report = buildKitchenReportDto(orders as any, filters, new Map());

  const dishes = report.preparationGroups.flatMap((pg) => pg.meals.flatMap((m) => m.dishes));
  const byOption = new Map(dishes.map((d) => [d.optionLabel || d.sizeLabel, d.quantity]));
  assert.equal(byOption.get('500 מ"ל'), 6);
  assert.equal(byOption.get('1 ליטר'), 3);
  assert.equal(dishes.length >= 2, true);

  const csv = kitchenReportToCsv(report);
  assert.ok(csv.includes('500') && csv.includes('1 ליטר'));
  assert.ok(csv.includes(',6,') && csv.includes(',3,'));
  assert.doesNotMatch(csv, /סלט כרוב,,7/);
});

test('legacy size-in-name lines stay separate after option stripped from structured field', () => {
  const a = dishIdentityKeyFromItem({
    productId: PRODUCT_ID,
    name: 'סלט כרוב (500 מ"ל)',
    category: 'סלטים'
  });
  const b = dishIdentityKeyFromItem({
    productId: PRODUCT_ID,
    name: 'סלט כרוב (1 ליטר)',
    category: 'סלטים'
  });
  assert.notEqual(a, b);

  const labels = resolveKitchenOptionLabels({ name: 'סלט כרוב (500 מ"ל)' });
  assert.equal(labels.optionLabel, '500 מ"ל');
});

test('missing choice is flagged, not guessed', () => {
  assert.equal(
    kitchenMissingChoiceLabel({
      name: 'סלט',
      selectedOption: { missingForReview: true, label: 'ישן' }
    }),
    'בחירה חסרה לבדיקה'
  );
  assert.equal(
    resolveKitchenOptionLabels({
      name: 'סלט',
      selectedOption: { missingForReview: true, label: 'ישן' }
    }).optionLabel,
    'בחירה חסרה לבדיקה'
  );
});

test('infers size from catalog unit price when selectedOption missing', () => {
  const catalog = [
    { label: '250 מ"ל', amount: '250', price: 17 },
    { label: '500 מ"ל', amount: '500', price: 29 }
  ];
  const labels = resolveKitchenOptionLabels({ name: 'חומוס', price: 17 }, catalog);
  assert.equal(labels.optionLabel, '250 מ"ל');
  assert.equal(labels.sizeLabel, '250');

  const big = resolveKitchenOptionLabels({ name: 'חומוס', price: 29 }, catalog);
  assert.equal(big.optionLabel, '500 מ"ל');
  assert.equal(big.sizeLabel, '500');

  const ambiguous = resolveKitchenOptionLabels({ name: 'חומוס' }, catalog);
  assert.equal(ambiguous.optionLabel, 'בחירה חסרה לבדיקה');
});

test('kitchen qty unit is packages (יח\'), never container ml/kg', () => {
  assert.equal(
    parseUnitFromItem({
      name: 'חומוס',
      quantity: 2,
      selectedOption: { label: '250 מ"ל', amount: '250' }
    }),
    "יח'"
  );
  assert.equal(
    parseUnitFromItem({
      name: 'חמוצי מגדים (טירשי)',
      selectedOption: { label: '500 מ"ל', amount: '500' }
    }),
    "יח'"
  );
});

test('same dish different sizes stay separate and sort adjacent', () => {
  const sorted = sortKitchenLinesByDishThenSize([
    { name: 'חומוס', category: 'סלטים', optionLabel: '500 מ"ל', sizeLabel: '500' },
    { name: 'טחינה', category: 'סלטים', optionLabel: '250 מ"ל', sizeLabel: '250' },
    { name: 'חומוס', category: 'סלטים', optionLabel: '250 מ"ל', sizeLabel: '250' }
  ]);
  assert.equal(sorted[0].name, 'חומוס');
  assert.equal(sorted[0].sizeLabel, '250');
  assert.equal(sorted[1].name, 'חומוס');
  assert.equal(sorted[1].sizeLabel, '500');
  assert.equal(sorted[2].name, 'טחינה');
});

test('formatItemDisplayName encodes size without relying on dish name alone', () => {
  assert.equal(
    formatItemDisplayName('סלט כרוב', { label: '500 מ"ל', amount: '500 מ"ל' }),
    'סלט כרוב (500 מ"ל)'
  );
  assert.equal(
    formatItemDisplayName('טחינה', { label: '250 מ"ל', amount: '250' }),
    'טחינה (250 מ"ל - 250)'
  );
});

test('round-trip: re-save with same option does not clear fingerprint', () => {
  const existing = {
    productId: PRODUCT_ID,
    name: 'סלט כרוב (500 מ"ל)',
    selectedOption: { label: '500 מ"ל', amount: '500 מ"ל', price: 40, optionId: '1' }
  };
  const first = resolveSelectedOptionForUpdate({
    incoming: {
      productId: PRODUCT_ID,
      name: 'סלט כרוב (500 מ"ל)',
      quantity: 5,
      selectedOption: { label: '500 מ"ל', amount: '500 מ"ל', price: 40, optionId: '1' }
    },
    existing,
    hasSelectedOptionKey: true
  });
  const second = resolveSelectedOptionForUpdate({
    incoming: {
      productId: PRODUCT_ID,
      name: formatItemDisplayName('סלט כרוב', first),
      quantity: 5,
      selectedOption: first
    },
    existing: { ...existing, selectedOption: first },
    hasSelectedOptionKey: true
  });
  assert.equal(first?.label, second?.label);
  assert.equal(first?.optionId, second?.optionId);
  assert.equal(
    itemVariantFingerprint({ ...existing, selectedOption: first }),
    itemVariantFingerprint({ ...existing, name: formatItemDisplayName('סלט כרוב', second), selectedOption: second })
  );
});

test('findMatchingPricingOption: shared label must not collapse 500→250 (min)', () => {
  const options = [
    { label: 'רגיל', amount: '250', price: 17 },
    { label: 'רגיל', amount: '500', price: 29 }
  ];
  const matched = findMatchingPricingOption(options, { label: 'רגיל', amount: '500' });
  assert.ok(matched);
  assert.equal(matched!.index, 1);
  assert.equal(String(matched!.option.amount), '500');
  assert.equal(Number(matched!.option.price), 29);

  // Ambiguous label without amount — refuse guessing the minimum
  assert.equal(findMatchingPricingOption(options, { label: 'רגיל' }), null);
});

test('findMatchingPricingOption: hummus 500g/ml stays on 500 not catalog min', () => {
  const options = [
    { label: '250 מ"ל', amount: '250', price: 17 },
    { label: '500 מ"ל', amount: '500', price: 29 }
  ];
  const byLabel = findMatchingPricingOption(options, { label: '500 מ"ל', amount: '500' });
  assert.equal(byLabel?.index, 1);
  assert.equal(Number(byLabel?.option.price), 29);

  const byAmountOnly = findMatchingPricingOption(options, { label: 'חומוס', amount: '500' });
  assert.equal(byAmountOnly?.index, 1);

  const gramsAlias = findMatchingPricingOption(options, {
    label: '500 גרם',
    amount: '500 גרם'
  });
  assert.equal(gramsAlias?.index, 1);

  const legacyNumericAmount = findMatchingPricingOption(options, {
    label: '500 מ"ל',
    amount: 500 as unknown as string
  });
  assert.equal(legacyNumericAmount?.index, 1);

  const min = findMatchingPricingOption(options, { label: '250 מ"ל', amount: '250' });
  assert.equal(min?.index, 0);
});

test('normalizeSelectedOption accepts numeric legacy amount', () => {
  const snap = normalizeSelectedOption(
    { label: '500 מ"ל', amount: 500, price: 29 },
    { name: 'חומוס', price: 29 }
  );
  assert.equal(snap?.label, '500 מ"ל');
  assert.equal(snap?.amount, '500');
  assert.equal(snap?.price, 29);
});
