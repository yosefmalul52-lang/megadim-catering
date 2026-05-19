import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

export interface ImageLightboxData {
  title?: string;
  imageUrl: string;
}

@Component({
  selector: 'app-image-lightbox-modal',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <div class="image-lightbox" dir="rtl">
      <div class="modal-header" *ngIf="data.title">
        <h2>{{ data.title }}</h2>
        <button mat-icon-button type="button" (click)="close()" aria-label="סגור">
          <mat-icon>close</mat-icon>
        </button>
      </div>
      <div class="modal-header minimal" *ngIf="!data.title">
        <button mat-icon-button type="button" (click)="close()" aria-label="סגור" class="close-only">
          <mat-icon>close</mat-icon>
        </button>
      </div>
      <div class="modal-content">
        <img [src]="data.imageUrl" [alt]="data.title || 'תמונת גלריה'" />
      </div>
    </div>
  `,
  styles: [
    `
      .image-lightbox {
        direction: rtl;
        max-width: 95vw;
      }

      .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.75rem 1rem;
        border-bottom: 1px solid #e5e7eb;

        &.minimal {
          justify-content: flex-end;
          border-bottom: none;
        }

        h2 {
          margin: 0;
          font-size: 1.25rem;
          color: #1f3540;
        }
      }

      .modal-content {
        padding: 0;
        background: #000;
        line-height: 0;

        img {
          display: block;
          max-width: 100%;
          max-height: 80vh;
          width: auto;
          height: auto;
          margin: 0 auto;
          object-fit: contain;
        }
      }
    `
  ]
})
export class ImageLightboxModalComponent {
  constructor(
    public dialogRef: MatDialogRef<ImageLightboxModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ImageLightboxData
  ) {}

  close(): void {
    this.dialogRef.close();
  }
}
