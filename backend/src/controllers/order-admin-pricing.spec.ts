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

test('authorized/captured totals stay locked on recalculation', () => {
  assert.equal(isGatewayLockedPaymentStatus('authorized'), true);
  assert.equal(isGatewayLockedPaymentStatus('captured'), true);
  const order = {
    orderType: 'shabbat',
    paymentStatus: 'authorized',
    totalPrice: 200,
    subtotal: 180,
    deliveryFee: 20,
    items: [{ name: 'חלה', price: 50, quantity: 2 }]
  };
  const totals = computeAdminRecalculatedTotals(order, {
    items: [{ name: 'חלה', price: 50, quantity: 10 }]
  });
  assert.equal(totals.locked, true);
  assert.equal(totals.totalPrice, 200);
  assert.equal(totals.source, 'unchanged');
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

test('effective amount prefers adminPriceOverride over zero totalPrice', () => {
  assert.equal(
    getEffectiveOrderAmount({ totalPrice: 0, adminPriceOverride: 123.45 }),
    123.45
  );
  assert.equal(getEffectiveOrderAmount({ totalPrice: 50 }), 50);
});
