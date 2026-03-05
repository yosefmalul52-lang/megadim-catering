/**
 * One-time seed for Cholent Bar menu items.
 * Runs on startup; only inserts if "קוגל ירושלמי" does not exist (safeguard against duplicates).
 */

import MenuItem from '../models/menuItem';

const CHOLENT_BAR_MARKER_NAME = 'קוגל ירושלמי';

const CHOLENT_BAR_ITEMS = [
  // Category: צ'ולנט (Cholent)
  { name: 'צ\'ולנט בשרי', description: 'צלחת צ\'ולנט ולחמניה', price: 45, category: 'צ\'ולנט' },
  { name: 'צ\'ולנט פרווה', description: 'צלחת צ\'ולנט ולחמניה', price: 35, category: 'צ\'ולנט' },
  { name: 'חלה שניצל', description: 'מבחר סלטים לבחירה וצ\'יפס', price: 38, category: 'צ\'ולנט' },
  { name: 'המבורגר בלחמניה', description: '', price: 42, category: 'צ\'ולנט' },
  { name: 'ארוחת המבורגר', description: 'צ\'יפס שתיה', price: 54, category: 'צ\'ולנט' },
  { name: 'נשנושי שניצלונים וצ\'יפס', description: '', price: 32, category: 'צ\'ולנט' },
  { name: 'צ\'יפס גדול', description: '', price: 20, category: 'צ\'ולנט' },
  { name: 'צ\'יפס קטן', description: '', price: 10, category: 'צ\'ולנט' },
  { name: 'קוגל ירושלמי', description: '', price: 8, category: 'צ\'ולנט' },
  { name: 'קוגל תפוחי אדמה', description: '', price: 8, category: 'צ\'ולנט' },
  { name: 'כבד קצוץ', description: 'עם בצל מטוגן וקרקרים', price: 30, category: 'צ\'ולנט' },
  // Category: משקאות (Drinks)
  { name: 'מים/סודה', description: '', price: 5, category: 'משקאות' },
  { name: 'קולה, פנטה, ספרייט, זירו, XL', description: '', price: 8, category: 'משקאות' },
  { name: 'בירה', description: '', price: 15, category: 'משקאות' },
  // Category: קינוחים (Desserts)
  { name: 'סופלה שוקולד עם גלידה וניל', description: '', price: 22, category: 'קינוחים' },
  { name: 'פלטת קינוחים זוגית', description: '', price: 40, category: 'קינוחים' }
];

function toMenuItemDoc(row: typeof CHOLENT_BAR_ITEMS[0]) {
  return {
    name: row.name,
    description: row.description || undefined,
    price: row.price,
    category: row.category,
    imageUrl: '',
    tags: [] as string[],
    isAvailable: true,
    isPopular: false,
    isFeatured: false
  };
}

/**
 * Run once on startup. Inserts Cholent Bar items only if they are not already seeded
 * (checks for existence of an item named CHOLENT_BAR_MARKER_NAME).
 */
export async function runCholentBarSeed(): Promise<void> {
  try {
    const existing = await MenuItem.findOne({ name: CHOLENT_BAR_MARKER_NAME });
    if (existing) {
      console.log('📦 Cholent Bar seed: already applied (קוגל ירושלמי exists). Skipping.');
      return;
    }

    const docs = CHOLENT_BAR_ITEMS.map(toMenuItemDoc);
    await MenuItem.insertMany(docs);
    console.log(`✅ Cholent Bar seed: inserted ${docs.length} menu items.`);
  } catch (err: any) {
    console.error('❌ Cholent Bar seed failed:', err?.message || err);
    // Do not throw – allow server to start even if seed fails (e.g. duplicate key)
  }
}
