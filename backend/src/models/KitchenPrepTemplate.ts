import mongoose, { Schema, Document, Model } from 'mongoose';
import { KITCHEN_STAGES, KITCHEN_URGENCIES, KitchenStage, KitchenUrgency } from './KitchenPreparationTask';

export type KitchenTemplateTaskDef = {
  title: string;
  stage: KitchenStage;
  /** Days before eventDate (0 = event day, 1 = day before, …). */
  daysBeforeEvent: number;
  startHour?: number;
  startMinute?: number;
  durationHours?: number;
  plannedQuantityMode?: 'order_item' | 'fixed' | 'none';
  fixedQuantity?: number | null;
  unit?: string;
  urgency?: KitchenUrgency;
  stationName?: string;
  checklistLabels?: string[];
  notes?: string;
};

export interface IKitchenPrepTemplate extends Document {
  name: string;
  description?: string;
  active: boolean;
  tasks: KitchenTemplateTaskDef[];
  createdBy?: string;
  updatedBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const TemplateTaskSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    stage: { type: String, required: true, enum: KITCHEN_STAGES, default: 'general' },
    daysBeforeEvent: { type: Number, required: true, min: 0, max: 30, default: 0 },
    startHour: { type: Number, min: 0, max: 23, default: 8 },
    startMinute: { type: Number, min: 0, max: 59, default: 0 },
    durationHours: { type: Number, min: 0, max: 48, default: 2 },
    plannedQuantityMode: {
      type: String,
      enum: ['order_item', 'fixed', 'none'],
      default: 'order_item'
    },
    fixedQuantity: { type: Number, min: 0, default: null },
    unit: { type: String, trim: true, maxlength: 40, default: "יח'" },
    urgency: { type: String, enum: KITCHEN_URGENCIES, default: 'normal' },
    stationName: { type: String, trim: true, maxlength: 120 },
    checklistLabels: [{ type: String, trim: true, maxlength: 200 }],
    notes: { type: String, trim: true, maxlength: 1000 }
  },
  { _id: false }
);

const KitchenPrepTemplateSchema = new Schema<IKitchenPrepTemplate>(
  {
    name: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, trim: true, maxlength: 1000, default: '' },
    active: { type: Boolean, default: true },
    tasks: { type: [TemplateTaskSchema], default: [] },
    createdBy: { type: String, trim: true, maxlength: 120 },
    updatedBy: { type: String, trim: true, maxlength: 120 }
  },
  { timestamps: true, collection: 'kitchen_prep_templates' }
);

const KitchenPrepTemplate: Model<IKitchenPrepTemplate> =
  mongoose.models.KitchenPrepTemplate ||
  mongoose.model<IKitchenPrepTemplate>('KitchenPrepTemplate', KitchenPrepTemplateSchema);

export default KitchenPrepTemplate;
