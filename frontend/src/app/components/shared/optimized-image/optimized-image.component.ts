import { Component, Input, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-optimized-image',
  standalone: true,
  templateUrl: './optimized-image.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OptimizedImageComponent {
  /** Cloudinary configuration */
  private readonly cloudName = 'dioklg7lx';
  private readonly baseUrl = `https://res.cloudinary.com/${this.cloudName}/image/upload`;

  /** Cloudinary public ID or path (without the base URL) */
  @Input() publicId!: string;

  /** Accessible alt text for the image */
  @Input() altText: string = '';

  /** Optional CSS class(es) applied to the img element */
  @Input() cssClass: string = '';

  /**
   * Default src (used as fallback and for browsers that ignore srcset).
   * Uses the tablet/medium size (800px) as a good balance of quality and weight.
   */
  get defaultSrc(): string {
    return this.buildUrl('w_800,f_auto,q_auto');
  }

  /**
   * Responsive srcset with three standard widths for mobile, tablet, and desktop.
   */
  get srcSet(): string {
    const id = this.normalizedPublicId;
    if (!id) {
      return '';
    }

    const variants = [
      { width: 400, transform: 'w_400,f_auto,q_auto' },
      { width: 800, transform: 'w_800,f_auto,q_auto' },
      { width: 1200, transform: 'w_1200,f_auto,q_auto' }
    ];

    return variants
      .map(v => `${this.baseUrl}/${v.transform}/${id} ${v.width}w`)
      .join(', ');
  }

  /**
   * Normalize the publicId to avoid leading slashes.
   */
  private get normalizedPublicId(): string {
    return (this.publicId || '').replace(/^\/+/, '');
  }

  private buildUrl(transform: string): string {
    const id = this.normalizedPublicId;
    if (!id) {
      return '';
    }
    return `${this.baseUrl}/${transform}/${id}`;
  }
}

