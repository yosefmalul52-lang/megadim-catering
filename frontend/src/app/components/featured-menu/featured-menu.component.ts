import { Component, ElementRef, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TranslateModule } from '@ngx-translate/core';
import { CartService } from '../../services/cart.service';
import { MenuService, MenuItem } from '../../services/menu.service';
import { QuantitySelectorComponent } from '../shared/quantity-selector/quantity-selector.component';
import { LocaleService } from '../../i18n/locale.service';
import { localizedProductDescription, localizedProductName } from '../../i18n/localized-content';

interface Category {
  id: string;
  name: string;
  nameKey?: string;
  image: string;
}

@Component({
  selector: 'app-featured-menu',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatIconModule,
    MatSnackBarModule,
    TranslateModule,
    QuantitySelectorComponent,
  ],
  templateUrl: './featured-menu.component.html',
  styleUrls: ['./featured-menu.component.scss'],
})
export class FeaturedMenuComponent implements OnInit {
  private readonly cartService = inject(CartService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly menuService = inject(MenuService);
  readonly localeService = inject(LocaleService);

  @ViewChild('categoryTrack') categoryTrack?: ElementRef<HTMLElement>;

  readonly categories: Category[] = [
    {
      id: 'salads',
      name: 'סלטים',
      nameKey: 'CATEGORIES.SALADS',
      image: 'https://megadim-media.megadim.workers.dev/frontend/static/da7e9eee1eeac5e2/original.png',
    },
    {
      id: 'fish',
      name: 'דגים',
      nameKey: 'CATEGORIES.FISH',
      image: 'https://megadim-media.megadim.workers.dev/frontend/static/47e00b409d8842db/original.jpg',
    },
    {
      id: 'main',
      name: 'מנות עיקריות',
      nameKey: 'CATEGORIES.MAIN',
      image: 'https://megadim-media.megadim.workers.dev/frontend/static/370fefc6263ad915/original.jpg',
    },
    {
      id: 'sides',
      name: 'תוספות',
      nameKey: 'CATEGORIES.SIDES',
      image: 'https://megadim-media.megadim.workers.dev/frontend/static/8b229cb94fc3112c/original.jpg',
    },
    {
      id: 'stuffed',
      name: 'ממולאים',
      nameKey: 'CATEGORIES.STUFFED',
      image: 'https://megadim-media.megadim.workers.dev/frontend/static/bc6bab3016ae6a30/original.jpg',
    },
  ];

  displayedProducts: MenuItem[] = [];
  isLoading = false;
  private readonly itemQuantities: Record<string, number> = {};

  ngOnInit(): void {
    this.loadFeaturedProducts();
  }

  getCategoryRoute(category: Category): string {
    return this.localeService.localizePath(`/ready-for-shabbat/${category.id}`);
  }

  productRoute(item: MenuItem): string {
    return this.localeService.localizePath(`/ready-for-shabbat/product/${this.getItemId(item)}`);
  }

  displayName(item: MenuItem): string {
    return localizedProductName(item, this.localeService.locale);
  }

  displayDescription(item: MenuItem): string {
    return localizedProductDescription(item, this.localeService.locale);
  }

  scrollCategories(direction: -1 | 1): void {
    const el = this.categoryTrack?.nativeElement;
    if (!el) return;

    const chip = el.querySelector<HTMLElement>('.category-chip');
    const styles = getComputedStyle(el);
    const gap = Number.parseFloat(styles.columnGap || styles.gap) || 24;
    const step = chip ? chip.offsetWidth + gap : 220;

    el.scrollBy({ left: direction * step, behavior: 'smooth' });
  }

  private loadFeaturedProducts(): void {
    this.isLoading = true;
    this.menuService.getFeaturedItems().subscribe({
      next: (items) => {
        this.displayedProducts = items;
        this.isLoading = false;
      },
      error: () => {
        this.displayedProducts = [];
        this.isLoading = false;
      },
    });
  }

  isAvailable(item: MenuItem): boolean {
    return item.isAvailable !== false;
  }

  getQuantity(item: MenuItem): number {
    const id = this.getItemId(item);
    return this.itemQuantities[id] ?? 1;
  }

  setQuantity(item: MenuItem, qty: number): void {
    const id = this.getItemId(item);
    if (!id) return;
    this.itemQuantities[id] = Math.max(1, qty);
  }

  getServingHint(item: MenuItem): string | null {
    return item.servingSize?.trim() || null;
  }

  getPriceLabel(item: MenuItem): string {
    const price = this.getUnitPrice(item);
    return price > 0 ? `₪${price}` : '';
  }

  private getUnitPrice(item: MenuItem): number {
    if (item.pricingOptions?.length) {
      return item.pricingOptions[0].price;
    }
    if (item.pricingVariants?.length) {
      return item.pricingVariants[0].price;
    }
    if (item.price != null && item.price > 0) {
      return item.price;
    }
    if (item.pricePer100g != null && item.pricePer100g > 0) {
      return item.pricePer100g;
    }
    return 0;
  }

  addToCart(item: MenuItem): void {
    if (!this.isAvailable(item)) return;

    const itemId = this.getItemId(item);
    const quantity = this.getQuantity(item);
    const price = this.getUnitPrice(item);
    const name = item.name;

    if (price <= 0) {
      this.snackBar.open('לא ניתן להוסיף את הפריט לסל — אין מחיר זמין', 'סגור', {
        duration: 3000,
        direction: 'rtl',
      });
      return;
    }

    this.cartService.addToCart(
      {
        id: itemId,
        name,
        price,
        imageUrl: item.imageUrl,
        description: item.description,
        category: item.category,
        nameEn: item.nameEn,
        descriptionEn: item.descriptionEn,
      },
      quantity
    );
    this.cartService.openCart();

    this.snackBar.open(`${item.name} התווסף להזמנה בהצלחה!`, 'סגור', {
      duration: 2500,
      direction: 'rtl',
    });
  }

  getItemId(item: MenuItem): string {
    return (item.id || item._id || '').toString();
  }
}
