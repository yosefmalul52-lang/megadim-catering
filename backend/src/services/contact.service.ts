import { v4 as uuidv4 } from 'uuid';
import { ContactRequest, ContactResponse, UpdateContactRequest } from '../models/contact.model';
import { emailService } from './email.service';

interface ContactFilters {
  status?: string;
  limit?: number;
  offset?: number;
}

export class ContactService {
  private contacts: ContactRequest[] = [];

  constructor() {
    // Initialize with some sample data for development
    this.initializeSampleData();
  }

  private initializeSampleData(): void {
    const sampleContacts: ContactRequest[] = [
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
  async submitContactForm(contactData: ContactRequest): Promise<ContactResponse> {
    const newContact: ContactRequest = {
      id: uuidv4(),
      ...contactData,
      status: 'new',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.contacts.unshift(newContact); // Add to beginning of array for newest first

    console.log(`📧 New contact form submitted by ${newContact.name} (${newContact.phone})`);

    // Notify business by email without failing the submission if SMTP errors.
    void emailService
      .sendContactFormToBusiness({
        name: newContact.name,
        phone: newContact.phone,
        email: newContact.email,
        message: newContact.message
      })
      .catch((emailErr: unknown) => {
        console.error('Contact form: email notification failed (contactId=%s):', newContact.id, emailErr);
      });

    return {
      success: true,
      message: 'הודעתך נשלחה בהצלחה, נחזור אליך בהקדם.',
      contactId: newContact.id
    };
  }

  // Get all contact requests with filtering and pagination
  async getAllContactRequests(filters: ContactFilters = {}): Promise<{
    contacts: ContactRequest[];
    total: number;
  }> {
    let filteredContacts = [...this.contacts];

    // Filter by status
    if (filters.status) {
      filteredContacts = filteredContacts.filter(contact => contact.status === filters.status);
    }

    const total = filteredContacts.length;

    // Sort by creation date (newest first)
    filteredContacts.sort((a, b) => 
      new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime()
    );

    // Apply pagination
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;
    const paginatedContacts = filteredContacts.slice(offset, offset + limit);

    return {
      contacts: paginatedContacts,
      total
    };
  }

  // Get contact request by ID
  async getContactRequestById(id: string): Promise<ContactRequest | null> {
    const contact = this.contacts.find(c => c.id === id);
    return contact || null;
  }

  // Update contact request status
  async updateContactStatus(id: string, updateData: UpdateContactRequest): Promise<ContactRequest | null> {
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

  // Delete contact request
  async deleteContactRequest(id: string): Promise<boolean> {
    const initialLength = this.contacts.length;
    this.contacts = this.contacts.filter(c => c.id !== id);
    
    if (this.contacts.length < initialLength) {
      console.log(`🗑️ Contact request ${id} deleted`);
      return true;
    }
    
    return false;
  }

  // Get contact statistics
  async getContactStatistics(): Promise<{
    total: number;
    byStatus: { [status: string]: number };
    bySource: { [source: string]: number };
    byEventType: { [eventType: string]: number };
    recentCount: number;
    conversionRate: number;
  }> {
    const total = this.contacts.length;
    
    const byStatus: { [status: string]: number } = {};
    const bySource: { [source: string]: number } = {};
    const byEventType: { [eventType: string]: number } = {};
    
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
    const recentCount = this.contacts.filter(contact => 
      contact.createdAt && new Date(contact.createdAt) > weekAgo
    ).length;

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
  }

  // Search contact requests
  async searchContacts(query: string): Promise<ContactRequest[]> {
    const searchTerm = query.toLowerCase();
    
    return this.contacts.filter(contact =>
      contact.name.toLowerCase().includes(searchTerm) ||
      contact.phone.includes(searchTerm) ||
      (contact.email && contact.email.toLowerCase().includes(searchTerm)) ||
      (contact.eventType && contact.eventType.toLowerCase().includes(searchTerm)) ||
      contact.message.toLowerCase().includes(searchTerm)
    );
  }
}
