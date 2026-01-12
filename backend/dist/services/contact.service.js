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
exports.ContactService = void 0;
const uuid_1 = require("uuid");
class ContactService {
    constructor() {
        this.contacts = [];
        // Initialize with some sample data for development
        this.initializeSampleData();
    }
    initializeSampleData() {
        const sampleContacts = [
            {
                id: '1',
                name: 'יוסי כהן',
                phone: '052-123-4567',
                email: 'yossi@example.com',
                eventType: 'בר מצווה',
                message: 'שלום, אני מעוניין בקייטרינג לבר מצווה ל-80 איש. תאריך האירוע: 15/03/2024',
                source: 'website',
                status: 'new',
                createdAt: new Date('2024-01-15T10:30:00'),
                updatedAt: new Date('2024-01-15T10:30:00')
            },
            {
                id: '2',
                name: 'שרה לוי',
                phone: '054-987-6543',
                email: 'sarah@example.com',
                eventType: 'חתונה',
                message: 'מעוניינת בהצעת מחיר לחתונה ל-150 אורחים',
                source: 'website',
                status: 'contacted',
                createdAt: new Date('2024-01-14T14:20:00'),
                updatedAt: new Date('2024-01-14T16:45:00')
            },
            {
                id: '3',
                name: 'דוד מזרחי',
                phone: '03-555-1234',
                eventType: 'ברית מילה',
                message: 'צריך קייטרינג לברית מילה ל-40 איש, בתאריך 20/02/2024',
                source: 'phone',
                status: 'quoted',
                createdAt: new Date('2024-01-13T09:15:00'),
                updatedAt: new Date('2024-01-13T11:30:00')
            }
        ];
        this.contacts = sampleContacts;
        console.log(`✅ Initialized with ${this.contacts.length} sample contact requests`);
    }
    // Submit new contact form
    submitContactForm(contactData) {
        return __awaiter(this, void 0, void 0, function* () {
            const newContact = Object.assign(Object.assign({ id: (0, uuid_1.v4)() }, contactData), { status: 'new', createdAt: new Date(), updatedAt: new Date() });
            this.contacts.unshift(newContact); // Add to beginning of array for newest first
            console.log(`📧 New contact form submitted by ${newContact.name} (${newContact.phone})`);
            console.log(`Event type: ${newContact.eventType || 'Not specified'}`);
            console.log(`Message: ${newContact.message.substring(0, 100)}...`);
            // In a real application, this would:
            // 1. Save to database
            // 2. Send email notification to admin
            // 3. Send auto-reply to customer
            // 4. Add to CRM system
            return {
                success: true,
                message: 'תודה על פנייתך! נחזור אליך בהקדם.',
                contactId: newContact.id
            };
        });
    }
    // Get all contact requests with filtering and pagination
    getAllContactRequests() {
        return __awaiter(this, arguments, void 0, function* (filters = {}) {
            let filteredContacts = [...this.contacts];
            // Filter by status
            if (filters.status) {
                filteredContacts = filteredContacts.filter(contact => contact.status === filters.status);
            }
            const total = filteredContacts.length;
            // Sort by creation date (newest first)
            filteredContacts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            // Apply pagination
            const limit = filters.limit || 50;
            const offset = filters.offset || 0;
            const paginatedContacts = filteredContacts.slice(offset, offset + limit);
            return {
                contacts: paginatedContacts,
                total
            };
        });
    }
    // Get contact request by ID
    getContactRequestById(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const contact = this.contacts.find(c => c.id === id);
            return contact || null;
        });
    }
    // Update contact request status
    updateContactStatus(id, updateData) {
        return __awaiter(this, void 0, void 0, function* () {
            const contactIndex = this.contacts.findIndex(c => c.id === id);
            if (contactIndex === -1) {
                return null;
            }
            this.contacts[contactIndex] = Object.assign(Object.assign(Object.assign({}, this.contacts[contactIndex]), updateData), { updatedAt: new Date() });
            console.log(`📝 Contact ${id} status updated to ${updateData.status}`);
            return this.contacts[contactIndex];
        });
    }
    // Delete contact request
    deleteContactRequest(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const initialLength = this.contacts.length;
            this.contacts = this.contacts.filter(c => c.id !== id);
            if (this.contacts.length < initialLength) {
                console.log(`🗑️ Contact request ${id} deleted`);
                return true;
            }
            return false;
        });
    }
    // Get contact statistics
    getContactStatistics() {
        return __awaiter(this, void 0, void 0, function* () {
            const total = this.contacts.length;
            const byStatus = {};
            const bySource = {};
            const byEventType = {};
            this.contacts.forEach(contact => {
                // Count by status
                byStatus[contact.status || 'unknown'] = (byStatus[contact.status || 'unknown'] || 0) + 1;
                // Count by source
                bySource[contact.source || 'unknown'] = (bySource[contact.source || 'unknown'] || 0) + 1;
                // Count by event type
                if (contact.eventType) {
                    byEventType[contact.eventType] = (byEventType[contact.eventType] || 0) + 1;
                }
            });
            // Count recent contacts (last 7 days)
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            const recentCount = this.contacts.filter(contact => contact.createdAt && new Date(contact.createdAt) > weekAgo).length;
            // Calculate conversion rate (quoted or converted / total)
            const convertedCount = (byStatus['quoted'] || 0) + (byStatus['converted'] || 0);
            const conversionRate = total > 0 ? (convertedCount / total) * 100 : 0;
            return {
                total,
                byStatus,
                bySource,
                byEventType,
                recentCount,
                conversionRate: Math.round(conversionRate * 100) / 100
            };
        });
    }
    // Search contact requests
    searchContacts(query) {
        return __awaiter(this, void 0, void 0, function* () {
            const searchTerm = query.toLowerCase();
            return this.contacts.filter(contact => contact.name.toLowerCase().includes(searchTerm) ||
                contact.phone.includes(searchTerm) ||
                (contact.email && contact.email.toLowerCase().includes(searchTerm)) ||
                (contact.eventType && contact.eventType.toLowerCase().includes(searchTerm)) ||
                contact.message.toLowerCase().includes(searchTerm));
        });
    }
}
exports.ContactService = ContactService;
