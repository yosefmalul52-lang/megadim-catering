#!/usr/bin/env node
/**
 * Apply verified R2 public URLs to MongoDB menu item imageUrl fields.
 * Requires: upload manifest with verificationStatus verified (public Worker OK).
 * Creates image-url-backup.json + rollback script. Never deletes Cloudinary assets.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const PROJECT = path.resolve(__dirname, '..');
const mongoose = require(path.join(PROJECT, 'backend', 'node_modules', 'mongoose'));
const DOCS = path.join(PROJECT, 'docs', 'media-migration');
const MANIFEST = path.join(DOCS, 'r2-upload-manifest.json');
const BACKUP = path.join(DOCS, 'image-url-backup-r2-apply.json');
const R2_ENV = path.join(DOCS, '.env.r2');
const BACKEND_ENV = path.join(PROJECT, 'backend', '.env');

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

function httpStatus(url) {
  return new Promise((resolve) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.request(url, { method: 'HEAD', timeout: 20000 }, (res) => {
      res.resume();
      resolve(res.statusCode || 0);
    });
    req.on('error', () => resolve(0));
    req.on('timeout', () => {
      req.destroy();
      resolve(0);
    });
    req.end();
  });
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const forceS3Only = process.argv.includes('--allow-s3-only'); // dangerous: skip public check

  loadEnvFile(BACKEND_ENV);
  loadEnvFile(R2_ENV);

  if (!fs.existsSync(MANIFEST)) {
    console.error('Missing manifest', MANIFEST);
    process.exit(1);
  }
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  const items = (manifest.items || []).filter((i) => {
    if (i.verificationStatus === 'verified' && i.publicUrl) return true;
    if (forceS3Only && String(i.verificationStatus || '').startsWith('verified')) return true;
    return false;
  });

  if (!items.length) {
    console.error(
      'No fully verified public items in manifest. Deploy Worker, set R2_PUBLIC_BASE_URL, re-verify, then retry.'
    );
    console.error('Refusing DB update. No Mongo writes performed.');
    process.exit(1);
  }

  // Safety: never write localhost/127.0.0.1 URLs into shared/production MongoDB
  // unless explicitly forced (local-only experiments).
  const allowLocal = process.argv.includes('--allow-localhost');
  const localItems = items.filter((i) => /localhost|127\.0\.0\.1/.test(String(i.publicUrl || '')));
  if (localItems.length && !allowLocal && !dryRun) {
    console.error(
      `Refusing to apply ${localItems.length} localhost media URLs to MongoDB (would break production site).`
    );
    console.error('Deploy megadim-media Worker (workers.dev), set R2_PUBLIC_BASE_URL, re-verify, then apply.');
    console.error('No Mongo writes performed.');
    process.exit(1);
  }

  if (!forceS3Only) {
    const skipProbe = process.argv.includes('--skip-probe') || dryRun;
    if (!skipProbe) {
      console.log('Probing public URLs...');
      for (const item of items) {
        const st = await httpStatus(item.publicUrl);
        if (st !== 200) {
          console.error('Public URL not 200:', item.sourcePath, st);
          console.error('Aborting before any DB write.');
          process.exit(1);
        }
      }
    } else {
      console.log('Skipping live probe (dry-run or --skip-probe); using prior verificationStatus.');
    }
  }

  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGODB_URI missing');
    process.exit(1);
  }

  const { assertSafeMongoUri } = require('./lib/assert-not-production-mongo.cjs');
  const allowProduction = process.argv.includes('--allow-production');
  assertSafeMongoUri(uri, { allowProduction, label: 'apply-r2-urls-to-db' });

  await mongoose.connect(uri);
  const col = mongoose.connection.collection('menuitems');

  const backup = {
    createdAt: new Date().toISOString(),
    note: 'Rollback Cloudinary/original imageUrl values. Cloudinary assets were NOT deleted.',
    entries: [],
  };

  let updated = 0;
  let skipped = 0;
  const failures = [];

  for (const item of items) {
    try {
      const _id = new mongoose.Types.ObjectId(item.entityId);
      const doc = await col.findOne({ _id }, { projection: { imageUrl: 1, name: 1 } });
      if (!doc) {
        failures.push({ entityId: item.entityId, error: 'not found in DB' });
        continue;
      }
      const prev = doc.imageUrl || '';
      const next = item.publicUrl;
      backup.entries.push({
        entityType: item.entityType || 'menuItem',
        entityId: item.entityId,
        field: 'imageUrl',
        previousValue: prev,
        newValue: next,
        sourcePath: item.sourcePath,
        r2Key: item.r2Key,
      });

      if (prev === next) {
        skipped += 1;
        item.databaseUpdateStatus = 'already-applied';
        continue;
      }

      if (dryRun) {
        item.databaseUpdateStatus = 'dry-run';
        updated += 1;
        continue;
      }

      const r = await col.updateOne({ _id }, { $set: { imageUrl: next } });
      if (r.matchedCount !== 1) {
        failures.push({ entityId: item.entityId, error: 'update matched 0' });
        item.databaseUpdateStatus = 'failed';
        continue;
      }
      item.databaseUpdateStatus = 'updated';
      updated += 1;
    } catch (e) {
      failures.push({ entityId: item.entityId, error: String(e.message || e) });
      item.databaseUpdateStatus = 'failed';
    }
  }

  fs.writeFileSync(BACKUP, JSON.stringify(backup, null, 2), 'utf8');
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2), 'utf8');

  console.log(
    JSON.stringify(
      {
        mode: dryRun ? 'dry-run' : 'apply',
        candidates: items.length,
        updated,
        skippedIdentical: skipped,
        failures: failures.length,
        backup: BACKUP,
      },
      null,
      2
    )
  );
  if (failures.length) {
    console.log('Failures:');
    failures.forEach((f) => console.log('-', f.entityId, f.error));
  }

  await mongoose.disconnect();
  console.log('Cloudinary assets were NOT deleted.');
  process.exit(failures.length ? 1 : 0);
}

main().catch(async (e) => {
  console.error('Fatal:', e.message || e);
  try {
    await mongoose.disconnect();
  } catch (_) {}
  process.exit(1);
});
