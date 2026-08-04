/**
 * Single source of truth for admin order tab membership.
 * Every order matches exactly one AdminStatusTab.
 */

import {
  applyManualPaidTimestamps,
  applyOpsStatusTimestamps,
  type LifecycleTimestampFields
} from './order-lifecycle-timestamps.util';

export const ADMIN_STATUS_TABS = [
  'pending',
  'processing',
  'ready',
  'failed',
  'cancelled',
  'completed',
  'archive'
] as const;

export type AdminStatusTab = (typeof ADMIN_STATUS_TABS)[number];

/** Full hour before a first-time awaiting_payment (no prior failure) enters failed tab. */
export const AWAITING_PAYMENT_ABANDON_MS = 60 * 60 * 1000;

export const PAYMENT_EXCEPTION_RESOLUTIONS = [
  'approve_and_continue_billing',
  'paid_elsewhere_continue',
  'send_new_payment_link',
  'cancel_order'
] as const;

export type PaymentExceptionResolution = (typeof PAYMENT_EXCEPTION_RESOLUTIONS)[number];

export const PAYMENT_EXCEPTION_RESOLUTION_LABELS_HE: Record<PaymentExceptionResolution, string> = {
  approve_and_continue_billing: 'אישור ההזמנה והמשך לחיוב',
  paid_elsewhere_continue: 'שולם בדרך אחרת והמשך לטיפול',
  send_new_payment_link: 'שליחת קישור תשלום חדש לפני אישור',
  cancel_order: 'ביטול ההזמנה'
};

export const RESOLUTIONS_THAT_CLOSE_EXCEPTION: ReadonlySet<PaymentExceptionResolution> = new Set([
  'approve_and_continue_billing',
  'paid_elsewhere_continue',
  'cancel_order'
]);

export const RESOLUTIONS_TO_PROCESSING: ReadonlySet<PaymentExceptionResolution> = new Set([
  'approve_and_continue_billing',
  'paid_elsewhere_continue'
]);

/** Moving into these ops statuses while a payment exception is open requires explicit resolution. */
export const OPS_STATUSES_REQUIRING_EXCEPTION_RESOLUTION = [
  'pending',
  'new',
  'processing',
  'in-progress',
  'ready',
  'delivered',
  'out_for_delivery',
  'completed'
] as const;

export type OpsStatusRequiringExceptionResolution =
  (typeof OPS_STATUSES_REQUIRING_EXCEPTION_RESOLUTION)[number];

const LEGACY_RESOLUTION_ALIASES: Record<string, PaymentExceptionResolution | null> = {
  continue_without_payment: 'approve_and_continue_billing',
  paid_elsewhere: 'paid_elsewhere_continue',
  new_payment_link_sent: 'send_new_payment_link',
  reviewed_and_closed: null
};

export function isPaymentExceptionResolution(value: unknown): value is PaymentExceptionResolution {
  return (PAYMENT_EXCEPTION_RESOLUTIONS as readonly string[]).includes(String(value || '').trim());
}

export function normalizePaymentExceptionResolution(
  value: unknown
): PaymentExceptionResolution | null {
  const raw = String(value || '').trim();
  if (isPaymentExceptionResolution(raw)) return raw;
  if (Object.prototype.hasOwnProperty.call(LEGACY_RESOLUTION_ALIASES, raw)) {
    return LEGACY_RESOLUTION_ALIASES[raw];
  }
  return null;
}

export function isOpsStatusRequiringExceptionResolution(
  status: unknown
): status is OpsStatusRequiringExceptionResolution {
  return (OPS_STATUSES_REQUIRING_EXCEPTION_RESOLUTION as readonly string[]).includes(
    String(status || '').trim()
  );
}

export type AdminTabOrderLike = {
  status?: unknown;
  isDeleted?: unknown;
  paymentStatus?: unknown;
  paymentExceptionResolvedAt?: unknown;
  paymentAwaitingStartedAt?: unknown;
  /** Set when payment fails; kept across new payment-link attempts until paid or exception resolved. */
  paymentFailedAt?: unknown;
  readyAt?: unknown;
  completedAt?: unknown;
  cancelledAt?: unknown;
  paidAt?: unknown;
  capturedAt?: unknown;
  serviceDate?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
  transactionId?: unknown;
  paymentSecurityToken?: unknown;
  paymentInitTokenHash?: unknown;
  isManual?: unknown;
};

/**
 * Active payment-attempt clock only. Missing field => do NOT treat as abandoned
 * (safe for legacy rows and new attempts that just wrote the field).
 */
export function awaitingPaymentReferenceTime(order: AdminTabOrderLike): Date | null {
  const raw = order.paymentAwaitingStartedAt;
  if (raw == null) return null;
  const d = raw instanceof Date ? raw : new Date(String(raw));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function isAwaitingPaymentAbandoned(
  order: AdminTabOrderLike,
  now: Date = new Date()
): boolean {
  if (String(order.paymentStatus || '').trim() !== 'awaiting_payment') return false;
  const started = awaitingPaymentReferenceTime(order);
  if (!started) return false;
  return now.getTime() - started.getTime() >= AWAITING_PAYMENT_ABANDON_MS;
}

/**
 * Open exception for admin gates (status moves): failed or awaiting without resolution.
 */
export function hasOpenPaymentException(order: {
  paymentStatus?: unknown;
  paymentExceptionResolvedAt?: unknown;
}): boolean {
  const pay = String(order?.paymentStatus || '').trim();
  if (pay !== 'failed' && pay !== 'awaiting_payment') return false;
  return order?.paymentExceptionResolvedAt == null;
}

/**
 * Open exception for TAB membership:
 * - failed (unresolved) always
 * - awaiting with prior failure marker (new payment link after fail) always
 * - awaiting without prior failure only after full hour from paymentAwaitingStartedAt
 */
export function hasOpenPaymentExceptionForTab(
  order: AdminTabOrderLike,
  now: Date = new Date()
): boolean {
  if (order.paymentExceptionResolvedAt != null) return false;
  const pay = String(order.paymentStatus || '').trim();
  if (pay === 'failed') return true;
  if (pay === 'awaiting_payment') {
    if (order.paymentFailedAt != null) return true;
    return isAwaitingPaymentAbandoned(order, now);
  }
  return false;
}

export function requiresPaymentExceptionResolutionOnStatusChange(
  order: {
    paymentStatus?: unknown;
    paymentExceptionResolvedAt?: unknown;
  },
  nextStatus: unknown
): boolean {
  return hasOpenPaymentException(order) && isOpsStatusRequiringExceptionResolution(nextStatus);
}

export function isTranzilaCheckoutOrder(order: AdminTabOrderLike): boolean {
  if (order.isManual === true) return false;
  if (order.paymentInitTokenHash) return true;
  if (order.paymentSecurityToken) return true;
  if (order.transactionId) return true;
  const pay = String(order.paymentStatus || '').trim();
  return ['awaiting_payment', 'authorized', 'captured', 'failed', 'voided'].includes(pay);
}

/**
 * Priority:
 * 1) soft-deleted archive
 * 2) cancelled → בוטלו
 * 3) open payment exception → נכשלו
 * 4) delivered/completed → הושלמו
 * 5) ready / out_for_delivery → מוכנים
 * 6) processing family → בטיפול
 * 7) pending/new → ממתינים
 */
export function resolveAdminStatusTab(
  order: AdminTabOrderLike,
  now: Date = new Date()
): AdminStatusTab {
  if (order.isDeleted === true) return 'archive';
  const status = String(order.status || '').trim();
  if (status === 'cancelled') return 'cancelled';

  if (hasOpenPaymentExceptionForTab(order, now)) return 'failed';

  if (status === 'delivered' || status === 'completed') return 'completed';
  if (status === 'ready' || status === 'out_for_delivery') return 'ready';
  if (status === 'processing' || status === 'in-progress' || status === 'delivery_failed') {
    return 'processing';
  }
  if (status === 'pending' || status === 'new') return 'pending';
  return 'pending';
}

function openExceptionMongoClause(): Record<string, unknown> {
  return {
    $or: [
      { paymentExceptionResolvedAt: null },
      { paymentExceptionResolvedAt: { $exists: false } }
    ]
  };
}

/** Failed-tab membership — must stay in sync with hasOpenPaymentExceptionForTab. */
export function buildFailedTabMembershipClause(now: Date = new Date()): Record<string, unknown> {
  const cutoff = new Date(now.getTime() - AWAITING_PAYMENT_ABANDON_MS);
  return {
    $and: [
      { isDeleted: { $ne: true } },
      { status: { $ne: 'cancelled' } },
      openExceptionMongoClause(),
      {
        $or: [
          { paymentStatus: 'failed' },
          {
            $and: [
              { paymentStatus: 'awaiting_payment' },
              {
                $or: [
                  { paymentFailedAt: { $ne: null } },
                  {
                    $and: [
                      { paymentAwaitingStartedAt: { $type: 'date' } },
                      { paymentAwaitingStartedAt: { $lte: cutoff } }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  };
}

export function buildAdminFailedTabFilter(now: Date = new Date()): Record<string, unknown> {
  return buildFailedTabMembershipClause(now);
}

export function buildAdminCancelledTabFilter(): Record<string, unknown> {
  return {
    isDeleted: { $ne: true },
    status: 'cancelled'
  };
}

export function buildAdminCompletedTabFilter(now: Date = new Date()): Record<string, unknown> {
  return {
    $and: [
      { isDeleted: { $ne: true } },
      { status: { $in: ['delivered', 'completed'] } },
      { $nor: [buildFailedTabMembershipClause(now)] }
    ]
  };
}

/** Soft-deleted only — not cancelled, not completed. */
export function buildAdminArchiveTabFilter(): Record<string, unknown> {
  return { isDeleted: true };
}

export function buildAdminOpsTabFilter(
  statusTab: 'pending' | 'processing' | 'ready',
  now: Date = new Date()
): Record<string, unknown> {
  const statusMatch =
    statusTab === 'pending'
      ? { status: { $in: ['pending', 'new'] } }
      : statusTab === 'processing'
        ? { status: { $in: ['processing', 'in-progress', 'delivery_failed'] } }
        : { status: { $in: ['ready', 'out_for_delivery'] } };

  return {
    $and: [
      { isDeleted: { $ne: true } },
      { status: { $nin: ['cancelled', 'delivered', 'completed'] } },
      statusMatch,
      { $nor: [buildFailedTabMembershipClause(now)] }
    ]
  };
}

export function buildAdminStatusTabFilter(
  statusTab: AdminStatusTab,
  now: Date = new Date()
): Record<string, unknown> {
  switch (statusTab) {
    case 'pending':
      return buildAdminOpsTabFilter('pending', now);
    case 'processing':
      return buildAdminOpsTabFilter('processing', now);
    case 'ready':
      return buildAdminOpsTabFilter('ready', now);
    case 'failed':
      return buildAdminFailedTabFilter(now);
    case 'cancelled':
      return buildAdminCancelledTabFilter();
    case 'completed':
      return buildAdminCompletedTabFilter(now);
    case 'archive':
      return buildAdminArchiveTabFilter();
    default:
      return {};
  }
}

export function orderMatchesFailedTab(
  order: AdminTabOrderLike,
  now: Date = new Date()
): boolean {
  return resolveAdminStatusTab(order, now) === 'failed';
}

export function orderMatchesOpsProcessingTab(
  order: AdminTabOrderLike,
  now: Date = new Date()
): boolean {
  return resolveAdminStatusTab(order, now) === 'processing';
}

export function orderMatchesOpsPendingTab(
  order: AdminTabOrderLike,
  now: Date = new Date()
): boolean {
  return resolveAdminStatusTab(order, now) === 'pending';
}

export function orderMatchesExactlyOneAdminTab(
  order: AdminTabOrderLike,
  now: Date = new Date()
): boolean {
  const hits = ADMIN_STATUS_TABS.filter((tab) => resolveAdminStatusTab(order, now) === tab);
  return hits.length === 1;
}

export function shouldSendOrderApprovedEmail(
  previousOpsStatus: unknown,
  nextOpsStatus: unknown
): boolean {
  const next = String(nextOpsStatus || '').trim();
  const prev = String(previousOpsStatus || '').trim();
  const movingToProcessing = next === 'processing' || next === 'in-progress';
  if (!movingToProcessing) return false;
  return prev !== 'processing' && prev !== 'in-progress';
}

/**
 * Atomic status / exception decision. Never writes paymentStatus.
 * Moving to processing with open exception requires a closing resolution
 * (defaults callers should pass approve_and_continue_billing).
 */
export function buildAdminStatusChangeUpdate(input: {
  previousStatus: string | null;
  nextStatus: string;
  previousPaymentStatus: string | null;
  changedBy: string;
  notificationSent?: boolean;
  paymentExceptionResolution?: unknown;
  orderHasOpenPaymentException: boolean;
  now?: Date;
  manualPaymentMethod?: string;
  manualPaymentNote?: string;
  exceptionNote?: string;
  /** Prior lifecycle timestamps — first-write wins. */
  priorTimestamps?: LifecycleTimestampFields;
}): {
  $set: Record<string, unknown>;
  $unset?: Record<string, unknown>;
  $push?: { statusChangeHistory: Record<string, unknown> };
  paymentStatusUnchanged: true;
  resolution?: PaymentExceptionResolution;
  shouldSendApprovalEmail: boolean;
} {
  const now = input.now || new Date();
  let nextStatus = String(input.nextStatus || '').trim();
  let resolution = normalizePaymentExceptionResolution(input.paymentExceptionResolution);

  // Explicit move to processing with open exception is itself the business decision.
  if (
    input.orderHasOpenPaymentException &&
    (nextStatus === 'processing' || nextStatus === 'in-progress') &&
    !resolution
  ) {
    resolution = 'approve_and_continue_billing';
  }

  if (
    input.orderHasOpenPaymentException &&
    isOpsStatusRequiringExceptionResolution(nextStatus)
  ) {
    if (!resolution || resolution === 'send_new_payment_link') {
      const err = new Error(
        'נדרשת בחירת אופן טיפול בחריגת התשלום לפני העברה לסטטוס תפעולי'
      ) as Error & { statusCode: number; code: string };
      err.statusCode = 422;
      err.code = 'PAYMENT_EXCEPTION_RESOLUTION_REQUIRED';
      throw err;
    }
  }

  if (resolution === 'cancel_order') {
    nextStatus = 'cancelled';
  } else if (resolution && RESOLUTIONS_TO_PROCESSING.has(resolution)) {
    nextStatus = 'processing';
  }

  if (resolution === 'send_new_payment_link') {
    const err = new Error(
      'שליחת קישור תשלום חדש אינה מעבירה סטטוס ואינה סוגרת את החריגה'
    ) as Error & { statusCode: number; code: string };
    err.statusCode = 422;
    err.code = 'PAYMENT_LINK_DOES_NOT_CHANGE_STATUS';
    throw err;
  }

  const $set: Record<string, unknown> = { status: nextStatus };
  const $unset: Record<string, unknown> = {};
  let appliedResolution: PaymentExceptionResolution | undefined;
  const priorTs = input.priorTimestamps || {};

  if (resolution && RESOLUTIONS_THAT_CLOSE_EXCEPTION.has(resolution)) {
    appliedResolution = resolution;
    $set.paymentExceptionResolvedAt = now;
    $set.paymentExceptionResolvedBy = input.changedBy || null;
    $set.paymentExceptionResolution = resolution;
    if (input.exceptionNote != null && String(input.exceptionNote).trim()) {
      $set.paymentExceptionNote = String(input.exceptionNote).trim().slice(0, 500);
    }
    // Clear failure marker so tab law uses ops status after resolution.
    $unset.paymentFailedAt = 1;

    if (resolution === 'paid_elsewhere_continue') {
      $set['customerDetails.isPaid'] = true;
      $set.manualPaymentRecordedAt = now;
      $set.manualPaymentRecordedBy = input.changedBy || null;
      $set.manualPaymentMethod = String(
        input.manualPaymentMethod || 'שולם בדרך אחרת'
      ).trim();
      $set.manualPaymentNote = String(input.manualPaymentNote || '').trim() || null;
      applyManualPaidTimestamps({ $set, prior: priorTs, now });
    }
  }

  applyOpsStatusTimestamps({
    $set,
    previousStatus: input.previousStatus,
    nextStatus,
    prior: priorTs,
    now
  });

  const shouldSendApprovalEmail = shouldSendOrderApprovedEmail(
    input.previousStatus,
    nextStatus
  );

  const historyEntry: Record<string, unknown> = {
    previousStatus: input.previousStatus || '',
    newStatus: nextStatus,
    previousPaymentStatus: input.previousPaymentStatus || '',
    paymentExceptionResolution: appliedResolution || null,
    changedBy: input.changedBy || 'system',
    changedAt: now,
    notificationSent: Boolean(input.notificationSent)
  };

  const result: {
    $set: Record<string, unknown>;
    $unset?: Record<string, unknown>;
    $push?: { statusChangeHistory: Record<string, unknown> };
    paymentStatusUnchanged: true;
    resolution?: PaymentExceptionResolution;
    shouldSendApprovalEmail: boolean;
  } = {
    $set,
    paymentStatusUnchanged: true,
    shouldSendApprovalEmail
  };

  if (Object.keys($unset).length) result.$unset = $unset;
  if (appliedResolution) result.resolution = appliedResolution;
  if (input.previousStatus !== nextStatus || appliedResolution) {
    result.$push = { statusChangeHistory: historyEntry };
  }

  return result;
}
