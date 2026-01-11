import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { MenuService, MenuItem } from '../../../../services/menu.service';
import { CartService } from '../../../../services/cart.service';
import { LanguageService } from '../../../../services/language.service';

@Component({
  selector: 'app-fish',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  template: `
    <div class="fish-page">
      <div class="container">
        <div class="page-header">
          <div class="section-title">
            <h2>דגים</h2>
          </div>
        </div>

        <!-- Loading State -->
        <div *ngIf="isLoading" class="loading">
          <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
          <span>טוען דגים...</span>
        </div>

        <!-- Fish Grid -->
        <div class="menu-grid" *ngIf="!isLoading">
          <div 
            *ngFor="let fish of fishDishes; trackBy: trackByItemId; let i = index" 
            class="menu-item-card featured-style"
            [class.is-unavailable]="!isAvailable(fish)"
          >
            <div class="item-image">
              <img 
                [src]="fish.imageUrl || '/assets/images/placeholder-dish.jpg'" 
                [alt]="fish.name"
                [loading]="(i === 0 || (fish.imageUrl && fish.imageUrl.includes('Salmon-spices.jpg'))) ? 'eager' : 'lazy'"
              >
              <!-- Popular Badge -->
              <span class="badge badge-popular" *ngIf="fish.isPopular === true">מומלץ</span>
              <!-- Out of Stock Badge -->
              <span class="badge badge-out-of-stock" *ngIf="!isAvailable(fish)">לא קיים זמנית</span>
            </div>
            
            <div class="item-content">
              <h3 class="item-name">{{ fish.name }}</h3>
              <p class="item-description">{{ fish.description }}</p>
              
              <div class="item-footer">
                <!-- Price per unit -->
                <div class="price-section">
                  <div class="price-row">
                    <span class="price-label">{{ 'PRODUCT.PRICE_UNIT' | translate }}</span>
                    <span class="price-value">{{ 'PRODUCT.SHEKEL' | translate }}{{ getPrice(fish) }}</span>
                  </div>
                  <div class="weight-note">
                    <span class="asterisk">*</span>
                    <span class="weight-text">{{ 'PRODUCT.WEIGHT' | translate }} 170 {{ 'PRODUCT.GRAMS' | translate }}</span>
                  </div>
                </div>
                
                <div class="buttons-group">
                  <button 
                    (click)="addToCart(fish)" 
                    class="btn btn-add-to-cart"
                    [attr.aria-label]="'הוסף לסל ' + fish.name"
                    [disabled]="!isAvailable(fish)"
                  >
                    <i class="fas fa-shopping-cart"></i>
                    {{ 'PRODUCT.ADD_TO_CART' | translate }}
                  </button>
                  
                  <button 
                    (click)="showDetails(fish)" 
                    class="btn btn-details"
                    [attr.aria-label]="'פרטים על ' + fish.name"
                  >
                    <i class="fas fa-info-circle"></i>
                    {{ 'PRODUCT.DETAILS' | translate }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div *ngIf="!isLoading && fishDishes.length === 0" class="empty-state">
          <i class="fas fa-fish" aria-hidden="true"></i>
          <h3>אין דגים זמינים כרגע</h3>
          <p>אנחנו עובדים על הוספת דגים חדשים. חזור בקרוב!</p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    // === Variables ===
    $navy: #1f3540;
    $gold: #E0C075;
    $white: #ffffff;
    $gray-bg: #f8f9fa;
    $border-color: #e0e0e0;
    $text-gray: #666;

    // === Main Page Container ===
    :host {
      display: block;
      background-color: $gray-bg;
      min-height: 100vh;
      font-family: 'Segoe UI', sans-serif;
    }

    .fish-page {
      padding: 50px 0;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 20px;
    }

    // === Page Header ===
    .page-header {
      margin-bottom: 40px;
    }

    // Professional 'Fading Gold' Divider Lines
    .section-title {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      margin: 60px 0 40px 0; // Generous spacing
      
      // The Title Text
      h2 {
        color: $navy; // Navy
        font-size: 2.5rem;
        font-weight: 800;
        padding: 0 30px;
        margin: 0;
        white-space: nowrap;
        position: relative;
        
        // Optional: Small Diamond dots next to text
        &::before,
        &::after {
          content: '◆';
          font-size: 1rem;
          color: $gold;
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
      
      // The Fading Lines
      &::before,
      &::after {
        content: '';
        flex: 1;
        height: 2px;
        border-radius: 2px;
      }
      
      // Left Line: Transparent -> Gold
      &::before {
        background: linear-gradient(to left, $gold, transparent);
        margin-left: 20px;
      }
      
      // Right Line: Gold -> Transparent
      &::after {
        background: linear-gradient(to right, $gold, transparent);
        margin-right: 20px;
      }
    }

    // === Loading State ===
    .loading {
      text-align: center;
      padding: 3rem 0;
      color: $text-gray;
    }

    .loading i {
      font-size: 2rem;
      margin-bottom: 1rem;
      color: $gold;
    }

    // === The Grid (3 Columns) ===
    .menu-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 30px;
      padding: 0 20px;
      justify-content: center;
    }

    // === Premium Card Design ===
    .menu-item-card {
      background: $white;
      border: 1px solid $border-color;
      border-radius: 0;
      height: 100%;
      display: flex;
      flex-direction: column;
      position: relative;
      transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
      overflow: hidden;

      // Hover Effects
      &:hover {
        transform: translateY(-7px);
        border-color: $gold;
        box-shadow: 0 15px 35px rgba(0,0,0,0.1);
      }

      // 1. Image Area - MAXIMIZED SIZE (Thin Border)
      .item-image {
        position: relative;
        width: 100%;
        height: 250px; // Fixed height
        background-color: #ffffff;
        border-bottom: 1px solid #f5f5f5;
        overflow: hidden;
        padding: 0; // Remove container padding
        display: block;

        img {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          
          // === THE KEY CHANGE ===
          // Force image to be 100% minus 8px total (4px border on each side)
          max-width: calc(100% - 8px);
          max-height: calc(100% - 8px);
          
          width: auto;
          height: auto;
          
          object-fit: contain; // Keeps the food aspect ratio correct
          transition: transform 0.6s ease;
        }

        .badge {
          position: absolute;
          top: 10px;
          right: 10px;
          background-color: $gold;
          color: $navy;
          padding: 4px 10px;
          font-size: 0.75rem;
          font-weight: 800;
          border-radius: 0;
          z-index: 2;
          text-transform: uppercase;
        }

        .badge-popular {
          background-color: $gold;
          color: $navy;
        }

        .badge-out-of-stock {
          background: #7a7a7a;
          color: white;
        }

        /* When popular badge exists, move out-of-stock badge to left */
        &:has(.badge-popular) .badge-out-of-stock {
          right: auto;
          left: 10px;
        }
      }

      // Hover Zoom
      &:hover .item-image img {
        transform: translate(-50%, -50%) scale(1.05);
      }

      // 2. Content Area
      .item-content {
        padding: 25px;
        flex-grow: 1;
        display: flex;
        flex-direction: column;
        text-align: right;

        h3.item-name {
          font-size: 1.5rem;
          font-weight: 800;
          color: $navy;
          margin-bottom: 10px;
          line-height: 1.3;
        }

        p.item-description {
          font-size: 0.95rem;
          color: $text-gray;
          margin-bottom: 20px;
          line-height: 1.6;
          flex-grow: 1;
        }

        .item-footer {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
          margin-top: auto;
          padding-top: 1.25rem;
          width: 100%;
        }

        /* Price Section */
        .price-section {
          margin-bottom: 1rem;
          padding: 0.75rem;
          background: #f9f9f9;
          border-radius: 0;
          border-right: 3px solid $navy;
        }

        .price-row {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 0.5rem;
        }

        .price-label {
          font-size: 0.95rem;
          font-weight: 600;
          color: #6c757d;
        }

        .price-value {
          font-size: 1.25rem;
          font-weight: bold;
          color: $navy;
        }

        .weight-note {
          display: flex;
          align-items: center;
          gap: 0.25rem;
          font-size: 0.85rem;
          color: #6c757d;
        }

        .asterisk {
          color: $gold;
          font-weight: bold;
        }

        .weight-text {
          color: #6c757d;
        }

        // 3. Actions Footer
        .buttons-group {
          display: grid;
          grid-template-columns: 1fr 1.5fr;
          gap: 15px;
          margin-top: auto;
          width: 100%;

          .btn {
            height: 45px;
            border-radius: 0;
            font-weight: 700;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: 0.2s;
            border: none;
            gap: 0.5rem;
            white-space: nowrap;
            box-sizing: border-box;

            i {
              font-size: 1rem;
              flex-shrink: 0;
            }
          }

          .btn-details {
            background: transparent;
            border: 1px solid $navy;
            color: $navy;
            &:hover {
              background: rgba($navy, 0.05);
            }
          }

          .btn-add-to-cart {
            background: $gold;
            border: 1px solid $gold;
            color: $navy;
            &:hover:not(:disabled) {
              background: darken($gold, 6%);
              box-shadow: 0 4px 10px rgba(0,0,0,0.1);
            }
            &:disabled {
              background: #ccc;
              color: #666;
              cursor: not-allowed;
              box-shadow: none;
            }
          }
        }
      }
    }

    .menu-item-card.featured-style {
      display: flex;
      flex-direction: column;
    }

    /* Unavailable State */
    .menu-item-card.is-unavailable {
      opacity: 0.6;
    }

    .menu-item-card.is-unavailable .item-image {
      filter: grayscale(80%);
    }

    .menu-item-card.is-unavailable .btn-add-to-cart {
      pointer-events: none;
    }

    // === Empty State ===
    .empty-state {
      text-align: center;
      padding: 4rem 0;
      color: $text-gray;
    }

    .empty-state i {
      font-size: 4rem;
      color: $gold;
      margin-bottom: 1rem;
    }

    // === Responsive Breakpoints ===
    @media (max-width: 992px) {
      .menu-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    @media (max-width: 600px) {
      .menu-grid {
        grid-template-columns: 1fr;
      }
      .menu-item-card .item-image {
        height: 200px;
      }
      .section-title h2 {
        font-size: 2rem;
      }
    }
  `]
})
export class FishComponent implements OnInit {
  menuService = inject(MenuService);
  cartService = inject(CartService);
  languageService = inject(LanguageService);
  router = inject(Router);

  fishDishes: MenuItem[] = [];
  isLoading = true;

  featuredFishDishes = [
    {
      id: 'mushat-moroccan',
      name: 'מושט מרוקאי',
      description: 'מושט מרוקאי מסורתי עשוי מדג מושט טרי, מתובל בתבלינים מרוקאיים אותנטיים. טעם עשיר ומתובל שמביא את הטעמים האותנטיים של המטבח המרוקאי.',
      pricePer100g: 12.5,
      imageUrl: '/assets/images/fish/Fish-stretched.jpg',
      tags: ['דגים'],
      isAvailable: true
    },
    {
      id: 'salmon-herbs',
      name: 'סלמון בעשבי תיבול',
      description: 'פילה סלמון איכותי מתובל בעשבי תיבול טריים ומיוחדים. שילוב מושלם בין הטעם העשיר של הסלמון לטעמים המרעננים של עשבי התיבול.',
      pricePer100g: 15.0,
      imageUrl: '/assets/images/fish/Salmon-spices.jpg',
      tags: ['דגים', 'בריא'],
      isAvailable: true
    },
    {
      id: 'salmon-teriyaki',
      name: 'סלמון ברוטב טריאקי',
      description: 'פילה סלמון איכותי ברוטב טריאקי אסיאתי מתוק וטעים. שילוב מושלם בין הטעם העשיר של הסלמון למתיקות העדינה של רוטב הטריאקי.',
      pricePer100g: 15.5,
      imageUrl: '/assets/images/fish/Salmon-teriyaki.jpg',
      tags: ['דגים', 'בריא'],
      isAvailable: true
    },
    {
      id: 'salmon-mustard-honey',
      name: 'סלמון ברוטב חרדל ודבש',
      description: 'פילה סלמון איכותי ברוטב חרדל ודבש מתוק וחריף. שילוב מושלם בין הטעם העשיר של הסלמון לחריפות החרדל ולמתיקות הדבש.',
      pricePer100g: 15.5,
      imageUrl: '/assets/images/fish/Salmon-honey.jpg',
      tags: ['דגים', 'בריא'],
      isAvailable: true
    }
  ];

  ngOnInit(): void {
    this.loadFishDishes();
  }

  loadFishDishes(): void {
    this.isLoading = true;
    // For now, use featured fish dishes
    this.fishDishes = this.featuredFishDishes.map(fish => ({
      id: fish.id,
      name: fish.name,
      description: fish.description,
      price: fish.pricePer100g,
      imageUrl: fish.imageUrl,
      category: 'דגים',
      tags: fish.tags,
      isAvailable: fish.isAvailable,
      pricePer100g: fish.pricePer100g
    } as MenuItem & { pricePer100g: number }));
    this.isLoading = false;
  }

  trackByItemId(index: number, item: MenuItem): string {
    return item.id || item._id || '';
  }

  isAvailable(item: MenuItem): boolean {
    return item.isAvailable !== false;
  }

  getPrice(item: MenuItem): number {
    // Priority 1: pricingOptions (first option price)
    if (item.pricingOptions && item.pricingOptions.length > 0) {
      return item.pricingOptions[0].price;
    }
    
    // Priority 2: pricingVariants (first variant price)
    if (item.pricingVariants && item.pricingVariants.length > 0) {
      return item.pricingVariants[0].price;
    }
    
    // Priority 3: single price
    if (item.price !== undefined && item.price !== null) {
      return item.price;
    }
    
    // Fallback: use pricePer100g if available (for backward compatibility)
    const itemWithPricePer100g = item as any;
    if (itemWithPricePer100g.pricePer100g) {
      return itemWithPricePer100g.pricePer100g;
    }
    
    return 0;
  }

  addToCart(item: MenuItem): void {
    // Get price using getPrice method which handles all pricing types
    const price = this.getPrice(item);
    
    if (price <= 0) {
      alert('מחיר לא זמין עבור פריט זה');
      return;
    }

    this.cartService.addItem({
      id: item.id || item._id || '',
      name: item.name,
      price: price,
      imageUrl: item.imageUrl,
      description: item.description,
      category: item.category
    });

    this.cartService.openCart();
  }

  showDetails(item: MenuItem): void {
    // Navigate to salad detail page (reusing the same component)
    this.router.navigate(['/ready-for-shabbat/salads', item.id]);
  }
}

