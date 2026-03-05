import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Single-document global store settings (shipping, delivery, etc.).
 * One document per store.
 */
export interface ISetting extends Document {
  freeShippingThreshold: number;
  baseDeliveryFee: number;
  pricePerKm: number;
  createdAt?: Date;
  updatedAt?: Date;
}

const settingSchema = new Schema<ISetting>(
  {
    freeShippingThreshold: { type: Number, default: 0 },
    baseDeliveryFee: { type: Number, default: 0 },
    pricePerKm: { type: Number, default: 0 }
  },
  { timestamps: true, collection: 'settings' }
);

const Setting: Model<ISetting> =
  mongoose.models.Setting || mongoose.model<ISetting>('Setting', settingSchema);

export default Setting;
