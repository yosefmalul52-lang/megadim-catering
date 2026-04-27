import { Router } from 'express';
import { ContactController } from '../controllers/contact.controller';

const router = Router();
const contactController = new ContactController();
const { authenticate } = require('../middleware/auth');
const { requireAdmin } = require('../config/role-access');

// Public routes
router.post('/', contactController.submitContactForm);

// Admin routes
router.get('/', authenticate, requireAdmin, contactController.getAllContactRequests);
router.get('/analytics/source', authenticate, requireAdmin, contactController.getLeadsBySource);
router.get('/stats', authenticate, requireAdmin, contactController.getContactStatistics);
router.get('/:id', authenticate, requireAdmin, contactController.getContactRequestById);
router.patch('/:id/status', authenticate, requireAdmin, contactController.updateContactStatus);
router.delete('/:id', authenticate, requireAdmin, contactController.deleteContactRequest);

export default router;
