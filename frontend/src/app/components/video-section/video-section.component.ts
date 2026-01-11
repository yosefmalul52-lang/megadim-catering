import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { VideoService, Video } from '../../services/video.service';
import { VideoPlayerModalComponent } from './video-player-modal.component';

@Component({
  selector: 'app-video-section',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule, VideoPlayerModalComponent],
  templateUrl: './video-section.component.html',
  styleUrls: ['./video-section.component.scss']
})
export class VideoSectionComponent implements OnInit {
  videoService = inject(VideoService);
  dialog = inject(MatDialog);

  videos: Video[] = [];
  isLoading = false;

  ngOnInit(): void {
    this.loadVideos();
  }

  loadVideos(): void {
    this.isLoading = true;
    this.videoService.getVideos(true).subscribe({
      next: (videos) => {
        this.videos = videos;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading videos:', error);
        this.isLoading = false;
      }
    });
  }

  openVideoModal(video: Video): void {
    this.dialog.open(VideoPlayerModalComponent, {
      width: '90%',
      maxWidth: '900px',
      data: { 
        videoId: video.videoId, 
        title: video.title 
      }
    });
  }

  trackByVideoId(index: number, video: Video): string {
    return video._id || video.id || index.toString();
  }

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    if (img) {
      img.src = '/assets/images/placeholder-dish.jpg';
    }
  }
}

