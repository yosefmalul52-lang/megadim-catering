import { Router } from 'express';
import {
  exportPaymentsCsv,
  getFunnel,
  getPaymentDetail,
  getRevenueSeries,
  getSummary,
  listExceptions,
  listPayments
} from '../controllers/admin-payments.controller';

const { authenticate } = require('../middleware/auth');
const { requireAdmin } = require('../config/role-access');

const router = Router();

router.use(authenticate, requireAdmin);

router.get('/summary', getSummary);
router.get('/funnel', getFunnel);
router.get('/revenue-series', getRevenueSeries);
router.get('/exceptions', listExceptions);
router.get('/export.csv', exportPaymentsCsv);
router.get('/', listPayments);
router.get('/:orderId', getPaymentDetail);

export default router;
