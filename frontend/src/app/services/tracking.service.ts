import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export type TrackingEvent =
  | 'whatsapp_click'
  | 'phone_click'
  | 'generate_lead'
  | 'contact_form_submit'
  | 'catering_form_submit';

export interface TrackingPayload {
  event: TrackingEvent | string;
  event_category?: string;
  event_label?: string;
  page_path?: string;
  cta_location?: string;
  form_name?: string;
  value?: number;
}

@Injectable({ providedIn: 'root' })
export class TrackingService {
  private readonly platformId = inject(PLATFORM_ID);

  /** Push intent to dataLayer (GTM) and Meta Pixel. Browser-only. */
  trackIntent(payload: TrackingPayload): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const pagePath =
      payload.page_path ??
      (typeof window !== 'undefined' ? window.location.pathname : '');

    const dlEvent: Record<string, unknown> = {
      event: payload.event,
      event_category: payload.event_category ?? 'engagement',
      event_label: payload.event_label,
      page_path: pagePath,
      cta_location: payload.cta_location,
      form_name: payload.form_name,
    };

    window.dataLayer = window.dataLayer ?? [];
    window.dataLayer.push(dlEvent);

    if (typeof window.fbq !== 'function') {
      return;
    }

    if (payload.event === 'whatsapp_click') {
      window.fbq('trackCustom', 'WhatsAppClick', {
        cta_location: payload.cta_location,
        event_label: payload.event_label,
        page_path: pagePath,
      });
      window.fbq('track', 'Lead', {
        content_name: 'whatsapp_click',
        cta_location: payload.cta_location,
        page_path: pagePath,
      });
      return;
    }

    if (
      payload.event === 'generate_lead' ||
      payload.event === 'contact_form_submit' ||
      payload.event === 'catering_form_submit'
    ) {
      window.fbq('track', 'Lead', {
        content_name: payload.form_name ?? payload.event,
        page_path: pagePath,
      });
    }
  }

  trackWhatsAppClick(ctaLocation: string, label?: string): void {
    this.trackIntent({
      event: 'whatsapp_click',
      event_category: 'contact',
      event_label: label ?? 'WhatsApp',
      cta_location: ctaLocation,
    });
  }

  trackFormSubmit(formName: string): void {
    const normalized = formName.trim().toLowerCase();
    const event: TrackingEvent =
      normalized === 'contact'
        ? 'contact_form_submit'
        : normalized === 'catering'
          ? 'catering_form_submit'
          : 'generate_lead';

    this.trackIntent({
      event,
      event_category: 'lead',
      event_label: formName,
      form_name: formName,
    });

    if (event !== 'generate_lead') {
      this.trackIntent({
        event: 'generate_lead',
        event_category: 'lead',
        event_label: formName,
        form_name: formName,
      });
    }
  }
}
