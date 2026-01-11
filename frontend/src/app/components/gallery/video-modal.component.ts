import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-video-modal',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <div class="video-modal">
      <div class="modal-header">
        <h2 *ngIf="data.title">{{ data.title }}</h2>
        <button mat-icon-button (click)="close()" class="close-btn">
          <mat-icon>close</mat-icon>
        </button>
      </div>
      <div class="modal-content">
        <iframe
          [src]="safeVideoUrl"
          frameborder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowfullscreen
          class="video-iframe">
        </iframe>
      </div>
    </div>
  `,
  styles: [`
    .video-modal {
      direction: rtl;
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem;
      border-bottom: 1px solid #e0e0e0;

      h2 {
        margin: 0;
        color: #1f3540;
        font-size: 1.5rem;
      }

      .close-btn {
        color: #6b7280;
      }
    }

    .modal-content {
      position: relative;
      padding: 0;
      background: #000;

      .video-iframe {
        width: 100%;
        height: 500px;
        display: block;
      }
    }

    @media (max-width: 768px) {
      .modal-content {
        .video-iframe {
          height: 300px;
        }
      }
    }
  `]
})
export class VideoModalComponent implements OnInit {
  safeVideoUrl!: SafeResourceUrl;

  constructor(
    public dialogRef: MatDialogRef<VideoModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { videoId: string; title?: string },
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit(): void {
    const embedUrl = `https://www.youtube.com/embed/${this.data.videoId}?autoplay=1`;
    this.safeVideoUrl = this.sanitizer.bypassSecurityTrustResourceUrl(embedUrl);
  }

  close(): void {
    this.dialogRef.close();
  }
}

