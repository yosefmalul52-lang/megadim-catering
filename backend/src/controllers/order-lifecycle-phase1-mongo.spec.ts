/**
 * Phase 1 Mongo integration: timestamps, archive gate, restore preserves status.
 * Isolated mongodb-memory-server only. Emails stay disabled. No revenue formula changes.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';
import Order from '../models/Order';
import { OrderService } from '../services/order.service';
import { resolveAdminStatusTab } from '../utils/order-admin-status.util';
import { applyCaptureTimestamps } from '../utils/order-lifecycle-timestamps.util';
import { orderContributesActualRevenue } from '../utils/business-metrics.util';
import { getSharedMongoUri, stopMongoMemoryServer } from './_mongo-memory';

let mongodUri = '';
const service = new OrderService();

async function seed(doc: Record<string, unknown>) {
  const created = await Order.create({
    items: [{ productId: new mongoose.Types.ObjectId(), name: 'טסט', quantity: 1, price: 10 }],
    totalPrice: 10,
    customerDetails: {
      fullName: 'בדיקה',
      phone: '0501234567',
      email: 'noreply-test@example.invalid',
      eventDate: '2099-01-01',
      deliveryMethod: 'pickup'
    },
    orderType: 'shabbat',
    ...doc
  });
  return created.toObject();
}

test.before(async () => {
  process.env.ORDER_CUSTOMER_EMAILS_ENABLED = 'false';
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect().catch(() => undefined);
  }
  mongodUri = await getSharedMongoUri('lifecycle-phase1');
  await mongoose.connect(mongodUri);
});

test.after(async () => {
  await mongoose.disconnect().catch(() => undefined);
  await stopMongoMemoryServer(null);
});

test.beforeEach(async () => {
  await Order.deleteMany({});
});

test('status transitions set readyAt/completedAt once; pending→processing has none', async () => {
  const order = await seed({ status: 'pending', paymentStatus: 'authorized' });
  const id = String(order._id);

  const toProcessing = await service.updateOrderStatus(id, { status: 'processing' }, {
    changedBy: 'admin'
  });
  assert.equal((toProcessing.order as any).readyAt, null);
  assert.equal((toProcessing.order as any).completedAt, null);

  const toReady = await service.updateOrderStatus(id, { status: 'ready' }, { changedBy: 'admin' });
  assert.ok((toReady.order as any).readyAt);
  const readyAt = (toReady.order as any).readyAt;

  // Force another write path that stays on ready (idempotent) — readyAt preserved
  const againReady = await service.updateOrderStatus(id, { status: 'ready' }, { changedBy: 'admin' });
  assert.equal(String((againReady.order as any).readyAt), String(readyAt));

  const toDelivered = await service.updateOrderStatus(id, { status: 'delivered' }, {
    changedBy: 'admin'
  });
  assert.ok((toDelivered.order as any).completedAt);
  assert.equal(toDelivered.adminStatusTab, 'completed');
  assert.equal(resolveAdminStatusTab(toDelivered.order as any), 'completed');
});

test('driver delivered sets completedAt and history', async () => {
  const driverId = new mongoose.Types.ObjectId();
  const order = await seed({
    status: 'out_for_delivery',
    paymentStatus: 'captured',
    assignedDriverId: driverId
  });
  const updated = await service.updateOrderStatusForDriver(
    String(order._id),
    String(driverId),
    'delivered'
  );
  assert.ok(updated);
  assert.equal((updated as any).status, 'delivered');
  assert.ok((updated as any).completedAt);
  const history = (updated as any).statusChangeHistory || [];
  assert.ok(history.length >= 1);
  assert.equal(history[history.length - 1].newStatus, 'delivered');
  assert.match(String(history[history.length - 1].changedBy), /^driver:/);
});

test('archive rejects processing/ready; allows delivered; restore keeps status+timestamps', async () => {
  const processing = await seed({ status: 'processing', paymentStatus: 'authorized' });
  await assert.rejects(
    () => service.deleteOrder(String(processing._id)),
    (err: any) => err?.code === 'ARCHIVE_STATUS_NOT_ALLOWED'
  );

  const ready = await seed({ status: 'ready', paymentStatus: 'captured', readyAt: new Date() });
  await assert.rejects(
    () => service.deleteOrder(String(ready._id)),
    (err: any) => err?.code === 'ARCHIVE_STATUS_NOT_ALLOWED'
  );

  const delivered = await seed({
    status: 'delivered',
    paymentStatus: 'captured',
    readyAt: new Date('2026-08-01T10:00:00.000Z'),
    completedAt: new Date('2026-08-02T10:00:00.000Z'),
    paidAt: new Date('2026-08-01T09:00:00.000Z')
  });
  const archived = await service.deleteOrder(String(delivered._id));
  assert.equal((archived as any).isDeleted, true);
  assert.equal((archived as any).status, 'delivered');
  assert.equal(resolveAdminStatusTab(archived as any), 'archive');

  const restored = await service.restoreOrder(String(delivered._id));
  assert.equal((restored as any).isDeleted, false);
  assert.equal((restored as any).status, 'delivered');
  assert.equal((restored as any).paymentStatus, 'captured');
  assert.ok((restored as any).readyAt);
  assert.ok((restored as any).completedAt);
  assert.ok((restored as any).paidAt);
  assert.equal(resolveAdminStatusTab(restored as any), 'completed');
});

test('cancel sets cancelledAt; capture helper sets paidAt+capturedAt without overwrite', async () => {
  const order = await seed({ status: 'processing', paymentStatus: 'authorized' });
  const cancelled = await service.updateOrderStatus(
    String(order._id),
    { status: 'cancelled' },
    { changedBy: 'admin' }
  );
  assert.ok((cancelled.order as any).cancelledAt);

  const $set: Record<string, unknown> = { paymentStatus: 'captured' };
  const first = new Date('2026-07-01T00:00:00.000Z');
  applyCaptureTimestamps({ $set, prior: {}, now: first });
  await Order.findByIdAndUpdate(order._id, { $set });
  const afterFirst = await Order.findById(order._id).lean();
  assert.equal(String((afterFirst as any).capturedAt), String(first));

  const $set2: Record<string, unknown> = { paymentStatus: 'captured' };
  applyCaptureTimestamps({
    $set: $set2,
    prior: {
      capturedAt: (afterFirst as any).capturedAt,
      paidAt: (afterFirst as any).paidAt
    },
    now: new Date()
  });
  assert.equal($set2.capturedAt, undefined);
  assert.equal($set2.paidAt, undefined);
});

test('adding timestamps does not change revenue contribution rules', async () => {
  const paid = await seed({
    status: 'delivered',
    paymentStatus: 'captured',
    paidAt: new Date(),
    capturedAt: new Date(),
    completedAt: new Date(),
    totalPrice: 50
  });
  assert.equal(orderContributesActualRevenue(paid as any), true);

  const cancelledPaid = await seed({
    status: 'cancelled',
    paymentStatus: 'captured',
    paidAt: new Date(),
    cancelledAt: new Date(),
    totalPrice: 50
  });
  assert.equal(orderContributesActualRevenue(cancelledPaid as any), true);
});
