#!/usr/bin/env node
/**
 * One-time helper: mark historical orders as isTestOrder by normalized phone.
 *
 * Default: dry-run (no writes). Prints match count + order ids only (no PII).
 * Write mode: pass --apply explicitly.
 *
 * Usage:
 *   node scripts/mark-test-orders-by-phone.cjs --phone=0501234567
 *   node scripts/mark-test-orders-by-phone.cjs --phone=0501234567 --apply
 *
 * Requires MONGO_URI in backend/.env (or environment).
 * Do not run with --apply until explicitly approved.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const PROJECT = path.resolve(__dirname, '..');
const mongoose = require(path.join(PROJECT, 'backend', 'node_modules', 'mongoose'));

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const raw of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const i = line.indexOf('=');
    const k = line.slice(0, i).trim();
    let v = line.slice(i + 1).trim().replace(/^['"]|['"]$/g, '');
    if (!process.env[k]) process.env[k] = v;
  }
}

function normalizePhone(raw) {
  let digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('00972')) digits = digits.slice(5);
  else if (digits.startsWith('972')) digits = digits.slice(3);
  if (!digits.startsWith('0')) digits = `0${digits}`;
  return digits;
}

function parseArgs(argv) {
  const out = { phone: '', apply: false, help: false };
  for (const arg of argv) {
    if (arg === '--apply') out.apply = true;
    else if (arg === '--help' || arg === '-h') out.help = true;
    else if (arg.startsWith('--phone=')) out.phone = arg.slice('--phone='.length);
  }
  const phoneIdx = argv.indexOf('--phone');
  if (phoneIdx >= 0 && argv[phoneIdx + 1] && !argv[phoneIdx + 1].startsWith('--')) {
    out.phone = argv[phoneIdx + 1];
  }
  return out;
}

function candidatePhones(cd) {
  if (!cd || typeof cd !== 'object') return [];
  const nested = cd.deliveryDetails && typeof cd.deliveryDetails === 'object' ? cd.deliveryDetails : {};
  return [cd.phone, nested.phone, cd.customerPhone, cd.mobile];
}

function phoneMatchFilter(normalized) {
  const bare = normalized.startsWith('0') ? normalized.slice(1) : normalized;
  const variants = [
    normalized,
    bare,
    `972${bare}`,
    `+972${bare}`,
    `00972${bare}`
  ];
  const suffix = bare.slice(-9);
  const phonePaths = [
    'customerDetails.phone',
    'customerDetails.deliveryDetails.phone',
    'customerDetails.customerPhone',
    'customerDetails.mobile'
  ];
  const or = [];
  for (const p of phonePaths) {
    for (const v of variants) {
      or.push({ [p]: v });
    }
    if (suffix) {
      or.push({ [p]: { $regex: `${suffix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$` } });
    }
  }
  return { $or: or };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.phone) {
    console.log(`Usage:
  node scripts/mark-test-orders-by-phone.cjs --phone=<number> [--apply]

Default is dry-run. Pass --apply to write isTestOrder=true.
Phone must be provided as a CLI argument (never hardcoded).`);
    process.exit(args.help ? 0 : 1);
  }

  loadEnvFile(path.join(PROJECT, 'backend', '.env'));
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGO_URI is required');
    process.exit(1);
  }

  const normalized = normalizePhone(args.phone);
  if (!normalized || normalized.length < 9) {
    console.error('Invalid --phone value after normalization');
    process.exit(1);
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 20000 });
  const orders = mongoose.connection.db.collection('orders');

  const matched = await orders
    .find(phoneMatchFilter(normalized), {
      projection: {
        _id: 1,
        isTestOrder: 1,
        'customerDetails.phone': 1,
        'customerDetails.deliveryDetails.phone': 1,
        'customerDetails.customerPhone': 1,
        'customerDetails.mobile': 1
      }
    })
    .toArray();

  const exact = [];
  for (const doc of matched) {
    const hit = candidatePhones(doc.customerDetails).some((c) => normalizePhone(c) === normalized);
    if (hit) {
      exact.push({ _id: String(doc._id), already: doc.isTestOrder === true });
    }
  }

  const toUpdate = exact.filter((e) => !e.already);
  console.log(
    JSON.stringify(
      {
        mode: args.apply ? 'apply' : 'dry-run',
        matchCount: exact.length,
        alreadyTest: exact.filter((e) => e.already).length,
        wouldUpdate: toUpdate.length,
        orderIds: exact.map((e) => e._id)
      },
      null,
      2
    )
  );

  if (!args.apply) {
    console.log('Dry-run only. Re-run with --apply to write.');
    await mongoose.disconnect();
    return;
  }

  if (toUpdate.length === 0) {
    console.log('Nothing to update.');
    await mongoose.disconnect();
    return;
  }

  const ids = toUpdate.map((e) => new mongoose.Types.ObjectId(e._id));
  const result = await orders.updateMany({ _id: { $in: ids } }, { $set: { isTestOrder: true } });
  console.log(JSON.stringify({ updated: result.modifiedCount, matched: result.matchedCount }, null, 2));
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('ERR', err.message || err);
  process.exit(1);
});
