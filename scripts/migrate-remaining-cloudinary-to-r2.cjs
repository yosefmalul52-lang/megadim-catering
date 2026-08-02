#!/usr/bin/env node
/**
 * Migrate remaining ACTIVE Cloudinary image URLs (from inventory) to R2.
 * Skips: videos (native Cloudinary), invoices, order snapshots, empty fields.
 * Never deletes Cloudinary objects.
 *
 * Usage:
 *   node scripts/migrate-remaining-cloudinary-to-r2.cjs --allow-production --dry-run
 *   node scripts/migrate-remaining-cloudinary-to-r2.cjs --allow-production --upload
 *   node scripts/migrate-remaining-cloudinary-to-r2.cjs --allow-production --apply-db
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');
const http = require('http');
const { assertSafeMongoUri } = require('./lib/assert-not-production-mongo.cjs');

const PROJECT = path.resolve(__dirname, '..');
const {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
} = require(path.join(PROJECT, 'backend', 'node_modules', '@aws-sdk/client-s3'));
const mongoose = require(path.join(PROJECT, 'backend', 'node_modules', 'mongoose'));

const DOCS = path.join(PROJECT, 'docs', 'media-migration');
const INVENTORY = path.join(DOCS, 'full-media-backup-latest.json');
const R2_ENV = path.join(DOCS, '.env.r2');
const BACKEND_ENV = path.join(PROJECT, 'backend', '.env');
const MANIFEST = path.join(DOCS, 'remaining-cloudinary-manifest.json');

const SKIP_COLLECTIONS = new Set(['videos', 'external_invoices', 'orders']);
const IMAGE_FIELD_OK = (field) =>
  /imageUrl$|^url$|^thumbnail$|kosherCertificateUrl|mediaUrl/i.test(field) &&
  !/videoUrl|MenuUrl|fileUrl/i.test(field);

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

function required(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

function download(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, { timeout: 60000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return download(res.headers.location).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`GET ${url} => ${res.statusCode}`));
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () =>
        resolve({
          buffer: Buffer.concat(chunks),
          contentType: String(res.headers['content-type'] || 'application/octet-stream'),
        })
      );
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('download timeout'));
    });
  });
}

function headOrGet(method, url) {
  return new Promise((resolve) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.request(url, { method, timeout: 20000 }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        resolve({
          status: res.statusCode || 0,
          contentType: String(res.headers['content-type'] || ''),
          bytes: Number(res.headers['content-length'] || Buffer.concat(chunks).length),
        });
      });
    });
    req.on('error', () => resolve({ status: 0 }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ status: 0 });
    });
    req.end();
  });
}

function extFrom(contentType, url) {
  if (/png/i.test(contentType) || /\.png(\?|$)/i.test(url)) return '.png';
  if (/webp/i.test(contentType) || /\.webp(\?|$)/i.test(url)) return '.webp';
  if (/gif/i.test(contentType)) return '.gif';
  if (/pdf/i.test(contentType)) return '.pdf';
  return '.jpg';
}

function entityTypeFor(collection, field) {
  if (collection === 'menuitems') return 'menuItem';
  if (collection === 'holidayEvents') return field.startsWith('products') ? 'holidayProduct' : 'holidayEvent';
  if (collection === 'galleryitems') return 'gallery';
  if (collection === 'site_settings') return 'siteSettings';
  if (collection === 'campaigns') return 'campaign';
  return 'misc';
}

async function streamToBuffer(body) {
  const chunks = [];
  for await (const chunk of body) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

async function main() {
  const dryRun = process.argv.includes('--dry-run') || !process.argv.includes('--upload');
  const doUpload = process.argv.includes('--upload');
  const applyDb = process.argv.includes('--apply-db');
  const allowProduction = process.argv.includes('--allow-production');

  loadEnvFile(BACKEND_ENV);
  loadEnvFile(R2_ENV);

  if (process.env.R2_MOCK === '1' || process.env.R2_MOCK === 'true') {
    throw new Error('R2_MOCK is set — refusing production migration');
  }

  const inventory = JSON.parse(fs.readFileSync(INVENTORY, 'utf8'));
  const candidates = (inventory.entries || []).filter((e) => {
    if (e.classification !== 'cloudinary') return false;
    if (SKIP_COLLECTIONS.has(e.collection)) return false;
    if (!IMAGE_FIELD_OK(e.field)) return false;
    if (!e.oldUrl) return false;
    return true;
  });

  // Deduplicate by URL+collection+doc+field
  const seen = new Set();
  const unique = [];
  for (const c of candidates) {
    const k = `${c.collection}|${c.documentId}|${c.field}|${c.oldUrl}`;
    if (seen.has(k)) continue;
    seen.add(k);
    unique.push(c);
  }

  console.log(JSON.stringify({ candidates: unique.length, dryRun: !doUpload, applyDb }, null, 2));

  let client = null;
  let bucket = null;
  let publicBase = null;
  if (doUpload || applyDb) {
    bucket = required('R2_BUCKET_NAME');
    if (bucket !== 'megadim-media-prod') {
      throw new Error(`Refusing unexpected bucket: ${bucket}`);
    }
    publicBase = required('R2_PUBLIC_BASE_URL').replace(/\/+$/, '');
    if (!publicBase.includes('megadim-media.megadim.workers.dev')) {
      throw new Error(`Unexpected R2_PUBLIC_BASE_URL host`);
    }
    client = new S3Client({
      region: 'auto',
      endpoint: `https://${required('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: required('R2_ACCESS_KEY_ID'),
        secretAccessKey: required('R2_SECRET_ACCESS_KEY'),
      },
    });
  }

  let manifest = { createdAt: new Date().toISOString(), items: [] };
  if (fs.existsSync(MANIFEST) && (applyDb || process.argv.includes('--resume'))) {
    manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  }

  const byKey = new Map();
  for (const it of manifest.items || []) {
    if (it.newR2Key) byKey.set(`${it.collection}|${it.documentId}|${it.field}`, it);
  }

  for (const c of unique) {
    const id = `${c.collection}|${c.documentId}|${c.field}`;
    if (byKey.has(id) && byKey.get(id).verificationStatus === 'verified' && !process.argv.includes('--force')) {
      continue;
    }
    const item = {
      oldCloudinaryUrl: c.oldUrl,
      collection: c.collection,
      documentId: c.documentId,
      field: c.field,
      name: c.name || '',
      newR2Key: null,
      newR2Url: null,
      checksum: null,
      size: null,
      contentType: null,
      verificationStatus: 'pending',
    };

    if (!doUpload) {
      item.verificationStatus = 'dry-run';
      manifest.items.push(item);
      byKey.set(id, item);
      continue;
    }

    try {
      const { buffer, contentType } = await download(c.oldUrl);
      const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
      const ext = extFrom(contentType, c.oldUrl);
      const entityType = entityTypeFor(c.collection, c.field);
      const entityId = String(c.documentId).replace(/[^a-zA-Z0-9_-]/g, '') || 'unassigned';
      const key = `${entityType}/${entityId}/${sha256.slice(0, 16)}/original${ext}`;

      let skipPut = false;
      try {
        const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
        if (head.Metadata?.sha256 === sha256 && Number(head.ContentLength) === buffer.length) {
          skipPut = true;
        } else if (Number(head.ContentLength) > 0) {
          throw new Error(`R2 key exists with different content: ${key}`);
        }
      } catch (err) {
        if (err?.name !== 'NotFound' && err?.$metadata?.httpStatusCode !== 404 && !String(err.message || '').includes('different content')) {
          if (String(err.message || '').includes('different content')) throw err;
          // NotFound continues to put
        }
        if (String(err.message || '').includes('different content')) throw err;
      }

      if (!skipPut) {
        await client.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: buffer,
            ContentType: contentType.startsWith('image/') || contentType === 'application/pdf' ? contentType : 'image/jpeg',
            Metadata: { sha256 },
            CacheControl: 'public, max-age=31536000, immutable',
          })
        );
        const got = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        const remote = await streamToBuffer(got.Body);
        const remoteSha = crypto.createHash('sha256').update(remote).digest('hex');
        if (remoteSha !== sha256) throw new Error('checksum mismatch after upload');
      }

      const publicUrl = `${publicBase}/${key}`;
      const head = await headOrGet('HEAD', publicUrl);
      const get = await headOrGet('GET', publicUrl);
      if (head.status !== 200 || get.status !== 200) {
        throw new Error(`public verify failed HEAD=${head.status} GET=${get.status}`);
      }

      item.newR2Key = key;
      item.newR2Url = publicUrl;
      item.checksum = sha256;
      item.size = buffer.length;
      item.contentType = contentType;
      item.verificationStatus = 'verified';
      item.skippedExistingIdentical = skipPut;
      console.log('OK', c.collection, c.name || c.documentId, key);
    } catch (err) {
      item.verificationStatus = 'failed';
      item.error = String(err.message || err);
      console.error('FAIL', c.collection, c.documentId, item.error);
    }

    // replace prior entry for same id
    manifest.items = (manifest.items || []).filter(
      (x) => `${x.collection}|${x.documentId}|${x.field}` !== id
    );
    manifest.items.push(item);
    byKey.set(id, item);
    fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));
  }

  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));

  const verified = (manifest.items || []).filter((i) => i.verificationStatus === 'verified');
  const failed = (manifest.items || []).filter((i) => i.verificationStatus === 'failed');
  const dry = (manifest.items || []).filter((i) => i.verificationStatus === 'dry-run');

  // Detect duplicate target keys with different sources
  const keyOwners = new Map();
  let dupKeys = 0;
  for (const it of verified) {
    if (!it.newR2Key) continue;
    if (keyOwners.has(it.newR2Key) && keyOwners.get(it.newR2Key) !== it.oldCloudinaryUrl) dupKeys += 1;
    keyOwners.set(it.newR2Key, it.oldCloudinaryUrl);
  }

  console.log(
    JSON.stringify(
      {
        verified: verified.length,
        failed: failed.length,
        dryRunEntries: dry.length,
        duplicateTargetKeys: dupKeys,
      },
      null,
      2
    )
  );

  if (failed.length || dupKeys) {
    console.error('Stopping before DB apply due to failures or duplicate keys.');
    process.exit(1);
  }

  if (!applyDb) {
    console.log('DB not updated (pass --apply-db after --upload verification).');
    process.exit(0);
  }

  if (!verified.length) {
    console.error('No verified items to apply');
    process.exit(1);
  }

  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  assertSafeMongoUri(uri, { allowProduction, label: 'migrate-remaining-cloudinary-apply' });
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  const applyBackup = {
    createdAt: new Date().toISOString(),
    note: 'Backup before remaining Cloudinary→R2 DB apply. Cloudinary NOT deleted.',
    entries: [],
  };

  let updated = 0;
  for (const it of verified) {
    const col = db.collection(it.collection);
    const _id = new mongoose.Types.ObjectId(it.documentId);
    const prodMatch = /^products\[(\d+)\]\.imageUrl$/.exec(it.field);
    if (prodMatch) {
      const idx = Number(prodMatch[1]);
      const doc = await col.findOne({ _id });
      if (!doc) throw new Error(`missing doc ${it.documentId}`);
      const prev = doc.products?.[idx]?.imageUrl || '';
      applyBackup.entries.push({
        collection: it.collection,
        documentId: it.documentId,
        field: it.field,
        oldUrl: prev,
        newUrl: it.newR2Url,
        timestamp: new Date().toISOString(),
      });
      if (prev === it.newR2Url) continue;
      await col.updateOne(
        { _id },
        { $set: { [`products.${idx}.imageUrl`]: it.newR2Url } }
      );
      updated += 1;
    } else {
      const doc = await col.findOne({ _id }, { projection: { [it.field]: 1 } });
      if (!doc) throw new Error(`missing doc ${it.documentId}`);
      const prev = doc[it.field] || '';
      applyBackup.entries.push({
        collection: it.collection,
        documentId: it.documentId,
        field: it.field,
        oldUrl: prev,
        newUrl: it.newR2Url,
        timestamp: new Date().toISOString(),
      });
      if (prev === it.newR2Url) continue;
      await col.updateOne({ _id }, { $set: { [it.field]: it.newR2Url } });
      updated += 1;
    }
    it.databaseUpdateStatus = 'updated';
  }

  const backupPath = path.join(
    DOCS,
    `remaining-cloudinary-db-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
  );
  fs.writeFileSync(backupPath, JSON.stringify(applyBackup, null, 2));
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));

  console.log(
    JSON.stringify(
      {
        updated,
        backup: path.basename(backupPath),
        verified: verified.length,
      },
      null,
      2
    )
  );
  await mongoose.disconnect();
}

main().catch(async (e) => {
  console.error(e.message || e);
  try {
    await mongoose.disconnect();
  } catch (_) {}
  process.exit(1);
});
