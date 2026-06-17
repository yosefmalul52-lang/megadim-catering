import mongoose, { Schema, Document, Model } from 'mongoose';
import {
  SHABBAT_SALAD_SLOTS,
  emptyMenuDayItems,
  emptyShabbatPackage,
  type InstitutionMenuContent,
  type MenuDayItems
} from '../utils/menu-structure';

export type { MenuDayItems, InstitutionMenuContent };

const MenuDayItemsSchema = new Schema<MenuDayItems>(
  {
    mainMeat: { type: String, trim: true, default: '' },
    vegetarianMain: { type: String, trim: true, default: '' },
    carb1: { type: String, trim: true, default: '' },
    carb2: { type: String, trim: true, default: '' },
    side: { type: String, trim: true, default: '' },
    saladFruit: { type: String, trim: true, default: '' }
  },
  { _id: false }
);

const FridayNightMealsSchema = new Schema(
  {
    fish: { type: String, trim: true, default: '' },
    mainMeat: { type: String, trim: true, default: '' },
    vegetarianMain: { type: String, trim: true, default: '' },
    carb1: { type: String, trim: true, default: '' },
    carb2: { type: String, trim: true, default: '' },
    side: { type: String, trim: true, default: '' }
  },
  { _id: false }
);

const ShabbatDayMealsSchema = new Schema(
  {
    mainMeat: { type: String, trim: true, default: '' },
    vegetarianMain: { type: String, trim: true, default: '' },
    carb1: { type: String, trim: true, default: '' },
    carb2: { type: String, trim: true, default: '' },
    side: { type: String, trim: true, default: '' }
  },
  { _id: false }
);

const SeudaShlishitMealsSchema = new Schema(
  {
    carb: { type: String, trim: true, default: '' },
    protein: { type: String, trim: true, default: '' }
  },
  { _id: false }
);

const ShabbatPackageSchema = new Schema(
  {
    hasShabbat: { type: Boolean, default: true },
    fridayNight: { type: FridayNightMealsSchema, default: () => emptyShabbatPackage().fridayNight },
    shabbatDay: { type: ShabbatDayMealsSchema, default: () => emptyShabbatPackage().shabbatDay },
    seudaShlishit: { type: SeudaShlishitMealsSchema, default: () => emptyShabbatPackage().seudaShlishit },
    shabbatSalads: {
      type: [String],
      default: () => Array.from({ length: SHABBAT_SALAD_SLOTS }, () => ''),
      validate: {
        validator: (value: string[]) => Array.isArray(value) && value.length === SHABBAT_SALAD_SLOTS,
        message: `shabbatSalads must contain exactly ${SHABBAT_SALAD_SLOTS} entries`
      }
    }
  },
  { _id: false }
);

const dayDefault = () => emptyMenuDayItems();
const shabbatDefault = () => emptyShabbatPackage();

/** Weekly master menu (Sun–Thu + Shabbat package), keyed by weekStartDate YYYY-MM-DD. */
export interface IInstitutionMenu extends Document {
  weekStartDate: string;
  sunday: MenuDayItems;
  monday: MenuDayItems;
  tuesday: MenuDayItems;
  wednesday: MenuDayItems;
  thursday: MenuDayItems;
  shabbatPackage: InstitutionMenuContent['shabbatPackage'];
  orderDeadline: Date;
  updatedAt?: Date;
}

const InstitutionMenuSchema = new Schema<IInstitutionMenu>(
  {
    weekStartDate: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
      unique: true,
      index: true
    },
    sunday: { type: MenuDayItemsSchema, default: dayDefault },
    monday: { type: MenuDayItemsSchema, default: dayDefault },
    tuesday: { type: MenuDayItemsSchema, default: dayDefault },
    wednesday: { type: MenuDayItemsSchema, default: dayDefault },
    thursday: { type: MenuDayItemsSchema, default: dayDefault },
    shabbatPackage: { type: ShabbatPackageSchema, default: shabbatDefault },
    orderDeadline: { type: Date, required: true }
  },
  {
    timestamps: { createdAt: false, updatedAt: true },
    collection: 'institutionmenus'
  }
);

const InstitutionMenu: Model<IInstitutionMenu> =
  (mongoose.models.InstitutionMenu as Model<IInstitutionMenu>) ||
  mongoose.model<IInstitutionMenu>('InstitutionMenu', InstitutionMenuSchema);

export default InstitutionMenu;
