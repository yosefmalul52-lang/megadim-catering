import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatCardModule } from '@angular/material/card';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { VideoService, Video, CreateVideoRequest } from '../../../services/video.service';
import { UploadService } from '../../../services/upload.service';
import { VideoSource, cloudinaryVideoThumbnailFromUrl, resolveVideoSource } from '../../../utils/video.utils';

@Component({
  selector: 'app-video-gallery',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatCardModule,
    MatSnackBarModule
  ],
  templateUrl: './video-gallery.component.html',
  styleUrls: ['./video-gallery.component.scss']
})
export class VideoGalleryComponent implements OnInit {
  videoService = inject(VideoService);
  uploadService = inject(UploadService);
  snackBar = inject(MatSnackBar);
  fb = inject(FormBuilder);

  videos: Video[] = [];
  isLoading = false;
  showAddForm = false;

  /** Admin input mode */
  inputSource: VideoSource = 'cloudinary';

  videoPreviewUrl: string | null = null;
  uploadedVideoUrl = '';
  uploadedPublicId = '';
  isUploadingVideo = false;
  isVideoDragOver = false;

  videoForm: FormGroup = this.fb.group({
    title: ['', Validators.required],
    youtubeUrl: ['']
  });

  ngOnInit(): void {
    this.loadVideos();
  }

  get isYoutubeMode(): boolean {
    return this.inputSource === 'youtube';
  }

  get isNativeMode(): boolean {
    return this.inputSource === 'cloudinary';
  }

  get hasUploadedVideo(): boolean {
    return !!this.uploadedVideoUrl?.trim();
  }

  loadVideos(): void {
    this.isLoading = true;
    this.videoService.getVideos(false).subscribe({
      next: (videos) => {
        this.videos = videos;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading videos:', error);
        this.snackBar.open('שגיאה בטעינת הסרטונים', 'סגור', { duration: 3000 });
        this.isLoading = false;
      }
    });
  }

  setInputSource(source: VideoSource): void {
    this.inputSource = source;
    this.updateValidatorsForSource();
  }

  private updateValidatorsForSource(): void {
    const youtubeCtrl = this.videoForm.get('youtubeUrl');
    if (this.isYoutubeMode) {
      youtubeCtrl?.setValidators([
        Validators.required,
        Validators.pattern(/^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/)
      ]);
    } else {
      youtubeCtrl?.clearValidators();
      youtubeCtrl?.setValue('');
    }
    youtubeCtrl?.updateValueAndValidity();
  }

  openAddForm(): void {
    this.showAddForm = true;
    this.inputSource = 'cloudinary';
    this.resetUploadState();
    this.videoForm.reset();
    this.updateValidatorsForSource();
  }

  closeAddForm(): void {
    this.showAddForm = false;
    this.resetUploadState();
    this.videoForm.reset();
  }

  private resetUploadState(): void {
    this.videoPreviewUrl = null;
    this.uploadedVideoUrl = '';
    this.uploadedPublicId = '';
    this.isUploadingVideo = false;
    this.isVideoDragOver = false;
  }

  saveVideo(): void {
    if (this.isNativeMode && !this.hasUploadedVideo) {
      this.snackBar.open('יש להעלות סרטון לפני השמירה', 'סגור', { duration: 3000 });
      return;
    }

    if (this.videoForm.invalid) {
      this.videoForm.markAllAsTouched();
      this.snackBar.open('אנא מלא את כל השדות הנדרשים', 'סגור', { duration: 3000 });
      return;
    }

    const formValue = this.videoForm.value;
    this.isLoading = true;

    let videoData: CreateVideoRequest;

    if (this.isYoutubeMode) {
      videoData = {
        title: formValue.title.trim(),
        source: 'youtube',
        youtubeUrl: formValue.youtubeUrl.trim()
      };
    } else {
      const videoUrl = this.uploadedVideoUrl.trim();
      videoData = {
        title: formValue.title.trim(),
        source: 'cloudinary',
        videoUrl,
        publicId: this.uploadedPublicId || undefined,
        thumbnailUrl: cloudinaryVideoThumbnailFromUrl(videoUrl)
      };
    }

    this.videoService.createVideo(videoData).subscribe({
      next: () => {
        this.snackBar.open('סרטון נוסף בהצלחה', 'סגור', { duration: 3000 });
        this.closeAddForm();
        this.loadVideos();
      },
      error: (error) => {
        console.error('Error creating video:', error);
        const errorMessage = error?.error?.message || error?.error?.error || 'שגיאה בהוספת הסרטון';
        this.snackBar.open(errorMessage, 'סגור', { duration: 5000 });
        this.isLoading = false;
      }
    });
  }

  onVideoFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.uploadVideoFile(file);
    input.value = '';
  }

  onVideoDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (!this.isUploadingVideo) this.isVideoDragOver = true;
  }

  onVideoDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isVideoDragOver = false;
  }

  onVideoDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isVideoDragOver = false;
    if (this.isUploadingVideo) return;
    const file = event.dataTransfer?.files?.[0];
    if (file) this.uploadVideoFile(file);
  }

  private uploadVideoFile(file: File): void {
    const allowed = ['video/mp4', 'video/webm', 'video/quicktime'];
    if (!allowed.includes(file.type)) {
      this.snackBar.open('סוג קובץ לא נתמך. השתמש ב-MP4, WebM או MOV', 'סגור', { duration: 4000 });
      return;
    }

    const maxBytes = 100 * 1024 * 1024;
    if (file.size > maxBytes) {
      this.snackBar.open('הקובץ גדול מדי. גודל מקסימלי: 100MB', 'סגור', { duration: 4000 });
      return;
    }

    this.videoPreviewUrl = URL.createObjectURL(file);
    this.isUploadingVideo = true;

    this.uploadService.uploadVideo(file).subscribe({
      next: (res) => {
        this.isUploadingVideo = false;
        if (res.videoUrl) {
          this.uploadedVideoUrl = res.videoUrl;
          this.uploadedPublicId = res.publicId || '';
          if (this.videoPreviewUrl?.startsWith('blob:')) {
            URL.revokeObjectURL(this.videoPreviewUrl);
          }
          this.videoPreviewUrl = cloudinaryVideoThumbnailFromUrl(res.videoUrl) || res.videoUrl;
        }
      },
      error: (err: { message?: string }) => {
        this.isUploadingVideo = false;
        this.snackBar.open(err?.message || 'שגיאה בהעלאת הסרטון', 'סגור', { duration: 5000 });
        this.removeVideoUpload();
      }
    });
  }

  removeVideoUpload(): void {
    if (this.videoPreviewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(this.videoPreviewUrl);
    }
    this.videoPreviewUrl = null;
    this.uploadedVideoUrl = '';
    this.uploadedPublicId = '';
  }

  deleteVideo(video: Video): void {
    if (!confirm(`האם אתה בטוח שברצונך למחוק את הסרטון "${video.title}"?`)) {
      return;
    }

    const id = video._id || video.id;
    if (!id) {
      this.snackBar.open('שגיאה: לא נמצא מזהה לסרטון', 'סגור', { duration: 3000 });
      return;
    }

    this.isLoading = true;
    this.videoService.deleteVideo(id).subscribe({
      next: () => {
        this.snackBar.open('סרטון נמחק בהצלחה', 'סגור', { duration: 3000 });
        this.loadVideos();
      },
      error: (error) => {
        console.error('Error deleting video:', error);
        this.snackBar.open('שגיאה במחיקת הסרטון', 'סגור', { duration: 3000 });
        this.isLoading = false;
      }
    });
  }

  toggleActive(video: Video): void {
    const id = video._id || video.id;
    if (!id) return;

    this.videoService.updateVideo(id, { isActive: !video.isActive }).subscribe({
      next: () => {
        this.snackBar.open('סטטוס הסרטון עודכן', 'סגור', { duration: 2000 });
        this.loadVideos();
      },
      error: (error) => {
        console.error('Error updating video:', error);
        this.snackBar.open('שגיאה בעדכון הסרטון', 'סגור', { duration: 3000 });
      }
    });
  }

  getSourceLabel(video: Video): string {
    return resolveVideoSource(video) === 'cloudinary' ? 'העלאה' : 'YouTube';
  }

  getVideoLink(video: Video): string {
    if (resolveVideoSource(video) === 'cloudinary') {
      return video.videoUrl || '';
    }
    return video.youtubeUrl || '';
  }

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    if (img) {
      img.src = '/assets/images/placeholder-dish.jpg';
    }
  }
}
