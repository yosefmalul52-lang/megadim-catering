import mongoose, { Document, Schema } from 'mongoose';

export interface IEventsCateringCatalog extends Document {
  key: string;
  basePrice: number;
  baseTitle: string;
  baseIncludes: string[];
  firstCourseUpgradePrice: number;
  firstCourseUpgradeTitle: string;
  dessertsUpgradePrice: number;
  dessertsUpgradeTitle: string;
  kosherUpgradePrice: number;
  receptionTiers: Array<{
    id: 'regular' | 'upgraded';
    backendId: 'standard' | 'premium';
    title: string;
    pricePerPortion: number;
    stations: number;
    features: string[];
  }>;
  saladOptions: string[];
  firstCourseOptions: string[];
  mainCourseOptions: string[];
  sideDishOptions: string[];
  saladSlotCount: number;
  mainCourseSlotCount: number;
  sideSlotCount: number;
  firstCourseSlotCount: number;
  updatedAt?: Date;
  createdAt?: Date;
}

const ReceptionTierSchema = new Schema(
  {
    id: { type: String, enum: ['regular', 'upgraded'], required: true },
    backendId: { type: String, enum: ['standard', 'premium'], required: true },
    title: { type: String, required: true, trim: true },
    pricePerPortion: { type: Number, required: true, min: 0 },
    stations: { type: Number, required: true, min: 1 },
    features: { type: [String], default: [] }
  },
  { _id: false }
);

const EventsCateringCatalogSchema = new Schema<IEventsCateringCatalog>(
  {
    key: { type: String, required: true, unique: true, default: 'default', index: true },
    basePrice: { type: Number, required: true, min: 0, default: 70 },
    baseTitle: { type: String, required: true, trim: true, default: 'תפריט בסיסי לאירוע' },
    baseIncludes: { type: [String], default: [] },
    firstCourseUpgradePrice: { type: Number, required: true, min: 0, default: 20 },
    firstCourseUpgradeTitle: { type: String, trim: true, default: 'תוספת מנה ראשונה' },
    dessertsUpgradePrice: { type: Number, required: true, min: 0, default: 8 },
    dessertsUpgradeTitle: { type: String, trim: true, default: 'תוספת קינוחים' },
    kosherUpgradePrice: { type: Number, required: true, min: 0, default: 7 },
    receptionTiers: { type: [ReceptionTierSchema], default: [] },
    saladOptions: { type: [String], default: [] },
    firstCourseOptions: { type: [String], default: [] },
    mainCourseOptions: { type: [String], default: [] },
    sideDishOptions: { type: [String], default: [] },
    saladSlotCount: { type: Number, default: 8, min: 1 },
    mainCourseSlotCount: { type: Number, default: 2, min: 1 },
    sideSlotCount: { type: Number, default: 3, min: 1 },
    firstCourseSlotCount: { type: Number, default: 2, min: 1 }
  },
  { timestamps: true, collection: 'events_catering_catalog' }
);

export default mongoose.model<IEventsCateringCatalog>(
  'EventsCateringCatalog',
  EventsCateringCatalogSchema
);
