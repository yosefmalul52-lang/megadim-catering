import mongoose, { Document, Schema } from 'mongoose';

/**
 * Durable email notification claims.
 * Unique key: orderId + emailEventType + recipient
 * Status lifecycle: pending → sent | failed (retry updates same doc).
 */
export interface IOrderNotificationClaim extends Document {
  orderId: mongoose.Types.ObjectId;
  emailEventType: string;
  /** Lowercased trimmed recipient email (or channel id). */
  recipient: string;
  status: 'pending' | 'sent' | 'failed';
  attemptCount: number;
  lastAttemptAt?: Date | null;
  sentAt?: Date | null;
  lastError?: string | null;
  /** Soft lock to prevent concurrent SMTP sends. */
  sendLockUntil?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const OrderNotificationClaimSchema = new Schema<IOrderNotificationClaim>(
  {
    orderId: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      index: true
    },
    emailEventType: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80
    },
    recipient: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 320
    },
    status: {
      type: String,
      enum: ['pending', 'sent', 'failed'],
      default: 'pending',
      required: true,
      index: true
    },
    attemptCount: { type: Number, default: 0, min: 0 },
    lastAttemptAt: { type: Date, default: null },
    sentAt: { type: Date, default: null },
    lastError: { type: String, default: null, maxlength: 500 },
    sendLockUntil: { type: Date, default: null }
  },
  { timestamps: true }
);

OrderNotificationClaimSchema.index(
  { orderId: 1, emailEventType: 1, recipient: 1 },
  { unique: true }
);

export const ORDER_NOTIFICATION_TYPES = {
  ORDER_RECEIVED: 'order_received',
  ORDER_APPROVED: 'order_approved',
  /** @deprecated Prefer ORDER_RECEIVED; kept for reading old claims only. */
  ORDER_PAID_CONFIRMATION: 'order_paid_confirmation',
  ORDER_ITEMS_UPDATED: 'order_items_updated'
} as const;

export type OrderNotificationType =
  (typeof ORDER_NOTIFICATION_TYPES)[keyof typeof ORDER_NOTIFICATION_TYPES];

export default mongoose.model<IOrderNotificationClaim>(
  'OrderNotificationClaim',
  OrderNotificationClaimSchema
);
