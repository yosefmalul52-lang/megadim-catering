import mongoose, { Schema, Document } from 'mongoose';

export interface IDeliveryCityOverride extends Document {
  cityName: string;       // normalized for matching (e.g. lowercase, trimmed)
  displayName: string;   // human-readable (e.g. "ירושלים")
  overridePrice: number;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

const DeliveryCityOverrideSchema = new Schema<IDeliveryCityOverride>(
  {
    cityName: { type: String, required: true, trim: true },
    displayName: { type: String, required: true, trim: true },
    overridePrice: { type: Number, required: true },
    isActive: { type: Boolean, default: true }
  },
  {
    timestamps: true,
    collection: 'delivery_city_overrides'
  }
);

DeliveryCityOverrideSchema.index({ cityName: 1 });
DeliveryCityOverrideSchema.index({ isActive: 1 });

const DeliveryCityOverride = mongoose.model<IDeliveryCityOverride>(
  'DeliveryCityOverride',
  DeliveryCityOverrideSchema
);

export default DeliveryCityOverride;
