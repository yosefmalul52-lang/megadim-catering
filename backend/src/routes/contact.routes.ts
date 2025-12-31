import { Router } from 'express';
import { ContactController } from '../controllers/contact.controller';

const router = Router();
const contactController = new ContactController();

// Public routes
router.post('/', contactController.submitContactForm);

// Admin routes (in production, these would be protected by authentication middleware)
// TODO: Add authentication middleware for admin routes
router.get('/', contactController.getAllContactRequests);
router.get('/stats', contactController.getContactStatistics);
router.get('/:id', contactController.getContactRequestById);
router.patch('/:id/status', contactController.updateContactStatus);
router.delete('/:id', contactController.deleteContactRequest);

export default router;
