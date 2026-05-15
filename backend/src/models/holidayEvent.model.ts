import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export type HolidayProductPricingType = 'fixed' | 'variants';
export type HolidayProductWeightUnit = 'unit' | '100g';

export interface IHolidayPricingOption {
  label: string;
  amount: string;
  price: number;
}

/** Embedded product — not linked to MenuItem collection. */
export interface IHolidayEventProduct {
  _id: Types.ObjectId;
  title: string;
  price: number;
  description: string;
  imageUrl: string;
  isAvailable: boolean;
  pricingType: HolidayProductPricingType;
  weightUnit: HolidayProductWeightUnit;
  pricingOptions: IHolidayPricingOption[];
}

export interface IHolidayEvent extends Document {
  name: string;
  isActive: boolean;
  orderDeadline: Date;
  /** Dedicated hero / Bento banner image for the event */
  imageUrl?: string;
  products: IHolidayEventProduct[];
  createdAt?: Date;
  updatedAt?: Date;
}

const HolidayPricingOptionSchema = new Schema<IHolidayPricingOption>(
  {
    label: { type: String, required: true, trim: true },
    amount: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 }
  },
  { _id: false }
);

const HolidayEventProductSchema = new Schema<IHolidayEventProduct>(
  {
    title: { type: String, required: true, trim: true },
    price: { type: Number, default: 0, min: 0 },
    description: { type: String, default: '', trim: true },
    imageUrl: { type: String, default: '', trim: true },
    isAvailable: { type: Boolean, default: true },
    pricingType: {
      type: String,
      enum: ['fixed', 'variants'],
      default: 'fixed'
    },
    weightUnit: {
      type: String,
      enum: ['unit', '100g'],
      default: 'unit'
    },
    pricingOptions: { type: [HolidayPricingOptionSchema], default: [] }
  },
  { _id: true }
);

const HolidayEventSchema = new Schema<IHolidayEvent>(
  {
    name: { type: String, required: true, trim: true },
    isActive: { type: Boolean, default: false },
    orderDeadline: { type: Date, required: true },
    imageUrl: { type: String, default: '', trim: true },
    products: { type: [HolidayEventProductSchema], default: [] }
  },
  { timestamps: true, collection: 'holidayEvents' }
);

HolidayEventSchema.index({ isActive: 1, orderDeadline: 1 });

if (mongoose.models.HolidayEvent) {
  delete mongoose.models.HolidayEvent;
}

const HolidayEvent: Model<IHolidayEvent> = mongoose.model<IHolidayEvent>(
  'HolidayEvent',
  HolidayEventSchema
);

export default HolidayEvent;
