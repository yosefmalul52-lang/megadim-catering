import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import mongoose from 'mongoose';
import { Quote, QuoteCounter, IQuote } from '../models/Quote';
import {
  MEGADIM_BANK_DEFAULTS,
  MEGADIM_COMPANY_DEFAULTS,
  QuoteBankSnapshot,
  QuoteCompanySnapshot
} from '../utils/quote-defaults.util';
import { buildQuotePrintHtml } from '../utils/quote-print.util';
import {
  canTransitionQuoteStatus,
  computeQuoteTotals,
  isQuoteEditable,
  QuoteStatus
} from '../utils/quote-totals.util';
import { createNotFoundError, createValidationError, createUnprocessableError } from '../middleware/errorHandler';
import {
  applyPrivatePackageToQuoteFields,
  PrivatePackage,
  QuoteAudience
} from '../utils/quote-private.util';

export type QuotePayload = {
  audience?: QuoteAudience;
  client?: Partial<IQuote['client']>;
  eventDate?: string | Date | null;
  eventLocation?: string;
  lines?: Array<{
    sku?: string;
    description?: string;
    quantity?: number;
    unitPriceInclVat?: number;
    sortOrder?: number;
  }>;
  privatePackage?: Partial<PrivatePackage> | null;
  discountPercent?: number;
  notes?: string;
  vatRate?: number;
  validUntil?: string | Date | null;
  leadId?: string | null;
  companySnapshot?: Partial<QuoteCompanySnapshot>;
  bankSnapshot?: Partial<QuoteBankSnapshot>;
  issuedBy?: string | null;
};

function yearKey(d = new Date()): string {
  return String(d.getFullYear()).slice(-2);
}

/** Allocate next Rivhit-style number: YY/000001 */
export async function allocateQuoteNumber(now = new Date()): Promise<string> {
  const key = yearKey(now);
  const updated = await QuoteCounter.findOneAndUpdate(
    { yearKey: key },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' }
  );
  const seq = updated?.seq || 1;
  return `${key}/${String(seq).padStart(6, '0')}`;
}

function parseOptionalDate(value: unknown): Date | null {
  if (value === undefined || value === null || value === '') return null;
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) {
    throw createValidationError('תאריך לא תקין');
  }
  return d;
}

function normalizeClient(input: Partial<IQuote['client']> | undefined) {
  return {
    name: String(input?.name || '').trim(),
    company: String(input?.company || '').trim(),
    idNumber: String(input?.idNumber || '').trim(),
    address: String(input?.address || '').trim(),
    phone: String(input?.phone || '').trim(),
    email: String(input?.email || '').trim(),
    theirRef: String(input?.theirRef || '').trim()
  };
}

function mergeCompany(input?: Partial<QuoteCompanySnapshot>): QuoteCompanySnapshot {
  return {
    ...MEGADIM_COMPANY_DEFAULTS,
    ...(input || {}),
    name: String(input?.name || MEGADIM_COMPANY_DEFAULTS.name).trim(),
    address: String(input?.address || MEGADIM_COMPANY_DEFAULTS.address).trim(),
    phone: String(input?.phone || MEGADIM_COMPANY_DEFAULTS.phone).trim(),
    businessId: String(input?.businessId || MEGADIM_COMPANY_DEFAULTS.businessId).trim(),
    producerName: String(input?.producerName || MEGADIM_COMPANY_DEFAULTS.producerName).trim()
  };
}

function mergeBank(input?: Partial<QuoteBankSnapshot>): QuoteBankSnapshot {
  return {
    ...MEGADIM_BANK_DEFAULTS,
    ...(input || {}),
    bankCode: String(input?.bankCode || MEGADIM_BANK_DEFAULTS.bankCode).trim(),
    bankName: String(input?.bankName || MEGADIM_BANK_DEFAULTS.bankName).trim(),
    branch: String(input?.branch || MEGADIM_BANK_DEFAULTS.branch).trim(),
    account: String(input?.account || MEGADIM_BANK_DEFAULTS.account).trim()
  };
}

function applyTotalsToDoc(doc: Record<string, unknown>, payload: QuotePayload) {
  const totals = computeQuoteTotals({
    lines: payload.lines,
    discountPercent: payload.discountPercent,
    vatRate: payload.vatRate
  });
  doc.lines = totals.lines;
  doc.discountPercent = totals.discountPercent;
  doc.vatRate = totals.vatRate;
  doc.subtotalInclVat = totals.subtotalInclVat;
  doc.discountAmount = totals.discountAmount;
  doc.totalInclVat = totals.totalInclVat;
  doc.totalExVat = totals.totalExVat;
  doc.vatAmount = totals.vatAmount;
  return totals;
}

export async function createQuote(payload: QuotePayload, actor?: string | null): Promise<IQuote> {
  const quoteNumber = await allocateQuoteNumber();
  const audience: QuoteAudience = payload.audience === 'private' ? 'private' : 'business';
  const doc: Record<string, unknown> = {
    quoteNumber,
    audience,
    status: 'draft',
    client: normalizeClient(payload.client),
    eventDate: parseOptionalDate(payload.eventDate),
    eventLocation: String(payload.eventLocation || '').trim(),
    notes: String(payload.notes || '').trim(),
    validUntil: parseOptionalDate(payload.validUntil),
    companySnapshot: mergeCompany(payload.companySnapshot),
    bankSnapshot: mergeBank(payload.bankSnapshot),
    issuedBy: String(payload.issuedBy || actor || '').trim() || null,
    issuedAt: null,
    leadId:
      payload.leadId && mongoose.Types.ObjectId.isValid(payload.leadId)
        ? new mongoose.Types.ObjectId(payload.leadId)
        : null,
    privatePackage: null,
    isDeleted: false
  };

  if (audience === 'private') {
    const priv = applyPrivatePackageToQuoteFields(
      payload.privatePackage || { serviceCategory: 'catering_shabbat', templateKey: 'two_meals' }
    );
    doc.privatePackage = priv.privatePackage;
    doc.lines = priv.lines;
    doc.discountPercent = priv.discountPercent;
    doc.vatRate = 0;
    doc.subtotalInclVat = priv.subtotalInclVat;
    doc.discountAmount = priv.discountAmount;
    doc.totalInclVat = priv.totalInclVat;
    doc.totalExVat = priv.totalExVat;
    doc.vatAmount = priv.vatAmount;
  } else {
    applyTotalsToDoc(doc, payload);
  }

  const created = await Quote.create(doc);
  return created.toObject() as IQuote;
}

export async function updateQuote(
  id: string,
  payload: QuotePayload,
  actor?: string | null
): Promise<IQuote> {
  if (!mongoose.Types.ObjectId.isValid(id)) throw createValidationError('מזהה הצעה לא תקין');
  const existing = await Quote.findOne({ _id: id, isDeleted: false });
  if (!existing) throw createNotFoundError('הצעת מחיר');
  if (!isQuoteEditable(existing.status)) {
    throw createUnprocessableError('לא ניתן לערוך הצעה בסטטוס זה');
  }

  if (payload.client) existing.client = normalizeClient({ ...existing.client, ...payload.client });
  if (payload.eventDate !== undefined) existing.eventDate = parseOptionalDate(payload.eventDate);
  if (payload.eventLocation !== undefined) {
    existing.eventLocation = String(payload.eventLocation || '').trim();
  }
  if (payload.notes !== undefined) existing.notes = String(payload.notes || '').trim();
  if (payload.validUntil !== undefined) existing.validUntil = parseOptionalDate(payload.validUntil);
  if (payload.companySnapshot) {
    existing.companySnapshot = mergeCompany({ ...existing.companySnapshot, ...payload.companySnapshot });
  }
  if (payload.bankSnapshot) {
    existing.bankSnapshot = mergeBank({ ...existing.bankSnapshot, ...payload.bankSnapshot });
  }
  if (payload.leadId !== undefined) {
    existing.leadId =
      payload.leadId && mongoose.Types.ObjectId.isValid(payload.leadId)
        ? new mongoose.Types.ObjectId(payload.leadId)
        : null;
  }
  if (payload.issuedBy !== undefined) {
    existing.issuedBy = String(payload.issuedBy || actor || '').trim() || null;
  }

  const audience: QuoteAudience =
    payload.audience === 'private' || payload.audience === 'business'
      ? payload.audience
      : existing.audience || 'business';
  existing.audience = audience;

  if (audience === 'private') {
    const priv = applyPrivatePackageToQuoteFields(
      payload.privatePackage !== undefined
        ? payload.privatePackage
        : existing.privatePackage || {
            serviceCategory: 'catering_shabbat',
            templateKey: 'two_meals'
          }
    );
    existing.privatePackage = priv.privatePackage;
    existing.lines = priv.lines as any;
    existing.discountPercent = priv.discountPercent;
    existing.vatRate = 0;
    existing.subtotalInclVat = priv.subtotalInclVat;
    existing.discountAmount = priv.discountAmount;
    existing.totalInclVat = priv.totalInclVat;
    existing.totalExVat = priv.totalExVat;
    existing.vatAmount = priv.vatAmount;
  } else {
    existing.privatePackage = null;
    applyTotalsToDoc(existing as unknown as Record<string, unknown>, {
      lines: payload.lines !== undefined ? payload.lines : existing.lines,
      discountPercent:
        payload.discountPercent !== undefined ? payload.discountPercent : existing.discountPercent,
      vatRate: payload.vatRate !== undefined ? payload.vatRate : existing.vatRate
    });
  }

  await existing.save();
  return existing.toObject() as IQuote;
}

export async function getQuoteById(id: string): Promise<IQuote> {
  if (!mongoose.Types.ObjectId.isValid(id)) throw createValidationError('מזהה הצעה לא תקין');
  const doc = await Quote.findOne({ _id: id, isDeleted: false }).lean();
  if (!doc) throw createNotFoundError('הצעת מחיר');
  return doc as IQuote;
}

export async function listQuotes(query: {
  status?: string;
  search?: string;
  audience?: string;
  page?: number;
  limit?: number;
}): Promise<{
  data: IQuote[];
  meta: { page: number; limit: number; total: number; pages: number };
  kpis: {
    draftCount: number;
    sentThisMonthCount: number;
    acceptedCount: number;
    openQuotesAmount: number;
  };
}> {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 25));
  const filter: Record<string, unknown> = { isDeleted: false };
  const audience = String(query.audience || '').trim();
  if (audience === 'business' || audience === 'private') {
    // Legacy docs without audience count as business
    if (audience === 'business') {
      filter.$and = [
        {
          $or: [{ audience: 'business' }, { audience: { $exists: false } }, { audience: null }]
        }
      ];
    } else {
      filter.audience = 'private';
    }
  }
  if (query.status && String(query.status).trim() && query.status !== 'all') {
    filter.status = String(query.status).trim();
  }
  const search = String(query.search || '').trim();
  if (search) {
    const searchOr = [
      { quoteNumber: { $regex: search, $options: 'i' } },
      { 'client.name': { $regex: search, $options: 'i' } },
      { 'client.company': { $regex: search, $options: 'i' } },
      { 'client.phone': { $regex: search, $options: 'i' } }
    ];
    if (filter.$and) {
      (filter.$and as any[]).push({ $or: searchOr });
    } else {
      filter.$or = searchOr;
    }
  }

  const kpiFilter: Record<string, unknown> = { ...filter };

  const skip = (page - 1) * limit;
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [data, total, draftCount, acceptedCount, sentThisMonthCount, openAgg] = await Promise.all([
    Quote.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Quote.countDocuments(filter),
    Quote.countDocuments({ ...kpiFilter, status: 'draft' }),
    Quote.countDocuments({ ...kpiFilter, status: 'accepted' }),
    Quote.countDocuments({
      ...kpiFilter,
      status: 'sent',
      updatedAt: { $gte: startOfMonth }
    }),
    Quote.aggregate([
      { $match: { ...kpiFilter, status: { $in: ['draft', 'sent'] } } },
      { $group: { _id: null, amount: { $sum: '$totalInclVat' } } }
    ])
  ]);

  return {
    data: data as IQuote[],
    meta: {
      page,
      limit,
      total,
      pages: Math.max(1, Math.ceil(total / limit))
    },
    kpis: {
      draftCount,
      sentThisMonthCount,
      acceptedCount,
      openQuotesAmount: Number(openAgg?.[0]?.amount) || 0
    }
  };
}

export async function changeQuoteStatus(
  id: string,
  nextStatus: string,
  actor?: string | null
): Promise<IQuote> {
  const doc = await Quote.findOne({ _id: id, isDeleted: false });
  if (!doc) throw createNotFoundError('הצעת מחיר');
  if (!canTransitionQuoteStatus(doc.status, nextStatus)) {
    throw createUnprocessableError(`מעבר סטטוס מ-${doc.status} ל-${nextStatus} אינו מותר`);
  }
  doc.status = nextStatus as QuoteStatus;
  if (nextStatus === 'sent' && !doc.issuedAt) {
    doc.issuedAt = new Date();
    if (actor) doc.issuedBy = actor;
  }
  await doc.save();
  return doc.toObject() as IQuote;
}

export async function softDeleteQuote(id: string): Promise<void> {
  const result = await Quote.updateOne({ _id: id, isDeleted: false }, { $set: { isDeleted: true } });
  if (!result.matchedCount) throw createNotFoundError('הצעת מחיר');
}

export async function duplicateQuote(id: string, actor?: string | null): Promise<IQuote> {
  const source = await getQuoteById(id);
  return createQuote(
    {
      audience: source.audience || 'business',
      client: source.client,
      eventDate: source.eventDate,
      eventLocation: source.eventLocation,
      lines: source.lines,
      privatePackage: source.privatePackage,
      discountPercent: source.discountPercent,
      notes: source.notes,
      vatRate: source.vatRate,
      validUntil: source.validUntil,
      leadId: source.leadId ? String(source.leadId) : null,
      companySnapshot: source.companySnapshot,
      bankSnapshot: source.bankSnapshot,
      issuedBy: actor || source.issuedBy
    },
    actor
  );
}

function resolveChromeExecutable(): string | null {
  const env = process.env.CHROME_PATH || process.env.PUPPETEER_EXECUTABLE_PATH;
  if (env && fs.existsSync(env)) return env;
  const candidates = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser'
  ];
  return candidates.find((c) => fs.existsSync(c)) || null;
}

let quotePdfLock: Promise<void> = Promise.resolve();

export async function buildQuotePdfBuffer(quote: IQuote): Promise<Buffer> {
  let release!: () => void;
  const prev = quotePdfLock;
  quotePdfLock = new Promise<void>((r) => {
    release = r;
  });
  await prev;

  try {
    if (!resolveChromeExecutable()) {
      const err: any = new Error(
        'Hebrew PDF requires Chrome/Chromium. Set CHROME_PATH or install Google Chrome.'
      );
      err.statusCode = 503;
      throw err;
    }

    const baseTmp = path.join(process.cwd(), '.tmp-quote-pdf');
    fs.mkdirSync(baseTmp, { recursive: true });
    const tmpDir = fs.mkdtempSync(path.join(baseTmp, 'run-'));
    const htmlPath = path.join(tmpDir, 'quote.html');
    const pdfPath = path.join(tmpDir, 'quote.pdf');
    const fontSrc = path.join(process.cwd(), 'assets/fonts/NotoSansHebrew-Regular.ttf');
    const fontDst = path.join(tmpDir, 'NotoSansHebrew-Regular.ttf');
    if (fs.existsSync(fontSrc)) fs.copyFileSync(fontSrc, fontDst);

    const html = buildQuotePrintHtml(quote, {
      fontUrl: fs.existsSync(fontDst) ? './NotoSansHebrew-Regular.ttf' : undefined
    });
    fs.writeFileSync(htmlPath, html, 'utf8');

    const helper = path.join(process.cwd(), 'scripts/html-to-pdf.py');
    await new Promise<void>((resolve, reject) => {
      const child = spawn('python3', [helper, htmlPath, pdfPath], {
        stdio: ['ignore', 'ignore', 'pipe'],
        env: process.env
      });
      let stderr = '';
      const timer = setTimeout(() => {
        try {
          child.kill('SIGKILL');
        } catch {
          /* ignore */
        }
        reject(new Error('Chrome PDF timed out after 25s'));
      }, 25000);
      child.stderr.on('data', (d: Buffer) => {
        stderr += d.toString();
      });
      child.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
      child.on('close', (code: number | null) => {
        clearTimeout(timer);
        if (code === 0 && fs.existsSync(pdfPath)) resolve();
        else reject(new Error(`Chrome PDF failed (code ${code}): ${stderr.slice(0, 400)}`));
      });
    });

    const buf = fs.readFileSync(pdfPath);
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
    return buf;
  } finally {
    release();
  }
}

export function getQuotePrintHtml(quote: IQuote): string {
  return buildQuotePrintHtml(quote);
}
