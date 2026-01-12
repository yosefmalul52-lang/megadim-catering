"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContactService = void 0;
const uuid_1 = require("uuid");
class ContactService {
    contacts = [];
    constructor() {
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
    async submitContactForm(contactData) {
        const newContact = {
            id: (0, uuid_1.v4)(),
            ...contactData,
            status: 'new',
            createdAt: new Date(),
            updatedAt: new Date()
        };
        this.contacts.unshift(newContact);
        console.log(`📧 New contact form submitted by ${newContact.name} (${newContact.phone})`);
        console.log(`Event type: ${newContact.eventType || 'Not specified'}`);
        console.log(`Message: ${newContact.message.substring(0, 100)}...`);
        return {
            success: true,
            message: 'תודה על פנייתך! נחזור אליך בהקדם.',
            contactId: newContact.id
        };
    }
    async getAllContactRequests(filters = {}) {
        let filteredContacts = [...this.contacts];
        if (filters.status) {
            filteredContacts = filteredContacts.filter(contact => contact.status === filters.status);
        }
        const total = filteredContacts.length;
        filteredContacts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        const limit = filters.limit || 50;
        const offset = filters.offset || 0;
        const paginatedContacts = filteredContacts.slice(offset, offset + limit);
        return {
            contacts: paginatedContacts,
            total
        };
    }
    async getContactRequestById(id) {
        const contact = this.contacts.find(c => c.id === id);
        return contact || null;
    }
    async updateContactStatus(id, updateData) {
        const contactIndex = this.contacts.findIndex(c => c.id === id);
        if (contactIndex === -1) {
            return null;
        }
        this.contacts[contactIndex] = {
            ...this.contacts[contactIndex],
            ...updateData,
            updatedAt: new Date()
        };
        console.log(`📝 Contact ${id} status updated to ${updateData.status}`);
        return this.contacts[contactIndex];
    }
    async deleteContactRequest(id) {
        const initialLength = this.contacts.length;
        this.contacts = this.contacts.filter(c => c.id !== id);
        if (this.contacts.length < initialLength) {
            console.log(`🗑️ Contact request ${id} deleted`);
            return true;
        }
        return false;
    }
    async getContactStatistics() {
        const total = this.contacts.length;
        const byStatus = {};
        const bySource = {};
        const byEventType = {};
        this.contacts.forEach(contact => {
            byStatus[contact.status || 'unknown'] = (byStatus[contact.status || 'unknown'] || 0) + 1;
            bySource[contact.source || 'unknown'] = (bySource[contact.source || 'unknown'] || 0) + 1;
            if (contact.eventType) {
                byEventType[contact.eventType] = (byEventType[contact.eventType] || 0) + 1;
            }
        });
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const recentCount = this.contacts.filter(contact => contact.createdAt && new Date(contact.createdAt) > weekAgo).length;
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
    }
    async searchContacts(query) {
        const searchTerm = query.toLowerCase();
        return this.contacts.filter(contact => contact.name.toLowerCase().includes(searchTerm) ||
            contact.phone.includes(searchTerm) ||
            (contact.email && contact.email.toLowerCase().includes(searchTerm)) ||
            (contact.eventType && contact.eventType.toLowerCase().includes(searchTerm)) ||
            contact.message.toLowerCase().includes(searchTerm));
    }
}
exports.ContactService = ContactService;
//# sourceMappingURL=contact.service.js.map