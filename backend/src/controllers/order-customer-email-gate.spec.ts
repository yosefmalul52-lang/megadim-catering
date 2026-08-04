import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertOrderCustomerEmailsAllowedOrSuppress,
  isOrderCustomerEmailsEnabled,
  suppressOrderCustomerEmail
} from '../utils/order-customer-email-gate.util';

test('ORDER_CUSTOMER_EMAILS_ENABLED defaults to off', () => {
  const prev = process.env.ORDER_CUSTOMER_EMAILS_ENABLED;
  delete process.env.ORDER_CUSTOMER_EMAILS_ENABLED;
  assert.equal(isOrderCustomerEmailsEnabled(), false);
  const gate = assertOrderCustomerEmailsAllowedOrSuppress('unit');
  assert.equal('ok' in gate, false);
  if (!('ok' in gate)) {
    assert.equal(gate.suppressed, true);
    assert.equal(gate.sent, false);
    assert.equal(gate.skipped, 'emails_disabled');
  }
  if (prev === undefined) delete process.env.ORDER_CUSTOMER_EMAILS_ENABLED;
  else process.env.ORDER_CUSTOMER_EMAILS_ENABLED = prev;
});

test('ORDER_CUSTOMER_EMAILS_ENABLED=false is off', () => {
  const prev = process.env.ORDER_CUSTOMER_EMAILS_ENABLED;
  process.env.ORDER_CUSTOMER_EMAILS_ENABLED = 'false';
  assert.equal(isOrderCustomerEmailsEnabled(), false);
  const s = suppressOrderCustomerEmail('test');
  assert.equal(s.suppressed, true);
  if (prev === undefined) delete process.env.ORDER_CUSTOMER_EMAILS_ENABLED;
  else process.env.ORDER_CUSTOMER_EMAILS_ENABLED = prev;
});

test('ORDER_CUSTOMER_EMAILS_ENABLED=true enables', () => {
  const prev = process.env.ORDER_CUSTOMER_EMAILS_ENABLED;
  process.env.ORDER_CUSTOMER_EMAILS_ENABLED = 'true';
  assert.equal(isOrderCustomerEmailsEnabled(), true);
  assert.deepEqual(assertOrderCustomerEmailsAllowedOrSuppress('unit'), { ok: true });
  if (prev === undefined) delete process.env.ORDER_CUSTOMER_EMAILS_ENABLED;
  else process.env.ORDER_CUSTOMER_EMAILS_ENABLED = prev;
});
