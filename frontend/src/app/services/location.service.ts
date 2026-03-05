import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpBackend } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

const GOV_IL_CITIES_URL =
  'https://data.gov.il/api/3/action/datastore_search?resource_id=5c78e9fa-c2e2-4771-93ff-7f400a12f7ba&limit=32000';

export interface GovIlDatastoreResponse {
  result?: {
    records?: Record<string, unknown>[];
  };
}

@Injectable({
  providedIn: 'root'
})
export class LocationService {
  private handler = inject(HttpBackend);
  /** HttpClient that bypasses interceptors (no Authorization header) – for public APIs like Gov.il */
  private cleanHttp = new HttpClient(this.handler);
  private cachedCities: string[] | null = null;

  /**
   * Fetches Israeli city names from the official Gov.il API.
   * Uses a clean HttpClient (no interceptors) to avoid CORS issues with Authorization header.
   * Uses field שם_ישוב (settlement name). Returns a sorted, unique list.
   */
  getIsraeliCities(): Observable<string[]> {
    if (this.cachedCities?.length) {
      return of(this.cachedCities);
    }

    return this.cleanHttp.get<GovIlDatastoreResponse>(GOV_IL_CITIES_URL).pipe(
      map((res) => {
        const records = res?.result?.records ?? [];
        const list = records
          .map((rec: Record<string, unknown>) =>
            typeof rec['שם_ישוב'] === 'string' ? (rec['שם_ישוב'] as string).trim() : ''
          )
          .filter((name: string) => name !== '' && name !== 'לא רשום');
        const unique = Array.from(new Set(list));
        const sorted = unique.sort((a: string, b: string) => a.localeCompare(b, 'he'));
        this.cachedCities = sorted;
        return sorted;
      }),
      catchError(() => {
        // Fallback list if API fails (e.g. CORS or network)
        const fallback = [
          'מעלה מכמש',
          'ירושלים',
          'תל אביב - יפו',
          'חיפה',
          'באר שבע',
          'נתניה',
          'רמת גן',
          'אשדוד',
          'הרצליה',
          'כפר סבא',
          'רעננה',
          'עכו',
          'כרמיאל',
          'נהריה',
          'קריות'
        ];
        this.cachedCities = fallback;
        return of(fallback);
      })
    );
  }
}
