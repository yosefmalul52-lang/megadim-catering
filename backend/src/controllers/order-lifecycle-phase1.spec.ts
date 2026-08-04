/**
 * Phase 1: lifecycle timestamps, archive gate, restore preserves status.
 * Does not change revenue calculation formulas.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyCaptureTimestamps,
  applyManualPaidTimestamps,
  applyOpsStatusTimestamps,
  canArchiveOrderByStatus,
  setTimestampIfAbsent
} from '../utils/order-lifecycle-timestamps.util';
import {
  buildAdminStatusChangeUpdate,
  resolveAdminStatusTab
} from '../utils/order-admin-status.util';
import { buildActualRevenueMatch, orderContributesActualRevenue } from '../utils/business-metrics.util';

const now = new Date('2026-08-04T12:00:00.000Z');
const earlier = new Date('2026-08-01T08:00:00.000Z');

test('pending → processing does not set completion timestamps', () => {
  const $set: Record<string, unknown> = { status: 'processing' };
  applyOpsStatusTimestamps({
    $set,
    previousStatus: 'pending',
    nextStatus: 'processing',
    prior: {},
    now
  });
  assert.equal($set.readyAt, undefined);
  assert.equal($set.completedAt, undefined);
  assert.equal($set.cancelledAt, undefined);
});

test('processing → ready sets readyAt once; retry does not overwrite', () => {
  const $set1: Record<string, unknown> = { status: 'ready' };
  applyOpsStatusTimestamps({
    $set: $set1,
    previousStatus: 'processing',
    nextStatus: 'ready',
    prior: {},
    now
  });
  assert.equal($set1.readyAt, now);

  const $set2: Record<string, unknown> = { status: 'ready' };
  applyOpsStatusTimestamps({
    $set: $set2,
    previousStatus: 'processing',
    nextStatus: 'ready',
    prior: { readyAt: earlier },
    now
  });
  assert.equal($set2.readyAt, undefined);
  setTimestampIfAbsent($set2, 'readyAt', earlier, now);
  assert.equal($set2.readyAt, undefined);
});

test('ready → delivered sets completedAt; tab is completed', () => {
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
  assert.equal(
    resolveAdminStatusTab({
      status: 'delivered',
      paymentStatus: 'captured',
      completedAt: now,
      isDeleted: false
    }),
    'completed'
  );
});

test('pickup and delivery completion use the same delivered status', () => {
  const pickup = buildAdminStatusChangeUpdate({
    previousStatus: 'ready',
    nextStatus: 'delivered',
    previousPaymentStatus: 'captured',
    changedBy: 'admin',
    orderHasOpenPaymentException: false,
    now
  });
  const delivery = buildAdminStatusChangeUpdate({
    previousStatus: 'ready',
    nextStatus: 'delivered',
    previousPaymentStatus: 'authorized',
    changedBy: 'admin',
    orderHasOpenPaymentException: false,
    now
  });
  assert.equal(pickup.$set.status, 'delivered');
  assert.equal(delivery.$set.status, 'delivered');
  assert.ok(pickup.$set.completedAt);
  assert.ok(delivery.$set.completedAt);
});

test('cancel sets cancelledAt', () => {
  const built = buildAdminStatusChangeUpdate({
    previousStatus: 'processing',
    nextStatus: 'cancelled',
    previousPaymentStatus: 'failed',
    changedBy: 'admin',
    orderHasOpenPaymentException: false,
    now
  });
  assert.equal(built.$set.cancelledAt, now);
});

test('capture sets capturedAt and paidAt; retry does not overwrite', () => {
  const $set: Record<string, unknown> = { paymentStatus: 'captured' };
  applyCaptureTimestamps({ $set, prior: {}, now });
  assert.equal($set.capturedAt, now);
  assert.equal($set.paidAt, now);

  const $set2: Record<string, unknown> = { paymentStatus: 'captured' };
  applyCaptureTimestamps({
    $set: $set2,
    prior: { capturedAt: earlier, paidAt: earlier },
    now
  });
  assert.equal($set2.capturedAt, undefined);
  assert.equal($set2.paidAt, undefined);
});

test('manual paid sets paidAt without capturedAt', () => {
  const $set: Record<string, unknown> = { 'customerDetails.isPaid': true };
  applyManualPaidTimestamps({ $set, prior: {}, now });
  assert.equal($set.paidAt, now);
  assert.equal($set.capturedAt, undefined);
});

test('paid_elsewhere_continue sets paidAt via status change builder', () => {
  const built = buildAdminStatusChangeUpdate({
    previousStatus: 'pending',
    nextStatus: 'processing',
    previousPaymentStatus: 'failed',
    changedBy: 'admin',
    orderHasOpenPaymentException: true,
    paymentExceptionResolution: 'paid_elsewhere_continue',
    now,
    priorTimestamps: {}
  });
  assert.equal(built.$set.paidAt, now);
  assert.equal(built.$set.capturedAt, undefined);
});

test('archive allowed only for delivered/cancelled', () => {
  assert.equal(canArchiveOrderByStatus('delivered'), true);
  assert.equal(canArchiveOrderByStatus('cancelled'), true);
  assert.equal(canArchiveOrderByStatus('processing'), false);
  assert.equal(canArchiveOrderByStatus('ready'), false);
  assert.equal(canArchiveOrderByStatus('pending'), false);
});

test('soft-deleted order is archive tab only', () => {
  assert.equal(
    resolveAdminStatusTab({
      status: 'delivered',
      paymentStatus: 'captured',
      completedAt: now,
      isDeleted: true
    }),
    'archive'
  );
});

test('phase-1 timestamps feed revenue SSOT; cancelled captured counts as revenue', () => {
  const match = buildActualRevenueMatch();
  assert.ok(match);
  assert.equal(
    orderContributesActualRevenue({
      paymentStatus: 'captured',
      totalPrice: 100,
      status: 'delivered',
      paidAt: now,
      capturedAt: now,
      completedAt: now,
      isDeleted: false
    }),
    true
  );
  assert.equal(
    orderContributesActualRevenue({
      paymentStatus: 'captured',
      totalPrice: 100,
      status: 'cancelled',
      paidAt: now
    }),
    true
  );
  const matchStr = JSON.stringify(match);
  assert.equal(matchStr.includes('completedAt'), false);
  assert.ok(matchStr.includes('paidAt') || matchStr.includes('capturedAt'));
});
