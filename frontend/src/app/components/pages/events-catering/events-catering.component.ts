import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { ContactService } from '../../../services/contact.service';
import { SiteSettingsService, SiteSettings } from '../../../services/site-settings.service';

@Component({
  selector: 'app-events-catering',
  standalone: true,
  imports: [CommonModule, RouterLink, MatIconModule, MatButtonModule],
  templateUrl: './events-catering.component.html',
  styleUrls: ['./events-catering.component.scss']
})
export class EventsCateringComponent implements OnInit {
  contactService = inject(ContactService);
  settingsService = inject(SiteSettingsService);
  
  settings: SiteSettings | null = null;

  ngOnInit(): void {
    // Fetch site settings
    this.settingsService.getSettings().subscribe(settings => {
      this.settings = settings;
    });
  }

  get eventsMenuUrl(): string {
    return this.settings?.eventsMenuUrl || '';
  }

  hasMenuUrl(): boolean {
    return !!this.eventsMenuUrl && this.eventsMenuUrl.trim() !== '';
  }
}
