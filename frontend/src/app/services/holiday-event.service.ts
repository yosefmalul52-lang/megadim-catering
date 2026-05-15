import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface HolidayEventProduct {
  _id?: string;
  title: string;
  price: number;
  description: string;
  imageUrl: string;
  /** Admin only; omitted from public active API for hidden products */
  isAvailable?: boolean;
}

export interface HolidayEvent {
  _id: string;
  name: string;
  isActive: boolean;
  orderDeadline: string;
  /** Dedicated hero / Bento banner for the event */
  imageUrl?: string;
  products: HolidayEventProduct[];
}

export interface ActiveHolidayEventResponse {
  visible: boolean;
  event: HolidayEvent | null;
}

export type HolidayEventPayload = Pick<
  HolidayEvent,
  'name' | 'isActive' | 'orderDeadline' | 'imageUrl' | 'products'
>;

@Injectable({
  providedIn: 'root'
})
export class HolidayEventService {
  private http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/holiday-events`;

  getActive(): Observable<ActiveHolidayEventResponse> {
    return this.http.get<ActiveHolidayEventResponse>(`${this.baseUrl}/public/active`);
  }

  list(): Observable<HolidayEvent[]> {
    return this.http.get<HolidayEvent[]>(this.baseUrl);
  }

  getById(id: string): Observable<HolidayEvent> {
    return this.http.get<HolidayEvent>(`${this.baseUrl}/${id}`);
  }

  create(payload: HolidayEventPayload): Observable<HolidayEvent> {
    return this.http.post<HolidayEvent>(this.baseUrl, payload);
  }

  update(id: string, payload: Partial<HolidayEventPayload>): Observable<HolidayEvent> {
    return this.http.put<HolidayEvent>(`${this.baseUrl}/${id}`, payload);
  }

  delete(id: string): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(`${this.baseUrl}/${id}`);
  }
}
