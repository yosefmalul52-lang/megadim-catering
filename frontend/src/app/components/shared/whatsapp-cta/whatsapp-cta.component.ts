import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  buildWhatsAppHref,
  CONTACT_WHATSAPP_HREF,
  WHATSAPP_DEFAULT_MESSAGE,
} from '../../../constants/contact.constants';
import { TrackingService } from '../../../services/tracking.service';
import { SiteSettingsService } from '../../../services/site-settings.service';

export type WhatsappCtaVariant = 'fab' | 'sticky';

@Component({
  selector: 'app-whatsapp-cta',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (variant === 'fab') {
      <a
        [href]="href"
        target="_blank"
        rel="noopener noreferrer"
        class="wa-cta wa-cta--fab"
        aria-label="צרו קשר בוואטסאפ"
        (click)="onClick($event)"
      >
        <i class="fa-brands fa-whatsapp" aria-hidden="true"></i>
      </a>
    }

    @if (variant === 'sticky') {
      <div class="wa-cta-bar" role="region" aria-label="הזמנה מהירה">
        <a
          [href]="href"
          target="_blank"
          rel="noopener noreferrer"
          class="wa-cta wa-cta--sticky"
          (click)="onClick($event)"
        >
          <i class="fa-brands fa-whatsapp" aria-hidden="true"></i>
          {{ label }}
        </a>
      </div>
    }
  `,
  styles: [`
    .wa-cta--fab {
      position: fixed;
      left: 20px;
      bottom: 20px;
      z-index: 9999;
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background-color: #25D366;
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 32px;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
      text-decoration: none;
      transition: transform 0.2s ease, box-shadow 0.2s ease;

      &:hover {
        color: #fff;
        transform: scale(1.08);
        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25);
      }

      &:focus-visible {
        outline: 2px solid #25D366;
        outline-offset: 3px;
      }
    }

    .wa-cta-bar {
      position: fixed;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 9998;
      padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
      background: #fff;
      border-top: 1px solid #e8e8e8;
      box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.08);
    }

    .wa-cta--sticky {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      width: 100%;
      max-width: 480px;
      margin: 0 auto;
      padding: 14px 20px;
      background: #25D366;
      color: #fff;
      font-family: 'Heebo', sans-serif;
      font-size: 1.05rem;
      font-weight: 700;
      border-radius: 8px;
      text-decoration: none;
      transition: background 0.2s ease;

      i {
        font-size: 1.4rem;
      }

      &:hover {
        color: #fff;
        background: #20bd5a;
      }

      &:focus-visible {
        outline: 2px solid #1f3540;
        outline-offset: 2px;
      }
    }
  `],
})
export class WhatsappCtaComponent {
  @Input() variant: WhatsappCtaVariant = 'fab';
  @Input() ctaLocation = 'whatsapp_cta';
  @Input() label = 'להזמנה מהירה בוואטסאפ';
  @Input() message = WHATSAPP_DEFAULT_MESSAGE;

  private readonly trackingService = inject(TrackingService);
  private readonly settingsService = inject(SiteSettingsService);

  get href(): string {
    const base =
      this.settingsService.getCurrentSettings()?.whatsappLink?.trim() ||
      CONTACT_WHATSAPP_HREF;
    return buildWhatsAppHref(base, this.message);
  }

  onClick(_event: MouseEvent): void {
    this.trackingService.trackWhatsAppClick(this.ctaLocation, this.label);
  }
}
