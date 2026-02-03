import mongoose, { Schema, Document } from 'mongoose';

export interface ISiteSettings extends Document {
  shabbatMenuUrl: string;
  eventsMenuUrl: string;
  contactPhone?: string;
  whatsappLink?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const SiteSettingsSchema = new Schema<ISiteSettings>(
  {
    shabbatMenuUrl: {
      type: String,
      default: '',
      trim: true
    },
    eventsMenuUrl: {
      type: String,
      default: '',
      trim: true
    },
    contactPhone: {
      type: String,
      trim: true,
      required: false
    },
    whatsappLink: {
      type: String,
      trim: true,
      required: false
    }
  },
  {
    timestamps: true,
    collection: 'site_settings'
  }
);

// Note: Singleton pattern is handled in the service layer
// The service always uses findOne() to get the single settings document

// Export the model
const SiteSettings = mongoose.model<ISiteSettings>('SiteSettings', SiteSettingsSchema);

export default SiteSettings;

