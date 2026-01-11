import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';

import { MenuService, MenuItem } from '../../../../services/menu.service';
import { CartService } from '../../../../services/cart.service';
import { LanguageService } from '../../../../services/language.service';

@Component({
  selector: 'app-side-dishes',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="side-dishes-page">
      <div class="container">
        <div class="page-header">
          <h1>תוספות שבתיות</h1>
          <p class="page-description">תוספות טעימות ומגוונות שישלימו את הסעודה השבתית שלכם</p>
        </div>

        <!-- Loading State -->
        <div *ngIf="isLoading" class="loading">
          <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
          <span>טוען תוספות...</span>
        </div>

        <!-- Sides Grid -->
        <div class="menu-grid" *ngIf="!isLoading">
          <div 
            *ngFor="let side of sideDishes; trackBy: trackByItemId" 
            class="menu-item-card featured-style"
            [class.is-unavailable]="!isAvailable(side)"
          >
            <div class="item-image">
              <img 
                [src]="side.imageUrl || '/assets/images/placeholder-dish.jpg'" 
                [alt]="side.name"
                loading="lazy"
              >
              <!-- Popular Badge -->
              <span class="badge badge-popular" *ngIf="side.isPopular === true">מומלץ</span>
              <!-- Out of Stock Badge -->
              <span class="badge badge-out-of-stock" *ngIf="!isAvailable(side)">לא קיים זמנית</span>
            </div>
            
            <div class="item-content">
              <h3 class="item-name">{{ side.name }}</h3>
              <p class="item-description">{{ side.description }}</p>
              
              <div class="item-details">
                <div class="serving-size" *ngIf="getServingSize(side)">
                  <span class="serving-label">כמות מומלצת למנה:</span>
                  <span class="serving-value">{{ getServingSize(side) }}</span>
                </div>
                
                <div class="container-icons">
                  <div class="container-icon"></div>
                  <div class="container-icon round"></div>
                  <div class="container-icon small"></div>
                </div>
              </div>
              
              <div class="item-footer">
                <div class="price-section">
                  <span class="price">₪{{ getPrice(side) }}</span>
                  <span class="price-per">ל-100 גרם</span>
                </div>
                
                <button 
                  (click)="addToCart(side)" 
                  class="btn-select-delivery"
                  [attr.aria-label]="getAriaLabel(side)"
                  [disabled]="!isAvailable(side)"
                >
                  בחרו פרטי אספקה
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div *ngIf="!isLoading && sideDishes.length === 0" class="empty-state">
          <i class="fas fa-utensils" aria-hidden="true"></i>
          <h3>אין תוספות זמינות כרגע</h3>
          <p>אנחנו עובדים על הוספת תוספות חדשות. חזור בקרוב!</p>
        </div>

        <!-- Recommendation Section -->
        <div class="recommendation-section" *ngIf="sideDishes.length > 0">
          <h2>המלצות שלנו</h2>
          <div class="recommendations-grid">
            <div class="recommendation-card">
              <i class="fas fa-leaf" aria-hidden="true"></i>
              <h4>תוספות לדגים</h4>
              <p>אורז בסמטי עם תבלינים + ירקות גריל</p>
              <span class="combo-note">שילוב מושלם לארוחת דגים</span>
            </div>
            
            <div class="recommendation-card">
              <i class="fas fa-drumstick-bite" aria-hidden="true"></i>
              <h4>תוספות לבשר</h4>
              <p>תפוחי אדמה ברוזמרין + קוגל תפוחי אדמה</p>
              <span class="combo-note">קלאסי ומשביע לארוחות בשר</span>
            </div>
            
            <div class="recommendation-card">
              <i class="fas fa-seedling" aria-hidden="true"></i>
              <h4>תוספות צמחוניות</h4>
              <p>פתיתים באלפרדו + ירקות גריל צבעוניים</p>
              <span class="combo-note">עשיר בחלבון ובטעם</span>
            </div>
          </div>
        </div>

        <!-- Tips Section -->
        <div class="tips-section">
          <h3>טיפים להגשה</h3>
          <div class="tips-grid">
            <div class="tip-item">
              <i class="fas fa-thermometer-half" aria-hidden="true"></i>
              <span>מומלץ לחמם את התוספות לפני ההגשה</span>
            </div>
            <div class="tip-item">
              <i class="fas fa-users" aria-hidden="true"></i>
              <span>כל מנת תוספת מספיקה ל-2-3 אנשים</span>
            </div>
            <div class="tip-item">
              <i class="fas fa-clock" aria-hidden="true"></i>
              <span>ההזמנה מתקבלת עד יום חמישי 14:00</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .side-dishes-page {
      padding: 2rem 0;
      min-height: 70vh;
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
    }

    .menu-item-card {
      background: white;
      border-radius: 1rem;
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.1);
      overflow: hidden;
      transition: all 0.3s ease;
      border: 1px solid rgba(224, 192, 117, 0.2);
    }

    .menu-item-card.featured-style {
      display: flex;
      flex-direction: column;
    }

    .menu-item-card:hover {
      transform: translateY(-6px);
      box-shadow: 0 12px 28px rgba(0, 0, 0, 0.15);
    }

    .item-image {
      position: relative;
      height: 220px;
      overflow: hidden;
      background: #f5f5f5;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 12px 12px 0 0;
    }

    .item-image img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: center;
      transition: transform 0.3s ease, filter 0.3s ease;
      border-radius: 12px 12px 0 0;
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

    .item-tags {
      position: absolute;
      top: 0.75rem;
      right: 0.75rem;
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
    }

    .tag {
      background: rgba(255, 255, 255, 0.9);
      padding: 0.2rem 0.6rem;
      border-radius: 0.8rem;
      font-size: 0.7rem;
      font-weight: 600;
      color: #0E1A24;
      backdrop-filter: blur(5px);
    }

    .tag.popular {
      background: linear-gradient(135deg, #cbb69e, #d4c4a8);
      color: white;
    }

    .tag.traditional {
      background: rgba(139, 69, 19, 0.9);
      color: white;
    }

    .tag.vegan {
      background: rgba(76, 175, 80, 0.9);
      color: white;
    }

    .tag.gluten-free {
      background: rgba(255, 193, 7, 0.9);
      color: #0E1A24;
    }

    .item-content {
      padding: 1.25rem;
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

    .item-details {
      margin-bottom: 1.5rem;
      font-size: 0.9rem;
    }

    .serving-size {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      margin-bottom: 0.75rem;
      color: #6c757d;
    }

    .serving-label {
      font-size: 0.85rem;
      color: #999;
    }

    .serving-value {
      font-weight: 600;
      color: #0E1A24;
    }

    .container-icons {
      display: flex;
      gap: 0.75rem;
      margin-top: 0.5rem;
      padding: 0.5rem 0;
    }

    .container-icon {
      width: 24px;
      height: 24px;
      border: 2px solid #ddd;
      border-radius: 4px;
      background: transparent;
    }

    .container-icon.round {
      border-radius: 50%;
      width: 28px;
      height: 28px;
    }

    .container-icon.small {
      width: 20px;
      height: 20px;
      border-radius: 50%;
    }

    .item-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .price-section {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .price {
      font-size: 1.5rem;
      font-weight: bold;
      color: #0E1A24;
    }

    .price-per {
      font-size: 0.9rem;
      color: #6c757d;
    }

    .btn-select-delivery {
      padding: 0.875rem 1.25rem;
      border: none;
      border-radius: 0.5rem;
      background: #cbb69e;
      color: #0E1A24;
      font-weight: 700;
      font-size: 0.95rem;
      cursor: pointer;
      transition: all 0.3s ease;
      white-space: nowrap;
    }

    .btn-select-delivery:hover:not(:disabled) {
      background: #b8a48a;
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(224, 192, 117, 0.3);
    }

    .btn-select-delivery:disabled {
      background: #ccc;
      color: #666;
      cursor: not-allowed;
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

    /* Recommendation Section */
    .recommendation-section {
      margin: 4rem 0;
      padding: 3rem 0;
      background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
      margin-left: -2rem;
      margin-right: -2rem;
      padding-left: 2rem;
      padding-right: 2rem;
    }

    .recommendation-section h2 {
      text-align: center;
      color: #0E1A24;
      margin-bottom: 2.5rem;
      font-size: 1.8rem;
    }

    .recommendations-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 1.5rem;
    }

    .recommendation-card {
      background: white;
      padding: 1.5rem;
      border-radius: 1rem;
      text-align: center;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      border-left: 4px solid #cbb69e;
    }

    .recommendation-card i {
      font-size: 2rem;
      color: #cbb69e;
      margin-bottom: 1rem;
    }

    .recommendation-card h4 {
      color: #0E1A24;
      margin-bottom: 0.75rem;
      font-size: 1.1rem;
    }

    .recommendation-card p {
      color: #6c757d;
      margin-bottom: 0.75rem;
      font-size: 0.9rem;
    }

    .combo-note {
      font-size: 0.8rem;
      color: #cbb69e;
      font-style: italic;
    }

    /* Tips Section */
    .tips-section {
      margin-top: 3rem;
      padding: 2rem;
      background: rgba(224, 192, 117, 0.1);
      border-radius: 1rem;
    }

    .tips-section h3 {
      color: #0E1A24;
      margin-bottom: 1.5rem;
      text-align: center;
    }

    .tips-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 1rem;
    }

    .tip-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 1rem;
      background: white;
      border-radius: 0.5rem;
      font-size: 0.9rem;
      color: #6c757d;
    }

    .tip-item i {
      color: #cbb69e;
      font-size: 1.1rem;
    }

    /* Responsive Design */
    @media (max-width: 1024px) {
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
        gap: 0.75rem;
        align-items: stretch;
      }

      .add-to-cart-btn {
        justify-content: center;
      }

      .recommendations-grid {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class SideDishesComponent implements OnInit {
  menuService = inject(MenuService);
  cartService = inject(CartService);
  languageService = inject(LanguageService);

  sideDishes: MenuItem[] = [];
  isLoading = true;

  featuredSideDishes = [
    {
      id: 'rice',
      name: 'אורז בסמטי',
      description: 'אורז בסמטי מבושל עם תבלינים ועשבי תיבול.',
      recommendedServing: 'כ-200 גרם',
      pricePer100g: 6.5,
      imageUrl: '/assets/images/placeholder-dish.jpg',
      tags: ['טבעוני', 'ללא גלוטן']
    },
    {
      id: 'potato-kugel',
      name: 'קוגל תפוחי אדמה',
      description: 'קוגל תפוחי אדמה מסורתי, פריך מבחוץ ורך מבפנים.',
      recommendedServing: 'כ-250 גרם',
      pricePer100g: 7.0,
      imageUrl: '/assets/images/placeholder-dish.jpg',
      tags: ['מסורתי', 'שבתי']
    },
    {
      id: 'grilled-vegetables',
      name: 'ירקות גריל',
      description: 'מגוון ירקות צבעוניים צלויים בגריל עם שמן זית.',
      recommendedServing: 'כ-180 גרם',
      pricePer100g: 8.0,
      imageUrl: '/assets/images/placeholder-dish.jpg',
      tags: ['טבעוני', 'בריא']
    },
    {
      id: 'pasta',
      name: 'פתיתים באלפרדו',
      description: 'פתיתים ברוטב אלפרדו קרמי עם פטריות.',
      recommendedServing: 'כ-220 גרם',
      pricePer100g: 7.5,
      imageUrl: '/assets/images/placeholder-dish.jpg',
      tags: ['חלבי', 'מסורתי']
    },
    {
      id: 'couscous',
      name: 'קוסקוס',
      description: 'קוסקוס פלפל עם ירקות ותבלינים.',
      recommendedServing: 'כ-200 גרם',
      pricePer100g: 6.8,
      imageUrl: '/assets/images/placeholder-dish.jpg',
      tags: ['טבעוני', 'בריא']
    }
  ];

  ngOnInit(): void {
    this.loadSideDishes();
  }

  private loadSideDishes(): void {
    this.isLoading = true;
    this.menuService.getMenuItems().subscribe({
      next: (items) => {
        const apiSides = items.filter(item => item.category === 'תוספות');
        this.sideDishes = apiSides.length > 0 ? apiSides : this.featuredSideDishes.map(s => ({
          id: s.id,
          name: s.name,
          description: s.description,
          price: s.pricePer100g * 2,
          imageUrl: s.imageUrl,
          category: 'תוספות',
          tags: s.tags,
          isAvailable: true,
          servingSize: s.recommendedServing,
          pricePer100g: s.pricePer100g
        } as MenuItem & { pricePer100g: number; recommendedServing: string }));
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading side dishes:', error);
        this.sideDishes = this.featuredSideDishes.map(s => ({
          id: s.id,
          name: s.name,
          description: s.description,
          price: s.pricePer100g * 2,
          imageUrl: s.imageUrl,
          category: 'תוספות',
          tags: s.tags,
          isAvailable: true,
          servingSize: s.recommendedServing,
          pricePer100g: s.pricePer100g
        } as MenuItem & { pricePer100g: number; recommendedServing: string }));
        this.isLoading = false;
      }
    });
  }

  addToCart(item: MenuItem): void {
    if (!item.isAvailable) return;

    // Get price from item - handle both single price and variants
    let price = item.price;
    
    // If no price and has variants, use first variant price
    if (price === undefined || price === null) {
      if (item.pricingVariants && item.pricingVariants.length > 0) {
        price = item.pricingVariants[0].price;
      } else {
        console.error(`Cannot add ${item.name} to cart: no price available`);
        alert('לא ניתן להוסיף את הפריט לסל - אין מחיר זמין');
        return;
      }
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

  getServingSize(side: MenuItem): string {
    return (side as any).recommendedServing || side.servingSize || '';
  }

  getPrice(side: MenuItem): number {
    return (side as any).pricePer100g || side.price || 0;
  }

  getAriaLabel(side: MenuItem): string {
    return 'בחרו פרטי אספקה עבור ' + side.name;
  }

  isAvailable(side: MenuItem): boolean {
    return side.isAvailable !== false;
  }
}