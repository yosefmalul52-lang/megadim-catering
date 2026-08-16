import assert from 'node:assert/strict';
import test from 'node:test';
import { emailService } from '../services/email.service';
import { sendReviewRequestEmailForOrder } from '../services/review-request-email.worker';

type FakeOrder = {
  _id: string;
  status: string;
  isDeleted?: boolean;
  customerDetails?: { email?: string };
  reviewRequestEmailDueAt?: Date | null;
  reviewRequestEmailSentAt?: Date | null;
  reviewRequestEmailStatus?: string | null;
};

function installFakes(options: {
  order: FakeOrder;
  googleReviewUrl?: string;
  emailsEnabled?: boolean;
  sendResult?: { sent: boolean; suppressed?: boolean; skipped?: string };
}) {
  const Order = require('../models/Order').default;
  const SiteSettings = require('../models/siteSettings.model').default;

  const originalFindById = Order.findById;
  const originalFindOneAndUpdate = Order.findOneAndUpdate;
  const originalUpdateOne = Order.updateOne;
  const originalSettingsFindOne = SiteSettings.findOne;
  const originalSend = (emailService as any).sendReviewRequestEmail;
  const originalEnv = process.env.ORDER_CUSTOMER_EMAILS_ENABLED;

  let order: FakeOrder = { ...options.order };
  const sentCalls: Array<{ orderId: string; url: string }> = [];

  process.env.ORDER_CUSTOMER_EMAILS_ENABLED =
    options.emailsEnabled === false ? 'false' : 'true';

  SiteSettings.findOne = () => ({
    select: () => ({
      lean: async () => ({ googleReviewUrl: options.googleReviewUrl || '' })
    })
  });

  Order.findById = (id: string) => ({
    lean: async () => (String(order._id) === String(id) ? { ...order } : null)
  });

  Order.findOneAndUpdate = async (filter: any, update: any, opts?: any) => {
    if (filter._id && String(filter._id) !== String(order._id)) return null;
    if (filter.status?.$in && !filter.status.$in.includes(order.status)) return null;
    if (filter.isDeleted?.$ne && order.isDeleted) return null;
    if (filter.reviewRequestEmailStatus?.$nin?.includes(order.reviewRequestEmailStatus || '')) {
      return null;
    }
    if (order.reviewRequestEmailSentAt && update?.$set?.reviewRequestEmailStatus === 'sending') {
      return null;
    }
    if (update?.$set) {
      order = { ...order, ...update.$set };
    }
    return opts?.returnDocument === 'after' ? { ...order } : { ...order };
  };

  Order.updateOne = async (filter: any, update: any) => {
    if (String(filter._id) === String(order._id) && update?.$set) {
      order = { ...order, ...update.$set };
    }
    return { matchedCount: 1 };
  };

  (emailService as any).sendReviewRequestEmail = async (o: any, url: string) => {
    sentCalls.push({ orderId: String(o._id), url });
    return options.sendResult || { sent: true };
  };

  return {
    sentCalls,
    getOrder: () => order,
    restore() {
      Order.findById = originalFindById;
      Order.findOneAndUpdate = originalFindOneAndUpdate;
      Order.updateOne = originalUpdateOne;
      SiteSettings.findOne = originalSettingsFindOne;
      (emailService as any).sendReviewRequestEmail = originalSend;
      if (originalEnv === undefined) delete process.env.ORDER_CUSTOMER_EMAILS_ENABLED;
      else process.env.ORDER_CUSTOMER_EMAILS_ENABLED = originalEnv;
    }
  };
}

test('manual send succeeds for completed order with email', async () => {
  const fakes = installFakes({
    googleReviewUrl: 'https://share.google/example',
    order: {
      _id: 'ord1',
      status: 'delivered',
      customerDetails: { email: 'a@b.com' },
      reviewRequestEmailStatus: null,
      reviewRequestEmailSentAt: null
    }
  });
  try {
    const result = await sendReviewRequestEmailForOrder('ord1');
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.order.reviewRequestEmailStatus, 'sent');
      assert.ok(result.order.reviewRequestEmailSentAt);
    }
    assert.equal(fakes.sentCalls.length, 1);
  } finally {
    fakes.restore();
  }
});

test('manual send rejects non-completed orders', async () => {
  const fakes = installFakes({
    googleReviewUrl: 'https://share.google/example',
    order: {
      _id: 'ord2',
      status: 'ready',
      customerDetails: { email: 'a@b.com' }
    }
  });
  try {
    const result = await sendReviewRequestEmailForOrder('ord2');
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, 'not_completed');
    assert.equal(fakes.sentCalls.length, 0);
  } finally {
    fakes.restore();
  }
});

test('manual send rejects already-sent orders', async () => {
  const fakes = installFakes({
    googleReviewUrl: 'https://share.google/example',
    order: {
      _id: 'ord3',
      status: 'completed',
      customerDetails: { email: 'a@b.com' },
      reviewRequestEmailStatus: 'sent',
      reviewRequestEmailSentAt: new Date()
    }
  });
  try {
    const result = await sendReviewRequestEmailForOrder('ord3');
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, 'already_sent');
    assert.equal(fakes.sentCalls.length, 0);
  } finally {
    fakes.restore();
  }
});

test('manual send skips when customer has no email', async () => {
  const fakes = installFakes({
    googleReviewUrl: 'https://share.google/example',
    order: {
      _id: 'ord4',
      status: 'delivered',
      customerDetails: { email: '' }
    }
  });
  try {
    const result = await sendReviewRequestEmailForOrder('ord4');
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, 'no_email');
    assert.equal(fakes.sentCalls.length, 0);
  } finally {
    fakes.restore();
  }
});

test('manual send requires googleReviewUrl', async () => {
  const fakes = installFakes({
    googleReviewUrl: '',
    order: {
      _id: 'ord5',
      status: 'delivered',
      customerDetails: { email: 'a@b.com' }
    }
  });
  try {
    const result = await sendReviewRequestEmailForOrder('ord5');
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, 'no_review_url');
    assert.equal(fakes.sentCalls.length, 0);
  } finally {
    fakes.restore();
  }
});
