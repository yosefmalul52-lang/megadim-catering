import { Request, Response } from 'express';
import { ContactService } from '../services/contact.service';
import { asyncHandler, createValidationError } from '../middleware/errorHandler';
import { ContactRequest } from '../models/contact.model';

export class ContactController {
  private contactService: ContactService;

  constructor() {
    this.contactService = new ContactService();
  }

  // Submit contact form
  submitContactForm = asyncHandler(async (req: Request, res: Response) => {
    const contactData: ContactRequest = req.body;

    // Basic validation
    if (!contactData.name || !contactData.phone || !contactData.message) {
      throw createValidationError('Name, phone, and message are required');
    }

    // Validate phone number format (basic Israeli phone validation)
    const phoneRegex = /^0\d{1,2}-?\d{7}$|^0\d{9}$/;
    if (!phoneRegex.test(contactData.phone.replace(/\s/g, ''))) {
      throw createValidationError('Please provide a valid Israeli phone number');
    }

    // Validate email if provided
    if (contactData.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(contactData.email)) {
        throw createValidationError('Please provide a valid email address');
      }
    }

    // Validate message length
    if (contactData.message.length < 10) {
      throw createValidationError('Message must be at least 10 characters long');
    }

    if (contactData.message.length > 1000) {
      throw createValidationError('Message must be less than 1000 characters');
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

  // Get all contact requests (Admin only)
  getAllContactRequests = asyncHandler(async (req: Request, res: Response) => {
    const { status, limit, offset } = req.query;
    
    const filters = {
      status: status as any,
      limit: limit ? parseInt(limit as string, 10) : 50,
      offset: offset ? parseInt(offset as string, 10) : 0
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

  // Get contact request by ID (Admin only)
  getContactRequestById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    if (!id) {
      throw createValidationError('Contact request ID is required');
    }

    const contact = await this.contactService.getContactRequestById(id);

    if (!contact) {
      throw createValidationError('Contact request not found');
    }

    res.status(200).json({
      success: true,
      data: contact,
      timestamp: new Date().toISOString()
    });
  });

  // Update contact request status (Admin only)
  updateContactStatus = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status, notes } = req.body;

    if (!id) {
      throw createValidationError('Contact request ID is required');
    }

    if (!status) {
      throw createValidationError('Status is required');
    }

    const validStatuses = ['new', 'contacted', 'quoted', 'converted', 'closed'];
    if (!validStatuses.includes(status)) {
      throw createValidationError('Invalid status value');
    }

    const updatedContact = await this.contactService.updateContactStatus(id, { status, notes });

    if (!updatedContact) {
      throw createValidationError('Contact request not found');
    }

    res.status(200).json({
      success: true,
      data: updatedContact,
      message: 'Contact status updated successfully',
      timestamp: new Date().toISOString()
    });
  });

  // Get contact statistics (Admin only)
  getContactStatistics = asyncHandler(async (req: Request, res: Response) => {
    const stats = await this.contactService.getContactStatistics();

    res.status(200).json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });
  });

  // Delete contact request (Admin only)
  deleteContactRequest = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    if (!id) {
      throw createValidationError('Contact request ID is required');
    }

    const deleted = await this.contactService.deleteContactRequest(id);

    if (!deleted) {
      throw createValidationError('Contact request not found');
    }

    res.status(200).json({
      success: true,
      message: 'Contact request deleted successfully',
      timestamp: new Date().toISOString()
    });
  });
}
