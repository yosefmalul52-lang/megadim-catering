import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';

export type PopupTemplate = 'info' | 'promo' | 'ops' | 'urgent';
export type PopupPlacement = 'modal' | 'banner_top' | 'sticky_bottom';
export type PopupStatus = 'draft' | 'active' | 'disabled';
export type PopupFrequency = 'every' | 'session' | 'once' | 'max';

export type PopupPageId =
  | 'home'
  | 'events'
  | 'holiday'
  | 'cholent'
  | 'ready_for_shabbat'
  | 'salads'
  | 'fish'
  | 'desserts'
  | 'contact'
  | 'cart'
  | 'checkout'
  | 'about'
  | 'kosher';

export interface PopupLocaleContent {
  title?: string;
  body?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  imageUrl?: string;
}

export interface SitePopup {
  _id?: string;
  internalName: string;
  status: PopupStatus;
  template: PopupTemplate;
  placement: PopupPlacement;
  pageTargets: PopupPageId[];
  targetAllPages: boolean;
  priority: number;
  startAt?: string | null;
  endAt?: string | null;
  frequency: PopupFrequency;
  maxViews?: number | null;
  content: {
    he: PopupLocaleContent;
    en: PopupLocaleContent;
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface ActivePopupDto {
  id: string;
  template: PopupTemplate;
  placement: PopupPlacement;
  priority: number;
  frequency: PopupFrequency;
  maxViews: number | null;
  title: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
  imageUrl: string;
}

export interface ActivePopupsResponse {
  modal: ActivePopupDto | null;
  banner_top: ActivePopupDto | null;
  sticky_bottom: ActivePopupDto | null;
}

export const POPUP_PAGE_OPTIONS: Array<{ id: PopupPageId; label: string }> = [
  { id: 'home', label: 'דף הבית' },
  { id: 'events', label: 'קייטרינג לאירועים' },
  { id: 'holiday', label: 'שבת וחג' },
  { id: 'cholent', label: "צ'ולנט בר" },
  { id: 'ready_for_shabbat', label: 'מוכן לשבת' },
  { id: 'salads', label: 'סלטים' },
  { id: 'fish', label: 'דגים' },
  { id: 'desserts', label: 'קינוחים' },
  { id: 'contact', label: 'צור קשר' },
  { id: 'cart', label: 'סל קניות' },
  { id: 'checkout', label: 'קופה' },
  { id: 'about', label: 'אודות' },
  { id: 'kosher', label: 'כשרות' }
];

@Injectable({ providedIn: 'root' })
export class SitePopupService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/popups`;

  list(): Observable<SitePopup[]> {
    return this.http
      .get<{ success: boolean; data: SitePopup[] }>(this.apiUrl)
      .pipe(map((r) => r.data || []));
  }

  get(id: string): Observable<SitePopup> {
    return this.http
      .get<{ success: boolean; data: SitePopup }>(`${this.apiUrl}/${id}`)
      .pipe(map((r) => r.data));
  }

  create(body: SitePopup): Observable<SitePopup> {
    return this.http
      .post<{ success: boolean; data: SitePopup }>(this.apiUrl, body)
      .pipe(map((r) => r.data));
  }

  update(id: string, body: SitePopup): Observable<SitePopup> {
    return this.http
      .put<{ success: boolean; data: SitePopup }>(`${this.apiUrl}/${id}`, body)
      .pipe(map((r) => r.data));
  }

  delete(id: string): Observable<void> {
    return this.http.delete<unknown>(`${this.apiUrl}/${id}`).pipe(map(() => undefined));
  }

  migrateFromSettings(): Observable<{ created: number }> {
    return this.http
      .post<{ success: boolean; created: number }>(`${this.apiUrl}/migrate-from-settings`, {})
      .pipe(map((r) => ({ created: r.created || 0 })));
  }

  getActive(page: string, locale: 'he' | 'en'): Observable<ActivePopupsResponse> {
    const params = new HttpParams().set('page', page).set('locale', locale);
    return this.http
      .get<{ success: boolean; data: ActivePopupsResponse }>(`${this.apiUrl}/active`, { params })
      .pipe(
        map(
          (r) =>
            r.data || {
              modal: null,
              banner_top: null,
              sticky_bottom: null
            }
        )
      );
  }
}
