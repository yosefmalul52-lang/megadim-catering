/**
 * Isolated Playwright E2E harness for admin order tabs.
 * No production DB, no real SMTP, no Tranzila.
 * Proves: failed→processing refresh exclusivity; cancelled≠completed tabs.
 */
import { test, expect } from '@playwright/test';
import path from 'node:path';
import http from 'node:http';
import fs from 'node:fs';

const HARNESS = path.join(__dirname, 'harness', 'admin-tabs.html');

let server: http.Server;
let baseUrl = '';

test.beforeAll(async () => {
  server = http.createServer((req, res) => {
    if (req.url === '/' || req.url?.startsWith('/index')) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(fs.readFileSync(HARNESS, 'utf8'));
      return;
    }
    res.writeHead(404);
    res.end('not found');
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (!addr || typeof addr === 'string') {
        reject(new Error('failed to bind harness server'));
        return;
      }
      baseUrl = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });
});

test.afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

test('failed order moves to processing only after explicit decision; refresh keeps exclusivity', async ({
  page
}) => {
  await page.goto(`${baseUrl}/`);
  await expect(page.getByRole('tab', { name: /נכשלו/ })).toBeVisible();

  await page.evaluate(() => {
    (window as any).__orders = [
      {
        id: 'ord-failed-1',
        status: 'pending',
        paymentStatus: 'failed',
        paymentExceptionResolvedAt: null,
        paymentFailedAt: new Date().toISOString(),
        label: 'הזמנה שנכשלה'
      },
      {
        id: 'ord-cancelled-1',
        status: 'cancelled',
        paymentStatus: 'pending',
        label: 'הזמנה שבוטלה'
      },
      {
        id: 'ord-delivered-1',
        status: 'delivered',
        paymentStatus: 'captured',
        label: 'הזמנה שהושלמה'
      }
    ];
    (window as any).__renderTabs();
  });

  await page.getByRole('tab', { name: /נכשלו/ }).click();
  await expect(page.locator('[data-tab-panel="failed"] [data-order-id]')).toHaveCount(1);
  await expect(page.locator('[data-tab-panel="processing"] [data-order-id]')).toHaveCount(0);

  await page.getByRole('button', { name: 'העבר לטיפול' }).click();

  await page.getByRole('tab', { name: /בטיפול/ }).click();
  await expect(page.locator('[data-tab-panel="processing"] [data-order-id="ord-failed-1"]')).toHaveCount(
    1
  );
  await page.getByRole('tab', { name: /נכשלו/ }).click();
  await expect(page.locator('[data-tab-panel="failed"] [data-order-id]')).toHaveCount(0);

  await page.evaluate(() => (window as any).__renderTabs());
  await page.getByRole('tab', { name: /בטיפול/ }).click();
  await expect(page.locator('[data-tab-panel="processing"] [data-order-id="ord-failed-1"]')).toHaveCount(
    1
  );
  await page.getByRole('tab', { name: /נכשלו/ }).click();
  await expect(page.locator('[data-tab-panel="failed"] [data-order-id]')).toHaveCount(0);

  const pay = await page.evaluate(() => {
    const o = (window as any).__orders.find((x: any) => x.id === 'ord-failed-1');
    return o?.paymentStatus;
  });
  expect(pay).toBe('failed');
});

test('cancelled and completed are separate tabs', async ({ page }) => {
  await page.goto(`${baseUrl}/`);
  await page.evaluate(() => {
    (window as any).__orders = [
      {
        id: 'ord-cancelled-1',
        status: 'cancelled',
        paymentStatus: 'pending',
        label: 'הזמנה שבוטלה'
      },
      {
        id: 'ord-delivered-1',
        status: 'delivered',
        paymentStatus: 'captured',
        label: 'הזמנה שהושלמה'
      }
    ];
    (window as any).__renderTabs();
  });

  await page.getByRole('tab', { name: /בוטלו/ }).click();
  await expect(page.locator('[data-tab-panel="cancelled"] [data-order-id]')).toHaveCount(1);
  await expect(page.locator('[data-tab-panel="cancelled"]')).toContainText('הזמנה שבוטלה');

  await page.getByRole('tab', { name: /הושלמו/ }).click();
  await expect(page.locator('[data-tab-panel="completed"] [data-order-id]')).toHaveCount(1);
  await expect(page.locator('[data-tab-panel="completed"]')).toContainText('הזמנה שהושלמה');

  await expect(page.locator('[data-tab-panel="archive"] [data-order-id]')).toHaveCount(0);
  await expect(page.locator('[data-tab-panel="ready"] [data-order-id]')).toHaveCount(0);
});

test('legacy processing+failed unresolved: only failed; explicit resolve → only processing after refresh', async ({
  page
}) => {
  await page.goto(`${baseUrl}/`);
  await page.evaluate(() => {
    (window as any).__orders = [
      {
        id: 'ord-legacy-1',
        status: 'processing',
        paymentStatus: 'failed',
        paymentExceptionResolvedAt: null,
        paymentFailedAt: new Date().toISOString(),
        label: 'legacy processing+failed'
      }
    ];
    (window as any).__renderTabs();
  });

  await page.getByRole('tab', { name: /נכשלו/ }).click();
  await expect(page.locator('[data-tab-panel="failed"] [data-order-id="ord-legacy-1"]')).toHaveCount(1);
  await page.getByRole('tab', { name: /בטיפול/ }).click();
  await expect(page.locator('[data-tab-panel="processing"] [data-order-id]')).toHaveCount(0);

  await page.getByRole('tab', { name: /נכשלו/ }).click();
  await page.getByRole('button', { name: 'העבר לטיפול' }).click();

  const after = await page.evaluate(() => {
    const o = (window as any).__orders.find((x: any) => x.id === 'ord-legacy-1');
    return {
      status: o.status,
      paymentStatus: o.paymentStatus,
      paymentExceptionResolvedAt: o.paymentExceptionResolvedAt,
      paymentExceptionResolvedBy: o.paymentExceptionResolvedBy,
      paymentExceptionResolution: o.paymentExceptionResolution
    };
  });
  expect(after.status).toBe('processing');
  expect(after.paymentStatus).toBe('failed');
  expect(after.paymentExceptionResolvedAt).toBeTruthy();
  expect(after.paymentExceptionResolvedBy).toBe('admin-e2e');
  expect(after.paymentExceptionResolution).toBe('approve_and_continue_billing');

  await page.evaluate(() => (window as any).__renderTabs());
  await page.getByRole('tab', { name: /בטיפול/ }).click();
  await expect(page.locator('[data-tab-panel="processing"] [data-order-id="ord-legacy-1"]')).toHaveCount(
    1
  );
  await page.getByRole('tab', { name: /נכשלו/ }).click();
  await expect(page.locator('[data-tab-panel="failed"] [data-order-id]')).toHaveCount(0);
});

test('soft-deleted cancelled/completed/failed appear only in archive', async ({ page }) => {
  await page.goto(`${baseUrl}/`);
  await page.evaluate(() => {
    (window as any).__orders = [
      {
        id: 'sd-cancelled',
        status: 'cancelled',
        paymentStatus: 'failed',
        isDeleted: true,
        label: 'soft cancelled'
      },
      {
        id: 'sd-completed',
        status: 'delivered',
        paymentStatus: 'captured',
        isDeleted: true,
        label: 'soft completed'
      },
      {
        id: 'sd-failed',
        status: 'processing',
        paymentStatus: 'failed',
        paymentFailedAt: new Date().toISOString(),
        paymentExceptionResolvedAt: null,
        isDeleted: true,
        label: 'soft failed'
      }
    ];
    (window as any).__renderTabs();
  });

  await page.getByRole('tab', { name: /ארכיון/ }).click();
  await expect(page.locator('[data-tab-panel="archive"] [data-order-id]')).toHaveCount(3);

  for (const name of [/בוטלו/, /הושלמו/, /נכשלו/, /בטיפול/]) {
    await page.getByRole('tab', { name }).click();
  }
  await expect(page.locator('[data-tab-panel="cancelled"] [data-order-id]')).toHaveCount(0);
  await expect(page.locator('[data-tab-panel="completed"] [data-order-id]')).toHaveCount(0);
  await expect(page.locator('[data-tab-panel="failed"] [data-order-id]')).toHaveCount(0);
  await expect(page.locator('[data-tab-panel="processing"] [data-order-id]')).toHaveCount(0);
});

test('ready → mark delivered moves only to הושלמו after refresh', async ({ page }) => {
  await page.goto(`${baseUrl}/`);
  await page.evaluate(() => {
    (window as any).__orders = [
      {
        id: 'ord-ready-1',
        status: 'ready',
        paymentStatus: 'captured',
        deliveryMethod: 'pickup',
        label: 'מוכנה לאיסוף'
      }
    ];
    (window as any).__renderTabs();
  });

  await page.getByRole('tab', { name: /מוכנים/ }).click();
  await expect(page.locator('[data-tab-panel="ready"] [data-order-id="ord-ready-1"]')).toHaveCount(1);

  await page.evaluate(() => {
    const o = (window as any).__orders.find((x: any) => x.id === 'ord-ready-1');
    o.status = 'delivered';
    o.completedAt = new Date().toISOString();
    (window as any).__renderTabs();
  });

  await page.getByRole('tab', { name: /הושלמו/ }).click();
  await expect(page.locator('[data-tab-panel="completed"] [data-order-id="ord-ready-1"]')).toHaveCount(1);
  await page.getByRole('tab', { name: /מוכנים/ }).click();
  await expect(page.locator('[data-tab-panel="ready"] [data-order-id]')).toHaveCount(0);
});
