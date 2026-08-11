import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { MatIconModule } from '@angular/material/icon';

import { MenuService, MenuItem } from '../../../../services/menu.service';
import { CartService } from '../../../../services/cart.service';
import { LanguageService } from '../../../../services/language.service';
import { LocaleService } from '../../../../i18n/locale.service';
import {
  localizedProductDescription,
  localizedProductName
} from '../../../../i18n/localized-content';

@Component({
  selector: 'app-main-dishes',
  standalone: true,
  imports: [CommonModule, TranslateModule, RouterModule, MatIconModule],
  template: `
    <div class="main-dishes-page">
      <div class="category-header-actions">
        <button class="btn-gold-back" [routerLink]="localeService.localizePath('/ready-for-shabbat')">
          <i class="fas fa-arrow-right"></i> {{ 'PRODUCT.BACK_TO_MENU' | translate }}
        </button>
      </div>

      <header class="luxury-category-header">
        <span class="decorative-line"></span>
        <span class="decorative-diamond"></span>
        <h1>{{ 'CATEGORIES.MAIN' | translate }}</h1>
        <span class="decorative-diamond"></span>
        <span class="decorative-line"></span>
      </header>

      <div class="container">

        <!-- Loading State -->
        <div *ngIf="isLoading" class="loading">
          <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
          <span>{{ 'PRODUCT.LOADING' | translate }}</span>
        </div>

        <!-- Dishes Grid (unified card design) -->
        <div class="menu-grid grid-4-cols unified-menu-grid" *ngIf="!isLoading">
          <div 
            *ngFor="let dish of mainDishes; trackBy: trackByItemId" 
            class="product-card"
          >
            <div class="card-image-wrapper">
              <img 
                [src]="dish.imageUrl || '/assets/images/placeholder-dish.jpg'" 
                [alt]="displayName(dish)"
                loading="lazy"
              >
              <div class="badge" *ngIf="dish.isPopular === true">{{ 'PRODUCT.RECOMMENDED' | translate }}</div>
              <span class="badge-out-of-stock" *ngIf="!isAvailable(dish)">{{ 'PRODUCT.OOS' | translate }}</span>
            </div>
            
            <div class="card-content">
              <h4 class="card-title">{{ displayName(dish) }}</h4>
              <p class="card-desc">{{ displayDescription(dish) }}</p>
              <div class="card-price">
                <span class="currency">₪</span>{{ getPrice(dish) }}
              </div>
              
              <div class="card-actions">
                <button 
                  (click)="viewDetails(dish)" 
                  class="btn-details"
                  [attr.aria-label]="('PRODUCT.DETAILS' | translate) + ' ' + displayName(dish)"
                >
                  {{ 'PRODUCT.DETAILS' | translate }}
                </button>
                <button 
                  (click)="addToCart(dish)" 
                  class="btn-add"
                  [attr.aria-label]="('PRODUCT.ADD_TO_CART' | translate) + ' ' + displayName(dish)"
                  [disabled]="!isAvailable(dish)"
                >
                  <mat-icon>shopping_cart</mat-icon>
                  {{ 'PRODUCT.ADDING' | translate }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div *ngIf="!isLoading && mainDishes.length === 0" class="empty-state">
          <i class="fas fa-utensils" aria-hidden="true"></i>
          <h3>{{ 'PRODUCT.EMPTY' | translate }}</h3>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .main-dishes-page {
      padding: 2rem 0;
      min-height: 70vh;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 2rem;
    }

    .page-header {
      margin-bottom: 3rem;
    }

    // Professional 'Fading Gold' Divider Lines
    .section-title {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      margin: 60px 0 40px 0; // Generous spacing
      direction: ltr;
      
      // The Title Text
      h2 {
        color: #1f3540; // Navy
        font-size: 2.5rem;
        font-weight: 800;
        padding: 0 30px;
        margin: 0;
        white-space: nowrap;
        position: relative;
        unicode-bidi: isolate;
        
        // Optional: Small Diamond dots next to text
        &::before,
        &::after {
          content: '◆';
          font-size: 1rem;
          color: #E0C075;
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
        }
        &::before {
          left: 0;
        }
        &::after {
          right: 0;
        }
      }
      
      // The Fading Lines - Short lines (half width on each side)
      &::before,
      &::after {
        content: '';
        flex: 0 0 auto;
        width: 100px;
        height: 2px;
        border-radius: 2px;
      }
      
      // Left Line: Transparent -> Gold
      &::before {
        background: linear-gradient(to right, transparent, #E0C075);
        margin-inline-end: 20px;
        margin-left: 0;
        margin-right: 0;
      }
      
      // Right Line: Gold -> Transparent
      &::after {
        background: linear-gradient(to left, transparent, #E0C075);
        margin-inline-start: 20px;
        margin-left: 0;
        margin-right: 0;
      }
    }

    .loading {
      text-align: center;
      padding: 3rem 0;
      color: #6c757d;
    }

    .loading i {
      font-size: 2rem;
      margin-bottom: 1rem;
      color: #cbb69e;
    }

    // Variables
    $navy: #1f3540;
    $gold: #E0C075;
    $white: #ffffff;
    $gray-border: #eaeaea;

    .menu-grid {
      padding: 20px 0;
      margin-bottom: 4rem;
    }

    .empty-state {
      text-align: center;
      padding: 4rem 0;
      color: #6c757d;
    }

    .empty-state i {
      font-size: 4rem;
      color: #cbb69e;
      margin-bottom: 1rem;
    }

    // Responsive adjustments
    @media (max-width: 1100px) {
      .menu-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    @media (max-width: 650px) {
      .menu-grid {
        grid-template-columns: 1fr;
      }

      .section-title h2 {
        font-size: 2rem;
      }

      .item-footer {
        flex-direction: column;
        gap: 1rem;
        align-items: stretch;
      }

      .add-to-cart-btn {
        justify-content: center;
      }
    }

    // Container for the Back Button
    .category-header-actions {
      padding: 20px 20px 0 20px;
      display: flex;
      justify-content: flex-end;
      width: 100%;
    }

    // The Luxury Header
    .luxury-category-header {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 15px;
      margin: 10px 0 40px 0;
      width: 100%;
      padding: 0 20px;

      h1 {
        color: #1f3540;
        font-size: 2.5rem;
        font-weight: 700;
        margin: 0;
        white-space: nowrap;
      }

      .decorative-diamond {
        width: 8px;
        height: 8px;
        background-color: var(--primary-gold);
        transform: rotate(45deg);
        flex-shrink: 0;
      }

      .decorative-line {
        height: 2px;
        background-color: var(--primary-gold);
        flex-grow: 1;
        max-width: 100px;
        opacity: 0.6;
      }
    }
  `]
})
export class MainDishesComponent implements OnInit {
  menuService = inject(MenuService);
  cartService = inject(CartService);
  languageService = inject(LanguageService);
  router = inject(Router);
  readonly localeService = inject(LocaleService);

  mainDishes: MenuItem[] = [];
  isLoading = true;

  // REMOVED: Hardcoded featuredMainDishes array
  // All data now comes from MenuService (Single Source of Truth)
  // This ensures consistency and prevents "Product not found" errors
  featuredMainDishes: any[] = []; // Deprecated - kept for backward compatibility only

  displayName(item: MenuItem): string {
    return localizedProductName(item, this.localeService.locale);
  }

  displayDescription(item: MenuItem): string {
    return localizedProductDescription(item, this.localeService.locale);
  }

  ngOnInit(): void {
    this.loadMainDishes();
  }

  /**
   * Load main dishes from MenuService (Single Source of Truth)
   * This ensures consistency - cards are generated FROM service data,
   * so it's IMPOSSIBLE for a card to link to a product that doesn't exist
   */
  private loadMainDishes(): void {
    this.isLoading = true;
    console.log('🔄 Loading main dishes from MenuService...');
    
    // Use getProductsByCategory to get ALL products for this category
    this.menuService.getProductsByCategory('main-dishes').subscribe({
      next: (items) => {
        console.log('✅ Loaded', items.length, 'main dishes from MenuService');
        this.mainDishes = items;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('❌ Error loading main dishes:', error);
        this.mainDishes = [];
        this.isLoading = false;
      }
    });
  }

  addToCart(item: MenuItem): void {
    if (!item.isAvailable) return;

    // Get price using getPrice method which handles all pricing types
    const price = this.getPrice(item);
    
    if (price <= 0) {
      console.error(`Cannot add ${item.name} to cart: no price available`);
      alert('לא ניתן להוסיף את הפריט לסל - אין מחיר זמין');
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
      category: item.category
    });

    console.log(`Added ${item.name} to cart`);
  }

  trackByItemId(index: number, item: MenuItem): string {
    return item.id || item._id || '';
  }

  getServingSize(dish: MenuItem): string {
    return (dish as any).recommendedServing || dish.servingSize || '';
  }

  getPrice(dish: MenuItem): number {
    // Priority 1: pricingOptions (first option price)
    if (dish.pricingOptions && dish.pricingOptions.length > 0) {
      return dish.pricingOptions[0].price;
    }
    
    // Priority 2: pricingVariants (first variant price)
    if (dish.pricingVariants && dish.pricingVariants.length > 0) {
      return dish.pricingVariants[0].price;
    }
    
    // Priority 3: single price
    if (dish.price !== undefined && dish.price !== null) {
      return dish.price;
    }
    
    // Priority 4: pricePer100g (for backward compatibility)
    const dishWithPricePer100g = dish as any;
    if (dishWithPricePer100g.pricePer100g) {
      return dishWithPricePer100g.pricePer100g;
    }
    
    return 0;
  }

  getAriaLabel(dish: MenuItem): string {
    return 'בחרו פרטי אספקה עבור ' + dish.name;
  }

  isAvailable(dish: MenuItem): boolean {
    return dish.isAvailable !== false;
  }

  viewDetails(dish: MenuItem): void {
    const dishId = dish.id || dish._id || '';
    if (dishId) {
      this.router.navigateByUrl(this.localeService.localizePath(`/ready-for-shabbat/main/${dishId}`));
    }
  }
}