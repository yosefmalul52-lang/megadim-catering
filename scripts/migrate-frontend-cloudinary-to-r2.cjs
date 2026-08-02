#!/usr/bin/env node
/**
 * Upload unique hardcoded frontend Cloudinary image URLs to R2 and write a rewrite map.
 * Does not delete Cloudinary. Does not modify source until --rewrite.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');
const http = require('http');

const PROJECT = path.resolve(__dirname, '..');
const {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
} = require(path.join(PROJECT, 'backend', 'node_modules', '@aws-sdk/client-s3'));

const DOCS = path.join(PROJECT, 'docs', 'media-migration');
const R2_ENV = path.join(DOCS, '.env.r2');
const MAP_OUT = path.join(DOCS, 'frontend-cloudinary-r2-map.json');

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
  if (!v) throw new Error(`Missing ${name}`);
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
        return reject(new Error(`GET ${res.statusCode}`));
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () =>
        resolve({
          buffer: Buffer.concat(chunks),
          contentType: String(res.headers['content-type'] || 'image/jpeg'),
        })
      );
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('timeout'));
    });
  });
}

function normalizeCloudinaryUrl(url) {
  // Strip transform segments between /upload/ and version
  // e.g. /upload/f_auto,q_auto,w_1200/v123/x.jpg -> /upload/v123/x.jpg
  return url.replace(
    /\/upload\/(?:[^/]+\/)*(v\d+\/)/,
    '/upload/$1'
  );
}

function collectUrls() {
  const urls = new Set();
  const re = /https:\/\/res\.cloudinary\.com\/dioklg7lx\/[^"'`\s)]+/g;
  function walk(dir) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      if (ent.name === 'node_modules' || ent.name === 'dist') continue;
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(p);
      else if (/\.(ts|html|scss|css|json|js)$/.test(ent.name)) {
        const text = fs.readFileSync(p, 'utf8');
        let m;
        while ((m = re.exec(text))) {
          if (!m[0].includes('${')) urls.add(m[0]);
        }
      }
    }
  }
  walk(path.join(PROJECT, 'frontend', 'src'));
  return [...urls];
}

async function streamToBuffer(body) {
  const chunks = [];
  for await (const chunk of body) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

async function main() {
  loadEnvFile(R2_ENV);
  const doUpload = process.argv.includes('--upload');
  const doRewrite = process.argv.includes('--rewrite');
  const urls = collectUrls();
  const canonical = new Map(); // normalized -> [original variants]
  for (const u of urls) {
    const n = normalizeCloudinaryUrl(u);
    if (!canonical.has(n)) canonical.set(n, new Set());
    canonical.get(n).add(u);
  }

  console.log(JSON.stringify({ uniqueRaw: urls.length, uniqueCanonical: canonical.size, doUpload, doRewrite }));

  const map = { createdAt: new Date().toISOString(), items: [] };

  if (doUpload) {
    if (process.env.R2_MOCK === '1') throw new Error('R2_MOCK set');
    const bucket = required('R2_BUCKET_NAME');
    if (bucket !== 'megadim-media-prod') throw new Error('unexpected bucket');
    const publicBase = required('R2_PUBLIC_BASE_URL').replace(/\/+$/, '');
    const client = new S3Client({
      region: 'auto',
      endpoint: `https://${required('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: required('R2_ACCESS_KEY_ID'),
        secretAccessKey: required('R2_SECRET_ACCESS_KEY'),
      },
    });

    for (const [norm, variants] of canonical.entries()) {
      const { buffer, contentType } = await download(norm);
      const sha = crypto.createHash('sha256').update(buffer).digest('hex');
      const ext = /\.png/i.test(norm) || /png/i.test(contentType) ? '.png' : /\.webp/i.test(norm) ? '.webp' : '.jpg';
      const key = `frontend/static/${sha.slice(0, 16)}/original${ext}`;
      let skip = false;
      try {
        const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
        if (head.Metadata?.sha256 === sha && Number(head.ContentLength) === buffer.length) skip = true;
        else if (Number(head.ContentLength) > 0) throw new Error(`key collision ${key}`);
      } catch (e) {
        if (String(e.message || '').includes('collision')) throw e;
      }
      if (!skip) {
        await client.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: buffer,
            ContentType: contentType.startsWith('image/') ? contentType : 'image/jpeg',
            Metadata: { sha256: sha },
            CacheControl: 'public, max-age=31536000, immutable',
          })
        );
        const got = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        const remote = await streamToBuffer(got.Body);
        if (crypto.createHash('sha256').update(remote).digest('hex') !== sha) {
          throw new Error('checksum fail');
        }
      }
      const newUrl = `${publicBase}/${key}`;
      map.items.push({
        canonicalCloudinaryUrl: norm,
        variants: [...variants],
        newR2Key: key,
        newR2Url: newUrl,
        checksum: sha,
        size: buffer.length,
        contentType,
      });
      console.log('OK', path.basename(norm), key);
    }
    fs.writeFileSync(MAP_OUT, JSON.stringify(map, null, 2));
  } else if (fs.existsSync(MAP_OUT)) {
    Object.assign(map, JSON.parse(fs.readFileSync(MAP_OUT, 'utf8')));
  }

  if (doRewrite) {
    if (!map.items?.length) throw new Error('No map — run --upload first');
    const files = [];
    function walk(dir) {
      for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        if (ent.name === 'node_modules' || ent.name === 'dist') continue;
        const p = path.join(dir, ent.name);
        if (ent.isDirectory()) walk(p);
        else if (/\.(ts|html|scss|css|json|js)$/.test(ent.name)) {
          const text = fs.readFileSync(p, 'utf8');
          if (text.includes('res.cloudinary.com/dioklg7lx')) files.push(p);
        }
      }
    }
    walk(path.join(PROJECT, 'frontend', 'src'));

    let replacements = 0;
    for (const fp of files) {
      let text = fs.readFileSync(fp, 'utf8');
      const before = text;
      for (const it of map.items) {
        for (const v of it.variants) {
          if (text.includes(v)) {
            const count = text.split(v).length - 1;
            text = text.split(v).join(it.newR2Url);
            replacements += count;
          }
        }
      }
      if (text !== before) {
        fs.writeFileSync(fp, text);
        console.log('rewrote', path.relative(PROJECT, fp));
      }
    }
    console.log(JSON.stringify({ filesScanned: files.length, replacementOps: replacements, map: MAP_OUT }));
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
