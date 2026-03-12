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
  mealTime?: string;
  mealTypes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

// Order Schema - userId MUST be at root level
const OrderSchema: Schema<IOrder> = new Schema({
  // userId is optional - null for guest orders
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false, // Optional - allows guest orders
    default: null,
    index: true
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
    enum: ['pending', 'processing', 'ready', 'cancelled', 'new', 'in-progress', 'delivered'],
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
    required: false,
    index: true
  },
  numberOfPortions: { type: Schema.Types.Mixed, required: false },
  mealTime: { type: String, required: false },
  mealTypes: { type: String, required: false }
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
