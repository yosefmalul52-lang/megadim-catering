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

@Injectable({
  providedIn: 'root'
})
export class UploadService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/upload`;

  /**
   * Upload an image file to Cloudinary via backend
   * @param file - The image file to upload
   * @returns Observable with upload response containing imageUrl
   */
  uploadImage(file: File): Observable<UploadResponse> {
    const formData = new FormData();
    formData.append('image', file);

    return this.http.post<{ success: boolean; message?: string; imageUrl: string; publicId?: string; format?: string; width?: number; height?: number; bytes?: number }>(
      this.apiUrl,
      formData
    ).pipe(
      map(response => ({
        success: response.success,
        message: response.message,
        imageUrl: response.imageUrl,
        publicId: response.publicId,
        format: response.format,
        width: response.width,
        height: response.height,
        bytes: response.bytes
      })),
      catchError((error: any) => {
        console.error('Error uploading image:', error);
        throw {
          success: false,
          message: error.error?.message || error.message || 'Failed to upload image',
          imageUrl: ''
        };
      })
    );
  }
}

