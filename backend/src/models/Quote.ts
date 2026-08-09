import mongoose, { Document, Schema } from 'mongoose';
import {
  MEGADIM_BANK_DEFAULTS,
  MEGADIM_COMPANY_DEFAULTS,
  QuoteBankSnapshot,
  QuoteCompanySnapshot
} from '../utils/quote-defaults.util';
import { QuoteStatus, QUOTE_STATUSES } from '../utils/quote-totals.util';
import {
  PrivatePackage,
  QuoteAudience,
  PRIVATE_TEMPLATE_TWO_MEALS
} from '../utils/quote-private.util';

export interface IQuoteLine {
  sku: string;
  description: string;
  quantity: number;
  unitPriceInclVat: number;
  lineTotalInclVat: number;
  sortOrder: number;
}

export interface IQuoteClient {
  name: string;
  company: string;
  idNumber: string;
  address: string;
  phone: string;
  email: string;
  theirRef: string;
}

export interface IQuote extends Document {
  quoteNumber: string;
  audience: QuoteAudience;
  status: QuoteStatus;
  client: IQuoteClient;
  eventDate: Date | null;
  eventLocation: string;
  lines: IQuoteLine[];
  privatePackage: PrivatePackage | null;
  discountPercent: number;
  notes: string;
  vatRate: number;
  subtotalInclVat: number;
  discountAmount: number;
  totalInclVat: number;
  totalExVat: number;
  vatAmount: number;
  companySnapshot: QuoteCompanySnapshot;
  bankSnapshot: QuoteBankSnapshot;
  issuedBy: string | null;
  issuedAt: Date | null;
  validUntil: Date | null;
  leadId: mongoose.Types.ObjectId | null;
  orderId: mongoose.Types.ObjectId | null;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const QuoteLineSchema = new Schema<IQuoteLine>(
  {
    sku: { type: String, default: '', trim: true, maxlength: 64 },
    description: { type: String, required: true, trim: true, maxlength: 500 },
    quantity: { type: Number, required: true, min: 0 },
    unitPriceInclVat: { type: Number, required: true, min: 0 },
    lineTotalInclVat: { type: Number, required: true, min: 0 },
    sortOrder: { type: Number, default: 0, min: 0 }
  },
  { _id: false }
);

const QuoteClientSchema = new Schema<IQuoteClient>(
  {
    name: { type: String, default: '', trim: true, maxlength: 200 },
    company: { type: String, default: '', trim: true, maxlength: 200 },
    idNumber: { type: String, default: '', trim: true, maxlength: 32 },
    address: { type: String, default: '', trim: true, maxlength: 300 },
    phone: { type: String, default: '', trim: true, maxlength: 40 },
    email: { type: String, default: '', trim: true, maxlength: 120 },
    theirRef: { type: String, default: '', trim: true, maxlength: 64 }
  },
  { _id: false }
);

const MealStructureSchema = new Schema(
  {
    appetizerChoices: { type: Number, default: 0, min: 0 },
    mainChoices: { type: Number, default: 0, min: 0 },
    sides: { type: Number, default: 0, min: 0 },
    dessert: { type: Boolean, default: false }
  },
  { _id: false }
);

const ReadyFoodLineSchema = new Schema(
  {
    description: { type: String, default: '', trim: true, maxlength: 300 },
    quantity: { type: Number, default: 1, min: 0 },
    unitPrice: { type: Number, default: 0, min: 0 }
  },
  { _id: false }
);

const PrivatePackageSchema = new Schema(
  {
    serviceCategory: {
      type: String,
      enum: ['events', 'catering_shabbat', 'shabbat_ready'],
      default: 'catering_shabbat'
    },
    templateKey: {
      type: String,
      enum: [
        'events_base',
        'one_meal',
        'two_meals',
        'premium_hosted',
        'itemized',
        'custom',
        'shabbat_premium',
        'shabbat_basic'
      ],
      default: 'two_meals'
    },
    basePricePerPortion: { type: Number, default: 135, min: 0 },
    portions: { type: Number, default: 10, min: 0 },
    bread: { type: String, default: '', trim: true, maxlength: 120 },
    saladsCount: { type: Number, default: 8, min: 0 },
    friday: { type: MealStructureSchema, default: () => ({ ...PRIVATE_TEMPLATE_TWO_MEALS.friday }) },
    saturday: {
      type: MealStructureSchema,
      default: () => ({ ...PRIVATE_TEMPLATE_TWO_MEALS.saturday })
    },
    thirdMealNotes: { type: String, default: '', trim: true, maxlength: 300 },
    extras: { type: [String], default: [] },
    whatsappText: { type: String, default: '', maxlength: 8000 },
    mealScope: { type: String, enum: ['evening', 'morning', 'both'], default: 'both' },
    portionsEvening: { type: Number, default: 10, min: 0 },
    portionsMorning: { type: Number, default: 10, min: 0 },
    includeThirdMeal: { type: Boolean, default: false },
    thirdMealPricePerPortion: { type: Number, default: 25, min: 0 },
    includeAppetizerUpgrade: { type: Boolean, default: false },
    appetizerPricePerPortion: { type: Number, default: 20, min: 0 },
    appetizerMealsCount: { type: Number, default: 2, min: 0 },
    includeFishUpgrade: { type: Boolean, default: false },
    fishPricePerPortion: { type: Number, default: 18, min: 0 },
    includeDessertUpgrade: { type: Boolean, default: false },
    dessertPricePerPortion: { type: Number, default: 8, min: 0 },
    dessertMealsCount: { type: Number, default: 2, min: 0 },
    includeKosherUpgrade: { type: Boolean, default: false },
    kosherPricePerPortion: { type: Number, default: 7, min: 0 },
    kosherMealsCount: { type: Number, default: 2, min: 0 },
    eventType: { type: String, default: '', trim: true, maxlength: 120 },
    includeFirstCourse: { type: Boolean, default: false },
    firstCourseChoices: { type: Number, default: 2, min: 0 },
    includeDesserts: { type: Boolean, default: false },
    receptionBar: {
      type: String,
      enum: ['none', 'standard', 'premium'],
      default: 'none'
    },
    mainChoices: { type: Number, default: 2, min: 0 },
    sidesCount: { type: Number, default: 3, min: 0 },
    readyLines: { type: [ReadyFoodLineSchema], default: [] },
    deliveryFee: { type: Number, default: 0, min: 0 },
    deliveryType: { type: String, enum: ['', 'pickup', 'delivery'], default: '' }
  },
  { _id: false }
);

const CompanySnapshotSchema = new Schema<QuoteCompanySnapshot>(
  {
    name: { type: String, default: MEGADIM_COMPANY_DEFAULTS.name },
    address: { type: String, default: MEGADIM_COMPANY_DEFAULTS.address },
    phone: { type: String, default: MEGADIM_COMPANY_DEFAULTS.phone },
    businessId: { type: String, default: MEGADIM_COMPANY_DEFAULTS.businessId },
    producerName: { type: String, default: MEGADIM_COMPANY_DEFAULTS.producerName }
  },
  { _id: false }
);

const BankSnapshotSchema = new Schema<QuoteBankSnapshot>(
  {
    bankCode: { type: String, default: MEGADIM_BANK_DEFAULTS.bankCode },
    bankName: { type: String, default: MEGADIM_BANK_DEFAULTS.bankName },
    branch: { type: String, default: MEGADIM_BANK_DEFAULTS.branch },
    account: { type: String, default: MEGADIM_BANK_DEFAULTS.account }
  },
  { _id: false }
);

const QuoteSchema = new Schema<IQuote>(
  {
    quoteNumber: { type: String, required: true, unique: true, trim: true, index: true },
    audience: {
      type: String,
      enum: ['business', 'private'],
      default: 'business',
      index: true
    },
    status: {
      type: String,
      enum: QUOTE_STATUSES,
      default: 'draft',
      index: true
    },
    client: { type: QuoteClientSchema, default: () => ({}) },
    eventDate: { type: Date, default: null },
    eventLocation: { type: String, default: '', trim: true, maxlength: 300 },
    lines: { type: [QuoteLineSchema], default: [] },
    privatePackage: { type: PrivatePackageSchema, default: null },
    discountPercent: { type: Number, default: 0, min: 0, max: 100 },
    notes: { type: String, default: '', trim: true, maxlength: 2000 },
    vatRate: { type: Number, default: 18, min: 0, max: 100 },
    subtotalInclVat: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },
    totalInclVat: { type: Number, default: 0 },
    totalExVat: { type: Number, default: 0 },
    vatAmount: { type: Number, default: 0 },
    companySnapshot: { type: CompanySnapshotSchema, default: () => ({ ...MEGADIM_COMPANY_DEFAULTS }) },
    bankSnapshot: { type: BankSnapshotSchema, default: () => ({ ...MEGADIM_BANK_DEFAULTS }) },
    issuedBy: { type: String, default: null },
    issuedAt: { type: Date, default: null },
    validUntil: { type: Date, default: null },
    leadId: { type: Schema.Types.ObjectId, default: null, index: true },
    orderId: { type: Schema.Types.ObjectId, default: null, index: true },
    isDeleted: { type: Boolean, default: false, index: true }
  },
  { timestamps: true }
);

QuoteSchema.index({ createdAt: -1 });
QuoteSchema.index({ audience: 1, isDeleted: 1, createdAt: -1 });
QuoteSchema.index({ status: 1, isDeleted: 1, createdAt: -1 });
QuoteSchema.index({ 'client.name': 'text', 'client.company': 'text', quoteNumber: 'text' });

export const Quote = mongoose.model<IQuote>('Quote', QuoteSchema);

export interface IQuoteCounter extends Document {
  yearKey: string;
  seq: number;
}

const QuoteCounterSchema = new Schema<IQuoteCounter>({
  yearKey: { type: String, required: true, unique: true },
  seq: { type: Number, required: true, default: 0 }
});

export const QuoteCounter = mongoose.model<IQuoteCounter>('QuoteCounter', QuoteCounterSchema);
