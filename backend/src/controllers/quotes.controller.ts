import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import {
  changeQuoteStatus,
  createQuote,
  duplicateQuote,
  getQuoteById,
  getQuotePrintHtml,
  buildQuotePdfBuffer,
  listQuotes,
  softDeleteQuote,
  updateQuote
} from '../services/quotes.service';

function actorName(req: Request): string | null {
  const user = (req as any).user;
  if (!user) return null;
  return String(user.name || user.email || user.id || user._id || '').trim() || null;
}

/** GET /api/quotes */
export const listQuotesHandler = asyncHandler(async (req: Request, res: Response) => {
  const result = await listQuotes({
    status: String(req.query.status || ''),
    search: String(req.query.search || ''),
    audience: String(req.query.audience || ''),
    page: Number(req.query.page) || 1,
    limit: Number(req.query.limit) || 25
  });
  res.json({ success: true, ...result });
});

/** GET /api/quotes/:id */
export const getQuoteHandler = asyncHandler(async (req: Request, res: Response) => {
  const data = await getQuoteById(String(req.params.id));
  res.json({ success: true, data });
});

/** POST /api/quotes */
export const createQuoteHandler = asyncHandler(async (req: Request, res: Response) => {
  const data = await createQuote(req.body || {}, actorName(req));
  res.status(201).json({ success: true, data });
});

/** PUT /api/quotes/:id */
export const updateQuoteHandler = asyncHandler(async (req: Request, res: Response) => {
  const data = await updateQuote(String(req.params.id), req.body || {}, actorName(req));
  res.json({ success: true, data });
});

/** POST /api/quotes/:id/status */
export const changeStatusHandler = asyncHandler(async (req: Request, res: Response) => {
  const status = String(req.body?.status || '').trim();
  const data = await changeQuoteStatus(String(req.params.id), status, actorName(req));
  res.json({ success: true, data });
});

/** POST /api/quotes/:id/duplicate */
export const duplicateQuoteHandler = asyncHandler(async (req: Request, res: Response) => {
  const data = await duplicateQuote(String(req.params.id), actorName(req));
  res.status(201).json({ success: true, data });
});

/** DELETE /api/quotes/:id — soft delete */
export const deleteQuoteHandler = asyncHandler(async (req: Request, res: Response) => {
  await softDeleteQuote(String(req.params.id));
  res.json({ success: true });
});

/** GET /api/quotes/:id/html — printable HTML */
export const getQuoteHtmlHandler = asyncHandler(async (req: Request, res: Response) => {
  const quote = await getQuoteById(String(req.params.id));
  const html = getQuotePrintHtml(quote);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

/** GET /api/quotes/:id/pdf */
export const getQuotePdfHandler = asyncHandler(async (req: Request, res: Response) => {
  const quote = await getQuoteById(String(req.params.id));
  const buf = await buildQuotePdfBuffer(quote);
  const filename = `quote-${String(quote.quoteNumber).replace(/\//g, '-')}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buf);
});
