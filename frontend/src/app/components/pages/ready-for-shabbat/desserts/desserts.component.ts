import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, NgOptimizedImage } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MenuService, MenuItem } from '../../../../services/menu.service';
import { CartService } from '../../../../services/cart.service';
import { SiteSettingsService, SiteSettings } from '../../../../services/site-settings.service';
import { SeoService } from '../../../../services/seo.service';
import { PageBannerComponent } from '../../../shared/page-banner/page-banner.component';
import { PagePopupComponent } from '../../../shared/page-popup/page-popup.component';

@Component({
  selector: 'app-desserts',
  standalone: true,
  imports: [CommonModule, NgOptimizedImage, RouterModule, MatIconModule, PageBannerComponent, PagePopupComponent],
  templateUrl: './desserts.component.html',
  styleUrls: ['./desserts.component.scss']
})
export class DessertsComponent implements OnInit {
  private menuService = inject(MenuService);
  private cartService = inject(CartService);
  private settingsService = inject(SiteSettingsService);
  private seoService = inject(SeoService);
  private router = inject(Router);

  settings: SiteSettings | null = null;
  showPopup = false;
  desserts: MenuItem[] = [];
  isLoading: boolean = true;

  ngOnInit(): void {
    this.seoService.updateTags({
      title: 'קינוחים לשבת - קייטרינג מגדים | עוגות ומתוקים',
      description: 'קינוחים ביתיים לשבת: עוגות, עוגיות ומתוקים בעבודת יד. הזמינו קינוחים כשרים למהדרין.',
      image: 'https://res.cloudinary.com/dioklg7lx/image/upload/v1768914768/IMG_9679_ad0nxy.jpg',
      keywords: 'קינוחים לשבת, עוגות, קייטרינג מגדים, אוכל כשר'
    });
    this.settingsService.getSettings(true).subscribe(s => {
      this.settings = s ?? null;
      const pa = s?.pageAnnouncements?.['desserts'];
      if ((pa?.popupTitle?.trim() ?? '') !== '' || (pa?.popupText?.trim() ?? '') !== '') {
        this.showPopup = true;
      }
    });
    this.menuService.getProductsByCategory('desserts', 'shabbat').subscribe({
      next: (items) => {
        this.desserts = items;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading desserts:', err);
        this.isLoading = false;
      }
    });
  }

  closePopup(): void {
    this.showPopup = false;
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
      price: price,
      imageUrl: item.imageUrl,
      description: item.description,
      category: item.category || 'desserts'
    });
  }

  viewDetails(item: MenuItem): void {
    const id = item.id || item._id;
    if (id) this.router.navigate(['/ready-for-shabbat/desserts', id]);
  }

  getPrice(item: MenuItem): number {
    return item.price || item.pricePer100g || (item.pricingOptions?.[0]?.price) || 0;
  }

  isAvailable(item: MenuItem): boolean {
    return item.isAvailable !== false;
  }
}
