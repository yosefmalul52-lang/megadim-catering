import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { CONTACT_PHONE_DISPLAY, CONTACT_TEL_HREF, CONTACT_WHATSAPP_HREF } from '../constants/contact.constants';
import type { UtmRecord } from './marketing.service';

export interface ContactRequest {
  name: string;
  phone: string;
  eventType?: string;
  message: string;
  email?: string;
  preferredContactTime?: string;
  /** Standard UTM fields captured client-side (e.g. from localStorage). */
  marketingData?: UtmRecord;
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
    const body: Record<string, unknown> = {
      name: request.name,
      phone: request.phone,
      email: request.email,
      message: request.message
    };
    const md = request.marketingData;
    if (md && Object.keys(md).length > 0) {
      body['marketingData'] = md;
    }
    return this.http
      .post<{ success: boolean; data: ContactResponse; message?: string }>(
        `${environment.apiUrl}/contact`,
        body
      )
      .pipe(
        map((res) => ({
          success: res.success,
          message: res.data?.message || res.message || 'הודעתך נשלחה בהצלחה, נחזור אליך בהקדם.',
          contactId: res.data?.contactId
        }))
      );
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
      email: 'Office@megadim-catering.com',
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
