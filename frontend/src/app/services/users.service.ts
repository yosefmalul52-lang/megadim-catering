import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface AdminUser {
  _id: string;
  fullName: string;
  username: string;
  email?: string;
  phone?: string;
  address?: string;
  role: string;
  isActive?: boolean;
  createdAt: string;
  updatedAt?: string;
  orderCount?: number;
  totalSpent?: number;
  lastOrderDate?: string | null;
  manualStatus?: 'NONE' | 'VIP' | 'BLACKLIST';
  customerCategory?: 'all' | 'returning' | 'sleeping' | 'vip' | 'registered';
  tags?: string[];
  adminNotes?: string;
  dietaryInfo?: string;
  /** User account exists for this phone (synced from backend). */
  isRegistered?: boolean;
}

export interface UpdateCrmPayload {
  fullName?: string;
  email?: string;
  phone?: string;
  address?: string;
  tags?: string[];
  adminNotes?: string;
  dietaryInfo?: string;
  manualStatus?: 'NONE' | 'VIP' | 'BLACKLIST';
  customerCategory?: 'all' | 'returning' | 'sleeping' | 'vip' | 'registered';
}

export interface DeleteCustomerResponse {
  success: boolean;
  message?: string;
  _id?: string;
}

export interface MigrateLegacyCustomersResponse {
  success: boolean;
  message?: string;
  groupedPhones?: number;
  migratedCustomers?: number;
}

export interface CustomerAuditIssue {
  phone: string;
  issueType: string;
  valueInCRM: unknown;
  valueInOrders: unknown;
  detail?: string;
}

export interface CustomerAuditResponse {
  success: boolean;
  generatedAt: string;
  summary: {
    orderCountMismatches: number;
    totalSpentMismatches: number;
    identityFlags: number;
    orphans: number;
    nameConflicts: number;
    totalIssues: number;
  };
  issues: CustomerAuditIssue[];
}

export interface ResolvedSiteUser {
  _id: string;
  username: string;
  role: string;
  fullName?: string;
  phone?: string;
  isActive?: boolean;
  createdAt?: string;
}

export interface ResolveSiteUserResponse {
  success: boolean;
  matchedBy?: 'username' | 'phone';
  user?: ResolvedSiteUser;
  message?: string;
}

export interface DriverUser {
  _id: string;
  fullName: string;
  username: string;
  phone?: string;
}

export type SiteUserRole = 'admin' | 'user' | 'driver';

@Injectable({
  providedIn: 'root'
})
export class UsersService {
  private http = inject(HttpClient);
  private customersApiUrl = `${environment.apiUrl}/customers`;
  private usersApiUrl = `${environment.apiUrl}/users`;

  getUsers(): Observable<AdminUser[]> {
    return this.http.get<AdminUser[]>(`${this.customersApiUrl}?limit=1000`, { withCredentials: true });
  }

  updateUserCrm(userId: string, payload: UpdateCrmPayload): Observable<AdminUser> {
    return this.http.put<AdminUser>(`${this.customersApiUrl}/${userId}/crm`, payload, {
      withCredentials: true
    });
  }

  deleteUser(userId: string): Observable<DeleteCustomerResponse> {
    return this.http.delete<DeleteCustomerResponse>(`${this.customersApiUrl}/${userId}`, {
      withCredentials: true
    });
  }

  migrateLegacyCustomers(): Observable<MigrateLegacyCustomersResponse> {
    return this.http.post<MigrateLegacyCustomersResponse>(`${this.customersApiUrl}/migrate`, {}, {
      withCredentials: true
    });
  }

  runCustomerAudit(): Observable<CustomerAuditResponse> {
    return this.http.post<CustomerAuditResponse>(`${this.customersApiUrl}/audit`, {}, {
      withCredentials: true
    });
  }

  /** Admin only: find site User by login email or phone. */
  resolveSiteUser(username: string, phone?: string): Observable<ResolveSiteUserResponse> {
    const u = encodeURIComponent((username || '').trim().toLowerCase());
    const p = encodeURIComponent((phone || '').trim());
    const query = `username=${u}${p ? `&phone=${p}` : ''}`;
    return this.http.get<ResolveSiteUserResponse>(`${this.usersApiUrl}/resolve?${query}`, {
      withCredentials: true
    });
  }

  /** Admin only: change site User role. */
  patchSiteUserRole(userId: string, role: SiteUserRole): Observable<Record<string, unknown>> {
    return this.http.patch<Record<string, unknown>>(
      `${this.usersApiUrl}/${userId}/role`,
      { role },
      { withCredentials: true }
    );
  }

  getDriverUsers(): Observable<DriverUser[]> {
    return this.http
      .get<{ success: boolean; data: DriverUser[] }>(`${this.usersApiUrl}/drivers`, { withCredentials: true })
      .pipe(map((res) => res?.data || []));
  }
}
