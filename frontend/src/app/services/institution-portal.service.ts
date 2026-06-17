import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import {
  MenuDayItems,
  MenuWeek,
  MENU_CATEGORIES,
  MENU_DAY_FORM_FIELDS,
  emptyMenuDayItems,
  isMenuWeekPublished
} from '../utils/menu-structure';

export interface InstitutionPortalSettings {
  customMessage: string;
}

export interface InstitutionOrderDay {
  dayOfWeek: number;
  regularCount: number;
  vegetarianCount: number;
  notes: string;
}

export interface PortalStatus {
  institutionName: string;
  weekStartDate: string;
  currentWeekStartDate: string;
  nextWeekStartDate: string;
  isLocked: boolean;
  menuPublished: boolean;
  noMenuPublished: boolean;
  orderDeadline: string | null;
  portalSettings: InstitutionPortalSettings;
  menu: MenuWeek;
  order: {
    weekStartDate: string;
    isLocked: boolean;
    days: InstitutionOrderDay[];
  };
}

export const PORTAL_DAY_LABELS = MENU_DAY_FORM_FIELDS.map((d) => ({
  dayOfWeek: d.dayOfWeek,
  label: d.label,
  menuKey: d.key
}));

export { MENU_CATEGORIES, MenuDayItems, emptyMenuDayItems, isMenuWeekPublished };

export function formatOrderDeadlineNotice(orderDeadline: string | null | undefined): string {
  if (!orderDeadline) {
    return 'מועד סגירת הזמנות לשבוע זה טרם הוגדר על ידי המנהל';
  }
  const d = new Date(orderDeadline);
  if (Number.isNaN(d.getTime())) {
    return 'מועד סגירת הזמנות לשבוע זה טרם הוגדר על ידי המנהל';
  }
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `שימו לב: נעילת הזמנות לשבוע זה תתבצע בתאריך ${dd}.${mm} בשעה ${hh}:${min}`;
}

@Injectable({ providedIn: 'root' })
export class InstitutionPortalService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/portal`;

  getStatus(weekStartDate?: string): Observable<PortalStatus> {
    const params: Record<string, string> = {};
    if (weekStartDate) {
      params['weekStartDate'] = weekStartDate;
    }
    return this.http
      .get<{ success: boolean; data: PortalStatus }>(`${this.baseUrl}/status`, {
        withCredentials: true,
        params
      })
      .pipe(map((res) => res.data));
  }

  submit(days: InstitutionOrderDay[], weekStartDate: string): Observable<void> {
    return this.http
      .post<{ success: boolean; message?: string }>(
        `${this.baseUrl}/submit`,
        { weekStartDate, days },
        { withCredentials: true }
      )
      .pipe(map(() => undefined));
  }
}
