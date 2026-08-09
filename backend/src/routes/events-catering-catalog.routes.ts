import express from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import {
  getAdminEventsCatalog,
  getAdminShabbatCatalog,
  getPublicEventsCatalog,
  getPublicShabbatCatalog,
  putAdminEventsCatalog,
  putAdminShabbatCatalog
} from '../controllers/events-catering-catalog.controller';

const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { requireAdmin } = require('../config/role-access');

router.get('/public', asyncHandler(getPublicEventsCatalog as any));
router.get('/shabbat/public', asyncHandler(getPublicShabbatCatalog as any));

router.get('/', authenticate, requireAdmin, asyncHandler(getAdminEventsCatalog as any));
router.put('/', authenticate, requireAdmin, asyncHandler(putAdminEventsCatalog as any));

router.get('/shabbat', authenticate, requireAdmin, asyncHandler(getAdminShabbatCatalog as any));
router.put('/shabbat', authenticate, requireAdmin, asyncHandler(putAdminShabbatCatalog as any));

export default router;
