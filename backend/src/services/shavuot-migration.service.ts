import mongoose from 'mongoose';
import MenuItem, { IMenuItem } from '../models/menuItem';
import HolidayEvent, { IHolidayEvent, IHolidayEventProduct } from '../models/holidayEvent.model';

export const SHAVUOT_EVENT_NAME = 'חג שבועות';
export const ARCHIVED_HOLIDAY_CATEGORY = 'archived_holiday';

export interface ShavuotMigrationOptions {
  dryRun?: boolean;
  /** Used when creating the event if missing (ISO string or Date) */
  orderDeadline?: Date;
  /** Used when creating the event if missing */
  createAsActive?: boolean;
}

export interface ShavuotMigrationItemResult {
  menuItemId: string;
  name: string;
  action: 'migrated' | 'archived_only' | 'skipped';
  reason?: string;
}

export interface ShavuotMigrationResult {
  success: boolean;
  dryRun: boolean;
  createdEvent: boolean;
  eventId: string;
  eventName: string;
  items: ShavuotMigrationItemResult[];
  summary: {
    found: number;
    addedToHoliday: number;
    archived: number;
    skipped: number;
  };
}

/** Match Shavuot sides (quiche, lasagna, gratin) without catching "קישוא". */
export function isShavuotMenuItemCandidate(name: string): boolean {
  const n = (name || '').trim();
  if (!n) return false;
  if (n.includes('לזניה חצילים ברוטב רוזה')) return true;
  if (n.includes('תפו"א מוקרם') || n.includes('תפוח אדמה מוקרם')) return true;
  if (n.includes('קיש') && !n.includes('קישוא')) return true;
  return false;
}

export function buildShavuotMenuItemFilter() {
  return {
    category: { $ne: ARCHIVED_HOLIDAY_CATEGORY },
    $or: [
      { name: { $regex: 'לזניה חצילים ברוטב רוזה' } },
      { name: { $regex: 'תפו"א מוקרם' } },
      { name: { $regex: 'תפוח אדמה מוקרם' } },
      {
        $and: [{ name: { $regex: 'קיש' } }, { name: { $not: /קישוא/ } }]
      }
    ]
  };
}

export function resolveMenuItemPrice(item: Pick<IMenuItem, 'price' | 'pricingVariants' | 'pricingOptions' | 'pricePer100g'>): number {
  if (item.price != null && item.price > 0) return Number(item.price);
  const variantPrice = item.pricingVariants?.[0]?.price;
  if (variantPrice != null && variantPrice > 0) return Number(variantPrice);
  const optionPrice = item.pricingOptions?.[0]?.price;
  if (optionPrice != null && optionPrice > 0) return Number(optionPrice);
  if (item.pricePer100g != null && item.pricePer100g > 0) return Number(item.pricePer100g);
  return 0;
}

function mapMenuItemToHolidayProduct(item: IMenuItem): Partial<IHolidayEventProduct> {
  return {
    title: item.name.trim(),
    price: resolveMenuItemPrice(item),
    description: (item.description || '').trim(),
    imageUrl: (item.imageUrl || '').trim(),
    isAvailable: true
  };
}

async function findOrCreateShavuotEvent(
  session: mongoose.ClientSession,
  options: ShavuotMigrationOptions
): Promise<{ event: IHolidayEvent; created: boolean }> {
  let event = await HolidayEvent.findOne({ name: SHAVUOT_EVENT_NAME })
    .sort({ isActive: -1, updatedAt: -1 })
    .session(session);

  if (event) {
    return { event, created: false };
  }

  const deadline =
    options.orderDeadline && !Number.isNaN(options.orderDeadline.getTime())
      ? options.orderDeadline
      : (() => {
          const d = new Date();
          d.setDate(d.getDate() + 30);
          return d;
        })();

  const created = await HolidayEvent.create(
    [
      {
        name: SHAVUOT_EVENT_NAME,
        isActive: options.createAsActive === true,
        orderDeadline: deadline,
        products: []
      }
    ],
    { session }
  );

  return { event: created[0], created: true };
}

/**
 * One-time migration: copy Shavuot MenuItems into HolidayEvent products and archive sources.
 */
export async function migrateShavuotProductsToHoliday(
  options: ShavuotMigrationOptions = {}
): Promise<ShavuotMigrationResult> {
  const dryRun = options.dryRun === true;
  const session = await mongoose.startSession();

  const items: ShavuotMigrationItemResult[] = [];
  let createdEvent = false;
  let eventId = '';
  let eventName = SHAVUOT_EVENT_NAME;

  try {
    session.startTransaction();

    const candidates = await MenuItem.find(buildShavuotMenuItemFilter()).session(session);
    const sourceItems = candidates.filter((doc) => isShavuotMenuItemCandidate(doc.name));

    const { event, created } = await findOrCreateShavuotEvent(session, options);
    createdEvent = created;
    eventId = String(event._id);
    eventName = event.name;

    const existingTitles = new Set(
      (event.products || []).map((p) => String(p.title || '').trim().toLowerCase())
    );

    let addedToHoliday = 0;
    let archived = 0;
    let skipped = 0;

    for (const menuItem of sourceItems) {
      const menuItemId = String(menuItem._id);
      const titleKey = menuItem.name.trim().toLowerCase();
      const alreadyInEvent = existingTitles.has(titleKey);
      const needsArchive =
        menuItem.category !== ARCHIVED_HOLIDAY_CATEGORY || menuItem.isAvailable !== false;

      if (!alreadyInEvent) {
        const mapped = mapMenuItemToHolidayProduct(menuItem);
        if (!dryRun) {
          event.products.push(mapped as IHolidayEventProduct);
        }
        existingTitles.add(titleKey);
        addedToHoliday += 1;
        items.push({ menuItemId, name: menuItem.name, action: 'migrated' });
      } else {
        items.push({
          menuItemId,
          name: menuItem.name,
          action: 'archived_only',
          reason: 'already_in_holiday_event'
        });
      }

      if (needsArchive) {
        if (!dryRun) {
          menuItem.isAvailable = false;
          menuItem.category = ARCHIVED_HOLIDAY_CATEGORY;
          await menuItem.save({ session });
        }
        archived += 1;
      } else if (alreadyInEvent) {
        skipped += 1;
      }
    }

    if (!dryRun && addedToHoliday > 0) {
      await event.save({ session });
    }

    if (dryRun) {
      await session.abortTransaction();
    } else {
      await session.commitTransaction();
    }

    return {
      success: true,
      dryRun,
      createdEvent,
      eventId,
      eventName,
      items,
      summary: {
        found: sourceItems.length,
        addedToHoliday,
        archived,
        skipped
      }
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}
