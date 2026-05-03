import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export type CampaignPlatform = 'facebook' | 'instagram';
export type CampaignStatus = 'draft' | 'pending' | 'published' | 'failed';

export interface LaunchCampaignPayload {
  title: string;
  content: string;
  mediaUrl?: string;
  platforms: CampaignPlatform[];
  scheduledAt?: string;
}

export interface CampaignItem {
  _id: string;
  title: string;
  content: string;
  mediaUrl?: string;
  platforms: CampaignPlatform[];
  status: CampaignStatus;
  n8nResponse?: Record<string, unknown>;
  scheduledAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

@Injectable({
  providedIn: 'root'
})
export class CampaignService {
  private http = inject(HttpClient);

  launchCampaign(payload: LaunchCampaignPayload): Observable<{
    success: boolean;
    message: string;
    data?: CampaignItem;
  }> {
    return this.http.post<{
      success: boolean;
      message: string;
      data?: CampaignItem;
    }>(`${environment.apiUrl}/campaign/launch`, payload);
  }

  getCampaigns(params?: { status?: CampaignStatus; limit?: number }): Observable<{
    success: boolean;
    data: CampaignItem[];
  }> {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (typeof params?.limit === 'number') query.set('limit', String(params.limit));
    const qs = query.toString();
    const suffix = qs ? `?${qs}` : '';
    return this.http.get<{ success: boolean; data: CampaignItem[] }>(
      `${environment.apiUrl}/campaign${suffix}`
    );
  }
}
