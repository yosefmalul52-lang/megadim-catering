"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContactController = void 0;
const contact_service_1 = require("../services/contact.service");
const errorHandler_1 = require("../middleware/errorHandler");
class ContactController {
    contactService;
    constructor() {
        this.contactService = new contact_service_1.ContactService();
    }
    submitContactForm = (0, errorHandler_1.asyncHandler)(async (req, res) => {
        const contactData = req.body;
        if (!contactData.name || !contactData.phone || !contactData.message) {
            throw (0, errorHandler_1.createValidationError)('Name, phone, and message are required');
        }
        const phoneRegex = /^0\d{1,2}-?\d{7}$|^0\d{9}$/;
        if (!phoneRegex.test(contactData.phone.replace(/\s/g, ''))) {
            throw (0, errorHandler_1.createValidationError)('Please provide a valid Israeli phone number');
        }
        if (contactData.email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(contactData.email)) {
                throw (0, errorHandler_1.createValidationError)('Please provide a valid email address');
            }
        }
        if (contactData.message.length < 10) {
            throw (0, errorHandler_1.createValidationError)('Message must be at least 10 characters long');
        }
        if (contactData.message.length > 1000) {
            throw (0, errorHandler_1.createValidationError)('Message must be less than 1000 characters');
        }
        const response = await this.contactService.submitContactForm({
            ...contactData,
            source: 'website'
        });
        res.status(200).json({
            success: true,
            data: response,
            message: 'Contact form submitted successfully',
            timestamp: new Date().toISOString()
        });
    });
    getAllContactRequests = (0, errorHandler_1.asyncHandler)(async (req, res) => {
        const { status, limit, offset } = req.query;
        const filters = {
            status: status,
            limit: limit ? parseInt(limit, 10) : 50,
            offset: offset ? parseInt(offset, 10) : 0
        };
        const { contacts, total } = await this.contactService.getAllContactRequests(filters);
        res.status(200).json({
            success: true,
            data: contacts,
            pagination: {
                total,
                limit: filters.limit,
                offset: filters.offset,
                hasMore: filters.offset + contacts.length < total
            },
            timestamp: new Date().toISOString()
        });
    });
    getContactRequestById = (0, errorHandler_1.asyncHandler)(async (req, res) => {
        const { id } = req.params;
        if (!id) {
            throw (0, errorHandler_1.createValidationError)('Contact request ID is required');
        }
        const contact = await this.contactService.getContactRequestById(id);
        if (!contact) {
            throw (0, errorHandler_1.createValidationError)('Contact request not found');
        }
        res.status(200).json({
            success: true,
            data: contact,
            timestamp: new Date().toISOString()
        });
    });
    updateContactStatus = (0, errorHandler_1.asyncHandler)(async (req, res) => {
        const { id } = req.params;
        const { status, notes } = req.body;
        if (!id) {
            throw (0, errorHandler_1.createValidationError)('Contact request ID is required');
        }
        if (!status) {
            throw (0, errorHandler_1.createValidationError)('Status is required');
        }
        const validStatuses = ['new', 'contacted', 'quoted', 'converted', 'closed'];
        if (!validStatuses.includes(status)) {
            throw (0, errorHandler_1.createValidationError)('Invalid status value');
        }
        const updatedContact = await this.contactService.updateContactStatus(id, { status, notes });
        if (!updatedContact) {
            throw (0, errorHandler_1.createValidationError)('Contact request not found');
        }
        res.status(200).json({
            success: true,
            data: updatedContact,
            message: 'Contact status updated successfully',
            timestamp: new Date().toISOString()
        });
    });
    getContactStatistics = (0, errorHandler_1.asyncHandler)(async (req, res) => {
        const stats = await this.contactService.getContactStatistics();
        res.status(200).json({
            success: true,
            data: stats,
            timestamp: new Date().toISOString()
        });
    });
    deleteContactRequest = (0, errorHandler_1.asyncHandler)(async (req, res) => {
        const { id } = req.params;
        if (!id) {
            throw (0, errorHandler_1.createValidationError)('Contact request ID is required');
        }
        const deleted = await this.contactService.deleteContactRequest(id);
        if (!deleted) {
            throw (0, errorHandler_1.createValidationError)('Contact request not found');
        }
        res.status(200).json({
            success: true,
            message: 'Contact request deleted successfully',
            timestamp: new Date().toISOString()
        });
    });
}
exports.ContactController = ContactController;
//# sourceMappingURL=contact.controller.js.map