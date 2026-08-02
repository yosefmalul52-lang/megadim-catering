import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { forkJoin } from 'rxjs';
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
  sourceItem: Video | GalleryItem | null;
}

const GENERIC_TITLES = new Set(['אירוע מגדים', 'megadim event']);

@Component({
  selector: 'app-video-section',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatIconModule],
  templateUrl: './video-section.component.html',
  styleUrls: ['./video-section.component.scss']
})
export class VideoSectionComponent implements OnInit {
  private videoService = inject(VideoService);
  private galleryService = inject(GalleryService);
  private dialog = inject(MatDialog);

  private readonly minDisplayCount = 10;

  private readonly showcaseFillers: UnifiedMediaItem[] = [
    {
      id: 'showcase-1',
      title: '',
      imageUrl: 'https://megadim-media.megadim.workers.dev/frontend/static/a48c81160b703307/original.jpg',
      mediaUrl: 'https://megadim-media.megadim.workers.dev/frontend/static/a48c81160b703307/original.jpg',
      type: 'image',
      order: 100,
      sourceItem: null,
    },
    {
      id: 'showcase-2',
      title: '',
      imageUrl: 'https://megadim-media.megadim.workers.dev/frontend/static/c3bad83038c1d880/original.jpg',
      mediaUrl: 'https://megadim-media.megadim.workers.dev/frontend/static/c3bad83038c1d880/original.jpg',
      type: 'image',
      order: 101,
      sourceItem: null,
    },
    {
      id: 'showcase-3',
      title: '',
      imageUrl: 'https://megadim-media.megadim.workers.dev/frontend/static/5062f9450f4064c0/original.jpg',
      mediaUrl: 'https://megadim-media.megadim.workers.dev/frontend/static/5062f9450f4064c0/original.jpg',
      type: 'image',
      order: 102,
      sourceItem: null,
    },
    {
      id: 'showcase-4',
      title: '',
      imageUrl: 'https://megadim-media.megadim.workers.dev/frontend/static/47e00b409d8842db/original.jpg',
      mediaUrl: 'https://megadim-media.megadim.workers.dev/frontend/static/47e00b409d8842db/original.jpg',
      type: 'image',
      order: 103,
      sourceItem: null,
    },
    {
      id: 'showcase-5',
      title: '',
      imageUrl: 'https://megadim-media.megadim.workers.dev/frontend/static/370fefc6263ad915/original.jpg',
      mediaUrl: 'https://megadim-media.megadim.workers.dev/frontend/static/370fefc6263ad915/original.jpg',
      type: 'image',
      order: 104,
      sourceItem: null,
    },
    {
      id: 'showcase-6',
      title: '',
      imageUrl: 'https://megadim-media.megadim.workers.dev/frontend/static/8b229cb94fc3112c/original.jpg',
      mediaUrl: 'https://megadim-media.megadim.workers.dev/frontend/static/8b229cb94fc3112c/original.jpg',
      type: 'image',
      order: 105,
      sourceItem: null,
    },
    {
      id: 'showcase-7',
      title: '',
      imageUrl: 'https://megadim-media.megadim.workers.dev/frontend/static/e1e10a399b476b78/original.jpg',
      mediaUrl: 'https://megadim-media.megadim.workers.dev/frontend/static/e1e10a399b476b78/original.jpg',
      type: 'image',
      order: 106,
      sourceItem: null,
    },
    {
      id: 'showcase-8',
      title: '',
      imageUrl: 'https://megadim-media.megadim.workers.dev/frontend/static/66b9922b9c941dc1/original.jpg',
      mediaUrl: 'https://megadim-media.megadim.workers.dev/frontend/static/66b9922b9c941dc1/original.jpg',
      type: 'image',
      order: 107,
      sourceItem: null,
    },
    {
      id: 'showcase-9',
      title: '',
      imageUrl: 'https://megadim-media.megadim.workers.dev/frontend/static/6209b50fb092c8b5/original.jpg',
      mediaUrl: 'https://megadim-media.megadim.workers.dev/frontend/static/6209b50fb092c8b5/original.jpg',
      type: 'image',
      order: 108,
      sourceItem: null,
    },
    {
      id: 'showcase-10',
      title: '',
      imageUrl: 'https://megadim-media.megadim.workers.dev/frontend/static/a9c861c5232b469b/original.jpg',
      mediaUrl: 'https://megadim-media.megadim.workers.dev/frontend/static/a9c861c5232b469b/original.jpg',
      type: 'image',
      order: 109,
      sourceItem: null,
    },
  ];

  mediaItems: UnifiedMediaItem[] = [];
  isLoading = false;

  ngOnInit(): void {
    this.loadMediaItems();
  }

  loadMediaItems(): void {
    this.isLoading = true;

    forkJoin({
      videos: this.videoService.getVideos(true),
      galleryImages: this.galleryService.getGalleryItems('image', true),
    }).subscribe({
      next: ({ videos, galleryImages }) => {
        this.mediaItems = this.buildDisplayItems(videos, galleryImages);
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading media items:', error);
        this.isLoading = false;
      },
    });
  }

  private buildDisplayItems(videos: Video[], galleryImages: GalleryItem[]): UnifiedMediaItem[] {
    const fromApi = this.mergeAndSortMedia(videos, galleryImages);
    const padded = this.padWithShowcase(fromApi).map((item) => ({
      ...item,
      title: this.sanitizeTitle(item.title),
    }));
    return this.arrangeForGalleryLayout(padded);
  }

  private arrangeForGalleryLayout(items: UnifiedMediaItem[]): UnifiedMediaItem[] {
    if (items.length < 10) return items;

    const videos = items.filter((item) => item.type === 'video');
    const largePrimary = videos[0] ?? items[0];
    const largeSecondary =
      videos[1] ??
      items.find((item) => item.id !== largePrimary.id) ??
      largePrimary;
    const used = new Set([largePrimary.id, largeSecondary.id]);
    const smallSlots = items.filter((item) => !used.has(item.id)).slice(0, 8);

    return [
      largePrimary,
      ...smallSlots.slice(0, 4),
      largeSecondary,
      ...smallSlots.slice(4, 8),
    ];
  }

  private mergeAndSortMedia(videos: Video[], galleryImages: GalleryItem[]): UnifiedMediaItem[] {
    const videoItems = this.sortByOrder(videos).map((v) => this.mapVideoToUnified(v));
    const imageItems = this.sortByOrder(
      galleryImages.filter((g) => g.type === 'image' && !!g.url?.trim())
    ).map((g) => this.mapGalleryToUnified(g));
    return [...videoItems, ...imageItems];
  }

  private padWithShowcase(items: UnifiedMediaItem[]): UnifiedMediaItem[] {
    const usedUrls = new Set(items.map((i) => i.imageUrl));
    const result = [...items];

    for (const filler of this.showcaseFillers) {
      if (result.length >= this.minDisplayCount) break;
      if (usedUrls.has(filler.imageUrl)) continue;
      usedUrls.add(filler.imageUrl);
      result.push({ ...filler, id: `${filler.id}-${result.length}` });
    }

    return result.slice(0, this.minDisplayCount);
  }

  private sanitizeTitle(title: string): string {
    const trimmed = title?.trim() ?? '';
    if (!trimmed) return '';
    if (GENERIC_TITLES.has(trimmed.toLowerCase())) return '';
    return trimmed;
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
      sourceItem: video,
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
      sourceItem: item,
    };
  }

  onMediaClick(item: UnifiedMediaItem): void {
    if (item.type === 'video' && item.sourceItem) {
      this.openVideoModal(item.sourceItem as Video);
      return;
    }
    this.openImageLightbox(item);
  }

  private openVideoModal(video: Video): void {
    const source = resolveVideoSource(video);
    this.dialog.open(VideoPlayerModalComponent, {
      width: '90%',
      maxWidth: '900px',
      data: {
        title: this.sanitizeTitle(video.title || ''),
        source,
        videoId: video.videoId,
        videoUrl: video.videoUrl,
      },
    });
  }

  private openImageLightbox(item: UnifiedMediaItem): void {
    const title = this.sanitizeTitle(item.title);
    this.dialog.open(ImageLightboxModalComponent, {
      width: '90%',
      maxWidth: '1000px',
      data: {
        title: title || undefined,
        imageUrl: item.imageUrl,
      },
      panelClass: 'image-lightbox-panel',
    });
  }

  trackByMediaId(_index: number, item: UnifiedMediaItem): string {
    return item.id;
  }

  getTypeLabel(item: UnifiedMediaItem): string {
    return item.type === 'video' ? 'סרטון' : 'תמונה';
  }

  getAriaLabel(item: UnifiedMediaItem): string {
    const kind = item.type === 'video' ? 'הפעלת סרטון' : 'הגדלת תמונה';
    const title = this.sanitizeTitle(item.title);
    return title ? `${kind}: ${title}` : kind;
  }

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    if (img) {
      img.src = '/assets/images/placeholder-dish.jpg';
    }
  }
}
