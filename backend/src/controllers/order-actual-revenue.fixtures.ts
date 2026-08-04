/** Shared fixture set for phase-2 revenue unification (no tests). */
export const PHASE2_REVENUE_FIXTURES = {
  capturedWithPaidAt: {
    key: 'captured_with_paidAt',
    paymentStatus: 'captured',
    status: 'delivered',
    totalPrice: 100,
    paidAt: new Date('2026-07-15T10:00:00.000Z'),
    capturedAt: new Date('2026-07-15T10:00:00.000Z'),
    createdAt: new Date('2026-06-01T10:00:00.000Z'),
    isTestOrder: false,
    isDeleted: false
  },
  capturedLegacyNoStamps: {
    key: 'captured_legacy_no_stamps',
    paymentStatus: 'captured',
    status: 'ready',
    totalPrice: 80,
    createdAt: new Date('2026-07-10T12:00:00.000Z'),
    isTestOrder: false
  },
  manualIsPaid: {
    key: 'manual_isPaid',
    paymentStatus: 'pending',
    status: 'processing',
    totalPrice: 60,
    customerDetails: { isPaid: true },
    createdAt: new Date('2026-07-12T08:00:00.000Z'),
    paidAt: new Date('2026-07-12T09:00:00.000Z'),
    isTestOrder: false
  },
  cancelledCaptured: {
    key: 'cancelled_captured',
    paymentStatus: 'captured',
    status: 'cancelled',
    totalPrice: 50,
    paidAt: new Date('2026-07-11T10:00:00.000Z'),
    capturedAt: new Date('2026-07-11T10:00:00.000Z'),
    createdAt: new Date('2026-07-01T10:00:00.000Z'),
    isTestOrder: false
  },
  cancelledUnpaid: {
    key: 'cancelled_unpaid',
    paymentStatus: 'pending',
    status: 'cancelled',
    totalPrice: 40,
    createdAt: new Date('2026-07-11T10:00:00.000Z'),
    isTestOrder: false
  },
  failedUnpaid: {
    key: 'failed_unpaid',
    paymentStatus: 'failed',
    status: 'pending',
    totalPrice: 70,
    createdAt: new Date('2026-07-11T10:00:00.000Z'),
    isTestOrder: false
  },
  voidedUnpaid: {
    key: 'voided_unpaid',
    paymentStatus: 'voided',
    status: 'cancelled',
    totalPrice: 70,
    createdAt: new Date('2026-07-11T10:00:00.000Z'),
    isTestOrder: false
  },
  archivedPaid: {
    key: 'archived_paid',
    paymentStatus: 'captured',
    status: 'delivered',
    totalPrice: 90,
    paidAt: new Date('2026-07-14T10:00:00.000Z'),
    createdAt: new Date('2026-07-02T10:00:00.000Z'),
    isDeleted: true,
    isTestOrder: false
  },
  testPaid: {
    key: 'test_paid',
    paymentStatus: 'captured',
    status: 'delivered',
    totalPrice: 200,
    paidAt: new Date('2026-07-14T10:00:00.000Z'),
    isTestOrder: true
  },
  newPaidAtDiffersCreatedAt: {
    key: 'new_paidAt_differs',
    paymentStatus: 'captured',
    status: 'ready',
    totalPrice: 120,
    createdAt: new Date('2026-06-20T10:00:00.000Z'),
    paidAt: new Date('2026-07-20T10:00:00.000Z'),
    capturedAt: new Date('2026-07-20T10:00:00.000Z'),
    isTestOrder: false
  },
  overrideZero: {
    key: 'override_zero',
    paymentStatus: 'captured',
    status: 'delivered',
    totalPrice: 150,
    adminPriceOverride: 0,
    paidAt: new Date('2026-07-13T10:00:00.000Z'),
    createdAt: new Date('2026-07-13T09:00:00.000Z'),
    isTestOrder: false
  },
  invalidTotalPrice: {
    key: 'invalid_totalPrice',
    paymentStatus: 'captured',
    status: 'delivered',
    totalPrice: 'abc',
    paidAt: new Date('2026-07-13T10:00:00.000Z'),
    isTestOrder: false
  },
  opsStatusOnly: {
    key: 'ops_status_ready_unpaid',
    // Ready without classic payment proof — counted as paid via ops-implied settlement.
    paymentStatus: 'authorized',
    status: 'ready',
    totalPrice: 55,
    createdAt: new Date('2026-07-13T10:00:00.000Z'),
    isTestOrder: false
  }
} as const;

export const PHASE2_INCLUDED_KEYS = new Set([
  'captured_with_paidAt',
  'captured_legacy_no_stamps',
  'manual_isPaid',
  'cancelled_captured',
  'archived_paid',
  'new_paidAt_differs',
  'override_zero',
  'ops_status_ready_unpaid'
]);
