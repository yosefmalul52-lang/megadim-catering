'use strict';

/**
 * Vercel serverless entry for Angular SSR.
 * Build output: `frontend/dist/frontend/server/main.js` (webpack bundle; not `main.server.mjs`).
 * Browser static files: `frontend/dist/frontend/browser` (see ANGULAR_BROWSER_DIST in `server.ts`).
 */
const path = require('path');
const fs = require('fs');

function firstExisting(paths) {
  for (const p of paths) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

const cwd = process.cwd();
const browserDist =
  firstExisting([
    path.join(cwd, 'frontend', 'dist', 'frontend', 'browser'),
    path.join(cwd, 'dist', 'frontend', 'browser'),
  ]) || path.join(cwd, 'frontend', 'dist', 'frontend', 'browser');

process.env.ANGULAR_BROWSER_DIST = browserDist;

const serverMain =
  firstExisting([
    path.join(cwd, 'frontend', 'dist', 'frontend', 'server', 'main.js'),
    path.join(cwd, 'dist', 'frontend', 'server', 'main.js'),
  ]) || path.join(cwd, 'frontend', 'dist', 'frontend', 'server', 'main.js');

if (!fs.existsSync(serverMain)) {
  throw new Error(
    `[api/index] Missing ${serverMain}. Run: cd frontend && npm run vercel-build`
  );
}

const { app: createApp } = require(serverMain);
const expressApp = createApp();

module.exports = expressApp;
