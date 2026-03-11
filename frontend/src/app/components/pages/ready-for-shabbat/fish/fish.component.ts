import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { MenuService, MenuItem } from '../../../../services/menu.service';
import { CartService } from '../../../../services/cart.service';
import { SiteSettingsService, SiteSettings } from '../../../../services/site-settings.service';
import { PageBannerComponent } from '../../../shared/page-banner/page-banner.component';
import { PagePopupComponent } from '../../../shared/page-popup/page-popup.component';

@Component({
  selector: 'app-fish',
  standalone: true,
  imports: [CommonModule, RouterModule, PageBannerComponent, PagePopupComponent],
  templateUrl: './fish.component.html',
  styleUrls: ['./fish.component.scss']
})
export class FishComponent implements OnInit {
  private menuService = inject(MenuService);
  private cartService = inject(CartService);
  private settingsService = inject(SiteSettingsService);
  private router = inject(Router);

  settings: SiteSettings | null = null;
  showPopup = false;
  fishDishes: MenuItem[] = [];
  isLoading: boolean = true;

  ngOnInit(): void {
    this.settingsService.getSettings(true).subscribe(s => {
      this.settings = s ?? null;
      const pa = s?.pageAnnouncements?.['fish'];
      if ((pa?.popupTitle?.trim() ?? '') !== '' || (pa?.popupText?.trim() ?? '') !== '') {
        this.showPopup = true;
      }
    });
    this.menuService.getProductsByCategory('fish').subscribe({
      next: (items) => {
        this.fishDishes = items;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading fish:', err);
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
      category: item.category || 'fish'
    });
  }

  viewDetails(item: MenuItem): void {
    const id = item.id || item._id;
    if (id) this.router.navigate(['/ready-for-shabbat/fish', id]);
  }

  getPrice(item: MenuItem): number {
    return item.price || item.pricePer100g || (item.pricingOptions?.[0]?.price) || 0;
  }

  isAvailable(item: MenuItem): boolean {
    return item.isAvailable !== false;
  }
}
