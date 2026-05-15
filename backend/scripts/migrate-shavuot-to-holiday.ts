/**
 * One-time CLI migration: move Shavuot sides from MenuItem → HolidayEvent "חג שבועות".
 *
 * Usage:
 *   cd backend
 *   npx ts-node scripts/migrate-shavuot-to-holiday.ts           # execute
 *   npx ts-node scripts/migrate-shavuot-to-holiday.ts --dry-run   # preview only
 *
 * Requires MONGO_URI in backend/.env
 */

import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import mongoose from 'mongoose';
import { migrateShavuotProductsToHoliday } from '../src/services/shavuot-migration.service';

const backendEnvPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(backendEnvPath)) {
  dotenv.config({ path: backendEnvPath });
} else {
  dotenv.config();
}

const MONGO_URI = process.env.MONGO_URI;
const dryRun = process.argv.includes('--dry-run');

async function main(): Promise<void> {
  if (!MONGO_URI) {
    console.error('❌ MONGO_URI is not set. Add it to backend/.env');
    process.exit(1);
  }

  console.log(`📡 Connecting to MongoDB… (dryRun=${dryRun})`);
  await mongoose.connect(MONGO_URI);

  try {
    const result = await migrateShavuotProductsToHoliday({ dryRun });
    console.log('\n✅ Migration result:');
    console.log(JSON.stringify(result, null, 2));
    if (dryRun) {
      console.log('\nℹ️  Dry run only — re-run without --dry-run to apply changes.');
    }
  } finally {
    await mongoose.disconnect();
    console.log('\n📴 Disconnected from MongoDB');
  }
}

main().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
