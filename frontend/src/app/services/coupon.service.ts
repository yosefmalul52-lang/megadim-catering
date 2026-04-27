import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Coupon {
  _id: string;
  code: string;
  discountType: 'percentage' | 'fixedAmount';
  discountValue: number;
  minOrderValue: number;
  expiryDate: string;
  maxUses: number;
  currentUses: number;
  isActive: boolean;
  isVipOnly?: boolean;
  targetCustomerCategory?: 'all' | 'returning' | 'sleeping' | 'vip';
  createdAt?: string;
  updatedAt?: string;
}

export interface ApplyCouponResponse {
  success: boolean;
  message?: string;
  discountAmount?: number;
  newTotal?: number;
  couponId?: string;
}

@Injectable({
  providedIn: 'root'
})
export class CouponService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/coupons`;

  getCoupons(): Observable<Coupon[]> {
    return this.http.get<Coupon[]>(this.apiUrl);
  }

  createCoupon(coupon: Partial<Coupon>): Observable<Coupon> {
    return this.http.post<Coupon>(this.apiUrl, coupon);
  }

  updateCoupon(id: string, updates: Partial<Coupon>): Observable<Coupon> {
    return this.http.put<Coupon>(`${this.apiUrl}/${id}`, updates);
  }

  applyCoupon(code: string, cartTotal: number): Observable<ApplyCouponResponse> {
    return this.http.post<ApplyCouponResponse>(`${this.apiUrl}/apply`, { code, cartTotal });
  }
}
