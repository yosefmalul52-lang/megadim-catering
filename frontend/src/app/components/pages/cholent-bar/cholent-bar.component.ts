import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MenuService, MenuItem } from '../../../services/menu.service';
import { SiteSettingsService, SiteSettings } from '../../../services/site-settings.service';
import { SeoService } from '../../../services/seo.service';
import { LocaleService } from '../../../i18n/locale.service';
import {
  localizedProductDescription,
  localizedProductName
} from '../../../i18n/localized-content';

@Component({
  selector: 'app-cholent-bar',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslateModule],
  templateUrl: './cholent-bar.component.html',
  styleUrls: ['./cholent-bar.component.scss']
})
export class CholentBarComponent implements OnInit {
  menuService = inject(MenuService);
  router = inject(Router);
  settingsService = inject(SiteSettingsService);
  seoService = inject(SeoService);
  readonly localeService = inject(LocaleService);
  private translate = inject(TranslateService);

  settings: SiteSettings | null = null;

  /** All items for the Cholent Bar page (from API), grouped by category for display. */
  itemsGroupedByCategory: { category: string; categoryLabelKey: string; items: MenuItem[] }[] = [];
  isLoading: boolean = true;

  cholentForceOpen: boolean = false;
  cholentCustomMessage: string = '';
  cholentClosedMessage: string = '';

  displayName(item: MenuItem): string {
    return localizedProductName(item, this.localeService.locale);
  }

  displayDescription(item: MenuItem): string {
    return localizedProductDescription(item, this.localeService.locale);
  }

  ngOnInit(): void {
    this.translate.get(['CHOLENT.SEO_TITLE', 'CHOLENT.SEO_DESC']).subscribe((t) => {
      this.seoService.updateTags({
        title: t['CHOLENT.SEO_TITLE'],
        description: t['CHOLENT.SEO_DESC'],
        image: 'https://megadim-media.megadim.workers.dev/frontend/static/250389c505980022/original.jpg',
        keywords: "צ'ולנט, צ'ולנט בר, קייטרינג מגדים, אוכל לשבת"
      });
    });
    this.settingsService.getSettings(true).subscribe((settings) => {
      this.settings = settings ?? null;
      this.cholentForceOpen = !!settings?.cholentForceOpen;
      this.cholentCustomMessage = (settings?.cholentCustomMessage || '').trim();
      this.cholentClosedMessage = (settings?.cholentClosedMessage || '').trim();
    });
    this.loadCholentItems();
  }

  /**
   * Cholent Bar is OPEN if:
   * - (Current day is Thursday AND current hour is between 09:00 and 17:00)
   * OR
   * - cholentForceOpen from settings is true
   */
  isCholentBarOpen(): boolean {
    if (this.cholentForceOpen) {
      return true;
    }
    const now = new Date();
    const day = now.getDay(); // 0 = Sunday, 4 = Thursday
    const hour = now.getHours();
    const isThursday = day === 4;
    const withinHours = hour >= 9 && hour < 17;
    return isThursday && withinHours;
  }

  /** Categories shown on the Cholent Bar page (DB category name -> section label key). */
  private static readonly CHOLENT_BAR_CATEGORIES: { id: string; labelKey: string }[] = [
    { id: "צ'ולנט", labelKey: 'CHOLENT.SECTION_CHOLENT' },
    { id: 'משקאות', labelKey: 'CHOLENT.SECTION_DRINKS' },
    { id: "קינוחים צ'ולנט", labelKey: 'CHOLENT.SECTION_DESSERTS' }
  ];

  private loadCholentItems(): void {
    const allowed = new Set(CholentBarComponent.CHOLENT_BAR_CATEGORIES.map((c) => c.id));
    this.menuService.getAllItems('cholent').subscribe({
      next: (items) => {
        const filtered = (items || []).filter((i) => i.category && allowed.has(i.category));
        if (filtered.length > 0) {
          this.itemsGroupedByCategory = this.groupByCategory(filtered);
        } else {
          this.itemsGroupedByCategory = [];
        }
        this.isLoading = false;
      },
      error: () => {
        this.itemsGroupedByCategory = [];
        this.isLoading = false;
      }
    });
  }

  private groupByCategory(
    items: MenuItem[]
  ): { category: string; categoryLabelKey: string; items: MenuItem[] }[] {
    const order = CholentBarComponent.CHOLENT_BAR_CATEGORIES;
    const map = new Map<string, MenuItem[]>();
    items.forEach((item) => {
      const cat = item.category || '';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(item);
    });
    return order
      .filter((c) => map.has(c.id))
      .map((c) => ({
        category: c.id,
        categoryLabelKey: c.labelKey,
        items: map.get(c.id)!
      }));
  }

  getPrice(item: MenuItem): number {
    return item.price || 0;
  }
}
