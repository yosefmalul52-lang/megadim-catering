import mongoose, { Schema, Document } from 'mongoose';

export interface IDeliveryPricing extends Document {
  minDistanceKm: number;
  maxDistanceKm: number;
  price: number;
  isActive: boolean;
  /** Optional per-tier free shipping threshold (₪). Overrides global threshold when set. */
  freeShippingThreshold?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

const DeliveryPricingSchema = new Schema<IDeliveryPricing>(
  {
    minDistanceKm: { type: Number, required: true },
    maxDistanceKm: { type: Number, required: true },
    price: { type: Number, required: true },
    freeShippingThreshold: { type: Number, required: false, default: null },
    isActive: { type: Boolean, default: true }
  },
  {
    timestamps: true,
    collection: 'delivery_pricing'
  }
);

// Index for efficient range queries
DeliveryPricingSchema.index({ minDistanceKm: 1, maxDistanceKm: 1 });
DeliveryPricingSchema.index({ isActive: 1 });

const DeliveryPricing = mongoose.model<IDeliveryPricing>('DeliveryPricing', DeliveryPricingSchema);

export default DeliveryPricing;
