import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { environment } from '../../environments/environment';
import { CONTACT_PHONE_DISPLAY, CONTACT_TEL_HREF, CONTACT_WHATSAPP_HREF } from '../constants/contact.constants';

export interface ContactRequest {
  name: string;
  phone: string;
  eventType?: string;
  message: string;
  email?: string;
  preferredContactTime?: string;
}

export interface ContactResponse {
  success: boolean;
  message: string;
  contactId?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ContactService {
  private http = inject(HttpClient);

  submitContactForm(request: ContactRequest): Observable<ContactResponse> {
    // In production, this would call the backend API
    // return this.http.post<ContactResponse>(`${environment.apiUrl}/contact`, request);
    
    // Mock response for development
    console.log('Contact form submitted:', request);
    
    return of({
      success: true,
      message: 'תודה על פנייתך! נחזור אליך בהקדם.',
      contactId: `CONTACT_${Date.now()}`
    });
  }

  // Method for quick WhatsApp contact
  openWhatsApp(message?: string): void {
    const defaultMessage = 'שלום, אני מעוניין/ת לקבל מידע על שירותי הקייטרינג שלכם';
    const whatsappMessage = message || defaultMessage;
    const whatsappUrl = `${CONTACT_WHATSAPP_HREF}?text=${encodeURIComponent(whatsappMessage)}`;
    window.open(whatsappUrl, '_blank');
  }

  // Method for direct phone call
  makePhoneCall(): void {
    window.location.href = CONTACT_TEL_HREF;
  }

  // Method to get business contact information
  getContactInfo(): {
    phone: string;
    whatsapp: string;
    email: string;
    address: string;
    businessHours: string;
    serviceAreas: string[];
  } {
    return {
      phone: CONTACT_PHONE_DISPLAY,
      whatsapp: CONTACT_WHATSAPP_HREF,
      email: 'info@megadim-catering.com',
      address: 'ישראל', // Replace with actual address
      businessHours: 'ראשון-חמישי: 8:00-20:00, יום שישי: 8:00-14:00',
      serviceAreas: [
        'תל אביב והמרכז',
        'ירושלים והסביבה',
        'חיפה והצפון',
        'באר שבע והדרום'
      ]
    };
  }
}
