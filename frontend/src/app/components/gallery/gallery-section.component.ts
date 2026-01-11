import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { GalleryService, GalleryItem } from '../../services/gallery.service';
import { VideoModalComponent } from './video-modal.component';

@Component({
  selector: 'app-gallery-section',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  templateUrl: './gallery-section.component.html',
  styleUrls: ['./gallery-section.component.scss']
})
export class GallerySectionComponent implements OnInit {
  galleryService = inject(GalleryService);
  dialog = inject(MatDialog);

  galleryItems: GalleryItem[] = [];
  isLoading = false;

  ngOnInit(): void {
    this.loadGalleryItems();
  }

  loadGalleryItems(): void {
    this.isLoading = true;
    this.galleryService.getGalleryItems(undefined, true).subscribe({
      next: (items) => {
        this.galleryItems = items;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading gallery items:', error);
        this.isLoading = false;
      }
    });
  }

  openVideoModal(item: GalleryItem): void {
    const videoId = this.galleryService.extractYouTubeId(item.url);
    if (videoId) {
      this.dialog.open(VideoModalComponent, {
        width: '90%',
        maxWidth: '900px',
        data: { videoId, title: item.title }
      });
    }
  }

  getVideoEmbedUrl(url: string): string {
    const videoId = this.galleryService.extractYouTubeId(url);
    if (videoId) {
      return `https://www.youtube.com/embed/${videoId}`;
    }
    return url;
  }

  trackByItemId(index: number, item: GalleryItem): string {
    return item._id || item.id || index.toString();
  }
}

