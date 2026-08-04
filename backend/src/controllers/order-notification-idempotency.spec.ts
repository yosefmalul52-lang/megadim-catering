import assert from 'node:assert/strict';
import test from 'node:test';
import { ORDER_NOTIFICATION_TYPES } from '../models/OrderNotificationClaim';

/**
 * Unit-level idempotency contract for notification claims.
 * Unique key: orderId + emailEventType + recipient
 */
function createClaimStore() {
  const docs = new Map<string, { status: 'pending' | 'sent' | 'failed'; attempts: number }>();
  const keyOf = (orderId: string, emailEventType: string, recipient: string) =>
    `${orderId}::${emailEventType}::${String(recipient).toLowerCase()}`;

  return {
    acquire(orderId: string, emailEventType: string, recipient: string) {
      const key = keyOf(orderId, emailEventType, recipient);
      const existing = docs.get(key);
      if (existing?.status === 'sent') return { action: 'skip_already_sent' as const };
      const attempts = (existing?.attempts || 0) + 1;
      docs.set(key, { status: 'pending', attempts });
      return { action: 'send' as const, attempts };
    },
    markSent(orderId: string, emailEventType: string, recipient: string) {
      const key = keyOf(orderId, emailEventType, recipient);
      const existing = docs.get(key) || { status: 'pending' as const, attempts: 1 };
      docs.set(key, { ...existing, status: 'sent' });
    },
    markFailed(orderId: string, emailEventType: string, recipient: string) {
      const key = keyOf(orderId, emailEventType, recipient);
      const existing = docs.get(key) || { status: 'pending' as const, attempts: 1 };
      docs.set(key, { ...existing, status: 'failed' });
    },
    get(orderId: string, emailEventType: string, recipient: string) {
      return docs.get(keyOf(orderId, emailEventType, recipient));
    }
  };
}

test('duplicate approval claim for same recipient is blocked after sent', () => {
  const store = createClaimStore();
  const orderId = 'order-1';
  const type = ORDER_NOTIFICATION_TYPES.ORDER_APPROVED;
  const recipient = 'a@example.com';
  assert.equal(store.acquire(orderId, type, recipient).action, 'send');
  store.markSent(orderId, type, recipient);
  assert.equal(store.acquire(orderId, type, recipient).action, 'skip_already_sent');
});

test('unique key includes recipient — different recipients are independent', () => {
  const store = createClaimStore();
  const type = ORDER_NOTIFICATION_TYPES.ORDER_RECEIVED;
  assert.equal(store.acquire('o1', type, 'owner@x.com').action, 'send');
  assert.equal(store.acquire('o1', type, 'customer@x.com').action, 'send');
  store.markSent('o1', type, 'owner@x.com');
  assert.equal(store.acquire('o1', type, 'owner@x.com').action, 'skip_already_sent');
  assert.equal(store.acquire('o1', type, 'customer@x.com').action, 'send');
});

test('SMTP failure keeps same event for retry (no duplicate key)', () => {
  const store = createClaimStore();
  const type = ORDER_NOTIFICATION_TYPES.ORDER_APPROVED;
  assert.equal(store.acquire('o2', type, 'c@x.com').action, 'send');
  store.markFailed('o2', type, 'c@x.com');
  const retry = store.acquire('o2', type, 'c@x.com');
  assert.equal(retry.action, 'send');
  assert.equal(retry.attempts, 2);
  store.markSent('o2', type, 'c@x.com');
  assert.equal(store.get('o2', type, 'c@x.com')?.status, 'sent');
});

test('order_received and order_approved are distinct event types', () => {
  assert.equal(ORDER_NOTIFICATION_TYPES.ORDER_RECEIVED, 'order_received');
  assert.equal(ORDER_NOTIFICATION_TYPES.ORDER_APPROVED, 'order_approved');
  assert.notEqual(ORDER_NOTIFICATION_TYPES.ORDER_RECEIVED, ORDER_NOTIFICATION_TYPES.ORDER_APPROVED);
});

test('items updates do not use order_approved notification type', () => {
  assert.notEqual(ORDER_NOTIFICATION_TYPES.ORDER_ITEMS_UPDATED, ORDER_NOTIFICATION_TYPES.ORDER_APPROVED);
});
