#!/usr/bin/env node
/**
 * Deploy megadim-media Worker using local Wrangler OAuth (wrangler login).
 * Does NOT require CLOUDFLARE_API_TOKEN. Does not print secrets.
 */
'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const PROJECT = path.resolve(__dirname, '..');
const WORKER_DIR = path.join(PROJECT, 'workers', 'megadim-media');
const ENV_PATH = path.join(PROJECT, 'docs', 'media-migration', '.env.r2');
const BACKEND_ENV = path.join(PROJECT, 'backend', '.env');

function run(cmd, args, cwd) {
  const res = spawnSync(cmd, args, { cwd, encoding: 'utf8', shell: false });
  return res;
}

function setPublicBase(base) {
  for (const envPath of [ENV_PATH, BACKEND_ENV]) {
    if (!fs.existsSync(envPath)) continue;
    const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
    let found = false;
    const next = lines.map((line) => {
      if (line.startsWith('R2_PUBLIC_BASE_URL=')) {
        found = true;
        return `R2_PUBLIC_BASE_URL=${base}`;
      }
      return line;
    });
    if (!found) next.push(`R2_PUBLIC_BASE_URL=${base}`);
    fs.writeFileSync(envPath, next.join('\n').replace(/\n?$/, '\n'));
  }
}

const who = run('npx', ['--yes', 'wrangler@4', 'whoami'], WORKER_DIR);
if (who.status !== 0 || !/logged in/i.test(who.stdout + who.stderr)) {
  console.error('Not logged in. Run: npx wrangler login');
  process.exit(1);
}
console.log('Wrangler OAuth session OK');

const deploy = run('npx', ['--yes', 'wrangler@4', 'deploy', '--name', 'megadim-media'], WORKER_DIR);
process.stdout.write(deploy.stdout || '');
process.stderr.write(deploy.stderr || '');
if (deploy.status !== 0) {
  process.exit(deploy.status || 1);
}

const combined = `${deploy.stdout || ''}\n${deploy.stderr || ''}`;
const m = combined.match(/https:\/\/[a-zA-Z0-9.-]+\.workers\.dev/);
if (!m) {
  console.error('Deploy succeeded but workers.dev URL not found in output');
  process.exit(1);
}
const base = m[0].replace(/\/$/, '');
setPublicBase(base);
console.log('R2_PUBLIC_BASE_URL host:', base.replace(/^https:\/\//, ''));
console.log('Deploy complete.');
