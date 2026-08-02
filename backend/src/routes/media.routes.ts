import { Router, Request, Response } from 'express';
import { GetObjectCommand, HeadObjectCommand, S3Client } from '@aws-sdk/client-s3';
import http from 'http';
import https from 'https';
import { getR2MockObject } from '../services/r2-storage.service';

/**
 * Public read-only media proxy for R2 objects.
 * GET/HEAD only. No LIST. No writes. Path-traversal protected.
 * Prefer Worker HTTP proxy (read-only) over S3 API when R2_PUBLIC_BASE_URL is set.
 */
const router = Router();

function getClient(): S3Client | null {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) return null;
  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

function parseKey(req: Request): string | null {
  const raw = (req.params as any)[0] || req.path.replace(/^\/+/, '');
  let key = '';
  try {
    key = decodeURIComponent(String(raw || ''));
  } catch {
    return null;
  }
  if (!key || key.endsWith('/')) return null;
  if (key.includes('\\') || key.split('/').some((p) => !p || p === '.' || p === '..')) return null;
  return key;
}

function proxyToPublicBase(method: string, key: string, req: Request, res: Response): void {
  const base = (process.env.R2_PUBLIC_BASE_URL || '').replace(/\/+$/, '');
  if (!base) {
    res.status(503).send('Media public base not configured');
    return;
  }
  const url = `${base}/${key}`;
  const lib = url.startsWith('https') ? https : http;
  const upstream = lib.request(
    url,
    { method, timeout: 25000, headers: { 'User-Agent': 'megadim-local-media-proxy' } },
    (up) => {
      res.status(up.statusCode || 502);
      const pass = ['content-type', 'content-length', 'etag', 'cache-control', 'last-modified'];
      for (const h of pass) {
        const v = up.headers[h];
        if (v) res.setHeader(h, v);
      }
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      if (method === 'HEAD') {
        up.resume();
        return res.end();
      }
      up.pipe(res);
    }
  );
  upstream.on('error', (err) => {
    console.error('media worker proxy error:', err.message);
    if (!res.headersSent) res.status(502).send('Upstream media error');
  });
  upstream.on('timeout', () => {
    upstream.destroy();
    if (!res.headersSent) res.status(504).send('Upstream timeout');
  });
  upstream.end();
}

router.all('/*', async (req: Request, res: Response) => {
  const method = req.method.toUpperCase();
  if (method !== 'GET' && method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).send('Method Not Allowed');
  }

  const key = parseKey(req);
  if (!key) return res.status(400).send('Bad Request');

  // Serve local mock uploads first (never prod bucket)
  try {
    const mock = getR2MockObject(key);
    if (mock) {
      res.setHeader('Content-Type', mock.contentType);
      res.setHeader('Content-Length', String(mock.body.length));
      res.setHeader('Cache-Control', 'public, max-age=60');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      if (method === 'HEAD') return res.status(200).end();
      return res.status(200).send(mock.body);
    }
  } catch (_) {
    /* mock helper may be unused in older builds */
  }

  // Prefer Worker GET/HEAD (read-only) — no S3 writes
  if (process.env.R2_PUBLIC_BASE_URL) {
    return proxyToPublicBase(method, key, req, res);
  }

  const bucket = process.env.R2_BUCKET_NAME;
  const client = getClient();
  if (!client || !bucket) {
    return res.status(503).send('Media storage not configured');
  }

  try {
    if (method === 'HEAD') {
      const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
      if (head.ContentType) res.setHeader('Content-Type', head.ContentType);
      if (head.ContentLength != null) res.setHeader('Content-Length', String(head.ContentLength));
      if (head.ETag) res.setHeader('ETag', head.ETag);
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      return res.status(200).end();
    }

    const got = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    if (got.ContentType) res.setHeader('Content-Type', got.ContentType);
    if (got.ContentLength != null) res.setHeader('Content-Length', String(got.ContentLength));
    if (got.ETag) res.setHeader('ETag', got.ETag);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

    const inm = req.headers['if-none-match'];
    if (inm && got.ETag && inm === got.ETag) {
      return res.status(304).end();
    }

    const body: any = got.Body;
    if (body && typeof body.pipe === 'function') {
      body.pipe(res);
      return;
    }
    const chunks: Buffer[] = [];
    for await (const chunk of body) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return res.status(200).send(Buffer.concat(chunks));
  } catch (err: any) {
    const status = err?.$metadata?.httpStatusCode;
    if (status === 404 || err?.name === 'NoSuchKey' || err?.Code === 'NoSuchKey' || err?.name === 'NotFound') {
      return res.status(404).send('Not Found');
    }
    console.error('media proxy error:', err?.message || err);
    return res.status(500).send('Media error');
  }
});

export default router;
