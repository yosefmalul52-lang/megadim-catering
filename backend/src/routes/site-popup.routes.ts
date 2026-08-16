import express from 'express';
import * as sitePopupController from '../controllers/site-popup.controller';

const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { requireAdmin } = require('../config/role-access');

/** Public — active popups for current page */
router.get('/active', sitePopupController.getActivePopups);

/** Admin */
router.get('/', authenticate, requireAdmin, sitePopupController.listPopups);
router.post('/migrate-from-settings', authenticate, requireAdmin, sitePopupController.migrateFromSettings);
router.get('/:id', authenticate, requireAdmin, sitePopupController.getPopup);
router.post('/', authenticate, requireAdmin, sitePopupController.createPopup);
router.put('/:id', authenticate, requireAdmin, sitePopupController.updatePopup);
router.delete('/:id', authenticate, requireAdmin, sitePopupController.deletePopup);

export default router;
