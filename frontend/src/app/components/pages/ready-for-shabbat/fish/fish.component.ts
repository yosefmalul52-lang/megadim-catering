import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

import { MenuService, MenuItem } from '../../../../services/menu.service';
import { CartService } from '../../../../services/cart.service';
import { LanguageService } from '../../../../services/language.service';

@Component({
  selector: 'app-fish',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="fish-page">
      <div class="container">
        <div class="page-header">
          <h1>דגים</h1>
          <p class="page-description">מבחר דגים טריים ומעולים לשבת וחג</p>
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
                    <span class="price-label">מחיר ליחידה:</span>
                    <span class="price-value">₪{{ getPrice(fish) }}</span>
                  </div>
                  <div class="weight-note">
                    <span class="asterisk">*</span>
                    <span class="weight-text">משקל משוער ליחידה: 170 גרם</span>
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
                    הוסף לסל
                  </button>
                  
                  <button 
                    (click)="showDetails(fish)" 
                    class="btn btn-details"
                    [attr.aria-label]="'פרטים על ' + fish.name"
                  >
                    <i class="fas fa-info-circle"></i>
                    פרטים
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
    .fish-page {
      padding: 2rem 0;
      min-height: 70vh;
      background-color: #fdf5f0;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 2rem;
    }

    .page-header {
      text-align: center;
      margin-bottom: 3rem;
    }

    .page-header h1 {
      color: #0E1A24;
      font-size: 2.5rem;
      margin-bottom: 1rem;
      font-weight: bold;
    }

    .page-description {
      font-size: 1.2rem;
      color: #6c757d;
      max-width: 600px;
      margin: 0 auto;
      line-height: 1.6;
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

    .menu-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 2rem;
      margin-bottom: 4rem;
      width: 100%;
    }

    .menu-item-card {
      background: white;
      border-radius: 0;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
      overflow: hidden;
      transition: all 0.3s ease;
      border: 1px solid rgba(203, 182, 158, 0.2);
      width: 100%;
      display: flex;
      flex-direction: column;
    }

    .menu-item-card.featured-style {
      display: flex;
      flex-direction: column;
    }

    .menu-item-card:hover {
      transform: translateY(-8px);
      box-shadow: 0 16px 32px rgba(0, 0, 0, 0.15);
    }

    .item-image {
      position: relative;
      height: 280px;
      width: 100%;
      overflow: hidden;
      background: #f5f5f5;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 0;
      flex-shrink: 0;
    }

    .item-image img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: center;
      transition: transform 0.3s ease, filter 0.3s ease;
      border-radius: 0;
      display: block;
    }

    .menu-item-card:hover .item-image img {
      transform: scale(1.05);
    }

    .menu-item-card.is-unavailable:hover .item-image img {
      transform: scale(1);
    }

    /* Badge Styles - Elegant and Professional */
    .badge {
      position: absolute;
      z-index: 10;
      padding: 4px 12px;
      border-radius: 4px;
      font-weight: 500;
      font-size: 0.8rem;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      text-align: center;
      letter-spacing: 0.3px;
      line-height: 1.4;
    }

    .badge-popular {
      top: 10px;
      right: 10px;
      background: #dc3545;
      color: white;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
    }

    .badge-out-of-stock {
      top: 10px;
      right: 10px;
      background: #7a7a7a;
      color: white;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
    }

    /* When popular badge exists, move out-of-stock badge to left */
    .item-image:has(.badge-popular) .badge-out-of-stock {
      right: auto;
      left: 10px;
    }

    /* Unavailable State */
    .menu-item-card.is-unavailable {
      opacity: 0.6;
    }

    .menu-item-card.is-unavailable .item-image {
      filter: grayscale(80%);
    }

    .menu-item-card.is-unavailable .btn-select-delivery {
      pointer-events: none;
    }

    .item-content {
      padding: 1.5rem 1.25rem;
      display: flex;
      flex-direction: column;
      flex-grow: 1;
      justify-content: space-between;
    }

    .item-name {
      font-size: 1.8rem;
      font-weight: bold;
      color: #0E1A24;
      margin-bottom: 0.75rem;
    }

    .item-description {
      color: #6c757d;
      line-height: 1.6;
      margin-bottom: 1rem;
      font-size: 0.95rem;
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
      background: #f8f9fa;
      border-radius: 0.5rem;
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
      color: #0E1A24;
    }

    .weight-note {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      font-size: 0.85rem;
      color: #6c757d;
    }

    .asterisk {
      color: #cbb69e;
      font-weight: bold;
    }

    .weight-text {
      color: #6c757d;
    }

    .buttons-group {
      display: flex;
      gap: 0.875rem;
      width: 100%;
      justify-content: stretch;
      align-items: stretch;
    }

    .btn {
      flex: 1 1 0;
      min-width: 0;
      padding: 1rem 0.875rem;
      border: none;
      border-radius: 0.5rem;
      font-weight: 700;
      font-size: 0.95rem;
      cursor: pointer;
      transition: all 0.3s ease;
      white-space: nowrap;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      width: 100%;
      height: 48px;
      box-sizing: border-box;
    }

    .btn i {
      font-size: 1rem;
      flex-shrink: 0;
    }

    .btn-add-to-cart {
      background: #cbb69e;
      color: #0E1A24;
      box-shadow: 0 2px 4px rgba(203, 182, 158, 0.2);
    }

    .btn-add-to-cart:hover:not(:disabled) {
      background: #b8a48a;
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(203, 182, 158, 0.3);
    }

    .btn-add-to-cart:disabled {
      background: #ccc;
      color: #666;
      cursor: not-allowed;
      box-shadow: none;
    }

    .btn-details {
      background: #f5f5f5;
      color: #0E1A24;
      border: 2px solid #cbb69e;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
    }

    .btn-details:hover {
      background: #e8e8e8;
      border-color: #b8a48a;
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(203, 182, 158, 0.2);
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

    /* Responsive Design */
    @media (max-width: 1200px) {
      .menu-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    @media (max-width: 900px) {
      .menu-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    @media (max-width: 768px) {
      .menu-grid {
        grid-template-columns: 1fr;
      }

      .page-header h1 {
        font-size: 2rem;
      }

      .item-footer {
        flex-direction: column;
        gap: 1rem;
        align-items: stretch;
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

