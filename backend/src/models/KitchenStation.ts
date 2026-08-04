import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IKitchenStation extends Document {
  name: string;
  active: boolean;
  maxPortionsPerDay?: number | null;
  availableHours?: number | null;
  workerCount?: number | null;
  equipmentNotes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const KitchenStationSchema = new Schema<IKitchenStation>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120, unique: true },
    active: { type: Boolean, default: true },
    maxPortionsPerDay: { type: Number, min: 0, default: null },
    availableHours: { type: Number, min: 0, default: null },
    workerCount: { type: Number, min: 0, default: null },
    equipmentNotes: { type: String, trim: true, maxlength: 1000, default: '' }
  },
  { timestamps: true, collection: 'kitchen_stations' }
);

const KitchenStation: Model<IKitchenStation> =
  mongoose.models.KitchenStation ||
  mongoose.model<IKitchenStation>('KitchenStation', KitchenStationSchema);

export default KitchenStation;
