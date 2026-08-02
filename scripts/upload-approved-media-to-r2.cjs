#!/usr/bin/env node
/**
 * One-off: upload manually approved media originals to Cloudflare R2.
 * Modes: --dry-run | --upload
 *
 * - Does NOT modify MongoDB / imageUrl
 * - Does NOT delete Cloudinary
 * - Does NOT re-encode / resize / recompress sources
 * - Uploads only approvalStatus === 'אושרה' with valid entityId
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');
const http = require('http');
const { pathToFileURL } = require('url');

const PROJECT = path.resolve(__dirname, '..');
const DOCS = path.join(PROJECT, 'docs', 'media-migration');
const STATE_PATH = path.join(DOCS, 'mapping-state.json');
const MAPPING_PATH = path.join(DOCS, 'mapping-file.json');
const ENTITIES_PATH = path.join(DOCS, 'entities-export.json');
const MANIFEST_PATH = path.join(DOCS, 'r2-upload-manifest.json');
const ENV_CANDIDATES = [
  path.join(DOCS, '.env.r2'),
  path.join(DOCS, '.env.local'),
  path.join(PROJECT, '.env.r2'),
  path.join(PROJECT, '.env.local'),
];

const REQUIRED_ENV = [
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET_NAME',
  'R2_PUBLIC_BASE_URL',
];

function loadDotEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return false;
  const text = fs.readFileSync(filePath, 'utf8');
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const i = line.indexOf('=');
    const key = line.slice(0, i).trim();
    let val = line.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env) || process.env[key] === '') {
      process.env[key] = val;
    }
  }
  return true;
}

function maskEnvReport() {
  return REQUIRED_ENV.map((k) => {
    const v = process.env[k];
    return `${k}=${v ? `SET(len=${v.length})` : 'MISSING'}`;
  }).join('\n');
}

function sha256Buffer(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function detectMimeAndExt(buf, sourceFile) {
  const ext = path.extname(sourceFile || '').toLowerCase();
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return { contentType: 'image/png', ext: '.png' };
  }
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { contentType: 'image/jpeg', ext: '.jpg' };
  }
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    return { contentType: 'image/webp', ext: '.webp' };
  }
  if (ext === '.png') return { contentType: 'image/png', ext: '.png' };
  if (ext === '.jpg' || ext === '.jpeg') return { contentType: 'image/jpeg', ext: ext };
  if (ext === '.webp') return { contentType: 'image/webp', ext: '.webp' };
  return { contentType: 'application/octet-stream', ext: ext || '.bin' };
}

function readPngSize(buf) {
  if (buf.length < 24) return null;
  if (!(buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47)) return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function readJpegSize(buf) {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) {
      i += 1;
      continue;
    }
    const marker = buf[i + 1];
    if (marker === 0xd9 || marker === 0xda) break;
    const len = buf.readUInt16BE(i + 2);
    if (len < 2) break;
    // SOF0..SOF3, SOF5..SOF7, SOF9..SOF11, SOF13..SOF15
    if (
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf)
    ) {
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    }
    i += 2 + len;
  }
  return null;
}

function readImageSize(buf) {
  return readPngSize(buf) || readJpegSize(buf) || null;
}

function resolveSourceRoot(mapping) {
  let root =
    (mapping && mapping.sourceRoot) ||
    process.env.MEDIA_SOURCE_ROOT ||
    path.join(PROJECT, 'media-migration-input');
  root = path.resolve(root);
  try {
    if (fs.lstatSync(root).isSymbolicLink()) root = fs.realpathSync(root);
  } catch (_) {}
  return root;
}

function safeJoin(root, rel) {
  const full = path.resolve(root, rel);
  if (!full.startsWith(root + path.sep) && full !== root) return null;
  return full;
}

function httpGetBuffer(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) return reject(new Error('too many redirects'));
    const lib = url.startsWith('https:') ? https : http;
    const req = lib.get(url, { timeout: 60000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return resolve(httpGetBuffer(res.headers.location, redirects + 1));
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode || 0,
          headers: res.headers,
          body: Buffer.concat(chunks),
        });
      });
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy(new Error('timeout'));
    });
  });
}

function publicUrl(base, key) {
  return `${String(base).replace(/\/+$/, '')}/${key.replace(/^\/+/, '')}`;
}

function parseArgs(argv) {
  const mode = argv.includes('--upload') ? 'upload' : argv.includes('--dry-run') ? 'dry-run' : null;
  const continueOnError = argv.includes('--continue-on-error');
  return { mode, continueOnError };
}

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function validateAndCollect() {
  const report = {
    ok: true,
    blocks: [],
    counts: {},
    approved: [],
  };

  if (!fs.existsSync(STATE_PATH)) {
    report.ok = false;
    report.blocks.push('mapping-state.json missing');
    return report;
  }
  if (!fs.existsSync(MAPPING_PATH)) {
    report.ok = false;
    report.blocks.push('mapping-file.json missing');
    return report;
  }
  if (!fs.existsSync(ENTITIES_PATH)) {
    report.ok = false;
    report.blocks.push('entities-export.json missing');
    return report;
  }

  const state = loadJson(STATE_PATH);
  const mapping = loadJson(MAPPING_PATH);
  const entities = loadJson(ENTITIES_PATH);
  const byId = new Map((entities.menuItems || []).map((m) => [m.entityId, m]));
  const decisions = state.decisions || {};
  const sourceRoot = resolveSourceRoot(mapping);

  const statuses = { אושרה: 0, 'דורשת בדיקה': 0, 'ללא התאמה': 0, כפולה: 0, 'התאמה מוצעת': 0, 'לא טופלה': 0 };
  for (const d of Object.values(decisions)) {
    const s = d.approvalStatus || 'לא טופלה';
    statuses[s] = (statuses[s] || 0) + 1;
  }
  report.counts = {
    approved: statuses['אושרה'] || 0,
    needsReview: statuses['דורשת בדיקה'] || 0,
    unmatched: statuses['ללא התאמה'] || 0,
    duplicates: statuses['כפולה'] || 0,
    proposed: statuses['התאמה מוצעת'] || 0,
    untouched: statuses['לא טופלה'] || 0,
    totalDecisions: Object.keys(decisions).length,
    savedAt: state.savedAt || null,
    userConfirmedAt: state.userConfirmedAt || null,
    sourceRoot,
  };

  // Unapproved (needs-review / duplicates / unmatched) are skipped — never guessed.
  report.skipped = Object.values(decisions)
    .filter((d) => d.approvalStatus !== 'אושרה')
    .map((d) => ({ relativePath: d.relativePath, approvalStatus: d.approvalStatus }));

  const approved = Object.values(decisions).filter((d) => d.approvalStatus === 'אושרה');

  // entityId gates + source + entity existence
  for (const d of approved) {
    const rel = d.relativePath;
    if (!d.entityId) {
      report.ok = false;
      report.blocks.push(`approved-without-entityId: ${rel}`);
      continue;
    }
    if (!byId.has(d.entityId)) {
      report.ok = false;
      report.blocks.push(`unknown-entityId: ${rel} -> ${d.entityId}`);
      continue;
    }
    const abs = safeJoin(sourceRoot, rel);
    if (!abs || !fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
      report.ok = false;
      report.blocks.push(`missing-source: ${rel}`);
      continue;
    }
  }

  // duplicate product among approved without allowSharedImage
  const byEntity = new Map();
  for (const d of approved) {
    if (!d.entityId) continue;
    if (!byEntity.has(d.entityId)) byEntity.set(d.entityId, []);
    byEntity.get(d.entityId).push(d);
  }
  for (const [eid, items] of byEntity.entries()) {
    if (items.length <= 1) continue;
    const allShared = items.every((x) => !!x.allowSharedImage);
    if (!allShared) {
      report.ok = false;
      report.blocks.push(
        `duplicate-product-without-share: ${eid} <- ${items.map((x) => x.relativePath).join(', ')}`
      );
    }
  }

  if (report.ok) {
    for (const d of approved) {
      const ent = byId.get(d.entityId);
      const abs = safeJoin(sourceRoot, d.relativePath);
      const buf = fs.readFileSync(abs);
      const sha = sha256Buffer(buf);
      const mime = detectMimeAndExt(buf, d.sourceFile || d.relativePath);
      // Prefer original filename extension; keep as on disk
      const diskExt = path.extname(d.relativePath).toLowerCase() || mime.ext;
      const dims = readImageSize(buf) || {
        width: d.width || null,
        height: d.height || null,
      };
      const assetId = sha.slice(0, 16);
      const entityType = d.entityType || 'menuItem';
      const r2Key = `${entityType}/${d.entityId}/${assetId}/original${diskExt}`;
      report.approved.push({
        sourcePath: abs,
        relativePath: d.relativePath,
        entityType,
        entityId: d.entityId,
        entityName: d.entityName || (ent && ent.entityName) || '',
        originalImageUrl: d.currentImageUrl || (ent && ent.currentImageUrl) || '',
        r2Key,
        publicUrl: null, // filled when env known
        sha256: sha,
        fileSize: buf.length,
        width: dims.width,
        height: dims.height,
        contentType: mime.contentType,
        buffer: buf,
      });
    }
  }

  report.mapping = mapping;
  report.entities = entities;
  report.state = state;
  return report;
}

async function getS3() {
  const { S3Client, HeadObjectCommand, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
  const accountId = process.env.R2_ACCOUNT_ID;
  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
  return { client, HeadObjectCommand, PutObjectCommand, GetObjectCommand, bucket: process.env.R2_BUCKET_NAME };
}

async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

async function headExists(s3, key) {
  try {
    const out = await s3.client.send(
      new s3.HeadObjectCommand({ Bucket: s3.bucket, Key: key })
    );
    return out;
  } catch (err) {
    const code = err && (err.name || err.Code || err.$metadata?.httpStatusCode);
    if (code === 'NotFound' || code === 404 || err.$metadata?.httpStatusCode === 404) return null;
    throw err;
  }
}

async function verifyPublicAndObject(item, downloaded, contentTypeHeader, publicStatus) {
  const issues = [];
  const remoteSha = sha256Buffer(downloaded);
  if (remoteSha !== item.sha256) issues.push(`sha256 mismatch local=${item.sha256} remote=${remoteSha}`);
  if (downloaded.length !== item.fileSize) issues.push(`size mismatch local=${item.fileSize} remote=${downloaded.length}`);
  const ct = (contentTypeHeader || '').split(';')[0].trim().toLowerCase();
  if (ct && ct !== item.contentType) issues.push(`content-type mismatch expected=${item.contentType} got=${ct}`);
  const dims = readImageSize(downloaded);
  if (!dims) issues.push('could not read remote dimensions');
  else {
    if (dims.width !== item.width) issues.push(`width mismatch local=${item.width} remote=${dims.width}`);
    if (dims.height !== item.height) issues.push(`height mismatch local=${item.height} remote=${dims.height}`);
  }
  if (publicStatus !== 200) issues.push(`public url HTTP ${publicStatus}`);
  return issues;
}

async function main() {
  const { mode, continueOnError } = parseArgs(process.argv.slice(2));
  if (!mode) {
    console.error('Usage: node scripts/upload-approved-media-to-r2.cjs --dry-run | --upload');
    process.exit(2);
  }

  // Load local R2 env only (never print secrets)
  let loadedEnvFrom = null;
  for (const p of ENV_CANDIDATES) {
    if (loadDotEnvFile(p)) {
      loadedEnvFrom = p;
      break;
    }
  }

  console.log('=== Megadim R2 upload (approved only) ===');
  console.log('mode:', mode);
  console.log('env file:', loadedEnvFrom || '(none — using process env only)');
  console.log(maskEnvReport());

  const validation = validateAndCollect();
  console.log('\n=== Mapping counts ===');
  console.log(JSON.stringify(validation.counts, null, 2));

  if (validation.skipped && validation.skipped.length) {
    console.log('\n=== Skipped (not approved) ===');
    validation.skipped.forEach((s) => console.log('-', s.approvalStatus, s.relativePath));
  }
  if (validation.blocks.length) {
    console.log('\n=== BLOCKED ===');
    validation.blocks.forEach((b) => console.log('-', b));
  }

  const missingEnv = REQUIRED_ENV.filter((k) => !process.env[k]);
  // dry-run may proceed without public URL only for planning; upload requires all
  const missingForMode =
    mode === 'dry-run'
      ? missingEnv.filter((k) => k !== 'R2_PUBLIC_BASE_URL' || !process.env.R2_PUBLIC_BASE_URL)
      : missingEnv;
  // Always require core R2 secrets
  const coreMissing = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME'].filter(
    (k) => !process.env[k]
  );
  if (coreMissing.length) {
    console.log('\n=== R2 ENV MISSING ===');
    coreMissing.forEach((k) => console.log('-', k));
    console.log('\nFill docs/media-migration/.env.r2 from r2.env.example, then re-run.');
    console.log('No MongoDB changes. No Cloudinary deletes. No upload performed.');
    process.exit(1);
  }

  if (!validation.ok) {
    console.log('\nFix mapping gates, then re-run. No upload performed.');
    console.log('No MongoDB changes. No Cloudinary deletes.');
    process.exit(1);
  }

  const baseUrl = process.env.R2_PUBLIC_BASE_URL || '';
  for (const item of validation.approved) {
    item.publicUrl = baseUrl ? publicUrl(baseUrl, item.r2Key) : null;
  }

  console.log(`\nApproved ready for ${mode}: ${validation.approved.length}`);

  const manifest = {
    createdAt: new Date().toISOString(),
    mode,
    sourceRoot: validation.counts.sourceRoot,
    bucket: process.env.R2_BUCKET_NAME,
    publicBaseUrl: baseUrl,
    note: 'No MongoDB writes. No Cloudinary deletes. Originals uploaded byte-for-byte.',
    items: [],
    summary: {},
  };

  if (mode === 'dry-run') {
    for (const item of validation.approved) {
      manifest.items.push({
        sourcePath: item.relativePath,
        entityType: item.entityType,
        entityId: item.entityId,
        entityName: item.entityName,
        originalImageUrl: item.originalImageUrl,
        r2Key: item.r2Key,
        publicUrl: item.publicUrl,
        sha256: item.sha256,
        fileSize: item.fileSize,
        width: item.width,
        height: item.height,
        contentType: item.contentType,
        uploadStatus: 'dry-run',
        verificationStatus: 'skipped',
        databaseUpdateStatus: 'pending',
        error: null,
      });
    }
    manifest.summary = {
      approved: validation.approved.length,
      uploaded: 0,
      verified: 0,
      failed: 0,
      dryRun: validation.approved.length,
      skippedUnapproved: (validation.skipped || []).length,
    };
    fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf8');
    console.log('\nDry-run OK. Manifest:', MANIFEST_PATH);
    console.log('Sample keys:');
    validation.approved.slice(0, 5).forEach((i) => console.log('-', i.r2Key));
    console.log('\nNo MongoDB changes. No Cloudinary deletes. No objects uploaded.');
    process.exit(0);
  }

  // upload mode — public URL optional: if missing, verify via GetObject only
  const requirePublic = !!process.env.R2_PUBLIC_BASE_URL;
  if (!requirePublic) {
    console.log('\nNOTE: R2_PUBLIC_BASE_URL empty — will verify via R2 GetObject only (no public Worker check).');
  }
  for (const item of validation.approved) {
    item.publicUrl = requirePublic ? publicUrl(baseUrl, item.r2Key) : null;
  }
  let s3;
  try {
    s3 = await getS3();
  } catch (err) {
    console.error('Failed to load @aws-sdk/client-s3. Install as root devDependency.');
    console.error(String(err && err.message ? err.message : err));
    process.exit(1);
  }

  let uploaded = 0;
  let verified = 0;
  let failed = 0;
  const failures = [];

  for (const item of validation.approved) {
    const row = {
      sourcePath: item.relativePath,
      entityType: item.entityType,
      entityId: item.entityId,
      entityName: item.entityName,
      originalImageUrl: item.originalImageUrl,
      r2Key: item.r2Key,
      publicUrl: item.publicUrl,
      sha256: item.sha256,
      fileSize: item.fileSize,
      width: item.width,
      height: item.height,
      contentType: item.contentType,
      uploadStatus: 'pending',
      verificationStatus: 'pending',
      databaseUpdateStatus: 'pending',
      error: null,
    };

    try {
      const existing = await headExists(s3, item.r2Key);
      if (existing) {
        const metaSha = (existing.Metadata && (existing.Metadata.sha256 || existing.Metadata.Sha256)) || null;
        const sizeOk = Number(existing.ContentLength) === item.fileSize;
        const shaOk = metaSha && metaSha === item.sha256;
        if (!sizeOk || !shaOk) {
          // Fetch object to compare bytes before refusing overwrite
          const got = await s3.client.send(
            new s3.GetObjectCommand({ Bucket: s3.bucket, Key: item.r2Key })
          );
          const remoteBuf = await streamToBuffer(got.Body);
          const remoteSha = sha256Buffer(remoteBuf);
          if (remoteSha !== item.sha256 || remoteBuf.length !== item.fileSize) {
            throw new Error(
              `object exists at key but content differs (refusing overwrite). remoteSha=${remoteSha}`
            );
          }
        }
        row.uploadStatus = 'already-exists-identical';
      } else {
        await s3.client.send(
          new s3.PutObjectCommand({
            Bucket: s3.bucket,
            Key: item.r2Key,
            Body: item.buffer,
            ContentType: item.contentType,
            Metadata: { sha256: item.sha256 },
            CacheControl: 'public, max-age=31536000, immutable',
          })
        );
        row.uploadStatus = 'uploaded';
      }
      uploaded += 1;

      // Verify via GetObject (authoritative); public HTTP if base URL configured
      const got = await s3.client.send(
        new s3.GetObjectCommand({ Bucket: s3.bucket, Key: item.r2Key })
      );
      const remoteBuf = await streamToBuffer(got.Body);
      const remoteCt = got.ContentType || '';
      const issues = [];
      const remoteSha = sha256Buffer(remoteBuf);
      if (remoteSha !== item.sha256) issues.push(`sha256 mismatch local=${item.sha256} remote=${remoteSha}`);
      if (remoteBuf.length !== item.fileSize) issues.push(`size mismatch local=${item.fileSize} remote=${remoteBuf.length}`);
      const ct = (remoteCt || '').split(';')[0].trim().toLowerCase();
      if (ct && ct !== item.contentType) issues.push(`content-type mismatch expected=${item.contentType} got=${ct}`);
      const dims = readImageSize(remoteBuf);
      if (!dims) issues.push('could not read remote dimensions');
      else {
        if (dims.width !== item.width) issues.push(`width mismatch local=${item.width} remote=${dims.width}`);
        if (dims.height !== item.height) issues.push(`height mismatch local=${item.height} remote=${dims.height}`);
      }
      if (item.publicUrl) {
        const pub = await httpGetBuffer(item.publicUrl);
        if (pub.statusCode !== 200) issues.push(`public url HTTP ${pub.statusCode}`);
        else {
          const pubSha = sha256Buffer(pub.body);
          if (pubSha !== item.sha256) issues.push('public body sha256 mismatch');
          if (pub.body.length !== item.fileSize) issues.push('public body size mismatch');
          const pubCt = (pub.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
          if (pubCt && pubCt !== item.contentType) issues.push(`public content-type mismatch got=${pubCt}`);
        }
      }
      if (issues.length) {
        row.verificationStatus = 'failed';
        row.databaseUpdateStatus = 'blocked';
        row.error = issues.join('; ');
        failed += 1;
        failures.push({ path: item.relativePath, error: row.error });
        if (!continueOnError) {
          manifest.items.push(row);
          break;
        }
      } else {
        row.verificationStatus = item.publicUrl ? 'verified' : 'verified-s3-pending-public';
        row.databaseUpdateStatus = 'pending';
        verified += 1;
      }
    } catch (err) {
      row.uploadStatus = row.uploadStatus === 'pending' ? 'failed' : row.uploadStatus;
      row.verificationStatus = 'failed';
      row.databaseUpdateStatus = 'blocked';
      row.error = String(err && err.message ? err.message : err);
      failed += 1;
      failures.push({ path: item.relativePath, error: row.error });
      if (!continueOnError) {
        manifest.items.push(row);
        break;
      }
    }

    // Drop buffer from memory for subsequent rows
    item.buffer = null;
    manifest.items.push(row);
    console.log(
      `[${manifest.items.length}/${validation.approved.length}] ${item.relativePath} -> ${row.uploadStatus}/${row.verificationStatus}`
    );
  }

  manifest.summary = {
    approved: validation.approved.length,
    uploaded,
    verified,
    failed,
    processed: manifest.items.length,
  };
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf8');

  console.log('\n=== Summary ===');
  console.log(JSON.stringify(manifest.summary, null, 2));
  console.log('Manifest:', MANIFEST_PATH);
  if (failures.length) {
    console.log('Failures:');
    failures.forEach((f) => console.log('-', f.path, f.error));
  } else {
    console.log('Sample public URLs:');
    manifest.items.filter((i) => i.verificationStatus === 'verified').slice(0, 5).forEach((i) => {
      console.log('-', i.publicUrl);
    });
  }
  console.log('\nNo MongoDB changes. No Cloudinary deletes. Stopped after upload/verify.');
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal:', err && err.message ? err.message : err);
  console.error('No MongoDB changes. No Cloudinary deletes.');
  process.exit(1);
});
