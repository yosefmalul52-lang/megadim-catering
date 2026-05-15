import express from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import {
  getActiveHolidayEvent,
  listHolidayEvents,
  getHolidayEventById,
  createHolidayEvent,
  updateHolidayEvent,
  deleteHolidayEvent,
  migrateShavuotToHoliday
} from '../controllers/holiday-event.controller';

const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { requireAdmin } = require('../config/role-access');

router.get('/public/active', asyncHandler(getActiveHolidayEvent as any));
router.post(
  '/migrate-shavuot',
  authenticate,
  requireAdmin,
  asyncHandler(migrateShavuotToHoliday as any)
);
router.get('/', authenticate, requireAdmin, asyncHandler(listHolidayEvents as any));
router.get('/:id', authenticate, requireAdmin, asyncHandler(getHolidayEventById as any));
router.post('/', authenticate, requireAdmin, asyncHandler(createHolidayEvent as any));
router.put('/:id', authenticate, requireAdmin, asyncHandler(updateHolidayEvent as any));
router.delete('/:id', authenticate, requireAdmin, asyncHandler(deleteHolidayEvent as any));

export default router;
