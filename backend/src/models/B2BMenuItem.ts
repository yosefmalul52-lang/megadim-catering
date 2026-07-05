import mongoose, { Schema, Document, Model } from 'mongoose';
import {
  B2B_CALCULATION_METHODS,
  B2B_REPORT_UNITS,
  B2B_ROUNDING_MODES,
  type B2BCalculationSettings
} from '../utils/b2b-calculation-settings';

export const B2B_DICTIONARY_CATEGORIES = [
  'mainMeat',
  'vegetarianMain',
  'carb',
  'side',
  'saladFruit',
  'fish'
] as const;
export type B2BDictionaryCategory = (typeof B2B_DICTIONARY_CATEGORIES)[number];

export interface IB2BMenuItem extends Document {
  name: string;
  category: B2BDictionaryCategory;
  gramsPerPortion: number;
  portionsPerGastronorm: number;
  calculationSettings?: B2BCalculationSettings;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

const CalculationSettingsSchema = new Schema<B2BCalculationSettings>(
  {
    enabled: { type: Boolean, default: false },
    reportUnit: { type: String, enum: B2B_REPORT_UNITS },
    calculationMethod: { type: String, enum: B2B_CALCULATION_METHODS },
    quantityPerPortion: { type: Number, min: 0 },
    quantityPerOrder: { type: Number, min: 0 },
    quantityPerXPortions: { type: Number, min: 0 },
    xPortions: { type: Number, min: 0 },
    rounding: { type: String, enum: B2B_ROUNDING_MODES, default: 'none' },
    minimumQuantity: { type: Number, min: 0 }
  },
  { _id: false }
);

const B2BMenuItemSchema = new Schema<IB2BMenuItem>(
  {
    name: { type: String, required: true, trim: true },
    category: {
      type: String,
      required: true,
      enum: B2B_DICTIONARY_CATEGORIES
    },
    gramsPerPortion: { type: Number, default: 200, min: 1 },
    portionsPerGastronorm: { type: Number, default: 40, min: 1 },
    calculationSettings: { type: CalculationSettingsSchema, required: false },
    isActive: { type: Boolean, default: true, index: true }
  },
  {
    timestamps: true,
    collection: 'b2bmenuitems'
  }
);

B2BMenuItemSchema.index({ category: 1, name: 1 }, { unique: true });

const B2BMenuItem: Model<IB2BMenuItem> =
  (mongoose.models.B2BMenuItem as Model<IB2BMenuItem>) ||
  mongoose.model<IB2BMenuItem>('B2BMenuItem', B2BMenuItemSchema);

export default B2BMenuItem;
