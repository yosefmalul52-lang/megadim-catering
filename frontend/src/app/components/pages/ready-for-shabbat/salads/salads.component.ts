import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { MenuService, MenuItem } from '../../../../services/menu.service';
import { CartService } from '../../../../services/cart.service';
import { LanguageService } from '../../../../services/language.service';

@Component({
  selector: 'app-salads',
  standalone: true,
  imports: [CommonModule, TranslateModule, RouterModule],
  template: `
    <div class="salads-page">
      <div class="category-header-actions">
        <button class="btn-gold-back" routerLink="/ready-for-shabbat">
          <i class="fas fa-arrow-right"></i> חזרה לתפריט
        </button>
      </div>

      <header class="luxury-category-header">
        <span class="decorative-line"></span>
        <span class="decorative-diamond"></span>
        <h1>סלטים</h1>
        <span class="decorative-diamond"></span>
        <span class="decorative-line"></span>
      </header>

      <div class="container">

        <!-- Loading State -->
        <div *ngIf="isLoading" class="loading">
          <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
          <span>טוען מנות...</span>
        </div>

        <!-- Salads Grid -->
        <div class="menu-grid grid-4-cols" *ngIf="!isLoading">
          <div 
            *ngFor="let salad of salads; trackBy: trackByItemId" 
            class="product-card"
            [class.is-unavailable]="!isAvailable(salad)"
          >
            <div class="image-container">
              <img 
                [src]="salad.imageUrl || '/assets/images/placeholder-dish.jpg'" 
                [alt]="salad.name"
                loading="lazy"
              >
              <!-- Popular Badge -->
              <span class="badge badge-popular" *ngIf="salad.isPopular === true">מומלץ</span>
              <!-- Out of Stock Badge -->
              <span class="badge badge-out-of-stock" *ngIf="!isAvailable(salad)">לא קיים זמנית</span>
            </div>
            
            <div class="card-body">
              <h3 class="title">{{ salad.name }}</h3>
              <p class="description">{{ salad.description }}</p>
              
              <!-- Price Per 100g Display -->
              <div class="price-unit" *ngIf="salad.pricePer100g">
                {{ 'PRODUCT.PRICE_100G' | translate }} {{ salad.pricePer100g }} {{ 'PRODUCT.SHEKEL' | translate }}
              </div>
              
              <!-- Pricing Options Selection -->
              <select 
                *ngIf="hasPricingOptions(salad)"
                class="form-control"
                [value]="getSelectedOptionIndex(salad.id || salad._id || '')"
                (change)="selectPricingOption(salad.id || salad._id || '', $event)"
              >
                <option value="">בחרו אפשרות</option>
                <option *ngFor="let option of getPricingOptions(salad); let i = index" [value]="i">
                  {{ option.label }} - {{ option.amount }} - ₪{{ option.price }}
                </option>
              </select>
              
              <!-- Legacy Size Selection (for pricingVariants) -->
              <div class="size-selection" *ngIf="!hasPricingOptions(salad) && hasPricingVariants(salad)">
                <label class="size-label">בחרו גודל:</label>
                <div class="size-options">
                  <button 
                    *ngFor="let variant of getPricingVariants(salad); let i = index"
                    class="size-btn"
                    [class.active]="getSelectedVariantIndex(salad.id || salad._id || '') === i"
                    (click)="selectVariant(salad.id || salad._id || '', i)"
                    [attr.aria-label]="'בחרו ' + variant.label + ' עבור ' + salad.name"
                  >
                    <span class="size-weight">{{ variant.label }}</span>
                    <span class="size-price">₪{{ variant.price }}</span>
                  </button>
                </div>
              </div>
              
              <!-- Single Price Display -->
              <div class="price-section" *ngIf="!hasPricingOptions(salad) && !hasPricingVariants(salad) && salad.price">
                <span class="price">₪{{ salad.price }}</span>
              </div>
              
              <!-- Error Message -->
              <div class="error-message" *ngIf="hasValidationError(salad.id || salad._id || '')">
                נא לבחור גודל תחילה
              </div>
              
              <div class="actions">
                <button 
                  (click)="showDetails(salad)" 
                  class="btn-details"
                  [attr.aria-label]="'פרטים על ' + salad.name"
                >
                  {{ 'PRODUCT.DETAILS' | translate }}
                </button>
                
                <button 
                  (click)="addToCart(salad)" 
                  class="btn-add"
                  [attr.aria-label]="'הוסף לסל ' + salad.name"
                  [disabled]="!isAvailable(salad)"
                >
                  <i class="fas fa-shopping-cart"></i>
                  {{ 'PRODUCT.ADD_TO_CART' | translate }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div *ngIf="showEmptyState()" class="empty-state">
          <i class="fas fa-utensils" aria-hidden="true"></i>
          <h3>אין סלטים זמינים כרגע</h3>
          <p>אנחנו עובדים על הוספת סלטים חדשים. חזור בקרוב!</p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .salads-page {
      padding: 2rem 0;
      min-height: 70vh;
      background-color: white;
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

    .menu-grid {
      margin-bottom: 4rem;
      padding-bottom: 40px;
      width: 100%;
      // Center the grid content
      justify-content: center;

      // Make sure cards take full height of the row
      .product-card {
        height: 100%;
      }
    }

    .product-card {
      background: #fff;
      border-radius: 12px;
      height: 100%;
      display: flex;
      flex-direction: column;
      position: relative;
      overflow: hidden;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
      transition: transform 0.2s ease, box-shadow 0.2s ease;

      // Hover Effect: Lift and Gold Border
      &:hover {
        transform: translateY(-4px);
        box-shadow: 0 8px 20px rgba(0, 0, 0, 0.12);
      }

      // 1. Image Area
      .image-container {
        position: relative;
        width: 100%;
        height: 220px;
        background-color: #ffffff;
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;

        img {
          width: 100%;
          height: 100%;
          object-fit: contain;
          display: block;
        }

        // Badge styling
        .badge {
          position: absolute;
          top: 10px;
          right: 10px;
          background-color: var(--primary-gold);
          color: #1f3540;
          padding: 4px 12px;
          font-size: 0.75rem;
          font-weight: 800;
          border-radius: 6px;
          z-index: 2;
          text-transform: uppercase;
        }

        .badge-out-of-stock {
          background: #7a7a7a;
          color: white;
        }
      }

      // Zoom effect
      &:hover .image-container img {
        transform: scale(1.02);
      }

      &.is-unavailable:hover .image-container img {
        transform: scale(1);
      }

      // 2. Content Area
      .card-body {
        padding: 16px;
        flex-grow: 1;
        display: flex;
        flex-direction: column;
        text-align: center;
        justify-content: space-between;
        
        // Ensure dropdown and buttons align by having consistent padding context
        > * {
          width: 100%;
        }

        h3.title {
          font-size: 1.3rem;
          font-weight: bold;
          color: #1f3540;
          margin-bottom: 8px;
          line-height: 1.3;
        }

        p.description {
          font-size: 0.95rem;
          color: #555;
          line-height: 1.5;
          margin-bottom: 12px;
          flex-grow: 1;
        }

        // NEW: Price Per 100g Styling
        .price-unit {
          font-size: 1rem;
          font-weight: 700;
          color: #1f3540; // $navy
          margin-bottom: 12px;
          text-align: right;
          display: block;

          // Optional: Add a subtle separator line above it
          padding-top: 10px;
          border-top: 1px solid #f0f0f0;
          width: 100%;
        }

        // Dropdown styling - Clean white background with gold border on focus
        .form-control, select {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid #ddd;
          background-color: #ffffff;
          border-radius: 8px;
          margin-bottom: 12px;
          font-size: 0.9rem;
          color: #1f3540;
          cursor: pointer;
          transition: all 0.2s ease;
          font-family: inherit;
          
          &:focus {
            outline: none;
            border-color: var(--primary-gold);
            box-shadow: 0 0 0 2px rgba(224, 192, 117, 0.1);
          }
          
          &:hover {
            border-color: #bbb;
          }
        }

        // Size Selection
        .size-selection {
          width: 100%;
          margin-bottom: 20px;
        }

        .size-label {
          display: block;
          font-size: 0.9rem;
          font-weight: 600;
          color: #1f3540; // $navy
          margin-bottom: 0.75rem;
        }

        .size-options {
          display: flex;
          gap: 0.75rem;
          width: 100%;
        }

        .size-btn {
          flex: 1;
          padding: 0.75rem 0.5rem;
          border: 2px solid #ddd;
          border-radius: 0; // Square buttons
          background: white;
          cursor: pointer;
          transition: all 0.3s ease;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.25rem;
          min-height: 60px;
          justify-content: center;

          &:hover {
            border-color: var(--primary-gold);
            background: #fafafa;
          }

          &.active {
            border-color: var(--primary-gold);
            background: rgba(224, 192, 117, 0.1);
            box-shadow: 0 2px 8px rgba(224, 192, 117, 0.2);
          }
        }

        .size-weight {
          font-size: 0.85rem;
          font-weight: 600;
          color: #1f3540; // $navy
        }

        .size-price {
          font-size: 1rem;
          font-weight: bold;
          color: var(--primary-gold);
        }

        .size-btn.active .size-price {
          color: #1f3540; // $navy
        }

        // Price Section
        .price-section {
          margin-bottom: 12px;
          text-align: center;
          
          .price {
            font-size: 1.2rem;
            font-weight: bold;
            color: var(--primary-gold);
          }
        }

        // Error Message
        .error-message {
          color: #dc3545;
          font-size: 0.85rem;
          margin-bottom: 8px;
          text-align: center;
          padding: 0 16px;
        }

        // 3. Buttons Area
        .actions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          width: 100%;
          margin-top: auto;
          padding: 0;
          margin: 16px 0 0 0;

          button {
            height: 42px;
            border-radius: 0;
            font-weight: bold;
            font-size: 0.95rem;
            cursor: pointer;
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 5px;
            padding: 10px 20px;
            white-space: nowrap;
            width: 100%;
            text-align: center;

            i {
              font-size: 1rem;
            }
          }

          // 'Details' - Secondary Button (Gold Outline)
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

          // 'Add to Cart' - Primary Button (Solid Gold)
          .btn-add {
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
              margin-left: 6px;
              font-size: 18px;
              color: #1f3540;
            }
          }
        }
      }

      // Unavailable State
      &.is-unavailable {
        opacity: 0.6;

        .image-container {
          filter: grayscale(80%);
        }

        .actions button {
          pointer-events: none;
        }
      }

      // When popular badge exists, move out-of-stock badge to left
      .image-container:has(.badge-popular) .badge-out-of-stock {
        right: auto;
        left: 10px;
      }
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
    }

    .tag.vegan {
      background: rgba(76, 175, 80, 0.9);
      color: white;
    }

    .tag.healthy {
      background: rgba(67, 160, 71, 0.9);
      color: white;
    }

    .tag.gluten-free {
      background: rgba(255, 193, 7, 0.9);
      color: #0E1A24;
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
        grid-template-columns: repeat(3, 1fr); // Drop to 3
      }
    }

    @media (max-width: 900px) {
      .menu-grid {
        grid-template-columns: repeat(2, 1fr); // Drop to 2
      }
    }

    @media (max-width: 600px) {
      .menu-grid {
        grid-template-columns: 1fr; // Single column on mobile
        padding: 0 10px;
      }

      .section-title h2 {
        font-size: 2rem;
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
export class SaladsComponent implements OnInit {
  menuService = inject(MenuService);
  cartService = inject(CartService);
  languageService = inject(LanguageService);
  router = inject(Router);

  salads: MenuItem[] = [];
  isLoading = true;
  selectedSizes: { [key: string]: 'small' | 'large' } = {}; // Legacy support
  selectedOptions: { [key: string]: number } = {}; // For pricingOptions: itemId -> option index
  selectedVariants: { [key: string]: number } = {}; // For pricingVariants: itemId -> variant index
  validationErrors: { [key: string]: boolean } = {}; // Track validation errors per item

  ngOnInit(): void {
    this.loadSalads();
  }

  /**
   * Load salads from MenuService (Single Source of Truth)
   * This ensures consistency - cards are generated FROM service data
   */
  private loadSalads(): void {
    this.isLoading = true;
    console.log('🔄 Loading salads from MenuService...');
    
    // Use getProductsByCategory to get ALL products for this category
    this.menuService.getProductsByCategory('salads').subscribe({
      next: (items) => {
        console.log('✅ Loaded', items.length, 'salads from MenuService');
        this.salads = items;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('❌ Error loading salads:', error);
        this.salads = [];
        this.isLoading = false;
      }
    });
  }

  // Pricing Options Support
  hasPricingOptions(item: MenuItem): boolean {
    return !!(item.pricingOptions && item.pricingOptions.length > 0);
  }

  getPricingOptions(item: MenuItem): any[] {
    return item.pricingOptions || [];
  }

  selectPricingOption(itemId: string, event: Event): void {
    const select = event.target as HTMLSelectElement;
    const optionIndex = parseInt(select.value, 10);
    if (!isNaN(optionIndex)) {
      this.selectedOptions[itemId] = optionIndex;
      // Clear validation error when option is selected
      this.validationErrors[itemId] = false;
    }
  }

  getSelectedOptionIndex(itemId: string): number {
    return this.selectedOptions[itemId] ?? -1;
  }

  // Legacy Pricing Variants Support
  hasPricingVariants(item: MenuItem): boolean {
    return !!(item.pricingVariants && item.pricingVariants.length > 0);
  }

  getPricingVariants(item: MenuItem): any[] {
    return item.pricingVariants || [];
  }

  selectVariant(itemId: string, variantIndex: number): void {
    this.selectedVariants[itemId] = variantIndex;
    // Clear validation error when variant is selected
    this.validationErrors[itemId] = false;
  }

  getSelectedVariantIndex(itemId: string): number {
    return this.selectedVariants[itemId] ?? -1;
  }

  // Legacy size selection (for backward compatibility)
  selectSize(saladId: string, size: 'small' | 'large'): void {
    this.selectedSizes[saladId] = size;
  }

  getSelectedSize(saladId: string): 'small' | 'large' | null {
    return this.selectedSizes[saladId] || null;
  }

  hasSelectedOption(item: MenuItem): boolean {
    const itemId = item.id || item._id || '';
    
    if (this.hasPricingOptions(item)) {
      return this.getSelectedOptionIndex(itemId) >= 0;
    }
    
    if (this.hasPricingVariants(item)) {
      return this.getSelectedVariantIndex(itemId) >= 0;
    }
    
    // For single price items, always allow adding to cart
    return item.price !== undefined && item.price !== null;
  }

  getSelectedPrice(item: MenuItem): number {
    const itemId = item.id || item._id || '';
    
    // Priority 1: pricingOptions
    if (this.hasPricingOptions(item)) {
      const optionIndex = this.getSelectedOptionIndex(itemId);
      if (optionIndex >= 0) {
        const options = this.getPricingOptions(item);
        return options[optionIndex]?.price || 0;
      }
    }
    
    // Priority 2: pricingVariants
    if (this.hasPricingVariants(item)) {
      const variantIndex = this.getSelectedVariantIndex(itemId);
      if (variantIndex >= 0) {
        const variants = this.getPricingVariants(item);
        return variants[variantIndex]?.price || 0;
      }
    }
    
    // Priority 3: single price
    return item.price || 0;
  }

  addToCart(item: MenuItem): void {
    if (!item.isAvailable) return;
    
    const itemId = item.id || item._id || '';
    
    // Check if item requires size selection
    const requiresSelection = this.hasPricingOptions(item) || this.hasPricingVariants(item);
    
    if (requiresSelection && !this.hasSelectedOption(item)) {
      // Set validation error instead of alert
      this.validationErrors[itemId] = true;
      return;
    }
    
    // Clear validation error if validation passes
    this.validationErrors[itemId] = false;

    let itemName = item.name;
    let price = this.getSelectedPrice(item);
    
    // Build item name with selected option/variant
    if (this.hasPricingOptions(item)) {
      const optionIndex = this.getSelectedOptionIndex(itemId);
      const options = this.getPricingOptions(item);
      if (optionIndex >= 0 && options[optionIndex]) {
        const option = options[optionIndex];
        itemName = `${item.name} (${option.label} - ${option.amount})`;
        price = option.price;
      }
    } else if (this.hasPricingVariants(item)) {
      const variantIndex = this.getSelectedVariantIndex(itemId);
      const variants = this.getPricingVariants(item);
      if (variantIndex >= 0 && variants[variantIndex]) {
        const variant = variants[variantIndex];
        itemName = `${item.name} (${variant.label})`;
        price = variant.price;
      }
    }

    this.cartService.addItem({
      id: `${itemId}-${Date.now()}`,
      name: itemName,
      price: price,
      imageUrl: item.imageUrl,
      description: item.description,
      category: item.category
    });

    // Open cart modal automatically
    this.cartService.openCart();
  }

  trackByItemId(index: number, item: MenuItem): string {
    return item.id || item._id || '';
  }

  showEmptyState(): boolean {
    return !this.isLoading && this.salads.length === 0;
  }

  getServingSize(salad: MenuItem): string {
    return (salad as any).recommendedServing || salad.servingSize || '';
  }

  getPrice(salad: MenuItem): number {
    return (salad as any).pricePer100g || salad.price || 0;
  }

  getAriaLabel(salad: MenuItem): string {
    return 'בחרו פרטי אספקה עבור ' + salad.name;
  }

  isAvailable(salad: MenuItem): boolean {
    return salad.isAvailable !== false;
  }

  showDetails(salad: MenuItem): void {
    this.router.navigate(['/ready-for-shabbat/salads', salad.id || salad._id || '']);
  }

  hasValidationError(itemId: string): boolean {
    return this.validationErrors[itemId] === true;
  }
}