import { Router } from 'express';
import { SettingsController } from '../controllers/settings.controller';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();
const { authenticate } = require('../middleware/auth');
const { requireAdmin } = require('../config/role-access');
const settingsController = new SettingsController();

// Public – site settings (contact, menus, announcements). GET /api/settings
router.get('/', asyncHandler(settingsController.getSettings as any));
router.put('/', authenticate, requireAdmin, asyncHandler(settingsController.updateSettings as any));

// Public – global store settings (freeShippingThreshold, baseDeliveryFee, pricePerKm) for shipping dashboard
router.get('/store', asyncHandler(settingsController.getStoreSettings as any));
router.put('/store', authenticate, requireAdmin, asyncHandler(settingsController.updateStoreSettings as any));

// Public – delivery / free-shipping store settings (allowed days, minimum lead, etc.). GET /api/settings/delivery
router.get('/delivery', asyncHandler(settingsController.getDeliverySettings as any));
router.put('/delivery', authenticate, requireAdmin, asyncHandler(settingsController.updateDeliverySettings as any));

export default router;

