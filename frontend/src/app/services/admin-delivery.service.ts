import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface DeliveryPricingTier {
  _id: string;
  minDistanceKm: number;
  maxDistanceKm: number;
  price: number;
  isActive?: boolean;
}

export interface DeliveryStoreSettings {
  freeShippingThreshold: number;
  isFreeShippingActive: boolean;
  allowedDays?: number[]; // 0=Sun, 1=Mon, ..., 6=Sat
  minimumLeadDays?: number; // Earliest order = today + this many days
}

@Injectable({
  providedIn: 'root'
})
export class AdminDeliveryService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/delivery`;
  private settingsUrl = `${environment.apiUrl}/settings`;

  getAllPricing(): Observable<DeliveryPricingTier[]> {
    return this.http.get<DeliveryPricingTier[]>(`${this.baseUrl}/pricing`);
  }

  getDeliverySettings(): Observable<{ success: boolean; data: DeliveryStoreSettings }> {
    return this.http.get<{ success: boolean; data: DeliveryStoreSettings }>(`${this.settingsUrl}/delivery`);
  }

  updateDeliverySettings(settings: Partial<DeliveryStoreSettings>): Observable<{ success: boolean; data: DeliveryStoreSettings }> {
    return this.http.put<{ success: boolean; data: DeliveryStoreSettings }>(`${this.settingsUrl}/delivery`, settings);
  }

  createPricing(tier: { minDistanceKm: number; maxDistanceKm: number; price: number }): Observable<DeliveryPricingTier> {
    return this.http.post<DeliveryPricingTier>(`${this.baseUrl}/pricing`, tier);
  }

  updatePricing(
    id: string,
    tier: Partial<{ minDistanceKm: number; maxDistanceKm: number; price: number; isActive: boolean }>
  ): Observable<DeliveryPricingTier> {
    return this.http.put<DeliveryPricingTier>(`${this.baseUrl}/pricing/${id}`, tier);
  }

  deletePricing(id: string): Observable<{ deleted: boolean; id: string }> {
    return this.http.delete<{ deleted: boolean; id: string }>(`${this.baseUrl}/pricing/${id}`);
  }
}
