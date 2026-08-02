#!/usr/bin/env node
/**
 * Rollback menu item imageUrl values from docs/media-migration/image-url-backup.json
 * Does not delete R2 or Cloudinary objects.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const PROJECT = path.resolve(__dirname, '..');
const mongoose = require(path.join(PROJECT, 'backend', 'node_modules', 'mongoose'));
const BACKUP = path.join(PROJECT, 'docs', 'media-migration', 'image-url-backup.json');
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
  loadEnvFile(BACKEND_ENV);
  if (!fs.existsSync(BACKUP)) {
    console.error('Missing backup', BACKUP);
    process.exit(1);
  }
  const backup = JSON.parse(fs.readFileSync(BACKUP, 'utf8'));
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGODB_URI missing');
    process.exit(1);
  }
  const { assertSafeMongoUri } = require('./lib/assert-not-production-mongo.cjs');
  const allowProduction = process.argv.includes('--allow-production');
  assertSafeMongoUri(uri, { allowProduction, label: 'rollback-image-urls' });
  await mongoose.connect(uri);
  const col = mongoose.connection.collection('menuitems');
  let ok = 0;
  let fail = 0;
  for (const e of backup.entries || []) {
    try {
      const _id = new mongoose.Types.ObjectId(e.entityId);
      await col.updateOne({ _id }, { $set: { imageUrl: e.previousValue || '' } });
      ok += 1;
    } catch (err) {
      fail += 1;
      console.error('fail', e.entityId, err.message || err);
    }
  }
  console.log(JSON.stringify({ restored: ok, failed: fail, backup: BACKUP }, null, 2));
  await mongoose.disconnect();
  process.exit(fail ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e.message || e);
  try {
    await mongoose.disconnect();
  } catch (_) {}
  process.exit(1);
});
