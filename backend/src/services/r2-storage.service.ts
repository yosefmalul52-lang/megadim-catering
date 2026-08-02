import { S3Client, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import crypto from 'crypto';
import path from 'path';

export type R2UploadResult = {
  key: string;
  publicUrl: string;
  sha256: string;
  contentType: string;
  bytes: number;
  width?: number;
  height?: number;
};

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env: ${name}`);
  return v;
}

let client: S3Client | null = null;

/** In-memory mock store for local verification (R2_MOCK=1). Never writes to real R2. */
const mockObjects = new Map<string, { body: Buffer; contentType: string; sha256: string }>();

export function isR2MockMode(): boolean {
  return process.env.R2_MOCK === '1' || process.env.R2_MOCK === 'true';
}

export function isR2Configured(): boolean {
  if (isR2MockMode()) {
    return !!(process.env.R2_PUBLIC_BASE_URL || true);
  }
  return !!(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET_NAME &&
    process.env.R2_PUBLIC_BASE_URL
  );
}

export function getR2PublicBaseUrl(): string {
  if (isR2MockMode()) {
    return (process.env.R2_PUBLIC_BASE_URL || 'http://127.0.0.1:4000/api/media').replace(/\/+$/, '');
  }
  return required('R2_PUBLIC_BASE_URL').replace(/\/+$/, '');
}

function getClient(): S3Client {
  if (isR2MockMode()) {
    throw new Error('R2 mock mode: real S3 client must not be used');
  }
  if (client) return client;
  const accountId = required('R2_ACCOUNT_ID');
  client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: required('R2_ACCESS_KEY_ID'),
      secretAccessKey: required('R2_SECRET_ACCESS_KEY'),
    },
  });
  return client;
}

function getBucket(): string {
  if (isR2MockMode()) return 'mock-local-bucket';
  return required('R2_BUCKET_NAME');
}

export function clearR2MockStore(): void {
  mockObjects.clear();
}

export function getR2MockStoreSize(): number {
  return mockObjects.size;
}

export function getR2MockObject(
  key: string
): { body: Buffer; contentType: string; sha256: string } | null {
  return mockObjects.get(key) || null;
}

export function publicUrlForKey(key: string): string {
  return `${getR2PublicBaseUrl()}/${key.replace(/^\/+/, '')}`;
}

function detectContentType(buf: Buffer, originalName?: string): { contentType: string; ext: string } {
  const ext = (path.extname(originalName || '') || '').toLowerCase();
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return { contentType: 'image/png', ext: '.png' };
  }
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { contentType: 'image/jpeg', ext: ext === '.jpeg' ? '.jpeg' : '.jpg' };
  }
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    return { contentType: 'image/webp', ext: '.webp' };
  }
  if (ext === '.png') return { contentType: 'image/png', ext: '.png' };
  if (ext === '.webp') return { contentType: 'image/webp', ext: '.webp' };
  return { contentType: 'image/jpeg', ext: ext || '.jpg' };
}

function readPngSize(buf: Buffer): { width: number; height: number } | null {
  if (buf.length < 24) return null;
  if (!(buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47)) return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function readJpegSize(buf: Buffer): { width: number; height: number } | null {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) {
      i += 1;
      continue;
    }
    const marker = buf[i + 1];
    if (marker === 0xd9 || marker === 0xda) break;
    const len = buf.readUInt16BE(i + 2);
    if (len < 2) break;
    if (
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf)
    ) {
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    }
    i += 2 + len;
  }
  return null;
}

export function buildObjectKey(opts: {
  entityType?: string;
  entityId?: string;
  sha256: string;
  ext: string;
}): string {
  const entityType = (opts.entityType || 'menuItem').replace(/[^a-zA-Z0-9_-]/g, '');
  const entityId = (opts.entityId || 'unassigned').replace(/[^a-zA-Z0-9_-]/g, '');
  const assetId = opts.sha256.slice(0, 16);
  const ext = opts.ext.startsWith('.') ? opts.ext : `.${opts.ext}`;
  return `${entityType}/${entityId}/${assetId}/original${ext}`;
}

export function keyFromPublicUrl(url: string): string | null {
  if (!url || !isR2Configured()) return null;
  const base = getR2PublicBaseUrl();
  if (!url.startsWith(base + '/')) return null;
  const key = url.slice(base.length + 1);
  if (!key || key.includes('..')) return null;
  return key;
}

function isNotFound(err: any): boolean {
  return (
    err?.name === 'NotFound' ||
    err?.Code === 'NotFound' ||
    err?.$metadata?.httpStatusCode === 404
  );
}

async function streamToBuffer(body: any): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of body) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export async function uploadImageBuffer(
  buffer: Buffer,
  opts: {
    originalName?: string;
    entityType?: string;
    entityId?: string;
    maxBytes?: number;
  } = {}
): Promise<R2UploadResult> {
  const maxBytes = opts.maxBytes ?? 5 * 1024 * 1024;
  if (!buffer?.length) throw new Error('Empty file');
  if (buffer.length > maxBytes) throw new Error(`File too large (max ${maxBytes} bytes)`);

  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
  const { contentType, ext } = detectContentType(buffer, opts.originalName);
  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowed.includes(contentType)) {
    throw new Error('Invalid file type. Only JPEG, PNG, and WebP images are allowed.');
  }
  const dims = readPngSize(buffer) || readJpegSize(buffer) || undefined;
  const key = buildObjectKey({
    entityType: opts.entityType,
    entityId: opts.entityId,
    sha256,
    ext,
  });

  if (process.env.R2_MOCK_FAIL === '1' || process.env.R2_MOCK_FAIL === 'true') {
    throw new Error('Simulated R2 upload failure (R2_MOCK_FAIL)');
  }

  // Local mock: never touch real bucket megadim-media-prod
  if (isR2MockMode()) {
    const existing = mockObjects.get(key);
    if (existing && existing.sha256 !== sha256) {
      throw new Error('Object key collision with different content');
    }
    mockObjects.set(key, { body: Buffer.from(buffer), contentType, sha256 });
    return {
      key,
      publicUrl: publicUrlForKey(key),
      sha256,
      contentType,
      bytes: buffer.length,
      width: dims?.width,
      height: dims?.height,
    };
  }

  const s3 = getClient();
  const bucket = getBucket();

  try {
    const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    const metaSha = head.Metadata?.sha256;
    if (metaSha === sha256 && Number(head.ContentLength) === buffer.length) {
      return {
        key,
        publicUrl: publicUrlForKey(key),
        sha256,
        contentType,
        bytes: buffer.length,
        width: dims?.width,
        height: dims?.height,
      };
    }
    throw new Error('Object key collision with different content');
  } catch (err: any) {
    if (!isNotFound(err) && !String(err?.message || '').includes('collision')) {
      throw err;
    }
    if (String(err?.message || '').includes('collision')) throw err;
  }

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      Metadata: { sha256 },
      CacheControl: 'public, max-age=31536000, immutable',
    })
  );

  const got = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const remote = await streamToBuffer(got.Body);
  const remoteSha = crypto.createHash('sha256').update(remote).digest('hex');
  if (remoteSha !== sha256 || remote.length !== buffer.length) {
    try {
      await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    } catch (_) {}
    throw new Error('R2 upload verification failed (checksum/size mismatch)');
  }

  return {
    key,
    publicUrl: publicUrlForKey(key),
    sha256,
    contentType,
    bytes: buffer.length,
    width: dims?.width,
    height: dims?.height,
  };
}

export async function deleteObjectByKey(key: string): Promise<void> {
  if (!key || key.includes('..')) throw new Error('Invalid object key');
  if (isR2MockMode()) {
    mockObjects.delete(key);
    return;
  }
  await getClient().send(new DeleteObjectCommand({ Bucket: getBucket(), Key: key }));
}

export async function deleteByPublicUrl(url: string): Promise<boolean> {
  const key = keyFromPublicUrl(url);
  if (!key) return false;
  await deleteObjectByKey(key);
  return true;
}
