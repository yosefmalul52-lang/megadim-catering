/**
 * One-off: drop legacy videos.videoId_1 / publicId_1 indexes and sync sparse unique indexes.
 * Usage: npx ts-node scripts/fix-video-indexes.ts
 */
import dotenv from 'dotenv';
import path from 'path';
import mongoose from 'mongoose';
import { ensureVideoIndexes } from '../src/utils/ensure-video-indexes';

dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGO_URI = process.env.MONGO_URI;

async function main(): Promise<void> {
  if (!MONGO_URI) {
    console.error('MONGO_URI is not set in backend/.env');
    process.exit(1);
  }

  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');
  await ensureVideoIndexes();
  await mongoose.disconnect();
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
