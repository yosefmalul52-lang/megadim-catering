import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface DeliveryStoreSettings {
  freeShippingThreshold: number;
  isFreeShippingActive: boolean;
  /** Specific dates open for orders; format 'YYYY-MM-DD' */
  openDates?: string[];
  minimumLeadDays?: number;
}

@Injectable({
  providedIn: 'root'
})
export class AdminDeliveryService {
  private http = inject(HttpClient);
  private settingsUrl = `${environment.apiUrl}/settings`;

  getDeliverySettings(): Observable<{ success: boolean; data: DeliveryStoreSettings }> {
    return this.http.get<{ success: boolean; data: DeliveryStoreSettings }>(`${this.settingsUrl}/delivery`);
  }

  updateDeliverySettings(settings: Partial<DeliveryStoreSettings>): Observable<{ success: boolean; data: DeliveryStoreSettings }> {
    return this.http.put<{ success: boolean; data: DeliveryStoreSettings }>(`${this.settingsUrl}/delivery`, settings);
  }
}
