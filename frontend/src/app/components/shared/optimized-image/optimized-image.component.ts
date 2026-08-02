import { Component, Input, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-optimized-image',
  standalone: true,
  templateUrl: './optimized-image.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OptimizedImageComponent {
  /** Full image URL (R2/workers.dev or absolute https). Legacy relative IDs fall back to placeholder. */
  @Input() publicId!: string;

  /** Accessible alt text for the image */
  @Input() altText: string = '';

  /** Optional CSS class(es) applied to the img element */
  @Input() cssClass: string = '';

  get defaultSrc(): string {
    return this.resolvedSrc;
  }

  get srcSet(): string {
    // R2 serves originals; no CDN width transforms — single URL is enough.
    return '';
  }

  private get resolvedSrc(): string {
    const id = (this.publicId || '').trim();
    if (!id) return '';
    if (id.startsWith('http://') || id.startsWith('https://') || id.startsWith('/') || id.startsWith('assets')) {
      return id;
    }
    return '/assets/images/placeholder-dish.jpg';
  }
}
