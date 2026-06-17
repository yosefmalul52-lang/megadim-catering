import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IInstitutionOrderDay {
  dayOfWeek: number;
  regularCount: number;
  vegetarianCount: number;
  notes: string;
}

export interface IInstitutionOrder extends Document {
  institutionId: mongoose.Types.ObjectId;
  /** Canonical Sunday of the week — YYYY-MM-DD (timezone-agnostic). */
  weekStartDate: string;
  isLocked: boolean;
  days: IInstitutionOrderDay[];
  createdAt?: Date;
  updatedAt?: Date;
}

const InstitutionOrderDaySchema = new Schema<IInstitutionOrderDay>(
  {
    dayOfWeek: { type: Number, required: true, min: 0, max: 6 },
    regularCount: { type: Number, default: 0, min: 0 },
    vegetarianCount: { type: Number, default: 0, min: 0 },
    notes: { type: String, trim: true, default: '' }
  },
  { _id: false }
);

const InstitutionOrderSchema = new Schema<IInstitutionOrder>(
  {
    institutionId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    weekStartDate: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
      index: true
    },
    isLocked: { type: Boolean, default: false },
    days: {
      type: [InstitutionOrderDaySchema],
      default: []
    }
  },
  {
    timestamps: true,
    collection: 'institutionorders'
  }
);

InstitutionOrderSchema.index({ institutionId: 1, weekStartDate: 1 }, { unique: true });

const InstitutionOrder: Model<IInstitutionOrder> =
  (mongoose.models.InstitutionOrder as Model<IInstitutionOrder>) ||
  mongoose.model<IInstitutionOrder>('InstitutionOrder', InstitutionOrderSchema);

export default InstitutionOrder;
