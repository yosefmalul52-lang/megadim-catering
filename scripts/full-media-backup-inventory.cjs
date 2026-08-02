#!/usr/bin/env node
/**
 * Full production media field backup + inventory.
 * Scans known collections for image/media URL fields.
 * Requires --allow-production for Atlas hosts.
 * Does NOT print secrets or full Mongo URI.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { assertSafeMongoUri } = require('./lib/assert-not-production-mongo.cjs');

const PROJECT = path.resolve(__dirname, '..');
const mongoose = require(path.join(PROJECT, 'backend', 'node_modules', 'mongoose'));
const DOCS = path.join(PROJECT, 'docs', 'media-migration');
const BACKEND_ENV = path.join(PROJECT, 'backend', '.env');
const OUT_BACKUP = path.join(DOCS, `full-media-backup-${stamp()}.json`);
const OUT_REPORT = path.join(DOCS, `full-media-inventory-report-${stamp()}.json`);

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

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

function classifyUrl(url) {
  if (!url || !String(url).trim()) return 'empty';
  const u = String(url);
  if (/workers\.dev|r2\.cloudflarestorage|\/api\/media\//i.test(u)) return 'r2';
  if (/cloudinary\.com/i.test(u)) return 'cloudinary';
  if (/^https?:\/\//i.test(u)) return 'other_http';
  if (/^\/?assets\//i.test(u) || u.startsWith('/')) return 'local_asset';
  return 'other';
}

function filenameFromUrl(url) {
  if (!url) return '';
  try {
    const u = new URL(url);
    return decodeURIComponent(u.pathname.split('/').filter(Boolean).pop() || '');
  } catch {
    return String(url).split('/').pop() || '';
  }
}

function headStatus(url) {
  return new Promise((resolve) => {
    if (!url || !/^https?:\/\//i.test(url)) return resolve({ status: 0, contentType: '', bytes: 0 });
    const lib = url.startsWith('https') ? https : http;
    const req = lib.request(url, { method: 'HEAD', timeout: 15000 }, (res) => {
      res.resume();
      resolve({
        status: res.statusCode || 0,
        contentType: String(res.headers['content-type'] || ''),
        bytes: Number(res.headers['content-length'] || 0),
      });
    });
    req.on('error', () => resolve({ status: 0, contentType: '', bytes: 0 }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ status: 0, contentType: '', bytes: 0 });
    });
    req.end();
  });
}

async function probeSample(entries, limit = 40) {
  const httpEntries = entries.filter((e) => /^https?:\/\//i.test(e.oldUrl));
  const sample = httpEntries.slice(0, limit);
  let broken = 0;
  for (const e of sample) {
    const h = await headStatus(e.oldUrl);
    e.probeStatus = h.status;
    e.probeContentType = h.contentType;
    e.probeBytes = h.bytes;
    if (h.status !== 200) broken += 1;
  }
  return { probed: sample.length, brokenInSample: broken };
}

const TARGETS = [
  { collection: 'menuitems', fields: ['imageUrl'] },
  { collection: 'holidayevents', fields: ['imageUrl'] }, // products handled separately
  { collection: 'galleryitems', fields: ['url', 'thumbnail'] },
  { collection: 'videos', fields: ['videoUrl', 'thumbnailUrl'] },
  { collection: 'site_settings', fields: ['kosherCertificateUrl', 'shabbatMenuUrl', 'eventsMenuUrl'] },
  { collection: 'campaigns', fields: ['mediaUrl'] },
  { collection: 'external_invoices', fields: ['fileUrl'] },
  { collection: 'products', fields: ['imageUrl'] }, // legacy
];

async function main() {
  loadEnvFile(BACKEND_ENV);
  const allowProduction = process.argv.includes('--allow-production');
  const probe = !process.argv.includes('--no-probe');
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  assertSafeMongoUri(uri, { allowProduction, label: 'full-media-backup' });

  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  const entries = [];
  const collectionCounts = {};

  const cols = await db.listCollections().toArray();
  const colNames = cols.map((c) => c.name);
  console.log(JSON.stringify({ collectionsFound: colNames.length, mediaTargets: TARGETS.map((t) => t.collection) }));

  for (const t of TARGETS) {
    // resolve actual collection name case-insensitively
    const actual =
      colNames.find((n) => n === t.collection) ||
      colNames.find((n) => n.toLowerCase() === t.collection.toLowerCase());
    if (!actual) {
      collectionCounts[t.collection] = { exists: false, docs: 0, mediaFields: 0 };
      continue;
    }
    const docs = await db.collection(actual).find({}).toArray();
    collectionCounts[actual] = { exists: true, docs: docs.length, mediaFields: 0 };
    for (const doc of docs) {
      for (const field of t.fields) {
        const val = doc[field];
        if (val === undefined) continue;
        collectionCounts[actual].mediaFields += 1;
        entries.push({
          collection: actual,
          documentId: String(doc._id),
          field,
          oldUrl: val || '',
          currentFilename: filenameFromUrl(val || ''),
          classification: classifyUrl(val),
          name: doc.name || doc.title || doc.label || '',
          timestamp: new Date().toISOString(),
        });
      }
      // holiday nested products
      if (actual.toLowerCase() === 'holidayevents' && Array.isArray(doc.products)) {
        doc.products.forEach((p, idx) => {
          if (p && 'imageUrl' in p) {
            collectionCounts[actual].mediaFields += 1;
            entries.push({
              collection: actual,
              documentId: String(doc._id),
              field: `products[${idx}].imageUrl`,
              productId: p._id ? String(p._id) : p.id || '',
              oldUrl: p.imageUrl || '',
              currentFilename: filenameFromUrl(p.imageUrl || ''),
              classification: classifyUrl(p.imageUrl),
              name: p.name || '',
              timestamp: new Date().toISOString(),
            });
          }
        });
      }
    }
  }

  // Order snapshots (sample count only + cloudinary/r2 stats, don't rewrite historical)
  const orderCol =
    colNames.find((n) => n === 'orders') || colNames.find((n) => n.toLowerCase() === 'orders');
  let orderMedia = { docs: 0, itemImageFields: 0, cloudinary: 0, r2: 0, empty: 0, other: 0 };
  if (orderCol) {
    const orders = await db
      .collection(orderCol)
      .find({}, { projection: { items: 1 } })
      .toArray();
    orderMedia.docs = orders.length;
    for (const o of orders) {
      for (const it of o.items || []) {
        if (!('imageUrl' in (it || {}))) continue;
        orderMedia.itemImageFields += 1;
        const c = classifyUrl(it.imageUrl);
        if (c === 'cloudinary') orderMedia.cloudinary += 1;
        else if (c === 'r2') orderMedia.r2 += 1;
        else if (c === 'empty') orderMedia.empty += 1;
        else orderMedia.other += 1;
      }
    }
  }

  const summary = {
    r2: 0,
    cloudinary: 0,
    other_http: 0,
    local_asset: 0,
    other: 0,
    empty: 0,
  };
  for (const e of entries) summary[e.classification] = (summary[e.classification] || 0) + 1;

  let probeStats = { probed: 0, brokenInSample: 0 };
  if (probe) {
    console.log('Probing sample of HTTP media URLs (HEAD)...');
    probeStats = await probeSample(entries, 80);
  }

  const backup = {
    createdAt: new Date().toISOString(),
    note: 'Full media field backup before R2 cutover completion. Cloudinary assets NOT deleted.',
    entryCount: entries.length,
    collectionCounts,
    orderMediaSnapshots: orderMedia,
    classificationSummary: summary,
    probeStats,
    entries,
  };

  const report = {
    createdAt: backup.createdAt,
    entryCount: entries.length,
    classificationSummary: summary,
    collectionCounts,
    orderMediaSnapshots: orderMedia,
    probeStats,
    cloudinaryActive: entries.filter((e) => e.classification === 'cloudinary').map((e) => ({
      collection: e.collection,
      documentId: e.documentId,
      field: e.field,
      name: e.name,
      filename: e.currentFilename,
    })),
    r2Active: entries.filter((e) => e.classification === 'r2').length,
    emptyFields: entries.filter((e) => e.classification === 'empty').length,
  };

  fs.writeFileSync(OUT_BACKUP, JSON.stringify(backup, null, 2));
  fs.writeFileSync(OUT_REPORT, JSON.stringify(report, null, 2));
  // also stable names for tooling
  fs.writeFileSync(path.join(DOCS, 'full-media-backup-latest.json'), JSON.stringify(backup, null, 2));
  fs.writeFileSync(path.join(DOCS, 'full-media-inventory-report-latest.json'), JSON.stringify(report, null, 2));

  console.log(
    JSON.stringify(
      {
        ok: true,
        entryCount: entries.length,
        classificationSummary: summary,
        probeStats,
        backupPath: path.basename(OUT_BACKUP),
        reportPath: path.basename(OUT_REPORT),
        cloudinaryActiveCount: report.cloudinaryActive.length,
        // never print URI
        mongoHostKind: allowProduction ? 'production-allowed' : 'non-production',
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
