import mongoose from 'mongoose';
import OrderNotificationClaim, {
  ORDER_NOTIFICATION_TYPES,
  type OrderNotificationType
} from '../models/OrderNotificationClaim';

const SEND_LOCK_MS = 30_000;

function normalizeRecipient(recipient: string): string {
  return String(recipient || '').trim().toLowerCase();
}

function safeErrorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err || 'unknown');
  return msg.replace(/pass(word)?[=:].*/gi, '[redacted]').slice(0, 500);
}

export type ClaimSendResult =
  | { action: 'skip_already_sent'; claimId: string }
  | { action: 'skip_locked'; claimId: string }
  | { action: 'send'; claimId: string; attemptCount: number };

/**
 * Atomically acquire a send attempt for (orderId, eventType, recipient).
 * Returns skip if already sent or currently locked by another worker.
 */
export async function acquireEmailSendClaim(input: {
  orderId: string;
  emailEventType: OrderNotificationType | string;
  recipient: string;
  now?: Date;
}): Promise<ClaimSendResult | null> {
  const recipient = normalizeRecipient(input.recipient);
  if (!recipient || !mongoose.Types.ObjectId.isValid(input.orderId)) return null;

  const now = input.now || new Date();
  const orderId = new mongoose.Types.ObjectId(input.orderId);
  const emailEventType = String(input.emailEventType || '').trim();

  const existing = await OrderNotificationClaim.findOne({
    orderId,
    emailEventType,
    recipient
  }).lean();

  if (existing && existing.status === 'sent') {
    return { action: 'skip_already_sent', claimId: String(existing._id) };
  }

  if (
    existing?.sendLockUntil &&
    existing.sendLockUntil instanceof Date &&
    existing.sendLockUntil.getTime() > now.getTime()
  ) {
    return { action: 'skip_locked', claimId: String(existing._id) };
  }

  const lockUntil = new Date(now.getTime() + SEND_LOCK_MS);

  try {
    const updated = await OrderNotificationClaim.findOneAndUpdate(
      {
        orderId,
        emailEventType,
        recipient,
        status: { $ne: 'sent' },
        $or: [{ sendLockUntil: null }, { sendLockUntil: { $lte: now } }, { sendLockUntil: { $exists: false } }]
      },
      {
        $set: {
          status: 'pending',
          lastAttemptAt: now,
          sendLockUntil: lockUntil
        },
        $inc: { attemptCount: 1 },
        $setOnInsert: {
          orderId,
          emailEventType,
          recipient
        }
      },
      { upsert: true, returnDocument: 'after' }
    );

    if (!updated) {
      const again = await OrderNotificationClaim.findOne({ orderId, emailEventType, recipient }).lean();
      if (again?.status === 'sent') {
        return { action: 'skip_already_sent', claimId: String(again._id) };
      }
      return again ? { action: 'skip_locked', claimId: String(again._id) } : null;
    }

    return {
      action: 'send',
      claimId: String(updated._id),
      attemptCount: Number(updated.attemptCount) || 1
    };
  } catch (err: any) {
    if (err?.code === 11000) {
      const again = await OrderNotificationClaim.findOne({ orderId, emailEventType, recipient }).lean();
      if (again?.status === 'sent') {
        return { action: 'skip_already_sent', claimId: String(again._id) };
      }
      return again ? { action: 'skip_locked', claimId: String(again._id) } : null;
    }
    throw err;
  }
}

export async function markEmailClaimSent(claimId: string, now: Date = new Date()): Promise<void> {
  if (!mongoose.Types.ObjectId.isValid(claimId)) return;
  await OrderNotificationClaim.updateOne(
    { _id: claimId },
    {
      $set: {
        status: 'sent',
        sentAt: now,
        lastError: null,
        sendLockUntil: null
      }
    }
  );
}

export async function markEmailClaimFailed(
  claimId: string,
  err: unknown,
  now: Date = new Date()
): Promise<void> {
  if (!mongoose.Types.ObjectId.isValid(claimId)) return;
  await OrderNotificationClaim.updateOne(
    { _id: claimId },
    {
      $set: {
        status: 'failed',
        lastError: safeErrorMessage(err),
        lastAttemptAt: now,
        sendLockUntil: null
      }
    }
  );
}

/**
 * Retry failed/pending claims (same document). Does not create new events.
 * Caller supplies the actual send function.
 */
export async function retryFailedEmailClaims(input: {
  limit?: number;
  send: (claim: {
    _id: string;
    orderId: string;
    emailEventType: string;
    recipient: string;
  }) => Promise<void>;
  now?: Date;
}): Promise<{ attempted: number; sent: number; failed: number; skipped: number }> {
  const now = input.now || new Date();
  const limit = Math.min(Math.max(Number(input.limit) || 20, 1), 100);
  const claims = await OrderNotificationClaim.find({
    status: { $in: ['failed', 'pending'] },
    $or: [{ sendLockUntil: null }, { sendLockUntil: { $lte: now } }, { sendLockUntil: { $exists: false } }]
  })
    .sort({ lastAttemptAt: 1 })
    .limit(limit)
    .lean();

  let attempted = 0;
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const c of claims) {
    const acquired = await acquireEmailSendClaim({
      orderId: String(c.orderId),
      emailEventType: c.emailEventType,
      recipient: c.recipient,
      now
    });
    if (!acquired || acquired.action !== 'send') {
      skipped += 1;
      continue;
    }
    attempted += 1;
    try {
      await input.send({
        _id: acquired.claimId,
        orderId: String(c.orderId),
        emailEventType: c.emailEventType,
        recipient: c.recipient
      });
      await markEmailClaimSent(acquired.claimId, now);
      sent += 1;
    } catch (err) {
      await markEmailClaimFailed(acquired.claimId, err, now);
      failed += 1;
    }
  }

  return { attempted, sent, failed, skipped };
}

export { ORDER_NOTIFICATION_TYPES };
