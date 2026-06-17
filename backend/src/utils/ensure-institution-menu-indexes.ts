import mongoose from 'mongoose';

const LEGACY_INDEX_NAMES = ['key_1'] as const;

function isIndexNotFoundError(err: unknown): boolean {
  const e = err as { code?: number; codeName?: string; message?: string };
  return (
    e?.code === 27 ||
    e?.codeName === 'IndexNotFound' ||
    (typeof e?.message === 'string' && e.message.includes('index not found'))
  );
}

/**
 * Drops legacy `key` unique index on institutionmenus.
 * Old schema used key: 'master' (unique, non-sparse) — only one doc could exist without `key`,
 * causing E11000 when saving menus for multiple weeks.
 */
export async function ensureInstitutionMenuIndexes(): Promise<void> {
  if (mongoose.connection.readyState !== 1) {
    return;
  }

  const collection = mongoose.connection.collection('institutionmenus');

  try {
    const indexes = await collection.indexes();

    for (const indexName of LEGACY_INDEX_NAMES) {
      const existing = indexes.find((idx) => idx.name === indexName);
      if (!existing) {
        continue;
      }
      try {
        await collection.dropIndex(indexName);
        console.log(`✅ Dropped legacy index institutionmenus.${indexName}`);
      } catch (err: unknown) {
        if (!isIndexNotFoundError(err)) {
          console.warn(`⚠️ Could not drop institutionmenus.${indexName}:`, (err as Error)?.message || err);
        }
      }
    }
  } catch (err: unknown) {
    console.warn('⚠️ InstitutionMenu index inspection failed:', (err as Error)?.message || err);
  }

  const unsetKey = await collection.updateMany({ key: { $exists: true } }, { $unset: { key: '' } });
  if (unsetKey.modifiedCount > 0) {
    console.log(`✅ InstitutionMenu: removed legacy key field from ${unsetKey.modifiedCount} document(s)`);
  }

  try {
    const InstitutionMenu = (await import('../models/InstitutionMenu')).default;
    await InstitutionMenu.syncIndexes();
  } catch (err: unknown) {
    console.warn('⚠️ InstitutionMenu syncIndexes failed:', (err as Error)?.message || err);
  }
}
