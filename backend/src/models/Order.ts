import mongoose, { Schema, Document, Model } from 'mongoose';

// Order Interface - userId is optional (for guest orders)
export interface IOrder extends Document {
  userId?: mongoose.Types.ObjectId | null; // Optional - null for guest orders
  /** Human-readable order number shown to customers and admins (e.g. MG-123456). */
  orderNumber?: string;
  orderType?: 'shabbat' | 'catering'; // Distinguishes cart orders from catering/events
  customerDetails: any;
  items: any[];
  totalPrice: number;
  status: string;
  isDeleted?: boolean;
  numberOfPortions?: number | string;
  /** Shabbat/holiday catering: portion count for first meal (evening). */
  portionsEvening?: number;
  /** Shabbat/holiday catering: portion count for second meal (morning). */
  portionsMorning?: number;
  mealTime?: string;
  mealTypes?: string;
  /** Client-captured UTM / campaign params (optional). */
  marketingData?: {
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
    utm_term?: string;
    utm_content?: string;
  };
  /** Pricing breakdown stored at root level for easy querying and display. */
  subtotal?: number | null;
  deliveryFee?: number | null;
  /**
   * Distinguishes between the two catering pipelines:
   * 'shabbat' = Shabbat & holiday catering form; 'events' = wedding/corporate events form.
   */
  cateringKind?: 'shabbat' | 'events';
  /** Event type label (e.g. 'חתונה', 'בר מצווה', 'אירוע עסקי') — used by events catering. */
  eventType?: string;
  /** Number of guests — used by events catering (numberOfPortions covers Shabbat catering). */
  guestCount?: number;
  /** Event venue / location address. */
  venue?: string;
  assignedDriverId?: mongoose.Types.ObjectId | null;
  assignedDriverName?: string;
  assignedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
  /**
   * Payment lifecycle status — separate from the operational `status` field so
   * the kitchen/delivery pipeline and the payment pipeline can evolve independently.
   *
   * pending        → no payment action taken yet
   * authorized     → pre-auth hold placed on card; awaiting capture
   * captured       → charge finalised
   * voided         → pre-auth hold released (admin cancelled before capture)
   * failed         → payment attempt failed
   */
  paymentStatus?: 'pending' | 'awaiting_payment' | 'authorized' | 'captured' | 'voided' | 'failed';
  /** Provider-issued authorization/transaction code returned by the pre-auth call. */
  authCode?: string;
  /** Provider's transaction ID used to reference the pre-auth when capturing or voiding. */
  transactionId?: string;
  /** Tranzila secure card token (ccard field from TranzilaTK=1 callback) — used instead of raw card number. */
  cardToken?: string;
  /** Card expiry month (1–12) from callback — stored for force capture. */
  expireMonth?: number;
  /** Card expiry year (YYYY) from callback — stored for force capture. */
  expireYear?: number;
  /** Amount that was authorized — used to warn admin if totalPrice changed after auth. */
  authorizedAmount?: number;
  /**
   * Explicit admin special price. When set, preferred over totalPrice for alerts/reports
   * (getEffectiveOrderAmount). Does not alter Tranzila payloads by itself.
   */
  adminPriceOverride?: number | null;
  adminPriceOverrideReason?: string | null;
  priceOverriddenAt?: Date | null;
  priceOverriddenBy?: string | null;
  /**
   * Explicit admin resolution of failed/abandoned payment exception.
   * Does not rewrite paymentStatus — only removes the order from the exceptions tab.
   */
  paymentExceptionResolvedAt?: Date | null;
  paymentExceptionResolvedBy?: string | null;
  paymentExceptionResolution?: string | null;
  /** Optional note/reason captured when resolving a payment exception. */
  paymentExceptionNote?: string | null;
  /** Server time when paymentStatus first became awaiting_payment (abandon clock). */
  paymentAwaitingStartedAt?: Date | null;
  /**
   * Set when payment fails; kept across new payment-link attempts until paid or exception resolved.
   * Keeps the order on the failed/abandoned admin tab after send_new_payment_link.
   */
  paymentFailedAt?: Date | null;
  /** Manual payment recorded when resolving paid_elsewhere — does not set captured/authorized. */
  manualPaymentRecordedAt?: Date | null;
  manualPaymentRecordedBy?: string | null;
  manualPaymentMethod?: string | null;
  manualPaymentNote?: string | null;
  /**
   * Lifecycle timestamps (first-write wins; optional for legacy docs).
   * readyAt — first transition to ready
   * completedAt — first transition to delivered
   * cancelledAt — first transition to cancelled
   * paidAt — business date money is considered collected
   * capturedAt — technical gateway capture time
   * serviceDate — delivery/pickup/event date (mirrors eventDate on create; does not replace it)
   */
  readyAt?: Date | null;
  completedAt?: Date | null;
  cancelledAt?: Date | null;
  paidAt?: Date | null;
  capturedAt?: Date | null;
  serviceDate?: Date | null;
  /** Append-only ops status change audit. */
  statusChangeHistory?: Array<{
    previousStatus: string;
    newStatus: string;
    previousPaymentStatus?: string | null;
    paymentExceptionResolution?: string | null;
    changedBy: string;
    changedAt: Date;
    notificationSent: boolean;
  }>;
  /** Internal admin notes — never overwrites customerDetails.notes. */
  adminNotes?: string;
  /** Shabbat catering — selected salads (order-level). */
  salads?: string[];
  /** @deprecated legacy flat course arrays — kept for old orders. */
  firstCourses?: string[];
  /** @deprecated legacy flat course arrays — kept for old orders. */
  mainCourses?: string[];
  firstCoursesEvening?: string[];
  firstCoursesMorning?: string[];
  mainCoursesEvening?: string[];
  mainCoursesMorning?: string[];
  sidesEvening?: string[];
  sidesMorning?: string[];
  /**
   * One-time random token generated server-side when the payment page URL is built.
   * Embedded in the Tranzila HPP URL (pdesc / contact fields).
   * Tranzila echoes it back in the success redirect so we can detect spoofing.
   * Never exposed to the client.
   */
  paymentSecurityToken?: string;
  /** SHA-256 hash of the short-lived capability returned once at checkout creation. */
  paymentInitTokenHash?: string;
  /** Application-enforced expiry for paymentInitTokenHash; no Mongo TTL index is used. */
  paymentInitTokenExpiresAt?: Date;
  /** Set when checkout confirmation emails (admin + customer) were sent after successful payment. */
  confirmationEmailSentAt?: Date;
  /**
   * Admin-only flag for sandbox / QA orders.
   * Never set from public checkout or payment flows; excluded from dashboard revenue metrics.
   */
  isTestOrder?: boolean;
  /**
   * Optional kitchen preparation datetime (Asia/Jerusalem business use).
   * When unset, kitchen report falls back to delivery/pickup timing.
   * Does not replace customerDetails.eventDate / preferredDeliveryTime.
   */
  isDemo?: boolean;
  demoBatchId?: string;
  kitchenPreparationAt?: Date | null;
  /** Structured allergy info for kitchen — never auto-derived from free-text notes. */
  allergies?: string;
  /** Structured special requests for kitchen. */
  specialRequests?: string;
  /**
   * Compact kitchen-relevant change log (not a full audit trail).
   * Old orders without this field are never treated as "changed".
   */
  kitchenChangeLog?: Array<{
    at: Date;
    type: string;
    summary: string;
    by?: string;
    previousValue?: string;
    newValue?: string;
  }>;
  /** Last time kitchen printed this order / day cut that included it. */
  lastKitchenPrintAt?: Date | null;
  /** Snapshot hash of quantities at last kitchen print (change detection). */
  lastKitchenPrintSnapshot?: string | null;
}

// Order Schema - userId MUST be at root level
const OrderSchema: Schema<IOrder> = new Schema({
  // userId is optional - null for guest orders
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false, // Optional - allows guest orders
    default: null
  },
  orderNumber: {
    type: String,
    unique: true,
    sparse: true,
    index: true
  },
  customerDetails: {
    type: Object,
    required: true
  },
  items: [{
    productId: String,
    name: String,
    price: Number,
    quantity: Number,
    category: String,
    selectedOption: {
      label: String,
      amount: String,
      price: Number,
      optionId: String,
      optionName: String,
      valueId: String,
      valueName: String,
      quantity: Number,
      priceAdjustment: Number,
      missingForReview: Boolean
    },
    imageUrl: String,
    description: String
  }],
  totalPrice: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: [
      'pending',
      'processing',
      'ready',
      'cancelled',
      'new',
      'in-progress',
      'out_for_delivery',
      'delivery_failed',
      'delivered'
    ],
    default: 'pending'
  },
  isDeleted: {
    type: Boolean,
    default: false,
    index: true
  },
  orderType: {
    type: String,
    enum: ['shabbat', 'catering'],
    required: false
  },
  numberOfPortions: { type: Schema.Types.Mixed, required: false },
  portionsEvening: { type: Number, required: false, min: 0 },
  portionsMorning: { type: Number, required: false, min: 0 },
  mealTime: { type: String, required: false },
  mealTypes: { type: String, required: false },
  subtotal: { type: Number, default: null },
  deliveryFee: { type: Number, default: null },
  cateringKind: { type: String, enum: ['shabbat', 'events'], required: false, index: true },
  eventType: { type: String, required: false },
  guestCount: { type: Number, required: false },
  venue: { type: String, required: false },
  marketingData: {
    utm_source: { type: String, trim: true },
    utm_medium: { type: String, trim: true },
    utm_campaign: { type: String, trim: true },
    utm_term: { type: String, trim: true },
    utm_content: { type: String, trim: true }
  },
  assignedDriverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true
  },
  assignedDriverName: {
    type: String,
    trim: true,
    default: ''
  },
  assignedAt: {
    type: Date,
    default: null
  },
  // ── Payment pipeline ────────────────────────────────────────────────────────
  paymentStatus: {
    type: String,
    enum: ['pending', 'awaiting_payment', 'authorized', 'captured', 'voided', 'failed'],
    default: 'pending',
    index: true
  },
  authCode:      { type: String, required: false, trim: true, select: false },
  transactionId: { type: String, required: false, trim: true },
  cardToken:     { type: String, required: false, trim: true, select: false },
  expireMonth:   { type: Number, required: false, select: false },
  expireYear:    { type: Number, required: false, select: false },
  authorizedAmount: { type: Number, required: false, default: null },
  adminPriceOverride: { type: Number, required: false, default: null },
  adminPriceOverrideReason: { type: String, required: false, trim: true, maxlength: 500, default: null },
  priceOverriddenAt: { type: Date, required: false, default: null },
  priceOverriddenBy: { type: String, required: false, trim: true, default: null },
  paymentExceptionResolvedAt: { type: Date, required: false, default: null, index: true },
  paymentExceptionResolvedBy: { type: String, required: false, trim: true, default: null },
  paymentExceptionResolution: { type: String, required: false, trim: true, default: null },
  paymentExceptionNote: { type: String, required: false, trim: true, maxlength: 500, default: null },
  paymentAwaitingStartedAt: { type: Date, required: false, default: null, index: true },
  paymentFailedAt: { type: Date, required: false, default: null, index: true },
  manualPaymentRecordedAt: { type: Date, required: false, default: null },
  manualPaymentRecordedBy: { type: String, required: false, trim: true, default: null },
  manualPaymentMethod: { type: String, required: false, trim: true, maxlength: 120, default: null },
  manualPaymentNote: { type: String, required: false, trim: true, maxlength: 500, default: null },
  readyAt: { type: Date, required: false, default: null },
  completedAt: { type: Date, required: false, default: null },
  cancelledAt: { type: Date, required: false, default: null },
  paidAt: { type: Date, required: false, default: null },
  capturedAt: { type: Date, required: false, default: null },
  serviceDate: { type: Date, required: false, default: null },
  statusChangeHistory: [
    {
      previousStatus: { type: String, required: true },
      newStatus: { type: String, required: true },
      previousPaymentStatus: { type: String, required: false, default: null },
      paymentExceptionResolution: { type: String, required: false, default: null },
      changedBy: { type: String, required: true, trim: true },
      changedAt: { type: Date, required: true, default: Date.now },
      notificationSent: { type: Boolean, required: true, default: false }
    }
  ],
  adminNotes: { type: String, trim: true, default: '', maxlength: 1000 },
  salads: [{ type: String, trim: true }],
  firstCourses: [{ type: String, trim: true }],
  mainCourses: [{ type: String, trim: true }],
  firstCoursesEvening: [{ type: String, trim: true }],
  firstCoursesMorning: [{ type: String, trim: true }],
  mainCoursesEvening: [{ type: String, trim: true }],
  mainCoursesMorning: [{ type: String, trim: true }],
  sidesEvening: [{ type: String, trim: true }],
  sidesMorning: [{ type: String, trim: true }],
  paymentSecurityToken: { type: String, required: false, select: false }, // excluded from default queries
  paymentInitTokenHash: { type: String, required: false, select: false },
  paymentInitTokenExpiresAt: { type: Date, required: false, select: false },
  confirmationEmailSentAt: { type: Date, required: false, default: null },
  /** Admin-marked test/QA order — never controllable via public create/payment. */
  isTestOrder: {
    type: Boolean,
    default: false,
    index: true
  },
  /** Local kitchen-report demo seed only — never set on real customer orders. */
  isDemo: {
    type: Boolean,
    default: false,
    index: true
  },
  demoBatchId: {
    type: String,
    trim: true,
    maxlength: 80,
    sparse: true,
    index: true
  },
  kitchenPreparationAt: {
    type: Date,
    required: false,
    default: null,
    index: true
  },
  allergies: {
    type: String,
    trim: true,
    default: '',
    maxlength: 500
  },
  specialRequests: {
    type: String,
    trim: true,
    default: '',
    maxlength: 1000
  },
  kitchenChangeLog: {
    type: [
      {
        at: { type: Date, required: true },
        type: { type: String, required: true, trim: true },
        summary: { type: String, required: true, trim: true, maxlength: 300 },
        by: { type: String, required: false, trim: true, maxlength: 120 },
        previousValue: { type: String, required: false, trim: true, maxlength: 500 },
        newValue: { type: String, required: false, trim: true, maxlength: 500 }
      }
    ],
    default: undefined,
    select: true
  },
  lastKitchenPrintAt: {
    type: Date,
    required: false,
    default: null,
    index: true
  },
  lastKitchenPrintSnapshot: {
    type: String,
    required: false,
    default: null,
    trim: true,
    maxlength: 120
  }
}, {
  timestamps: true,
  collection: 'orders',
  strict: true // Ensure strict mode - only save fields defined in schema
});

// Indexes for better query performance
OrderSchema.index({ userId: 1 });
OrderSchema.index({ status: 1, createdAt: -1 });
OrderSchema.index({ createdAt: -1 });
OrderSchema.index({ orderType: 1 });
OrderSchema.index({ 'customerDetails.eventDate': 1, status: 1, isDeleted: 1 });

// Create and export the model
const Order: Model<IOrder> = mongoose.model<IOrder>('Order', OrderSchema);

export default Order;
