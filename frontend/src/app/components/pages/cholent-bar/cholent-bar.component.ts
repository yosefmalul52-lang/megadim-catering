import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';

import { MenuService, MenuItem } from '../../../services/menu.service';
import { CartService } from '../../../services/cart.service';
import { LanguageService } from '../../../services/language.service';

@Component({
  selector: 'app-cholent-bar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="cholent-page">
      <div class="container">
        <!-- Hero Section -->
        <div class="hero-section">
          <div class="hero-content">
            <h1>צ'ולנט בר מגדים</h1>
            <p class="hero-subtitle">צ'ולנט חם וטעים לשישי בלילה, מוצאי שבת ואירועים מיוחדים</p>
            <div class="hero-features">
              <div class="feature">
                <i class="fas fa-fire" aria-hidden="true"></i>
                <span>חם ורותח</span>
              </div>
              <div class="feature">
                <i class="fas fa-clock" aria-hidden="true"></i>
                <span>זמין משישי 18:00</span>
              </div>
              <div class="feature">
                <i class="fas fa-star" aria-hidden="true"></i>
                <span>מתכון מסורתי</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Loading State -->
        <div *ngIf="isLoading" class="loading">
          <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
          <span>טוען מנות צ'ולנט...</span>
        </div>

        <!-- Cholent Menu -->
        <div class="cholent-menu" *ngIf="!isLoading">
          <h2>מגוון הצ'ולנט שלנו</h2>
          
          <div class="menu-grid">
            <div 
              *ngFor="let cholent of cholentItems; trackBy: trackByItemId" 
              class="cholent-card"
              [class.is-unavailable]="!cholent.isAvailable"
            >
              <div class="card-image">
                <img 
                  [src]="cholent.imageUrl || '/assets/images/placeholder-dish.jpg'" 
                  [alt]="cholent.name"
                  loading="lazy"
                >
                <!-- Popular Badge -->
                <span class="badge badge-popular" *ngIf="cholent.isPopular === true">מומלץ</span>
                <!-- Out of Stock Badge -->
                <span class="badge badge-out-of-stock" *ngIf="!cholent.isAvailable">לא קיים זמנית</span>
                <div class="card-tags">
                  <span 
                    *ngFor="let tag of cholent.tags?.slice(0, 2)" 
                    class="tag"
                    [class.traditional]="tag === 'מסורתי'"
                    [class.popular]="tag === 'פופולרי'"
                  >
                    {{ tag }}
                  </span>
                </div>
              </div>
              
              <div class="card-content">
                <h3 class="card-title">{{ cholent.name }}</h3>
                <p class="card-description">{{ cholent.description }}</p>
                
                <div class="card-details">
                  <div class="serving-info" *ngIf="cholent.servingSize">
                    <i class="fas fa-users" aria-hidden="true"></i>
                    <span>{{ cholent.servingSize }}</span>
                  </div>
                  
                  <div class="nutrition-info" *ngIf="cholent.nutritionInfo">
                    <i class="fas fa-fire" aria-hidden="true"></i>
                    <span>{{ cholent.nutritionInfo.calories }} קלוריות</span>
                  </div>
                </div>
                
                <div class="card-footer">
                  <div class="price-section">
                    <span class="price">₪{{ getPrice(cholent) }}</span>
                    <span class="price-note">/ מנה</span>
                  </div>
                  
                  <button 
                    (click)="addToCart(cholent)" 
                    class="order-btn"
                    [disabled]="!cholent.isAvailable"
                  >
                    <i class="fas fa-cart-plus" aria-hidden="true"></i>
                    {{ cholent.isAvailable ? 'הזמן עכשיו' : 'לא זמין' }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Special Info Section -->
        <div class="info-section">
          <h2>מידע חשוב</h2>
          <div class="info-grid">
            <div class="info-card">
              <i class="fas fa-clock-o" aria-hidden="true"></i>
              <h4>שעות פעילות</h4>
              <p>יום שישי: 18:00 - 23:00<br>מוצאי שבת: 20:00 - 23:00</p>
            </div>
            
            <div class="info-card">
              <i class="fas fa-phone" aria-hidden="true"></i>
              <h4>הזמנות מראש</h4>
              <p>מומלץ להזמין מראש<br>טלפון: 052-824-0230</p>
            </div>
            
            <div class="info-card">
              <i class="fas fa-car" aria-hidden="true"></i>
              <h4>משלוחים</h4>
              <p>משלוחים באזור תל אביב והמרכז<br>מינימום הזמנה: ₪100</p>
            </div>
            
            <div class="info-card">
              <i class="fas fa-certificate" aria-hidden="true"></i>
              <h4>כשרות</h4>
              <p>כשר מפוקח בהשגחת<br>הרבנות המקומית</p>
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div *ngIf="!isLoading && cholentItems.length === 0" class="empty-state">
          <i class="fas fa-fire" aria-hidden="true"></i>
          <h3>אין צ'ולנט זמין כרגע</h3>
          <p>אנחנו מכינים צ'ולנט טרי לסוף השבוע. חזור בקרוב!</p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .cholent-page {
      padding: 0;
      min-height: 80vh;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 2rem;
    }

    /* Hero Section */
    .hero-section {
      background: linear-gradient(135deg, #8B4513 0%, #A0522D 50%, #CD853F 100%);
      color: white;
      padding: 4rem 0;
      margin-bottom: 4rem;
      text-align: center;
      position: relative;
      overflow: hidden;
    }

    .hero-section::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><pattern id="grain" width="100" height="100" patternUnits="userSpaceOnUse"><circle cx="25" cy="25" r="1" fill="rgba(255,255,255,0.1)"/><circle cx="75" cy="75" r="1" fill="rgba(255,255,255,0.1)"/><circle cx="50" cy="10" r="1" fill="rgba(255,255,255,0.05)"/></pattern></defs><rect width="100" height="100" fill="url(%23grain)"/></svg>');
      opacity: 0.3;
    }

    .hero-content {
      position: relative;
      z-index: 2;
    }

    .hero-section h1 {
      font-size: 3rem;
      margin-bottom: 1rem;
      font-weight: bold;
      text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
    }

    .hero-subtitle {
      font-size: 1.3rem;
      margin-bottom: 2rem;
      opacity: 0.9;
    }

    .hero-features {
      display: flex;
      justify-content: center;
      gap: 2rem;
      flex-wrap: wrap;
    }

    .feature {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      background: rgba(255, 255, 255, 0.2);
      padding: 0.75rem 1.5rem;
      border-radius: 2rem;
      backdrop-filter: blur(10px);
    }

    .feature i {
      font-size: 1.2rem;
      color: #FFD700;
    }

    /* Loading */
    .loading {
      text-align: center;
      padding: 3rem 0;
      color: #6c757d;
    }

    .loading i {
      font-size: 2rem;
      margin-bottom: 1rem;
      color: #8B4513;
    }

    /* Menu Section */
    .cholent-menu h2 {
      text-align: center;
      color: #0E1A24;
      margin-bottom: 3rem;
      font-size: 2.2rem;
    }

    .menu-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
      gap: 2rem;
      margin-bottom: 4rem;
    }

    .cholent-card {
      background: white;
      border-radius: 1.5rem;
      box-shadow: 0 12px 28px rgba(0, 0, 0, 0.15);
      overflow: hidden;
      transition: all 0.3s ease;
      border: 2px solid rgba(139, 69, 19, 0.1);
    }

    .cholent-card:hover {
      transform: translateY(-10px);
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
    }

    .card-image {
      position: relative;
      height: 240px;
      overflow: hidden;
    }

    .card-image img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transition: transform 0.3s ease, filter 0.3s ease;
    }

    .cholent-card:hover .card-image img {
      transform: scale(1.1);
    }

    .cholent-card.is-unavailable:hover .card-image img {
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
    .card-image:has(.badge-popular) .badge-out-of-stock {
      right: auto;
      left: 10px;
    }

    /* Unavailable State */
    .cholent-card.is-unavailable {
      opacity: 0.6;
    }

    .cholent-card.is-unavailable .card-image {
      filter: grayscale(80%);
    }

    .cholent-card.is-unavailable .order-btn {
      pointer-events: none;
    }

    .card-tags {
      position: absolute;
      top: 1rem;
      right: 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .tag {
      background: rgba(255, 255, 255, 0.95);
      padding: 0.3rem 0.8rem;
      border-radius: 1rem;
      font-size: 0.8rem;
      font-weight: 600;
      color: #0E1A24;
    }

    .tag.traditional {
      background: rgba(139, 69, 19, 0.9);
      color: white;
    }

    .tag.popular {
      background: rgba(255, 215, 0, 0.9);
      color: #0E1A24;
    }

    .card-content {
      padding: 2rem;
    }

    .card-title {
      font-size: 1.6rem;
      font-weight: bold;
      color: #8B4513;
      margin-bottom: 1rem;
    }

    .card-description {
      color: #6c757d;
      line-height: 1.6;
      margin-bottom: 1.5rem;
    }

    .card-details {
      display: flex;
      gap: 1.5rem;
      margin-bottom: 1.5rem;
      font-size: 0.9rem;
    }

    .serving-info,
    .nutrition-info {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      color: #6c757d;
    }

    .serving-info i,
    .nutrition-info i {
      color: #8B4513;
    }

    .card-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .price-section {
      display: flex;
      flex-direction: column;
    }

    .price {
      font-size: 1.8rem;
      font-weight: bold;
      color: #8B4513;
    }

    .price-note {
      font-size: 0.8rem;
      color: #6c757d;
    }

    .order-btn {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.75rem 1.5rem;
      background: linear-gradient(135deg, #8B4513, #A0522D);
      color: white;
      border: none;
      border-radius: 0.75rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
    }

    .order-btn:hover:not(:disabled) {
      background: linear-gradient(135deg, #A0522D, #8B4513);
      transform: translateY(-2px);
    }

    .order-btn:disabled {
      background: #ccc;
      cursor: not-allowed;
    }

    /* Info Section */
    .info-section {
      padding: 4rem 0;
      background: #f8f9fa;
      margin: 4rem -2rem 0;
      padding-left: 2rem;
      padding-right: 2rem;
    }

    .info-section h2 {
      text-align: center;
      color: #0E1A24;
      margin-bottom: 3rem;
      font-size: 2rem;
    }

    .info-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 2rem;
    }

    .info-card {
      background: white;
      padding: 2rem;
      border-radius: 1rem;
      text-align: center;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }

    .info-card i {
      font-size: 2.5rem;
      color: #8B4513;
      margin-bottom: 1rem;
    }

    .info-card h4 {
      color: #0E1A24;
      margin-bottom: 1rem;
    }

    .info-card p {
      color: #6c757d;
      line-height: 1.6;
    }

    /* Empty State */
    .empty-state {
      text-align: center;
      padding: 4rem 0;
      color: #6c757d;
    }

    .empty-state i {
      font-size: 4rem;
      color: #8B4513;
      margin-bottom: 1rem;
    }

    /* Responsive */
    @media (max-width: 768px) {
      .hero-section h1 {
        font-size: 2.2rem;
      }

      .hero-features {
        flex-direction: column;
        align-items: center;
      }

      .menu-grid {
        grid-template-columns: 1fr;
      }

      .card-footer {
        flex-direction: column;
        gap: 1rem;
        align-items: stretch;
      }

      .order-btn {
        justify-content: center;
      }
    }
  `]
})
export class CholentBarComponent implements OnInit {
  menuService = inject(MenuService);
  cartService = inject(CartService);
  languageService = inject(LanguageService);

  cholentItems: MenuItem[] = [];
  isLoading = true;

  ngOnInit(): void {
    this.loadCholentItems();
  }

  private loadCholentItems(): void {
    this.isLoading = true;
    this.menuService.getMenuItems().subscribe({
      next: (items) => {
        this.cholentItems = items.filter(item => 
          item.category === 'צ\'ולנט' || 
          item.category === 'צ\'ולנט' ||
          item.name.toLowerCase().includes('צולנת') ||
          item.name.toLowerCase().includes('cholent')
        );
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading cholent items:', error);
        this.isLoading = false;
      }
    });
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
    
    return 0;
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
}