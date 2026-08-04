import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import * as ops from '../services/kitchen-ops.service';

function by(req: Request): string {
  const u = (req as any).user || {};
  return String(u.username || u.email || u.fullName || 'admin');
}

function sendError(res: Response, err: any) {
  const status = Number(err?.statusCode) || 500;
  res.status(status).json({ success: false, message: err?.message || 'Kitchen ops error' });
}

export const kitchenOpsController = {
  getOpsReport: asyncHandler(async (req: Request, res: Response) => {
    try {
      const report = await ops.getKitchenOpsReport(req.query as Record<string, unknown>);
      res.status(200).json({ success: true, report });
    } catch (err: any) {
      sendError(res, err);
    }
  }),

  exportOpsReport: asyncHandler(async (req: Request, res: Response) => {
    try {
      const format = String(req.params.format || '').toLowerCase();
      const out = await ops.exportKitchenOpsReport(format, req.query as Record<string, unknown>);
      const range = `${out.report.day || out.report.range?.startDate}`;
      if (out.type === 'html') {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(out.body);
        return;
      }
      if (out.type === 'csv') {
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="kitchen-ops_${range}.csv"`);
        res.send(out.body);
        return;
      }
      if (out.type === 'xlsx') {
        res.setHeader(
          'Content-Type',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader('Content-Disposition', `attachment; filename="kitchen-ops_${range}.xlsx"`);
        res.send(out.body);
        return;
      }
      if (out.type === 'pdf') {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="kitchen-ops_${range}.pdf"`);
        res.send(out.body);
        return;
      }
      res.status(400).json({ success: false, message: 'Unsupported format' });
    } catch (err: any) {
      sendError(res, err);
    }
  }),

  listTasks: asyncHandler(async (req: Request, res: Response) => {
    try {
      const data = await ops.listKitchenTasks(req.query as Record<string, unknown>);
      res.status(200).json({ success: true, data });
    } catch (err: any) {
      sendError(res, err);
    }
  }),

  createTask: asyncHandler(async (req: Request, res: Response) => {
    try {
      const data = await ops.createKitchenTask(req.body, by(req));
      res.status(201).json({ success: true, data });
    } catch (err: any) {
      sendError(res, err);
    }
  }),

  updateTask: asyncHandler(async (req: Request, res: Response) => {
    try {
      const data = await ops.updateKitchenTask(req.params.id, req.body, by(req));
      res.status(200).json({ success: true, data });
    } catch (err: any) {
      sendError(res, err);
    }
  }),

  taskAction: asyncHandler(async (req: Request, res: Response) => {
    try {
      const idem = String(req.header('Idempotency-Key') || req.body?.idempotencyKey || '');
      const data = await ops.applyTaskAction(
        req.params.id,
        {
          action: req.body?.action,
          version: req.body?.version,
          payload: req.body?.payload,
          idempotencyKey: idem || undefined
        },
        by(req)
      );
      res.status(200).json({ success: true, data });
    } catch (err: any) {
      sendError(res, err);
    }
  }),

  bulkActions: asyncHandler(async (req: Request, res: Response) => {
    try {
      const data = await ops.bulkTaskActions(req.body, by(req));
      res.status(200).json({ success: true, data });
    } catch (err: any) {
      sendError(res, err);
    }
  }),

  buildPlan: asyncHandler(async (req: Request, res: Response) => {
    try {
      const data = await ops.buildKitchenPlan(req.body, by(req));
      res.status(200).json({ success: true, data });
    } catch (err: any) {
      sendError(res, err);
    }
  }),

  applyTemplate: asyncHandler(async (req: Request, res: Response) => {
    try {
      if (!req.body?.templateId) {
        res.status(400).json({ success: false, message: 'templateId חובה' });
        return;
      }
      const data = await ops.buildKitchenPlan(
        {
          orderId: req.body.orderId,
          templateId: req.body.templateId,
          commit: req.body.commit !== false,
          saveAsTemplateName: req.body.saveAsTemplateName
        },
        by(req)
      );
      res.status(200).json({ success: true, data });
    } catch (err: any) {
      sendError(res, err);
    }
  }),

  syncReview: asyncHandler(async (req: Request, res: Response) => {
    try {
      const data = await ops.syncReviewOrderTasks(req.params.orderId, req.body, by(req));
      res.status(200).json({ success: true, data });
    } catch (err: any) {
      sendError(res, err);
    }
  }),

  backfill: asyncHandler(async (req: Request, res: Response) => {
    try {
      if (process.env.NODE_ENV === 'production' && req.body?.allowProduction !== true) {
        res.status(403).json({
          success: false,
          message: 'Backfill חסום ב־Production ללא allowProduction מפורש'
        });
        return;
      }
      const uri = process.env.MONGODB_URI || process.env.MONGO_URI || '';
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { assertSafeMongoUri } = require('../../../scripts/lib/assert-not-production-mongo.cjs');
      try {
        assertSafeMongoUri(uri, {
          allowProduction: req.body?.allowProduction === true,
          label: 'kitchen API backfill'
        });
      } catch (e: any) {
        res.status(403).json({ success: false, message: e?.message || 'Mongo URI לא בטוח ל־backfill' });
        return;
      }
      const data = await ops.backfillKitchenTasks({
        startDate: req.body?.startDate || req.query.startDate,
        endDate: req.body?.endDate || req.query.endDate,
        dryRun: req.body?.dryRun === true || req.query.dryRun === 'true'
      });
      res.status(200).json({ success: true, data });
    } catch (err: any) {
      sendError(res, err);
    }
  }),

  listStations: asyncHandler(async (_req: Request, res: Response) => {
    const data = await ops.listStations();
    res.status(200).json({ success: true, data });
  }),

  createStation: asyncHandler(async (req: Request, res: Response) => {
    try {
      const data = await ops.upsertStation(req.body);
      res.status(201).json({ success: true, data });
    } catch (err: any) {
      sendError(res, err);
    }
  }),

  updateStation: asyncHandler(async (req: Request, res: Response) => {
    try {
      const data = await ops.upsertStation(req.body, req.params.id);
      res.status(200).json({ success: true, data });
    } catch (err: any) {
      sendError(res, err);
    }
  }),

  deleteStation: asyncHandler(async (req: Request, res: Response) => {
    try {
      const data = await ops.deleteStation(req.params.id);
      res.status(200).json({ success: true, data });
    } catch (err: any) {
      sendError(res, err);
    }
  }),

  listTemplates: asyncHandler(async (_req: Request, res: Response) => {
    const data = await ops.listTemplates();
    res.status(200).json({ success: true, data });
  }),

  createTemplate: asyncHandler(async (req: Request, res: Response) => {
    try {
      const data = await ops.saveTemplate(req.body, by(req));
      res.status(201).json({ success: true, data });
    } catch (err: any) {
      sendError(res, err);
    }
  }),

  updateTemplate: asyncHandler(async (req: Request, res: Response) => {
    try {
      const data = await ops.saveTemplate(req.body, by(req), req.params.id);
      res.status(200).json({ success: true, data });
    } catch (err: any) {
      sendError(res, err);
    }
  }),

  deleteTemplate: asyncHandler(async (req: Request, res: Response) => {
    try {
      const data = await ops.deleteTemplate(req.params.id);
      res.status(200).json({ success: true, data });
    } catch (err: any) {
      sendError(res, err);
    }
  }),

  getPrepDayReport: asyncHandler(async (req: Request, res: Response) => {
    try {
      const prepDay = await import('../services/kitchen-prep-day.service');
      const data = await prepDay.getPrepDayReport(req.query as Record<string, unknown>);
      res.status(200).json({ success: true, data });
    } catch (err: any) {
      sendError(res, err);
    }
  }),

  upsertPrepAssignment: asyncHandler(async (req: Request, res: Response) => {
    try {
      const prepDay = await import('../services/kitchen-prep-day.service');
      const data = await prepDay.upsertPrepAssignment(req.body, by(req));
      res.status(200).json({ success: true, data });
    } catch (err: any) {
      sendError(res, err);
    }
  }),

  splitPrepAssignment: asyncHandler(async (req: Request, res: Response) => {
    try {
      const prepDay = await import('../services/kitchen-prep-day.service');
      const data = await prepDay.splitPrepAssignment(req.body, by(req));
      res.status(200).json({ success: true, data });
    } catch (err: any) {
      sendError(res, err);
    }
  }),

  listOrderPrepAssignments: asyncHandler(async (req: Request, res: Response) => {
    try {
      const prepDay = await import('../services/kitchen-prep-day.service');
      const data = await prepDay.listOrderPrepAssignments(String(req.params.orderId || ''));
      res.status(200).json({ success: true, data });
    } catch (err: any) {
      sendError(res, err);
    }
  })
};
