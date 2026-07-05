import mongoose from 'mongoose';

/**
 * Global store settings only. Distance tiers (with per-tier freeShippingThreshold)
 * live in the DeliveryPricing collection; see delivery-pricing.model.ts.
 */
const storeSettingsSchema = new mongoose.Schema(
  {
    freeShippingThreshold: { type: Number, default: 500 },
    isFreeShippingActive: { type: Boolean, default: false },
    baseDeliveryFee: { type: Number, default: 25 },
    pricePerKm: { type: Number, default: 3 },
    /** Specific dates open for orders; format 'YYYY-MM-DD' */
    openDates: { type: [String], default: [] },
    /** Per-date order cutoff times; date YYYY-MM-DD, cutoffTime HH:mm (Israel). */
    openDateRules: {
      type: [
        {
          date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
          cutoffTime: { type: String, required: true, default: '23:59' }
        }
      ],
      default: []
    },
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
  /** Per-date cutoff times for orders */
  openDateRules?: Array<{ date: string; cutoffTime: string }>;
  minimumLeadDays: number;
}

const StoreSettings =
  mongoose.models.StoreSettings || mongoose.model<IStoreSettings & mongoose.Document>('StoreSettings', storeSettingsSchema);

export default StoreSettings;
