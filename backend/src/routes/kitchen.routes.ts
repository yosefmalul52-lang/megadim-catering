import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { CAP, requireCapability } from '../config/role-access';
import { kitchenOpsController } from '../controllers/kitchen-ops.controller';

const router = Router();

router.use(authenticate);

router.get('/ops-report', requireCapability(CAP.KITCHEN_OPS_READ), kitchenOpsController.getOpsReport);
router.get(
  '/ops-report/export/:format',
  requireCapability(CAP.KITCHEN_OPS_READ),
  kitchenOpsController.exportOpsReport
);

router.get('/tasks', requireCapability(CAP.KITCHEN_OPS_READ), kitchenOpsController.listTasks);
router.post('/tasks', requireCapability(CAP.KITCHEN_OPS_WRITE), kitchenOpsController.createTask);
router.patch('/tasks/:id', requireCapability(CAP.KITCHEN_OPS_WRITE), kitchenOpsController.updateTask);
router.post(
  '/tasks/:id/actions',
  requireCapability(CAP.KITCHEN_OPS_WRITE),
  kitchenOpsController.taskAction
);
router.post(
  '/tasks/bulk-actions',
  requireCapability(CAP.KITCHEN_OPS_WRITE),
  kitchenOpsController.bulkActions
);

router.post('/plans', requireCapability(CAP.KITCHEN_OPS_WRITE), kitchenOpsController.buildPlan);
router.post(
  '/plans/apply-template',
  requireCapability(CAP.KITCHEN_OPS_WRITE),
  kitchenOpsController.applyTemplate
);
router.post(
  '/orders/:orderId/sync-review',
  requireCapability(CAP.KITCHEN_OPS_WRITE),
  kitchenOpsController.syncReview
);
router.post('/backfill', requireCapability(CAP.KITCHEN_OPS_WRITE), kitchenOpsController.backfill);

router.get('/stations', requireCapability(CAP.KITCHEN_OPS_READ), kitchenOpsController.listStations);
router.post('/stations', requireCapability(CAP.KITCHEN_OPS_WRITE), kitchenOpsController.createStation);
router.patch(
  '/stations/:id',
  requireCapability(CAP.KITCHEN_OPS_WRITE),
  kitchenOpsController.updateStation
);
router.delete(
  '/stations/:id',
  requireCapability(CAP.KITCHEN_OPS_WRITE),
  kitchenOpsController.deleteStation
);

router.get('/templates', requireCapability(CAP.KITCHEN_OPS_READ), kitchenOpsController.listTemplates);
router.post('/templates', requireCapability(CAP.KITCHEN_OPS_WRITE), kitchenOpsController.createTemplate);
router.patch(
  '/templates/:id',
  requireCapability(CAP.KITCHEN_OPS_WRITE),
  kitchenOpsController.updateTemplate
);
router.delete(
  '/templates/:id',
  requireCapability(CAP.KITCHEN_OPS_WRITE),
  kitchenOpsController.deleteTemplate
);

router.get('/prep-day', requireCapability(CAP.KITCHEN_OPS_READ), kitchenOpsController.getPrepDayReport);
router.post(
  '/prep-assignments',
  requireCapability(CAP.KITCHEN_OPS_WRITE),
  kitchenOpsController.upsertPrepAssignment
);
router.post(
  '/prep-assignments/split',
  requireCapability(CAP.KITCHEN_OPS_WRITE),
  kitchenOpsController.splitPrepAssignment
);
router.get(
  '/orders/:orderId/prep-assignments',
  requireCapability(CAP.KITCHEN_OPS_READ),
  kitchenOpsController.listOrderPrepAssignments
);

export default router;
