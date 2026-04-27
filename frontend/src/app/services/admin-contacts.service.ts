import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export type AdminContactStatus = 'new' | 'read' | 'handled';

export interface AdminContact {
  id: string;
  name: string;
  email: string;
  phone: string;
  message: string;
  status: AdminContactStatus;
  source?: string;
  notes?: string;
  marketingData?: {
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
    utm_term?: string;
    utm_content?: string;
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface AdminContactsPagination {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface AdminContactsResponse {
  contacts: AdminContact[];
  pagination: AdminContactsPagination;
}

export interface LeadsBySourcePoint {
  source: string;
  leadsCount: number;
}

@Injectable({
  providedIn: 'root'
})
export class AdminContactsService {
  private http = inject(HttpClient);

  getContacts(params?: {
    status?: AdminContactStatus | 'all';
    limit?: number;
    offset?: number;
  }): Observable<AdminContactsResponse> {
    let httpParams = new HttpParams();
    if (params?.status && params.status !== 'all') {
      httpParams = httpParams.set('status', params.status);
    }
    if (typeof params?.limit === 'number') {
      httpParams = httpParams.set('limit', String(params.limit));
    }
    if (typeof params?.offset === 'number') {
      httpParams = httpParams.set('offset', String(params.offset));
    }

    return this.http
      .get<{
        success: boolean;
        data: Array<AdminContact & { _id?: string }>;
        pagination?: AdminContactsPagination;
      }>(`${environment.apiUrl}/contact`, { params: httpParams })
      .pipe(
        map((res) => {
          const contacts = (res.data || []).map((c) => ({
            ...c,
            id: c.id || c._id || ''
          }));
          return {
            contacts,
            pagination: res.pagination || {
              total: contacts.length,
              limit: params?.limit ?? contacts.length,
              offset: params?.offset ?? 0,
              hasMore: false
            }
          };
        }),
        catchError((error) => {
          console.error('Error fetching admin contacts:', error);
          return of({
            contacts: [],
            pagination: {
              total: 0,
              limit: params?.limit ?? 25,
              offset: params?.offset ?? 0,
              hasMore: false
            }
          });
        })
      );
  }

  updateContactStatus(id: string, status: AdminContactStatus): Observable<AdminContact | null> {
    return this.http
      .patch<{ success: boolean; data: AdminContact & { _id?: string } }>(
        `${environment.apiUrl}/contact/${id}/status`,
        { status }
      )
      .pipe(
        map((res) => {
          const c = res.data;
          if (!c) return null;
          return {
            ...c,
            id: c.id || c._id || id
          };
        }),
        catchError((error) => {
          console.error('Error updating contact status:', error);
          return of(null);
        })
      );
  }

  getLeadsBySource(params?: { from?: string; to?: string }): Observable<LeadsBySourcePoint[]> {
    let httpParams = new HttpParams();
    if (params?.from) httpParams = httpParams.set('from', params.from);
    if (params?.to) httpParams = httpParams.set('to', params.to);

    return this.http
      .get<{ success: boolean; data: LeadsBySourcePoint[] }>(`${environment.apiUrl}/contact/analytics/source`, {
        params: httpParams
      })
      .pipe(
        map((res) => res.data || []),
        catchError((error) => {
          console.error('Error fetching leads by source:', error);
          return of([]);
        })
      );
  }
}
