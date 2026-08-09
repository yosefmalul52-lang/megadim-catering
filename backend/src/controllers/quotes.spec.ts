/**
 * Quote totals + status transition unit tests (no DB).
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canTransitionQuoteStatus,
  computeQuoteTotals,
  isQuoteEditable,
  normalizeQuoteLines
} from '../utils/quote-totals.util';
import { buildQuotePrintHtml } from '../utils/quote-print.util';
import { MEGADIM_BANK_DEFAULTS, MEGADIM_COMPANY_DEFAULTS, formatBankLine } from '../utils/quote-defaults.util';

test('quote totals: VAT-inclusive lines, discount, ex-VAT split', () => {
  const totals = computeQuoteTotals({
    discountPercent: 0,
    vatRate: 18,
    lines: [
      { sku: '1000', description: 'שירותי קייטרינג', quantity: 550, unitPriceInclVat: 49 },
      { sku: '0', description: '10 סוגי סלטים', quantity: 1, unitPriceInclVat: 0 },
      { sku: '9', description: 'משלוח', quantity: 1, unitPriceInclVat: 150 }
    ]
  });
  assert.equal(totals.lines.length, 3);
  assert.equal(totals.subtotalInclVat, 27100);
  assert.equal(totals.discountAmount, 0);
  assert.equal(totals.totalInclVat, 27100);
  assert.equal(totals.totalExVat, 22966.1);
  assert.equal(totals.vatAmount, 4133.9);
});

test('quote totals: discount percent reduces payable', () => {
  const totals = computeQuoteTotals({
    discountPercent: 10,
    vatRate: 18,
    lines: [{ description: 'שירות', quantity: 1, unitPriceInclVat: 1000 }]
  });
  assert.equal(totals.subtotalInclVat, 1000);
  assert.equal(totals.discountAmount, 100);
  assert.equal(totals.totalInclVat, 900);
});

test('normalizeQuoteLines drops empty descriptions and keeps zero-price notes', () => {
  const lines = normalizeQuoteLines([
    { description: '', quantity: 1, unitPriceInclVat: 10 },
    { description: 'הערה', quantity: 1, unitPriceInclVat: 0 },
    { description: 'מנה', quantity: 2, unitPriceInclVat: 50 }
  ]);
  assert.equal(lines.length, 2);
  assert.equal(lines[0].description, 'הערה');
  assert.equal(lines[0].lineTotalInclVat, 0);
  assert.equal(lines[1].lineTotalInclVat, 100);
});

test('status transitions enforce workflow', () => {
  assert.equal(canTransitionQuoteStatus('draft', 'sent'), true);
  assert.equal(canTransitionQuoteStatus('sent', 'accepted'), true);
  assert.equal(canTransitionQuoteStatus('accepted', 'converted'), true);
  assert.equal(canTransitionQuoteStatus('converted', 'draft'), false);
  assert.equal(canTransitionQuoteStatus('draft', 'converted'), false);
  assert.equal(isQuoteEditable('draft'), true);
  assert.equal(isQuoteEditable('sent'), true);
  assert.equal(isQuoteEditable('accepted'), false);
});

test('print HTML includes company, client, totals and bank line', () => {
  const html = buildQuotePrintHtml({
    quoteNumber: '26/000029',
    client: {
      name: '',
      company: 'החברה הממשלתית לתיירות',
      idNumber: '51014114-6',
      address: 'ירושלים',
      phone: '',
      email: '',
      theirRef: '06344'
    },
    lines: [
      {
        sku: '1000',
        description: 'שירותי קייטרינג',
        quantity: 550,
        unitPriceInclVat: 49,
        lineTotalInclVat: 26950,
        sortOrder: 0
      }
    ],
    subtotalInclVat: 26950,
    discountPercent: 0,
    discountAmount: 0,
    totalInclVat: 26950,
    totalExVat: 22838.98,
    vatAmount: 4111.02,
    vatRate: 18,
    companySnapshot: MEGADIM_COMPANY_DEFAULTS,
    bankSnapshot: MEGADIM_BANK_DEFAULTS,
    notes: '',
    eventDate: null,
    eventLocation: '',
    issuedBy: 'בני מהלא',
    createdAt: new Date('2026-07-28T10:19:00')
  });
  assert.match(html, /הצעת מחיר/);
  assert.match(html, /26\/000029/);
  assert.match(html, /החברה הממשלתית לתיירות/);
  assert.match(html, /קייטרינג מגדים/);
  assert.match(html, /26950|26,950/);
  assert.ok(html.includes(formatBankLine(MEGADIM_BANK_DEFAULTS)) || html.includes('פועלים'));
});
