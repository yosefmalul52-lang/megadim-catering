import mongoose, { Schema, Document, Model } from 'mongoose';

export type ContactStatus = 'new' | 'read' | 'handled';

export interface IContact extends Document {
  name: string;
  email: string;
  phone: string;
  message: string;
  status: ContactStatus;
  /** Origin of the lead (e.g. website). */
  source?: string;
  /** Admin notes when updating status. */
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ContactSchema = new Schema<IContact>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true
    },
    phone: {
      type: String,
      required: true,
      trim: true
    },
    message: {
      type: String,
      required: true,
      trim: true
    },
    status: {
      type: String,
      enum: ['new', 'read', 'handled'],
      default: 'new',
      index: true
    },
    source: {
      type: String,
      trim: true,
      default: 'website'
    },
    notes: {
      type: String,
      trim: true
    }
  },
  {
    timestamps: true,
    collection: 'contacts'
  }
);

ContactSchema.index({ createdAt: -1 });

export default (mongoose.models.Contact as Model<IContact>) ||
  mongoose.model<IContact>('Contact', ContactSchema);
