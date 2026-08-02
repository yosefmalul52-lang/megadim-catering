import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { Request, Response } from 'express';
import { requireAdmin } from '../config/role-access';
import { authenticate } from '../middleware/auth';
import { OrderController } from './order.controller';
import { emailService } from '../services/email.service';

type InvocationResult = {
  status: number;
  body?: any;
  error?: any;
};

const validOrderBody = {
  customerName: 'Test Customer',
  phone: '0500000000',
  deliveryMethod: 'pickup' as const,
  items: [{ id: 'item-1', name: 'Test item', quantity: 1, price: 10 }],
  subtotal: 10,
  deliveryFee: 0,
  totalAmount: 10
};

function createHarness(options?: { closedDate?: boolean }) {
  const calls: Array<{ payload: any; options: any }> = [];
  let dateValidationCalls = 0;
  let emailCalls = 0;
  const controller = new OrderController();

  (controller as any).orderService = {
    validateEventDateOpen: async () => {
      dateValidationCalls += 1;
      if (options?.closedDate) {
        const error: any = new Error('Date is closed');
        error.statusCode = 400;
        throw error;
      }
    },
    createOrderFromCheckout: async (payload: any, creationOptions: any) => {
      calls.push({ payload, options: creationOptions });
      const customerDetails: Record<string, unknown> = {
        fullName: payload.customerName,
        phone: payload.phone
      };
      if (creationOptions.isManual && creationOptions.paymentStatus) {
        customerDetails.isPaid = creationOptions.paymentStatus === 'paid';
      }
      const plain = {
        _id: 'order-123',
        orderNumber: 'MG-123456',
        status: creationOptions.isManual ? 'processing' : 'pending',
        paymentStatus: 'pending',
        customerDetails
      };
      return {
        ...plain,
        toObject: () => ({ ...plain })
      };
    }
  };

  const originalSend = emailService.sendOrderEmail;
  (emailService as any).sendOrderEmail = async () => {
    emailCalls += 1;
  };

  return {
    controller,
    calls,
    getDateValidationCalls: () => dateValidationCalls,
    getEmailCalls: () => emailCalls,
    restore: () => {
      (emailService as any).sendOrderEmail = originalSend;
    }
  };
}

function invoke(
  handler: (req: Request, res: Response, next: (error?: unknown) => void) => void,
  body: Record<string, unknown>
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
      body,
      headers: {},
      params: {},
      query: {},
      method: 'POST',
      originalUrl: '/api/orders'
    } as unknown as Request;
    const res = {
      status(code: number) {
        status = code;
        return this;
      },
      json(payload: unknown) {
        finish({ status, body: payload });
        return this;
      }
    } as unknown as Response;
    handler(req, res, (error?: any) => {
      finish({ status: error?.statusCode || 500, error });
    });
    setTimeout(() => finish({ status: 500, error: new Error('Handler timeout') }), 250);
  });
}

test('1. public checkout creates pending order with payment initiation proof', async () => {
  const harness = createHarness();
  try {
    const result = await invoke(harness.controller.createOrder, validOrderBody);
    assert.equal(result.status, 201);
    assert.deepEqual(Object.keys(result.body).sort(), [
      'message',
      'order',
      'orderId',
      'orderNumber',
      'paymentInitToken',
      'success'
    ]);
    assert.equal(result.body.orderId, 'order-123');
    assert.equal(result.body.order.status, 'pending');
    assert.equal(result.body.order.paymentStatus, 'pending');
    assert.equal(harness.calls[0].options.isManual, false);
    assert.match(result.body.paymentInitToken, /^[a-f0-9]{64}$/);
    assert.equal(
      harness.calls[0].options.paymentInitTokenHash,
      crypto.createHash('sha256').update(result.body.paymentInitToken).digest('hex')
    );
    assert.notEqual(harness.calls[0].options.paymentInitTokenHash, result.body.paymentInitToken);
    assert.ok(harness.calls[0].options.paymentInitTokenExpiresAt instanceof Date);
    assert.ok(
      harness.calls[0].options.paymentInitTokenExpiresAt.getTime() > Date.now()
    );
    assert.equal(result.body.order.paymentInitTokenHash, undefined);
    assert.equal(result.body.order.paymentInitTokenExpiresAt, undefined);
  } finally {
    harness.restore();
  }
});

for (const [name, field] of [
  ['2. manualOrder true', { manualOrder: true }],
  ['3. paymentStatus paid', { paymentStatus: 'paid' }],
  ['4. status processing', { status: 'processing' }],
  ['5. isPaid true', { isPaid: true }],
  ['6. customerDetails.isPaid true', { customerDetails: { isPaid: true } }],
  ['6b. dotted customerDetails.isPaid true', { 'customerDetails.isPaid': true }],
  ['7. manualOrder false', { manualOrder: false }]
] as const) {
  test(`public checkout rejects ${name}`, async () => {
    const harness = createHarness();
    try {
      const result = await invoke(harness.controller.createOrder, {
        ...validOrderBody,
        ...field
      });
      assert.equal(result.status, 400);
      assert.equal(result.body.code, 'FORBIDDEN_ORDER_FIELDS');
      assert.equal(harness.calls.length, 0);
      assert.equal(harness.getEmailCalls(), 0);
    } finally {
      harness.restore();
    }
  });
}

test('8. closed date is rejected for public checkout', async () => {
  const harness = createHarness({ closedDate: true });
  try {
    const result = await invoke(harness.controller.createOrder, {
      ...validOrderBody,
      eventDate: '2099-01-01'
    });
    assert.equal(result.status, 400);
    assert.equal(harness.calls.length, 0);
  } finally {
    harness.restore();
  }
});

test('9. manual route requires authentication', async () => {
  const result = await invoke(authenticate as any, {});
  assert.equal(result.status, 401);
});

test('10. non-admin user is forbidden from manual route', async () => {
  const req = { user: { role: 'user' } } as unknown as Request;
  const result = await new Promise<InvocationResult>((resolve) => {
    let status = 200;
    const res = {
      status(code: number) {
        status = code;
        return this;
      },
      json(body: unknown) {
        resolve({ status, body });
        return this;
      }
    } as unknown as Response;
    requireAdmin(req, res, () => resolve({ status: 204 }));
  });
  assert.equal(result.status, 403);
});

test('manual route is registered with authenticate and requireAdmin', () => {
  const routeSource = readFileSync(
    join(__dirname, '..', 'routes', 'orders.routes.ts'),
    'utf8'
  );
  assert.match(
    routeSource,
    /router\.post\([\s\S]*?['"]\/manual['"],\s*placeOrderLimiter,\s*authenticate,\s*requireAdmin,\s*orderController\.createManualOrder/
  );
});

test('11. admin manual order skips closed-date validation', async () => {
  const harness = createHarness({ closedDate: true });
  try {
    const result = await invoke(harness.controller.createManualOrder as any, {
      ...validOrderBody,
      eventDate: '2000-01-01',
      paymentStatus: 'paid'
    });
    assert.equal(result.status, 201);
    assert.equal(harness.getDateValidationCalls(), 0);
  } finally {
    harness.restore();
  }
});

for (const [number, paymentStatus, expectedPaid] of [
  [12, 'paid', true],
  [13, 'unpaid', false]
] as const) {
  test(`${number}. admin manual ${paymentStatus} creates processing order`, async () => {
    const harness = createHarness();
    try {
      const result = await invoke(harness.controller.createManualOrder as any, {
        ...validOrderBody,
        paymentStatus
      });
      assert.equal(result.status, 201);
      assert.equal(result.body.order.status, 'processing');
      assert.equal(result.body.order.customerDetails.isPaid, expectedPaid);
      assert.equal(harness.calls[0].options.isManual, true);
      assert.equal(harness.calls[0].options.paymentStatus, paymentStatus);
    assert.equal(harness.calls[0].options.paymentInitTokenHash, undefined);
    assert.equal(harness.calls[0].options.paymentInitTokenExpiresAt, undefined);
    assert.equal(result.body.paymentInitToken, undefined);
      assert.equal(harness.getEmailCalls(), 1);
    } finally {
      harness.restore();
    }
  });
}

test('14. admin manual order rejects invalid paymentStatus', async () => {
  const harness = createHarness();
  try {
    const result = await invoke(harness.controller.createManualOrder as any, {
      ...validOrderBody,
      paymentStatus: 'captured'
    });
    assert.equal(result.status, 400);
    assert.equal(result.body.code, 'INVALID_PAYMENT_STATUS');
    assert.equal(harness.calls.length, 0);
  } finally {
    harness.restore();
  }
});

test('15. admin manual order rejects direct status and isPaid', async () => {
  const harness = createHarness();
  try {
    for (const forbidden of [{ status: 'processing' }, { isPaid: true }, { customerDetails: { isPaid: true } }]) {
      const result = await invoke(harness.controller.createManualOrder as any, {
        ...validOrderBody,
        paymentStatus: 'paid',
        ...forbidden
      });
      assert.equal(result.status, 400);
      assert.equal(result.body.code, 'FORBIDDEN_ORDER_FIELDS');
    }
    assert.equal(harness.calls.length, 0);
  } finally {
    harness.restore();
  }
});

test('16. public response still provides orderId used by payment initiation', async () => {
  const harness = createHarness();
  try {
    const result = await invoke(harness.controller.createOrder, validOrderBody);
    assert.equal(result.status, 201);
    assert.equal(typeof result.body.orderId, 'string');
    assert.equal(result.body.orderId, 'order-123');
  } finally {
    harness.restore();
  }
});
