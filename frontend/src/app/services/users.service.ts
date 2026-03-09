import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface AdminUser {
  _id: string;
  fullName: string;
  username: string;
  phone?: string;
  address?: string;
  role: string;
  isActive?: boolean;
  createdAt: string;
  updatedAt?: string;
  orderCount?: number;
  totalSpent?: number;
  lastOrderDate?: string | null;
  tags?: string[];
  adminNotes?: string;
  dietaryInfo?: string;
}

export interface UpdateCrmPayload {
  tags?: string[];
  adminNotes?: string;
  dietaryInfo?: string;
}

@Injectable({
  providedIn: 'root'
})
export class UsersService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/users`;

  getUsers(): Observable<AdminUser[]> {
    return this.http.get<AdminUser[]>(this.apiUrl);
  }

  updateUserCrm(userId: string, payload: UpdateCrmPayload): Observable<AdminUser> {
    return this.http.put<AdminUser>(`${this.apiUrl}/${userId}/crm`, payload);
  }
}
