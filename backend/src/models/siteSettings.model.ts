import mongoose, { Schema, Document } from 'mongoose';

export interface IPageAnnouncement {
  bannerText?: string;
  popupTitle?: string;
  popupText?: string;
  popupLinkText?: string;
  popupLinkUrl?: string;
}

export type PageId = 'home' | 'events' | 'holiday' | 'cholent' | 'salads' | 'fish' | 'desserts';

export const PAGE_IDS: PageId[] = ['home', 'events', 'holiday', 'cholent', 'salads', 'fish', 'desserts'];

function defaultPageAnnouncements(): Record<string, IPageAnnouncement> {
  const out: Record<string, IPageAnnouncement> = {};
  for (const id of PAGE_IDS) {
    out[id] = { bannerText: '', popupTitle: '', popupText: '', popupLinkText: '', popupLinkUrl: '' };
  }
  return out;
}

export interface ISiteSettings extends Document {
  shabbatMenuUrl: string;
  eventsMenuUrl: string;
  contactPhone?: string;
  orderEmail?: string;
  whatsappLink?: string;
  cholentForceOpen?: boolean;
  cholentCustomMessage?: string;
  cholentClosedMessage?: string;
  pageAnnouncements?: Record<string, IPageAnnouncement>;
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
      default: '0528240230',
      trim: true,
      required: false
    },
    orderEmail: {
      type: String,
      default: 'yosefmalul52@gmail.com',
      trim: true,
      required: false
    },
    whatsappLink: {
      type: String,
      trim: true,
      required: false
    },
    cholentForceOpen: {
      type: Boolean,
      default: false
    },
    cholentCustomMessage: {
      type: String,
      default: '',
      trim: true
    },
    cholentClosedMessage: {
      type: String,
      default: 'ההזמנות נפתחות ביום חמישי בין השעות 09:00 ל-17:00',
      trim: true
    },
    pageAnnouncements: {
      type: Schema.Types.Mixed,
      default: defaultPageAnnouncements
    }
  },
  {
    collection: 'site_settings',
    timestamps: true,
    strict: false // MUST BE FALSE – allows new fields (e.g. popupLinkText) to be saved without being stripped
  }
);

const SiteSettings = mongoose.model<ISiteSettings>('SiteSettings', SiteSettingsSchema);

export default SiteSettings;
