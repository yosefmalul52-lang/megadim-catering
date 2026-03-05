import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ICoupon extends Document {
  code: string;
  discountType: 'percentage' | 'fixedAmount';
  discountValue: number;
  minOrderValue: number;
  expiryDate: Date;
  maxUses: number;
  currentUses: number;
  isActive: boolean;
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
    expiryDate: {
      type: Date,
      required: true
    },
    maxUses: {
      type: Number,
      required: true
    },
    currentUses: {
      type: Number,
      default: 0
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true, collection: 'coupons' }
);

CouponSchema.index({ code: 1 });
CouponSchema.index({ isActive: 1, expiryDate: 1 });

const Coupon: Model<ICoupon> = mongoose.model<ICoupon>('Coupon', CouponSchema);
export default Coupon;
