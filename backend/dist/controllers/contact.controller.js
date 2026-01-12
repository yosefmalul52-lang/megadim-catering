"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContactController = void 0;
const contact_service_1 = require("../services/contact.service");
const errorHandler_1 = require("../middleware/errorHandler");
class ContactController {
    constructor() {
        // Submit contact form
        this.submitContactForm = (0, errorHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const contactData = req.body;
            // Basic validation
            if (!contactData.name || !contactData.phone || !contactData.message) {
                throw (0, errorHandler_1.createValidationError)('Name, phone, and message are required');
            }
            // Validate phone number format (basic Israeli phone validation)
            const phoneRegex = /^0\d{1,2}-?\d{7}$|^0\d{9}$/;
            if (!phoneRegex.test(contactData.phone.replace(/\s/g, ''))) {
                throw (0, errorHandler_1.createValidationError)('Please provide a valid Israeli phone number');
            }
            // Validate email if provided
            if (contactData.email) {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(contactData.email)) {
                    throw (0, errorHandler_1.createValidationError)('Please provide a valid email address');
                }
            }
            // Validate message length
            if (contactData.message.length < 10) {
                throw (0, errorHandler_1.createValidationError)('Message must be at least 10 characters long');
            }
            if (contactData.message.length > 1000) {
                throw (0, errorHandler_1.createValidationError)('Message must be less than 1000 characters');
            }
            const response = yield this.contactService.submitContactForm(Object.assign(Object.assign({}, contactData), { source: 'website' }));
            res.status(200).json({
                success: true,
                data: response,
                message: 'Contact form submitted successfully',
                timestamp: new Date().toISOString()
            });
        }));
        // Get all contact requests (Admin only)
        this.getAllContactRequests = (0, errorHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const { status, limit, offset } = req.query;
            const filters = {
                status: status,
                limit: limit ? parseInt(limit, 10) : 50,
                offset: offset ? parseInt(offset, 10) : 0
            };
            const { contacts, total } = yield this.contactService.getAllContactRequests(filters);
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
        }));
        // Get contact request by ID (Admin only)
        this.getContactRequestById = (0, errorHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params;
            if (!id) {
                throw (0, errorHandler_1.createValidationError)('Contact request ID is required');
            }
            const contact = yield this.contactService.getContactRequestById(id);
            if (!contact) {
                throw (0, errorHandler_1.createValidationError)('Contact request not found');
            }
            res.status(200).json({
                success: true,
                data: contact,
                timestamp: new Date().toISOString()
            });
        }));
        // Update contact request status (Admin only)
        this.updateContactStatus = (0, errorHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
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
            const updatedContact = yield this.contactService.updateContactStatus(id, { status, notes });
            if (!updatedContact) {
                throw (0, errorHandler_1.createValidationError)('Contact request not found');
            }
            res.status(200).json({
                success: true,
                data: updatedContact,
                message: 'Contact status updated successfully',
                timestamp: new Date().toISOString()
            });
        }));
        // Get contact statistics (Admin only)
        this.getContactStatistics = (0, errorHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const stats = yield this.contactService.getContactStatistics();
            res.status(200).json({
                success: true,
                data: stats,
                timestamp: new Date().toISOString()
            });
        }));
        // Delete contact request (Admin only)
        this.deleteContactRequest = (0, errorHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params;
            if (!id) {
                throw (0, errorHandler_1.createValidationError)('Contact request ID is required');
            }
            const deleted = yield this.contactService.deleteContactRequest(id);
            if (!deleted) {
                throw (0, errorHandler_1.createValidationError)('Contact request not found');
            }
            res.status(200).json({
                success: true,
                message: 'Contact request deleted successfully',
                timestamp: new Date().toISOString()
            });
        }));
        this.contactService = new contact_service_1.ContactService();
    }
}
exports.ContactController = ContactController;
