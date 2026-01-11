import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { MenuService, MenuItem } from '../../../../services/menu.service';
import { CartService } from '../../../../services/cart.service';
import { LanguageService } from '../../../../services/language.service';

@Component({
  selector: 'app-salads',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  template: `
    <div class="salads-page">
      <div class="container">
        <div class="page-header">
          <div class="section-title">
            <h2>סלטים</h2>
          </div>
        </div>

        <!-- Loading State -->
        <div *ngIf="isLoading" class="loading">
          <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
          <span>טוען מנות...</span>
        </div>

        <!-- Salads Grid -->
        <div class="menu-grid" *ngIf="!isLoading">
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
                  [disabled]="!isAvailable(salad) || !hasSelectedOption(salad)"
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
      display: grid;
      // Force 4 columns on desktop
      grid-template-columns: repeat(4, 1fr);
      gap: 20px; // Slightly tighter gap to fit 4 nicely
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
      background: #ffffff;
      border: 1px solid #eaeaea; // Very subtle border
      border-radius: 0; // Square corners for premium look
      height: 100%;
      display: flex;
      flex-direction: column;
      transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
      position: relative;
      overflow: hidden;

      // Hover Effect: Lift and Gold Border
      &:hover {
        transform: translateY(-5px);
        border-color: #E0C075; // $gold
        box-shadow: 0 15px 30px rgba(0,0,0,0.08);
      }

      // 1. Image Area - ABSOLUTE CENTER (THE NUCLEAR OPTION)
      .image-container {
        position: relative; // Parent must be relative
        width: 100%;
        height: 220px;
        background-color: #ffffff;
        overflow: hidden;

        // No flex or grid needed on parent anymore

        img {
          position: absolute; // Take out of flow
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%); // Shift back by half its own width/height

          // Constrain size to create the white frame
          max-width: 85%;
          max-height: 85%;

          // Reset overrides with !important to kill any global interference
          width: auto !important;
          height: auto !important;
          margin: 0 !important;
          padding: 0 !important;
          display: block !important;

          object-fit: contain;
          transition: transform 0.5s ease;
        }

        // Badge styling
        .badge {
          position: absolute;
          top: 10px;
          right: 10px;
          background-color: #E0C075; // $gold
          color: #1f3540; // $navy
          padding: 4px 12px;
          font-size: 0.75rem;
          font-weight: 800;
          border-radius: 0;
          z-index: 2;
          text-transform: uppercase;
        }

        .badge-out-of-stock {
          background: #7a7a7a;
          color: white;
        }
      }

      // Zoom effect needs adjustment for transform
      &:hover .image-container img {
        // We must include the translate in the hover or it will jump back!
        transform: translate(-50%, -50%) scale(1.08);
      }

      &.is-unavailable:hover .image-container img {
        transform: translate(-50%, -50%) scale(1);
      }

      // 2. Content Area
      .card-body {
        padding: 0 20px 20px 20px; // Padding around text
        flex-grow: 1;
        display: flex;
        flex-direction: column;
        text-align: right; // RTL

        h3.title {
          font-size: 1.25rem;
          font-weight: 800;
          color: #1f3540; // $navy
          margin-bottom: 8px;
          line-height: 1.3;
        }

        p.description {
          font-size: 0.9rem;
          color: #666666; // $gray-text
          line-height: 1.5;
          margin-bottom: 20px;
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

        // Dropdown styling
        .form-control, select {
          width: 100%;
          padding: 10px;
          border: 1px solid #ddd;
          background-color: #fafafa;
          border-radius: 0;
          margin-bottom: 15px;
          font-size: 0.9rem;
          color: #1f3540; // $navy
          cursor: pointer;
          transition: border-color 0.2s;
          &:focus {
            outline: none;
            border-color: #1f3540; // $navy
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
            border-color: #E0C075; // $mustard-gold
            background: #fafafa;
          }

          &.active {
            border-color: #E0C075; // $mustard-gold
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
          color: #E0C075; // $mustard-gold
        }

        .size-btn.active .size-price {
          color: #1f3540; // $navy
        }

        // Price Section
        .price-section {
          margin-bottom: 20px;
          
          .price {
            font-size: 1.5rem;
            font-weight: 700;
            color: #E0C075; // $mustard-gold
          }
        }

        // 3. Buttons Area
        .actions {
          display: grid;
          grid-template-columns: 1fr 2fr; // Details (small) | Add (large)
          gap: 12px;
          margin-top: auto;

          button {
            height: 42px;
            border-radius: 0; // Square
            font-weight: 700;
            font-size: 0.95rem;
            cursor: pointer;
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 5px;

            i {
              font-size: 1rem;
            }
          }

          // 'Details' - Secondary Button
          .btn-details {
            background: transparent;
            border: 1px solid #1f3540; // $navy
            color: #1f3540; // $navy
            &:hover {
              background: rgba(31, 53, 64, 0.05); // rgba($navy, 0.05)
            }
          }

          // 'Add to Cart' - Primary Gold Button
          .btn-add {
            background: #E0C075; // $gold
            border: 1px solid #E0C075; // $gold
            color: #1f3540; // Contrast text (navy)
            box-shadow: 0 4px 6px rgba(0,0,0,0.05);

            &:hover:not(:disabled) {
              background: darken(#E0C075, 5%);
              box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            }

            &:disabled {
              background: #ccc;
              color: #666;
              cursor: not-allowed;
              border-color: #ccc;
            }

            i {
              margin-left: 6px;
              font-size: 18px;
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

  ngOnInit(): void {
    this.loadSalads();
  }

  private loadSalads(): void {
    this.isLoading = true;
    // Load salads from API - NO hardcoded data
    this.menuService.getMenuItems().subscribe({
      next: (items) => {
        console.log('Data from DB:', items);
        // Filter only salads from the API
        this.salads = items.filter(item => item.category === 'סלטים');
        console.log('Loaded salads from API:', this.salads.length);
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading salads from API:', error);
        // If server is down, list will be empty (proving we are no longer using hardcoded data)
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
    
    if (!this.hasSelectedOption(item)) {
      alert('אנא בחרו אפשרות לפני הוספה לסל');
      return;
    }

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
}