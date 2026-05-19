import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { VideoSource } from '../../utils/video.utils';

export interface VideoPlayerModalData {
  title?: string;
  source: VideoSource;
  videoId?: string;
  videoUrl?: string;
}

@Component({
  selector: 'app-video-player-modal',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <div class="video-modal">
      <div class="modal-header">
        <h2 *ngIf="data.title">{{ data.title }}</h2>
        <button mat-icon-button (click)="close()" class="close-btn" type="button">
          <mat-icon>close</mat-icon>
        </button>
      </div>
      <div class="modal-content">
        <iframe
          *ngIf="isYoutube"
          [src]="safeVideoUrl"
          frameborder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowfullscreen
          class="video-iframe"
        ></iframe>
        <video
          *ngIf="!isYoutube && data.videoUrl"
          controls
          autoplay
          playsinline
          [src]="data.videoUrl"
          class="video-native"
        ></video>
        <div *ngIf="!isYoutube && !data.videoUrl" class="playback-error">
          <mat-icon>error_outline</mat-icon>
          <p>לא ניתן להפעיל את הסרטון. כתובת הווידאו חסרה.</p>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .video-modal {
        direction: rtl;
      }

      .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1rem;
        border-bottom: 1px solid #e0e0e0;
      }

      .modal-header h2 {
        margin: 0;
        color: #1f3540;
        font-size: 1.5rem;
      }

      .close-btn {
        color: #6b7280;
      }

      .modal-content {
        padding: 0;
        background: #000;
      }

      .video-iframe,
      .video-native {
        width: 100%;
        max-height: 80vh;
        display: block;
      }

      .video-iframe {
        height: 500px;
        border: none;
      }

      .video-native {
        height: auto;
        min-height: 280px;
        background: #000;
      }

      .playback-error {
        color: #fff;
        text-align: center;
        padding: 3rem 1.5rem;

        mat-icon {
          font-size: 48px;
          width: 48px;
          height: 48px;
          margin-bottom: 0.5rem;
        }
      }

      @media (max-width: 768px) {
        .video-iframe {
          height: 300px;
        }
      }
    `
  ]
})
export class VideoPlayerModalComponent implements OnInit {
  safeVideoUrl!: SafeResourceUrl;
  isYoutube = true;

  constructor(
    public dialogRef: MatDialogRef<VideoPlayerModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: VideoPlayerModalData,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit(): void {
    this.isYoutube = this.data.source === 'youtube';

    if (this.isYoutube && this.data.videoId) {
      const embedUrl = `https://www.youtube.com/embed/${this.data.videoId}?autoplay=1&rel=0`;
      this.safeVideoUrl = this.sanitizer.bypassSecurityTrustResourceUrl(embedUrl);
    }
  }

  close(): void {
    this.dialogRef.close();
  }
}
