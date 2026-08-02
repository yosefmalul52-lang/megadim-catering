#!/usr/bin/env node
/**
 * Start an isolated in-memory MongoDB, seed menu fixtures from entities-export + R2 manifest,
 * write connection info to a gitignored file for local backend use.
 * NEVER connects to production.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const bcrypt = require(path.join(__dirname, '..', 'backend', 'node_modules', 'bcryptjs'));
const { MongoMemoryServer } = require(path.join(
  __dirname,
  '..',
  'backend',
  'node_modules',
  'mongodb-memory-server'
));
const { MongoClient, ObjectId } = require(path.join(
  __dirname,
  '..',
  'backend',
  'node_modules',
  'mongodb'
));

const PROJECT = path.resolve(__dirname, '..');
const DOCS = path.join(PROJECT, 'docs', 'media-migration');
const OUT = path.join(DOCS, '.local-isolated-db.json');
const CREDS = path.join(DOCS, '.local-admin-credentials.txt');

async function main() {
  const ents = JSON.parse(fs.readFileSync(path.join(DOCS, 'entities-export.json'), 'utf8'));
  const manifest = JSON.parse(fs.readFileSync(path.join(DOCS, 'r2-upload-manifest.json'), 'utf8'));
  const state = JSON.parse(fs.readFileSync(path.join(DOCS, 'mapping-state.json'), 'utf8'));

  const urlByEntity = {};
  for (const item of manifest.items || []) {
    if (item.verificationStatus === 'verified' && item.entityId && item.publicUrl) {
      // Prefer higher confidence / later entries overwrite — mirror apply behavior
      urlByEntity[item.entityId] = item.publicUrl;
    }
  }
  // Prefer higher-confidence file when duplicates exist
  const approved = Object.values(state.decisions || {}).filter(
    (d) => d.approvalStatus === 'אושרה' && d.entityId
  );
  const byEnt = {};
  for (const d of approved) {
    if (!byEnt[d.entityId]) byEnt[d.entityId] = [];
    byEnt[d.entityId].push(d);
  }
  for (const [eid, list] of Object.entries(byEnt)) {
    if (list.length <= 1) continue;
    list.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
    const best = list[0];
    const man = (manifest.items || []).find(
      (i) => i.entityId === eid && i.sourcePath === best.relativePath
    );
    if (man?.publicUrl) urlByEntity[eid] = man.publicUrl;
  }

  // Skip מנות עיקריות/6.png explicitly
  if (state.decisions?.['מנות עיקריות/6.png']?.entityId) {
    delete urlByEntity[state.decisions['מנות עיקריות/6.png'].entityId];
  }

  const mongod = await MongoMemoryServer.create({
    instance: { dbName: 'megadim_local_r2_verify' },
  });
  const uri = mongod.getUri();
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db('megadim_local_r2_verify');

  const menuDocs = (ents.menuItems || [])
    .filter((m) => m.categoryName !== 'archived_holiday')
    .map((m) => ({
      _id: new ObjectId(m.entityId),
      name: m.entityName,
      category: m.categoryName,
      description: '',
      price: 10,
      imageUrl: urlByEntity[m.entityId] || m.currentImageUrl || '',
      isAvailable: m.isAvailable !== false,
      isPopular: false,
      isFeatured: !!m.isFeatured,
      tags: [],
      pricingOptions: [{ label: 'יחידה', price: 10, amount: '1' }],
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

  await db.collection('menuitems').deleteMany({});
  if (menuDocs.length) await db.collection('menuitems').insertMany(menuDocs);

  const passwordPlain = 'LocalOnly!R2Verify';
  const passwordHash = await bcrypt.hash(passwordPlain, 10);
  await db.collection('users').deleteMany({});
  await db.collection('users').insertOne({
    fullName: 'Local Admin',
    username: 'admin@local.test',
    password: passwordHash,
    role: 'admin',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await db.collection('users').insertOne({
    fullName: 'Local User',
    username: 'user@local.test',
    password: passwordHash,
    role: 'user',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // Keep process alive by not stopping mongod — write pid/uri for other scripts
  const info = {
    createdAt: new Date().toISOString(),
    uri: `${uri.replace(/\/?$/, '/')}${ 'megadim_local_r2_verify' }`,
    dbName: 'megadim_local_r2_verify',
    menuCount: menuDocs.length,
    withR2Url: Object.keys(urlByEntity).length,
    pid: process.pid,
    note: 'In-memory Mongo for local R2 verification only. Not production.',
  };
  fs.writeFileSync(OUT, JSON.stringify(info, null, 2));
  fs.writeFileSync(
    CREDS,
    [
      '# LOCAL ONLY — gitignored. Do not use in production.',
      'admin_email=admin@local.test',
      'user_email=user@local.test',
      `password=${passwordPlain}`,
      '',
    ].join('\n')
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        uriHost: 'memory-server',
        menuCount: menuDocs.length,
        r2Mapped: Object.keys(urlByEntity).length,
        infoFile: OUT,
        credsFile: CREDS,
      },
      null,
      2
    )
  );

  // Keep alive
  process.on('SIGINT', async () => {
    await client.close();
    await mongod.stop();
    process.exit(0);
  });
  console.log('Local isolated Mongo ready. Keep this process running.');
  await new Promise(() => {});
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
