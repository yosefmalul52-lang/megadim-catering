import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { ContactService } from '../../../services/contact.service';
import { SiteSettingsService, SiteSettings } from '../../../services/site-settings.service';
import { PageBannerComponent } from '../../shared/page-banner/page-banner.component';
import { PagePopupComponent } from '../../shared/page-popup/page-popup.component';

@Component({
  selector: 'app-events-catering',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, PageBannerComponent, PagePopupComponent],
  templateUrl: './events-catering.component.html',
  styleUrls: ['./events-catering.component.scss']
})
export class EventsCateringComponent implements OnInit {
  contactService = inject(ContactService);
  settingsService = inject(SiteSettingsService);
  
  settings: SiteSettings | null = null;
  showPopup = false;

  ngOnInit(): void {
    this.settingsService.getSettings(true).subscribe(settings => {
      this.settings = settings;
      const ev = settings?.pageAnnouncements?.['events'];
      if ((ev?.popupTitle?.trim() ?? '') !== '' || (ev?.popupText?.trim() ?? '') !== '') {
        this.showPopup = true;
      }
    });
  }

  closePopup(): void {
    this.showPopup = false;
  }

  get eventsMenuUrl(): string {
    return this.settings?.eventsMenuUrl || '';
  }

  hasMenuUrl(): boolean {
    return !!this.eventsMenuUrl && this.eventsMenuUrl.trim() !== '';
  }
}
