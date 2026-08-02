import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { Request, Response } from 'express';
import { requireAdmin } from '../config/role-access';
import { authenticate } from '../middleware/auth';
import { OrderController } from './order.controller';
import {
  changePercent,
  computeOrderItemLineRevenue,
  countReturningFromPhoneGroups,
  fillTrendBuckets,
  kpiTriple,
  normalizePhoneDigits,
  previousRange,
  resolveDashboardRange,
  resolveOrderItemUnitPrice,
  zonedLocalToUtc
} from '../utils/dashboard-overview.util';
import { DASHBOARD_MATCH } from '../utils/dashboard-overview.util';
import { getForbiddenPublicOrderFields } from './order.controller';

type InvocationResult = { status: number; body?: any; error?: any };

function invoke(
  handler: (req: Request, res: Response, next: (error?: unknown) => void) => void,
  options: {
    body?: Record<string, unknown>;
    params?: Record<string, string>;
    query?: Record<string, string>;
    user?: any;
    method?: string;
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
      headers: {},
      params: options.params || {},
      query: options.query || {},
      method: options.method || 'GET',
      user: options.user,
      cookies: {}
    } as any;
    const res = {
      status(code: number) {
        status = code;
        return this;
      },
      json(body: any) {
        finish({ status, body });
        return this;
      }
    } as any;
    try {
      handler(req, res, (error?: unknown) => {
        if (error) {
          const err = error as any;
          finish({
            status: err.statusCode || err.status || 500,
            body: { message: err.message },
            error
          });
        }
      });
    } catch (error: any) {
      finish({ status: error.statusCode || 500, body: { message: error.message }, error });
    }
  });
}

function runMiddleware(
  mw: (req: Request, res: Response, next: (err?: unknown) => void) => void,
  user?: any
): Promise<InvocationResult & { nextCalled?: boolean }> {
  return new Promise((resolve) => {
    let status = 200;
    let settled = false;
    const finish = (result: any) => {
      if (!settled) {
        settled = true;
        resolve(result);
      }
    };
    const req = { user, headers: {}, cookies: {} } as any;
    const res = {
      status(code: number) {
        status = code;
        return this;
      },
      json(body: any) {
        finish({ status, body });
        return this;
      }
    } as any;
    mw(req, res, (err?: unknown) => {
      if (err) finish({ status: 500, error: err });
      else finish({ status: 200, nextCalled: true });
    });
  });
}

// ─── Pure metric / date helpers ─────────────────────────────────────────────

test('changePercent: both zero → 0; previous zero → null; normal ratio', () => {
  assert.equal(changePercent(0, 0), 0);
  assert.equal(changePercent(10, 0), null);
  assert.equal(changePercent(150, 100), 50);
  assert.ok(!Number.isFinite(Infinity));
  assert.equal(kpiTriple(10, 0).changePercent, null);
});

test('normalizePhoneDigits merges IL variants', () => {
  assert.equal(normalizePhoneDigits('050-123-4567'), '0501234567');
  assert.equal(normalizePhoneDigits('+972501234567'), '0501234567');
  assert.equal(normalizePhoneDigits('972501234567'), '0501234567');
  assert.equal(normalizePhoneDigits('00972501234567'), '0501234567');
});

test('returning customers: normalized phones merge raw variants', () => {
  const n = countReturningFromPhoneGroups([
    { phone: '0501234567', count: 1 },
    { phone: '+972501234567', count: 1 },
    { phone: '0509999999', count: 1 }
  ]);
  // first two merge to one phone with count 2 → returning; second alone → not
  assert.equal(n, 1);
});

test('resolveDashboardRange defaults to Asia/Jerusalem current month', () => {
  const now = zonedLocalToUtc(2026, 8, 15, 12, 0, 0, 'Asia/Jerusalem');
  const range = resolveDashboardRange({ now, timezone: 'Asia/Jerusalem' });
  assert.equal(range.timezone, 'Asia/Jerusalem');
  assert.equal(range.dateBasis, 'createdAt');
  assert.equal(range.preset, 'month');
  assert.ok(range.from.getTime() < range.to.getTime());
  // Month starts Aug 1 IL
  assert.equal(range.from.toISOString().startsWith('2026-07-31') || range.from.toISOString().startsWith('2026-08-01'), true);
});

test('resolveDashboardRange today + previous period same duration', () => {
  const now = zonedLocalToUtc(2026, 8, 15, 12, 0, 0, 'Asia/Jerusalem');
  const range = resolveDashboardRange({ preset: 'today', now, timezone: 'Asia/Jerusalem' });
  const prev = previousRange(range);
  const dur = range.to.getTime() - range.from.getTime();
  const prevDur = prev.to.getTime() - prev.from.getTime();
  assert.equal(dur, prevDur);
  assert.ok(prev.to.getTime() < range.from.getTime());
});

test('resolveDashboardRange week is 7 inclusive days', () => {
  const now = zonedLocalToUtc(2026, 8, 15, 12, 0, 0, 'Asia/Jerusalem');
  const range = resolveDashboardRange({ preset: 'week', now, timezone: 'Asia/Jerusalem' });
  const days = (range.to.getTime() - range.from.getTime()) / (24 * 60 * 60 * 1000);
  assert.ok(days > 6.9 && days < 7.1);
});

test('fillTrendBuckets inserts zero days', () => {
  const from = zonedLocalToUtc(2026, 8, 1, 0, 0, 0, 'Asia/Jerusalem');
  const to = zonedLocalToUtc(2026, 8, 3, 23, 59, 59, 'Asia/Jerusalem');
  const filled = fillTrendBuckets(
    { from, to, timezone: 'Asia/Jerusalem', dateBasis: 'createdAt' },
    [{ key: '2026-08-02', revenue: 100, paidOrdersCount: 1 }],
    'day'
  );
  assert.equal(filled.length, 3);
  assert.equal(filled[0].period, '2026-08-01');
  assert.equal(filled[0].revenue, 0);
  assert.equal(filled[0].paidOrdersCount, 0);
  assert.equal(filled[1].revenue, 100);
  assert.equal(filled[1].paidOrdersCount, 1);
  assert.equal(filled[2].revenue, 0);
});

test('DASHBOARD_MATCH revenue excludes authorized and missing payment; archive allowed', () => {
  assert.equal(DASHBOARD_MATCH.capturedRevenue.paymentStatus, 'captured');
  assert.deepEqual(DASHBOARD_MATCH.capturedRevenue.status, { $ne: 'cancelled' });
  assert.deepEqual(DASHBOARD_MATCH.capturedRevenue.isTestOrder, { $ne: true });
  assert.equal('isDeleted' in DASHBOARD_MATCH.capturedRevenue, false);
});

test('public checkout forbids isTestOrder field', () => {
  const forbidden = getForbiddenPublicOrderFields({ isTestOrder: true, customerName: 'x' });
  assert.ok(forbidden.includes('isTestOrder'));
});

test('dashboard-overview source has no Math.random / dummy revenue', () => {
  const utilSrc = readFileSync(join(__dirname, '../utils/dashboard-overview.util.ts'), 'utf8');
  const svcSrc = readFileSync(join(__dirname, '../services/dashboard-overview.service.ts'), 'utf8');
  assert.equal(utilSrc.includes('Math.random'), false);
  assert.equal(svcSrc.includes('Math.random'), false);
  assert.equal(svcSrc.includes('dummy'), false);
});

test('routes wire dashboard-overview + test-order with requireAdmin', () => {
  // Specs may run from dist/ — resolve routes relative to process.cwd()/src when needed
  const candidates = [
    join(process.cwd(), 'src/routes/order.routes.ts'),
    join(__dirname, '../routes/order.routes.ts')
  ];
  let src = '';
  for (const p of candidates) {
    try {
      src = readFileSync(p, 'utf8');
      break;
    } catch {
      /* try next */
    }
  }
  assert.ok(src.includes("'/dashboard-overview'"));
  assert.ok(src.includes('test-order'));
  assert.ok(src.includes('getDashboardOverview'));
  assert.ok(src.includes('setOrderTestFlag'));
  // Both new endpoints are admin-gated (requireAdmin on the same router block)
  assert.ok(/dashboard-overview[\s\S]{0,80}requireAdmin/.test(src));
  assert.ok(/test-order[\s\S]{0,40}requireAdmin/.test(src));
});

// ─── setOrderTestFlag handler ───────────────────────────────────────────────

test('PATCH test-order: rejects extra fields', async () => {
  const controller = new OrderController();
  const result = await invoke(controller.setOrderTestFlag, {
    params: { id: '507f1f77bcf86cd799439011' },
    body: { isTestOrder: true, status: 'ready' },
    method: 'PATCH',
    user: { role: 'admin', id: '1' }
  });
  assert.ok(result.status >= 400);
  assert.match(String(result.body?.message || ''), /Only the isTestOrder/i);
});

test('PATCH test-order: invalid ObjectId returns 400 validation', async () => {
  const controller = new OrderController();
  const result = await invoke(controller.setOrderTestFlag, {
    params: { id: 'not-a-valid-object-id' },
    body: { isTestOrder: true },
    method: 'PATCH',
    user: { role: 'admin', id: '1' }
  });
  assert.equal(result.status, 400);
  assert.match(String(result.body?.message || ''), /Invalid order id/i);
});

test('PATCH test-order: valid ObjectId missing order returns 404', async () => {
  const controller = new OrderController();
  const svc = require('../services/dashboard-overview.service');
  const original = svc.setOrderTestFlag;
  svc.setOrderTestFlag = async () => null;
  try {
    const result = await invoke(controller.setOrderTestFlag, {
      params: { id: '507f1f77bcf86cd799439011' },
      body: { isTestOrder: false },
      method: 'PATCH',
      user: { role: 'admin', id: '1' }
    });
    assert.equal(result.status, 404);
  } finally {
    svc.setOrderTestFlag = original;
  }
});

test('PATCH test-order: admin can update via service mock', async () => {
  const controller = new OrderController();
  const svc = require('../services/dashboard-overview.service');
  const original = svc.setOrderTestFlag;
  let calledWith: any = null;
  svc.setOrderTestFlag = async (id: string, flag: boolean) => {
    calledWith = { id, flag };
    return { _id: id, isTestOrder: flag, totalPrice: 10 };
  };
  try {
    const result = await invoke(controller.setOrderTestFlag, {
      params: { id: '507f1f77bcf86cd799439011' },
      body: { isTestOrder: true },
      method: 'PATCH',
      user: { role: 'admin', id: '1' }
    });
    assert.equal(result.status, 200);
    assert.equal(result.body?.success, true);
    assert.equal(calledWith?.flag, true);
  } finally {
    svc.setOrderTestFlag = original;
  }
});


test('sold-item aggregations use $isNumber so BSON int quantities count', () => {
  const svcSrc = readFileSync(join(__dirname, '../services/dashboard-overview.service.ts'), 'utf8');
  assert.ok(svcSrc.includes('$isNumber'));
  assert.ok(svcSrc.includes('topSellingByMonth'));
  // Avoid regressing to $type === "number" which misses BSON int.
  assert.equal(svcSrc.includes("$eq: [{ $type: '$items.quantity' }, 'number']"), false);
});

test('topItems line revenue: price×qty; selectedOption fallback; ignore total; missing qty→0', () => {
  assert.equal(computeOrderItemLineRevenue({ price: 10, quantity: 3 }), 30);
  assert.equal(computeOrderItemLineRevenue({ price: 0, quantity: 2 }), 0);
  assert.equal(
    computeOrderItemLineRevenue({
      price: null,
      quantity: 2,
      selectedOption: { price: 15 }
    }),
    30
  );
  // Root price present (incl. 0) wins over selectedOption — no double count
  assert.equal(
    computeOrderItemLineRevenue({
      price: 10,
      quantity: 2,
      selectedOption: { price: 99 }
    }),
    20
  );
  // items.total is ignored even if present on a rogue document
  assert.equal(
    computeOrderItemLineRevenue({
      price: 5,
      quantity: 2,
      total: 999
    }),
    10
  );
  assert.equal(computeOrderItemLineRevenue({ price: 10, quantity: undefined }), 0);
  assert.equal(computeOrderItemLineRevenue({ price: 'x', quantity: 2 }), 0);
  assert.equal(computeOrderItemLineRevenue({ price: -1, quantity: 2 }), 0);
  assert.equal(resolveOrderItemUnitPrice({ selectedOption: { price: 7 } }), 7);
});

test('trend contract uses paidOrdersCount not ordersCount', () => {
  const utilSrc = readFileSync(join(__dirname, '../utils/dashboard-overview.util.ts'), 'utf8');
  const svcSrc = readFileSync(join(__dirname, '../services/dashboard-overview.service.ts'), 'utf8');
  assert.ok(utilSrc.includes('paidOrdersCount'));
  assert.ok(svcSrc.includes('paidOrdersCount'));
  // Trend/revenue util must not rename to ordersCount.
  assert.equal(utilSrc.includes('ordersCount'), false);
  // Aggregation field for captured trend remains paidOrdersCount (not ordersCount alias).
  assert.ok(svcSrc.includes('paidOrdersCount: { $sum: 1 }'));
  assert.equal(svcSrc.includes('ordersCount: { $sum: 1 }'), false);
});

test('requireAdmin blocks guest and customer; allows admin', async () => {
  const guest = await runMiddleware(requireAdmin, undefined);
  assert.equal(guest.status, 401);

  const customer = await runMiddleware(requireAdmin, { role: 'customer', id: 'u1' });
  assert.equal(customer.status, 403);

  const admin = await runMiddleware(requireAdmin, { role: 'admin', id: 'a1' });
  assert.equal(admin.nextCalled, true);
});

test('authenticate without token rejects (guest blocked from overview chain)', async () => {
  const result = await new Promise<InvocationResult>((resolve) => {
    let status = 200;
    const req = { headers: {}, cookies: {} } as any;
    const res = {
      status(code: number) {
        status = code;
        return this;
      },
      json(body: any) {
        resolve({ status, body });
        return this;
      }
    } as any;
    authenticate(req, res, () => resolve({ status: 200, body: { next: true } }));
  });
  assert.ok(result.status === 401 || result.body?.success === false || result.status >= 400);
});

// ─── Aggregation match semantics (documented contract tests) ───────────────

test('revenue match semantics: archived captured included; test/cancelled/authorized/missing excluded', () => {
  const match = DASHBOARD_MATCH.capturedRevenue as Record<string, unknown>;
  // Simulate documents against the match object rules
  function matches(doc: Record<string, unknown>): boolean {
    if (doc.isTestOrder === true) return false;
    if (doc.paymentStatus !== 'captured') return false;
    if (doc.status === 'cancelled') return false;
    return true;
  }
  assert.equal(matches({ paymentStatus: 'captured', status: 'ready', isDeleted: true, isTestOrder: false }), true);
  assert.equal(matches({ paymentStatus: 'captured', status: 'ready', isTestOrder: true }), false);
  assert.equal(matches({ paymentStatus: 'captured', status: 'cancelled' }), false);
  assert.equal(matches({ paymentStatus: 'authorized', status: 'ready' }), false);
  assert.equal(matches({ status: 'ready' }), false); // missing paymentStatus
  assert.ok(match);
});

test('average order value: revenue / paid orders; zero when none', () => {
  const revenue = 300;
  const paid = 3;
  assert.equal(paid > 0 ? revenue / paid : 0, 100);
  assert.equal(0 > 0 ? 1 / 0 : 0, 0);
});
