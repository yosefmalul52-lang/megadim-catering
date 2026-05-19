import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { VideoService, Video } from '../../services/video.service';
import { GalleryService, GalleryItem } from '../../services/gallery.service';
import { VideoPlayerModalComponent } from './video-player-modal.component';
import { ImageLightboxModalComponent } from './image-lightbox-modal.component';
import { resolveVideoSource } from '../../utils/video.utils';

export interface UnifiedMediaItem {
  id: string;
  title: string;
  imageUrl: string;
  mediaUrl: string;
  type: 'video' | 'image';
  order: number;
  sourceItem: Video | GalleryItem;
}

@Component({
  selector: 'app-video-section',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  templateUrl: './video-section.component.html',
  styleUrls: ['./video-section.component.scss']
})
export class VideoSectionComponent implements OnInit {
  private videoService = inject(VideoService);
  private galleryService = inject(GalleryService);
  private dialog = inject(MatDialog);

  mediaItems: UnifiedMediaItem[] = [];
  isLoading = false;

  ngOnInit(): void {
    this.loadMediaItems();
  }

  loadMediaItems(): void {
    this.isLoading = true;

    forkJoin({
      videos: this.videoService.getVideos(true).pipe(catchError(() => of([] as Video[]))),
      galleryImages: this.galleryService
        .getGalleryItems('image', true)
        .pipe(catchError(() => of([] as GalleryItem[])))
    }).subscribe({
      next: ({ videos, galleryImages }) => {
        this.mediaItems = this.mergeAndSortMedia(videos, galleryImages);
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading media items:', error);
        this.mediaItems = [];
        this.isLoading = false;
      }
    });
  }

  private mergeAndSortMedia(videos: Video[], galleryImages: GalleryItem[]): UnifiedMediaItem[] {
    const videoItems = this.sortByOrder(videos).map((v) => this.mapVideoToUnified(v));
    const imageItems = this.sortByOrder(
      galleryImages.filter((g) => g.type === 'image' && !!g.url?.trim())
    ).map((g) => this.mapGalleryToUnified(g));
    return [...videoItems, ...imageItems];
  }

  private sortByOrder<T extends { order?: number }>(items: T[]): T[] {
    return [...items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  private mapVideoToUnified(video: Video): UnifiedMediaItem {
    const id = video._id || video.id || '';
    return {
      id: `video-${id}`,
      title: video.title || '',
      imageUrl: video.thumbnailUrl,
      mediaUrl: video.videoUrl || video.youtubeUrl || '',
      type: 'video',
      order: video.order ?? 0,
      sourceItem: video
    };
  }

  private mapGalleryToUnified(item: GalleryItem): UnifiedMediaItem {
    const id = item._id || item.id || '';
    return {
      id: `gallery-${id}`,
      title: item.title || '',
      imageUrl: item.url,
      mediaUrl: item.url,
      type: 'image',
      order: item.order ?? 0,
      sourceItem: item
    };
  }

  onMediaClick(item: UnifiedMediaItem): void {
    if (item.type === 'video') {
      this.openVideoModal(item.sourceItem as Video);
    } else {
      this.openImageLightbox(item);
    }
  }

  private openVideoModal(video: Video): void {
    const source = resolveVideoSource(video);
    this.dialog.open(VideoPlayerModalComponent, {
      width: '90%',
      maxWidth: '900px',
      data: {
        title: video.title,
        source,
        videoId: video.videoId,
        videoUrl: video.videoUrl
      }
    });
  }

  private openImageLightbox(item: UnifiedMediaItem): void {
    this.dialog.open(ImageLightboxModalComponent, {
      width: '90%',
      maxWidth: '1000px',
      data: {
        title: item.title || undefined,
        imageUrl: item.imageUrl
      },
      panelClass: 'image-lightbox-panel'
    });
  }

  trackByMediaId(_index: number, item: UnifiedMediaItem): string {
    return item.id;
  }

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    if (img) {
      img.src = '/assets/images/placeholder-dish.jpg';
    }
  }
}
