import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface GalleryItem {
  _id?: string;
  id?: string;
  title?: string;
  type: 'image' | 'video';
  url: string;
  thumbnail?: string;
  order?: number;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateGalleryItemRequest {
  title?: string;
  type: 'image' | 'video';
  url: string;
  thumbnail?: string;
  order?: number;
  isActive?: boolean;
}

export interface UpdateGalleryItemRequest {
  title?: string;
  type?: 'image' | 'video';
  url?: string;
  thumbnail?: string;
  order?: number;
  isActive?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class GalleryService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/gallery`;

  private galleryItemsSubject = new BehaviorSubject<GalleryItem[]>([]);
  public galleryItems$ = this.galleryItemsSubject.asObservable();

  // Get all gallery items
  getGalleryItems(type?: 'image' | 'video', activeOnly: boolean = true): Observable<GalleryItem[]> {
    const params: any = {};
    if (type) params.type = type;
    if (activeOnly) params.active = 'true';

    return this.http.get<{ success: boolean; data: GalleryItem[] }>(this.apiUrl, { params }).pipe(
      map(response => {
        const items = response.data.map(item => ({
          ...item,
          id: item._id || item.id
        }));
        this.galleryItemsSubject.next(items);
        return items;
      }),
      catchError(error => {
        console.error('Error fetching gallery items:', error);
        return [];
      })
    );
  }

  // Get gallery item by ID
  getGalleryItemById(id: string): Observable<GalleryItem> {
    return this.http.get<{ success: boolean; data: GalleryItem }>(`${this.apiUrl}/${id}`).pipe(
      map(response => ({
        ...response.data,
        id: response.data._id || response.data.id
      }))
    );
  }

  // Create new gallery item
  createGalleryItem(item: CreateGalleryItemRequest): Observable<GalleryItem> {
    return this.http.post<{ success: boolean; data: GalleryItem }>(this.apiUrl, item).pipe(
      map(response => ({
        ...response.data,
        id: response.data._id || response.data.id
      })),
      tap(() => {
        // Refresh the list
        this.getGalleryItems().subscribe();
      })
    );
  }

  // Update gallery item
  updateGalleryItem(id: string, updates: UpdateGalleryItemRequest): Observable<GalleryItem> {
    return this.http.put<{ success: boolean; data: GalleryItem }>(`${this.apiUrl}/${id}`, updates).pipe(
      map(response => ({
        ...response.data,
        id: response.data._id || response.data.id
      })),
      tap(() => {
        // Refresh the list
        this.getGalleryItems().subscribe();
      })
    );
  }

  // Delete gallery item
  deleteGalleryItem(id: string): Observable<void> {
    return this.http.delete<{ success: boolean }>(`${this.apiUrl}/${id}`).pipe(
      map(() => undefined),
      tap(() => {
        // Refresh the list
        this.getGalleryItems().subscribe();
      })
    );
  }

  // Get gallery statistics
  getGalleryStatistics(): Observable<any> {
    return this.http.get<{ success: boolean; data: any }>(`${this.apiUrl}/stats`).pipe(
      map(response => response.data)
    );
  }

  // Helper: Extract YouTube video ID from URL
  extractYouTubeId(url: string): string | null {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /youtube\.com\/.*[?&]v=([^&\n?#]+)/
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    return null;
  }

  // Helper: Generate YouTube thumbnail URL
  generateYouTubeThumbnail(videoId: string): string {
    return `https://img.youtube.com/vi/${videoId}/0.jpg`;
  }
}

