"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const contact_controller_1 = require("../controllers/contact.controller");
const router = (0, express_1.Router)();
const contactController = new contact_controller_1.ContactController();
// Public routes
router.post('/', contactController.submitContactForm);
// Admin routes (in production, these would be protected by authentication middleware)
// TODO: Add authentication middleware for admin routes
router.get('/', contactController.getAllContactRequests);
router.get('/stats', contactController.getContactStatistics);
router.get('/:id', contactController.getContactRequestById);
router.patch('/:id/status', contactController.updateContactStatus);
router.delete('/:id', contactController.deleteContactRequest);
exports.default = router;
