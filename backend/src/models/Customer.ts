import mongoose, { Schema, Document, Model } from 'mongoose';

export type CustomerManualStatus = 'NONE' | 'VIP' | 'BLACKLIST';
export type CustomerCategory = 'all' | 'returning' | 'sleeping' | 'vip' | 'registered';

export interface ICustomer extends Document {
  normalizedPhone: string;
  fullName?: string;
  email?: string;
  address?: string;
  city?: string;
  totalSpent: number;
  orderCount: number;
  lastOrderDate?: Date | null;
  orderHistory: mongoose.Types.ObjectId[];
  manualStatus: CustomerManualStatus;
  customerCategory: CustomerCategory;
  tags: string[];
  adminNotes?: string;
  dietaryInfo?: string;
  /** True when a User account exists for this normalized phone (set during migrate / sync). */
  isRegistered?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

const CustomerSchema: Schema<ICustomer> = new Schema(
  {
    normalizedPhone: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true
    },
    fullName: {
      type: String,
      trim: true
    },
    email: {
      type: String,
      trim: true,
      lowercase: true
    },
    address: {
      type: String,
      trim: true,
      default: ''
    },
    city: {
      type: String,
      trim: true,
      default: '',
      index: true
    },
    totalSpent: {
      type: Number,
      default: 0
    },
    orderCount: {
      type: Number,
      default: 0
    },
    lastOrderDate: {
      type: Date,
      default: null
    },
    orderHistory: {
      type: [{ type: Schema.Types.ObjectId, ref: 'Order' }],
      default: []
    },
    manualStatus: {
      type: String,
      enum: ['NONE', 'VIP', 'BLACKLIST'],
      default: 'NONE',
      index: true
    },
    customerCategory: {
      type: String,
      enum: ['all', 'returning', 'sleeping', 'vip', 'registered'],
      default: 'all',
      index: true
    },
    tags: {
      type: [String],
      default: []
    },
    adminNotes: {
      type: String,
      default: ''
    },
    dietaryInfo: {
      type: String,
      default: ''
    },
    isRegistered: {
      type: Boolean,
      default: false,
      index: true
    }
  },
  {
    timestamps: true,
    collection: 'customers'
  }
);

CustomerSchema.index({ normalizedPhone: 1 }, { unique: true });
CustomerSchema.index({ manualStatus: 1, updatedAt: -1 });
CustomerSchema.index({ customerCategory: 1, updatedAt: -1 });

const Customer: Model<ICustomer> =
  (mongoose.models.Customer as Model<ICustomer>) ||
  mongoose.model<ICustomer>('Customer', CustomerSchema);

export default Customer;
