import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { SiteSettingsService, SiteSettings } from '../../../services/site-settings.service';

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
    return this.settings?.contactPhone || '052-8240230';
  }

  get whatsappLink(): string {
    if (this.settings?.whatsappLink) {
      return this.settings.whatsappLink;
    }
    // Fallback: Generate WhatsApp link from phone number
    const phoneDigits = this.contactPhone.replace(/[^0-9]/g, '');
    // Remove leading 0 and add country code
    const phoneNumber = phoneDigits.startsWith('0') ? phoneDigits.substring(1) : phoneDigits;
    return `https://wa.me/972${phoneNumber}`;
  }
}
