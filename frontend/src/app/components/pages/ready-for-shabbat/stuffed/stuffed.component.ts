import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, NgOptimizedImage } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule } from '@ngx-translate/core';
import { MenuService, MenuItem } from '../../../../services/menu.service';
import { CartService } from '../../../../services/cart.service';
import { LocaleService } from '../../../../i18n/locale.service';
import {
  localizedProductDescription,
  localizedProductName
} from '../../../../i18n/localized-content';

@Component({
  selector: 'app-stuffed',
  standalone: true,
  imports: [CommonModule, NgOptimizedImage, RouterModule, MatIconModule, TranslateModule],
  templateUrl: './stuffed.component.html',
  styleUrls: ['./stuffed.component.scss']
})
export class StuffedComponent implements OnInit {
  private menuService = inject(MenuService);
  private cartService = inject(CartService);
  private router = inject(Router);
  readonly localeService = inject(LocaleService);

  stuffedDishes: MenuItem[] = [];
  isLoading: boolean = true;

  ngOnInit(): void {
    this.menuService.getProductsByCategory('stuffed').subscribe({
      next: (items) => {
        this.stuffedDishes = items;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading stuffed:', err);
        this.isLoading = false;
      }
    });
  }

  displayName(item: MenuItem): string {
    return localizedProductName(item, this.localeService.locale);
  }

  displayDescription(item: MenuItem): string {
    return localizedProductDescription(item, this.localeService.locale);
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
      nameEn: item.nameEn,
      price: price,
      imageUrl: item.imageUrl,
      description: item.description,
      descriptionEn: item.descriptionEn,
      category: item.category || 'stuffed'
    });
  }

  viewDetails(item: MenuItem): void {
    const id = item.id || item._id;
    if (id) {
      this.router.navigateByUrl(this.localeService.localizePath(`/ready-for-shabbat/stuffed/${id}`));
    }
  }

  getPrice(item: MenuItem): number {
    return item.price || item.pricePer100g || (item.pricingOptions?.[0]?.price) || 0;
  }

  isAvailable(item: MenuItem): boolean {
    return item.isAvailable !== false;
  }
}
