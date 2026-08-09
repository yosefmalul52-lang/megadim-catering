import { Router } from 'express';
import {
  changeStatusHandler,
  createQuoteHandler,
  deleteQuoteHandler,
  duplicateQuoteHandler,
  getQuoteHandler,
  getQuoteHtmlHandler,
  getQuotePdfHandler,
  listQuotesHandler,
  updateQuoteHandler
} from '../controllers/quotes.controller';

const { authenticate } = require('../middleware/auth');
const { requireAdmin } = require('../config/role-access');

const router = Router();

router.use(authenticate, requireAdmin);

router.get('/', listQuotesHandler);
router.post('/', createQuoteHandler);
router.get('/:id', getQuoteHandler);
router.put('/:id', updateQuoteHandler);
router.post('/:id/status', changeStatusHandler);
router.post('/:id/duplicate', duplicateQuoteHandler);
router.delete('/:id', deleteQuoteHandler);
router.get('/:id/html', getQuoteHtmlHandler);
router.get('/:id/pdf', getQuotePdfHandler);

export default router;
