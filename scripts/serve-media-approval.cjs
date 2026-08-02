#!/usr/bin/env node
/**
 * Read-only local server for media approval UI.
 * Serves original image bytes unchanged from MEDIA_SOURCE_ROOT.
 * Does NOT upload to R2, does NOT modify source files, does NOT touch MongoDB.
 *
 * Usage:
 *   node scripts/serve-media-approval.mjs
 *   MEDIA_SOURCE_ROOT="/path/to/drive-download-..." node scripts/serve-media-approval.mjs
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const DEFAULT_SOURCE =
  '/Users/yosefmalul/Desktop/megadim-media-source/drive-download-20260802T091911Z-1-001';
const SOURCE_ROOT = path.resolve(process.env.MEDIA_SOURCE_ROOT || DEFAULT_SOURCE);
const PORT = Number(process.env.MEDIA_APPROVAL_PORT || 4177);
const INV = path.join(PROJECT_ROOT, 'docs/media-migration/source-inventory.json');
const MAP = path.join(PROJECT_ROOT, 'docs/media-migration/mapping-draft.json');
const STATE = path.join(PROJECT_ROOT, 'docs/media-migration/local-approval-state.json');
const HTML = path.join(PROJECT_ROOT, 'docs/media-migration/approval.html');

function safeJoin(root, rel) {
  const decoded = decodeURIComponent(rel);
  const full = path.resolve(root, decoded);
  if (!full.startsWith(root + path.sep) && full !== root) {
    return null;
  }
  return full;
}

function sendJson(res, code, obj) {
  const body = JSON.stringify(obj, null, 2);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function sendFile(res, filePath, contentType) {
  const buf = fs.readFileSync(filePath);
  res.writeHead(200, {
    'Content-Type': contentType,
    'Content-Length': buf.length,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  res.end(buf);
}

const server = http.createServer((req, res) => {
  try {
    const u = new URL(req.url, `http://127.0.0.1:${PORT}`);
    const p = u.pathname;

    if (req.method === 'GET' && (p === '/' || p === '/approval.html')) {
      return sendFile(res, HTML, 'text/html; charset=utf-8');
    }
    if (req.method === 'GET' && p === '/api/inventory') {
      return sendFile(res, INV, 'application/json; charset=utf-8');
    }
    if (req.method === 'GET' && p === '/api/mapping') {
      return sendFile(res, MAP, 'application/json; charset=utf-8');
    }
    if (req.method === 'GET' && p === '/api/state') {
      if (!fs.existsSync(STATE)) return sendJson(res, 200, { decisions: {} });
      return sendFile(res, STATE, 'application/json; charset=utf-8');
    }
    if (req.method === 'PUT' && p === '/api/state') {
      let raw = '';
      req.on('data', (c) => (raw += c));
      req.on('end', () => {
        try {
          const parsed = JSON.parse(raw);
          fs.writeFileSync(STATE, JSON.stringify(parsed, null, 2), 'utf8');
          sendJson(res, 200, { ok: true });
        } catch (e) {
          sendJson(res, 400, { ok: false, message: 'Invalid JSON' });
        }
      });
      return;
    }
    if (req.method === 'GET' && p.startsWith('/original/')) {
      const rel = p.slice('/original/'.length);
      const full = safeJoin(SOURCE_ROOT, rel);
      if (!full || !fs.existsSync(full) || !fs.statSync(full).isFile()) {
        res.writeHead(404);
        return res.end('Not found');
      }
      // Serve exact bytes; Content-Type from inventory mime when possible
      let ctype = 'application/octet-stream';
      try {
        const inv = JSON.parse(fs.readFileSync(INV, 'utf8'));
        const hit = (inv.images || []).find((i) => i.relativePath === decodeURIComponent(rel));
        if (hit?.uploadContentType) ctype = hit.uploadContentType;
      } catch (_) {}
      return sendFile(res, full, ctype);
    }

    res.writeHead(404);
    res.end('Not found');
  } catch (err) {
    console.error(err);
    res.writeHead(500);
    res.end('Server error');
  }
});

if (!fs.existsSync(SOURCE_ROOT)) {
  console.error('MEDIA_SOURCE_ROOT missing:', SOURCE_ROOT);
  process.exit(1);
}
if (!fs.existsSync(INV) || !fs.existsSync(HTML)) {
  console.error('Missing inventory or approval.html under docs/media-migration/');
  process.exit(1);
}

server.listen(PORT, '127.0.0.1', () => {
  console.log('Media approval (read-only originals) at http://127.0.0.1:' + PORT);
  console.log('Source root:', SOURCE_ROOT);
  console.log('No R2 upload. No DB writes. Sources are never modified.');
});
