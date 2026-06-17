/**
 * One-time seed: populate B2BMenuItem dictionary with Hebrew test data.
 *
 * Usage (from backend/):
 *   npx ts-node scripts/seed-b2b-menu.ts
 */
import dotenv from 'dotenv';
import path from 'path';
import mongoose from 'mongoose';
import B2BMenuItem, { type B2BDictionaryCategory } from '../src/models/B2BMenuItem';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const MONGO_URI = process.env.MONGO_URI;

type SeedRow = {
  name: string;
  category: B2BDictionaryCategory;
  gramsPerPortion?: number;
};

const SEED_ITEMS: SeedRow[] = [
  // Main meats
  { name: 'כרעיים עוף בתנור', category: 'mainMeat', gramsPerPortion: 250 },
  { name: 'שניצל עוף פריך', category: 'mainMeat', gramsPerPortion: 150 },
  { name: 'קציצות בקר ברוטב', category: 'mainMeat', gramsPerPortion: 200 },
  { name: 'צלי בקר בפטריות', category: 'mainMeat', gramsPerPortion: 220 },
  { name: 'חזה עוף על האש', category: 'mainMeat', gramsPerPortion: 180 },
  { name: 'נקניקיות ברוטב חרדל', category: 'mainMeat', gramsPerPortion: 150 },

  // Vegetarian mains
  { name: 'שניצל תירס', category: 'vegetarianMain' },
  { name: 'קציצות ירק', category: 'vegetarianMain' },
  { name: 'פסטה ברוטב פסטו', category: 'vegetarianMain' },

  // Carbohydrates
  { name: 'אורז לבן מבושל', category: 'carb' },
  { name: 'אורז צהוב עם שקדים', category: 'carb' },
  { name: 'קוסקוס ביתי', category: 'carb' },
  { name: 'תפוחי אדמה אפויים', category: 'carb' },
  { name: 'פסטה ברוטב עגבניות', category: 'carb' },
  { name: 'פירה תפוחי אדמה', category: 'carb' },

  // Sides
  { name: 'שעועית ירוקה מוקפצת', category: 'side' },
  { name: 'אפונה וגזר', category: 'side' },
  { name: 'לקט ירקות בתנור', category: 'side' },
  { name: 'בטטות מקורמלות', category: 'side' },
  { name: 'תירס חם', category: 'side' },

  // Salads / fruits
  { name: 'סלט ירקות קצוץ', category: 'saladFruit' },
  { name: 'סלט כרוב במיונז', category: 'saladFruit' },
  { name: 'סלט חסה עם פקאן', category: 'saladFruit' },
  { name: 'חומוס הבית', category: 'saladFruit' },
  { name: 'טחינה ירוקה', category: 'saladFruit' },
  { name: 'פירות העונה חתוכים', category: 'saladFruit' }
];

async function main(): Promise<void> {
  if (!MONGO_URI) {
    console.error('❌ MONGO_URI is not set in backend/.env');
    process.exit(1);
  }

  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected to MongoDB');

  const before = await B2BMenuItem.countDocuments();
  console.log(`📊 Existing B2B menu items: ${before}`);

  const deleted = await B2BMenuItem.deleteMany({});
  console.log(`🗑️  Cleared ${deleted.deletedCount} existing items`);

  const docs = SEED_ITEMS.map((row) => ({
    name: row.name,
    category: row.category,
    gramsPerPortion: row.category === 'mainMeat' ? row.gramsPerPortion ?? 200 : 200,
    portionsPerGastronorm: 40,
    isActive: true
  }));

  const inserted = await B2BMenuItem.insertMany(docs);
  console.log(`✅ Inserted ${inserted.length} B2B menu dictionary items`);

  const byCategory = await B2BMenuItem.aggregate([
    { $group: { _id: '$category', count: { $sum: 1 } } },
    { $sort: { _id: 1 } }
  ]);
  console.log('📋 Breakdown by category:');
  for (const row of byCategory) {
    console.log(`   ${row._id}: ${row.count}`);
  }

  await mongoose.disconnect();
  console.log('✅ Done — refresh Admin Tab 2 to see dropdown options');
}

main().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
