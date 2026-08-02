import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { Request, Response } from 'express';
import Order from '../models/Order';
import { emailService } from '../services/email.service';
import { TranzilaService } from '../services/tranzila.service';
import { PaymentController } from './payment.controller';

type InvocationResult = {
  status: number;
  body?: any;
  redirect?: string;
  error?: any;
};

const VALID_TOKEN = 'valid-payment-init-token';

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function makeOrder(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'order-123',
    userId: 'user-1',
    customerDetails: {
      phone: '0500000000',
      email: 'owner@example.com'
    },
    totalPrice: 100,
    status: 'pending',
    paymentStatus: 'pending',
    paymentInitTokenHash: hashToken(VALID_TOKEN),
    paymentInitTokenExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
    transactionId: undefined,
    paymentSecurityToken: undefined,
    ...overrides
  };
}

function asDocument(value: Record<string, any>) {
  const snapshot = { ...value, customerDetails: { ...(value.customerDetails || {}) } };
  return {
    ...snapshot,
    toObject: () => ({ ...snapshot, customerDetails: { ...(snapshot.customerDetails || {}) } })
  };
}

function createHarness(options: {
  order?: Record<string, any>;
  configured?: boolean;
  nodeEnv?: string | undefined;
} = {}) {
  let state = makeOrder(options.order);
  let atomicWins = 0;
  let updateCalls = 0;
  let emailCalls = 0;
  let crmCalls = 0;
  const generatedUrls: Array<Record<string, any>> = [];

  const originalFindById = (Order as any).findById;
  const originalFindOneAndUpdate = (Order as any).findOneAndUpdate;
  const originalFindByIdAndUpdate = (Order as any).findByIdAndUpdate;
  const originalConfigured = TranzilaService.prototype.isConfigured;
  const originalGenerate = TranzilaService.prototype.generateAuthUrl;
  const originalEmail = emailService.sendOrderConfirmationAfterPayment;
  const customerModule = require('../services/customer.service');
  const originalUpsert = customerModule.upsertCustomerFromOrder;
  const originalNodeEnv = process.env.NODE_ENV;

  if (options.nodeEnv === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = options.nodeEnv;
  }

  (Order as any).findById = () => ({
    select: async () => asDocument(state),
    lean: async () => ({ ...state })
  });
  (Order as any).findOneAndUpdate = (_filter: Record<string, any>, update: any) => ({
    select: async () => {
      updateCalls += 1;
      const filterMatches =
        String(_filter._id) === String(state._id) &&
        _filter.status === state.status &&
        _filter.paymentStatus === state.paymentStatus;
      if (!filterMatches) return null;
      state = { ...state, ...(update.$set || {}) };
      atomicWins += 1;
      return asDocument(state);
    }
  });
  (Order as any).findByIdAndUpdate = async (_id: string, update: any) => {
    state = { ...state, ...(update.$set || {}) };
    return asDocument(state);
  };
  TranzilaService.prototype.isConfigured = () => options.configured !== false;
  TranzilaService.prototype.generateAuthUrl = function (input: any) {
    generatedUrls.push({ ...input });
    return `https://payments.test/${input._id}?proof=${input.paymentSecurityToken}`;
  };
  (emailService as any).sendOrderConfirmationAfterPayment = async () => {
    emailCalls += 1;
  };
  customerModule.upsertCustomerFromOrder = async () => {
    crmCalls += 1;
  };

  return {
    controller: new PaymentController(),
    getState: () => ({ ...state }),
    getAtomicWins: () => atomicWins,
    getUpdateCalls: () => updateCalls,
    getEmailCalls: () => emailCalls,
    getCrmCalls: () => crmCalls,
    getGeneratedUrls: () => generatedUrls,
    restore: () => {
      (Order as any).findById = originalFindById;
      (Order as any).findOneAndUpdate = originalFindOneAndUpdate;
      (Order as any).findByIdAndUpdate = originalFindByIdAndUpdate;
      TranzilaService.prototype.isConfigured = originalConfigured;
      TranzilaService.prototype.generateAuthUrl = originalGenerate;
      (emailService as any).sendOrderConfirmationAfterPayment = originalEmail;
      customerModule.upsertCustomerFromOrder = originalUpsert;
      if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = originalNodeEnv;
    }
  };
}

function invoke(
  handler: (req: Request, res: Response, next: (error?: unknown) => void) => void,
  options: {
    body?: Record<string, unknown>;
    query?: Record<string, unknown>;
    user?: Record<string, unknown> | null;
  } = {}
): Promise<InvocationResult> {
  return new Promise((resolve) => {
    let status = 200;
    let settled = false;
    const finish = (result: InvocationResult) => {
      if (!settled) {
        settled = true;
        resolve(result);
      }
    };
    const req = {
      body: options.body || {},
      query: options.query || {},
      params: { orderId: 'order-123' },
      user: options.user,
      method: 'POST',
      headers: {},
      originalUrl: '/api/payment/initiate/order-123'
    } as unknown as Request;
    const res = {
      status(code: number) {
        status = code;
        return this;
      },
      json(body: unknown) {
        finish({ status, body });
        return this;
      },
      redirect(url: string) {
        finish({ status: status === 200 ? 302 : status, redirect: url });
        return this;
      }
    } as unknown as Response;
    handler(req, res, (error?: any) => {
      finish({ status: error?.statusCode || 500, error });
    });
    setTimeout(() => finish({ status: 500, error: new Error('Handler timeout') }), 500);
  });
}

test('guest with a valid token can atomically initiate payment', async () => {
  const harness = createHarness();
  try {
    const result = await invoke(harness.controller.initiatePreAuth, {
      body: { paymentInitToken: VALID_TOKEN }
    });
    assert.equal(result.status, 200);
    assert.equal(harness.getState().paymentStatus, 'awaiting_payment');
    assert.match(harness.getState().paymentSecurityToken, /^[a-f0-9]{32}$/);
    assert.equal(harness.getAtomicWins(), 1);
  } finally {
    harness.restore();
  }
});

for (const [name, body] of [
  ['missing token', {}],
  ['wrong token', { paymentInitToken: 'wrong-token' }],
  ['token from another order', { paymentInitToken: 'another-order-token' }]
] as const) {
  test(`guest with ${name} receives the generic forbidden response`, async () => {
    const harness = createHarness();
    try {
      const result = await invoke(harness.controller.initiatePreAuth, { body });
      assert.equal(result.status, 403);
      assert.equal(result.body.code, 'PAYMENT_INIT_FORBIDDEN');
      assert.equal(harness.getUpdateCalls(), 0);
    } finally {
      harness.restore();
    }
  });
}

test('expired token receives the generic forbidden response', async () => {
  const harness = createHarness({
    order: { paymentInitTokenExpiresAt: new Date(Date.now() - 1) }
  });
  try {
    const result = await invoke(harness.controller.initiatePreAuth, {
      body: { paymentInitToken: VALID_TOKEN }
    });
    assert.equal(result.status, 403);
    assert.equal(result.body.code, 'PAYMENT_INIT_FORBIDDEN');
  } finally {
    harness.restore();
  }
});

test('authenticated owner can initiate a legacy order without a token', async () => {
  const harness = createHarness({
    order: { paymentInitTokenHash: undefined, paymentInitTokenExpiresAt: undefined }
  });
  try {
    const result = await invoke(harness.controller.initiatePreAuth, {
      user: { id: 'user-1' }
    });
    assert.equal(result.status, 200);
  } finally {
    harness.restore();
  }
});

test('authenticated non-owner needs the valid order token', async () => {
  const harness = createHarness();
  try {
    const denied = await invoke(harness.controller.initiatePreAuth, {
      user: { id: 'user-2', phone: '0511111111', username: 'other@example.com' }
    });
    assert.equal(denied.status, 403);
    assert.equal(denied.body.code, 'PAYMENT_INIT_FORBIDDEN');
  } finally {
    harness.restore();
  }
});

test('authenticated non-owner may use a valid token for that order', async () => {
  const harness = createHarness();
  try {
    const result = await invoke(harness.controller.initiatePreAuth, {
      body: { paymentInitToken: VALID_TOKEN },
      user: { id: 'user-2' }
    });
    assert.equal(result.status, 200);
  } finally {
    harness.restore();
  }
});

test('legacy guest order without a hash is forbidden', async () => {
  const harness = createHarness({
    order: { paymentInitTokenHash: undefined, paymentInitTokenExpiresAt: undefined }
  });
  try {
    const result = await invoke(harness.controller.initiatePreAuth);
    assert.equal(result.status, 403);
    assert.equal(result.body.code, 'PAYMENT_INIT_FORBIDDEN');
  } finally {
    harness.restore();
  }
});

test('awaiting payment returns the same proof and success URL without an update', async () => {
  const harness = createHarness({
    order: {
      paymentStatus: 'awaiting_payment',
      paymentSecurityToken: 'existing-security-token',
      transactionId: 'ORD-order-123'
    }
  });
  try {
    const result = await invoke(harness.controller.initiatePreAuth, {
      body: { paymentInitToken: VALID_TOKEN }
    });
    assert.equal(result.status, 200);
    assert.equal(result.body.alreadyInitiated, true);
    assert.equal(harness.getUpdateCalls(), 0);
    assert.equal(harness.getGeneratedUrls()[0].paymentSecurityToken, 'existing-security-token');
    assert.match(harness.getGeneratedUrls()[0].successUrl, /\?orderId=order-123$/);
  } finally {
    harness.restore();
  }
});

test('authorized payment is idempotent and does not write or resend side effects', async () => {
  const harness = createHarness({ order: { paymentStatus: 'authorized' } });
  try {
    const result = await invoke(harness.controller.initiatePreAuth, {
      body: { paymentInitToken: VALID_TOKEN }
    });
    assert.equal(result.status, 200);
    assert.equal(result.body.alreadyAuthorized, true);
    assert.equal(harness.getUpdateCalls(), 0);
    assert.equal(harness.getEmailCalls(), 0);
    assert.equal(harness.getCrmCalls(), 0);
  } finally {
    harness.restore();
  }
});

for (const paymentStatus of ['captured', 'voided'] as const) {
  test(`${paymentStatus} payment returns a state conflict`, async () => {
    const harness = createHarness({ order: { paymentStatus } });
    try {
      const result = await invoke(harness.controller.initiatePreAuth, {
        body: { paymentInitToken: VALID_TOKEN }
      });
      assert.equal(result.status, 409);
      assert.equal(result.body.code, 'PAYMENT_STATE_CONFLICT');
      assert.equal(harness.getUpdateCalls(), 0);
    } finally {
      harness.restore();
    }
  });
}

test('failed payment may retry without replacing an existing Tranzila proof', async () => {
  const harness = createHarness({
    order: {
      paymentStatus: 'failed',
      paymentSecurityToken: 'preserved-security-token',
      transactionId: 'preserved-transaction'
    }
  });
  try {
    const result = await invoke(harness.controller.initiatePreAuth, {
      body: { paymentInitToken: VALID_TOKEN }
    });
    assert.equal(result.status, 200);
    assert.equal(harness.getState().paymentStatus, 'awaiting_payment');
    assert.equal(harness.getState().paymentSecurityToken, 'preserved-security-token');
    assert.equal(harness.getState().transactionId, 'preserved-transaction');
  } finally {
    harness.restore();
  }
});

test('processing/manual order cannot start a new payment', async () => {
  const harness = createHarness({ order: { status: 'processing' } });
  try {
    const result = await invoke(harness.controller.initiatePreAuth, {
      body: { paymentInitToken: VALID_TOKEN }
    });
    assert.equal(result.status, 409);
    assert.equal(result.body.code, 'PAYMENT_STATE_CONFLICT');
    assert.equal(harness.getUpdateCalls(), 0);
  } finally {
    harness.restore();
  }
});

test('parallel configured initiations produce one atomic transition and one proof', async () => {
  const harness = createHarness();
  try {
    const [first, second] = await Promise.all([
      invoke(harness.controller.initiatePreAuth, { body: { paymentInitToken: VALID_TOKEN } }),
      invoke(harness.controller.initiatePreAuth, { body: { paymentInitToken: VALID_TOKEN } })
    ]);
    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.equal(harness.getAtomicWins(), 1);
    assert.equal(new Set(harness.getGeneratedUrls().map((item) => item.paymentSecurityToken)).size, 1);
  } finally {
    harness.restore();
  }
});

for (const nodeEnv of ['production', 'staging', undefined] as const) {
  test(`${nodeEnv ?? 'undefined'} without Tranzila configuration returns 503 without writes`, async () => {
    const harness = createHarness({ configured: false, nodeEnv });
    try {
      const result = await invoke(harness.controller.initiatePreAuth, {
        body: { paymentInitToken: VALID_TOKEN }
      });
      assert.equal(result.status, 503);
      assert.equal(result.body.code, 'PAYMENT_PROVIDER_NOT_CONFIGURED');
      assert.equal(harness.getUpdateCalls(), 0);
      assert.equal(harness.getEmailCalls(), 0);
      assert.equal(harness.getCrmCalls(), 0);
    } finally {
      harness.restore();
    }
  });
}

for (const nodeEnv of ['development', 'test'] as const) {
  test(`${nodeEnv} without Tranzila configuration uses the atomic mock flow`, async () => {
    const harness = createHarness({ configured: false, nodeEnv });
    try {
      const result = await invoke(harness.controller.initiatePreAuth, {
        body: { paymentInitToken: VALID_TOKEN }
      });
      assert.equal(result.status, 200);
      assert.match(result.body.redirectUrl, /\?mock=1$/);
      assert.equal(harness.getState().paymentStatus, 'authorized');
      assert.equal(harness.getAtomicWins(), 1);
      assert.equal(harness.getEmailCalls(), 1);
      assert.equal(harness.getCrmCalls(), 1);
    } finally {
      harness.restore();
    }
  });
}

test('parallel mock initiations execute email and CRM side effects once', async () => {
  const harness = createHarness({ configured: false, nodeEnv: 'test' });
  try {
    const results = await Promise.all([
      invoke(harness.controller.initiatePreAuth, { body: { paymentInitToken: VALID_TOKEN } }),
      invoke(harness.controller.initiatePreAuth, { body: { paymentInitToken: VALID_TOKEN } })
    ]);
    assert.deepEqual(results.map((result) => result.status), [200, 200]);
    assert.equal(harness.getAtomicWins(), 1);
    assert.equal(harness.getEmailCalls(), 1);
    assert.equal(harness.getCrmCalls(), 1);
  } finally {
    harness.restore();
  }
});

test('success callback still validates and stores the separate Tranzila proof', async () => {
  const harness = createHarness({
    order: {
      paymentStatus: 'awaiting_payment',
      paymentSecurityToken: 'callback-security-token'
    }
  });
  try {
    const result = await invoke(harness.controller.paymentSuccess, {
      query: {
        orderId: 'order-123',
        Response: '000',
        pdesc: 'callback-security-token',
        sum: '100',
        index: '12345',
        ConfirmationCode: 'AUTH'
      }
    });
    assert.equal(result.status, 302);
    assert.match(result.redirect || '', /order-confirmation\/order-123$/);
    assert.equal(harness.getState().paymentStatus, 'authorized');
    assert.equal(harness.getState().transactionId, '12345');
  } finally {
    harness.restore();
  }
});

test('checkout consumes the creation token only in the initiate request body', () => {
  const source = readFileSync(
    join(
      __dirname,
      '..',
      '..',
      '..',
      'frontend',
      'src',
      'app',
      'components',
      'pages',
      'checkout-page',
      'checkout-page.component.ts'
    ),
    'utf8'
  );
  assert.match(source, /const paymentInitToken = orderRes\.paymentInitToken/);
  assert.match(source, /payment\/initiate\/\$\{orderId\}['"`],\s*\{ paymentInitToken \}/);
  assert.doesNotMatch(source, /(localStorage|sessionStorage)\.setItem\([^)]*paymentInitToken/);
});

test('payment route uses optional authentication without requiring login', () => {
  const source = readFileSync(
    join(process.cwd(), 'src', 'routes', 'payment.routes.ts'),
    'utf8'
  );
  assert.match(
    source,
    /router\.post\(['"]\/initiate\/:orderId['"],\s*optionalAuthenticate,\s*payment\.initiatePreAuth\)/
  );
});

test('Order stores only hidden proof metadata and defines no TTL index', () => {
  const tokenHashPath = Order.schema.path('paymentInitTokenHash') as any;
  const tokenExpiryPath = Order.schema.path('paymentInitTokenExpiresAt') as any;
  assert.equal(tokenHashPath.options.select, false);
  assert.equal(tokenExpiryPath.options.select, false);

  const document = new Order({
    customerDetails: {},
    items: [],
    totalPrice: 1,
    paymentInitToken: VALID_TOKEN,
    paymentInitTokenHash: hashToken(VALID_TOKEN),
    paymentInitTokenExpiresAt: new Date(Date.now() + 1000)
  } as any);
  const stored = document.toObject() as any;
  assert.equal(stored.paymentInitToken, undefined);
  assert.equal(stored.paymentInitTokenHash, hashToken(VALID_TOKEN));
  assert.notEqual(stored.paymentInitTokenHash, VALID_TOKEN);
  assert.equal(
    Order.schema.indexes().some(([, options]) => (options as any).expireAfterSeconds !== undefined),
    false
  );
});
