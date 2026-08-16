/**
 * Helpers for Google review-request emails.
 * Sending is manual (admin button) — no automatic schedule on completion.
 */

export const REVIEW_REQUEST_EMAIL_STATUSES = [
  'pending',
  'sending',
  'sent',
  'failed',
  'skipped_no_email',
  'skipped_no_review_url',
  'cancelled'
] as const;

export type ReviewRequestEmailStatus = (typeof REVIEW_REQUEST_EMAIL_STATUSES)[number];

export type ReviewRequestPrior = {
  completedAt?: Date | null;
  reviewRequestEmailDueAt?: Date | null;
  reviewRequestEmailSentAt?: Date | null;
  reviewRequestEmailStatus?: string | null;
};

export function isCompletedOpsStatus(status: unknown): boolean {
  const s = String(status || '').trim();
  return s === 'delivered' || s === 'completed';
}

/**
 * On cancel: clear leftover pending/failed/sending review-email state.
 * Completion no longer auto-schedules a send.
 */
export function applyReviewRequestOnStatusChange(input: {
  $set: Record<string, unknown>;
  previousStatus: string | null;
  nextStatus: string;
  prior: ReviewRequestPrior;
  now?: Date;
}): void {
  const next = String(input.nextStatus || '').trim();
  const prev = String(input.previousStatus || '').trim();
  const prior = input.prior || {};

  if (next === 'cancelled' && prev !== 'cancelled') {
    if (!prior.reviewRequestEmailSentAt) {
      const currentStatus = String(prior.reviewRequestEmailStatus || '');
      if (
        !currentStatus ||
        currentStatus === 'pending' ||
        currentStatus === 'failed' ||
        currentStatus === 'sending'
      ) {
        input.$set.reviewRequestEmailStatus = 'cancelled';
        input.$set.reviewRequestEmailDueAt = null;
      }
    }
  }
}
