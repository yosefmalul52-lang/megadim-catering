import mongoose, { Document, Schema } from 'mongoose';

export const POPUP_TEMPLATES = ['info', 'promo', 'ops', 'urgent'] as const;
export type PopupTemplate = (typeof POPUP_TEMPLATES)[number];

export const POPUP_PLACEMENTS = ['modal', 'banner_top', 'sticky_bottom'] as const;
export type PopupPlacement = (typeof POPUP_PLACEMENTS)[number];

export const POPUP_STATUSES = ['draft', 'active', 'disabled'] as const;
export type PopupStatus = (typeof POPUP_STATUSES)[number];

export const POPUP_FREQUENCIES = ['every', 'session', 'once', 'max'] as const;
export type PopupFrequency = (typeof POPUP_FREQUENCIES)[number];

/** Public site page keys a popup can target. */
export const POPUP_PAGE_IDS = [
  'home',
  'events',
  'holiday',
  'cholent',
  'ready_for_shabbat',
  'salads',
  'fish',
  'desserts',
  'contact',
  'cart',
  'checkout',
  'about',
  'kosher'
] as const;
export type PopupPageId = (typeof POPUP_PAGE_IDS)[number];

export interface IPopupLocaleContent {
  title?: string;
  body?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  imageUrl?: string;
}

export interface ISitePopup extends Document {
  internalName: string;
  status: PopupStatus;
  template: PopupTemplate;
  placement: PopupPlacement;
  /** Empty array means site-wide (`all`). */
  pageTargets: PopupPageId[];
  targetAllPages: boolean;
  priority: number;
  startAt?: Date | null;
  endAt?: Date | null;
  frequency: PopupFrequency;
  maxViews?: number | null;
  content: {
    he: IPopupLocaleContent;
    en: IPopupLocaleContent;
  };
  createdAt?: Date;
  updatedAt?: Date;
}

const LocaleContentSchema = new Schema<IPopupLocaleContent>(
  {
    title: { type: String, default: '', trim: true },
    body: { type: String, default: '', trim: true },
    ctaLabel: { type: String, default: '', trim: true },
    ctaUrl: { type: String, default: '', trim: true },
    imageUrl: { type: String, default: '', trim: true }
  },
  { _id: false }
);

const SitePopupSchema = new Schema<ISitePopup>(
  {
    internalName: { type: String, required: true, trim: true },
    status: { type: String, enum: POPUP_STATUSES, default: 'draft', index: true },
    template: { type: String, enum: POPUP_TEMPLATES, default: 'info' },
    placement: { type: String, enum: POPUP_PLACEMENTS, default: 'modal', index: true },
    pageTargets: {
      type: [{ type: String, enum: POPUP_PAGE_IDS }],
      default: []
    },
    targetAllPages: { type: Boolean, default: true },
    priority: { type: Number, default: 0, index: true },
    startAt: { type: Date, default: null },
    endAt: { type: Date, default: null },
    frequency: { type: String, enum: POPUP_FREQUENCIES, default: 'session' },
    maxViews: { type: Number, default: null, min: 1 },
    content: {
      he: { type: LocaleContentSchema, default: () => ({}) },
      en: { type: LocaleContentSchema, default: () => ({}) }
    }
  },
  {
    collection: 'site_popups',
    timestamps: true
  }
);

SitePopupSchema.index({ status: 1, placement: 1, priority: -1 });

export const SitePopup = mongoose.model<ISitePopup>('SitePopup', SitePopupSchema);
export default SitePopup;
