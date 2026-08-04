import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export const PAYMENT_AUDIT_EVENT_TYPES = [
  'payment_initiated',
  'payment_initiate_blocked',
  'payment_authorized',
  'capture_started',
  'capture_completed',
  'capture_failed',
  'capture_result_unknown',
  'capture_blocked',
  'void_completed',
  'void_failed'
] as const;

export type PaymentAuditEventType = (typeof PAYMENT_AUDIT_EVENT_TYPES)[number];

export const PAYMENT_AUDIT_RESULTS = ['success', 'failed', 'blocked', 'unknown'] as const;
export type PaymentAuditResult = (typeof PAYMENT_AUDIT_RESULTS)[number];

export const PAYMENT_AUDIT_ACTORS = ['customer', 'guest', 'admin', 'system'] as const;
export type PaymentAuditActorType = (typeof PAYMENT_AUDIT_ACTORS)[number];

/**
 * Permanent payment-action history (Phase 2A).
 * Stores only safe operational fields — never tokens, card data, lock ids, or gateway bodies.
 */
export interface IPaymentAuditEvent extends Document {
  orderId: Types.ObjectId;
  orderNumber?: string | null;
  eventType: PaymentAuditEventType;
  paymentStatusBefore?: string | null;
  paymentStatusAfter?: string | null;
  result: PaymentAuditResult;
  actorType: PaymentAuditActorType;
  actorId?: string | null;
  /** Admin display name only — never customer PII beyond what admins already see. */
  actorDisplayName?: string | null;
  safeReasonCode?: string | null;
  /** Idempotency key — unique when set. Never stores raw secrets/lock ids. */
  eventKey?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentAuditEventSchema = new Schema<IPaymentAuditEvent>(
  {
    orderId: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      index: true
    },
    orderNumber: { type: String, required: false, default: null, trim: true },
    eventType: {
      type: String,
      required: true,
      enum: PAYMENT_AUDIT_EVENT_TYPES
    },
    paymentStatusBefore: { type: String, required: false, default: null },
    paymentStatusAfter: { type: String, required: false, default: null },
    result: {
      type: String,
      required: true,
      enum: PAYMENT_AUDIT_RESULTS
    },
    actorType: {
      type: String,
      required: true,
      enum: PAYMENT_AUDIT_ACTORS
    },
    actorId: { type: String, required: false, default: null },
    actorDisplayName: { type: String, required: false, default: null, trim: true },
    safeReasonCode: { type: String, required: false, default: null },
    eventKey: { type: String, required: false, default: null }
  },
  {
    timestamps: true,
    collection: 'payment_audit_events'
  }
);

PaymentAuditEventSchema.index({ orderId: 1, createdAt: -1 });
PaymentAuditEventSchema.index(
  { eventKey: 1 },
  { unique: true, partialFilterExpression: { eventKey: { $type: 'string' } } }
);

const PaymentAuditEvent: Model<IPaymentAuditEvent> = mongoose.model<IPaymentAuditEvent>(
  'PaymentAuditEvent',
  PaymentAuditEventSchema
);

export default PaymentAuditEvent;
