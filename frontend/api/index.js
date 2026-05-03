'use strict';

/**
 * Vercel serverless entry when the Vercel project Root Directory is `frontend/`.
 * Bundle: `dist/frontend/server/main.js` (webpack output, not `main.server.mjs`).
 */
const path = require('path');
const fs = require('fs');

const cwd = process.cwd();
const browserDist = path.join(cwd, 'dist', 'frontend', 'browser');
const serverMain = path.join(cwd, 'dist', 'frontend', 'server', 'main.js');

if (!fs.existsSync(serverMain)) {
  throw new Error(`[api/index] Missing ${serverMain}. Run: npm run vercel-build`);
}

process.env.ANGULAR_BROWSER_DIST = browserDist;

const { app: createApp } = require(serverMain);
module.exports = createApp();
