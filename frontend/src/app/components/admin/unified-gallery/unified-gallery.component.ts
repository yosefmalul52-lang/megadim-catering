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
      direction: rtl;
    }

    .tab-content {
      padding: 1rem 0;
    }

    ::ng-deep .mat-mdc-tab-group {
      direction: rtl;
    }

    ::ng-deep .mat-mdc-tab-labels {
      direction: rtl;
    }

    ::ng-deep .mat-mdc-tab-label {
      min-width: 120px;
    }
  `]
})
export class UnifiedGalleryComponent {}

