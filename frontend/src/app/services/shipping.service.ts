import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ShippingGlobalSettings {
  freeShippingThreshold: number;
  isFreeShippingActive: boolean;
  baseDeliveryFee: number;
  pricePerKm: number;
  /** Specific dates open for orders; format 'YYYY-MM-DD' */
  openDates?: string[];
  minimumLeadDays?: number;
  tiers?: DeliveryPricingTier[];
}

export interface DeliveryCityOverride {
  _id: string;
  cityName: string;
  displayName: string;
  overridePrice: number;
  isActive: boolean;
}

export interface CalculateFeeResponse {
  distance: number;
  price: number;
  originalPrice?: number;
  isFree?: boolean;
  error?: string;
}

export interface DeliveryPricingTier {
  _id: string;
  minDistanceKm: number;
  maxDistanceKm: number;
  price: number;
  isActive?: boolean;
  /** Optional per-tier free shipping threshold (₪). Leave empty to use global. */
  freeShippingThreshold?: number;
   /** Optional per-tier minimum order amount (₪) required for delivery. */
  minOrderForDelivery?: number;
}

@Injectable({
  providedIn: 'root'
})
export class ShippingService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/delivery`;
  private settingsUrl = `${environment.apiUrl}/settings`;

  getGlobalSettings(): Observable<{ success: boolean; data: ShippingGlobalSettings }> {
    return this.http.get<{ success: boolean; data: ShippingGlobalSettings }>(`${this.settingsUrl}/delivery`);
  }

  updateGlobalSettings(settings: Partial<ShippingGlobalSettings>): Observable<{ success: boolean; data: ShippingGlobalSettings }> {
    return this.http.put<{ success: boolean; data: ShippingGlobalSettings }>(`${this.settingsUrl}/delivery`, settings);
  }

  /** Atomic save: global settings + full tiers array in one request */
  saveAllDeliverySettings(payload: ShippingGlobalSettings): Observable<{ success: boolean; data: ShippingGlobalSettings; message?: string }> {
    return this.http.put<{ success: boolean; data: ShippingGlobalSettings; message?: string }>(`${this.settingsUrl}/delivery`, payload);
  }

  getCityOverrides(): Observable<DeliveryCityOverride[]> {
    return this.http.get<DeliveryCityOverride[]>(`${this.baseUrl}/cities`);
  }

  createCityOverride(displayName: string, overridePrice: number): Observable<DeliveryCityOverride> {
    return this.http.post<DeliveryCityOverride>(`${this.baseUrl}/cities`, { displayName, overridePrice });
  }

  updateCityOverride(
    id: string,
    patch: Partial<{ displayName: string; overridePrice: number; isActive: boolean }>
  ): Observable<DeliveryCityOverride> {
    return this.http.put<DeliveryCityOverride>(`${this.baseUrl}/cities/${id}`, patch);
  }

  deleteCityOverride(id: string): Observable<{ deleted: boolean; id: string }> {
    return this.http.delete<{ deleted: boolean; id: string }>(`${this.baseUrl}/cities/${id}`);
  }

  /** Test calculation: address/city + optional cart total (for free shipping rule) */
  calculateFee(addressOrCity: string, cartTotal: number = 0): Observable<CalculateFeeResponse> {
    return this.http.post<CalculateFeeResponse>(`${this.baseUrl}/calculate-fee`, {
      destinationCity: (addressOrCity || '').trim(),
      cartTotal
    });
  }

  /** Distance ranges table (core logic) */
  getPricingTiers(): Observable<DeliveryPricingTier[]> {
    return this.http.get<DeliveryPricingTier[]>(`${this.baseUrl}/pricing`);
  }

  createPricingTier(tier: { minDistanceKm: number; maxDistanceKm: number; price: number }): Observable<DeliveryPricingTier> {
    return this.http.post<DeliveryPricingTier>(`${this.baseUrl}/pricing`, tier);
  }

  updatePricingTier(
    id: string,
    tier: Partial<{ minDistanceKm: number; maxDistanceKm: number; price: number; isActive: boolean }>
  ): Observable<DeliveryPricingTier> {
    return this.http.put<DeliveryPricingTier>(`${this.baseUrl}/pricing/${id}`, tier);
  }

  deletePricingTier(id: string): Observable<{ deleted: boolean; id: string }> {
    return this.http.delete<{ deleted: boolean; id: string }>(`${this.baseUrl}/pricing/${id}`);
  }
}
