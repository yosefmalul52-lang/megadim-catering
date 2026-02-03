import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { RouterModule } from '@angular/router';
import { SiteSettingsService, SiteSettings } from '../../../../services/site-settings.service';

@Component({
  selector: 'app-shabbat-menu',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    RouterModule
  ],
  templateUrl: './shabbat-menu.component.html',
  styleUrls: ['./shabbat-menu.component.scss']
})
export class ShabbatMenuComponent implements OnInit {
  translateService = inject(TranslateService);
  settingsService = inject(SiteSettingsService);
  
  settings: SiteSettings | null = null;
  shabbatMenuPdfUrl: string = '';
  
  // All categories with their metadata
  categories = [
    { 
      id: 'salads', 
      nameKey: 'CATEGORIES.SALADS', 
      title: 'סלטים',
      image: 'https://res.cloudinary.com/dioklg7lx/image/upload/v1768906611/IMG_9750_v7mval.jpg'
    },
    { 
      id: 'fish', 
      nameKey: 'CATEGORIES.FISH', 
      title: 'דגים',
      image: 'https://res.cloudinary.com/dioklg7lx/image/upload/v1768906613/IMG_9721_rrsv3d.jpg'
    },
    { 
      id: 'main', 
      nameKey: 'CATEGORIES.MAIN', 
      title: 'מנות עיקריות',
      image: 'https://res.cloudinary.com/dioklg7lx/image/upload/v1768906615/IMG_9690_u75cnk.jpg'
    },
    { 
      id: 'sides', 
      nameKey: 'CATEGORIES.SIDES', 
      title: 'תוספות',
      image: 'https://res.cloudinary.com/dioklg7lx/image/upload/v1768906621/IMG_9702_f9k2xj.jpg'
    },
    { 
      id: 'desserts', 
      nameKey: 'CATEGORIES.DESSERTS', 
      title: 'קינוחים',
      image: 'https://res.cloudinary.com/dioklg7lx/image/upload/v1768914768/IMG_9679_ad0nxy.jpg'
    },
    { 
      id: 'stuffed', 
      nameKey: 'CATEGORIES.STUFFED', 
      title: 'ממולאים',
      image: 'https://res.cloudinary.com/dioklg7lx/image/upload/v1768914767/IMG_9678_sfg0bj.jpg'
    }
  ];

  ngOnInit(): void {
    // Fetch site settings
    this.settingsService.getSettings().subscribe(s => {
      if (s && s.shabbatMenuUrl) {
        this.shabbatMenuPdfUrl = s.shabbatMenuUrl;
        console.log('✅ Shabbat PDF URL loaded:', this.shabbatMenuPdfUrl);
      } else {
        this.shabbatMenuPdfUrl = '';
        console.warn('ShabbatMenuComponent: No shabbatMenuUrl found in settings');
      }
    });
  }

  openMenu(): void {
    console.log('Attempting to open menu URL:', this.shabbatMenuPdfUrl); // Debug log
    
    if (this.shabbatMenuPdfUrl) {
      // Force open in new tab
      window.open(this.shabbatMenuPdfUrl, '_blank'); 
    } else {
      console.error('Menu URL is missing or empty!');
      alert('קישור לתפריט טרם עודכן במערכת'); // Optional user feedback
    }
  }
}

