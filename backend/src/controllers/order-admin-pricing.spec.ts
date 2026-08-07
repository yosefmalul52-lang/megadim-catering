/**
 * Admin order pricing + shabbat quote → admin override flow.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluatePaymentExceptions } from '../utils/admin-payments.util';
import {
  computeAdminRecalculatedTotals,
  getEffectiveOrderAmount,
  isGatewayLockedPaymentStatus
} from '../utils/order-admin-pricing.util';

test('events catering: portion×rate recalculates when item prices are 0', () => {
  const order = {
    orderType: 'catering',
    cateringKind: 'events',
    paymentStatus: 'pending',
    totalPrice: 0,
    subtotal: 0,
    deliveryFee: null,
    numberOfPortions: 25,
    guestCount: 25,
    customerDetails: { pricePerPortion: 70 },
    items: [
      { name: 'תפריט', price: 0, quantity: 1 },
      { name: 'סלט', price: 0, quantity: 1 }
    ]
  };
  const totals = computeAdminRecalculatedTotals(order);
  assert.equal(totals.source, 'portion_rate');
  assert.equal(totals.totalPrice, 1750);
  assert.equal(totals.subtotal, 1750);
  assert.equal(totals.locked, false);
});

test('events catering: priced item edits win over portion×rate quote', () => {
  const order = {
    orderType: 'catering',
    cateringKind: 'events',
    paymentStatus: 'pending',
    totalPrice: 1982,
    subtotal: 1982,
    deliveryFee: 0,
    numberOfPortions: 25,
    customerDetails: { pricePerPortion: 70 },
    items: [{ name: 'מנה', price: 50, quantity: 10 }]
  };
  const totals = computeAdminRecalculatedTotals(order, {
    items: [
      { name: 'מנה', price: 50, quantity: 20 },
      { name: 'תוספת', price: 1480, quantity: 1 }
    ]
  });
  assert.equal(totals.locked, false);
  assert.equal(totals.source, 'items_plus_delivery');
  assert.equal(totals.subtotal, 2480);
  assert.equal(totals.totalPrice, 2480);
});

test('shabbat starts at 0; admin override becomes effective amount; invalid_amount only when classic-paid', () => {
  const before = {
    orderType: 'catering',
    cateringKind: 'shabbat',
    paymentStatus: 'pending',
    totalPrice: 0,
    subtotal: 0,
    numberOfPortions: 60,
    items: [{ name: 'חומוס', price: 0, quantity: 1 }],
    customerDetails: {}
  };
  assert.equal(getEffectiveOrderAmount(before), 0);
  // Unpaid ₪0 quotes/drafts must not flood review — invalid_amount is classic-paid only.
  assert.equal(
    evaluatePaymentExceptions(before).some((e) => e.code === 'invalid_amount'),
    false
  );
  assert.ok(
    evaluatePaymentExceptions({
      ...before,
      paymentStatus: 'captured',
      transactionId: 'TX'
    }).some((e) => e.code === 'invalid_amount')
  );

  const afterOverride = {
    ...before,
    adminPriceOverride: 4800,
    adminPriceOverrideReason: 'הצעת מחיר מנהל',
    totalPrice: 4800,
    subtotal: 4800
  };
  assert.equal(getEffectiveOrderAmount(afterOverride), 4800);
  assert.equal(
    evaluatePaymentExceptions({
      ...afterOverride,
      paymentStatus: 'captured',
      transactionId: 'TX'
    }).some((e) => e.code === 'invalid_amount'),
    false
  );

  const recalc = computeAdminRecalculatedTotals(afterOverride, {
    items: afterOverride.items
  });
  assert.equal(recalc.source, 'admin_override');
  assert.equal(recalc.totalPrice, 4800);
});

test('captured totals stay locked; authorized recalculates for capture amount', () => {
  assert.equal(isGatewayLockedPaymentStatus('authorized'), false);
  assert.equal(isGatewayLockedPaymentStatus('captured'), true);

  const authorized = {
    orderType: 'shabbat',
    paymentStatus: 'authorized',
    totalPrice: 200,
    subtotal: 180,
    deliveryFee: 20,
    items: [{ name: 'חלה', price: 50, quantity: 2 }]
  };
  const authTotals = computeAdminRecalculatedTotals(authorized, {
    items: [{ name: 'חלה', price: 50, quantity: 10 }]
  });
  assert.equal(authTotals.locked, false);
  assert.equal(authTotals.source, 'items_plus_delivery');
  // discount preserved: prev 180+20-200=0 → 500+20
  assert.equal(authTotals.totalPrice, 520);

  const captured = { ...authorized, paymentStatus: 'captured' };
  const capTotals = computeAdminRecalculatedTotals(captured, {
    items: [{ name: 'חלה', price: 50, quantity: 10 }]
  });
  assert.equal(capTotals.locked, true);
  assert.equal(capTotals.totalPrice, 200);
  assert.equal(capTotals.source, 'unchanged');
});

test('retail items+delivery recalculation preserves discount', () => {
  const order = {
    orderType: 'shabbat',
    paymentStatus: 'pending',
    totalPrice: 90,
    subtotal: 100,
    deliveryFee: 10,
    items: [{ name: 'א', price: 50, quantity: 2 }]
  };
  const totals = computeAdminRecalculatedTotals(order, {
    items: [{ name: 'א', price: 40, quantity: 2 }],
    deliveryFee: 10
  });
  // previous discount = 100+10-90 = 20
  assert.equal(totals.source, 'items_plus_delivery');
  assert.equal(totals.subtotal, 80);
  assert.equal(totals.totalPrice, 70);
});

test('unlocked item edit recalculates retail total from new qty×price', () => {
  const order = {
    orderType: 'shabbat',
    paymentStatus: 'awaiting_payment',
    totalPrice: 34,
    subtotal: 34,
    deliveryFee: 0,
    items: [{ name: 'טחינה', price: 17, quantity: 2 }]
  };
  const totals = computeAdminRecalculatedTotals(order, {
    items: [{ name: 'טחינה', price: 17, quantity: 3 }]
  });
  assert.equal(totals.locked, false);
  assert.equal(totals.source, 'items_plus_delivery');
  assert.equal(totals.totalPrice, 51);
});

test('authorized item edit recalculates total for charge button', () => {
  const order = {
    orderType: 'shabbat',
    paymentStatus: 'authorized',
    totalPrice: 34,
    subtotal: 34,
    deliveryFee: 0,
    items: [{ name: 'טחינה', price: 17, quantity: 2 }]
  };
  const totals = computeAdminRecalculatedTotals(order, {
    items: [{ name: 'טחינה', price: 17, quantity: 9 }]
  });
  assert.equal(totals.locked, false);
  assert.equal(totals.source, 'items_plus_delivery');
  assert.equal(totals.totalPrice, 153);
});

test('captured item edit keeps total locked', () => {
  const order = {
    orderType: 'shabbat',
    paymentStatus: 'captured',
    totalPrice: 34,
    subtotal: 34,
    items: [{ name: 'טחינה', price: 17, quantity: 2 }]
  };
  const totals = computeAdminRecalculatedTotals(order, {
    items: [{ name: 'טחינה', price: 17, quantity: 9 }]
  });
  assert.equal(totals.locked, true);
  assert.equal(totals.totalPrice, 34);
});

test('effective amount prefers adminPriceOverride over zero totalPrice', () => {
  assert.equal(
    getEffectiveOrderAmount({ totalPrice: 0, adminPriceOverride: 123.45 }),
    123.45
  );
  assert.equal(getEffectiveOrderAmount({ totalPrice: 50 }), 50);
});
