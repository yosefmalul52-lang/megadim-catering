/**
 * Private quotes — category-aligned packages (events / catering_shabbat / shabbat_ready).
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyPrivatePackageToQuoteFields,
  buildPrivateWhatsAppText,
  computeEventsRatePerPortion,
  computePrivatePackageTotal,
  getDefaultPackageForCategory,
  getPrivateTemplate,
  normalizePrivatePackage,
  resolveTemplateKey
} from '../utils/quote-private.util';

test('legacy template keys remap to new package keys', () => {
  assert.equal(resolveTemplateKey('shabbat_basic'), 'two_meals');
  assert.equal(resolveTemplateKey('shabbat_premium'), 'premium_hosted');
});

test('site packages: one meal 70, two meals 135, premium 255', () => {
  assert.equal(getPrivateTemplate('one_meal').basePricePerPortion, 70);
  assert.equal(getPrivateTemplate('one_meal').saladsCount, 6);
  assert.equal(getPrivateTemplate('two_meals').basePricePerPortion, 135);
  assert.equal(getPrivateTemplate('two_meals').saladsCount, 8);
  assert.equal(getPrivateTemplate('premium_hosted').basePricePerPortion, 255);
});

test('events rate: base 70 + upgrades matches site configurator', () => {
  const pkg = normalizePrivatePackage({
    serviceCategory: 'events',
    templateKey: 'events_base',
    basePricePerPortion: 70,
    portions: 40,
    includeFirstCourse: true,
    includeDesserts: true,
    receptionBar: 'premium',
    includeKosherUpgrade: true,
    kosherPricePerPortion: 7
  });
  // 70 + 20 + 8 + 45 + 7 = 150
  assert.equal(computeEventsRatePerPortion(pkg), 150);
  assert.equal(computePrivatePackageTotal(pkg), 6000);
});

test('catering shabbat two_meals total with site upgrades', () => {
  const pkg = normalizePrivatePackage({
    serviceCategory: 'catering_shabbat',
    templateKey: 'two_meals',
    portionsEvening: 10,
    portionsMorning: 10,
    portions: 10,
    basePricePerPortion: 135,
    includeThirdMeal: true,
    thirdMealPricePerPortion: 25,
    includeAppetizerUpgrade: true,
    appetizerPricePerPortion: 20,
    appetizerMealsCount: 2,
    includeFishUpgrade: true,
    fishPricePerPortion: 18,
    includeDessertUpgrade: true,
    dessertPricePerPortion: 8,
    dessertMealsCount: 2,
    includeKosherUpgrade: true,
    kosherPricePerPortion: 7,
    kosherMealsCount: 2
  });
  // 1350 + 250 + 400 + 180 + 160 + 140 = 2480
  assert.equal(computePrivatePackageTotal(pkg), 2480);
});

test('ready food totals itemized lines + delivery', () => {
  const pkg = normalizePrivatePackage({
    serviceCategory: 'shabbat_ready',
    templateKey: 'itemized',
    readyLines: [
      { description: 'סלט חומוס', quantity: 2, unitPrice: 45 },
      { description: 'צ׳ולנט', quantity: 1, unitPrice: 120 }
    ],
    deliveryFee: 50
  });
  assert.equal(computePrivatePackageTotal(pkg), 260);
});

test('WhatsApp text is category-specific', () => {
  const events = buildPrivateWhatsAppText(
    getDefaultPackageForCategory('events')
  );
  assert.match(events, /קייטרינג לאירועים/);

  const shabbat = buildPrivateWhatsAppText(getPrivateTemplate('two_meals'));
  assert.match(shabbat, /קייטרינג לאירועי שבת וחג/);
  assert.match(shabbat, /135/);

  const ready = buildPrivateWhatsAppText(
    normalizePrivatePackage({
      serviceCategory: 'shabbat_ready',
      templateKey: 'itemized',
      readyLines: [{ description: 'דג', quantity: 1, unitPrice: 80 }]
    })
  );
  assert.match(ready, /אוכל מוכן לשבת וחג/);
  assert.match(ready, /דג/);
});

test('legacy shabbat_premium still loads via normalize', () => {
  const pkg = normalizePrivatePackage({ templateKey: 'shabbat_premium', portions: 12 });
  assert.equal(pkg.serviceCategory, 'catering_shabbat');
  assert.equal(pkg.templateKey, 'premium_hosted');
  assert.equal(pkg.basePricePerPortion, 255);
  const text = buildPrivateWhatsAppText(pkg);
  assert.match(text, /פרימיום/);
});

test('applyPrivatePackageToQuoteFields fills totals and whatsappText', () => {
  const result = applyPrivatePackageToQuoteFields({
    serviceCategory: 'events',
    templateKey: 'events_base',
    portions: 20,
    basePricePerPortion: 70
  });
  assert.equal(result.totalInclVat, 1400);
  assert.ok(result.privatePackage.whatsappText.includes('קייטרינג לאירועים'));
  assert.ok(result.lines.some((l) => l.sku === 'EVENTS'));
});
