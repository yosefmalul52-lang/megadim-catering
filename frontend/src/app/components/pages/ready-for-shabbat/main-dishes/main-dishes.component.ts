import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { MenuService, MenuItem } from '../../../../services/menu.service';
import { CartService } from '../../../../services/cart.service';
import { LanguageService } from '../../../../services/language.service';

@Component({
  selector: 'app-main-dishes',
  standalone: true,
  imports: [CommonModule, TranslateModule, RouterModule],
  template: `
    <div class="main-dishes-page">
      <div class="category-header-actions">
        <button class="btn-gold-back" routerLink="/ready-for-shabbat">
          <i class="fas fa-arrow-right"></i> חזרה לתפריט
        </button>
      </div>

      <header class="luxury-category-header">
        <span class="decorative-line"></span>
        <span class="decorative-diamond"></span>
        <h1>מנות עיקריות</h1>
        <span class="decorative-diamond"></span>
        <span class="decorative-line"></span>
      </header>

      <div class="container">

        <!-- Loading State -->
        <div *ngIf="isLoading" class="loading">
          <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
          <span>טוען מנות...</span>
        </div>

        <!-- Dishes Grid -->
        <!-- Product Cards Grid - EXACT REFERENCE DESIGN -->
        <div class="menu-grid grid-4-cols" *ngIf="!isLoading">
          <div 
            *ngFor="let dish of mainDishes; trackBy: trackByItemId" 
            class="product-card"
            [class.is-unavailable]="!isAvailable(dish)"
          >
            <!-- Image Container -->
            <div class="card-image-container">
              <img 
                [src]="dish.imageUrl || '/assets/images/placeholder-dish.jpg'" 
                [alt]="dish.name"
                class="card-img"
                loading="lazy"
              >
            </div>
            
            <!-- Card Body -->
            <div class="card-body">
              <h3 class="card-title">{{ dish.name }}</h3>
              <p class="card-description">{{ dish.description }}</p>
              <div class="card-price">
                <span class="currency">₪</span>{{ getPrice(dish) }}
              </div>
              
              <!-- Card Actions -->
              <div class="card-actions">
                <button 
                  (click)="viewDetails(dish)" 
                  class="btn btn-details"
                  [attr.aria-label]="'פרטים על ' + dish.name"
                >
                  פרטים
                </button>
                <button 
                  (click)="addToCart(dish)" 
                  class="btn btn-cart"
                  [attr.aria-label]="'הוסף לסל ' + dish.name"
                  [disabled]="!isAvailable(dish)"
                >
                  <i class="fas fa-shopping-cart"></i>
                  הוספה לסל
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div *ngIf="!isLoading && mainDishes.length === 0" class="empty-state">
          <i class="fas fa-utensils" aria-hidden="true"></i>
          <h3>אין מנות עיקריות זמינות כרגע</h3>
          <p>אנחנו עובדים על הוספת מנות חדשות. חזור בקרוב!</p>
        </div>

        <!-- Featured Section -->
        <div class="featured-section" *ngIf="mainDishes.length > 0">
          <h2>המומלצים שלנו</h2>
          <div class="featured-grid">
            <div class="featured-card">
              <h4>צ'ולנט לשישי בלילה</h4>
              <p>צ'ולנט חם ומוכן לשישי בלילה, מוגש עם לחם טרי</p>
              <span class="featured-price">החל מ-₪{{ getMinPrice() }}</span>
            </div>
            <div class="featured-card">
              <h4>פרגית מלאה לשבת</h4>
              <p>פרגית שלמה ממולאת באורז וירקות, מספיקה ל-4-6 איש</p>
              <span class="featured-price">₪{{ getFeaturedPrice() }}</span>
            </div>
          </div>
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
      
      // The Title Text
      h2 {
        color: #1f3540; // Navy
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
        background: linear-gradient(to left, #E0C075, transparent);
        margin-left: 20px;
      }
      
      // Right Line: Gold -> Transparent
      &::after {
        background: linear-gradient(to right, #E0C075, transparent);
        margin-right: 20px;
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

    // === PIXEL-PERFECT PRODUCT CARD - EXACT ASADO REFERENCE ===
    .menu-grid {
      padding: 20px 0;
      margin-bottom: 4rem;
    }

    // Product Card Container
    .product-card {
      display: flex;
      flex-direction: column;
      height: 100%; // Ensures all cards in grid are same height
      background-color: #fff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
      transition: transform 0.2s ease, box-shadow 0.2s ease;
      padding-top: 24px; // White space at the top
      padding-left: 0;
      padding-right: 0;
      padding-bottom: 0;

      &:hover {
        transform: translateY(-4px);
        box-shadow: 0 8px 20px rgba(0, 0, 0, 0.12);
      }
    }

    // Unavailable State
    .product-card.is-unavailable {
      opacity: 0.6;
      .card-img {
        filter: grayscale(80%);
      }
    }

    // Image Container
    .card-image-container {
      width: 100%;
      height: 220px;
      overflow: hidden;
      background-color: #ffffff;
      border-radius: 0; // Sharp corners
      padding: 0;
      margin: 0;
      position: relative;

      .card-img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        object-position: center;
        display: block;
        border-radius: 0; // Sharp corners
      }
    }

    // Card Body (Content Area)
    .card-body {
      padding: 0 16px 16px 16px; // Padding on sides and bottom, no top padding
      text-align: center;
      flex-grow: 1;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      
      // Ensure consistent width for alignment
      > * {
        width: 100%;
      }
    }
    
    // Description should grow to push buttons down
    .card-description {
      flex-grow: 1;
    }

    // Title
    .card-title {
      font-family: 'Heebo', sans-serif;
      font-size: 1.3rem;
      font-weight: bold;
      color: #1a2b3c;
      margin: 0 0 8px 0;
      text-align: center;
    }

    // Description
    .card-description {
      font-size: 0.95rem;
      color: #555;
      line-height: 1.5;
      margin-bottom: 12px;
      max-width: 100%;
      flex-grow: 1;
    }

    // Price (Large Gold)
    .card-price {
      font-size: 1.2rem;
      font-weight: bold;
      color: var(--primary-gold);
      text-align: center;
      margin-bottom: 12px;

      .currency {
        font-size: 1rem;
        margin-left: 2px;
      }
    }

    // Card Actions (Buttons Section)
    .card-actions {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      width: 100%;
      margin-top: auto;
      padding: 0;
    }

    // Button Base Styles
    .btn {
      width: 100%;
      padding: 10px 20px;
      font-size: 0.95rem;
      font-weight: bold;
      cursor: pointer;
      border-radius: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      transition: all 0.2s ease;
      white-space: nowrap;
      height: 42px;
      text-align: center;
    }

    // Details Button (Secondary - Gold Border)
    .btn-details {
      background: transparent;
      border: 2px solid var(--primary-gold);
      color: var(--primary-gold);
      font-weight: bold;

      &:hover {
        background: rgba(224, 192, 117, 0.1);
        box-shadow: 0 2px 8px rgba(224, 192, 117, 0.2);
      }
    }

    // Cart Button (Primary - Solid Gold)
    .btn-cart {
      background: var(--primary-gold);
      border: none;
      color: #1f3540;
      font-weight: bold;
      box-shadow: 0 4px 10px rgba(224, 192, 117, 0.4);

      &:hover:not(:disabled) {
        background: rgba(224, 192, 117, 0.95);
        box-shadow: 0 6px 15px rgba(224, 192, 117, 0.5);
        transform: translateY(-1px);
      }

      &:disabled {
        background: #f5f5f5;
        border: none;
        color: #999;
        cursor: not-allowed;
        box-shadow: none;
      }

      i {
        color: #1f3540;
      }
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

    .featured-section {
      margin-top: 4rem;
      padding-top: 3rem;
      border-top: 2px solid #f8f9fa;
    }

    .featured-section h2 {
      text-align: center;
      color: #0E1A24;
      margin-bottom: 2rem;
    }

    .featured-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 2rem;
    }

    .featured-card {
      background: linear-gradient(135deg, #0E1A24 0%, #1A2B37 100%);
      color: white;
      padding: 2rem;
      border-radius: 1rem;
      text-align: center;
    }

    .featured-card h4 {
      color: #cbb69e;
      margin-bottom: 1rem;
      font-size: 1.25rem;
    }

    .featured-card p {
      margin-bottom: 1rem;
      opacity: 0.9;
      line-height: 1.6;
    }

    .featured-price {
      font-weight: bold;
      color: #cbb69e;
      font-size: 1.2rem;
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

  mainDishes: MenuItem[] = [];
  isLoading = true;

  // REMOVED: Hardcoded featuredMainDishes array
  // All data now comes from MenuService (Single Source of Truth)
  // This ensures consistency and prevents "Product not found" errors
  featuredMainDishes: any[] = []; // Deprecated - kept for backward compatibility only

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
      price: price,
      imageUrl: item.imageUrl,
      description: item.description,
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

  getMinPrice(): number {
    // Calculate minimum price from all main dishes
    if (this.mainDishes.length === 0) return 38; // Fallback
    
    const prices = this.mainDishes
      .map(dish => this.getPrice(dish))
      .filter(price => price > 0);
    
    return prices.length > 0 ? Math.min(...prices) : 38;
  }

  getFeaturedPrice(): number {
    // Return a featured price (could be average or specific dish price)
    if (this.mainDishes.length === 0) return 65; // Fallback
    
    const prices = this.mainDishes
      .map(dish => this.getPrice(dish))
      .filter(price => price > 0);
    
    if (prices.length === 0) return 65;
    
    // Return average price rounded
    const avg = prices.reduce((sum, p) => sum + p, 0) / prices.length;
    return Math.round(avg);
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
      // Use SHORT route path: 'main' instead of 'main-dishes'
      this.router.navigate(['/ready-for-shabbat/main', dishId]);
    }
  }
}