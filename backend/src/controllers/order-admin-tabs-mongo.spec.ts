/**
 * Isolated Mongo integration: tab exclusivity, failed→processing, counts, awaiting clock,
 * payment link stays failed, payment success does not set processing, email kill switch.
 * Uses mongodb-memory-server only — never production.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';
import Order from '../models/Order';
import { OrderService } from '../services/order.service';
import { emailService } from '../services/email.service';
import {
  AWAITING_PAYMENT_ABANDON_MS,
  resolveAdminStatusTab
} from '../utils/order-admin-status.util';
import { isOrderCustomerEmailsEnabled } from '../utils/order-customer-email-gate.util';
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
    ...doc
  });
  return created.toObject();
}

test.before(async () => {
  process.env.ORDER_CUSTOMER_EMAILS_ENABLED = 'false';
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect().catch(() => undefined);
  }
  mongodUri = await getSharedMongoUri('admin-tabs');
  await mongoose.connect(mongodUri);
});

test.after(async () => {
  await mongoose.disconnect().catch(() => undefined);
  await stopMongoMemoryServer(null);
});

test.beforeEach(async () => {
  await Order.deleteMany({});
});

test('fixture matrix: each order matches exactly one tab; list counts agree', async () => {
  const now = new Date();
  const young = new Date(now.getTime() - 30_000);
  const abandoned = new Date(now.getTime() - AWAITING_PAYMENT_ABANDON_MS);

  const fixtures = [
    { status: 'pending', paymentStatus: 'pending', orderType: 'shabbat' },
    { status: 'processing', paymentStatus: 'authorized', orderType: 'shabbat' },
    { status: 'ready', paymentStatus: 'captured', orderType: 'shabbat' },
    {
      status: 'pending',
      paymentStatus: 'failed',
      paymentFailedAt: now,
      orderType: 'shabbat'
    },
    { status: 'cancelled', paymentStatus: 'failed', orderType: 'shabbat' },
    { status: 'delivered', paymentStatus: 'captured', orderType: 'shabbat' },
    {
      status: 'pending',
      paymentStatus: 'awaiting_payment',
      paymentAwaitingStartedAt: abandoned,
      orderType: 'shabbat'
    },
    {
      status: 'pending',
      paymentStatus: 'awaiting_payment',
      paymentAwaitingStartedAt: young,
      paymentFailedAt: now,
      orderType: 'shabbat'
    }
  ];

  for (const f of fixtures) await seed(f);

  const counts = await service.getAdminTabCounts();
  const shabbat = counts.shabbat;
  assert.equal(shabbat.pending, 1);
  assert.equal(shabbat.processing, 1);
  assert.equal(shabbat.ready, 1);
  assert.equal(shabbat.failed, 3); // failed + abandoned awaiting + young awaiting with paymentFailedAt
  assert.equal(shabbat.cancelled, 1);
  assert.equal(shabbat.completed, 1);
  assert.equal(shabbat.archive, 0);
  assert.equal(
    shabbat.total,
    shabbat.pending +
      shabbat.processing +
      shabbat.ready +
      shabbat.failed +
      shabbat.cancelled +
      shabbat.completed
  );

  for (const tab of [
    'pending',
    'processing',
    'ready',
    'failed',
    'cancelled',
    'completed'
  ] as const) {
    const page = await service.getAdminOrdersPage({
      source: 'shabbat',
      statusTab: tab,
      page: 1,
      limit: 50
    });
    assert.equal(page.total, (shabbat as any)[tab]);
    for (const o of page.orders) {
      assert.equal(resolveAdminStatusTab(o as any, now), tab);
    }
  }
});

test('failed → processing closes exception; stays paymentStatus=failed; only processing after reload', async () => {
  const order = await seed({
    status: 'pending',
    paymentStatus: 'failed',
    paymentFailedAt: new Date(),
    orderType: 'shabbat'
  });
  const id = String(order._id);

  const before = await service.getAdminOrdersPage({
    source: 'shabbat',
    statusTab: 'failed',
    page: 1,
    limit: 10
  });
  assert.equal(before.total, 1);

  const result = await service.updateOrderStatus(
    id,
    {
      status: 'processing',
      paymentExceptionResolution: 'approve_and_continue_billing'
    },
    { changedBy: 'admin-test' }
  );
  assert.equal(result.adminStatusTab, 'processing');
  assert.equal((result.order as any).paymentStatus, 'failed');
  assert.ok((result.order as any).paymentExceptionResolvedAt);
  assert.equal((result.order as any).paymentExceptionResolution, 'approve_and_continue_billing');

  const failedAfter = await service.getAdminOrdersPage({
    source: 'shabbat',
    statusTab: 'failed',
    page: 1,
    limit: 10
  });
  const processingAfter = await service.getAdminOrdersPage({
    source: 'shabbat',
    statusTab: 'processing',
    page: 1,
    limit: 10
  });
  assert.equal(failedAfter.total, 0);
  assert.equal(processingAfter.total, 1);
  assert.equal(String(processingAfter.orders[0]._id), id);
});

test('send_new_payment_link / young awaiting with paymentFailedAt stays on failed', async () => {
  const young = new Date(Date.now() - 60_000);
  await seed({
    status: 'pending',
    paymentStatus: 'awaiting_payment',
    paymentAwaitingStartedAt: young,
    paymentFailedAt: new Date(),
    orderType: 'shabbat'
  });
  const failed = await service.getAdminOrdersPage({
    source: 'shabbat',
    statusTab: 'failed',
    page: 1,
    limit: 10
  });
  assert.equal(failed.total, 1);
});

test('59:59 vs 60:00 awaiting without paymentFailedAt', async () => {
  const now = Date.now();
  await seed({
    status: 'pending',
    paymentStatus: 'awaiting_payment',
    paymentAwaitingStartedAt: new Date(now - (AWAITING_PAYMENT_ABANDON_MS - 1000)),
    orderType: 'shabbat'
  });
  await seed({
    status: 'pending',
    paymentStatus: 'awaiting_payment',
    paymentAwaitingStartedAt: new Date(now - AWAITING_PAYMENT_ABANDON_MS),
    orderType: 'shabbat'
  });

  const pending = await service.getAdminOrdersPage({
    source: 'shabbat',
    statusTab: 'pending',
    page: 1,
    limit: 10
  });
  const failed = await service.getAdminOrdersPage({
    source: 'shabbat',
    statusTab: 'failed',
    page: 1,
    limit: 10
  });
  assert.equal(pending.total, 1);
  assert.equal(failed.total, 1);
});

test('cancelled and completed are separate tabs', async () => {
  await seed({ status: 'cancelled', paymentStatus: 'pending', orderType: 'shabbat' });
  await seed({ status: 'delivered', paymentStatus: 'captured', orderType: 'shabbat' });
  const cancelled = await service.getAdminOrdersPage({
    source: 'shabbat',
    statusTab: 'cancelled',
    page: 1,
    limit: 10
  });
  const completed = await service.getAdminOrdersPage({
    source: 'shabbat',
    statusTab: 'completed',
    page: 1,
    limit: 10
  });
  const archive = await service.getAdminOrdersPage({
    source: 'shabbat',
    statusTab: 'archive',
    page: 1,
    limit: 10
  });
  const ready = await service.getAdminOrdersPage({
    source: 'shabbat',
    statusTab: 'ready',
    page: 1,
    limit: 10
  });
  assert.equal(cancelled.total, 1);
  assert.equal(completed.total, 1);
  assert.equal(archive.total, 0);
  assert.equal(ready.total, 0);
});

test('emails disabled: zero SMTP; retry does not process; suppressed result', async () => {
  assert.equal(isOrderCustomerEmailsEnabled(), false);
  let smtpCalls = 0;
  const original = (emailService as any).transporter;
  (emailService as any).transporter = {
    sendMail: async () => {
      smtpCalls += 1;
      throw new Error('SMTP must not be called');
    },
    verify: async () => true
  };

  try {
    const order = await seed({
      status: 'pending',
      paymentStatus: 'pending',
      orderType: 'shabbat'
    });
    const received = await emailService.sendOrderReceivedForPublicOrder(order as any);
    assert.equal((received as any).suppressed, true);
    assert.equal(received.sent, false);

    const approved = await emailService.sendOrderApprovedToCustomer(order as any);
    assert.equal((approved as any).suppressed, true);

    const retry = await emailService.retryFailedOrderEmails(20);
    assert.equal(retry.suppressed, true);
    assert.equal(retry.attempted, 0);
    assert.equal(smtpCalls, 0);
  } finally {
    (emailService as any).transporter = original;
  }
});

test('legacy processing+failed unresolved: only failed tab; explicit resolve → only processing', async () => {
  const order = await seed({
    status: 'processing',
    paymentStatus: 'failed',
    paymentFailedAt: new Date(),
    paymentExceptionResolvedAt: null,
    orderType: 'shabbat'
  });
  const id = String(order._id);

  assert.equal(resolveAdminStatusTab(order as any), 'failed');

  const failedBefore = await service.getAdminOrdersPage({
    source: 'shabbat',
    statusTab: 'failed',
    page: 1,
    limit: 10
  });
  const processingBefore = await service.getAdminOrdersPage({
    source: 'shabbat',
    statusTab: 'processing',
    page: 1,
    limit: 10
  });
  assert.equal(failedBefore.total, 1);
  assert.equal(processingBefore.total, 0);
  assert.equal(String(failedBefore.orders[0]._id), id);

  const result = await service.resolvePaymentException(id, {
    resolution: 'approve_and_continue_billing',
    adminUserId: 'admin-legacy'
  });
  assert.equal(result.adminStatusTab, 'processing');
  assert.equal((result.order as any).status, 'processing');
  assert.equal((result.order as any).paymentStatus, 'failed');
  assert.ok((result.order as any).paymentExceptionResolvedAt);
  assert.equal((result.order as any).paymentExceptionResolvedBy, 'admin-legacy');
  assert.equal((result.order as any).paymentExceptionResolution, 'approve_and_continue_billing');

  const failedAfter = await service.getAdminOrdersPage({
    source: 'shabbat',
    statusTab: 'failed',
    page: 1,
    limit: 10
  });
  const processingAfter = await service.getAdminOrdersPage({
    source: 'shabbat',
    statusTab: 'processing',
    page: 1,
    limit: 10
  });
  assert.equal(failedAfter.total, 0);
  assert.equal(processingAfter.total, 1);
  assert.equal(String(processingAfter.orders[0]._id), id);
});

test('soft-delete fixtures count only in archive', async () => {
  await seed({
    status: 'cancelled',
    paymentStatus: 'pending',
    isDeleted: true,
    orderType: 'shabbat'
  });
  await seed({
    status: 'delivered',
    paymentStatus: 'captured',
    isDeleted: true,
    orderType: 'shabbat'
  });
  await seed({
    status: 'processing',
    paymentStatus: 'failed',
    paymentFailedAt: new Date(),
    paymentExceptionResolvedAt: null,
    isDeleted: true,
    orderType: 'shabbat'
  });

  const counts = await service.getAdminTabCounts();
  assert.equal(counts.shabbat.archive, 3);
  assert.equal(counts.shabbat.cancelled, 0);
  assert.equal(counts.shabbat.completed, 0);
  assert.equal(counts.shabbat.failed, 0);
  assert.equal(counts.shabbat.processing, 0);

  for (const tab of ['cancelled', 'completed', 'failed', 'processing', 'pending', 'ready'] as const) {
    const page = await service.getAdminOrdersPage({
      source: 'shabbat',
      statusTab: tab,
      page: 1,
      limit: 10
    });
    assert.equal(page.total, 0, `expected 0 in ${tab}`);
  }
  const archive = await service.getAdminOrdersPage({
    source: 'shabbat',
    statusTab: 'archive',
    page: 1,
    limit: 10
  });
  assert.equal(archive.total, 3);
  for (const o of archive.orders) {
    assert.equal(resolveAdminStatusTab(o as any), 'archive');
  }
});
