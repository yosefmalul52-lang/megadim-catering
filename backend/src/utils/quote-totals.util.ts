import { DEFAULT_VAT_RATE } from './quote-defaults.util';

export interface QuoteLineInput {
  sku?: string | null;
  description?: string | null;
  quantity?: number | null;
  unitPriceInclVat?: number | null;
  sortOrder?: number | null;
}

export interface QuoteLineComputed {
  sku: string;
  description: string;
  quantity: number;
  unitPriceInclVat: number;
  lineTotalInclVat: number;
  sortOrder: number;
}

export interface QuoteTotals {
  subtotalInclVat: number;
  discountPercent: number;
  discountAmount: number;
  totalInclVat: number;
  totalExVat: number;
  vatAmount: number;
  vatRate: number;
  lines: QuoteLineComputed[];
}

function roundMoney(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export function normalizeQuoteLines(raw: QuoteLineInput[] | null | undefined): QuoteLineComputed[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row, index) => {
      const quantity = Math.max(0, Number(row?.quantity) || 0);
      const unitPriceInclVat = Math.max(0, roundMoney(Number(row?.unitPriceInclVat) || 0));
      const description = String(row?.description || '').trim();
      const sku = String(row?.sku ?? '').trim();
      const sortOrder =
        Number.isFinite(Number(row?.sortOrder)) && Number(row?.sortOrder) >= 0
          ? Math.trunc(Number(row.sortOrder))
          : index;
      return {
        sku,
        description,
        quantity,
        unitPriceInclVat,
        lineTotalInclVat: roundMoney(quantity * unitPriceInclVat),
        sortOrder
      };
    })
    .filter((row) => row.description.length > 0)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((row, index) => ({ ...row, sortOrder: index }));
}

/**
 * All unit prices are VAT-inclusive (Rivhit-style).
 * totalExVat / vatAmount derived from the payable incl-VAT total.
 */
export function computeQuoteTotals(input: {
  lines?: QuoteLineInput[] | null;
  discountPercent?: number | null;
  vatRate?: number | null;
}): QuoteTotals {
  const lines = normalizeQuoteLines(input.lines);
  const vatRate =
    Number.isFinite(Number(input.vatRate)) && Number(input.vatRate) >= 0
      ? Number(input.vatRate)
      : DEFAULT_VAT_RATE;
  const discountPercent = Math.min(
    100,
    Math.max(0, Number.isFinite(Number(input.discountPercent)) ? Number(input.discountPercent) : 0)
  );

  const subtotalInclVat = roundMoney(lines.reduce((sum, line) => sum + line.lineTotalInclVat, 0));
  const discountAmount = roundMoney((subtotalInclVat * discountPercent) / 100);
  const totalInclVat = Math.max(0, roundMoney(subtotalInclVat - discountAmount));
  const divisor = 1 + vatRate / 100;
  const totalExVat = divisor > 0 ? roundMoney(totalInclVat / divisor) : totalInclVat;
  const vatAmount = roundMoney(totalInclVat - totalExVat);

  return {
    subtotalInclVat,
    discountPercent,
    discountAmount,
    totalInclVat,
    totalExVat,
    vatAmount,
    vatRate,
    lines
  };
}

/** Allowed status transitions for admin quote workflow. */
export const QUOTE_STATUSES = [
  'draft',
  'sent',
  'accepted',
  'rejected',
  'expired',
  'converted'
] as const;

export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

const TRANSITIONS: Record<QuoteStatus, QuoteStatus[]> = {
  draft: ['sent', 'rejected', 'expired'],
  sent: ['accepted', 'rejected', 'expired', 'draft'],
  accepted: ['converted', 'expired'],
  rejected: ['draft'],
  expired: ['draft'],
  converted: []
};

export function canTransitionQuoteStatus(from: string, to: string): boolean {
  const a = String(from || '').trim() as QuoteStatus;
  const b = String(to || '').trim() as QuoteStatus;
  if (!(QUOTE_STATUSES as readonly string[]).includes(a)) return false;
  if (!(QUOTE_STATUSES as readonly string[]).includes(b)) return false;
  if (a === b) return true;
  return TRANSITIONS[a].includes(b);
}

export function isQuoteEditable(status: string): boolean {
  const s = String(status || '').trim();
  return s === 'draft' || s === 'sent';
}
