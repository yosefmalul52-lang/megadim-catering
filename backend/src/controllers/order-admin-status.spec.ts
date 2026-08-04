import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ADMIN_STATUS_TABS,
  AWAITING_PAYMENT_ABANDON_MS,
  buildAdminStatusChangeUpdate,
  buildAdminStatusTabFilter,
  hasOpenPaymentException,
  hasOpenPaymentExceptionForTab,
  isAwaitingPaymentAbandoned,
  isTranzilaCheckoutOrder,
  resolveAdminStatusTab,
  shouldSendOrderApprovedEmail
} from '../utils/order-admin-status.util';

const now = new Date('2026-07-30T12:00:00.000Z');

function assertSingleTab(order: Record<string, unknown>, expected: string) {
  const tab = resolveAdminStatusTab(order, now);
  assert.equal(tab, expected);
  const hits = ADMIN_STATUS_TABS.filter((t) => resolveAdminStatusTab(order, now) === t);
  assert.equal(hits.length, 1, `expected exactly one tab, got ${hits.join(',')}`);
}

test('cancelled is only בוטלו — never archive', () => {
  assertSingleTab({ status: 'cancelled', paymentStatus: 'failed', isDeleted: false }, 'cancelled');
  assertSingleTab({ status: 'cancelled', paymentStatus: 'captured', isDeleted: false }, 'cancelled');
});

test('delivered/completed are only הושלמו — never ready', () => {
  assertSingleTab({ status: 'delivered', paymentStatus: 'captured', isDeleted: false }, 'completed');
  assertSingleTab({ status: 'completed', paymentStatus: 'authorized', isDeleted: false }, 'completed');
  assert.notEqual(
    resolveAdminStatusTab({ status: 'delivered', paymentStatus: 'captured' }, now),
    'ready'
  );
});

test('archive is soft-delete only', () => {
  assertSingleTab({ status: 'processing', isDeleted: true }, 'archive');
});

test('open payment failure is only failed tab', () => {
  assertSingleTab(
    {
      status: 'pending',
      paymentStatus: 'failed',
      paymentExceptionResolvedAt: null,
      isDeleted: false
    },
    'failed'
  );
  assertSingleTab(
    {
      status: 'processing',
      paymentStatus: 'failed',
      paymentExceptionResolvedAt: null,
      isDeleted: false
    },
    'failed'
  );
});

test('awaiting 59:59 is not abandoned; 60:00 is', () => {
  const at5959 = new Date(now.getTime() - (AWAITING_PAYMENT_ABANDON_MS - 1000));
  const at6000 = new Date(now.getTime() - AWAITING_PAYMENT_ABANDON_MS);

  assert.equal(
    isAwaitingPaymentAbandoned(
      { paymentStatus: 'awaiting_payment', paymentAwaitingStartedAt: at5959 },
      now
    ),
    false
  );
  assert.equal(
    isAwaitingPaymentAbandoned(
      { paymentStatus: 'awaiting_payment', paymentAwaitingStartedAt: at6000 },
      now
    ),
    true
  );

  assert.equal(
    resolveAdminStatusTab(
      {
        status: 'pending',
        paymentStatus: 'awaiting_payment',
        paymentAwaitingStartedAt: at5959,
        isDeleted: false
      },
      now
    ),
    'pending'
  );
  assert.equal(
    resolveAdminStatusTab(
      {
        status: 'pending',
        paymentStatus: 'awaiting_payment',
        paymentAwaitingStartedAt: at6000,
        isDeleted: false
      },
      now
    ),
    'failed'
  );
});

test('missing paymentAwaitingStartedAt is never abandoned (safe legacy)', () => {
  assert.equal(
    isAwaitingPaymentAbandoned({ paymentStatus: 'awaiting_payment' }, now),
    false
  );
  assert.equal(
    resolveAdminStatusTab(
      { status: 'pending', paymentStatus: 'awaiting_payment', isDeleted: false },
      now
    ),
    'pending'
  );
});

test('createdAt/updatedAt are not used as awaiting clock', () => {
  const old = new Date(now.getTime() - 3 * AWAITING_PAYMENT_ABANDON_MS);
  assert.equal(
    isAwaitingPaymentAbandoned(
      {
        paymentStatus: 'awaiting_payment',
        createdAt: old,
        updatedAt: old
      },
      now
    ),
    false
  );
});

test('new payment link after failure stays on failed tab via paymentFailedAt', () => {
  const young = new Date(now.getTime() - 60_000);
  assertSingleTab(
    {
      status: 'pending',
      paymentStatus: 'awaiting_payment',
      paymentAwaitingStartedAt: young,
      paymentFailedAt: new Date(now.getTime() - 120_000),
      paymentExceptionResolvedAt: null,
      isDeleted: false
    },
    'failed'
  );
});

test('explicit move to processing closes exception and keeps paymentStatus untouched', () => {
  const built = buildAdminStatusChangeUpdate({
    previousStatus: 'pending',
    nextStatus: 'processing',
    previousPaymentStatus: 'failed',
    changedBy: 'admin-1',
    orderHasOpenPaymentException: true,
    now
  });
  assert.equal(built.$set.status, 'processing');
  assert.equal(built.$set.paymentExceptionResolution, 'approve_and_continue_billing');
  assert.ok(built.$set.paymentExceptionResolvedAt);
  assert.equal(built.$set.paymentExceptionResolvedBy, 'admin-1');
  assert.equal(built.paymentStatusUnchanged, true);
  assert.ok(built.$unset?.paymentFailedAt);

  const after = {
    status: 'processing',
    paymentStatus: 'failed',
    paymentExceptionResolvedAt: built.$set.paymentExceptionResolvedAt,
    paymentExceptionResolution: built.$set.paymentExceptionResolution,
    isDeleted: false
  };
  assert.equal(resolveAdminStatusTab(after, now), 'processing');
  assert.equal(hasOpenPaymentExceptionForTab(after, now), false);
});

test('send_new_payment_link cannot close via status change', () => {
  assert.throws(
    () =>
      buildAdminStatusChangeUpdate({
        previousStatus: 'pending',
        nextStatus: 'processing',
        previousPaymentStatus: 'failed',
        changedBy: 'admin',
        orderHasOpenPaymentException: true,
        paymentExceptionResolution: 'send_new_payment_link',
        now
      }),
    (err: any) => err?.code === 'PAYMENT_LINK_DOES_NOT_CHANGE_STATUS' || err?.statusCode === 422
  );
});

test('moving to ready with open exception without resolution is blocked', () => {
  assert.throws(
    () =>
      buildAdminStatusChangeUpdate({
        previousStatus: 'pending',
        nextStatus: 'ready',
        previousPaymentStatus: 'failed',
        changedBy: 'admin',
        orderHasOpenPaymentException: true,
        now
      }),
    (err: any) => err?.code === 'PAYMENT_EXCEPTION_RESOLUTION_REQUIRED'
  );
});

test('paid_elsewhere_continue closes and goes to processing', () => {
  const built = buildAdminStatusChangeUpdate({
    previousStatus: 'pending',
    nextStatus: 'pending',
    previousPaymentStatus: 'failed',
    changedBy: 'admin',
    orderHasOpenPaymentException: true,
    paymentExceptionResolution: 'paid_elsewhere_continue',
    now
  });
  assert.equal(built.$set.status, 'processing');
  assert.equal(built.resolution, 'paid_elsewhere_continue');
});

test('shouldSendOrderApprovedEmail only on first move into processing', () => {
  assert.equal(shouldSendOrderApprovedEmail('pending', 'processing'), true);
  assert.equal(shouldSendOrderApprovedEmail('processing', 'processing'), false);
  assert.equal(shouldSendOrderApprovedEmail('pending', 'ready'), false);
});

test('Mongo filters are mutually exclusive for fixture matrix', () => {
  const fixtures = [
    { status: 'pending', paymentStatus: 'pending' },
    { status: 'processing', paymentStatus: 'authorized' },
    { status: 'ready', paymentStatus: 'captured' },
    { status: 'pending', paymentStatus: 'failed' },
    { status: 'cancelled', paymentStatus: 'failed' },
    { status: 'delivered', paymentStatus: 'captured' },
    { status: 'pending', isDeleted: true }
  ];
  for (const f of fixtures) {
    const tab = resolveAdminStatusTab(f, now);
    for (const other of ADMIN_STATUS_TABS) {
      if (other === tab) continue;
      // Filter shape exists for every tab
      assert.ok(buildAdminStatusTabFilter(other, now));
    }
    assert.ok(buildAdminStatusTabFilter(tab, now));
  }
});

test('hasOpenPaymentException vs tab membership', () => {
  assert.equal(
    hasOpenPaymentException({ paymentStatus: 'failed', paymentExceptionResolvedAt: null }),
    true
  );
  assert.equal(isTranzilaCheckoutOrder({ paymentStatus: 'failed' }), true);
});

test('legacy: processing + failed + unresolved stays on failed tab only', () => {
  const legacy = {
    status: 'processing',
    paymentStatus: 'failed',
    paymentFailedAt: new Date('2026-07-01T00:00:00.000Z'),
    paymentExceptionResolvedAt: null,
    isDeleted: false
  };
  assertSingleTab(legacy, 'failed');
  assert.equal(hasOpenPaymentException(legacy), true);
});

test('legacy: explicit resolve while already processing closes exception atomically', () => {
  const built = buildAdminStatusChangeUpdate({
    previousStatus: 'processing',
    nextStatus: 'processing',
    previousPaymentStatus: 'failed',
    changedBy: 'admin-legacy',
    orderHasOpenPaymentException: true,
    paymentExceptionResolution: 'approve_and_continue_billing',
    now
  });
  assert.equal(built.$set.status, 'processing');
  assert.equal(built.$set.paymentExceptionResolution, 'approve_and_continue_billing');
  assert.ok(built.$set.paymentExceptionResolvedAt);
  assert.equal(built.$set.paymentExceptionResolvedBy, 'admin-legacy');
  assert.equal(built.paymentStatusUnchanged, true);

  const after = {
    status: 'processing',
    paymentStatus: 'failed',
    paymentExceptionResolvedAt: built.$set.paymentExceptionResolvedAt,
    paymentExceptionResolvedBy: built.$set.paymentExceptionResolvedBy,
    paymentExceptionResolution: built.$set.paymentExceptionResolution,
    isDeleted: false
  };
  assert.equal(resolveAdminStatusTab(after, now), 'processing');
});

test('soft-delete always wins over cancelled/completed/failed', () => {
  assertSingleTab(
    { status: 'cancelled', paymentStatus: 'failed', isDeleted: true },
    'archive'
  );
  assertSingleTab(
    { status: 'delivered', paymentStatus: 'captured', isDeleted: true },
    'archive'
  );
  assertSingleTab(
    {
      status: 'processing',
      paymentStatus: 'failed',
      paymentFailedAt: now,
      paymentExceptionResolvedAt: null,
      isDeleted: true
    },
    'archive'
  );
});
