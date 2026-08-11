import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTabsModule } from '@angular/material/tabs';
import { GalleryManagementComponent } from '../gallery-management/gallery-management.component';
import { VideoGalleryComponent } from '../video-gallery/video-gallery.component';

@Component({
  selector: 'app-unified-gallery',
  standalone: true,
  imports: [
    CommonModule,
    MatTabsModule,
    GalleryManagementComponent,
    VideoGalleryComponent
  ],
  template: `
    <div class="unified-gallery">
      <mat-tab-group>
        <mat-tab label="תמונות">
          <div class="tab-content">
            <app-gallery-management></app-gallery-management>
          </div>
        </mat-tab>
        <mat-tab label="סרטונים">
          <div class="tab-content">
            <app-video-gallery></app-video-gallery>
          </div>
        </mat-tab>
      </mat-tab-group>
    </div>
  `,
  styles: [`
    .unified-gallery {
      width: 100%;
      max-width: 1400px;
      margin-inline: auto;
      direction: rtl;
      font-family: 'Assistant', 'Heebo', sans-serif;
      color: #1F2D3D;
    }

    .tab-content {
      padding: 0.5rem 0 0;
    }

    ::ng-deep .mat-mdc-tab-group {
      direction: rtl;
    }

    ::ng-deep .mat-mdc-tab-labels {
      direction: rtl;
      border-bottom: 1px solid #E2E8F0;
    }

    ::ng-deep .mat-mdc-tab-label,
    ::ng-deep .mdc-tab {
      min-width: 110px;
      min-height: 40px;
      font-weight: 600;
      color: #526273 !important;
    }

    ::ng-deep .mat-mdc-tab .mdc-tab-indicator__content--underline {
      border-color: #77A9D8 !important;
    }

    ::ng-deep .mat-mdc-tab-label-active,
    ::ng-deep .mdc-tab--active .mdc-tab__text-label {
      color: #1F2D3D !important;
    }
  `]
})
export class UnifiedGalleryComponent {}

