import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { MatSnackBar } from '@angular/material/snack-bar';
import { environment } from '../../environments/environment';
import { VideoSource } from '../utils/video.utils';

export interface Video {
  _id?: string;
  id?: string;
  title: string;
  source?: VideoSource;
  youtubeUrl?: string;
  videoId?: string;
  videoUrl?: string;
  publicId?: string;
  thumbnailUrl: string;
  order?: number;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateVideoRequest {
  title: string;
  source: VideoSource;
  youtubeUrl?: string;
  videoUrl?: string;
  publicId?: string;
  thumbnailUrl?: string;
}

export interface UpdateVideoRequest {
  title?: string;
  source?: VideoSource;
  youtubeUrl?: string;
  videoUrl?: string;
  publicId?: string;
  thumbnailUrl?: string;
  order?: number;
  isActive?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class VideoService {
  private http = inject(HttpClient);
  private snackBar = inject(MatSnackBar);
  private apiUrl = `${environment.apiUrl}/videos`;

  private static readonly LOAD_ERROR_MESSAGE = 'אירעה שגיאה בטעינת הנתונים, אנא רעננו את העמוד';

  private handleDataLoadError(error: unknown): Observable<never> {
    this.snackBar.open(VideoService.LOAD_ERROR_MESSAGE, 'סגור', { duration: 6000 });
    return throwError(() => error);
  }

  private videosSubject = new BehaviorSubject<Video[]>([]);
  public videos$ = this.videosSubject.asObservable();

  getVideos(activeOnly: boolean = true): Observable<Video[]> {
    const params: Record<string, string> = {};
    if (activeOnly) {
      params['active'] = 'true';
    } else {
      params['includeAll'] = 'true';
    }

    return this.http.get<{ success: boolean; data: Video[] }>(this.apiUrl, { params }).pipe(
      map((response) => {
        const videos = response.data.map((video) => ({
          ...video,
          id: video._id || video.id
        }));
        this.videosSubject.next(videos);
        return videos;
      }),
      catchError((error) => {
        console.error('Error fetching videos:', error);
        return this.handleDataLoadError(error);
      })
    );
  }

  getVideoById(id: string): Observable<Video> {
    return this.http.get<{ success: boolean; data: Video }>(`${this.apiUrl}/${id}`).pipe(
      map((response) => ({
        ...response.data,
        id: response.data._id || response.data.id
      }))
    );
  }

  createVideo(video: CreateVideoRequest): Observable<Video> {
    return this.http.post<{ success: boolean; data: Video }>(this.apiUrl, video).pipe(
      map((response) => ({
        ...response.data,
        id: response.data._id || response.data.id
      })),
      tap(() => {
        this.getVideos(false).subscribe();
      })
    );
  }

  updateVideo(id: string, updates: UpdateVideoRequest): Observable<Video> {
    return this.http.put<{ success: boolean; data: Video }>(`${this.apiUrl}/${id}`, updates).pipe(
      map((response) => ({
        ...response.data,
        id: response.data._id || response.data.id
      })),
      tap(() => {
        this.getVideos(false).subscribe();
      })
    );
  }

  deleteVideo(id: string): Observable<void> {
    return this.http.delete<{ success: boolean }>(`${this.apiUrl}/${id}`).pipe(
      map(() => undefined),
      tap(() => {
        this.getVideos(false).subscribe();
      })
    );
  }

  getVideoStatistics(): Observable<{ total: number; active: number; inactive: number }> {
    return this.http.get<{ success: boolean; data: { total: number; active: number; inactive: number } }>(
      `${this.apiUrl}/stats`
    ).pipe(map((response) => response.data));
  }
}
