/**
 * Backfill nameEn / descriptionEn / pricingOptions.labelEn on MenuItems + HolidayEvent products.
 *
 * Usage: npx ts-node scripts/backfill-menu-en.ts
 */
import dotenv from 'dotenv';
import path from 'path';
import mongoose from 'mongoose';
import MenuItem from '../src/models/menuItem';
import HolidayEvent from '../src/models/holidayEvent.model';
import { LABEL_EN_BY_HE, MENU_EN_BY_HE_NAME } from '../src/data/menu-en-translations';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const MONGO_URI = process.env.MONGO_URI;

function labelEnFor(label: string | undefined): string | undefined {
  if (!label) return undefined;
  const trimmed = String(label).trim();
  return LABEL_EN_BY_HE[trimmed] || undefined;
}

async function backfillMenuItems(): Promise<void> {
  const items = await MenuItem.find({}).exec();
  let updated = 0;
  const missing: string[] = [];

  for (const item of items) {
    const heName = String(item.name || '').trim();
    const copy = MENU_EN_BY_HE_NAME[heName];
    if (!copy) {
      if (!missing.includes(heName)) missing.push(heName);
      continue;
    }

    let dirty = false;
    if (item.nameEn !== copy.nameEn) {
      item.nameEn = copy.nameEn;
      dirty = true;
    }
    if (copy.descriptionEn && item.descriptionEn !== copy.descriptionEn) {
      item.descriptionEn = copy.descriptionEn;
      dirty = true;
    }

    if (Array.isArray(item.pricingOptions) && item.pricingOptions.length) {
      for (const opt of item.pricingOptions as Array<{ label?: string; labelEn?: string }>) {
        const en = labelEnFor(opt.label);
        if (en && opt.labelEn !== en) {
          opt.labelEn = en;
          dirty = true;
        }
      }
    }
    if (Array.isArray((item as any).pricingVariants) && (item as any).pricingVariants.length) {
      for (const v of (item as any).pricingVariants as Array<{ label?: string; labelEn?: string }>) {
        const en = labelEnFor(v.label);
        if (en && v.labelEn !== en) {
          v.labelEn = en;
          dirty = true;
        }
      }
    }

    if (dirty) {
      await item.save();
      updated += 1;
    }
  }

  console.log(`MenuItems updated: ${updated}/${items.length}`);
  if (missing.length) {
    console.warn('Missing EN map for Hebrew names:');
    missing.sort((a, b) => a.localeCompare(b, 'he')).forEach((n) => console.warn('  -', n));
  }
}

async function backfillHolidayProducts(): Promise<void> {
  const events = await HolidayEvent.find({}).exec();
  let updatedEvents = 0;
  let updatedProducts = 0;

  for (const event of events) {
    let dirty = false;
    for (const p of event.products || []) {
      const heTitle = String(p.title || '').trim();
      const copy = MENU_EN_BY_HE_NAME[heTitle];
      if (copy) {
        if (p.titleEn !== copy.nameEn) {
          p.titleEn = copy.nameEn;
          dirty = true;
          updatedProducts += 1;
        }
        if (copy.descriptionEn && p.descriptionEn !== copy.descriptionEn) {
          p.descriptionEn = copy.descriptionEn;
          dirty = true;
        }
      }
      if (Array.isArray(p.pricingOptions)) {
        for (const opt of p.pricingOptions) {
          const en = labelEnFor(opt.label);
          if (en && opt.labelEn !== en) {
            opt.labelEn = en;
            dirty = true;
          }
        }
      }
    }
    if (dirty) {
      await event.save();
      updatedEvents += 1;
    }
  }

  console.log(`Holiday events updated: ${updatedEvents}; products touched: ${updatedProducts}`);
}

async function main(): Promise<void> {
  if (!MONGO_URI) {
    console.error('MONGO_URI is not set in backend/.env');
    process.exit(1);
  }

  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');
  await backfillMenuItems();
  await backfillHolidayProducts();
  await mongoose.disconnect();
  console.log('Done');
}

main().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
