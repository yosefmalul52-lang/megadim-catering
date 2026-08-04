/**
 * Idempotent backfill: one basic kitchen prep task per active order in date range.
 * Usage:
 *   npx ts-node scripts/backfill-kitchen-prep-tasks.ts --start=2026-08-01 --end=2026-08-31 --dry-run
 * Production Atlas is refused unless --allow-production is passed explicitly.
 */
import dotenv from 'dotenv';
dotenv.config();

import path from 'path';
import mongoose from 'mongoose';
import { backfillKitchenTasks } from '../src/services/kitchen-ops.service';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { assertSafeMongoUri } = require(path.join(
  __dirname,
  '../../scripts/lib/assert-not-production-mongo.cjs'
));

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
}

async function main() {
  if (process.env.NODE_ENV === 'production' && !process.argv.includes('--allow-production')) {
    console.error('[safety] Refusing backfill when NODE_ENV=production');
    process.exit(1);
  }
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  assertSafeMongoUri(uri, {
    allowProduction: process.argv.includes('--allow-production'),
    label: 'kitchen prep backfill'
  });
  await mongoose.connect(uri!);
  const dryRun = process.argv.includes('--dry-run');
  const result = await backfillKitchenTasks({
    startDate: arg('start'),
    endDate: arg('end'),
    dryRun
  });
  console.log(JSON.stringify({ dryRun, ...result }, null, 2));
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  try {
    await mongoose.disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
