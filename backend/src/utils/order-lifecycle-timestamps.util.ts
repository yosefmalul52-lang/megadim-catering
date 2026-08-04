/**
 * Server-side lifecycle timestamps for orders.
 * Never overwrite an existing timestamp (first-write wins).
 * Does not participate in revenue calculations (phase 1).
 */

export type LifecycleTimestampFields = {
  readyAt?: Date | null;
  completedAt?: Date | null;
  cancelledAt?: Date | null;
  paidAt?: Date | null;
  capturedAt?: Date | null;
  serviceDate?: Date | null;
};

export function parseServiceDateFromEventDate(eventDate: unknown): Date | null {
  if (eventDate == null || eventDate === '') return null;
  if (eventDate instanceof Date && !Number.isNaN(eventDate.getTime())) {
    return eventDate;
  }
  const raw = String(eventDate).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const d = new Date(`${raw}T12:00:00.000Z`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** First-write: only set when prior value is missing. */
export function setTimestampIfAbsent(
  $set: Record<string, unknown>,
  field: keyof LifecycleTimestampFields,
  priorValue: unknown,
  when: Date
): void {
  if (priorValue != null) return;
  if ($set[field] != null) return;
  $set[field] = when;
}

/**
 * Apply ops-status timestamps into a Mongo $set payload.
 * pending→processing: no completion stamps.
 */
export function applyOpsStatusTimestamps(input: {
  $set: Record<string, unknown>;
  previousStatus: string | null;
  nextStatus: string;
  prior: LifecycleTimestampFields;
  now?: Date;
}): void {
  const now = input.now || new Date();
  const next = String(input.nextStatus || '').trim();
  const prev = String(input.previousStatus || '').trim();

  if (next === 'ready' && prev !== 'ready') {
    setTimestampIfAbsent(input.$set, 'readyAt', input.prior.readyAt, now);
  }
  if (next === 'delivered' && prev !== 'delivered') {
    setTimestampIfAbsent(input.$set, 'completedAt', input.prior.completedAt, now);
  }
  if (next === 'cancelled' && prev !== 'cancelled') {
    setTimestampIfAbsent(input.$set, 'cancelledAt', input.prior.cancelledAt, now);
  }
}

/** Capture success: set capturedAt + paidAt if absent. */
export function applyCaptureTimestamps(input: {
  $set: Record<string, unknown>;
  prior: Pick<LifecycleTimestampFields, 'capturedAt' | 'paidAt'>;
  now?: Date;
}): void {
  const now = input.now || new Date();
  setTimestampIfAbsent(input.$set, 'capturedAt', input.prior.capturedAt, now);
  setTimestampIfAbsent(input.$set, 'paidAt', input.prior.paidAt, now);
}

/** Manual / paid-elsewhere: set paidAt if absent (no capturedAt). */
export function applyManualPaidTimestamps(input: {
  $set: Record<string, unknown>;
  prior: Pick<LifecycleTimestampFields, 'paidAt'>;
  now?: Date;
}): void {
  const now = input.now || new Date();
  setTimestampIfAbsent(input.$set, 'paidAt', input.prior.paidAt, now);
}

export const ARCHIVE_ALLOWED_STATUSES = new Set(['delivered', 'cancelled']);

export function canArchiveOrderByStatus(status: unknown): boolean {
  return ARCHIVE_ALLOWED_STATUSES.has(String(status || '').trim());
}
