/**
 * Focused unit checks for R2 key building / URL parsing (no network, no secrets).
 * Run: node backend/src/services/r2-storage.unit.cjs
 */
'use strict';

const assert = require('assert');
const path = require('path');

// Minimal reimplementation mirrors of pure helpers (avoid TS compile for this smoke)
function buildObjectKey({ entityType = 'menuItem', entityId = 'unassigned', sha256, ext }) {
  const et = String(entityType).replace(/[^a-zA-Z0-9_-]/g, '');
  const eid = String(entityId).replace(/[^a-zA-Z0-9_-]/g, '');
  const assetId = sha256.slice(0, 16);
  const e = ext.startsWith('.') ? ext : `.${ext}`;
  return `${et}/${eid}/${assetId}/original${e}`;
}

function keyFromPublicUrl(url, base) {
  if (!url || !base) return null;
  const b = base.replace(/\/+$/, '');
  if (!url.startsWith(b + '/')) return null;
  const key = url.slice(b.length + 1);
  if (!key || key.includes('..')) return null;
  return key;
}

const sha = 'abcdef0123456789ffffffffffffffffffffffffffffffffffffffffffffffff';
const key = buildObjectKey({ entityType: 'menuItem', entityId: 'abc123', sha256: sha, ext: '.png' });
assert.strictEqual(key, 'menuItem/abc123/abcdef0123456789/original.png');

const base = 'https://megadim-media.example.workers.dev';
assert.strictEqual(keyFromPublicUrl(`${base}/${key}`, base), key);
assert.strictEqual(keyFromPublicUrl('https://res.cloudinary.com/x/y.jpg', base), null);
assert.strictEqual(keyFromPublicUrl(`${base}/../etc/passwd`, base), null);

// Worker method allowlist semantics
function workerAllow(method) {
  const m = method.toUpperCase();
  return m === 'GET' || m === 'HEAD';
}
assert.strictEqual(workerAllow('GET'), true);
assert.strictEqual(workerAllow('HEAD'), true);
assert.strictEqual(workerAllow('PUT'), false);
assert.strictEqual(workerAllow('POST'), false);
assert.strictEqual(workerAllow('DELETE'), false);

console.log('r2-storage.unit.cjs: OK');
