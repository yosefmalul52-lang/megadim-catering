#!/usr/bin/env node
/**
 * After Worker is live: set publicUrl on manifest items and re-verify HTTP 200 + sha.
 * Usage: node scripts/verify-r2-public-urls.cjs
 * Reads R2_PUBLIC_BASE_URL from docs/media-migration/.env.r2
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');
const http = require('http');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');

const PROJECT = path.resolve(__dirname, '..');
const DOCS = path.join(PROJECT, 'docs', 'media-migration');
const MANIFEST = path.join(DOCS, 'r2-upload-manifest.json');
const ENV_PATH = path.join(DOCS, '.env.r2');

function loadEnv(p) {
  const out = {};
  for (const raw of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const i = line.indexOf('=');
    out[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^['"]|['"]$/g, '');
  }
  return out;
}

function getBuffer(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    lib
      .get(url, { timeout: 60000 }, (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () =>
          resolve({
            status: res.statusCode || 0,
            ct: (res.headers['content-type'] || '').split(';')[0].trim().toLowerCase(),
            body: Buffer.concat(chunks),
          })
        );
      })
      .on('error', reject);
  });
}

async function streamToBuffer(stream) {
  const chunks = [];
  for await (const c of stream) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
  return Buffer.concat(chunks);
}

async function main() {
  const env = loadEnv(ENV_PATH);
  const base = (env.R2_PUBLIC_BASE_URL || '').replace(/\/+$/, '');
  if (!base) {
    console.error('R2_PUBLIC_BASE_URL missing — deploy Worker first');
    process.exit(1);
  }
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
  });

  let ok = 0;
  let fail = 0;
  for (const item of manifest.items || []) {
    item.publicUrl = `${base}/${item.r2Key}`;
    try {
      const pub = await getBuffer(item.publicUrl);
      const sha = crypto.createHash('sha256').update(pub.body).digest('hex');
      if (pub.status !== 200) throw new Error(`HTTP ${pub.status}`);
      if (sha !== item.sha256) throw new Error('sha mismatch');
      if (pub.body.length !== item.fileSize) throw new Error('size mismatch');
      if (pub.ct && pub.ct !== item.contentType) throw new Error(`ct ${pub.ct}`);
      // cross-check S3 still matches
      const got = await s3.send(new GetObjectCommand({ Bucket: env.R2_BUCKET_NAME, Key: item.r2Key }));
      const remote = await streamToBuffer(got.Body);
      if (crypto.createHash('sha256').update(remote).digest('hex') !== item.sha256) {
        throw new Error('s3 sha mismatch');
      }
      item.verificationStatus = 'verified';
      item.error = null;
      ok += 1;
    } catch (e) {
      item.verificationStatus = 'failed';
      item.error = String(e.message || e);
      fail += 1;
      console.log('FAIL', item.sourcePath, item.error);
    }
  }
  manifest.publicBaseUrl = base;
  manifest.summary = { ...(manifest.summary || {}), verifiedPublic: ok, failedPublic: fail };
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));
  console.log(JSON.stringify({ baseHost: base.replace(/^https:\/\//, ''), ok, fail }, null, 2));
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
