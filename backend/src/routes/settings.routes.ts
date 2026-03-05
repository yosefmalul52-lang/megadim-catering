import { Router } from 'express';
import { SettingsController } from '../controllers/settings.controller';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();
const { authenticate, authorize } = require('../middleware/auth');
const settingsController = new SettingsController();

// Public – site settings (contact, menus, announcements)
router.get('/', settingsController.getSettings);
router.put('/', authenticate, authorize('admin'), asyncHandler(settingsController.updateSettings as any));

// Public – global store settings (freeShippingThreshold, baseDeliveryFee, pricePerKm) for shipping dashboard
router.get('/store', settingsController.getStoreSettings);
router.put('/store', authenticate, authorize('admin'), asyncHandler(settingsController.updateStoreSettings as any));

// Public – delivery / free-shipping store settings (allowed days, minimum lead, etc.)
router.get('/delivery', settingsController.getDeliverySettings);
router.put('/delivery', authenticate, authorize('admin'), asyncHandler(settingsController.updateDeliverySettings as any));

export default router;

