import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule, NgOptimizedImage } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { Subject, takeUntil } from 'rxjs';
import { MenuItem } from '../../../../services/menu.service';
import { HolidayEvent, HolidayEventService } from '../../../../services/holiday-event.service';
import { HolidayCatalogService } from '../../../../services/holiday-catalog.service';
import { CartService } from '../../../../services/cart.service';
import { SiteSettingsService, SiteSettings } from '../../../../services/site-settings.service';
import { SeoService } from '../../../../services/seo.service';
import { PageBannerComponent } from '../../../shared/page-banner/page-banner.component';
import { PagePopupComponent } from '../../../shared/page-popup/page-popup.component';
import { formatDeadlineLabel } from '../../../../utils/datetime-local.utils';
import {
  HOLIDAY_CART_CATEGORY,
  isHolidayEventStillOrderable,
  mapHolidayEventToMenuItems
} from '../../../../utils/holiday-menu.utils';

@Component({
  selector: 'app-holiday-category',
  standalone: true,
  imports: [
    CommonModule,
    NgOptimizedImage,
    RouterModule,
    MatIconModule,
    PageBannerComponent,
    PagePopupComponent
  ],
  templateUrl: './holiday-category.component.html',
  styleUrls: ['./holiday-category.component.scss']
})
export class HolidayCategoryComponent implements OnInit, OnDestroy {
  private holidayEventService = inject(HolidayEventService);
  private holidayCatalog = inject(HolidayCatalogService);
  private cartService = inject(CartService);
  private settingsService = inject(SiteSettingsService);
  private router = inject(Router);
  private seoService = inject(SeoService);
  private destroy$ = new Subject<void>();
  private deadlineTick?: ReturnType<typeof setInterval>;

  settings: SiteSettings | null = null;
  showPopup = false;
  activeEvent: HolidayEvent | null = null;
  items: MenuItem[] = [];
  isLoading = true;
  orderDeadlineLabel = '';

  get pageBannerMessage(): string | null {
    const announcement = this.settings?.pageAnnouncements?.['holiday']?.bannerText?.trim();
    const deadline = this.orderDeadlineLabel
      ? `ניתן להזמין עד ${this.orderDeadlineLabel}`
      : '';
    const parts = [announcement, deadline].filter((p): p is string => !!p);
    return parts.length > 0 ? parts.join(' · ') : null;
  }

  ngOnInit(): void {
    this.settingsService
      .getSettings(true)
      .pipe(takeUntil(this.destroy$))
      .subscribe((s) => {
        this.settings = s ?? null;
        const pa = s?.pageAnnouncements?.['holiday'];
        if ((pa?.popupTitle?.trim() ?? '') !== '' || (pa?.popupText?.trim() ?? '') !== '') {
          this.showPopup = true;
        }
      });
    this.loadHolidayMenu();
    this.deadlineTick = setInterval(() => this.checkDeadlineAndRedirect(), 60_000);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.holidayCatalog.clear();
    if (this.deadlineTick) clearInterval(this.deadlineTick);
  }

  closePopup(): void {
    this.showPopup = false;
  }

  private loadHolidayMenu(): void {
    this.isLoading = true;
    this.holidayEventService
      .getActive()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          if (!res.visible || !res.event || !isHolidayEventStillOrderable(res.event)) {
            this.router.navigate(['/ready-for-shabbat']);
            return;
          }
          this.activeEvent = res.event;
          this.items = mapHolidayEventToMenuItems(res.event);
          this.holidayCatalog.setItems(this.items);
          this.orderDeadlineLabel = formatDeadlineLabel(res.event.orderDeadline);
          this.seoService.updateTags({
            title: `${res.event.name} - קייטרינג מגדים | אוכל מוכן לשבת וחג`,
            description: `מנות מיוחדות ל${res.event.name}. הזמנה עד ${this.orderDeadlineLabel}.`
          });
          this.isLoading = false;
        },
        error: () => {
          this.isLoading = false;
          this.router.navigate(['/ready-for-shabbat']);
        }
      });
  }

  private checkDeadlineAndRedirect(): void {
    if (this.activeEvent && !isHolidayEventStillOrderable(this.activeEvent)) {
      this.router.navigate(['/ready-for-shabbat']);
    }
  }

  getPrice(item: MenuItem): number {
    return item.price || item.pricePer100g || item.pricingOptions?.[0]?.price || 0;
  }

  isAvailable(item: MenuItem): boolean {
    return (
      item.isAvailable !== false &&
      this.activeEvent != null &&
      isHolidayEventStillOrderable(this.activeEvent)
    );
  }

  addToCart(item: MenuItem): void {
    if (!this.isAvailable(item)) return;
    const price = this.getPrice(item);
    if (price <= 0) {
      console.error(`Cannot add ${item.name} to cart: no price available`);
      return;
    }
    this.cartService.addItem({
      id: item.id || item._id || '',
      name: item.name,
      price,
      imageUrl: item.imageUrl,
      description: item.description,
      category: HOLIDAY_CART_CATEGORY
    });
  }

  viewDetails(item: MenuItem): void {
    const id = item.id || item._id;
    if (id) this.router.navigate(['/ready-for-shabbat/holiday', id]);
  }
}
