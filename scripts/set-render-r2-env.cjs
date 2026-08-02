#!/usr/bin/env node
/**
 * Set R2 env vars on Render for magadim-backend (values never printed).
 * Requires: RENDER_API_KEY in env (or docs/media-migration/.env.render gitignored)
 * Optional: RENDER_SERVICE_ID (otherwise discovers by name containing magadim-backend)
 *
 * Usage: node scripts/set-render-r2-env.cjs
 */
'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');

const PROJECT = path.resolve(__dirname, '..');
const DOCS = path.join(PROJECT, 'docs', 'media-migration');

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

function req(method, urlPath, body) {
  const token = process.env.RENDER_API_KEY;
  if (!token) return Promise.reject(new Error('RENDER_API_KEY missing'));
  const payload = body ? JSON.stringify(body) : null;
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'api.render.com',
        path: urlPath,
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          ...(payload
            ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
            : {}),
        },
        timeout: 30000,
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let json = null;
          try {
            json = JSON.parse(text);
          } catch (_) {}
          resolve({ status: res.statusCode || 0, json, text });
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('timeout'));
    });
    if (payload) req.write(payload);
    req.end();
  });
}

async function main() {
  loadEnvFile(path.join(DOCS, '.env.render'));
  loadEnvFile(path.join(DOCS, '.env.r2'));
  loadEnvFile(path.join(PROJECT, 'backend', '.env'));

  if (!process.env.RENDER_API_KEY) {
    console.error('RENDER_API_KEY not available. Cannot set Render env programmatically.');
    console.error('Create docs/media-migration/.env.render with RENDER_API_KEY=... (gitignored).');
    process.exit(2);
  }

  const needed = [
    'R2_ACCOUNT_ID',
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
    'R2_BUCKET_NAME',
    'R2_PUBLIC_BASE_URL',
  ];
  for (const k of needed) {
    if (!process.env[k]) throw new Error(`Missing local ${k}`);
  }
  if (process.env.R2_BUCKET_NAME !== 'megadim-media-prod') {
    throw new Error('R2_BUCKET_NAME must be megadim-media-prod');
  }
  if (!String(process.env.R2_PUBLIC_BASE_URL).includes('megadim-media.megadim.workers.dev')) {
    throw new Error('R2_PUBLIC_BASE_URL must be workers.dev URL');
  }

  let serviceId = process.env.RENDER_SERVICE_ID;
  if (!serviceId) {
    const list = await req('GET', '/v1/services?limit=50');
    if (list.status !== 200) throw new Error(`list services ${list.status}`);
    const services = Array.isArray(list.json) ? list.json : list.json?.items || [];
    const hit = services.find((s) => {
      const name = (s.service?.name || s.name || '').toLowerCase();
      const url = (s.service?.serviceDetails?.url || s.serviceDetails?.url || '').toLowerCase();
      return name.includes('magadim') || name.includes('megadim') || url.includes('magadim-backend');
    });
    serviceId = hit?.service?.id || hit?.id;
    if (!serviceId) {
      console.error('Could not find magadim-backend service. Set RENDER_SERVICE_ID.');
      console.log(
        JSON.stringify(
          {
            serviceNames: services.map((s) => s.service?.name || s.name).filter(Boolean),
          },
          null,
          2
        )
      );
      process.exit(1);
    }
  }

  console.log(JSON.stringify({ serviceIdFound: true, serviceIdPrefix: String(serviceId).slice(0, 6) + '…' }));

  const envPairs = [
    ...needed.map((key) => ({ key, value: process.env[key] })),
    { key: 'R2_MOCK', value: '' }, // clear mock if present
  ];

  // Render bulk update: PUT /v1/services/{serviceId}/env-vars
  const body = envPairs.map(({ key, value }) => ({ key, value }));
  const upd = await req('PUT', `/v1/services/${serviceId}/env-vars`, body);
  if (upd.status >= 200 && upd.status < 300) {
    console.log(JSON.stringify({ ok: true, updatedKeys: needed.concat(['R2_MOCK(clear)']), status: upd.status }));
  } else {
    // fallback: set one-by-one
    const results = [];
    for (const { key, value } of envPairs) {
      const r = await req('PUT', `/v1/services/${serviceId}/env-vars/${encodeURIComponent(key)}`, {
        value,
      });
      results.push({ key, status: r.status, ok: r.status >= 200 && r.status < 300 });
    }
    console.log(JSON.stringify({ ok: results.every((r) => r.ok), results: results.map((r) => ({ key: r.key, status: r.status })) }));
    if (!results.every((r) => r.ok)) process.exit(1);
  }

  // Trigger deploy
  if (process.argv.includes('--deploy')) {
    const d = await req('POST', `/v1/services/${serviceId}/deploys`, { clearCache: 'do_not_clear' });
    console.log(JSON.stringify({ deployTriggered: d.status >= 200 && d.status < 300, status: d.status }));
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
