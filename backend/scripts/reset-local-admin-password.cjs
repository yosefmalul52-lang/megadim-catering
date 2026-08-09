/**
 * LOCAL ONLY — reset admin passwords on isolated Mongo.
 * Refuses Atlas / production URIs.
 */
const path = require('path');
const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');
const { assertSafeMongoUri } = require('../../scripts/lib/assert-not-production-mongo.cjs');

async function main() {
  const uri =
    process.env.MONGO_URI ||
    process.env.MONGODB_URI ||
    'mongodb://127.0.0.1:62759/megadim_local_r2_verify';
  assertSafeMongoUri(uri, { allowProduction: false, label: 'reset-local-admin' });
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to run in NODE_ENV=production');
  }

  const passwordPlain = process.env.LOCAL_ADMIN_PASSWORD || 'LocalOnly!R2Verify';
  const hash = await bcrypt.hash(passwordPlain, 10);
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();
  const users = [
    { fullName: 'Local Admin', username: 'yosefmalul52@gmail.com', role: 'admin' },
    { fullName: 'Local Admin', username: 'admin@local.test', role: 'admin' },
  ];
  for (const u of users) {
    const res = await db.collection('users').updateOne(
      { username: u.username },
      {
        $set: {
          fullName: u.fullName,
          username: u.username,
          password: hash,
          role: u.role,
          isActive: true,
          updatedAt: new Date(),
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true }
    );
    console.log(
      JSON.stringify({
        username: u.username,
        upserted: res.upsertedCount > 0,
        matched: res.matchedCount,
        modified: res.modifiedCount,
      })
    );
  }
  console.log(
    JSON.stringify({
      ok: true,
      passwordSet: true,
      loginUrl: 'http://localhost:4200/login',
      note: 'Password from LOCAL_ADMIN_PASSWORD or local default. Not printed. Not production.',
    })
  );
  await client.close();
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
