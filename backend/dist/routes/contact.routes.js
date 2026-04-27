"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const contact_controller_1 = require("../controllers/contact.controller");
const router = (0, express_1.Router)();
const contactController = new contact_controller_1.ContactController();
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
exports.default = router;
