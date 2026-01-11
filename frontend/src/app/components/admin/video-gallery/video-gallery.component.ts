import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatCardModule } from '@angular/material/card';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { VideoService, Video, CreateVideoRequest } from '../../../services/video.service';

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
  snackBar = inject(MatSnackBar);
  fb = inject(FormBuilder);

  videos: Video[] = [];
  isLoading = false;
  showAddForm = false;

  videoForm: FormGroup = this.fb.group({
    title: ['', Validators.required],
    youtubeUrl: ['', [Validators.required, Validators.pattern(/^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/)]]
  });

  ngOnInit(): void {
    this.loadVideos();
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

  openAddForm(): void {
    this.showAddForm = true;
    this.videoForm.reset();
  }

  closeAddForm(): void {
    this.showAddForm = false;
    this.videoForm.reset();
  }

  saveVideo(): void {
    if (this.videoForm.invalid) {
      this.snackBar.open('אנא מלא את כל השדות הנדרשים', 'סגור', { duration: 3000 });
      return;
    }

    const formValue = this.videoForm.value;
    this.isLoading = true;

    const videoData: CreateVideoRequest = {
      title: formValue.title.trim(),
      youtubeUrl: formValue.youtubeUrl.trim()
    };

    this.videoService.createVideo(videoData).subscribe({
      next: () => {
        this.snackBar.open('סרטון נוסף בהצלחה', 'סגור', { duration: 3000 });
        this.closeAddForm();
        this.loadVideos();
      },
      error: (error) => {
        console.error('Error creating video:', error);
        const errorMessage = error?.error?.message || 'שגיאה בהוספת הסרטון';
        this.snackBar.open(errorMessage, 'סגור', { duration: 3000 });
        this.isLoading = false;
      }
    });
  }

  deleteVideo(video: Video): void {
    if (!confirm(`האם אתה בטוח שברצונך למחוק את הסרטון "${video.title}"?`)) {
      return;
    }

    const videoId = video._id || video.id;
    if (!videoId) {
      this.snackBar.open('שגיאה: לא נמצא מזהה לסרטון', 'סגור', { duration: 3000 });
      return;
    }

    this.isLoading = true;
    this.videoService.deleteVideo(videoId).subscribe({
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
    const videoId = video._id || video.id;
    if (!videoId) return;

    const updates = { isActive: !video.isActive };
    this.videoService.updateVideo(videoId, updates).subscribe({
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

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    if (img) {
      img.src = '/assets/images/placeholder-dish.jpg';
    }
  }
}

