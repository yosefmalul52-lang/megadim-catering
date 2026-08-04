import { Request, Response } from 'express';
import { asyncHandler, createNotFoundError } from '../middleware/errorHandler';
import {
  buildExportFilename,
  exportAdminPaymentsCsv,
  getAdminPaymentDetail,
  getAdminPaymentsFunnel,
  getAdminPaymentsRevenueSeries,
  getAdminPaymentsSummary,
  listAdminPaymentExceptions,
  listAdminPayments,
  parseAdminPaymentsQuery
} from '../services/admin-payments.service';
import { assertNoSensitiveLeak } from '../utils/admin-payments.util';

function queryRecord(req: Request): Record<string, unknown> {
  return req.query as Record<string, unknown>;
}

function respondSafe(res: Response, status: number, body: Record<string, unknown>) {
  const leaks = assertNoSensitiveLeak(body);
  if (leaks.length) {
    console.error('[admin-payments] blocked sensitive leak paths:', leaks.join(', '));
    return res.status(500).json({
      success: false,
      message: 'Payment response sanitization failed'
    });
  }
  return res.status(status).json(body);
}

/** GET /api/admin/payments/summary */
export const getSummary = asyncHandler(async (req: Request, res: Response) => {
  const filters = parseAdminPaymentsQuery(queryRecord(req));
  const data = await getAdminPaymentsSummary(filters);
  return respondSafe(res, 200, { success: true, data });
});

/** GET /api/admin/payments/funnel */
export const getFunnel = asyncHandler(async (req: Request, res: Response) => {
  const filters = parseAdminPaymentsQuery(queryRecord(req));
  const data = await getAdminPaymentsFunnel(filters);
  return respondSafe(res, 200, { success: true, data });
});

/** GET /api/admin/payments/revenue-series */
export const getRevenueSeries = asyncHandler(async (req: Request, res: Response) => {
  const filters = parseAdminPaymentsQuery(queryRecord(req));
  const data = await getAdminPaymentsRevenueSeries(filters);
  return respondSafe(res, 200, { success: true, data });
});

/** GET /api/admin/payments/exceptions */
export const listExceptions = asyncHandler(async (req: Request, res: Response) => {
  const filters = parseAdminPaymentsQuery(queryRecord(req));
  const result = await listAdminPaymentExceptions(filters);
  return respondSafe(res, 200, { success: true, data: result.data, meta: result.meta });
});

/** GET /api/admin/payments */
export const listPayments = asyncHandler(async (req: Request, res: Response) => {
  const filters = parseAdminPaymentsQuery(queryRecord(req));
  const result = await listAdminPayments(filters);
  return respondSafe(res, 200, { success: true, data: result.data, meta: result.meta });
});

/** GET /api/admin/payments/export.csv */
export const exportPaymentsCsv = asyncHandler(async (req: Request, res: Response) => {
  const filters = parseAdminPaymentsQuery(queryRecord(req));
  const csv = await exportAdminPaymentsCsv(filters);
  const filename = buildExportFilename(filters);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  return res.status(200).send(csv);
});

/** GET /api/admin/payments/:orderId */
export const getPaymentDetail = asyncHandler(async (req: Request, res: Response) => {
  const orderId = String(req.params.orderId || '').trim();
  if (!orderId) throw createNotFoundError('Order');
  const data = await getAdminPaymentDetail(orderId);
  if (!data) throw createNotFoundError('Order');
  return respondSafe(res, 200, { success: true, data });
});
