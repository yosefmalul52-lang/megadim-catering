import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import {
  getCurrentWeekStart,
  getDefaultMenuWeekStart,
  getDefaultReportsWeekStart,
  getNextWeekStartKey,
  getPreviousWeekStartKey,
  normalizeWeekInput,
  parseWeekStartKey,
  getWeekRangeString,
  getWeekRangeReportString
} from '../utils/portal-week';
import {
  MenuDayItems,
  MenuWeek,
  MENU_DAY_FORM_FIELDS
} from '../utils/menu-structure';

export { getCurrentWeekStart, getDefaultMenuWeekStart, getDefaultReportsWeekStart, getNextWeekStartKey, getPreviousWeekStartKey, normalizeWeekInput, getWeekRangeString, getWeekRangeReportString };
export { MENU_DAY_FORM_FIELDS, MenuDayItems, MenuWeek };

export interface PortalSettings {
  customMessage: string;
}

export interface InstitutionUser {
  id?: string;
  _id?: string;
  username: string;
  fullName: string;
  role: 'institution';
  phone?: string;
  isActive?: boolean;
  portalSettings?: PortalSettings;
  weekOrder?: {
    weekStartDate: string;
    hasOrder: boolean;
    weeklyTotalPortions: number;
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateInstitutionPayload {
  fullName: string;
  username: string;
  password: string;
  phone?: string;
  portalSettings?: Partial<PortalSettings>;
}

export interface UpdateInstitutionPayload {
  fullName?: string;
  username?: string;
  password?: string;
  phone?: string;
  isActive?: boolean;
  portalSettings?: Partial<PortalSettings>;
}

@Injectable({ providedIn: 'root' })
export class InstitutionAdminService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/admin/institutions`;

  list(weekStartDate?: string): Observable<InstitutionUser[]> {
    const week = weekStartDate ? normalizeWeekInput(weekStartDate) || weekStartDate : undefined;
    const params = week ? { weekStartDate: week } : undefined;
    return this.http
      .get<{ success: boolean; data: InstitutionUser[] }>(this.baseUrl, { params })
      .pipe(map((res) => res.data || []));
  }

  create(payload: CreateInstitutionPayload): Observable<InstitutionUser> {
    return this.http
      .post<{ success: boolean; data: InstitutionUser }>(this.baseUrl, payload)
      .pipe(map((res) => res.data));
  }

  update(id: string, payload: UpdateInstitutionPayload): Observable<InstitutionUser> {
    return this.http
      .put<{ success: boolean; data: InstitutionUser }>(`${this.baseUrl}/${id}`, payload)
      .pipe(map((res) => res.data));
  }

  delete(id: string): Observable<void> {
    return this.http
      .delete<{ success: boolean; message?: string }>(`${this.baseUrl}/${id}`)
      .pipe(map(() => undefined));
  }

  toggleActive(id: string, isActive: boolean): Observable<InstitutionUser> {
    return this.update(id, { isActive });
  }

  deleteWeekMenu(weekStartDate: string): Observable<void> {
    const week = normalizeWeekInput(weekStartDate);
    if (!week) throw new Error('תאריך שבוע לא תקין');
    return this.http
      .delete<{ success: boolean }>(`${this.baseUrl}/menu`, { params: { weekStartDate: week } })
      .pipe(map(() => undefined));
  }

  deleteInstitutionOrder(institutionId: string, weekStartDate: string): Observable<void> {
    const week = normalizeWeekInput(weekStartDate) || weekStartDate;
    return this.http
      .delete<{ success: boolean }>(`${this.baseUrl}/order/${institutionId}`, { params: { weekStartDate: week } })
      .pipe(map(() => undefined));
  }

  getWeekMenu(weekStartDate: string): Observable<InstitutionWeekMenu> {
    const week = normalizeWeekInput(weekStartDate) || weekStartDate;
    return this.http
      .get<{ success: boolean; data: InstitutionWeekMenu }>(`${this.baseUrl}/menu`, {
        params: { weekStartDate: week }
      })
      .pipe(map((res) => res.data));
  }

  saveWeekMenu(
    weekStartDate: string,
    payload: MenuWeek & { orderDeadline?: string | null }
  ): Observable<InstitutionWeekMenu> {
    const normalizedWeek = normalizeWeekInput(weekStartDate);
    if (!normalizedWeek) {
      throw new Error('תאריך שבוע לא תקין');
    }
    return this.http
      .post<{ success: boolean; data: InstitutionWeekMenu; message?: string }>(`${this.baseUrl}/menu`, {
        weekStartDate: normalizedWeek,
        ...payload
      })
      .pipe(map((res) => res.data));
  }

  getInstitutionOrder(institutionId: string, weekStartDate: string): Observable<AdminInstitutionOrder> {
    const week = normalizeWeekInput(weekStartDate) || weekStartDate;
    return this.http
      .get<{ success: boolean; data: AdminInstitutionOrder }>(`${this.baseUrl}/order/${institutionId}`, {
        params: { weekStartDate: week }
      })
      .pipe(map((res) => res.data));
  }

  updateInstitutionOrder(
    institutionId: string,
    weekStartDate: string,
    days: PackingOrderDay[]
  ): Observable<AdminInstitutionOrder> {
    const week = normalizeWeekInput(weekStartDate) || weekStartDate;
    return this.http
      .put<{ success: boolean; data: AdminInstitutionOrder; message?: string }>(
        `${this.baseUrl}/order/${institutionId}`,
        { weekStartDate: week, days }
      )
      .pipe(map((res) => res.data));
  }

  getWeekReports(weekStartDate: string): Observable<InstitutionWeekReports> {
    const week = normalizeWeekInput(weekStartDate) || weekStartDate;
    return this.http
      .get<{ success: boolean; data: InstitutionWeekReports }>(`${this.baseUrl}/reports`, {
        params: { weekStartDate: week }
      })
      .pipe(map((res) => res.data));
  }
}

export function institutionId(row: InstitutionUser): string {
  return String(row._id || row.id || '');
}

export interface InstitutionWeekMenu {
  weekStartDate: string;
  weekStartDateLabel: string;
  menuPublished?: boolean;
  orderDeadline?: string | null;
  menu: MenuWeek;
}

export interface KitchenReportRow {
  dayOfWeek: number;
  dayLabel: string;
  menuItem: string;
  totalRegular: number;
  totalVegetarian: number;
  grandTotal: number;
}

export interface PackingOrderDay {
  dayOfWeek: number;
  dayLabel: string;
  regularCount: number;
  vegetarianCount: number;
  notes: string;
  menuItems: MenuDayItems;
}

export interface PackingOrderRow {
  orderId?: string;
  institutionId: string;
  institutionName: string;
  weekStartDate: string;
  isLocked: boolean;
  weeklyGrandTotal: number;
  hasOrder: boolean;
  days: PackingOrderDay[];
}

export interface AdminInstitutionOrder {
  orderId: string | null;
  institutionId: string;
  institutionName: string;
  weekStartDate: string;
  days: PackingOrderDay[];
  weeklyGrandTotal: number;
}

export interface InstitutionWeekReports {
  weekStartDate: string;
  weekStartDateLabel: string;
  menuPublished?: boolean;
  orderDeadline?: string | null;
  menu: MenuWeek;
  orders: PackingOrderRow[];
  kitchenReport: KitchenReportRow[];
}

export function sumOrderDays(days: PackingOrderDay[]): number {
  return (days || []).reduce((sum, d) => sum + (Number(d.regularCount) || 0) + (Number(d.vegetarianCount) || 0), 0);
}
