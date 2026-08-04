/**
 * Phase 1 — admin payments dashboard helpers + API surface tests.
 * Uses in-memory Order stubs; does not hit Tranzila.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import {
  ADMIN_PAYMENT_STATUSES,
  assertNoSensitiveLeak,
  averageTransactionAmount,
  buildFunnelBucketClause,
  buildPaidOrdersClause,
  buildPaymentTimeline,
  buildPaymentsCsv,
  buildPaymentsMatch,
  buildPaymentsVisibilityClause,
  canCapturePayment,
  canVoidPayment,
  evaluatePaymentExceptions,
  hasActiveCaptureLock,
  isPaidOrder,
  mapOrderToPaymentRow,
  orderHasPaymentSignal,
  parseListQuery,
  previousPeriodRange,
  resolveDisplayStatus,
  resolvePaymentAt,
  resolvePaymentBucket
} from '../utils/admin-payments.util';

test('Phase 1 util: capture lock forces manual_review display and blocks actions', () => {
  const locked = {
    paymentStatus: 'authorized',
    captureLockId: 'lock-abc',
    totalPrice: 100,
    customerDetails: { fullName: 'דני', phone: '050' }
  };
  assert.equal(hasActiveCaptureLock(locked), true);
  assert.equal(resolveDisplayStatus(locked), 'manual_review');
  assert.equal(canCapturePayment(locked), false);
  assert.equal(canVoidPayment(locked), false);

  const free = { ...locked, captureLockId: null };
  assert.equal(canCapturePayment(free), true);
  assert.equal(canVoidPayment(free), true);
  // Mapped admin row is always read-only (no money-moving actions advertised).
  assert.equal(mapOrderToPaymentRow(free).canCapture, false);
  assert.equal(mapOrderToPaymentRow(free).canVoid, false);
});

test('Phase 1 util: paymentStatus filter and date range in match', () => {
  const match = buildPaymentsMatch({
    paymentStatus: 'captured',
    dateFrom: new Date('2026-01-01'),
    dateTo: new Date('2026-01-31T23:59:59.999Z')
  });
  const and = (match as any).$and as any[];
  assert.ok(Array.isArray(and));
  assert.ok(and.some((c) => c.paymentStatus === 'captured'));
  assert.ok(and.some((c) => c.createdAt?.$gte));
});

test('Phase 1 util: manual_review filter matches capture lock', () => {
  const match = buildPaymentsMatch({ paymentStatus: 'manual_review' });
  const and = (match as any).$and as any[];
  assert.ok(and.some((c) => c.captureLockId?.$type === 'string'));
});

test('Phase 1 util: search matches order number / name / phone / transaction', () => {
  const match = buildPaymentsMatch({ search: 'MG-99' });
  const and = (match as any).$and as any[];
  const searchOr = and.find(
    (c) => Array.isArray(c.$or) && c.$or.some((x: any) => x.orderNumber)
  );
  assert.ok(searchOr);
  assert.ok(searchOr.$or.some((c: any) => c.transactionId));
});

test('Phase 1 util: parseListQuery defaults newest first pagination + this_month range', () => {
  const f = parseListQuery({});
  assert.equal(f.page, 1);
  assert.equal(f.limit, 25);
  assert.equal(f.sortBy, 'createdAt');
  assert.equal(f.sortDir, 'desc');
  assert.equal(f.includeDeletedPayments, true);
  assert.ok(f.dateFrom instanceof Date);
  assert.ok(f.dateTo instanceof Date);
  assert.ok(f.dateFrom!.getTime() <= f.dateTo!.getTime());
});

test('Phase 1 util: default match includes soft-deleted with payment signal', () => {
  const match = buildPaymentsMatch({});
  assert.ok(Array.isArray((match as any).$or));
  assert.ok((match as any).$or.some((c: any) => c.isDeleted === true));
  assert.ok((match as any).$or.some((c: any) => c.isDeleted?.$ne === true));
});

test('Phase 1 util: active_only hides soft-deleted', () => {
  const match = buildPaymentsMatch({ includeDeletedPayments: false });
  assert.deepEqual(match, { isDeleted: { $ne: true } });
});

test('Phase 1 util: soft-deleted authorized cannot capture/void', () => {
  const doc = {
    paymentStatus: 'authorized',
    isDeleted: true,
    captureLockId: null,
    totalPrice: 10
  };
  assert.equal(canCapturePayment(doc), false);
  assert.equal(canVoidPayment(doc), false);
  const row = mapOrderToPaymentRow({ ...doc, _id: 'd1', customerDetails: {} });
  assert.equal(row.isOrderDeleted, true);
  assert.equal(row.canCapture, false);
});

test('Phase 1 util: map row never exposes lock id; refund always false; new display fields', () => {
  const row = mapOrderToPaymentRow({
    _id: 'oid1',
    orderNumber: 'MG-1',
    paymentStatus: 'authorized',
    captureLockId: 'secret-lock',
    totalPrice: 55.5,
    transactionId: '998877',
    customerDetails: { fullName: 'רותי', phone: '052' },
    createdAt: new Date('2026-07-01')
  });
  assert.equal(row.requiresManualReview, true);
  assert.equal(row.canRefund, false);
  assert.equal(row.amount, 55.5);
  assert.equal(row.rawPaymentStatus, 'authorized');
  assert.equal(row.paymentBucket, 'pending');
  assert.equal(row.hasException, true);
  assert.ok(row.primaryException);
  assert.equal(row.canCapture, false);
  assert.equal(row.canVoid, false);
  assert.equal((row as any).captureLockId, undefined);
  assert.equal((row as any).paymentSecurityToken, undefined);
});

test('Phase 1 util: paymentAt falls back without paidAt', () => {
  const at = resolvePaymentAt({
    paymentStatus: 'captured',
    confirmationEmailSentAt: new Date('2026-07-02T10:00:00Z'),
    updatedAt: new Date('2026-07-03T10:00:00Z')
  });
  assert.ok(at?.startsWith('2026-07-02'));
});

test('Phase 1 util: timeline includes capture lock without lock id', () => {
  const events = buildPaymentTimeline({
    createdAt: new Date('2026-07-01'),
    captureLockId: 'xyz',
    captureStartedAt: new Date('2026-07-02'),
    paymentStatus: 'authorized',
    updatedAt: new Date('2026-07-02')
  });
  assert.ok(events.some((e) => e.key === 'capture_lock'));
  const joined = JSON.stringify(events);
  assert.equal(joined.includes('xyz'), false);
});

test('Phase 1 util: CSV has BOM and new Hebrew headers; respects display status', () => {
  const csv = buildPaymentsCsv([
    mapOrderToPaymentRow({
      _id: '1',
      orderNumber: 'MG-7',
      paymentStatus: 'authorized',
      captureLockId: 'L',
      totalPrice: 10,
      customerDetails: { fullName: 'עברית', phone: '050' },
      createdAt: new Date()
    })
  ]);
  assert.ok(csv.charCodeAt(0) === 0xfeff || csv.startsWith('\uFEFF'));
  assert.ok(csv.includes('תאריך'));
  assert.ok(csv.includes('מספר הזמנה'));
  assert.ok(csv.includes('שם לקוח'));
  assert.ok(csv.includes('טלפון'));
  assert.ok(csv.includes('אימייל'));
  assert.ok(csv.includes('סוג הזמנה'));
  assert.ok(csv.includes('סכום'));
  assert.ok(csv.includes('סטטוס תשלום'));
  assert.ok(csv.includes('אסמכתה'));
  assert.ok(csv.includes('הזמנה מחוקה'));
  assert.ok(csv.includes('סוג חריגה'));
  assert.ok(csv.includes('חומרת חריגה'));
  assert.ok(csv.includes('דורש בדיקה'));
  assert.equal(csv.includes('captureLockId'), false);
  assert.equal(csv.includes('cardToken'), false);
  assert.equal(csv.includes('paymentSecurityToken'), false);
  assert.equal(csv.includes('authCode'), false);
});

test('Phase 1 util: assertNoSensitiveLeak detects forbidden keys', () => {
  const leaks = assertNoSensitiveLeak({
    ok: true,
    data: { captureLockId: 'x', nested: { paymentSecurityToken: 'y' } }
  });
  assert.ok(leaks.includes('data.captureLockId'));
  assert.ok(leaks.includes('data.nested.paymentSecurityToken'));
});

test('Phase 1 util: known statuses do not invent refunded', () => {
  assert.equal(ADMIN_PAYMENT_STATUSES.includes('refunded' as any), false);
});

test('Phase 1 routes: admin payments + capture/void still on existing paths', () => {
  const routesPayments = fs.readFileSync(
    path.join(__dirname, '../routes/admin-payments.routes.ts'),
    'utf8'
  );
  assert.match(routesPayments, /authenticate,\s*requireAdmin/);
  assert.match(routesPayments, /\/summary/);
  assert.match(routesPayments, /\/export\.csv/);

  const routesPayment = fs.readFileSync(
    path.join(__dirname, '../routes/payment.routes.ts'),
    'utf8'
  );
  assert.match(
    routesPayment,
    /router\.post\(['"]\/capture\/:orderId['"],\s*authenticate,\s*requireAdmin/
  );
  assert.match(
    routesPayment,
    /router\.post\(['"]\/void\/:orderId['"],\s*authenticate,\s*requireAdmin/
  );
});

test('Phase 1 server mounts /api/admin/payments', () => {
  const server = fs.readFileSync(path.join(__dirname, '../server.ts'), 'utf8');
  assert.match(server, /\/api\/admin\/payments/);
  assert.match(server, /adminPaymentsRoutes/);
});

// ── Service layer with Order stubs ───────────────────────────────────────────

test('Phase 1 service: summary counts by status + manual review', async () => {
  const Order = (await import('../models/Order')).default as any;
  const originalAgg = Order.aggregate;
  const originalCount = Order.countDocuments;
  const originalFind = Order.find;
  let aggCalls = 0;

  Order.aggregate = async (pipeline: any[]) => {
    aggCalls += 1;
    const match = pipeline[0]?.$match || {};
    const blob = JSON.stringify(match);
    const isPaidAgg =
      blob.includes('"paymentStatus":"captured"') &&
      blob.includes('customerDetails.isPaid') &&
      blob.includes('isTestOrder');
    const isCapturedOnly =
      match.$and &&
      Array.isArray(match.$and) &&
      match.$and.some((c: any) => c.paymentStatus === 'captured') &&
      !blob.includes('customerDetails.isPaid');

    if (isPaidAgg) {
      return [{ _id: null, count: 3, amount: 350, deletedCount: 1 }];
    }
    if (isCapturedOnly) {
      return [{ _id: null, count: 2, amount: 300 }];
    }
    return [
      { _id: 'captured', count: 2, amount: 300 },
      { _id: 'authorized', count: 1, amount: 50 },
      { _id: 'awaiting_payment', count: 3, amount: 90 },
      { _id: 'failed', count: 1, amount: 20 },
      { _id: 'voided', count: 1, amount: 40 }
    ];
  };
  Order.countDocuments = async () => 1;
  Order.find = () => {
    const chain: any = {
      select: () => chain,
      limit: () => chain,
      lean: async () => []
    };
    return chain;
  };

  try {
    const { getAdminPaymentsSummary } = await import('../services/admin-payments.service');
    const summary = await getAdminPaymentsSummary({});
    assert.ok(aggCalls >= 3);
    assert.equal(summary.totalReceived, 350);
    assert.equal(summary.paid?.count, 3);
    assert.equal(summary.paid?.deletedCount, 1);
    assert.equal(summary.captured.count, 2);
    assert.equal(summary.authorized.count, 1);
    assert.equal(summary.awaitingPayment.count, 3);
    assert.equal(summary.failed.count, 1);
    assert.equal(summary.voided.count, 1);
    assert.equal(summary.manualReview.count, 1);
    assert.ok(Array.isArray(summary.missingFields));
    assert.ok(summary.notes?.dateBasis?.includes('effectivePaidAt'));
  } finally {
    Order.aggregate = originalAgg;
    Order.countDocuments = originalCount;
    Order.find = originalFind;
  }
});

test('Phase 1 service: deleted captured appears in default list; no-signal deleted excluded by match', async () => {
  const defaultMatch = buildPaymentsMatch({});
  const activeMatch = buildPaymentsMatch({ includeDeletedPayments: false });

  const deletedCaptured = {
    _id: 'dc1',
    isDeleted: true,
    status: 'delivered',
    paymentStatus: 'captured',
    totalPrice: 100,
    transactionId: 'TX-ARCHIVED',
    customerDetails: {}
  };
  const deletedNoSignal = {
    _id: 'dn1',
    isDeleted: true,
    totalPrice: 50,
    customerDetails: {}
  };
  const active = {
    _id: 'a1',
    isDeleted: false,
    paymentStatus: 'authorized',
    totalPrice: 20,
    customerDetails: {}
  };

  assert.equal(orderHasPaymentSignal(deletedCaptured), true);
  assert.equal(orderHasPaymentSignal(deletedNoSignal), false);

  assert.ok(JSON.stringify(defaultMatch).includes('"isDeleted":true'));
  assert.deepEqual(activeMatch, { isDeleted: { $ne: true } });

  const Order = (await import('../models/Order')).default as any;
  const originalFind = Order.find;
  const originalCount = Order.countDocuments;
  let lastMatch: any = null;

  const docs = [deletedCaptured, active].map((d) => ({
    ...d,
    createdAt: new Date(),
    customerDetails: { fullName: 'x', phone: '050' }
  }));

  Order.countDocuments = async (match: any) => {
    lastMatch = match;
    return docs.length;
  };
  Order.find = (match: any) => {
    lastMatch = match;
    const chain: any = {
      select: () => chain,
      sort: () => chain,
      skip: () => chain,
      limit: () => chain,
      lean: async () => docs
    };
    return chain;
  };

  try {
    const { listAdminPayments } = await import('../services/admin-payments.service');
    const result = await listAdminPayments({ page: 1, limit: 25 });
    assert.equal(result.meta.total, 2);
    assert.equal(result.meta.totalPages, 1);
    assert.ok(JSON.stringify(lastMatch).includes('"isDeleted":true'));
    const deletedRow = result.data.find((r) => r.id === 'dc1');
    assert.ok(deletedRow);
    assert.equal(deletedRow!.isOrderDeleted, true);
    assert.equal(deletedRow!.canCapture, false);
    assert.equal(deletedRow!.canVoid, false);
    assert.equal(deletedRow!.paymentStatus, 'captured');
    // Normal archive / deleted paid without suspicious ops status is not an open exception.
    assert.equal(deletedRow!.hasException, false);
    assert.equal(deletedRow!.paymentBucket, 'paid');

    const csv = buildPaymentsCsv(result.data);
    assert.ok(csv.includes('הזמנה מחוקה'));
    assert.ok(csv.includes('כן'));
    assert.ok(csv.includes('לא'));

    await listAdminPayments({
      page: 1,
      limit: 25,
      includeDeletedPayments: false
    });
    assert.deepEqual(lastMatch, { isDeleted: { $ne: true } });
  } finally {
    Order.find = originalFind;
    Order.countDocuments = originalCount;
  }
});

test('Phase 2 util: paid clause is SSOT (proof + amount + not test)', () => {
  const clause = buildPaidOrdersClause() as any;
  assert.equal(clause.isTestOrder.$ne, true);
  const proof = (clause.$and || []).find((c: any) => Array.isArray(c?.$or));
  assert.ok(proof);
  assert.ok(proof.$or.some((c: any) => c.paymentStatus === 'captured'));
  assert.ok(proof.$or.some((c: any) => c['customerDetails.isPaid'] === true));
  assert.ok(proof.$or.some((c: any) => c.paidAt?.$type === 'date'));
});

test('Phase 1 util: CSV respects deleted operational status column', () => {
  const row = mapOrderToPaymentRow({
    _id: '1',
    orderNumber: 'MG-DEL',
    paymentStatus: 'captured',
    isDeleted: true,
    totalPrice: 40,
    customerDetails: { fullName: 'עברית', phone: '050' },
    createdAt: new Date()
  });
  const csv = buildPaymentsCsv([row]);
  assert.ok(csv.startsWith('\uFEFF') || csv.charCodeAt(0) === 0xfeff);
  assert.ok(csv.includes('הזמנה מחוקה'));
  assert.ok(csv.includes('כן'));
  assert.equal(csv.includes('captureLockId'), false);
  assert.equal(csv.includes('cardToken'), false);
  assert.equal(csv.includes('paymentSecurityToken'), false);
  assert.equal(csv.includes('authCode'), false);
});

test('Phase 1 service: list pagination + no sensitive fields', async () => {
  const Order = (await import('../models/Order')).default as any;
  const originalFind = Order.find;
  const originalCount = Order.countDocuments;

  const docs = [
    {
      _id: 'a',
      orderNumber: 'MG-A',
      paymentStatus: 'authorized',
      captureLockId: 'LOCK',
      totalPrice: 10,
      transactionId: 'TX1',
      createdAt: new Date('2026-07-10'),
      customerDetails: { fullName: 'א', phone: '050' }
    },
    {
      _id: 'b',
      orderNumber: 'MG-B',
      paymentStatus: 'captured',
      totalPrice: 20,
      transactionId: 'TX2',
      createdAt: new Date('2026-07-11'),
      customerDetails: { fullName: 'ב', phone: '051' }
    }
  ];

  Order.countDocuments = async () => 2;
  Order.find = () => {
    const chain: any = {
      select: () => chain,
      sort: () => chain,
      skip: () => chain,
      limit: () => chain,
      lean: async () => docs
    };
    return chain;
  };

  try {
    const { listAdminPayments } = await import('../services/admin-payments.service');
    const result = await listAdminPayments({ page: 1, limit: 25 });
    assert.equal(result.meta.total, 2);
    assert.equal(result.data.length, 2);
    assert.equal(result.data[0].requiresManualReview, true);
    assert.equal(result.data[0].canCapture, false);
    assert.equal(typeof result.data[0].hasException, 'boolean');
    assert.equal(typeof result.data[0].rawPaymentStatus, 'string');
    assert.ok(result.data[0].paymentBucket);
    const leaks = assertNoSensitiveLeak(result);
    assert.deepEqual(leaks, []);
  } finally {
    Order.find = originalFind;
    Order.countDocuments = originalCount;
  }
});

test('Phase 1 service: detail strips secrets and flags lock', async () => {
  const Order = (await import('../models/Order')).default as any;
  const PaymentAuditEvent = (await import('../models/PaymentAuditEvent')).default as any;
  const originalFindById = Order.findById;
  const originalAuditFind = PaymentAuditEvent.find;

  Order.findById = () => {
    const chain: any = {
      select: () => chain,
      lean: async () => ({
        _id: 'oid',
        orderNumber: 'MG-9',
        paymentStatus: 'authorized',
        captureLockId: 'secret-lock-id',
        captureStartedAt: new Date('2026-07-12'),
        paymentSecurityToken: 'tok',
        paymentInitTokenHash: 'hash',
        cardToken: 'card',
        authCode: 'AUTH',
        totalPrice: 99,
        transactionId: '9988',
        createdAt: new Date('2026-07-11'),
        updatedAt: new Date('2026-07-12'),
        customerDetails: { fullName: 'ג', phone: '052', email: 'g@ex.com' },
        items: [{ name: 'מנה', quantity: 1, price: 99 }]
      })
    };
    return chain;
  };

  PaymentAuditEvent.find = () => {
    const chain: any = {
      select: () => chain,
      sort: () => chain,
      limit: () => chain,
      lean: async () => []
    };
    return chain;
  };

  try {
    const { getAdminPaymentDetail } = await import('../services/admin-payments.service');
    const detail = await getAdminPaymentDetail('oid');
    assert.ok(detail);
    assert.equal(detail!.requiresManualReview, true);
    assert.equal(detail!.canCapture, false);
    assert.equal(detail!.canVoid, false);
    assert.equal(detail!.canRefund, false);
    assert.equal(detail!.historySource, 'fallback_timeline');
    assert.ok(Array.isArray(detail!.timeline));
    assert.equal(detail!.hasException, true);
    assert.equal(detail!.rawPaymentStatus, 'authorized');
    assert.equal(detail!.paymentBucket, 'pending');
    assert.ok(detail!.primaryException);
    const leaks = assertNoSensitiveLeak(detail);
    assert.deepEqual(leaks, []);
    assert.equal(JSON.stringify(detail).includes('secret-lock-id'), false);
    assert.equal(JSON.stringify(detail).includes('paymentSecurityToken'), false);
  } finally {
    Order.findById = originalFindById;
    PaymentAuditEvent.find = originalAuditFind;
  }
});

test('Phase 1 service: CSV export dumps selected range including archived (ignores funnel/search)', async () => {
  const Order = (await import('../models/Order')).default as any;
  const originalFind = Order.find;
  let seenMatch: any = null;
  let seenLimit = 0;

  Order.find = (match: any) => {
    seenMatch = match;
    const chain: any = {
      select: () => chain,
      sort: () => chain,
      limit: (n: number) => {
        seenLimit = n;
        return chain;
      },
      lean: async () => [
        {
          _id: '1',
          orderNumber: 'MG-CSV',
          paymentStatus: 'captured',
          status: 'ready',
          isDeleted: true,
          totalPrice: 40,
          transactionId: 'R1',
          createdAt: new Date('2026-07-15T10:00:00Z'),
          paidAt: new Date('2026-07-15T10:00:00Z'),
          customerDetails: { fullName: 'ייצוא', phone: '053', deliveryType: 'delivery' }
        }
      ]
    };
    return chain;
  };

  try {
    const { exportAdminPaymentsCsv } = await import('../services/admin-payments.service');
    const from = new Date('2026-07-01T00:00:00Z');
    const to = new Date('2026-07-31T23:59:59Z');
    const csv = await exportAdminPaymentsCsv({
      dateFrom: from,
      dateTo: to,
      paymentStatus: 'captured',
      search: 'MG-CSV',
      funnelBucket: 'pending'
    });
    const and = seenMatch.$and || [seenMatch];
    // Funnel/search/status must not narrow accounting export.
    assert.equal(
      and.some((c: any) => c.paymentStatus === 'captured'),
      false
    );
    // Activity date basis: createdAt OR paidAt OR capturedAt
    assert.ok(
      and.some(
        (c: any) =>
          Array.isArray(c.$or) &&
          c.$or.some((x: any) => x.createdAt) &&
          c.$or.some((x: any) => x.paidAt)
      )
    );
    // Archived/past included via visibility clause
    assert.ok(JSON.stringify(seenMatch).includes('"isDeleted":true'));
    assert.ok(seenLimit >= 5000);
    assert.ok(csv.includes('MG-CSV'));
    assert.ok(csv.includes('שולם'));
    assert.ok(csv.includes('תאריך'));
    assert.ok(csv.includes('מספר הזמנה'));
    assert.ok(csv.startsWith('\uFEFF') || csv.charCodeAt(0) === 0xfeff);
    assert.equal(csv.includes('captureLockId'), false);
  } finally {
    Order.find = originalFind;
  }
});

test('util: parseListQuery forExport forces activity date + archived include', () => {
  const f = parseListQuery({
    forExport: 'true',
    preset: 'last_month',
    funnelBucket: 'pending',
    includeDeletedPayments: 'false'
  });
  assert.equal(f.forExport, true);
  assert.equal(f.dateBasis, 'activity');
  assert.equal(f.includeDeletedPayments, true);
  assert.equal(f.funnelBucket, 'all');
  assert.ok(f.dateFrom instanceof Date);
  assert.ok(f.dateTo instanceof Date);
});

// ── Expanded coverage ────────────────────────────────────────────────────────

test('util: isPaidOrder — captured alone, isPaid alone, both, neither, ops-implied', () => {
  assert.equal(isPaidOrder({ paymentStatus: 'captured', customerDetails: {}, totalPrice: 10 }), true);
  assert.equal(
    isPaidOrder({ paymentStatus: 'pending', customerDetails: { isPaid: true }, totalPrice: 10 }),
    true
  );
  assert.equal(
    isPaidOrder({ paymentStatus: 'captured', customerDetails: { isPaid: true }, totalPrice: 10 }),
    true
  );
  assert.equal(isPaidOrder({ paymentStatus: 'pending', customerDetails: {}, totalPrice: 10 }), false);
  assert.equal(isPaidOrder({ paymentStatus: 'failed', customerDetails: { isPaid: false }, totalPrice: 10 }), false);
  assert.equal(isPaidOrder({ paymentStatus: 'captured', customerDetails: {}, totalPrice: 10, isTestOrder: true }), false);
  assert.equal(
    isPaidOrder({
      paymentStatus: 'pending',
      status: 'ready',
      isDeleted: true,
      customerDetails: {},
      totalPrice: 100
    }),
    true
  );
  assert.equal(
    isPaidOrder({
      paymentStatus: 'awaiting_payment',
      status: 'processing',
      isDeleted: false,
      customerDetails: {},
      totalPrice: 100
    }),
    false
  );
});

test('util: averageTransactionAmount — revenue/count; zero count → 0 not NaN', () => {
  assert.equal(averageTransactionAmount(100, 4), 25);
  assert.equal(averageTransactionAmount(99.99, 3), 33.33);
  assert.equal(averageTransactionAmount(50, 0), 0);
  assert.equal(averageTransactionAmount(50, -1), 0);
  assert.ok(!Number.isNaN(averageTransactionAmount(10, 0)));
});

test('util: previousPeriodRange equal length', () => {
  const from = new Date('2026-07-01T00:00:00.000Z');
  const to = new Date('2026-07-10T23:59:59.999Z');
  const prev = previousPeriodRange(from, to);
  assert.ok(prev);
  const curMs = to.getTime() - from.getTime();
  const prevMs = prev!.dateTo.getTime() - prev!.dateFrom.getTime();
  assert.equal(prevMs, curMs);
  assert.equal(prev!.dateTo.getTime(), from.getTime() - 1);
  assert.equal(previousPeriodRange(to, from), null);
});

test('util: evaluatePaymentExceptions — failed → critical', () => {
  const ex = evaluatePaymentExceptions({
    paymentStatus: 'failed',
    status: 'processing',
    totalPrice: 50,
    customerDetails: {},
    createdAt: new Date()
  });
  assert.ok(ex.some((e) => e.code === 'payment_failed' && e.severity === 'critical'));
});

test('util: evaluatePaymentExceptions — stale pending >24h', () => {
  const now = new Date('2026-08-03T12:00:00Z');
  const stale = new Date(now.getTime() - 25 * 60 * 60 * 1000);
  const ex = evaluatePaymentExceptions(
    {
      paymentStatus: 'pending',
      totalPrice: 40,
      customerDetails: {},
      createdAt: stale
    },
    now
  );
  assert.ok(ex.some((e) => e.code === 'stale_pending' && e.severity === 'warning'));

  const fresh = evaluatePaymentExceptions(
    {
      paymentStatus: 'awaiting_payment',
      totalPrice: 40,
      customerDetails: {},
      createdAt: new Date(now.getTime() - 2 * 60 * 60 * 1000)
    },
    now
  );
  assert.equal(fresh.some((e) => e.code === 'stale_pending'), false);
});

test('util: evaluatePaymentExceptions — archived ready is NOT a warning', () => {
  const ex = evaluatePaymentExceptions({
    paymentStatus: 'captured',
    status: 'ready',
    isDeleted: true,
    totalPrice: 80,
    transactionId: 'TX',
    customerDetails: {}
  });
  assert.equal(ex.length, 0);
});

test('util: evaluatePaymentExceptions — archive with pending paymentStatus shows settled, no warning', () => {
  const doc = {
    paymentStatus: 'pending',
    status: 'ready',
    isDeleted: true,
    totalPrice: 5950,
    customerDetails: {}
  };
  assert.equal(isPaidOrder(doc), true);
  assert.equal(resolveDisplayStatus(doc), 'captured');
  assert.equal(evaluatePaymentExceptions(doc).length, 0);
});

test('util: processing + awaiting_payment remains unpaid (open work)', () => {
  const doc = {
    paymentStatus: 'awaiting_payment',
    status: 'processing',
    isDeleted: false,
    totalPrice: 1982,
    customerDetails: {},
    createdAt: new Date()
  };
  assert.equal(isPaidOrder(doc), false);
  assert.equal(resolveDisplayStatus(doc), 'awaiting_payment');
});

test('util: evaluatePaymentExceptions — manager resolution clears failed warning', () => {
  const open = evaluatePaymentExceptions({
    paymentStatus: 'failed',
    status: 'processing',
    totalPrice: 40,
    customerDetails: {}
  });
  assert.ok(open.some((e) => e.code === 'payment_failed'));

  const closed = evaluatePaymentExceptions({
    paymentStatus: 'failed',
    status: 'processing',
    totalPrice: 40,
    paymentExceptionResolvedAt: new Date(),
    customerDetails: {}
  });
  assert.equal(closed.some((e) => e.code === 'payment_failed'), false);
});

test('util: mapOrderToPaymentRow uses adminPriceOverride as amount', () => {
  const row = mapOrderToPaymentRow({
    _id: 'a1',
    orderNumber: 'MG-1',
    paymentStatus: 'captured',
    status: 'delivered',
    totalPrice: 100,
    adminPriceOverride: 250,
    transactionId: 'TX',
    customerDetails: { firstName: 'א', lastName: 'ב' },
    createdAt: new Date()
  });
  assert.equal(row.amount, 250);
  assert.equal(row.hasException, false);
  assert.equal(row.requiresManualReview, false);
  assert.equal(row.displayStatus, 'captured');
});

test('util: evaluatePaymentExceptions — invalid amount', () => {
  const ex = evaluatePaymentExceptions({
    paymentStatus: 'captured',
    totalPrice: 0,
    transactionId: 'TX',
    customerDetails: {}
  });
  assert.ok(ex.some((e) => e.code === 'invalid_amount' && e.severity === 'warning'));
});

test('util: evaluatePaymentExceptions — adminPriceOverride clears invalid_amount', () => {
  const ex = evaluatePaymentExceptions({
    paymentStatus: 'captured',
    totalPrice: 0,
    adminPriceOverride: 500,
    transactionId: 'TX',
    customerDetails: {}
  });
  assert.equal(ex.some((e) => e.code === 'invalid_amount'), false);
});

test('util: evaluatePaymentExceptions — conflicting isPaid + failed', () => {
  const ex = evaluatePaymentExceptions({
    paymentStatus: 'failed',
    status: 'processing',
    totalPrice: 30,
    customerDetails: { isPaid: true }
  });
  assert.ok(ex.some((e) => e.code === 'conflicting_payment_fields'));
  assert.ok(ex.some((e) => e.code === 'payment_failed'));
});

test('util: evaluatePaymentExceptions — captured without transactionId', () => {
  const ex = evaluatePaymentExceptions({
    paymentStatus: 'captured',
    status: 'processing',
    isDeleted: false,
    totalPrice: 60,
    customerDetails: {}
  });
  assert.ok(ex.some((e) => e.code === 'paid_missing_reference' && e.severity === 'info'));
});

test('util: evaluatePaymentExceptions — unknown status', () => {
  const ex = evaluatePaymentExceptions({
    paymentStatus: 'weird_status',
    totalPrice: 20,
    customerDetails: {}
  });
  assert.ok(ex.some((e) => e.code === 'unknown_status' && e.severity === 'warning'));
});

test('util: evaluatePaymentExceptions — capture lock', () => {
  const ex = evaluatePaymentExceptions({
    paymentStatus: 'authorized',
    captureLockId: 'lock-1',
    totalPrice: 70,
    customerDetails: {},
    createdAt: new Date()
  });
  assert.ok(ex.some((e) => e.code === 'active_capture_lock' && e.severity === 'warning'));
});

test('util: soft-deleted WITH payment signal vs WITHOUT', () => {
  const withSignal = {
    isDeleted: true,
    paymentStatus: 'captured',
    totalPrice: 10,
    customerDetails: {}
  };
  const withoutSignal = {
    isDeleted: true,
    totalPrice: 10,
    customerDetails: {}
  };
  assert.equal(orderHasPaymentSignal(withSignal), true);
  assert.equal(orderHasPaymentSignal(withoutSignal), false);

  const vis = buildPaymentsVisibilityClause(true);
  assert.ok(Array.isArray((vis as any).$or));
  assert.ok((vis as any).$or.some((c: any) => c.isDeleted === true && Array.isArray(c.$or)));

  const activeOnly = buildPaymentsVisibilityClause(false);
  assert.deepEqual(activeOnly, { isDeleted: { $ne: true } });
});

test('util: status mapping for all ADMIN_PAYMENT_STATUSES via resolvePaymentBucket / resolveDisplayStatus', () => {
  const expectedBucket: Record<string, string> = {
    pending: 'pending',
    awaiting_payment: 'pending',
    authorized: 'pending',
    captured: 'paid',
    voided: 'failed_cancelled',
    failed: 'failed_cancelled'
  };

  for (const status of ADMIN_PAYMENT_STATUSES) {
    // Use open ops status so unpaid paymentStatuses stay unpaid (not ops-implied).
    const doc = {
      paymentStatus: status,
      status: 'processing',
      isDeleted: false,
      totalPrice: 10,
      customerDetails: {}
    };
    if (status === 'captured') {
      assert.equal(resolveDisplayStatus(doc), 'captured');
      assert.equal(resolvePaymentBucket(doc), 'paid');
    } else {
      assert.equal(resolveDisplayStatus(doc), status);
      assert.equal(resolvePaymentBucket(doc), expectedBucket[status]);
    }
  }

  assert.equal(
    resolveDisplayStatus({ paymentStatus: 'authorized', captureLockId: 'x', customerDetails: {} }),
    'manual_review'
  );
  assert.equal(
    resolveDisplayStatus({
      paymentStatus: 'totally_unknown',
      status: 'processing',
      customerDetails: {}
    }),
    'unknown'
  );
  assert.equal(
    resolveDisplayStatus({
      paymentStatus: 'pending',
      status: 'ready',
      isDeleted: true,
      totalPrice: 10,
      customerDetails: {}
    }),
    'captured'
  );
});

test('util: funnel bucket clauses exist for paid/pending/failed_cancelled/exceptions', () => {
  assert.equal(buildFunnelBucketClause('all'), null);

  const paid = buildFunnelBucketClause('paid');
  assert.ok(paid);
  assert.deepEqual(paid, buildPaidOrdersClause());

  const pending = buildFunnelBucketClause('pending') as any;
  assert.ok(Array.isArray(pending.$and));
  assert.ok(
    pending.$and.some(
      (c: any) =>
        Array.isArray(c.paymentStatus?.$in) &&
        c.paymentStatus.$in.includes('pending') &&
        c.paymentStatus.$in.includes('authorized')
    )
  );

  const failed = buildFunnelBucketClause('failed_cancelled') as any;
  assert.deepEqual(failed.paymentStatus.$in, ['failed', 'voided']);

  const exceptions = buildFunnelBucketClause('exceptions') as any;
  assert.ok(Array.isArray(exceptions.$or));
  assert.ok(exceptions.$or.length > 0);
});

test('util: assertNoSensitiveLeak catches authCode and cardToken', () => {
  const leaks = assertNoSensitiveLeak({
    row: { authCode: 'A1', nested: { cardToken: 'tok' } }
  });
  assert.ok(leaks.includes('row.authCode'));
  assert.ok(leaks.includes('row.nested.cardToken'));
});

test('routes: admin-payments only GET; required endpoints; auth+admin; no mutating verbs', () => {
  const src = fs.readFileSync(
    path.join(__dirname, '../routes/admin-payments.routes.ts'),
    'utf8'
  );
  assert.match(src, /authenticate,\s*requireAdmin/);
  assert.match(src, /router\.get\(\s*['"]\/summary['"]/);
  assert.match(src, /router\.get\(\s*['"]\/funnel['"]/);
  assert.match(src, /router\.get\(\s*['"]\/revenue-series['"]/);
  assert.match(src, /router\.get\(\s*['"]\/exceptions['"]/);
  assert.match(src, /router\.get\(\s*['"]\/export\.csv['"]/);
  assert.equal(/router\.post\s*\(/.test(src), false);
  assert.equal(/router\.put\s*\(/.test(src), false);
  assert.equal(/router\.patch\s*\(/.test(src), false);
  assert.equal(/router\.delete\s*\(/.test(src), false);
  const getCount = (src.match(/router\.get\s*\(/g) || []).length;
  assert.ok(getCount >= 6);
});

test('surface: payment.controller.ts does not import admin-payments', () => {
  const src = fs.readFileSync(path.join(__dirname, './payment.controller.ts'), 'utf8');
  assert.equal(src.includes('admin-payments'), false);
  assert.equal(src.includes('adminPayments'), false);
});

test('util: buildPaidOrdersClause concept matches isPaidOrder logic', () => {
  const clause = buildPaidOrdersClause() as any;
  assert.equal(clause.isTestOrder.$ne, true);
  const proof = (clause.$and || []).find((c: any) => Array.isArray(c?.$or));
  assert.ok(proof);
  assert.ok(proof.$or.some((c: any) => c.paymentStatus === 'captured'));
  assert.ok(proof.$or.some((c: any) => c['customerDetails.isPaid'] === true));
  assert.ok(
    proof.$or.some((c: any) => {
      if (!Array.isArray(c?.$and)) return false;
      const nestedOr = c.$and.find((x: any) => Array.isArray(x?.$or));
      return (
        !!nestedOr &&
        nestedOr.$or.some((x: any) => x.isDeleted === true || Array.isArray(x.status?.$in))
      );
    })
  );

  assert.equal(isPaidOrder({ paymentStatus: 'captured', customerDetails: {}, totalPrice: 10 }), true);
  assert.equal(isPaidOrder({ paymentStatus: 'pending', customerDetails: { isPaid: true }, totalPrice: 10 }), true);
  assert.equal(isPaidOrder({ paymentStatus: 'authorized', customerDetails: {}, totalPrice: 10 }), false);
  assert.equal(isPaidOrder({ paymentStatus: 'captured', customerDetails: {}, totalPrice: 10, isTestOrder: true }), false);
});

test('util: invalid sortBy falls back to createdAt', () => {
  const f = parseListQuery({ sortBy: 'hackedField' });
  assert.equal(f.sortBy, 'createdAt');
  assert.equal(parseListQuery({ sortBy: 'totalPrice' }).sortBy, 'totalPrice');
  assert.equal(parseListQuery({ sortBy: 'paymentStatus' }).sortBy, 'paymentStatus');
  assert.equal(parseListQuery({ sortBy: 'amount' }).sortBy, 'totalPrice');
  assert.equal(parseListQuery({ sortBy: 'orderNumber' }).sortBy, 'orderNumber');
});

test('util: canCapture and canVoid on mapped rows always false even for authorized free order', () => {
  const free = {
    _id: 'free1',
    paymentStatus: 'authorized',
    captureLockId: null,
    totalPrice: 120,
    customerDetails: { fullName: 'חופשי', phone: '050' },
    createdAt: new Date()
  };
  assert.equal(canCapturePayment(free), true);
  assert.equal(canVoidPayment(free), true);
  const row = mapOrderToPaymentRow(free);
  assert.equal(row.canCapture, false);
  assert.equal(row.canVoid, false);
  assert.equal(row.canRefund, false);
  assert.equal(row.rawPaymentStatus, 'authorized');
  assert.equal(row.paymentBucket, 'pending');
});
