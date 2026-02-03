import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { tap, catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface SiteSettings {
  shabbatMenuUrl: string;
  eventsMenuUrl: string;
  contactPhone?: string;
  whatsappLink?: string;
}

export interface SiteSettingsResponse {
  success: boolean;
  data: SiteSettings;
  timestamp?: string;
}

@Injectable({
  providedIn: 'root'
})
export class SiteSettingsService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/settings`;

  // Cache settings in BehaviorSubject to avoid repeated API calls
  private settingsSubject = new BehaviorSubject<SiteSettings | null>(null);
  public settings$ = this.settingsSubject.asObservable();

  private isLoadingSubject = new BehaviorSubject<boolean>(false);
  public isLoading$ = this.isLoadingSubject.asObservable();

  /**
   * Get site settings from API
   * Uses cache if available, otherwise fetches from API
   */
  getSettings(): Observable<SiteSettings> {
    // Return cached value if available
    const cached = this.settingsSubject.value;
    if (cached) {
      return of(cached);
    }

    // Fetch from API
    this.isLoadingSubject.next(true);
    return this.http.get<SiteSettingsResponse>(this.apiUrl).pipe(
      map(response => response.data),
      tap(settings => {
        // Cache the settings
        this.settingsSubject.next(settings);
        this.isLoadingSubject.next(false);
      }),
      catchError(error => {
        console.error('Error fetching site settings:', error);
        this.isLoadingSubject.next(false);
        // Return default settings on error
        const defaultSettings: SiteSettings = {
          shabbatMenuUrl: '',
          eventsMenuUrl: '',
          contactPhone: '',
          whatsappLink: ''
        };
        return of(defaultSettings);
      })
    );
  }

  /**
   * Update site settings (Admin only)
   * @param settings Partial settings object with fields to update
   */
  updateSettings(settings: Partial<SiteSettings>): Observable<SiteSettings> {
    this.isLoadingSubject.next(true);
    return this.http.put<SiteSettingsResponse>(this.apiUrl, settings).pipe(
      map(response => response.data),
      tap(updatedSettings => {
        // Update cache with new settings
        this.settingsSubject.next(updatedSettings);
        this.isLoadingSubject.next(false);
      }),
      catchError(error => {
        console.error('Error updating site settings:', error);
        this.isLoadingSubject.next(false);
        throw error;
      })
    );
  }

  /**
   * Clear cache (useful for forcing a refresh)
   */
  clearCache(): void {
    this.settingsSubject.next(null);
  }

  /**
   * Get current cached settings (synchronous)
   */
  getCurrentSettings(): SiteSettings | null {
    return this.settingsSubject.value;
  }
}

