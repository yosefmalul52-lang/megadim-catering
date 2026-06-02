import { Request, Response, NextFunction } from 'express';
import Order from '../models/Order';
import ExternalInvoice from '../models/ExternalInvoice';
import { asyncHandler } from '../middleware/errorHandler';

// ─── Helpers ────────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Returns the YYYY-MM string for a Date */
function yearMonth(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/** Builds a 12-month period array ending at the current month, newest last */
function last12Months(): string[] {
  const months: string[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(yearMonth(d));
  }
  return months;
}

// ─── GET /summary ────────────────────────────────────────────────────────────

export const getSummary = asyncHandler(async (_req: Request, res: Response) => {
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
  twelveMonthsAgo.setDate(1);
  twelveMonthsAgo.setHours(0, 0, 0, 0);

  // Aggregate captured orders
  const [onlineAgg, externalAgg] = await Promise.all([
    Order.aggregate([
      { $match: { paymentStatus: 'captured', isDeleted: { $ne: true } } },
      { $group: { _id: null, total: { $sum: '$totalPrice' } } }
    ]),
    ExternalInvoice.aggregate([
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ])
  ]);

  const onlineTotal   = round2(onlineAgg[0]?.total   ?? 0);
  const externalTotal = round2(externalAgg[0]?.total ?? 0);
  const grandTotal    = round2(onlineTotal + externalTotal);

  // Monthly breakdown for the last 12 months
  const [onlineMonthly, externalMonthly] = await Promise.all([
    Order.aggregate([
      {
        $match: {
          paymentStatus: 'captured',
          isDeleted: { $ne: true },
          createdAt: { $gte: twelveMonthsAgo }
        }
      },
      {
        $group: {
          _id: {
            year:  { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          total: { $sum: '$totalPrice' }
        }
      }
    ]),
    ExternalInvoice.aggregate([
      { $match: { issueDate: { $gte: twelveMonthsAgo } } },
      {
        $group: {
          _id: {
            year:  { $year: '$issueDate' },
            month: { $month: '$issueDate' }
          },
          total: { $sum: '$amount' }
        }
      }
    ])
  ]);

  // Build lookup maps: "YYYY-MM" → amount
  const onlineMap = new Map<string, number>();
  for (const row of onlineMonthly) {
    const key = `${row._id.year}-${String(row._id.month).padStart(2, '0')}`;
    onlineMap.set(key, round2(row.total));
  }
  const externalMap = new Map<string, number>();
  for (const row of externalMonthly) {
    const key = `${row._id.year}-${String(row._id.month).padStart(2, '0')}`;
    externalMap.set(key, round2(row.total));
  }

  const periods = last12Months();
  const breakdown = periods.map(m => ({
    month:    m,
    online:   onlineMap.get(m)   ?? 0,
    external: externalMap.get(m) ?? 0,
    total:    round2((onlineMap.get(m) ?? 0) + (externalMap.get(m) ?? 0))
  }));

  return res.status(200).json({
    success: true,
    data: { grandTotal, onlineTotal, externalTotal, breakdown }
  });
});

// ─── GET /transactions ───────────────────────────────────────────────────────

export const getTransactions = asyncHandler(async (req: Request, res: Response) => {
  const page   = Math.max(1, Number(req.query['page'])  || 1);
  const limit  = Math.min(100, Math.max(1, Number(req.query['limit']) || 25));
  const source = req.query['source'] as string | undefined; // 'online' | 'external'
  const dateFrom = req.query['dateFrom'] ? new Date(req.query['dateFrom'] as string) : undefined;
  const dateTo   = req.query['dateTo']   ? new Date(req.query['dateTo']   as string) : undefined;

  const items: Array<{
    id:          string;
    date:        Date;
    clientName:  string;
    source:      'online' | 'external';
    amount:      number;
    fileUrl?:    string;
    orderId?:    string;
    invoiceNum?: string;
  }> = [];

  // Online orders
  if (!source || source === 'online') {
    const orderQuery: Record<string, unknown> = {
      paymentStatus: 'captured',
      isDeleted:     { $ne: true }
    };
    if (dateFrom || dateTo) {
      const range: Record<string, Date> = {};
      if (dateFrom) range['$gte'] = dateFrom;
      if (dateTo)   range['$lte'] = dateTo;
      orderQuery['createdAt'] = range;
    }

    const orders = await Order.find(orderQuery)
      .select('_id totalPrice createdAt customerDetails')
      .sort({ createdAt: -1 })
      .lean();

    for (const o of orders) {
      const details = (o as any).customerDetails || {};
      items.push({
        id:         String(o._id),
        date:       (o as any).createdAt,
        clientName: details.fullName || details.name || details.customerName || 'לקוח',
        source:     'online',
        amount:     round2((o as any).totalPrice),
        orderId:    String(o._id)
      });
    }
  }

  // External invoices
  if (!source || source === 'external') {
    const extQuery: Record<string, unknown> = {};
    if (dateFrom || dateTo) {
      const range: Record<string, Date> = {};
      if (dateFrom) range['$gte'] = dateFrom;
      if (dateTo)   range['$lte'] = dateTo;
      extQuery['issueDate'] = range;
    }

    const invoices = await ExternalInvoice.find(extQuery)
      .sort({ issueDate: -1 })
      .lean();

    for (const inv of invoices) {
      items.push({
        id:          String(inv._id),
        date:        inv.issueDate,
        clientName:  inv.clientName,
        source:      'external',
        amount:      round2(inv.amount),
        fileUrl:     inv.fileUrl,
        invoiceNum:  inv.invoiceNumber
      });
    }
  }

  // Sort merged list by date descending, then paginate in memory
  items.sort((a, b) => b.date.getTime() - a.date.getTime());

  const total      = items.length;
  const totalPages = Math.ceil(total / limit);
  const start      = (page - 1) * limit;
  const pageItems  = items.slice(start, start + limit);

  return res.status(200).json({
    success: true,
    data:    pageItems,
    meta:    { total, page, limit, totalPages }
  });
});

// ─── POST /external ──────────────────────────────────────────────────────────

export const createExternal = asyncHandler(async (req: Request, res: Response) => {
  const { clientName, amount, issueDate, description, invoiceNumber, fileUrl, fileKey } = req.body;

  if (!clientName || typeof clientName !== 'string' || !clientName.trim()) {
    return res.status(400).json({ success: false, message: 'clientName is required' });
  }
  const parsedAmount = Number(amount);
  if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
    return res.status(400).json({ success: false, message: 'amount must be a positive number' });
  }

  const invoice = new ExternalInvoice({
    clientName:    clientName.trim(),
    amount:        round2(parsedAmount),
    issueDate:     issueDate ? new Date(issueDate) : new Date(),
    description:   description?.trim() || undefined,
    invoiceNumber: invoiceNumber?.trim() || undefined,
    fileUrl:       fileUrl   || undefined,
    fileKey:       fileKey   || undefined
  });

  await invoice.save();

  return res.status(201).json({ success: true, data: invoice });
});

// ─── POST /upload ────────────────────────────────────────────────────────────

export const uploadDocument = asyncHandler(async (req: Request, res: Response) => {
  const file = req.file as Express.Multer.File & { path?: string; filename?: string };
  if (!file) {
    return res.status(400).json({ success: false, message: 'No file provided' });
  }

  return res.status(200).json({
    success: true,
    fileUrl: file.path     || (file as any).secure_url || '',
    fileKey: file.filename || (file as any).public_id  || ''
  });
});
