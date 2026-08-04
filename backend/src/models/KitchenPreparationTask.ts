import mongoose, { Schema, Document, Model, Types } from 'mongoose';

/** Canonical + legacy stage aliases (short codes kept for existing data). */
export const KITCHEN_STAGES = [
  'thaw',
  'prep',
  'pre_prep',
  'cut',
  'mix',
  'mix_or_season',
  'cook',
  'bake',
  'bake_or_roast',
  'cool',
  'store',
  'pack',
  'qa',
  'quality_check',
  'load',
  'load_or_handoff',
  'station_clean',
  'clean_or_setup',
  'general'
] as const;
export type KitchenStage = (typeof KITCHEN_STAGES)[number];

/** Canonical: partially_completed / completed; legacy: partial / done. */
export const KITCHEN_TASK_STATUSES = [
  'not_started',
  'in_progress',
  'partial',
  'partially_completed',
  'done',
  'completed',
  'blocked',
  'cancelled'
] as const;
export type KitchenTaskStatus = (typeof KITCHEN_TASK_STATUSES)[number];

export const KITCHEN_URGENCIES = ['low', 'normal', 'high', 'critical'] as const;
export type KitchenUrgency = (typeof KITCHEN_URGENCIES)[number];

/** Canonical: automatic_legacy; legacy: auto. */
export const KITCHEN_TASK_SOURCES = ['auto', 'automatic_legacy', 'template', 'manual'] as const;
export type KitchenTaskSource = (typeof KITCHEN_TASK_SOURCES)[number];

export const KITCHEN_SYNC_STATUSES = [
  'synced',
  'needs_review',
  'accepted_difference',
  'manual_override',
  'orphaned'
] as const;
export type KitchenSyncStatus = (typeof KITCHEN_SYNC_STATUSES)[number];

export type KitchenTaskAuditEntry = {
  at: Date;
  action: string;
  by?: string;
  previousValue?: string;
  newValue?: string;
  detail?: string;
  requestId?: string;
  idempotencyKey?: string;
};

export type KitchenChecklistItem = {
  id: string;
  label: string;
  done: boolean;
  doneAt?: Date | null;
  doneBy?: string;
};

export type KitchenItemSnapshot = {
  name?: string;
  optionLabel?: string;
  sizeLabel?: string;
  unit?: string;
  mealTime?: string;
  orderItemKey?: string;
};

export interface IKitchenPreparationTask extends Document {
  orderId: Types.ObjectId;
  orderIds?: Types.ObjectId[];
  orderItemKey?: string;
  itemSnapshot?: KitchenItemSnapshot;
  title: string;
  stage: KitchenStage;
  plannedStartAt: Date;
  plannedEndAt?: Date | null;
  plannedQuantity?: number | null;
  unit?: string;
  actualQuantity?: number | null;
  status: KitchenTaskStatus;
  urgency: KitchenUrgency;
  stationId?: Types.ObjectId | null;
  stationName?: string;
  assigneeEmployeeId?: Types.ObjectId | null;
  assigneeName?: string;
  notes?: string;
  dependsOn: Types.ObjectId[];
  checklist: KitchenChecklistItem[];
  source: KitchenTaskSource;
  createdBy?: string;
  updatedBy?: string;
  completedBy?: string;
  completedAt?: Date | null;
  version: number;
  auditLog: KitchenTaskAuditEntry[];
  blockReason?: string;
  cancelReason?: string;
  syncStatus: KitchenSyncStatus;
  syncDetail?: string;
  syncPreviousValue?: string;
  syncNewValue?: string;
  changeContext?: {
    previousValue?: string;
    newValue?: string;
    reason?: string;
  };
  usedDeliveryFallback?: boolean;
  backfillKey?: string;
  orderSnapshot?: {
    orderNumber?: string;
    eventDate?: string;
    meal?: string;
    fulfillment?: string;
    customerName?: string;
    allergies?: string;
    specialRequests?: string;
  };
  isDemo?: boolean;
  demoBatchId?: string;
  lastIdempotencyKey?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const ChecklistSchema = new Schema(
  {
    id: { type: String, required: true },
    label: { type: String, required: true, trim: true, maxlength: 200 },
    done: { type: Boolean, default: false },
    doneAt: { type: Date, default: null },
    doneBy: { type: String, trim: true, maxlength: 120 }
  },
  { _id: false }
);

const AuditSchema = new Schema(
  {
    at: { type: Date, required: true },
    action: { type: String, required: true, trim: true, maxlength: 80 },
    by: { type: String, trim: true, maxlength: 120 },
    previousValue: { type: String, trim: true, maxlength: 500 },
    newValue: { type: String, trim: true, maxlength: 500 },
    detail: { type: String, trim: true, maxlength: 500 },
    requestId: { type: String, trim: true, maxlength: 120 },
    idempotencyKey: { type: String, trim: true, maxlength: 120 }
  },
  { _id: false }
);

const ItemSnapshotSchema = new Schema(
  {
    name: { type: String, trim: true, maxlength: 200 },
    optionLabel: { type: String, trim: true, maxlength: 120 },
    sizeLabel: { type: String, trim: true, maxlength: 80 },
    unit: { type: String, trim: true, maxlength: 40 },
    mealTime: { type: String, trim: true, maxlength: 40 },
    orderItemKey: { type: String, trim: true, maxlength: 300 }
  },
  { _id: false }
);

const KitchenPreparationTaskSchema = new Schema<IKitchenPreparationTask>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    orderIds: [{ type: Schema.Types.ObjectId, ref: 'Order' }],
    orderItemKey: { type: String, trim: true, maxlength: 300 },
    itemSnapshot: { type: ItemSnapshotSchema, default: undefined },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    stage: { type: String, required: true, enum: KITCHEN_STAGES, default: 'general', index: true },
    plannedStartAt: { type: Date, required: true, index: true },
    plannedEndAt: { type: Date, default: null },
    plannedQuantity: { type: Number, min: 0, default: null },
    unit: { type: String, trim: true, maxlength: 40, default: "יח'" },
    actualQuantity: { type: Number, min: 0, default: null },
    status: {
      type: String,
      required: true,
      enum: KITCHEN_TASK_STATUSES,
      default: 'not_started',
      index: true
    },
    urgency: { type: String, enum: KITCHEN_URGENCIES, default: 'normal' },
    stationId: { type: Schema.Types.ObjectId, ref: 'KitchenStation', default: null },
    stationName: { type: String, trim: true, maxlength: 120 },
    assigneeEmployeeId: { type: Schema.Types.ObjectId, ref: 'Employee', default: null },
    assigneeName: { type: String, trim: true, maxlength: 120 },
    notes: { type: String, trim: true, maxlength: 2000, default: '' },
    dependsOn: [{ type: Schema.Types.ObjectId, ref: 'KitchenPreparationTask' }],
    checklist: { type: [ChecklistSchema], default: [] },
    source: { type: String, enum: KITCHEN_TASK_SOURCES, default: 'manual' },
    createdBy: { type: String, trim: true, maxlength: 120 },
    updatedBy: { type: String, trim: true, maxlength: 120 },
    completedBy: { type: String, trim: true, maxlength: 120 },
    completedAt: { type: Date, default: null },
    version: { type: Number, required: true, default: 1 },
    auditLog: { type: [AuditSchema], default: [] },
    blockReason: { type: String, trim: true, maxlength: 500 },
    cancelReason: { type: String, trim: true, maxlength: 500 },
    syncStatus: {
      type: String,
      enum: KITCHEN_SYNC_STATUSES,
      default: 'synced',
      index: true
    },
    syncDetail: { type: String, trim: true, maxlength: 500 },
    syncPreviousValue: { type: String, trim: true, maxlength: 500 },
    syncNewValue: { type: String, trim: true, maxlength: 500 },
    changeContext: {
      previousValue: { type: String, trim: true, maxlength: 500 },
      newValue: { type: String, trim: true, maxlength: 500 },
      reason: { type: String, trim: true, maxlength: 500 }
    },
    usedDeliveryFallback: { type: Boolean, default: false },
    backfillKey: { type: String, trim: true, maxlength: 120, sparse: true },
    orderSnapshot: {
      orderNumber: String,
      eventDate: String,
      meal: String,
      fulfillment: String,
      customerName: String,
      allergies: String,
      specialRequests: String
    },
    isDemo: { type: Boolean, default: false, index: true },
    demoBatchId: { type: String, trim: true, maxlength: 80, sparse: true },
    lastIdempotencyKey: { type: String, trim: true, maxlength: 120 }
  },
  { timestamps: true, collection: 'kitchen_preparation_tasks' }
);

KitchenPreparationTaskSchema.index({ plannedStartAt: 1, status: 1 });
KitchenPreparationTaskSchema.index({ stationId: 1, plannedStartAt: 1 });
// Partial unique: only when backfillKey is a real string (null/missing must not collide).
KitchenPreparationTaskSchema.index(
  { orderId: 1, backfillKey: 1 },
  {
    unique: true,
    name: 'orderId_1_backfillKey_1_partial',
    partialFilterExpression: { backfillKey: { $exists: true, $type: 'string' } }
  }
);
KitchenPreparationTaskSchema.index({ syncStatus: 1, plannedStartAt: 1 });
KitchenPreparationTaskSchema.index({ demoBatchId: 1, isDemo: 1 }, { sparse: true });

const KitchenPreparationTask: Model<IKitchenPreparationTask> =
  mongoose.models.KitchenPreparationTask ||
  mongoose.model<IKitchenPreparationTask>('KitchenPreparationTask', KitchenPreparationTaskSchema);

export default KitchenPreparationTask;
