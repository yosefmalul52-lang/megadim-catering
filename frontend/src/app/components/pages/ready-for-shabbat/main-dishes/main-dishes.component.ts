import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

import { MenuService, MenuItem } from '../../../../services/menu.service';
import { CartService } from '../../../../services/cart.service';
import { LanguageService } from '../../../../services/language.service';

@Component({
  selector: 'app-main-dishes',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  template: `
    <div class="main-dishes-page">
      <div class="container">
        <div class="page-header">
          <div class="section-title">
            <h2>מנות עיקריות</h2>
          </div>
        </div>

        <!-- Loading State -->
        <div *ngIf="isLoading" class="loading">
          <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
          <span>טוען מנות...</span>
        </div>

        <!-- Dishes Grid -->
        <!-- Product Cards Grid - EXACT REFERENCE DESIGN -->
        <div class="menu-grid" *ngIf="!isLoading">
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
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 30px;
      padding: 20px 0;
      margin-bottom: 4rem;
    }

    // Product Card Container
    .product-card {
      display: flex;
      flex-direction: column;
      height: 100%; // Ensures all cards in grid are same height
      background-color: #fff;
      border: 1px solid #d4af37; // The Gold Border Frame
      border-radius: 0; // SQUARE corners as requested
      overflow: hidden;
      transition: transform 0.2s ease;

      &:hover {
        box-shadow: 0 10px 20px rgba(0,0,0,0.1);
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
      height: 250px; // Fixed height for uniformity
      overflow: hidden;

      .card-img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }
    }

    // Card Body (Content Area)
    .card-body {
      padding: 20px 15px;
      text-align: center;
      flex-grow: 1; // Pushes the buttons down
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    // Title
    .card-title {
      font-family: 'Heebo', sans-serif; // Or project font
      font-size: 1.8rem; // Large and bold like reference
      font-weight: 800;
      color: #1a2b3c; // Dark Blue
      margin: 0 0 10px 0;
      letter-spacing: -0.5px;
    }

    // Description
    .card-description {
      font-size: 1rem;
      color: #666;
      line-height: 1.4;
      margin-bottom: 15px;
      max-width: 90%;
    }

    // Price (Large Gold)
    .card-price {
      font-size: 2rem;
      font-weight: 700;
      color: #d4af37; // Gold Price
      margin-top: auto; // Pushes price slightly down if needed
      margin-bottom: 5px;

      .currency {
        font-size: 1.4rem;
        margin-left: 2px;
      }
    }

    // Card Actions (Buttons Section)
    .card-actions {
      padding: 15px;
      display: flex;
      gap: 15px; // Space between buttons
      margin-top: auto;
    }

    // Button Base Styles
    .btn {
      flex: 1; // Both buttons take equal width
      padding: 12px 0;
      font-size: 1.1rem;
      font-weight: 700;
      cursor: pointer;
      border-radius: 0; // SQUARE buttons
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: all 0.2s;
    }

    // Details Button (Gold Border)
    .btn-details {
      background: #fff;
      border: 1px solid #d4af37;
      color: #d4af37;

      &:hover {
        background: #fcf8eb;
      }
    }

    // Cart Button (Dark Blue)
    .btn-cart {
      background: #1a2b3c;
      border: 1px solid #1a2b3c;
      color: #fff;

      &:hover:not(:disabled) {
        background: lighten(#1a2b3c, 5%);
      }

      &:disabled {
        background: #ccc;
        color: #666;
        cursor: not-allowed;
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

  viewDetails(dish: MenuItem): void {
    // Navigate to dish details or show modal
    // For now, log to console - can be expanded later
    console.log('View details for:', dish.name);
    // TODO: Implement navigation or modal
  }
}