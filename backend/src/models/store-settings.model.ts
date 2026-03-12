import mongoose from 'mongoose';

const storeSettingsSchema = new mongoose.Schema(
  {
    freeShippingThreshold: { type: Number, default: 500 },
    isFreeShippingActive: { type: Boolean, default: false },
    baseDeliveryFee: { type: Number, default: 25 },
    pricePerKm: { type: Number, default: 3 },
    /** Specific dates open for orders; format 'YYYY-MM-DD' */
    openDates: { type: [String], default: [] },
    minimumLeadDays: { type: Number, default: 2 } // Earliest order date = today + this many days
  },
  { timestamps: true, collection: 'store_settings' }
);

export interface IStoreSettings {
  freeShippingThreshold: number;
  isFreeShippingActive: boolean;
  baseDeliveryFee: number;
  pricePerKm: number;
  /** Dates open for orders; format 'YYYY-MM-DD' */
  openDates: string[];
  minimumLeadDays: number;
}

const StoreSettings =
  mongoose.models.StoreSettings || mongoose.model<IStoreSettings & mongoose.Document>('StoreSettings', storeSettingsSchema);

export default StoreSettings;
