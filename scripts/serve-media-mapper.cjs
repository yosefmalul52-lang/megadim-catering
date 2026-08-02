#!/usr/bin/env node
/**
 * Local media mapping tool (NOT part of production site).
 * Read-only originals + read-only entity export. No R2. No Mongo writes.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PROJECT = path.resolve(__dirname, '..');
const DOCS = path.join(PROJECT, 'docs', 'media-migration');
const PORT = Number(process.env.MEDIA_MAPPER_PORT || 4178);
const SOURCE =
  process.env.MEDIA_SOURCE_ROOT ||
  path.join(PROJECT, 'media-migration-input');

const FILES = {
  html: path.join(DOCS, 'mapper.html'),
  mapping: path.join(DOCS, 'mapping-file.json'),
  entities: path.join(DOCS, 'entities-export.json'),
  state: path.join(DOCS, 'mapping-state.json'),
  plan: path.join(DOCS, 'r2-phase-plan.md'),
};

function resolveSource() {
  let root = path.resolve(SOURCE);
  try {
    if (fs.lstatSync(root).isSymbolicLink()) root = fs.realpathSync(root);
  } catch (_) {}
  return root;
}

const SOURCE_ROOT = resolveSource();

function safeJoin(root, rel) {
  const full = path.resolve(root, decodeURIComponent(rel));
  if (!full.startsWith(root + path.sep) && full !== root) return null;
  return full;
}

function send(res, code, body, type) {
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(body);
  res.writeHead(code, {
    'Content-Type': type,
    'Content-Length': buf.length,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(buf);
}

function sendJson(res, code, obj) {
  send(res, code, JSON.stringify(obj, null, 2), 'application/json; charset=utf-8');
}

const server = http.createServer((req, res) => {
  try {
    const u = new URL(req.url, `http://127.0.0.1:${PORT}`);
    const p = u.pathname;

    if (req.method === 'GET' && (p === '/' || p === '/mapper.html')) {
      return send(res, 200, fs.readFileSync(FILES.html), 'text/html; charset=utf-8');
    }
    if (req.method === 'GET' && p === '/api/mapping') {
      return send(res, 200, fs.readFileSync(FILES.mapping), 'application/json; charset=utf-8');
    }
    if (req.method === 'GET' && p === '/api/entities') {
      return send(res, 200, fs.readFileSync(FILES.entities), 'application/json; charset=utf-8');
    }
    if (req.method === 'GET' && p === '/api/state') {
      if (!fs.existsSync(FILES.state)) return sendJson(res, 200, { decisions: {}, savedAt: null });
      return send(res, 200, fs.readFileSync(FILES.state), 'application/json; charset=utf-8');
    }
    if (req.method === 'PUT' && p === '/api/state') {
      let raw = '';
      req.on('data', (c) => (raw += c));
      req.on('end', () => {
        try {
          const parsed = JSON.parse(raw);
          // Validate: approved must have entityId
          const decisions = parsed.decisions || {};
          for (const [key, d] of Object.entries(decisions)) {
            if (d.approvalStatus === 'אושרה' && !d.entityId) {
              return sendJson(res, 400, {
                ok: false,
                message: `לא ניתן לאשר ללא entityId: ${key}`,
              });
            }
          }
          parsed.savedAt = new Date().toISOString();
          parsed.noDbWrites = true;
          parsed.noR2Uploads = true;
          fs.writeFileSync(FILES.state, JSON.stringify(parsed, null, 2), 'utf8');
          // Also mirror into mapping-file approvals overlay is state-only
          sendJson(res, 200, { ok: true, savedAt: parsed.savedAt });
        } catch (e) {
          sendJson(res, 400, { ok: false, message: 'Invalid JSON' });
        }
      });
      return;
    }
    if (req.method === 'GET' && p.startsWith('/original/')) {
      const rel = p.slice('/original/'.length);
      const full = safeJoin(SOURCE_ROOT, rel);
      if (!full || !fs.existsSync(full)) {
        res.writeHead(404);
        return res.end('Not found');
      }
      const buf = fs.readFileSync(full);
      let ctype = 'application/octet-stream';
      try {
        const map = JSON.parse(fs.readFileSync(FILES.mapping, 'utf8'));
        const hit = (map.images || []).find((i) => i.relativePath === decodeURIComponent(rel));
        if (hit?.uploadContentType || hit?.detectedMime) ctype = hit.uploadContentType || hit.detectedMime;
      } catch (_) {}
      return send(res, 200, buf, ctype);
    }

    res.writeHead(404);
    res.end('Not found');
  } catch (err) {
    console.error(err);
    res.writeHead(500);
    res.end('Server error');
  }
});

for (const [k, f] of Object.entries(FILES)) {
  if (k === 'state' || k === 'plan') continue;
  if (!fs.existsSync(f)) {
    console.error('Missing required file:', f);
    process.exit(1);
  }
}
if (!fs.existsSync(SOURCE_ROOT)) {
  console.error('Missing media source:', SOURCE_ROOT);
  process.exit(1);
}

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Media mapper (local only) http://127.0.0.1:${PORT}`);
  console.log('Source:', SOURCE_ROOT);
  console.log('NO Mongo writes. NO R2 uploads. NOT in production build.');
});
