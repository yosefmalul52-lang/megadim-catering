import mongoose, { Schema, Document, Model, Types } from 'mongoose';

/** Embedded product — not linked to MenuItem collection. */
export interface IHolidayEventProduct {
  _id: Types.ObjectId;
  title: string;
  price: number;
  description: string;
  imageUrl: string;
  isAvailable: boolean;
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

const HolidayEventProductSchema = new Schema<IHolidayEventProduct>(
  {
    title: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    description: { type: String, default: '', trim: true },
    imageUrl: { type: String, default: '', trim: true },
    isAvailable: { type: Boolean, default: true }
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

// Ensure schema changes (e.g. imageUrl) apply after hot-reload in dev
if (mongoose.models.HolidayEvent) {
  delete mongoose.models.HolidayEvent;
}

const HolidayEvent: Model<IHolidayEvent> = mongoose.model<IHolidayEvent>(
  'HolidayEvent',
  HolidayEventSchema
);

export default HolidayEvent;
