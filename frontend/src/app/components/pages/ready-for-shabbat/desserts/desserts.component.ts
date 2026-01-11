import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';

import { MenuService, MenuItem } from '../../../../services/menu.service';
import { CartService } from '../../../../services/cart.service';
import { LanguageService } from '../../../../services/language.service';

@Component({
  selector: 'app-desserts',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="desserts-page">
      <div class="container">
        <div class="page-header">
          <h1>קינוחים ביתיים</h1>
          <p class="page-description">קינוחים מתוקים וקרמיים לסיום מושלם של הסעודה השבתית</p>
          <div class="header-icons">
            <div class="icon-item">
              <i class="fas fa-birthday-cake" aria-hidden="true"></i>
              <span>טרי מהתנור</span>
            </div>
            <div class="icon-item">
              <i class="fas fa-heart" aria-hidden="true"></i>
              <span>מתכונים ביתיים</span>
            </div>
            <div class="icon-item">
              <i class="fas fa-star" aria-hidden="true"></i>
              <span>איכות פרימיום</span>
            </div>
          </div>
        </div>

        <!-- Loading State -->
        <div *ngIf="isLoading" class="loading">
          <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
          <span>טוען קינוחים מתוקים...</span>
        </div>

        <!-- Desserts Grid -->
        <div class="menu-grid" *ngIf="!isLoading">
          <div 
            *ngFor="let dessert of desserts; trackBy: trackByItemId" 
            class="dessert-card featured-style"
            [class.is-unavailable]="!isAvailable(dessert)"
          >
            <div class="item-image">
              <img 
                [src]="dessert.imageUrl || '/assets/images/placeholder-dish.jpg'" 
                [alt]="dessert.name"
                loading="lazy"
              >
              <!-- Popular Badge -->
              <span class="badge badge-popular" *ngIf="dessert.isPopular === true">מומלץ</span>
              <!-- Out of Stock Badge -->
              <span class="badge badge-out-of-stock" *ngIf="!isAvailable(dessert)">לא קיים זמנית</span>
            </div>
            
            <div class="item-content">
              <h3 class="item-name">{{ dessert.name }}</h3>
              <p class="item-description">{{ dessert.description }}</p>
              
              <div class="item-details">
                <div class="serving-size" *ngIf="getServingSize(dessert)">
                  <span class="serving-label">כמות מומלצת למנה:</span>
                  <span class="serving-value">{{ getServingSize(dessert) }}</span>
                </div>
                
                <div class="container-icons">
                  <div class="container-icon"></div>
                  <div class="container-icon round"></div>
                  <div class="container-icon small"></div>
                </div>
              </div>
              
              <div class="item-footer">
                <div class="price-section">
                  <span class="price">₪{{ getPrice(dessert) }}</span>
                  <span class="price-per">ל-100 גרם</span>
                </div>
                
                <button 
                  (click)="addToCart(dessert)" 
                  class="btn-select-delivery"
                  [attr.aria-label]="getAriaLabel(dessert)"
                  [disabled]="!isAvailable(dessert)"
                >
                  בחרו פרטי אספקה
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div *ngIf="!isLoading && desserts.length === 0" class="empty-state">
          <i class="fas fa-birthday-cake" aria-hidden="true"></i>
          <h3>אין קינוחים זמינים כרגע</h3>
          <p>אנחנו מכינים קינוחים טריים מדי יום. חזור בקרוב!</p>
        </div>

        <!-- Special Offers Section -->
        <div class="special-offers" *ngIf="desserts.length > 0">
          <h2>הצעות מיוחדות</h2>
          <div class="offers-grid">
            <div class="offer-card family">
              <div class="offer-header">
                <i class="fas fa-users" aria-hidden="true"></i>
                <h4>חבילת קינוחים משפחתית</h4>
              </div>
              <div class="offer-content">
                <p>3 קינוחים לבחירה + עוגת דבש גדולה</p>
                <div class="offer-price">
                  <span class="old-price">₪140</span>
                  <span class="new-price">₪110</span>
                </div>
                <div class="offer-savings">חסכון של ₪30!</div>
              </div>
            </div>

            <div class="offer-card weekend">
              <div class="offer-header">
                <i class="fas fa-calendar-week" aria-hidden="true"></i>
                <h4>מגש קינוחים לסוף השבוע</h4>
              </div>
              <div class="offer-content">
                <p>מגש מעורב: טירמיסו, מוס שוקולד, מלבי</p>
                <div class="offer-price">
                  <span class="new-price">₪85</span>
                </div>
                <div class="offer-note">מספיק ל-6-8 אנשים</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Tips Section -->
        <div class="dessert-tips">
          <h3>טיפים לאחסון והגשה</h3>
          <div class="tips-grid">
            <div class="tip-card">
              <i class="fas fa-snowflake" aria-hidden="true"></i>
              <h5>אחסון</h5>
              <p>שמרו במקרר עד 3 ימים לטריות מירבית</p>
            </div>
            
            <div class="tip-card">
              <i class="fas fa-thermometer-half" aria-hidden="true"></i>
              <h5>טמפרטורה</h5>
              <p>הוציאו מהמקרר 15 דקות לפני ההגשה</p>
            </div>
            
            <div class="tip-card">
              <i class="fas fa-leaf" aria-hidden="true"></i>
              <h5>קישוט</h5>
              <p>נענע טרייה או פירות יער משדרגים את המראה</p>
            </div>
            
            <div class="tip-card">
              <i class="fas fa-wine-glass" aria-hidden="true"></i>
              <h5>הגשה</h5>
              <p>מתאים לכוסיות יפות או צלחות קינוח</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .desserts-page {
      padding: 2rem 0;
      min-height: 80vh;
      background: linear-gradient(to bottom, #fafafa 0%, #ffffff 100%);
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 2rem;
    }

    .page-header {
      text-align: center;
      margin-bottom: 4rem;
    }

    .page-header h1 {
      color: #8B4513;
      font-size: 2.8rem;
      margin-bottom: 1rem;
      font-weight: bold;
      text-shadow: 1px 1px 2px rgba(0,0,0,0.1);
    }

    .page-description {
      font-size: 1.3rem;
      color: #6c757d;
      max-width: 700px;
      margin: 0 auto 2rem;
      line-height: 1.6;
    }

    .header-icons {
      display: flex;
      justify-content: center;
      gap: 3rem;
      flex-wrap: wrap;
    }

    .icon-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      color: #8B4513;
      font-weight: 600;
    }

    .icon-item i {
      font-size: 1.2rem;
      color: #D2691E;
    }

    .loading {
      text-align: center;
      padding: 4rem 0;
      color: #8B4513;
    }

    .loading i {
      font-size: 2.5rem;
      margin-bottom: 1rem;
      color: #D2691E;
    }

    .menu-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 2rem;
      margin-bottom: 5rem;
    }

    .dessert-card {
      background: white;
      border-radius: 1.5rem;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
      overflow: hidden;
      transition: all 0.4s ease;
      border: 2px solid rgba(210, 105, 30, 0.1);
      position: relative;
    }

    .dessert-card.featured-style {
      display: flex;
      flex-direction: column;
    }

    .dessert-card.premium::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 4px;
      background: linear-gradient(90deg, #FFD700, #FFA500, #FF6347);
    }

    .dessert-card:hover {
      transform: translateY(-10px) scale(1.02);
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
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
      transition: transform 0.4s ease, filter 0.3s ease;
      border-radius: 12px 12px 0 0;
      display: block;
    }

    .dessert-card:hover .item-image img {
      transform: scale(1.1);
    }

    .dessert-card.is-unavailable:hover .item-image img {
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
    .dessert-card.is-unavailable {
      opacity: 0.6;
    }

    .dessert-card.is-unavailable .item-image {
      filter: grayscale(80%);
    }

    .dessert-card.is-unavailable .order-btn {
      pointer-events: none;
    }

    .item-content {
      padding: 2rem;
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
      padding: 5rem 0;
      color: #8B4513;
    }

    .empty-state i {
      font-size: 5rem;
      color: #D2691E;
      margin-bottom: 1.5rem;
    }

    /* Special Offers */
    .special-offers {
      margin: 5rem 0;
      padding: 3rem 0;
      background: linear-gradient(135deg, #8B4513 0%, #A0522D 100%);
      margin-left: -2rem;
      margin-right: -2rem;
      padding-left: 2rem;
      padding-right: 2rem;
      color: white;
    }

    .special-offers h2 {
      text-align: center;
      margin-bottom: 3rem;
      font-size: 2.2rem;
      color: #FFD700;
    }

    .offers-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 2rem;
    }

    .offer-card {
      background: rgba(255, 255, 255, 0.1);
      padding: 2rem;
      border-radius: 1.5rem;
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.2);
    }

    .offer-header {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 1rem;
    }

    .offer-header i {
      font-size: 1.5rem;
      color: #FFD700;
    }

    .offer-header h4 {
      color: #FFD700;
      margin: 0;
      font-size: 1.2rem;
    }

    .offer-content p {
      margin-bottom: 1rem;
      opacity: 0.9;
    }

    .offer-price {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 0.5rem;
    }

    .old-price {
      text-decoration: line-through;
      opacity: 0.7;
    }

    .new-price {
      font-size: 1.5rem;
      font-weight: bold;
      color: #FFD700;
    }

    .offer-savings {
      color: #90EE90;
      font-weight: 600;
    }

    .offer-note {
      font-size: 0.9rem;
      opacity: 0.8;
      font-style: italic;
    }

    /* Tips Section */
    .dessert-tips {
      margin-top: 4rem;
      padding: 3rem;
      background: rgba(210, 105, 30, 0.05);
      border-radius: 2rem;
    }

    .dessert-tips h3 {
      text-align: center;
      color: #8B4513;
      margin-bottom: 2rem;
      font-size: 1.8rem;
    }

    .tips-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1.5rem;
    }

    .tip-card {
      background: white;
      padding: 1.5rem;
      border-radius: 1rem;
      text-align: center;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
      border-top: 3px solid #D2691E;
    }

    .tip-card i {
      font-size: 2rem;
      color: #D2691E;
      margin-bottom: 1rem;
    }

    .tip-card h5 {
      color: #8B4513;
      margin-bottom: 0.75rem;
      font-size: 1.1rem;
    }

    .tip-card p {
      color: #6c757d;
      font-size: 0.9rem;
      line-height: 1.4;
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
        font-size: 2.2rem;
      }

      .header-icons {
        flex-direction: column;
        align-items: center;
        gap: 1rem;
      }

      .item-footer {
        flex-direction: column;
        gap: 1rem;
        align-items: stretch;
      }

      .add-to-cart-btn {
        justify-content: center;
      }

      .offers-grid {
        grid-template-columns: 1fr;
      }

      .tips-grid {
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      }
    }
  `]
})
export class DessertsComponent implements OnInit {
  menuService = inject(MenuService);
  cartService = inject(CartService);
  languageService = inject(LanguageService);

  desserts: MenuItem[] = [];
  isLoading = true;

  featuredDesserts = [
    {
      id: 'malabi',
      name: 'מלבי',
      description: 'מלבי קרמי עם סירופ רימונים ופיסטוקים.',
      recommendedServing: 'כ-150 מ"ל',
      pricePer100g: 8.5,
      imageUrl: '/assets/images/placeholder-dish.jpg',
      tags: ['חלבי', 'מתוק']
    },
    {
      id: 'tiramisu',
      name: 'טירמיסו',
      description: 'טירמיסו איטלקי קלאסי עם קפה ומסקרפונה.',
      recommendedServing: 'כ-120 גרם',
      pricePer100g: 12.0,
      imageUrl: '/assets/images/placeholder-dish.jpg',
      tags: ['חלבי', 'מיוחד']
    },
    {
      id: 'chocolate-mousse',
      name: 'מוס שוקולד',
      description: 'מוס שוקולד מריר קרמי עם קצפת.',
      recommendedServing: 'כ-100 גרם',
      pricePer100g: 10.5,
      imageUrl: '/assets/images/placeholder-dish.jpg',
      tags: ['חלבי', 'מתוק']
    },
    {
      id: 'honey-cake',
      name: 'עוגת דבש',
      description: 'עוגת דבש מסורתית עם תבלינים וקפה.',
      recommendedServing: 'כ-80 גרם',
      pricePer100g: 9.0,
      imageUrl: '/assets/images/placeholder-dish.jpg',
      tags: ['מסורתי', 'מתוק']
    },
    {
      id: 'fruit-salad',
      name: 'סלט פירות',
      description: 'סלט פירות טריים עם דבש ונענע.',
      recommendedServing: 'כ-200 גרם',
      pricePer100g: 7.5,
      imageUrl: '/assets/images/placeholder-dish.jpg',
      tags: ['בריא', 'טבעוני']
    }
  ];

  ngOnInit(): void {
    this.loadDesserts();
  }

  private loadDesserts(): void {
    this.isLoading = true;
    this.menuService.getMenuItems().subscribe({
      next: (items) => {
        const apiDesserts = items.filter(item => item.category === 'קינוחים');
        this.desserts = apiDesserts.length > 0 ? apiDesserts : this.featuredDesserts.map(d => ({
          id: d.id,
          name: d.name,
          description: d.description,
          price: d.pricePer100g * 1.5,
          imageUrl: d.imageUrl,
          category: 'קינוחים',
          tags: d.tags,
          isAvailable: true,
          servingSize: d.recommendedServing,
          pricePer100g: d.pricePer100g
        } as MenuItem & { pricePer100g: number; recommendedServing: string }));
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading desserts:', error);
        this.desserts = this.featuredDesserts.map(d => ({
          id: d.id,
          name: d.name,
          description: d.description,
          price: d.pricePer100g * 1.5,
          imageUrl: d.imageUrl,
          category: 'קינוחים',
          tags: d.tags,
          isAvailable: true,
          servingSize: d.recommendedServing,
          pricePer100g: d.pricePer100g
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

  getServingSize(dessert: MenuItem): string {
    return (dessert as any).recommendedServing || dessert.servingSize || '';
  }

  getPrice(dessert: MenuItem): number {
    return (dessert as any).pricePer100g || dessert.price || 0;
  }

  getAriaLabel(dessert: MenuItem): string {
    return 'בחרו פרטי אספקה עבור ' + dessert.name;
  }

  isAvailable(dessert: MenuItem): boolean {
    return dessert.isAvailable !== false;
  }
}