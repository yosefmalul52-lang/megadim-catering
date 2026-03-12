import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { SiteSettingsService, SiteSettings } from '../../../services/site-settings.service';
import { CONTACT_PHONE_DISPLAY, CONTACT_TEL_HREF, CONTACT_WHATSAPP_HREF } from '../../../constants/contact.constants';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [CommonModule, RouterModule, MatIconModule, MatButtonModule],
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.scss']
})
export class FooterComponent implements OnInit {
  settingsService = inject(SiteSettingsService);
  currentYear = new Date().getFullYear();
  
  settings: SiteSettings | null = null;

  ngOnInit(): void {
    // Fetch site settings
    this.settingsService.getSettings().subscribe(settings => {
      this.settings = settings;
    });
  }

  get contactPhone(): string {
    const p = this.settings?.contactPhone;
    if (!p) return CONTACT_PHONE_DISPLAY;
    if (p.replace(/\D/g, '') === '0528240230') return CONTACT_PHONE_DISPLAY;
    return p;
  }

  /** tel: href for click-to-call. */
  get contactTelHref(): string {
    const p = this.settings?.contactPhone;
    if (!p) return CONTACT_TEL_HREF;
    const digits = p.replace(/\D/g, '');
    if (digits === '0528240230') return CONTACT_TEL_HREF;
    const e164 = digits.startsWith('0') ? '972' + digits.slice(1) : digits.startsWith('972') ? digits : '972' + digits;
    return 'tel:+' + e164;
  }

  get whatsappLink(): string {
    if (this.settings?.whatsappLink) {
      return this.settings.whatsappLink;
    }
    return CONTACT_WHATSAPP_HREF;
  }
}
