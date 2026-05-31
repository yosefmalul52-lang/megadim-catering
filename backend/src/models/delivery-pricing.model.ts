import mongoose, { Schema, Document } from 'mongoose';

export interface IDeliveryPricing extends Document {
  minDistanceKm: number;
  maxDistanceKm: number;
  price: number;
  isActive: boolean;
  /** Optional per-tier free shipping threshold (₪). Overrides global threshold when set. */
  freeShippingThreshold?: number;
  /** Optional minimum cart total (₪) required to allow delivery for this tier. */
  minOrderForDelivery?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

const DeliveryPricingSchema = new Schema<IDeliveryPricing>(
  {
    minDistanceKm: {
      type: Number,
      required: true,
      min: [0, 'minDistanceKm must be a non-negative number'],
      validate: {
        validator: Number.isFinite,
        message: 'minDistanceKm must be a valid number'
      }
    },
    maxDistanceKm: {
      type: Number,
      required: true,
      min: [0, 'maxDistanceKm must be a non-negative number'],
      validate: {
        validator: Number.isFinite,
        message: 'maxDistanceKm must be a valid number'
      }
    },
    price: {
      type: Number,
      required: true,
      min: [0, 'price must be a non-negative number'],
      validate: {
        validator: Number.isFinite,
        message: 'price must be a valid number'
      }
    },
    freeShippingThreshold: { type: Number, required: false, default: null },
    minOrderForDelivery: { type: Number, required: false, default: null },
    isActive: { type: Boolean, default: true }
  },
  {
    timestamps: true,
    collection: 'delivery_pricing'
  }
);

DeliveryPricingSchema.path('maxDistanceKm').validate(function (this: IDeliveryPricing, value: number) {
  return typeof this.minDistanceKm === 'number' ? value >= this.minDistanceKm : true;
}, 'maxDistanceKm must be greater than or equal to minDistanceKm');

// Index for efficient range queries
DeliveryPricingSchema.index({ minDistanceKm: 1, maxDistanceKm: 1 });
DeliveryPricingSchema.index({ isActive: 1 });

const DeliveryPricing = mongoose.model<IDeliveryPricing>('DeliveryPricing', DeliveryPricingSchema);

export default DeliveryPricing;
