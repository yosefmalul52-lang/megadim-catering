import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { tap, catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface PageAnnouncement {
  bannerText?: string;
  popupTitle?: string;
  popupText?: string;
  popupLinkText?: string;
  popupLinkUrl?: string;
}

export type PageId = 'home' | 'events' | 'holiday' | 'cholent' | 'salads' | 'fish' | 'desserts';

export const PAGE_IDS: PageId[] = ['home', 'events', 'holiday', 'cholent', 'salads', 'fish', 'desserts'];

function defaultPageAnnouncements(): Record<string, PageAnnouncement> {
  const out: Record<string, PageAnnouncement> = {};
  for (const id of PAGE_IDS) {
    out[id] = { bannerText: '', popupTitle: '', popupText: '', popupLinkText: '', popupLinkUrl: '' };
  }
  return out;
}

function normalizePageAnnouncements(pa: Record<string, PageAnnouncement> | null | undefined): Record<string, PageAnnouncement> {
  const out = defaultPageAnnouncements();
  if (pa && typeof pa === 'object') {
    for (const id of PAGE_IDS) {
      if (pa[id] && typeof pa[id] === 'object') {
        out[id] = {
          bannerText: typeof pa[id].bannerText === 'string' ? pa[id].bannerText! : '',
          popupTitle: typeof pa[id].popupTitle === 'string' ? pa[id].popupTitle! : '',
          popupText: typeof pa[id].popupText === 'string' ? pa[id].popupText! : '',
          popupLinkText: typeof pa[id].popupLinkText === 'string' ? pa[id].popupLinkText! : '',
          popupLinkUrl: typeof pa[id].popupLinkUrl === 'string' ? pa[id].popupLinkUrl! : ''
        };
      }
    }
  }
  return out;
}

export interface SiteSettings {
  shabbatMenuUrl: string;
  eventsMenuUrl: string;
  contactPhone?: string;
  orderEmail?: string;
  whatsappLink?: string;
  cholentForceOpen?: boolean;
  cholentCustomMessage?: string;
  cholentClosedMessage?: string;
  pageAnnouncements?: Record<string, PageAnnouncement>;
}

export interface SiteSettingsResponse {
  success: boolean;
  data: SiteSettings;
  timestamp?: string;
}

@Injectable({
  providedIn: 'root'
})
export class SiteSettingsService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/settings`;

  private settingsSubject = new BehaviorSubject<SiteSettings | null>(null);
  public settings$ = this.settingsSubject.asObservable();

  private isLoadingSubject = new BehaviorSubject<boolean>(false);
  public isLoading$ = this.isLoadingSubject.asObservable();

  /** Get page announcement for a given page id (always returns an object with bannerText, popupTitle, popupText). */
  getPageAnnouncement(settings: SiteSettings | null, pageId: PageId): PageAnnouncement {
    const pa = settings?.pageAnnouncements ? normalizePageAnnouncements(settings.pageAnnouncements) : defaultPageAnnouncements();
    return pa[pageId] || { bannerText: '', popupTitle: '', popupText: '', popupLinkText: '', popupLinkUrl: '' };
  }

  getSettings(forceRefresh = false): Observable<SiteSettings> {
    if (!forceRefresh) {
      const cached = this.settingsSubject.value;
      if (cached) return of(cached);
    } else {
      this.settingsSubject.next(null);
    }

    this.isLoadingSubject.next(true);
    return this.http.get<any>(this.apiUrl).pipe(
      map(response => {
        if (!response) {
          return {
            shabbatMenuUrl: '',
            eventsMenuUrl: '',
            contactPhone: '',
            orderEmail: '',
            whatsappLink: '',
            cholentForceOpen: false,
            cholentClosedMessage: 'ההזמנות נפתחות ביום חמישי בין השעות 09:00 ל-17:00',
            cholentCustomMessage: '',
            pageAnnouncements: defaultPageAnnouncements()
          };
        }
        let settings: SiteSettings | null = null;
        if (typeof response === 'object') {
          if ('data' in response && response.data != null) {
            settings = response.data as SiteSettings;
          } else if ('shabbatMenuUrl' in response || 'eventsMenuUrl' in response) {
            settings = response as SiteSettings;
          }
        }
        if (!settings) {
          settings = {
            shabbatMenuUrl: '',
            eventsMenuUrl: '',
            contactPhone: '',
            orderEmail: '',
            whatsappLink: '',
            cholentForceOpen: false,
            cholentClosedMessage: 'ההזמנות נפתחות ביום חמישי בין השעות 09:00 ל-17:00',
            cholentCustomMessage: '',
            pageAnnouncements: defaultPageAnnouncements()
          };
        }
        return {
          shabbatMenuUrl: settings.shabbatMenuUrl || '',
          eventsMenuUrl: settings.eventsMenuUrl || '',
          contactPhone: settings.contactPhone || '',
          orderEmail: settings.orderEmail || '',
          whatsappLink: settings.whatsappLink || '',
          cholentForceOpen: !!settings.cholentForceOpen,
          cholentCustomMessage: settings.cholentCustomMessage || '',
          cholentClosedMessage: settings.cholentClosedMessage || 'ההזמנות נפתחות ביום חמישי בין השעות 09:00 ל-17:00',
          pageAnnouncements: normalizePageAnnouncements(settings.pageAnnouncements)
        };
      }),
      tap(settings => {
        this.settingsSubject.next(settings);
        this.isLoadingSubject.next(false);
      }),
      catchError((err) => {
        this.isLoadingSubject.next(false);
        console.warn(
          'Backend /api/settings unavailable (e.g. 404 or network error). Using default fallback settings.',
          err?.status ?? err?.message ?? err
        );
        const defaultSettings: SiteSettings = {
          shabbatMenuUrl: '',
          eventsMenuUrl: '',
          contactPhone: '073-367-8399',
          orderEmail: '',
          whatsappLink: '',
          cholentForceOpen: false,
          cholentCustomMessage: '',
          cholentClosedMessage: 'ההזמנות נפתחות ביום חמישי בין השעות 09:00 ל-17:00',
          pageAnnouncements: defaultPageAnnouncements()
        };
        this.settingsSubject.next(defaultSettings);
        return of(defaultSettings);
      })
    );
  }

  updateSettings(settings: Partial<SiteSettings>): Observable<SiteSettings> {
    this.isLoadingSubject.next(true);
    return this.http.put<any>(this.apiUrl, settings).pipe(
      map(response => {
        if (!response) {
          return {
            shabbatMenuUrl: settings.shabbatMenuUrl || '',
            eventsMenuUrl: settings.eventsMenuUrl || '',
            contactPhone: settings.contactPhone || '',
            orderEmail: settings.orderEmail || '',
            whatsappLink: settings.whatsappLink || '',
            cholentForceOpen: !!settings.cholentForceOpen,
            cholentCustomMessage: settings.cholentCustomMessage || '',
            cholentClosedMessage: settings.cholentClosedMessage || 'ההזמנות נפתחות ביום חמישי בין השעות 09:00 ל-17:00',
            pageAnnouncements: normalizePageAnnouncements(settings.pageAnnouncements)
          } as SiteSettings;
        }
        let updated: SiteSettings | null = null;
        if (typeof response === 'object') {
          if ('data' in response && response.data != null) updated = response.data as SiteSettings;
          else if ('shabbatMenuUrl' in response || 'eventsMenuUrl' in response) updated = response as SiteSettings;
        }
        if (!updated) {
          updated = {
            shabbatMenuUrl: settings.shabbatMenuUrl || '',
            eventsMenuUrl: settings.eventsMenuUrl || '',
            contactPhone: settings.contactPhone || '',
            orderEmail: settings.orderEmail || '',
            whatsappLink: settings.whatsappLink || '',
            cholentForceOpen: !!settings.cholentForceOpen,
            cholentCustomMessage: settings.cholentCustomMessage || '',
            cholentClosedMessage: settings.cholentClosedMessage || 'ההזמנות נפתחות ביום חמישי בין השעות 09:00 ל-17:00',
            pageAnnouncements: normalizePageAnnouncements(settings.pageAnnouncements)
          } as SiteSettings;
        }
        return {
          shabbatMenuUrl: updated.shabbatMenuUrl || '',
          eventsMenuUrl: updated.eventsMenuUrl || '',
          contactPhone: updated.contactPhone || '',
          orderEmail: updated.orderEmail || '',
          whatsappLink: updated.whatsappLink || '',
          cholentForceOpen: !!updated.cholentForceOpen,
          cholentCustomMessage: updated.cholentCustomMessage || '',
          cholentClosedMessage: updated.cholentClosedMessage || 'ההזמנות נפתחות ביום חמישי בין השעות 09:00 ל-17:00',
          pageAnnouncements: normalizePageAnnouncements(updated.pageAnnouncements)
        };
      }),
      tap(s => {
        this.settingsSubject.next(s);
        this.isLoadingSubject.next(false);
      }),
      catchError(err => {
        this.isLoadingSubject.next(false);
        throw err;
      })
    );
  }

  clearCache(): void {
    this.settingsSubject.next(null);
  }

  getCurrentSettings(): SiteSettings | null {
    return this.settingsSubject.value;
  }
}
