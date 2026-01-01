import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';

import { MenuService, MenuItem } from '../../../../services/menu.service';
import { CartService } from '../../../../services/cart.service';
import { LanguageService } from '../../../../services/language.service';

@Component({
  selector: 'app-main-dishes',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="main-dishes-page">
      <div class="container">
        <div class="page-header">
          <h1>מנות עיקריות</h1>
          <p class="page-description">מבחר מנות עיקריות מסורתיות וביתיות לשבת וחג</p>
        </div>

        <!-- Loading State -->
        <div *ngIf="isLoading" class="loading">
          <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
          <span>טוען מנות...</span>
        </div>

        <!-- Dishes Grid -->
        <div class="menu-grid" *ngIf="!isLoading">
          <div 
            *ngFor="let dish of mainDishes; trackBy: trackByItemId" 
            class="menu-item-card featured-style"
            [class.is-unavailable]="!isAvailable(dish)"
          >
            <div class="item-image">
              <img 
                [src]="dish.imageUrl || '/assets/images/placeholder-dish.jpg'" 
                [alt]="dish.name"
                loading="lazy"
              >
              <!-- Popular Badge -->
              <span class="badge badge-popular" *ngIf="dish.isPopular === true">מומלץ</span>
              <!-- Out of Stock Badge -->
              <span class="badge badge-out-of-stock" *ngIf="!isAvailable(dish)">לא קיים זמנית</span>
            </div>
            
            <div class="item-content">
              <h3 class="item-name">{{ dish.name }}</h3>
              <p class="item-description">{{ dish.description }}</p>
              
              <div class="item-details">
                <div class="serving-size" *ngIf="getServingSize(dish)">
                  <span class="serving-label">כמות מומלצת למנה:</span>
                  <span class="serving-value">{{ getServingSize(dish) }}</span>
                </div>
                
                <div class="container-icons">
                  <div class="container-icon"></div>
                  <div class="container-icon round"></div>
                  <div class="container-icon small"></div>
                </div>
              </div>
              
              <div class="item-footer">
                <div class="price-section">
                  <span class="price">₪{{ getPrice(dish) }}</span>
                  <span class="price-per">ל-100 גרם</span>
                </div>
                
                <button 
                  (click)="addToCart(dish)" 
                  class="btn-select-delivery"
                  [attr.aria-label]="getAriaLabel(dish)"
                  [disabled]="!isAvailable(dish)"
                >
                  בחרו פרטי אספקה
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
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
      overflow: hidden;
      transition: all 0.3s ease;
      border: 1px solid rgba(203, 182, 158, 0.2);
      position: relative;
    }

    .menu-item-card.featured-style {
      display: flex;
      flex-direction: column;
    }

    .menu-item-card.popular::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 4px;
      background: linear-gradient(90deg, #cbb69e, #d4c4a8);
    }

    .menu-item-card:hover {
      transform: translateY(-8px);
      box-shadow: 0 16px 32px rgba(0, 0, 0, 0.15);
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
      top: 1rem;
      right: 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .tag {
      background: rgba(255, 255, 255, 0.9);
      padding: 0.25rem 0.75rem;
      border-radius: 1rem;
      font-size: 0.75rem;
      font-weight: 600;
      color: #0E1A24;
      backdrop-filter: blur(10px);
    }

    .tag.popular {
      background: linear-gradient(135deg, #cbb69e, #d4c4a8);
      color: white;
    }

    .tag.traditional {
      background: rgba(139, 69, 19, 0.9);
      color: white;
    }

    .tag.protein {
      background: rgba(220, 20, 60, 0.9);
      color: white;
    }

    .tag.special {
      background: rgba(255, 215, 0, 0.9);
      color: #0E1A24;
    }

    .item-content {
      padding: 1.5rem;
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
      box-shadow: 0 4px 12px rgba(203, 182, 158, 0.3);
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
        gap: 1rem;
        align-items: stretch;
      }

      .add-to-cart-btn {
        justify-content: center;
      }
    }
  `]
})
export class MainDishesComponent implements OnInit {
  menuService = inject(MenuService);
  cartService = inject(CartService);
  languageService = inject(LanguageService);

  mainDishes: MenuItem[] = [];
  isLoading = true;

  featuredMainDishes = [
    {
      id: 'asado',
      name: 'אסאדו',
      description: 'אסאדו ארגנטינאי מסורתי עשוי מבשר איכותי, מתובל בתבלינים מיוחדים וצלוי על הגריל. טעם עשיר ומענג שמביא את הטעמים האותנטיים של המטבח הארגנטינאי.',
      recommendedServing: 'כ-300 גרם',
      pricePer100g: 18.0,
      imageUrl: '/assets/images/fish/Fish-stretched.jpg',
      tags: ['בשרי', 'מיוחד']
    },
    {
      id: 'roasted-beef',
      name: 'צלי בקר',
      description: 'צלי בקר איכותי מבושל לאט עם ירקות שורש ותבלינים מיוחדים. מרקם רך ועשיר עם טעם עמוק ומשביע שמביא את הטעמים הקלאסיים של המטבח המסורתי.',
      recommendedServing: 'כ-400 גרם',
      pricePer100g: 16.0,
      imageUrl: '/assets/images/fish/Fish-stretched.jpg',
      tags: ['בשרי', 'מסורתי']
    },
    {
      id: 'liver-sauce',
      name: 'כבד ברוטב',
      description: 'כבד איכותי ברוטב עשיר ומתובל, מבושל לאט עם בצל ותבלינים מיוחדים. טעם עשיר ומעניין שמביא את הטעמים המוכרים והאהובים של המטבח המסורתי.',
      recommendedServing: 'כ-250 גרם',
      pricePer100g: 12.0,
      imageUrl: '/assets/images/fish/Fish-stretched.jpg',
      tags: ['בשרי', 'מסורתי']
    },
    {
      id: 'chicken-legs-silan',
      name: 'כרעיים עוף בסילאן',
      description: 'כרעיים עוף איכותיים ברוטב סילאן מתוק וטעים, צלויים בתנור. שילוב מושלם בין הטעם העשיר של העוף למתיקות העדינה של הסילאן.',
      recommendedServing: 'כ-350 גרם',
      pricePer100g: 13.0,
      imageUrl: '/assets/images/fish/Fish-stretched.jpg',
      tags: ['עוף', 'מתוק']
    },
    {
      id: 'chicken-legs-herbs',
      name: 'כרעיים עוף בעשבי תיבול',
      description: 'כרעיים עוף איכותיים מתובלים בעשבי תיבול טריים ומיוחדים, צלויים בתנור. שילוב מושלם בין הטעם העשיר של העוף לטעמים המרעננים של עשבי התיבול.',
      recommendedServing: 'כ-350 גרם',
      pricePer100g: 13.0,
      imageUrl: '/assets/images/fish/Fish-stretched.jpg',
      tags: ['עוף', 'בריא']
    },
    {
      id: 'chicken-legs-spicy',
      name: 'כרעיים עוף פיקנטי',
      description: 'כרעיים עוף איכותיים מתובלים בתבלינים חריפים ופיקנטיים מיוחדים, צלויים בתנור. טעם עשיר וחריף שמביא חום וטעם ייחודי, מושלם לחובבי החריפות.',
      recommendedServing: 'כ-350 גרם',
      pricePer100g: 13.5,
      imageUrl: '/assets/images/fish/Fish-stretched.jpg',
      tags: ['עוף', 'חריף']
    },
    {
      id: 'schnitzel',
      name: 'שניצל',
      description: 'שניצל קלאסי ביתי עשוי מבשר איכותי, מצופה בפירורי לחם וטוגן עד לזהב. מרקם פריך מבחוץ ורך מבפנים עם טעם קלאסי ומשביע.',
      recommendedServing: 'כ-250 גרם',
      pricePer100g: 12.0,
      imageUrl: '/assets/images/fish/Fish-stretched.jpg',
      tags: ['בשרי', 'קלאסי']
    },
    {
      id: 'schnitzel-small',
      name: 'שניצלונים',
      description: 'שניצלונים קטנים וטעימים עשויים מבשר איכותי, מצופים בפירורי לחם וטוגנים עד לזהב. מושלמים כמנה ראשונה או כמנה עיקרית קלילה.',
      recommendedServing: 'כ-200 גרם',
      pricePer100g: 12.5,
      imageUrl: '/assets/images/fish/Fish-stretched.jpg',
      tags: ['בשרי', 'קלאסי']
    },
    {
      id: 'turkey-shawarma',
      name: 'שווארמה הודו',
      description: 'שווארמה הודו איכותית מתובלת בתבלינים מיוחדים, צלויה בתנור. טעם עשיר ומתובל שמביא את הטעמים האותנטיים של המטבח המזרח תיכוני.',
      recommendedServing: 'כ-300 גרם',
      pricePer100g: 14.0,
      imageUrl: '/assets/images/fish/Fish-stretched.jpg',
      tags: ['הודו', 'מזרחי']
    },
    {
      id: 'chicken-herbs',
      name: 'פרגית בעשבי תיבול',
      description: 'פרגית איכותית מתובלת בעשבי תיבול טריים ומיוחדים, צלויה בתנור. שילוב מושלם בין הטעם העשיר של הפרגית לטעמים המרעננים של עשבי התיבול.',
      recommendedServing: 'כ-600 גרם',
      pricePer100g: 12.0,
      imageUrl: '/assets/images/fish/Fish-stretched.jpg',
      tags: ['עוף', 'בריא']
    },
    {
      id: 'chicken-eastern',
      name: 'פרגית בסגנון מזרחי',
      description: 'פרגית איכותית מתובלת בסגנון מזרחי אותנטי עם תבלינים מיוחדים, צלויה בתנור. טעם עשיר ומתובל שמביא את הטעמים האותנטיים של המטבח המזרחי.',
      recommendedServing: 'כ-600 גרם',
      pricePer100g: 12.5,
      imageUrl: '/assets/images/fish/Fish-stretched.jpg',
      tags: ['עוף', 'מזרחי']
    },
    {
      id: 'chicken-teriyaki',
      name: 'פרגית ברוטב טריאקי',
      description: 'פרגית איכותית ברוטב טריאקי אסיאתי מתוק וטעים, צלויה בתנור. שילוב מושלם בין הטעם העשיר של הפרגית למתיקות העדינה של רוטב הטריאקי.',
      recommendedServing: 'כ-600 גרם',
      pricePer100g: 13.0,
      imageUrl: '/assets/images/fish/Fish-stretched.jpg',
      tags: ['עוף', 'אסיאתי']
    },
    {
      id: 'meatballs-sauce',
      name: 'קציצות בשר ברוטב',
      description: 'קציצות בשר איכותיות ברוטב עשיר ומתובל, מבושלות לאט. מרקם רך ועשיר עם טעם קלאסי ומשביע שמביא את הטעמים המוכרים והאהובים של המטבח המסורתי.',
      recommendedServing: 'כ-300 גרם',
      pricePer100g: 13.0,
      imageUrl: '/assets/images/fish/Fish-stretched.jpg',
      tags: ['בשרי', 'מסורתי']
    },
    {
      id: 'cholent-meat',
      name: 'צ\'ולנט בשרי',
      description: 'צ\'ולנט בשרי מסורתי עשוי מבשר איכותי, תפוחי אדמה ושעועית, מבושל שעות ארוכות על אש נמוכה. טעם עשיר ומשביע שמביא את הטעמים האותנטיים של המטבח המסורתי.',
      recommendedServing: 'כ-400 גרם',
      pricePer100g: 10.0,
      imageUrl: '/assets/images/fish/Fish-stretched.jpg',
      tags: ['בשרי', 'שבתי', 'מסורתי']
    },
    {
      id: 'cholent-parve',
      name: 'צ\'ולנט פרווה',
      description: 'צ\'ולנט פרווה מסורתי עשוי מתפוחי אדמה, שעועית וירקות, מבושל שעות ארוכות על אש נמוכה. טעם עשיר ומשביע שמביא את הטעמים האותנטיים של המטבח המסורתי.',
      recommendedServing: 'כ-400 גרם',
      pricePer100g: 9.5,
      imageUrl: '/assets/images/fish/Fish-stretched.jpg',
      tags: ['פרווה', 'שבתי', 'מסורתי']
    }
  ];

  ngOnInit(): void {
    this.loadMainDishes();
  }

  private loadMainDishes(): void {
    this.isLoading = true;
    // Always use featuredMainDishes - they contain all the main dishes
    this.mainDishes = this.featuredMainDishes.map(d => ({
      id: d.id,
      name: d.name,
      description: d.description,
      price: d.pricePer100g * 4,
      imageUrl: d.imageUrl,
      category: 'מנות עיקריות',
      tags: d.tags,
      isAvailable: true,
      servingSize: d.recommendedServing,
      pricePer100g: d.pricePer100g
    } as MenuItem & { pricePer100g: number; recommendedServing: string }));
    this.isLoading = false;
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
}