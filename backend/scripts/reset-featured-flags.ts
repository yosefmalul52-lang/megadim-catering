/**
 * One-time cleanup: reset isFeatured=false on all menu items.
 * Homepage "מה מתבשל אצלנו" should only show items explicitly marked in admin.
 *
 * Usage: npx ts-node scripts/reset-featured-flags.ts
 */
import dotenv from 'dotenv';
import path from 'path';
import mongoose from 'mongoose';
import MenuItem from '../src/models/menuItem';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const MONGO_URI = process.env.MONGO_URI;

async function main(): Promise<void> {
  if (!MONGO_URI) {
    console.error('❌ MONGO_URI is not set in backend/.env');
    process.exit(1);
  }

  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected to MongoDB');

  const before = await MenuItem.countDocuments({ isFeatured: true });
  console.log(`📊 Items with isFeatured=true before reset: ${before}`);

  const result = await MenuItem.updateMany({}, { $set: { isFeatured: false } });
  console.log(`🔄 Updated ${result.modifiedCount} documents`);

  const after = await MenuItem.countDocuments({ isFeatured: true });
  console.log(`📊 Items with isFeatured=true after reset: ${after}`);

  await mongoose.disconnect();
  console.log('✅ Done');
}

main().catch((err) => {
  console.error('❌ Reset failed:', err);
  process.exit(1);
});
