import mongoose from 'mongoose';

const INDEX_NAMES = ['videoId_1', 'publicId_1'] as const;

function isIndexNotFoundError(err: unknown): boolean {
  const e = err as { code?: number; codeName?: string; message?: string };
  return (
    e?.code === 27 ||
    e?.codeName === 'IndexNotFound' ||
    (typeof e?.message === 'string' && e.message.includes('index not found'))
  );
}

/**
 * Drops legacy non-sparse unique indexes on `videos` and recreates sparse unique indexes.
 * Also $unset`s `videoId` / `publicId` where they were stored as null (breaks old unique index).
 */
export async function ensureVideoIndexes(): Promise<void> {
  if (mongoose.connection.readyState !== 1) {
    return;
  }

  const collection = mongoose.connection.collection('videos');

  try {
    const indexes = await collection.indexes();

    for (const indexName of INDEX_NAMES) {
      const existing = indexes.find((idx) => idx.name === indexName);
      if (!existing) {
        continue;
      }
      // Legacy index was unique but not sparse — causes E11000 on duplicate null
      if (existing.unique && !existing.sparse) {
        try {
          await collection.dropIndex(indexName);
          console.log(`✅ Dropped legacy non-sparse index videos.${indexName}`);
        } catch (err: unknown) {
          if (!isIndexNotFoundError(err)) {
            console.warn(`⚠️ Could not drop videos.${indexName}:`, (err as Error)?.message || err);
          }
        }
      }
    }
  } catch (err: unknown) {
    console.warn('⚠️ Video index inspection failed:', (err as Error)?.message || err);
  }

  // Clean documents: sparse indexes ignore missing fields, but null is still indexed
  const unsetVideoId = await collection.updateMany(
    { videoId: null },
    { $unset: { videoId: '' } }
  );
  const unsetPublicId = await collection.updateMany(
    { publicId: null },
    { $unset: { publicId: '' } }
  );

  if (unsetVideoId.modifiedCount > 0 || unsetPublicId.modifiedCount > 0) {
    console.log(
      `✅ Videos: cleared null keys (videoId: ${unsetVideoId.modifiedCount}, publicId: ${unsetPublicId.modifiedCount})`
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Video = require('../models/Video');
  await Video.syncIndexes();
  console.log('✅ Videos collection indexes synced (sparse unique on videoId, publicId)');
}
