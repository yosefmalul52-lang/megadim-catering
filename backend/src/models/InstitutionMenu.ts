import mongoose, { Schema, Document, Model } from 'mongoose';
import { emptyMenuDayItems } from '../utils/menu-structure';

export interface IMenuDayItems {
  mainMeat: string;
  vegetarianMain: string;
  carb1: string;
  carb2: string;
  side: string;
  saladFruit: string;
}

/** Weekly master menu (Sunday–Saturday), keyed by weekStartDate YYYY-MM-DD. */
export interface IInstitutionMenu extends Document {
  weekStartDate: string;
  sunday: IMenuDayItems;
  monday: IMenuDayItems;
  tuesday: IMenuDayItems;
  wednesday: IMenuDayItems;
  thursday: IMenuDayItems;
  friday: IMenuDayItems;
  saturday: IMenuDayItems;
  orderDeadline: Date;
  updatedAt?: Date;
}

const MenuDayItemsSchema = new Schema<IMenuDayItems>(
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

const dayDefault = () => emptyMenuDayItems();

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
    friday: { type: MenuDayItemsSchema, default: dayDefault },
    saturday: { type: MenuDayItemsSchema, default: dayDefault },
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
