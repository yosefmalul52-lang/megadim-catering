#!/usr/bin/env node
/**
 * Full backup of menu item imageUrl fields (no customers/orders).
 * Output: docs/media-migration/image-url-backup.json
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
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGODB_URI missing');
    process.exit(1);
  }
  const { assertSafeMongoUri } = require('./lib/assert-not-production-mongo.cjs');
  const allowProduction = process.argv.includes('--allow-production');
  assertSafeMongoUri(uri, { allowProduction, label: 'backup-image-urls' });
  await mongoose.connect(uri);
  const col = mongoose.connection.collection('menuitems');
  const docs = await col
    .find({}, { projection: { _id: 1, name: 1, category: 1, imageUrl: 1 } })
    .toArray();

  const backup = {
    createdAt: new Date().toISOString(),
    note: 'Full imageUrl backup before R2 cutover. Cloudinary assets NOT deleted.',
    count: docs.length,
    entries: docs.map((d) => ({
      entityType: 'menuItem',
      entityId: String(d._id),
      entityName: d.name || '',
      category: d.category || '',
      field: 'imageUrl',
      previousValue: d.imageUrl || '',
    })),
  };
  fs.writeFileSync(BACKUP, JSON.stringify(backup, null, 2), 'utf8');
  console.log(JSON.stringify({ backedUp: backup.count, path: BACKUP }, null, 2));
  await mongoose.disconnect();
}

main().catch(async (e) => {
  console.error(e.message || e);
  try {
    await mongoose.disconnect();
  } catch (_) {}
  process.exit(1);
});
