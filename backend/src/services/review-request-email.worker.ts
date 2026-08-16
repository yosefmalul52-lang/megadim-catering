import Order from '../models/Order';
import SiteSettings from '../models/siteSettings.model';
import { emailService } from './email.service';
import { isOrderCustomerEmailsEnabled } from '../utils/order-customer-email-gate.util';
import { isCompletedOpsStatus } from '../utils/review-request-email.util';

export type SendReviewRequestResult =
  | { ok: true; order: any }
  | {
      ok: false;
      code:
        | 'not_found'
        | 'not_completed'
        | 'already_sent'
        | 'no_email'
        | 'no_review_url'
        | 'emails_disabled'
        | 'send_failed'
        | 'busy';
      message: string;
      order?: any;
    };

/**
 * Admin-triggered Google review-request email for a single completed order.
 * Idempotent: already-sent orders are rejected.
 */
export async function sendReviewRequestEmailForOrder(
  orderId: string
): Promise<SendReviewRequestResult> {
  if (!isOrderCustomerEmailsEnabled()) {
    return {
      ok: false,
      code: 'emails_disabled',
      message: 'Customer order emails are disabled'
    };
  }

  const settings = await SiteSettings.findOne().select('googleReviewUrl').lean();
  const googleReviewUrl = String((settings as any)?.googleReviewUrl || '').trim();
  if (!googleReviewUrl) {
    return {
      ok: false,
      code: 'no_review_url',
      message: 'Google review URL is not configured in site settings'
    };
  }

  const existing = await Order.findById(orderId).lean();
  if (!existing || (existing as any).isDeleted) {
    return { ok: false, code: 'not_found', message: 'Order not found' };
  }
  if (!isCompletedOpsStatus((existing as any).status)) {
    return {
      ok: false,
      code: 'not_completed',
      message: 'Review email can only be sent for completed orders'
    };
  }
  if ((existing as any).reviewRequestEmailSentAt || (existing as any).reviewRequestEmailStatus === 'sent') {
    return {
      ok: false,
      code: 'already_sent',
      message: 'Review request email was already sent for this order',
      order: existing
    };
  }
  if (!String((existing as any).customerDetails?.email || '').trim()) {
    return {
      ok: false,
      code: 'no_email',
      message: 'Customer has no email address on this order',
      order: existing
    };
  }

  const claimed = await Order.findOneAndUpdate(
    {
      _id: orderId,
      status: { $in: ['delivered', 'completed'] },
      isDeleted: { $ne: true },
      reviewRequestEmailStatus: { $nin: ['sent', 'sending'] },
      $or: [
        { reviewRequestEmailSentAt: null },
        { reviewRequestEmailSentAt: { $exists: false } }
      ]
    },
    { $set: { reviewRequestEmailStatus: 'sending' } },
    { returnDocument: 'after' }
  );

  if (!claimed) {
    const again = await Order.findById(orderId).lean();
    if ((again as any)?.reviewRequestEmailStatus === 'sending') {
      return { ok: false, code: 'busy', message: 'Review email is already being sent', order: again };
    }
    if ((again as any)?.reviewRequestEmailSentAt || (again as any)?.reviewRequestEmailStatus === 'sent') {
      return {
        ok: false,
        code: 'already_sent',
        message: 'Review request email was already sent for this order',
        order: again
      };
    }
    return { ok: false, code: 'busy', message: 'Could not claim order for sending', order: again };
  }

  try {
    const sendResult = await emailService.sendReviewRequestEmail(claimed as any, googleReviewUrl);
    if (sendResult.suppressed) {
      await Order.updateOne(
        { _id: orderId, reviewRequestEmailStatus: 'sending' },
        { $set: { reviewRequestEmailStatus: 'failed' } }
      );
      return {
        ok: false,
        code: 'emails_disabled',
        message: 'Customer order emails are disabled'
      };
    }
    if (!sendResult.sent) {
      const status =
        sendResult.skipped === 'no_recipient'
          ? 'skipped_no_email'
          : sendResult.skipped === 'no_review_url'
            ? 'skipped_no_review_url'
            : 'failed';
      const updated = await Order.findOneAndUpdate(
        { _id: orderId, reviewRequestEmailStatus: 'sending' },
        { $set: { reviewRequestEmailStatus: status } },
        { returnDocument: 'after' }
      );
      return {
        ok: false,
        code: status === 'skipped_no_email' ? 'no_email' : status === 'skipped_no_review_url' ? 'no_review_url' : 'send_failed',
        message: 'Failed to send review request email',
        order: updated
      };
    }

    const updated = await Order.findOneAndUpdate(
      { _id: orderId, reviewRequestEmailStatus: 'sending' },
      {
        $set: {
          reviewRequestEmailStatus: 'sent',
          reviewRequestEmailSentAt: new Date(),
          reviewRequestEmailDueAt: null
        }
      },
      { returnDocument: 'after' }
    );

    return { ok: true, order: updated };
  } catch (err: any) {
    console.error('[review-request] manual send failed for order', orderId, err?.message || err);
    const updated = await Order.findOneAndUpdate(
      { _id: orderId, reviewRequestEmailStatus: 'sending' },
      { $set: { reviewRequestEmailStatus: 'failed' } },
      { returnDocument: 'after' }
    ).catch(() => null);
    return {
      ok: false,
      code: 'send_failed',
      message: err?.message || 'Failed to send review request email',
      order: updated || undefined
    };
  }
}
