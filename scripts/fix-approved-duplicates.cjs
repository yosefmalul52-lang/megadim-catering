#!/usr/bin/env node
/**
 * Apply approved duplicate fixes only:
 * - גרבלקס שמיר ביתי → דגים/2.png
 * - סלק מזרחי → סלטים/29.png
 * Dry-run by default; pass --apply to write.
 * Requires --allow-production for Atlas.
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
const MANIFEST = path.join(DOCS, 'r2-upload-manifest.json');
const BACKEND_ENV = path.join(PROJECT, 'backend', '.env');
const BACKUP = path.join(DOCS, `dup-fix-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);

const FIXES = [
  {
    label: 'גרבלקס שמיר ביתי',
    entityId: '6a394d7656ece9e07f5331b1',
    sourcePath: 'דגים/2.png',
  },
  {
    label: 'סלק מזרחי',
    entityId: '6953f95562a18d63c3d0db40',
    sourcePath: 'סלטים/29.png',
  },
];

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

function requestMeta(method, url) {
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
    req.on('error', () => resolve({ status: 0, contentType: '', bytes: 0 }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ status: 0, contentType: '', bytes: 0 });
    });
    req.end();
  });
}

async function main() {
  const apply = process.argv.includes('--apply');
  const allowProduction = process.argv.includes('--allow-production');
  loadEnvFile(BACKEND_ENV);
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  assertSafeMongoUri(uri, { allowProduction, label: 'fix-approved-duplicates' });

  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  const changes = [];

  for (const fix of FIXES) {
    const item = (manifest.items || []).find(
      (i) => i.entityId === fix.entityId && i.sourcePath === fix.sourcePath && i.verificationStatus === 'verified'
    );
    if (!item || !item.publicUrl) {
      throw new Error(`Missing verified R2 item for ${fix.label} / ${fix.sourcePath}`);
    }
    const head = await requestMeta('HEAD', item.publicUrl);
    const get = await requestMeta('GET', item.publicUrl);
    if (head.status !== 200 || get.status !== 200) {
      throw new Error(`R2 verify failed for ${fix.sourcePath}: HEAD=${head.status} GET=${get.status}`);
    }
    if (!/^image\//i.test(head.contentType || get.contentType)) {
      throw new Error(`Unexpected content-type for ${fix.sourcePath}: ${head.contentType}`);
    }
    changes.push({
      ...fix,
      newUrl: item.publicUrl,
      r2Key: item.r2Key,
      head,
      getBytes: get.bytes,
    });
  }

  await mongoose.connect(uri);
  const col = mongoose.connection.collection('menuitems');
  const backup = { createdAt: new Date().toISOString(), entries: [] };
  const beforeAfter = [];

  for (const ch of changes) {
    const _id = new mongoose.Types.ObjectId(ch.entityId);
    const doc = await col.findOne({ _id }, { projection: { name: 1, imageUrl: 1 } });
    if (!doc) throw new Error(`Menu item not found: ${ch.entityId}`);
    const prev = doc.imageUrl || '';
    backup.entries.push({
      collection: 'menuitems',
      documentId: ch.entityId,
      field: 'imageUrl',
      oldUrl: prev,
      newUrl: ch.newUrl,
      currentFilename: ch.sourcePath,
      timestamp: new Date().toISOString(),
    });
    beforeAfter.push({
      label: ch.label,
      entityId: ch.entityId,
      name: doc.name,
      before: prev,
      after: ch.newUrl,
      sourcePath: ch.sourcePath,
      headStatus: ch.head.status,
      contentType: ch.head.contentType,
      bytes: ch.head.bytes || ch.getBytes,
      identical: prev === ch.newUrl,
    });
    if (apply && prev !== ch.newUrl) {
      await col.updateOne({ _id }, { $set: { imageUrl: ch.newUrl } });
    }
  }

  fs.writeFileSync(BACKUP, JSON.stringify(backup, null, 2));
  // Update mapping-state preferences (local file)
  const statePath = path.join(DOCS, 'mapping-state.json');
  if (fs.existsSync(statePath)) {
    const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    for (const ch of changes) {
      const d = state.decisions?.[ch.sourcePath];
      if (d) {
        d.preferredForEntity = true;
        d.approvalNote = `Production preferred image (approved ${new Date().toISOString()})`;
      }
    }
    // demote losing duplicates
    const losers = {
      'דגים/3.png': '6a394d7656ece9e07f5331b1',
      'סלטים/4.png': '6953f95562a18d63c3d0db40',
    };
    for (const [rel, eid] of Object.entries(losers)) {
      if (state.decisions?.[rel]?.entityId === eid) {
        state.decisions[rel].preferredForEntity = false;
      }
    }
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
  }

  console.log(
    JSON.stringify(
      {
        mode: apply ? 'apply' : 'dry-run',
        backup: path.basename(BACKUP),
        changes: beforeAfter,
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
