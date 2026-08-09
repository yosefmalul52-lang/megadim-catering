import mongoose, { Document, Schema } from 'mongoose';

export interface IShabbatCateringCatalog extends Document {
  key: string;
  singleMealPrice: number;
  bothMealsPrice: number;
  firstCourseUpgradePrice: number;
  seudaShlishitPrice: number;
  fishUpgradePrice: number;
  dessertsPrice: number;
  kosherUpgradePrice: number;
  saladOptions: string[];
  firstCourseOptions: string[];
  mainCourseOptions: string[];
  sideDishOptions: string[];
  saladSlotCount: number;
  saladMinCount: number;
  saladMaxCount: number;
  firstCourseSlotCount: number;
  mainCourseSlotCount: number;
  sideSlotCount: number;
  updatedAt?: Date;
  createdAt?: Date;
}

const ShabbatCateringCatalogSchema = new Schema<IShabbatCateringCatalog>(
  {
    key: { type: String, required: true, unique: true, default: 'default', index: true },
    singleMealPrice: { type: Number, required: true, min: 0, default: 70 },
    bothMealsPrice: { type: Number, required: true, min: 0, default: 135 },
    firstCourseUpgradePrice: { type: Number, required: true, min: 0, default: 20 },
    seudaShlishitPrice: { type: Number, required: true, min: 0, default: 25 },
    fishUpgradePrice: { type: Number, required: true, min: 0, default: 18 },
    dessertsPrice: { type: Number, required: true, min: 0, default: 8 },
    kosherUpgradePrice: { type: Number, required: true, min: 0, default: 7 },
    saladOptions: { type: [String], default: [] },
    firstCourseOptions: { type: [String], default: [] },
    mainCourseOptions: { type: [String], default: [] },
    sideDishOptions: { type: [String], default: [] },
    saladSlotCount: { type: Number, default: 8, min: 1 },
    saladMinCount: { type: Number, default: 6, min: 1 },
    saladMaxCount: { type: Number, default: 8, min: 1 },
    firstCourseSlotCount: { type: Number, default: 2, min: 1 },
    mainCourseSlotCount: { type: Number, default: 2, min: 1 },
    sideSlotCount: { type: Number, default: 3, min: 1 }
  },
  { timestamps: true, collection: 'shabbat_catering_catalog' }
);

export default mongoose.model<IShabbatCateringCatalog>(
  'ShabbatCateringCatalog',
  ShabbatCateringCatalogSchema
);
