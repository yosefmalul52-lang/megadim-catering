import assert from 'node:assert/strict';
import test from 'node:test';
import { applyOpsStatusTimestamps } from '../utils/order-lifecycle-timestamps.util';
import { applyReviewRequestOnStatusChange } from '../utils/review-request-email.util';
import { buildAdminStatusChangeUpdate } from '../utils/order-admin-status.util';

test('ready → delivered stamps completedAt but does not auto-schedule review email', () => {
  const now = new Date('2026-08-05T06:00:00.000Z');
  const built = buildAdminStatusChangeUpdate({
    previousStatus: 'ready',
    nextStatus: 'delivered',
    previousPaymentStatus: 'captured',
    changedBy: 'admin',
    orderHasOpenPaymentException: false,
    now,
    priorTimestamps: {}
  });
  assert.equal(built.$set.status, 'delivered');
  assert.equal(built.$set.completedAt, now);
  assert.equal(built.$set.reviewRequestEmailStatus, undefined);
  assert.equal(built.$set.reviewRequestEmailDueAt, undefined);
});

test('transition to completed status sets completedAt without review schedule', () => {
  const now = new Date('2026-08-05T06:00:00.000Z');
  const $set: Record<string, unknown> = { status: 'completed' };
  applyOpsStatusTimestamps({
    $set,
    previousStatus: 'ready',
    nextStatus: 'completed',
    prior: {},
    now
  });
  assert.equal($set.completedAt, now);
  applyReviewRequestOnStatusChange({
    $set,
    previousStatus: 'ready',
    nextStatus: 'completed',
    prior: {},
    now
  });
  assert.equal($set.reviewRequestEmailStatus, undefined);
  assert.equal($set.reviewRequestEmailDueAt, undefined);
});

test('cancel marks pending review schedule as cancelled', () => {
  const $set: Record<string, unknown> = { status: 'cancelled' };
  applyReviewRequestOnStatusChange({
    $set,
    previousStatus: 'delivered',
    nextStatus: 'cancelled',
    prior: {
      reviewRequestEmailStatus: 'pending',
      reviewRequestEmailDueAt: new Date()
    }
  });
  assert.equal($set.reviewRequestEmailStatus, 'cancelled');
  assert.equal($set.reviewRequestEmailDueAt, null);
});

test('already-sent review email is left alone on cancel', () => {
  const $set: Record<string, unknown> = { status: 'cancelled' };
  applyReviewRequestOnStatusChange({
    $set,
    previousStatus: 'delivered',
    nextStatus: 'cancelled',
    prior: {
      reviewRequestEmailSentAt: new Date('2026-01-01T00:00:00.000Z'),
      reviewRequestEmailStatus: 'sent'
    }
  });
  assert.equal($set.reviewRequestEmailStatus, undefined);
});
