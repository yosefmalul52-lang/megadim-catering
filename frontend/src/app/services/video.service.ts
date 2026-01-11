import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface Video {
  _id?: string;
  id?: string;
  title: string;
  youtubeUrl: string;
  videoId: string;
  thumbnailUrl: string;
  order?: number;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateVideoRequest {
  title: string;
  youtubeUrl: string;
}

export interface UpdateVideoRequest {
  title?: string;
  youtubeUrl?: string;
  order?: number;
  isActive?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class VideoService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/videos`;

  private videosSubject = new BehaviorSubject<Video[]>([]);
  public videos$ = this.videosSubject.asObservable();

  // Get all videos
  getVideos(activeOnly: boolean = true): Observable<Video[]> {
    const params: any = {};
    if (activeOnly) params.active = 'true';

    return this.http.get<{ success: boolean; data: Video[] }>(this.apiUrl, { params }).pipe(
      map(response => {
        const videos = response.data.map(video => ({
          ...video,
          id: video._id || video.id
        }));
        this.videosSubject.next(videos);
        return videos;
      }),
      catchError(error => {
        console.error('Error fetching videos:', error);
        return [];
      })
    );
  }

  // Get video by ID
  getVideoById(id: string): Observable<Video> {
    return this.http.get<{ success: boolean; data: Video }>(`${this.apiUrl}/${id}`).pipe(
      map(response => ({
        ...response.data,
        id: response.data._id || response.data.id
      }))
    );
  }

  // Create new video
  createVideo(video: CreateVideoRequest): Observable<Video> {
    return this.http.post<{ success: boolean; data: Video }>(this.apiUrl, video).pipe(
      map(response => ({
        ...response.data,
        id: response.data._id || response.data.id
      })),
      tap(() => {
        // Refresh the list
        this.getVideos().subscribe();
      })
    );
  }

  // Update video
  updateVideo(id: string, updates: UpdateVideoRequest): Observable<Video> {
    return this.http.put<{ success: boolean; data: Video }>(`${this.apiUrl}/${id}`, updates).pipe(
      map(response => ({
        ...response.data,
        id: response.data._id || response.data.id
      })),
      tap(() => {
        // Refresh the list
        this.getVideos().subscribe();
      })
    );
  }

  // Delete video
  deleteVideo(id: string): Observable<void> {
    return this.http.delete<{ success: boolean }>(`${this.apiUrl}/${id}`).pipe(
      map(() => undefined),
      tap(() => {
        // Refresh the list
        this.getVideos().subscribe();
      })
    );
  }

  // Get video statistics
  getVideoStatistics(): Observable<any> {
    return this.http.get<{ success: boolean; data: any }>(`${this.apiUrl}/stats`).pipe(
      map(response => response.data)
    );
  }
}

