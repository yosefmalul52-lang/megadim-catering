#!/usr/bin/env node
/**
 * Rollback DB media fields from a remaining-cloudinary-db-backup-*.json file.
 * Never deletes R2 or Cloudinary objects.
 * Requires --allow-production for Atlas + --apply to write.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { assertSafeMongoUri } = require('./lib/assert-not-production-mongo.cjs');

const PROJECT = path.resolve(__dirname, '..');
const mongoose = require(path.join(PROJECT, 'backend', 'node_modules', 'mongoose'));
const BACKEND_ENV = path.join(PROJECT, 'backend', '.env');

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const raw of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const i = line.indexOf('=');
    const k = line.slice(0, i).trim();
    const v = line.slice(i + 1).trim().replace(/^['"]|['"]$/g, '');
    if (!process.env[k]) process.env[k] = v;
  }
}

async function main() {
  const apply = process.argv.includes('--apply');
  const allowProduction = process.argv.includes('--allow-production');
  const backupArg = process.argv.find((a) => a.startsWith('--backup='));
  const backupPath =
    (backupArg && backupArg.slice('--backup='.length)) ||
    path.join(PROJECT, 'docs', 'media-migration', 'remaining-cloudinary-db-backup-2026-08-02T12-01-20-675Z.json');

  loadEnvFile(BACKEND_ENV);
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  assertSafeMongoUri(uri, { allowProduction, label: 'rollback-remaining-cloudinary' });

  if (!fs.existsSync(backupPath)) throw new Error(`Missing backup ${backupPath}`);
  const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  let ok = 0;
  for (const e of backup.entries || []) {
    const _id = new mongoose.Types.ObjectId(e.documentId);
    const prodMatch = /^products\[(\d+)\]\.imageUrl$/.exec(e.field);
    if (!apply) {
      ok += 1;
      continue;
    }
    if (prodMatch) {
      await db.collection(e.collection).updateOne(
        { _id },
        { $set: { [`products.${Number(prodMatch[1])}.imageUrl`]: e.oldUrl || '' } }
      );
    } else {
      await db.collection(e.collection).updateOne({ _id }, { $set: { [e.field]: e.oldUrl || '' } });
    }
    ok += 1;
  }
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', restored: ok, backup: path.basename(backupPath) }, null, 2));
  await mongoose.disconnect();
}

main().catch(async (e) => {
  console.error(e.message || e);
  try {
    await mongoose.disconnect();
  } catch (_) {}
  process.exit(1);
});
