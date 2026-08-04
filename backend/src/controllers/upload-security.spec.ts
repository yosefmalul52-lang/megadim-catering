/**
 * Security contract tests for POST /api/upload.
 * Covers authz, MIME filter, size limit, success path, and path-traversal filenames.
 * Uses R2_MOCK — never touches real Cloudflare R2 or Tranzila.
 */
import assert from 'node:assert/strict';
import http from 'node:http';
import { AddressInfo } from 'node:net';
import test from 'node:test';
import express, { NextFunction, Request, Response } from 'express';

process.env.R2_MOCK = '1';
process.env.R2_PUBLIC_BASE_URL = 'http://127.0.0.1:9/api/media';

type AuthMode = 'none' | 'user' | 'admin';

let authMode: AuthMode = 'admin';

function resolveModule(rel: string): string {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require.resolve(rel);
}

function patchAuthModules(): void {
  const authPath = resolveModule('../middleware/auth');
  const rolePath = resolveModule('../config/role-access');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const auth = require(authPath);
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const role = require(rolePath);

  auth.authenticate = (req: Request, res: Response, next: NextFunction): void => {
    if (authMode === 'none') {
      res.status(401).json({ success: false, message: 'אין הרשאה - נדרש token' });
      return;
    }
    (req as any).user = {
      id: authMode === 'admin' ? 'admin-1' : 'user-1',
      role: authMode === 'admin' ? 'admin' : 'customer',
      type: 'site'
    };
    next();
  };

  role.requireAdmin = (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as any).user;
    if (!user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }
    if (user.role !== 'admin') {
      res.status(403).json({
        success: false,
        message: 'Forbidden: Admin access required',
        serverSeesRole: user.role
      });
      return;
    }
    next();
  };
}

function loadUploadRouter() {
  const uploadPath = resolveModule('../routes/upload.routes');
  const authPath = resolveModule('../middleware/auth');
  const rolePath = resolveModule('../config/role-access');
  delete require.cache[uploadPath];
  delete require.cache[authPath];
  delete require.cache[rolePath];
  // Ensure modules load, then patch, then let upload.routes capture patched refs.
  require(authPath);
  require(rolePath);
  patchAuthModules();
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require(uploadPath).default;
}

/** Minimal valid 1×1 PNG. */
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

function buildMultipart(opts: {
  fieldName?: string;
  filename: string;
  contentType: string;
  body: Buffer;
}): { payload: Buffer; contentType: string } {
  const boundary = '----MegadimUploadBoundary7MA4YWxkTrZu0gW';
  const fieldName = opts.fieldName || 'image';
  const head =
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="${fieldName}"; filename="${opts.filename}"\r\n` +
    `Content-Type: ${opts.contentType}\r\n\r\n`;
  const tail = `\r\n--${boundary}--\r\n`;
  return {
    contentType: `multipart/form-data; boundary=${boundary}`,
    payload: Buffer.concat([Buffer.from(head, 'utf8'), opts.body, Buffer.from(tail, 'utf8')])
  };
}

async function withServer(
  run: (baseUrl: string) => Promise<void>
): Promise<void> {
  const app = express();
  app.use('/api/upload', loadUploadRouter());
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve()))
    );
  }
}

function postUpload(
  baseUrl: string,
  multipart: { payload: Buffer; contentType: string }
): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const url = new URL(`${baseUrl}/api/upload`);
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': multipart.contentType,
          'Content-Length': multipart.payload.length
        }
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          let body: any = raw;
          try {
            body = JSON.parse(raw);
          } catch {
            /* keep text */
          }
          resolve({ status: res.statusCode || 0, body });
        });
      }
    );
    req.on('error', reject);
    req.write(multipart.payload);
    req.end();
  });
}

test('upload: unauthenticated user is rejected', async () => {
  authMode = 'none';
  await withServer(async (base) => {
    const mp = buildMultipart({
      filename: 'ok.png',
      contentType: 'image/png',
      body: PNG_1X1
    });
    const res = await postUpload(base, mp);
    assert.equal(res.status, 401);
    assert.equal(res.body?.success, false);
  });
});

test('upload: non-admin authenticated user is forbidden', async () => {
  authMode = 'user';
  await withServer(async (base) => {
    const mp = buildMultipart({
      filename: 'ok.png',
      contentType: 'image/png',
      body: PNG_1X1
    });
    const res = await postUpload(base, mp);
    assert.equal(res.status, 403);
    assert.equal(res.body?.success, false);
  });
});

test('upload: forbidden MIME is rejected', async () => {
  authMode = 'admin';
  await withServer(async (base) => {
    const mp = buildMultipart({
      filename: 'malware.exe',
      contentType: 'application/x-msdownload',
      body: Buffer.from('MZ-fake-exe')
    });
    const res = await postUpload(base, mp);
    assert.equal(res.status, 400);
    assert.equal(res.body?.success, false);
    assert.match(String(res.body?.message || ''), /Invalid file type|JPEG|PNG|WebP/i);
  });
});

test('upload: oversized file is rejected', async () => {
  authMode = 'admin';
  await withServer(async (base) => {
    // multer limit is 5MB; send slightly over with jpeg magic prefix.
    const over = Buffer.alloc(5 * 1024 * 1024 + 2048, 0);
    over[0] = 0xff;
    over[1] = 0xd8;
    over[2] = 0xff;
    const mp = buildMultipart({
      filename: 'big.jpg',
      contentType: 'image/jpeg',
      body: over
    });
    const res = await postUpload(base, mp);
    assert.equal(res.status, 400);
    assert.equal(res.body?.success, false);
    assert.match(String(res.body?.message || ''), /גדול|large|LIMIT_FILE_SIZE|File too large/i);
  });
});

test('upload: valid PNG succeeds for admin', async () => {
  authMode = 'admin';
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { clearR2MockStore } = require('../services/r2-storage.service');
  clearR2MockStore();
  await withServer(async (base) => {
    const mp = buildMultipart({
      filename: 'dish.png',
      contentType: 'image/png',
      body: PNG_1X1
    });
    const res = await postUpload(base, mp);
    assert.equal(res.status, 200);
    assert.equal(res.body?.success, true);
    assert.match(String(res.body?.imageUrl || ''), /^http/);
    assert.equal(res.body?.storage, 'r2');
    assert.ok(res.body?.publicId);
    assert.equal(String(res.body.publicId).includes('..'), false);
  });
});

test('upload: dangerous filename does not escape object key', async () => {
  authMode = 'admin';
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { clearR2MockStore } = require('../services/r2-storage.service');
  clearR2MockStore();
  await withServer(async (base) => {
    const mp = buildMultipart({
      filename: '../../../etc/passwd.png',
      contentType: 'image/png',
      body: PNG_1X1
    });
    const res = await postUpload(base, mp);
    assert.equal(res.status, 200);
    assert.equal(res.body?.success, true);
    const key = String(res.body?.publicId || '');
    assert.ok(key.length > 0);
    assert.equal(key.includes('..'), false);
    assert.equal(key.includes('etc/passwd'), false);
    assert.match(key, /^[a-zA-Z0-9_./-]+$/);
  });
});
