import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IExternalInvoice extends Document {
  invoiceNumber?: string;
  clientName:    string;
  amount:        number;
  issueDate:     Date;
  description?:  string;
  fileUrl?:      string;
  fileKey?:      string;
}

const ExternalInvoiceSchema: Schema<IExternalInvoice> = new Schema(
  {
    invoiceNumber: { type: String, trim: true },
    clientName:    { type: String, required: true, trim: true },
    amount:        { type: Number, required: true },
    issueDate:     { type: Date, required: true, default: Date.now },
    description:   { type: String, trim: true },
    fileUrl:       { type: String, trim: true },
    fileKey:       { type: String, trim: true }
  },
  {
    timestamps: true,
    collection: 'external_invoices'
  }
);

ExternalInvoiceSchema.index({ issueDate: -1 });
ExternalInvoiceSchema.index({ clientName: 1 });

const ExternalInvoice: Model<IExternalInvoice> = mongoose.model<IExternalInvoice>(
  'ExternalInvoice',
  ExternalInvoiceSchema
);

export default ExternalInvoice;
