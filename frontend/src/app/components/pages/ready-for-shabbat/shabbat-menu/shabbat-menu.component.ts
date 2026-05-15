import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { CommonModule, NgOptimizedImage } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { RouterModule } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { SiteSettingsService, SiteSettings } from '../../../../services/site-settings.service';
import { SeoService } from '../../../../services/seo.service';
import { HolidayEvent, HolidayEventService } from '../../../../services/holiday-event.service';
import {
  buildHolidayBentoTile,
  isHolidayEventStillOrderable,
  ShabbatCategoryTile
} from '../../../../utils/holiday-menu.utils';

const DEFAULT_HOLIDAY_CARD_IMAGE =
  'https://res.cloudinary.com/dioklg7lx/image/upload/v1768906611/IMG_9750_v7mval.jpg';

@Component({
  selector: 'app-shabbat-menu',
  standalone: true,
  imports: [CommonModule, NgOptimizedImage, TranslateModule, RouterModule],
  templateUrl: './shabbat-menu.component.html',
  styleUrls: ['./shabbat-menu.component.scss']
})
export class ShabbatMenuComponent implements OnInit, OnDestroy {
  translateService = inject(TranslateService);
  settingsService = inject(SiteSettingsService);
  seoService = inject(SeoService);
  private holidayEventService = inject(HolidayEventService);
  private destroy$ = new Subject<void>();
  private holidayTick?: ReturnType<typeof setInterval>;

  settings: SiteSettings | null = null;
  shabbatMenuPdfUrl = '';
  activeHoliday: HolidayEvent | null = null;

  private readonly baseCategories: ShabbatCategoryTile[] = [
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
      image: 'https://res.cloudinary.com/dioklg7lx/image/upload/v1773392935/magadim-catering/v0bvgugfq4aomoz6pusr.jpg'
    },
    {
      id: 'stuffed',
      nameKey: 'CATEGORIES.STUFFED',
      title: 'ממולאים',
      image: 'https://res.cloudinary.com/dioklg7lx/image/upload/v1768914767/IMG_9678_sfg0bj.jpg'
    }
  ];

  categories: ShabbatCategoryTile[] = [...this.baseCategories];

  get hasActiveHoliday(): boolean {
    return !!this.activeHoliday && isHolidayEventStillOrderable(this.activeHoliday);
  }

  ngOnInit(): void {
    this.seoService.updatePage('menu');
    this.settingsService
      .getSettings(true)
      .pipe(takeUntil(this.destroy$))
      .subscribe((s) => {
        this.shabbatMenuPdfUrl = s?.shabbatMenuUrl ?? '';
      });

    this.holidayEventService
      .getActive()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.activeHoliday = res.visible && res.event ? res.event : null;
          this.rebuildCategories();
        },
        error: () => {
          this.activeHoliday = null;
          this.rebuildCategories();
        }
      });

    this.holidayTick = setInterval(() => this.rebuildCategories(), 60_000);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.holidayTick) clearInterval(this.holidayTick);
  }

  private rebuildCategories(): void {
    const list = [...this.baseCategories];
    if (this.activeHoliday && isHolidayEventStillOrderable(this.activeHoliday)) {
      const tile = buildHolidayBentoTile(this.activeHoliday, DEFAULT_HOLIDAY_CARD_IMAGE);
      const cover = this.activeHoliday.imageUrl?.trim();
      if (cover) {
        tile.image = cover;
      }
      list.unshift(tile);
    }
    this.categories = list;
  }

  trackByCategoryId(_index: number, cat: ShabbatCategoryTile): string {
    return cat.id;
  }

  openMenu(): void {
    if (this.shabbatMenuPdfUrl) {
      window.open(this.shabbatMenuPdfUrl, '_blank');
    } else {
      alert('קישור לתפריט טרם עודכן במערכת');
    }
  }
}
