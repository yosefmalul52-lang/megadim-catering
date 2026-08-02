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
      price: Number
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

// Create and export the model
const Order: Model<IOrder> = mongoose.model<IOrder>('Order', OrderSchema);

export default Order;
