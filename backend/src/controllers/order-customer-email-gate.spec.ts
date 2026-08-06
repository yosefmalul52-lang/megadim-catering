/**
 * ORDER_CUSTOMER_EMAILS_ENABLED gate behaviour.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertOrderCustomerEmailsAllowedOrSuppress,
  isOrderCustomerEmailsEnabled,
  suppressOrderCustomerEmail
} from '../utils/order-customer-email-gate.util';

test('ORDER_CUSTOMER_EMAILS_ENABLED unset defaults to off outside production', () => {
  const prev = process.env.ORDER_CUSTOMER_EMAILS_ENABLED;
  const prevNode = process.env.NODE_ENV;
  delete process.env.ORDER_CUSTOMER_EMAILS_ENABLED;
  process.env.NODE_ENV = 'test';
  assert.equal(isOrderCustomerEmailsEnabled(), false);
  const gate = assertOrderCustomerEmailsAllowedOrSuppress('unit');
  assert.equal('ok' in gate, false);
  if (prev === undefined) delete process.env.ORDER_CUSTOMER_EMAILS_ENABLED;
  else process.env.ORDER_CUSTOMER_EMAILS_ENABLED = prev;
  if (prevNode === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = prevNode;
});

test('ORDER_CUSTOMER_EMAILS_ENABLED unset defaults to on in production', () => {
  const prev = process.env.ORDER_CUSTOMER_EMAILS_ENABLED;
  const prevNode = process.env.NODE_ENV;
  delete process.env.ORDER_CUSTOMER_EMAILS_ENABLED;
  process.env.NODE_ENV = 'production';
  assert.equal(isOrderCustomerEmailsEnabled(), true);
  assert.deepEqual(assertOrderCustomerEmailsAllowedOrSuppress('unit'), { ok: true });
  if (prev === undefined) delete process.env.ORDER_CUSTOMER_EMAILS_ENABLED;
  else process.env.ORDER_CUSTOMER_EMAILS_ENABLED = prev;
  if (prevNode === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = prevNode;
});

test('ORDER_CUSTOMER_EMAILS_ENABLED=false is off even in production', () => {
  const prev = process.env.ORDER_CUSTOMER_EMAILS_ENABLED;
  const prevNode = process.env.NODE_ENV;
  process.env.ORDER_CUSTOMER_EMAILS_ENABLED = 'false';
  process.env.NODE_ENV = 'production';
  assert.equal(isOrderCustomerEmailsEnabled(), false);
  const s = suppressOrderCustomerEmail('test');
  assert.equal(s.suppressed, true);
  if (prev === undefined) delete process.env.ORDER_CUSTOMER_EMAILS_ENABLED;
  else process.env.ORDER_CUSTOMER_EMAILS_ENABLED = prev;
  if (prevNode === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = prevNode;
});

test('ORDER_CUSTOMER_EMAILS_ENABLED=true enables', () => {
  const prev = process.env.ORDER_CUSTOMER_EMAILS_ENABLED;
  process.env.ORDER_CUSTOMER_EMAILS_ENABLED = 'true';
  assert.deepEqual(assertOrderCustomerEmailsAllowedOrSuppress('unit'), { ok: true });
  if (prev === undefined) delete process.env.ORDER_CUSTOMER_EMAILS_ENABLED;
  else process.env.ORDER_CUSTOMER_EMAILS_ENABLED = prev;
});
