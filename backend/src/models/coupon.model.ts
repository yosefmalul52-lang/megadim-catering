import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ICoupon extends Document {
  code: string;
  discountType: 'percentage' | 'fixedAmount';
  discountValue: number;
  minOrderValue: number;
  expiresAt: Date | null;
  maxUses: number | null;
  maxUsesPerCustomer: number;
  usageCount: number;
  usedByPhones: string[];
  totalRevenueGenerated: number;
  isActive: boolean;
  isVipOnly: boolean;
  targetCustomerCategory: 'all' | 'returning' | 'sleeping' | 'vip' | 'new';
  createdAt?: Date;
  updatedAt?: Date;
}

const CouponSchema: Schema<ICoupon> = new Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true
    },
    discountType: {
      type: String,
      enum: ['percentage', 'fixedAmount'],
      required: true
    },
    discountValue: {
      type: Number,
      required: true
    },
    minOrderValue: {
      type: Number,
      default: 0
    },
    expiresAt: {
      type: Date,
      default: null
    },
    maxUses: {
      type: Number,
      default: null
    },
    maxUsesPerCustomer: {
      type: Number,
      default: 1
    },
    usageCount: {
      type: Number,
      default: 0
    },
    usedByPhones: {
      type: [String],
      default: []
    },
    isActive: {
      type: Boolean,
      default: true
    },
    totalRevenueGenerated: {
      type: Number,
      default: 0
    },
    isVipOnly: {
      type: Boolean,
      default: false
    },
    targetCustomerCategory: {
      type: String,
      enum: ['all', 'returning', 'sleeping', 'vip', 'new'],
      default: 'all'
    }
  },
  { timestamps: true, collection: 'coupons' }
);

CouponSchema.index({ code: 1 });
CouponSchema.index({ isActive: 1, expiresAt: 1 });
CouponSchema.index({ usedByPhones: 1 });

const Coupon: Model<ICoupon> = mongoose.model<ICoupon>('Coupon', CouponSchema);
export default Coupon;
