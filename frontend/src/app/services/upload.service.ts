import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface UploadResponse {
  success: boolean;
  message?: string;
  imageUrl: string;
  publicId?: string;
  format?: string;
  width?: number;
  height?: number;
  bytes?: number;
}

export interface VideoUploadResponse {
  success: boolean;
  message?: string;
  videoUrl: string;
  publicId?: string;
  format?: string;
  bytes?: number;
  duration?: number;
}

@Injectable({
  providedIn: 'root'
})
export class UploadService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/upload`;

  uploadImage(file: File): Observable<UploadResponse> {
    const formData = new FormData();
    formData.append('image', file);

    return this.http
      .post<{
        success: boolean;
        message?: string;
        imageUrl: string;
        publicId?: string;
        format?: string;
        width?: number;
        height?: number;
        bytes?: number;
      }>(this.apiUrl, formData)
      .pipe(
        map((response) => ({
          success: response.success,
          message: response.message,
          imageUrl: response.imageUrl,
          publicId: response.publicId,
          format: response.format,
          width: response.width,
          height: response.height,
          bytes: response.bytes
        })),
        catchError((error: { error?: { message?: string }; message?: string }) => {
          console.error('Error uploading image:', error);
          throw {
            success: false,
            message: error.error?.message || error.message || 'Failed to upload image',
            imageUrl: ''
          };
        })
      );
  }

  uploadVideo(file: File): Observable<VideoUploadResponse> {
    const formData = new FormData();
    formData.append('video', file);

    return this.http
      .post<{
        success: boolean;
        message?: string;
        videoUrl: string;
        publicId?: string;
        format?: string;
        bytes?: number;
        duration?: number;
      }>(`${this.apiUrl}/video`, formData)
      .pipe(
        map((response) => ({
          success: response.success,
          message: response.message,
          videoUrl: response.videoUrl,
          publicId: response.publicId,
          format: response.format,
          bytes: response.bytes,
          duration: response.duration
        })),
        catchError((error: { error?: { message?: string }; message?: string }) => {
          console.error('Error uploading video:', error);
          throw {
            success: false,
            message: error.error?.message || error.message || 'Failed to upload video',
            videoUrl: ''
          };
        })
      );
  }
}
