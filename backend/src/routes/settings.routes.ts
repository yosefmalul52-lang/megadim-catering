import { Router } from 'express';
import { SettingsController } from '../controllers/settings.controller';
// TODO: Import and use authentication middleware for admin routes
// import { authenticateToken } from '../middleware/auth';

const router = Router();
const settingsController = new SettingsController();

// Public route - Get settings
router.get('/', settingsController.getSettings);

// Admin route - Update settings (should be protected by authentication middleware)
// TODO: Add authentication middleware: router.put('/', authenticateToken, settingsController.updateSettings);
router.put('/', settingsController.updateSettings);

export default router;

