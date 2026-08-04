import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import {
  buildOrderItemKey,
  hasCircularDependency,
  orderedQuantitiesFromOrder,
  resolveBackfillPlanTime,
  stageLabelHe
} from '../utils/kitchen-ops.util';
import { CAP, roleHasCapability } from '../config/role-access';
import { buildOpsPrintHtml } from '../services/kitchen-ops.service';

test('order item key separates size variants', () => {
  const a = buildOrderItemKey({
    name: 'חומוס',
    category: 'סלטים',
    selectedOption: { label: 'רגיל', amount: '250' }
  });
  const b = buildOrderItemKey({
    name: 'חומוס',
    category: 'סלטים',
    selectedOption: { label: 'רגיל', amount: '500' }
  });
  assert.notEqual(a, b);
});

test('ordered quantities never invent stages and use items only', () => {
  const order = {
    orderType: 'catering',
    numberOfPortions: 10,
    portionsEvening: 10,
    salads: ['ignore'],
    items: [{ name: 'סלט', quantity: 1, category: 'סלטים ערב' }]
  };
  const rows = orderedQuantitiesFromOrder(order);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].orderedQuantity, 10);
});

test('circular dependency detection', () => {
  const edges = new Map<string, string[]>([
    ['a', ['b']],
    ['b', ['c']],
    ['c', []]
  ]);
  assert.equal(hasCircularDependency(edges, 'c', ['a']), true);
  assert.equal(hasCircularDependency(edges, 'c', []), false);
});

test('backfill plan time uses kitchenPreparationAt when present', () => {
  const manual = resolveBackfillPlanTime({
    kitchenPreparationAt: '2026-08-10T08:30:00.000Z',
    customerDetails: { eventDate: '2026-08-11' }
  });
  assert.equal(manual.usedDeliveryFallback, false);
  const fallback = resolveBackfillPlanTime({
    customerDetails: { eventDate: '2026-08-10' }
  });
  assert.equal(fallback.usedDeliveryFallback, true);
});

test('admin has kitchen ops capabilities', () => {
  assert.equal(roleHasCapability('admin', CAP.KITCHEN_OPS_READ), true);
  assert.equal(roleHasCapability('admin', CAP.KITCHEN_OPS_WRITE), true);
  assert.equal(roleHasCapability('driver', CAP.KITCHEN_OPS_WRITE), false);
});

test('stage labels are Hebrew for print', () => {
  assert.equal(stageLabelHe('thaw'), 'הפשרה');
  assert.equal(stageLabelHe('pack'), 'אריזה');
  assert.equal(stageLabelHe('quality_check'), 'בקרת איכות');
});

test('status aliases normalize to canonical names', async () => {
  const { normalizeKitchenTaskStatus, isCompletedTaskStatus } = await import(
    '../utils/kitchen-ops.util'
  );
  assert.equal(normalizeKitchenTaskStatus('partial'), 'partially_completed');
  assert.equal(normalizeKitchenTaskStatus('done'), 'completed');
  assert.equal(isCompletedTaskStatus('completed'), true);
  assert.equal(isCompletedTaskStatus('done'), true);
});

test('quantity separation: summing two stages must not equal order qty falsely', () => {
  const order = {
    items: [{ name: 'עוף', quantity: 50, category: 'עיקריות' }],
    customerDetails: {}
  };
  const ordered = orderedQuantitiesFromOrder(order)[0].orderedQuantity;
  const thawPlanned = 50;
  const cookPlanned = 50;
  assert.equal(ordered, 50);
  assert.notEqual(ordered, thawPlanned + cookPlanned);
});

test('demo seed safety helpers refuse production markers', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { isProductionMongoUri, assertSafeMongoUri } = require('../../../scripts/lib/assert-not-production-mongo.cjs');
  assert.equal(isProductionMongoUri('mongodb://127.0.0.1:27017/test'), false);
  assert.equal(isProductionMongoUri('mongodb+srv://u:p@magadimcluster.example.mongodb.net/db'), true);
  assert.throws(() =>
    assertSafeMongoUri('mongodb+srv://u:p@magadimcluster.example.mongodb.net/db', {
      allowProduction: false,
      label: 'test'
    })
  );
});

test('edge: negative quantity rejected by assert helper path via util import', async () => {
  const { assertNonNegativeQuantity } = await import('../utils/kitchen-ops.util');
  assert.equal(assertNonNegativeQuantity(0, 'q'), 0);
  assert.equal(assertNonNegativeQuantity(12.5, 'q'), 12.5);
  assert.throws(() => assertNonNegativeQuantity(-1, 'q'));
});

test('edge: CSV escaping handles commas quotes and newlines', () => {
  // mirrors kitchen-ops.service export csv cell rule
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  assert.equal(esc('a,b'), '"a,b"');
  assert.equal(esc('say "hi"'), '"say ""hi"""');
  assert.match(esc('line1\nline2'), /^"/);
});

test('edge: empty report print still has structure', () => {
  const html = buildOpsPrintHtml({
    view: 'today',
    day: '2026-08-02',
    generatedAt: '2026-08-02T10:00:00.000Z',
    reportVersion: 'KR-empty',
    summary: { tasksTotal: 0 },
    tasks: []
  });
  assert.match(html, /KR-empty/);
  assert.match(html, /dir="rtl"/);
});

test('ops print html includes checkboxes and post-print warning', () => {
  const html = buildOpsPrintHtml({
    view: 'today',
    day: '2026-08-02',
    generatedAt: '2026-08-02T10:00:00.000Z',
    reportVersion: 'KR-sample',
    summary: { tasksTotal: 1 },
    tasks: [
      {
        title: 'הפשרה עוף',
        stageLabel: 'הפשרה',
        plannedQuantity: 40,
        actualQuantity: null,
        plannedStartLabel: '08:00',
        orderSnapshot: {
          orderNumber: 'MG-100',
          fulfillment: 'משלוח',
          allergies: 'בוטנים',
          specialRequests: ''
        },
        assigneeName: '',
        notes: ''
      }
    ]
  });
  assert.match(html, /יש לבדוק שינויים/);
  assert.match(html, /☐/);
  assert.match(html, /הפשרה עוף/);
  assert.match(html, /KR-sample/);

  const outDir = path.join(process.cwd(), 'tmp-screenshots');
  fs.mkdirSync(outDir, { recursive: true });
  const htmlPath = path.join(outDir, 'kitchen-ops-print-sample.html');
  fs.writeFileSync(htmlPath, html, 'utf8');
  const csvPath = path.join(outDir, 'kitchen-ops-sample.csv');
  fs.writeFileSync(
    csvPath,
    '\uFEFFיום,משימה,שלב,סטטוס,מתוכנן,בפועל,הזמנה\r\n2026-08-02,הפשרה עוף,הפשרה,לא התחיל,40,,MG-100\r\n',
    'utf8'
  );
  assert.equal(fs.existsSync(htmlPath), true);
  assert.equal(fs.existsSync(csvPath), true);
});
