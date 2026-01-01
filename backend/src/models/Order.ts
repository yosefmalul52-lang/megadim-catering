import mongoose, { Schema, Document, Model } from 'mongoose';

// Order Interface - userId is optional (for guest orders)
export interface IOrder extends Document {
  userId?: mongoose.Types.ObjectId | null; // Optional - null for guest orders
  customerDetails: any;
  items: any[];
  totalPrice: number;
  status: string;
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
    enum: ['new', 'in-progress', 'ready', 'delivered', 'cancelled'],
    default: 'new'
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

// Create and export the model
const Order: Model<IOrder> = mongoose.model<IOrder>('Order', OrderSchema);

export default Order;
