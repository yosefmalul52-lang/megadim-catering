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
    return this.http.get<any>(this.apiUrl).pipe(
      map(response => {
        console.log('Raw API response:', response); // Debug log
        
        // Handle null or undefined response
        if (!response) {
          console.warn('API returned null/undefined, using default settings');
          return {
            shabbatMenuUrl: '',
            eventsMenuUrl: '',
            contactPhone: '',
            whatsappLink: ''
          };
        }
        
        // Handle both response formats: wrapped {success, data} or direct settings object
        let settings: SiteSettings | null = null;
        
        if (typeof response === 'object') {
          // Check if response has 'data' property (wrapped format: {success: true, data: {...}})
          if ('data' in response && response.data !== null && response.data !== undefined) {
            settings = response.data as SiteSettings;
          } 
          // Check if response is a direct settings object (has shabbatMenuUrl or eventsMenuUrl)
          else if ('shabbatMenuUrl' in response || 'eventsMenuUrl' in response) {
            settings = response as SiteSettings;
          }
        }
        
        // If still null, return default settings
        if (!settings) {
          console.warn('API returned invalid settings format, using defaults. Response:', response);
          settings = {
            shabbatMenuUrl: '',
            eventsMenuUrl: '',
            contactPhone: '',
            whatsappLink: ''
          };
        }
        
        // Ensure all required fields exist with safe defaults
        return {
          shabbatMenuUrl: settings.shabbatMenuUrl || '',
          eventsMenuUrl: settings.eventsMenuUrl || '',
          contactPhone: settings.contactPhone || '',
          whatsappLink: settings.whatsappLink || ''
        };
      }),
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
        this.settingsSubject.next(defaultSettings);
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
    return this.http.put<any>(this.apiUrl, settings).pipe(
      map(response => {
        console.log('Raw API update response:', response); // Debug log
        
        // Handle null or undefined response
        if (!response) {
          console.warn('API returned null/undefined after update, using input data');
          return {
            shabbatMenuUrl: settings.shabbatMenuUrl || '',
            eventsMenuUrl: settings.eventsMenuUrl || '',
            contactPhone: settings.contactPhone || '',
            whatsappLink: settings.whatsappLink || ''
          };
        }
        
        // Handle both response formats: wrapped {success, data} or direct settings object
        let updatedSettings: SiteSettings | null = null;
        
        if (typeof response === 'object') {
          // Check if response has 'data' property (wrapped format)
          if ('data' in response && response.data !== null && response.data !== undefined) {
            updatedSettings = response.data as SiteSettings;
          } 
          // Otherwise, treat response as direct settings object
          else if ('shabbatMenuUrl' in response || 'eventsMenuUrl' in response) {
            updatedSettings = response as SiteSettings;
          }
        }
        
        // If still null, create settings from the input data
        if (!updatedSettings) {
          console.warn('API returned invalid settings format after update, using input data');
          updatedSettings = {
            shabbatMenuUrl: settings.shabbatMenuUrl || '',
            eventsMenuUrl: settings.eventsMenuUrl || '',
            contactPhone: settings.contactPhone || '',
            whatsappLink: settings.whatsappLink || ''
          };
        }
        
        // Ensure all required fields exist with safe defaults
        return {
          shabbatMenuUrl: updatedSettings.shabbatMenuUrl || '',
          eventsMenuUrl: updatedSettings.eventsMenuUrl || '',
          contactPhone: updatedSettings.contactPhone || '',
          whatsappLink: updatedSettings.whatsappLink || ''
        };
      }),
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

