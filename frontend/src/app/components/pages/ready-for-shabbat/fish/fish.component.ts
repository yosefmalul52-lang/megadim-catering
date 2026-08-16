import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, NgOptimizedImage } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule } from '@ngx-translate/core';
import { MenuService, MenuItem } from '../../../../services/menu.service';
import { CartService } from '../../../../services/cart.service';
import { SeoService } from '../../../../services/seo.service';
import { LocaleService } from '../../../../i18n/locale.service';
import {
  localizedProductDescription,
  localizedProductName
} from '../../../../i18n/localized-content';

@Component({
  selector: 'app-fish',
  standalone: true,
  imports: [
    CommonModule,
    NgOptimizedImage,
    RouterModule,
    MatIconModule,
    TranslateModule
  ],
  templateUrl: './fish.component.html',
  styleUrls: ['./fish.component.scss']
})
export class FishComponent implements OnInit {
  private menuService = inject(MenuService);
  private cartService = inject(CartService);
  private seoService = inject(SeoService);
  private router = inject(Router);
  readonly localeService = inject(LocaleService);

  fishDishes: MenuItem[] = [];
  isLoading: boolean = true;

  ngOnInit(): void {
    this.seoService.updateTags({
      title: 'דגים לשבת - קייטרינג מגדים | מנות דגים כשרות',
      description: 'מנות דגים טריות לשבת: גפילטה פיש, סלמון, דגים אפויים ומבושלים. קייטרינג כשר למהדרין.',
      image: 'https://megadim-media.megadim.workers.dev/frontend/static/66b9922b9c941dc1/original.jpg',
      keywords: 'דגים לשבת, גפילטה פיש, קייטרינג מגדים, אוכל כשר'
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
      category: item.category || 'fish'
    });
  }

  viewDetails(item: MenuItem): void {
    const id = item.id || item._id;
    if (id) {
      this.router.navigateByUrl(this.localeService.localizePath(`/ready-for-shabbat/fish/${id}`));
    }
  }

  getPrice(item: MenuItem): number {
    return item.price || item.pricePer100g || (item.pricingOptions?.[0]?.price) || 0;
  }

  isAvailable(item: MenuItem): boolean {
    return item.isAvailable !== false;
  }
}
