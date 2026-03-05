import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface CalculateFeeResponse {
  distance: number;
  price: number;
  originalPrice?: number;
  isFree?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class DeliveryService {
  private http = inject(HttpClient);

  calculateFee(destinationCity: string, cartTotal?: number): Observable<CalculateFeeResponse> {
    return this.http.post<CalculateFeeResponse>(`${environment.apiUrl}/delivery/calculate-fee`, {
      destinationCity: (destinationCity || '').trim(),
      cartTotal: cartTotal ?? 0
    });
  }
}
