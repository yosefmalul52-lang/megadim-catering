import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { MenuService, MenuItem } from '../../../services/menu.service';
import { SiteSettingsService, SiteSettings } from '../../../services/site-settings.service';
import { SeoService } from '../../../services/seo.service';
import { PageBannerComponent } from '../../shared/page-banner/page-banner.component';
import { PagePopupComponent } from '../../shared/page-popup/page-popup.component';

@Component({
  selector: 'app-cholent-bar',
  standalone: true,
  imports: [CommonModule, RouterModule, PageBannerComponent, PagePopupComponent],
  templateUrl: './cholent-bar.component.html',
  styleUrls: ['./cholent-bar.component.scss']
})
export class CholentBarComponent implements OnInit {
  menuService = inject(MenuService);
  router = inject(Router);
  settingsService = inject(SiteSettingsService);
  seoService = inject(SeoService);

  settings: SiteSettings | null = null;
  showPopup = false;

  /** All items for the Cholent Bar page (from API), grouped by category for display. */
  itemsGroupedByCategory: { category: string; categoryLabel: string; items: MenuItem[] }[] = [];
  isLoading: boolean = true;

  cholentForceOpen: boolean = false;
  cholentCustomMessage: string = '';
  cholentClosedMessage: string = '';

  ngOnInit(): void {
    this.seoService.updateTags({
      title: 'צ\'ולנט בר - קייטרינג מגדים | צ\'ולנט ומשקאות לשבת',
      description: 'הצ\'ולנט הביתי שלנו, משקאות וקינוחי צ\'ולנט. הזמנות בימי חמישי. קייטרינג מגדים.',
      image: 'https://res.cloudinary.com/dioklg7lx/image/upload/v1768906615/IMG_9690_u75cnk.jpg',
      keywords: 'צ\'ולנט, צ\'ולנט בר, קייטרינג מגדים, אוכל לשבת'
    });
    this.settingsService.getSettings(true).subscribe(settings => {
      this.settings = settings ?? null;
      this.cholentForceOpen = !!settings?.cholentForceOpen;
      this.cholentCustomMessage = (settings?.cholentCustomMessage || '').trim();
      this.cholentClosedMessage = (settings?.cholentClosedMessage || '').trim() || 'ההזמנות נפתחות ביום חמישי בין השעות 09:00 ל-17:00';
      const chol = settings?.pageAnnouncements?.['cholent'];
      if ((chol?.popupTitle?.trim() ?? '') !== '' || (chol?.popupText?.trim() ?? '') !== '') {
        this.showPopup = true;
      }
    });
    this.loadCholentItems();
  }

  closePopup(): void {
    this.showPopup = false;
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

  /** Categories shown on the Cholent Bar page (DB category name -> section label). */
  private static readonly CHOLENT_BAR_CATEGORIES: { id: string; label: string }[] = [
    { id: 'צ\'ולנט', label: 'הצ\'ולנט שלנו' },
    { id: 'משקאות', label: 'משקאות' },
    { id: 'קינוחים צ\'ולנט', label: 'קינוחים' }
  ];

  private loadCholentItems(): void {
    const allowed = new Set(CholentBarComponent.CHOLENT_BAR_CATEGORIES.map(c => c.id));
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

  private groupByCategory(items: MenuItem[]): { category: string; categoryLabel: string; items: MenuItem[] }[] {
    const order = CholentBarComponent.CHOLENT_BAR_CATEGORIES;
    const map = new Map<string, MenuItem[]>();
    items.forEach((item) => {
      const cat = item.category || '';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(item);
    });
    return order
      .filter((c) => map.has(c.id))
      .map((c) => ({ category: c.id, categoryLabel: c.label, items: map.get(c.id)! }));
  }

  getPrice(item: MenuItem): number {
    return item.price || 0;
  }
}
