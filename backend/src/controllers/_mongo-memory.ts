/**
 * Shared MongoMemoryServer for integration specs.
 * One mongod per process; ref-counted acquire/release so the process can exit.
 */
import { MongoMemoryServer } from 'mongodb-memory-server';

let shared: MongoMemoryServer | null = null;
let starting: Promise<MongoMemoryServer> | null = null;
let refs = 0;

export async function createMongoMemoryServer(retries = 3): Promise<MongoMemoryServer> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await MongoMemoryServer.create();
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 300 * attempt));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

async function ensureShared(): Promise<MongoMemoryServer> {
  if (shared) return shared;
  if (!starting) {
    starting = createMongoMemoryServer().then((m) => {
      shared = m;
      return m;
    });
  }
  return starting;
}

/** Acquire shared mongod URI for a suite-specific database. Pair with releaseSharedMongo(). */
export async function getSharedMongoUri(dbName: string): Promise<string> {
  refs += 1;
  const mongod = await ensureShared();
  return mongod.getUri(dbName);
}

/** Release suite hold; stops mongod when last suite finishes. */
export async function releaseSharedMongo(): Promise<void> {
  refs = Math.max(0, refs - 1);
  if (refs > 0) return;
  await shutdownSharedMongoMemory();
}

/** @deprecated use releaseSharedMongo — kept for call-site compatibility */
export async function stopMongoMemoryServer(
  _mongod: MongoMemoryServer | undefined | null
): Promise<void> {
  void _mongod;
  await releaseSharedMongo();
}

export async function shutdownSharedMongoMemory(): Promise<void> {
  if (!shared) {
    starting = null;
    return;
  }
  const m = shared;
  shared = null;
  starting = null;
  refs = 0;
  try {
    await m.stop({ doCleanup: true, force: true });
  } catch {
    /* ignore */
  }
}
