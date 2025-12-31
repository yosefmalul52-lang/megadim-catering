export interface ContactRequest {
  id?: string;
  name: string;
  phone: string;
  email?: string;
  eventType?: string;
  message: string;
  preferredContactTime?: string;
  source?: string; // 'website', 'whatsapp', 'phone', etc.
  status?: 'new' | 'contacted' | 'quoted' | 'converted' | 'closed';
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ContactResponse {
  success: boolean;
  message: string;
  contactId?: string;
}

export interface UpdateContactRequest {
  status?: ContactRequest['status'];
  notes?: string;
}
