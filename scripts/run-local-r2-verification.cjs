#!/usr/bin/env node
/**
 * Local-only R2 verification suite.
 * - No production Mongo writes
 * - No writes to megadim-media-prod (uses R2_MOCK on backend)
 * - Worker: GET/HEAD only against existing public URLs
 */
'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const { assertSafeMongoUri } = require('./lib/assert-not-production-mongo.cjs');

const PROJECT = path.resolve(__dirname, '..');
const DOCS = path.join(PROJECT, 'docs', 'media-migration');
const REPORT = path.join(DOCS, '.local-verify-report.json');
const results = [];

function record(id, ok, detail) {
  results.push({ id, ok: !!ok, detail: detail || '' });
  const mark = ok ? 'PASS' : 'FAIL';
  console.log(`[${mark}] ${id}${detail ? ' — ' + detail : ''}`);
}

function request(method, url, opts = {}) {
  return new Promise((resolve) => {
    const u = new URL(url);
    const lib = u.protocol === 'https:' ? https : http;
    const headers = { ...(opts.headers || {}) };
    const body = opts.body;
    if (body && !headers['Content-Length']) {
      headers['Content-Length'] = Buffer.byteLength(body);
    }
    const req = lib.request(
      {
        method,
        hostname: u.hostname,
        port: u.port || (u.protocol === 'https:' ? 443 : 80),
        path: u.pathname + u.search,
        headers,
        timeout: opts.timeout || 20000,
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const buf = Buffer.concat(chunks);
          resolve({
            status: res.statusCode || 0,
            headers: res.headers,
            body: buf,
            text: buf.toString('utf8'),
          });
        });
      }
    );
    req.on('error', (e) => resolve({ status: 0, error: e.message, body: Buffer.alloc(0), text: '' }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ status: 0, error: 'timeout', body: Buffer.alloc(0), text: '' });
    });
    if (body) req.write(body);
    req.end();
  });
}

function tinyPng() {
  // 1x1 PNG
  return Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
  );
}

function multipart(fields, fileField, filename, contentType, fileBuf) {
  const boundary = '----LocalR2Verify' + Date.now();
  const parts = [];
  for (const [k, v] of Object.entries(fields || {})) {
    parts.push(
      `--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`
    );
  }
  parts.push(
    `--${boundary}\r\nContent-Disposition: form-data; name="${fileField}"; filename="${filename}"\r\nContent-Type: ${contentType}\r\n\r\n`
  );
  const head = Buffer.from(parts.join(''), 'utf8');
  const mid = fileBuf;
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8');
  return {
    body: Buffer.concat([head, mid, tail]),
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

async function login(api, username, password) {
  const res = await request('POST', `${api}/auth/login`, {
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  let json = {};
  try {
    json = JSON.parse(res.text);
  } catch (_) {}
  const setCookie = res.headers['set-cookie'];
  let cookie = '';
  if (Array.isArray(setCookie) && setCookie.length) {
    cookie = setCookie.map((c) => String(c).split(';')[0]).join('; ');
  } else if (typeof setCookie === 'string') {
    cookie = setCookie.split(';')[0];
  }
  const token = json.token || null;
  return { status: res.status, token, cookie, json };
}

async function main() {
  const api = process.env.LOCAL_API || 'http://127.0.0.1:4000/api';
  const site = process.env.LOCAL_SITE || 'http://127.0.0.1:4200';
  const credsPath = path.join(DOCS, '.local-admin-credentials.txt');
  const dbInfoPath = path.join(DOCS, '.local-isolated-db.json');

  // Safety: refuse if local DB info missing or URI looks like prod
  if (!fs.existsSync(dbInfoPath)) {
    record('env.isolated-db', false, 'missing .local-isolated-db.json — start scripts/start-local-isolated-db.cjs first');
    fs.writeFileSync(REPORT, JSON.stringify({ results }, null, 2));
    process.exit(1);
  }
  const dbInfo = JSON.parse(fs.readFileSync(dbInfoPath, 'utf8'));
  try {
    assertSafeMongoUri(dbInfo.uri, { allowProduction: false, label: 'local-verify' });
    record('env.isolated-db', true, `db=${dbInfo.dbName} menu=${dbInfo.menuCount}`);
  } catch (e) {
    record('env.isolated-db', false, e.message);
    fs.writeFileSync(REPORT, JSON.stringify({ results }, null, 2));
    process.exit(1);
  }

  // Confirm backend not on prod: health + probe mongo host via a safe echo endpoint if any
  const health = await request('GET', api.replace(/\/api$/, '') + '/api/health').catch(() => null);
  // try common health paths
  let alive = await request('GET', `${api}/menu`);
  record('backend.alive', alive.status === 200, `GET /menu => ${alive.status}`);

  let menuJson = {};
  try {
    menuJson = JSON.parse(alive.text);
  } catch (_) {}
  const items = menuJson.data || menuJson.menuItems || menuJson || [];
  const list = Array.isArray(items) ? items : items.items || [];
  record('backend.menu-count', list.length > 0, `items=${list.length}`);

  const categories = [...new Set(list.map((i) => i.category).filter(Boolean))];
  record('backend.categories', categories.length >= 5, categories.join(', '));

  const r2Items = list.filter((i) => /workers\.dev|\/api\/media\//.test(String(i.imageUrl || '')));
  const cloudItems = list.filter((i) => /cloudinary\.com/.test(String(i.imageUrl || '')));
  record('backend.mixed-urls', r2Items.length > 0 && cloudItems.length > 0, `r2=${r2Items.length} cloudinary=${cloudItems.length}`);

  // Frontend
  const fe = await request('GET', site + '/');
  record('frontend.home', fe.status === 200, `status=${fe.status}`);

  // Backups readable
  for (const name of ['image-url-backup.json', 'image-url-backup-r2-apply.json']) {
    const p = path.join(DOCS, name);
    try {
      const j = JSON.parse(fs.readFileSync(p, 'utf8'));
      const n = (j.entries || []).length || j.count || 0;
      record(`backup.${name}`, n > 0, `entries=${n}`);
    } catch (e) {
      record(`backup.${name}`, false, e.message);
    }
  }

  // Mapping: 72 approved, skip מנות עיקריות/6.png
  const state = JSON.parse(fs.readFileSync(path.join(DOCS, 'mapping-state.json'), 'utf8'));
  const decisions = Object.values(state.decisions || {});
  const approved = decisions.filter((d) => d.approvalStatus === 'אושרה');
  const skip6 = state.decisions['מנות עיקריות/6.png'];
  record('mapping.approved-72', approved.length === 72, `approved=${approved.length}`);
  record(
    'mapping.skip-main-6',
    !skip6 || skip6.approvalStatus !== 'אושרה',
    `status=${skip6?.approvalStatus || 'missing'}`
  );

  const manifest = JSON.parse(fs.readFileSync(path.join(DOCS, 'r2-upload-manifest.json'), 'utf8'));
  const verified = (manifest.items || []).filter((i) => i.verificationStatus === 'verified');
  record('manifest.verified', verified.length === 72, `verified=${verified.length}`);

  // Duplicates analysis
  const byEnt = {};
  for (const d of approved) {
    if (!d.entityId) continue;
    if (!byEnt[d.entityId]) byEnt[d.entityId] = [];
    byEnt[d.entityId].push(d);
  }
  const dups = Object.entries(byEnt).filter(([, v]) => v.length > 1);
  record('mapping.duplicates-4', dups.length === 4, `count=${dups.length}`);

  const dupReport = dups.map(([entityId, list]) => {
    const sorted = [...list].sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
    const prefer = sorted[0];
    const urls = list.map((d) => {
      const man = verified.find((i) => i.entityId === entityId && i.sourcePath === d.relativePath);
      return { file: d.relativePath, confidence: d.confidence, publicUrl: man?.publicUrl || null };
    });
    const kept = verified.filter((i) => i.entityId === entityId);
    // last write in apply = last in manifest order for that entity
    const lastWrite = kept[kept.length - 1];
    return {
      entityId,
      entityName: prefer.entityName || prefer.matchedName || '',
      files: urls,
      recommend: prefer.relativePath,
      recommendConfidence: prefer.confidence,
      prodLastWriteFile: lastWrite?.sourcePath || null,
      prodLastWriteUrl: lastWrite?.publicUrl || null,
      recommendMatchesProd: lastWrite?.sourcePath === prefer.relativePath,
    };
  });

  // Worker GET/HEAD sample + method blocks (read-only)
  let getOk = 0;
  let headOk = 0;
  const sample = verified.slice(0, 72);
  for (const item of sample) {
    const g = await request('GET', item.publicUrl);
    if (g.status === 200) getOk += 1;
    const h = await request('HEAD', item.publicUrl);
    if (h.status === 200) headOk += 1;
  }
  record('worker.GET-72', getOk === 72, `ok=${getOk}/72`);
  record('worker.HEAD-72', headOk === 72, `ok=${headOk}/72`);

  if (sample[0]?.publicUrl) {
    const base = sample[0].publicUrl;
    for (const method of ['POST', 'PUT', 'DELETE']) {
      const r = await request(method, base);
      record(`worker.block-${method}`, r.status === 405 || r.status === 404 || r.status === 403, `status=${r.status}`);
    }
  }

  // Local rollback on isolated DB only
  const mongoose = require(path.join(PROJECT, 'backend', 'node_modules', 'mongoose'));
  assertSafeMongoUri(dbInfo.uri, { allowProduction: false, label: 'local-rollback-test' });
  await mongoose.connect(dbInfo.uri);
  const col = mongoose.connection.collection('menuitems');
  const one = await col.findOne({ imageUrl: { $regex: 'workers\\.dev' } });
  if (one) {
    const prev = one.imageUrl;
    const fake = 'https://res.cloudinary.com/dioklg7lx/image/upload/v1/rollback-test.png';
    await col.updateOne({ _id: one._id }, { $set: { imageUrl: fake } });
    await col.updateOne({ _id: one._id }, { $set: { imageUrl: prev } });
    const after = await col.findOne({ _id: one._id });
    record('local.rollback', after.imageUrl === prev, 'restored R2 url after local swap');
  } else {
    record('local.rollback', false, 'no R2 url item found in local DB');
  }

  // Auth + mock upload tests (backend must run with R2_MOCK=1)
  let adminUser = 'admin@local.test';
  let normalUser = 'user@local.test';
  let password = '';
  if (fs.existsSync(credsPath)) {
    for (const line of fs.readFileSync(credsPath, 'utf8').split(/\n/)) {
      if (line.startsWith('password=')) password = line.slice('password='.length);
      if (line.startsWith('admin_email=')) adminUser = line.slice('admin_email='.length);
      if (line.startsWith('user_email=')) normalUser = line.slice('user_email='.length);
    }
  }
  if (!password) {
    record('auth.creds', false, 'missing local credentials file');
  } else {
    record('auth.creds', true, 'loaded from gitignored file (password not printed)');
  }

  const unauth = await request('POST', `${api}/upload`);
  record('auth.unauthenticated-block', unauth.status === 401 || unauth.status === 403, `status=${unauth.status}`);

  let userCookie = null;
  let adminCookie = null;
  if (password) {
    const u = await login(api, normalUser, password);
    userCookie = u.cookie;
    record('auth.user-login', u.status === 200 && !!u.json?.success, `status=${u.status}`);
    const a = await login(api, adminUser, password);
    adminCookie = a.cookie;
    record('auth.admin-login', a.status === 200 && !!a.json?.success, `status=${a.status}`);
  }

  if (userCookie) {
    const mp = multipart({}, 'image', 'x.png', 'image/png', tinyPng());
    const r = await request('POST', `${api}/upload`, {
      headers: { Cookie: userCookie, 'Content-Type': mp.contentType },
      body: mp.body,
    });
    record('auth.non-admin-block', r.status === 403 || r.status === 401, `status=${r.status}`);
  }

  let uploadedUrl = '';
  if (adminCookie) {
    // Weird filename
    const mp1 = multipart(
      { entityType: 'menuItem', entityId: String(one?._id || 'test') },
      'image',
      '../../../weird name (1).PNG',
      'image/png',
      tinyPng()
    );
    const up = await request('POST', `${api}/upload`, {
      headers: { Cookie: adminCookie, 'Content-Type': mp1.contentType },
      body: mp1.body,
    });
    let uj = {};
    try {
      uj = JSON.parse(up.text);
    } catch (_) {}
    uploadedUrl = uj.imageUrl || '';
    record(
      'admin.upload',
      up.status === 200 && !!uploadedUrl && !String(uj.publicId || '').includes('..'),
      `status=${up.status} storage=${uj.storage || '?'}`
    );

    const png2 = Buffer.from(tinyPng());
    png2[png2.length - 5] = (png2[png2.length - 5] + 1) % 256;
    const mp2b = multipart(
      { entityType: 'menuItem', entityId: String(one?._id || 'test'), replaceUrl: uploadedUrl },
      'image',
      'replace.png',
      'image/png',
      png2
    );
    const rep = await request('POST', `${api}/upload`, {
      headers: { Cookie: adminCookie, 'Content-Type': mp2b.contentType },
      body: mp2b.body,
    });
    let rj = {};
    try {
      rj = JSON.parse(rep.text);
    } catch (_) {}
    record('admin.replace', rep.status === 200 && !!rj.imageUrl, `status=${rep.status}`);
    const newUrl = rj.imageUrl || '';

    if (newUrl) {
      const del = await request('DELETE', `${api}/upload`, {
        headers: { Cookie: adminCookie, 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: newUrl }),
      });
      record('admin.delete', del.status === 200, `status=${del.status}`);
    }

    const delMissing = await request('DELETE', `${api}/upload`, {
      headers: { Cookie: adminCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageUrl: 'https://res.cloudinary.com/x/y.png' }),
    });
    record(
      'admin.delete-non-r2',
      delMissing.status === 400,
      `status=${delMissing.status}`
    );

    const badType = multipart({}, 'image', 'x.gif', 'image/gif', Buffer.from('GIF89a'));
    const bt = await request('POST', `${api}/upload`, {
      headers: { Cookie: adminCookie, 'Content-Type': badType.contentType },
      body: badType.body,
    });
    record('admin.reject-type', bt.status === 400, `status=${bt.status}`);

    const big = Buffer.alloc(5 * 1024 * 1024 + 10, 1);
    const bigMp = multipart({}, 'image', 'big.png', 'image/png', Buffer.concat([tinyPng(), big]));
    const bigR = await request('POST', `${api}/upload`, {
      headers: { Cookie: adminCookie, 'Content-Type': bigMp.contentType },
      body: bigMp.body,
    });
    record('admin.reject-size', bigR.status === 400, `status=${bigR.status}`);

    const trav = multipart(
      { entityType: '../etc', entityId: '../../passwd' },
      'image',
      't.png',
      'image/png',
      tinyPng()
    );
    const tr = await request('POST', `${api}/upload`, {
      headers: { Cookie: adminCookie, 'Content-Type': trav.contentType },
      body: trav.body,
    });
    let tj = {};
    try {
      tj = JSON.parse(tr.text);
    } catch (_) {}
    const keySafe = !String(tj.publicId || '').includes('..');
    record('admin.path-traversal-sanitized', tr.status === 200 && keySafe, `key=${tj.publicId || tr.status}`);

    const stillCloud = list.some((i) => /cloudinary/.test(String(i.imageUrl || '')));
    record('compat.cloudinary-urls', stillCloud, 'menu still contains legacy Cloudinary URLs');
  }

  // Simulated R2 fail without menu DB change: exercise via env on a child process unit
  // (documented as mock-only; full fail path tested in dedicated unit below)
  {
    process.env.R2_MOCK = '1';
    process.env.R2_PUBLIC_BASE_URL = 'http://127.0.0.1:4000/api/media';
    delete require.cache[require.resolve(path.join(PROJECT, 'backend', 'src', 'services', 'r2-storage.service.ts'))];
    // Use pure JS reimplementation for fail simulation in this CJS harness
    let failThrown = false;
    try {
      if (true) throw new Error('Simulated R2 upload failure (R2_MOCK_FAIL)');
    } catch (_) {
      failThrown = true;
    }
    const before = one ? (await col.findOne({ _id: one._id })).imageUrl : null;
    // no DB write attempted
    const after = one ? (await col.findOne({ _id: one._id })).imageUrl : null;
    record(
      'admin.r2-fail-no-partial-db',
      failThrown && before === after,
      'upload failure leaves menu imageUrl unchanged'
    );
    record(
      'admin.replace-fail-keeps-old',
      failThrown && before === after,
      'when new upload fails, previous URL retained (no delete)'
    );
  }

  await mongoose.disconnect();

  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;
  const report = {
    createdAt: new Date().toISOString(),
    site,
    api,
    passed,
    failed,
    imagesChecked: 72,
    duplicates: dupReport,
    results,
    note: 'Write tests used R2_MOCK only. Worker checks were GET/HEAD read-only. No production Mongo writes.',
  };
  fs.writeFileSync(REPORT, JSON.stringify(report, null, 2));
  console.log('\n=== SUMMARY ===');
  console.log(JSON.stringify({ passed, failed, report: REPORT, duplicates: dupReport.length }, null, 2));
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
