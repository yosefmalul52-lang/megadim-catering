import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export type CampaignAudience = 'vip' | 'all' | 'leads';

export interface LaunchCampaignPayload {
  message: string;
  audience: CampaignAudience;
  channels: string[];
  couponCode?: string;
}

@Injectable({
  providedIn: 'root'
})
export class CampaignService {
  private http = inject(HttpClient);

  launchCampaign(payload: LaunchCampaignPayload): Observable<{
    success: boolean;
    message: string;
    data?: { targetsCount: number; forwarded: boolean };
  }> {
    return this.http.post<{
      success: boolean;
      message: string;
      data?: { targetsCount: number; forwarded: boolean };
    }>(`${environment.apiUrl}/campaign/launch`, payload);
  }
}
