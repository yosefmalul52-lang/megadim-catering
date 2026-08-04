/**
 * Phase 2A — permanent payment audit history (read path for admin payments).
 * Live payment flows do not write audit events in this isolation stage.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import PaymentAuditEvent from '../models/PaymentAuditEvent';
import {
  assertAuditPayloadIsSafe,
  mapAuditDocToHistoryItem,
  resolvePaymentActor
} from '../services/payment-audit.service';

test('Phase 2A: guest/customer are not marked admin', () => {
  const guest = resolvePaymentActor({ user: undefined } as any);
  assert.equal(guest.actorType, 'guest');

  const customer = resolvePaymentActor({
    user: { id: 'c1', role: 'customer', fullName: 'לקוח' }
  } as any);
  assert.equal(customer.actorType, 'customer');
  assert.equal(customer.actorDisplayName, null);

  const admin = resolvePaymentActor({
    user: { id: 'a1', role: 'admin', fullName: 'אדמין' }
  } as any);
  assert.equal(admin.actorType, 'admin');
  assert.equal(admin.actorDisplayName, 'אדמין');
});

test('Phase 2A: history API item never exposes sensitive fields', () => {
  const item = mapAuditDocToHistoryItem({
    _id: 'h1',
    eventType: 'capture_result_unknown',
    paymentStatusBefore: 'authorized',
    paymentStatusAfter: 'authorized',
    result: 'unknown',
    actorType: 'admin',
    actorDisplayName: 'מנהל',
    actorId: 'should-not-appear-in-select-anyway',
    safeReasonCode: 'NETWORK_OR_TIMEOUT',
    createdAt: new Date('2026-08-01T10:00:00Z'),
    captureLockId: 'bad',
    paymentSecurityToken: 'bad'
  } as any);
  assert.equal(item.eventTypeLabelHe.includes('לא ודאית'), true);
  assert.equal((item as any).captureLockId, undefined);
  assert.equal((item as any).actorId, undefined);
  assert.equal((item as any).paymentSecurityToken, undefined);
  const leaks = assertAuditPayloadIsSafe(item);
  assert.deepEqual(leaks, []);
});

test('Phase 2A: detail falls back to timeline when audit empty', async () => {
  const Order = (await import('../models/Order')).default as any;
  const Audit = (await import('../models/PaymentAuditEvent')).default as any;
  const originalFindById = Order.findById;
  const originalFind = Audit.find;

  Order.findById = () => {
    const chain: any = {
      select: () => chain,
      lean: async () => ({
        _id: 'old-1',
        orderNumber: 'MG-OLD',
        paymentStatus: 'captured',
        totalPrice: 10,
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-02'),
        confirmationEmailSentAt: new Date('2025-01-02'),
        customerDetails: { fullName: 'ישן', phone: '050' },
        items: []
      })
    };
    return chain;
  };
  Audit.find = () => {
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
    const detail = await getAdminPaymentDetail('old-1');
    assert.equal(detail!.historySource, 'fallback_timeline');
    assert.equal(detail!.paymentHistory.length, 0);
    assert.ok(detail!.timeline.length > 0);
    assert.equal(detail!.canCapture, false);
    assert.equal(detail!.canVoid, false);
    assert.equal(detail!.rawPaymentStatus, 'captured');
    assert.equal(detail!.paymentBucket, 'paid');
    assert.equal(typeof detail!.hasException, 'boolean');
  } finally {
    Order.findById = originalFindById;
    Audit.find = originalFind;
  }
});

test('Phase 2A: detail returns audit history newest-first when present', async () => {
  const Order = (await import('../models/Order')).default as any;
  const Audit = (await import('../models/PaymentAuditEvent')).default as any;
  const originalFindById = Order.findById;
  const originalFind = Audit.find;

  Order.findById = () => {
    const chain: any = {
      select: () => chain,
      lean: async () => ({
        _id: 'new-1',
        orderNumber: 'MG-NEW',
        paymentStatus: 'captured',
        totalPrice: 10,
        createdAt: new Date(),
        customerDetails: { fullName: 'חדש', phone: '050' },
        items: []
      })
    };
    return chain;
  };
  Audit.find = () => {
    const chain: any = {
      select: () => chain,
      sort: () => chain,
      limit: () => chain,
      lean: async () => [
        {
          _id: 'e2',
          eventType: 'capture_completed',
          result: 'success',
          actorType: 'admin',
          actorDisplayName: 'מנהל',
          paymentStatusBefore: 'authorized',
          paymentStatusAfter: 'captured',
          createdAt: new Date('2026-08-02')
        },
        {
          _id: 'e1',
          eventType: 'capture_started',
          result: 'success',
          actorType: 'admin',
          actorDisplayName: 'מנהל',
          paymentStatusBefore: 'authorized',
          paymentStatusAfter: 'authorized',
          createdAt: new Date('2026-08-01')
        }
      ]
    };
    return chain;
  };

  try {
    const { getAdminPaymentDetail } = await import('../services/admin-payments.service');
    const detail = await getAdminPaymentDetail('new-1');
    assert.equal(detail!.historySource, 'audit');
    assert.equal(detail!.paymentHistory[0].eventType, 'capture_completed');
    assert.equal(detail!.paymentHistory[0].actorDisplayName, 'מנהל');
    assert.equal(JSON.stringify(detail).includes('captureLockId'), false);
    assert.equal(detail!.canCapture, false);
    assert.equal(detail!.canVoid, false);
    assert.equal(detail!.rawPaymentStatus, 'captured');
    assert.equal(detail!.paymentBucket, 'paid');
    assert.equal(typeof detail!.hasException, 'boolean');
  } finally {
    Order.findById = originalFindById;
    Audit.find = originalFind;
  }
});

test('Phase 2A: soft-deleted order keeps audit history for read-only view', async () => {
  const Order = (await import('../models/Order')).default as any;
  const Audit = (await import('../models/PaymentAuditEvent')).default as any;
  const originalFindById = Order.findById;
  const originalFind = Audit.find;

  Order.findById = () => {
    const chain: any = {
      select: () => chain,
      lean: async () => ({
        _id: 'del-1',
        orderNumber: 'MG-DEL',
        paymentStatus: 'captured',
        isDeleted: true,
        totalPrice: 80,
        createdAt: new Date('2026-07-01'),
        updatedAt: new Date('2026-07-02'),
        customerDetails: { fullName: 'מחוק', phone: '050' },
        items: []
      })
    };
    return chain;
  };
  Audit.find = () => {
    const chain: any = {
      select: () => chain,
      sort: () => chain,
      limit: () => chain,
      lean: async () => [
        {
          _id: 'ae1',
          eventType: 'capture_completed',
          result: 'success',
          actorType: 'admin',
          actorDisplayName: 'מנהל',
          paymentStatusBefore: 'authorized',
          paymentStatusAfter: 'captured',
          createdAt: new Date('2026-07-02')
        }
      ]
    };
    return chain;
  };

  try {
    const { getAdminPaymentDetail } = await import('../services/admin-payments.service');
    const detail = await getAdminPaymentDetail('del-1');
    assert.equal(detail!.isOrderDeleted, true);
    assert.equal(detail!.canCapture, false);
    assert.equal(detail!.canVoid, false);
    assert.equal(detail!.historySource, 'audit');
    assert.equal(detail!.paymentHistory.length, 1);
    assert.equal(detail!.paymentHistory[0].eventType, 'capture_completed');
    assert.equal(JSON.stringify(detail).includes('captureLockId'), false);
    assert.equal(detail!.rawPaymentStatus, 'captured');
    assert.equal(detail!.paymentBucket, 'paid');
    // Archive of a captured order is normal Megadim workflow — not a payment exception.
    assert.equal(detail!.hasException, false);
    assert.equal(detail!.primaryException, null);
  } finally {
    Order.findById = originalFindById;
    Audit.find = originalFind;
  }
});

test('Phase 2A: admin payments detail route remains requireAdmin; no public history route', () => {
  const routes = fs.readFileSync(
    path.join(__dirname, '../routes/admin-payments.routes.ts'),
    'utf8'
  );
  assert.match(routes, /authenticate,\s*requireAdmin/);
  assert.match(routes, /getPaymentDetail/);
});

test('Phase 2A: model forbids storing forbidden event field names in schema path list', () => {
  const paths = Object.keys((PaymentAuditEvent as any).schema.paths);
  for (const bad of [
    'captureLockId',
    'paymentSecurityToken',
    'paymentInitTokenHash',
    'cardToken',
    'authCode',
    'requestBody'
  ]) {
    assert.equal(paths.includes(bad), false);
  }
});

test('Phase 2A: payment.controller does not write audit events', () => {
  const src = fs.readFileSync(path.join(__dirname, './payment.controller.ts'), 'utf8');
  assert.equal(src.includes('recordPaymentAudit'), false);
  assert.equal(src.includes('payment-audit.service'), false);
  assert.equal(src.includes('auditPayment'), false);
});
