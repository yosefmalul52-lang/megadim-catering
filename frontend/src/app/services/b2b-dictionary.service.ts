import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import type { B2BDictionaryCategory, B2BMenuItem } from '../utils/b2b-dictionary';

export interface CreateB2BMenuItemPayload {
  name: string;
  category: B2BDictionaryCategory;
  gramsPerPortion?: number;
  portionsPerGastronorm?: number;
}

export interface UpdateB2BMenuItemPayload extends CreateB2BMenuItemPayload {}

@Injectable({ providedIn: 'root' })
export class B2BDictionaryService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/admin/b2b-dictionary`;

  list(category?: B2BDictionaryCategory, includeInactive = false): Observable<B2BMenuItem[]> {
    const params: Record<string, string> = {};
    if (category) params['category'] = category;
    if (includeInactive) params['includeInactive'] = 'true';
    return this.http
      .get<{ success: boolean; data: B2BMenuItem[] }>(this.baseUrl, { params })
      .pipe(map((res) => res.data || []));
  }

  create(payload: CreateB2BMenuItemPayload): Observable<B2BMenuItem> {
    return this.http
      .post<{ success: boolean; data: B2BMenuItem; message?: string }>(this.baseUrl, payload)
      .pipe(map((res) => res.data));
  }

  update(id: string, payload: UpdateB2BMenuItemPayload): Observable<B2BMenuItem> {
    return this.http
      .put<{ success: boolean; data: B2BMenuItem; message?: string }>(`${this.baseUrl}/${id}`, payload)
      .pipe(map((res) => res.data));
  }

  delete(id: string): Observable<void> {
    return this.http
      .delete<{ success: boolean; message?: string }>(`${this.baseUrl}/${id}`)
      .pipe(map(() => undefined));
  }
}
