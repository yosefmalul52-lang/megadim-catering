import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

import { MenuService, MenuItem } from '../../../../services/menu.service';
import { CartService } from '../../../../services/cart.service';
import { LanguageService } from '../../../../services/language.service';

@Component({
  selector: 'app-salads',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="salads-page">
      <div class="container">
        <div class="page-header">
          <h1>סלטים ביתיים</h1>
          <p class="page-description">מגוון סלטים טריים וטעימים, מכינים טרי מדי יום</p>
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
            class="menu-item-card featured-style"
            [class.is-unavailable]="!isAvailable(salad)"
          >
            <div class="item-image">
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
            
            <div class="item-content">
              <h3 class="item-name">{{ salad.name }}</h3>
              <p class="item-description">{{ salad.description }}</p>
              
              <div class="item-footer">
                <!-- Pricing Options Selection -->
                <div class="pricing-selection" *ngIf="hasPricingOptions(salad)">
                  <label class="pricing-label">בחרו אפשרות:</label>
                  <select 
                    class="pricing-select"
                    [value]="getSelectedOptionIndex(salad.id || salad._id || '')"
                    (change)="selectPricingOption(salad.id || salad._id || '', $event)"
                  >
                    <option value="">בחרו אפשרות</option>
                    <option *ngFor="let option of getPricingOptions(salad); let i = index" [value]="i">
                      {{ option.label }} - {{ option.amount }} - ₪{{ option.price }}
                    </option>
                  </select>
                </div>
                
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
                
                <div class="buttons-group">
                  <button 
                    (click)="addToCart(salad)" 
                    class="btn btn-add-to-cart"
                    [attr.aria-label]="'הוסף לסל ' + salad.name"
                    [disabled]="!isAvailable(salad) || !hasSelectedOption(salad)"
                  >
                    <i class="fas fa-shopping-cart"></i>
                    הוסף לסל
                  </button>
                  
                  <button 
                    (click)="showDetails(salad)" 
                    class="btn btn-details"
                    [attr.aria-label]="'פרטים על ' + salad.name"
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

    .menu-item-card.is-unavailable .btn,
    .menu-item-card.is-unavailable .pricing-select {
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

    .item-details {
      margin-bottom: 1.5rem;
      font-size: 0.9rem;
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
      flex-direction: column;
      gap: 1.25rem;
      margin-top: auto;
      padding-top: 1.25rem;
      width: 100%;
    }

    .price-section {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      width: 100%;
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

    /* Pricing Selection */
    .pricing-selection {
      width: 100%;
      margin-bottom: 0.5rem;
    }

    .pricing-label {
      display: block;
      font-size: 0.9rem;
      font-weight: 600;
      color: #0E1A24;
      margin-bottom: 0.75rem;
    }

    .pricing-select {
      width: 100%;
      padding: 0.75rem;
      border: 2px solid #ddd;
      border-radius: 0.5rem;
      background: white;
      font-size: 0.95rem;
      color: #0E1A24;
      cursor: pointer;
      transition: all 0.3s ease;
    }

    .pricing-select:hover {
      border-color: #cbb69e;
    }

    .pricing-select:focus {
      outline: none;
      border-color: #cbb69e;
      box-shadow: 0 0 0 3px rgba(203, 182, 158, 0.1);
    }

    /* Size Selection */
    .size-selection {
      width: 100%;
      margin-bottom: 0.5rem;
    }

    .size-label {
      display: block;
      font-size: 0.9rem;
      font-weight: 600;
      color: #0E1A24;
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
      border-radius: 0.5rem;
      background: white;
      cursor: pointer;
      transition: all 0.3s ease;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.25rem;
      min-height: 60px;
      justify-content: center;
    }

    .size-btn:hover {
      border-color: #cbb69e;
      background: #fafafa;
    }

    .size-btn.active {
      border-color: #cbb69e;
      background: #f5f0e8;
      box-shadow: 0 2px 8px rgba(203, 182, 158, 0.2);
    }

    .size-weight {
      font-size: 0.85rem;
      font-weight: 600;
      color: #0E1A24;
    }

    .size-price {
      font-size: 1rem;
      font-weight: bold;
      color: #cbb69e;
    }

    .size-btn.active .size-price {
      color: #0E1A24;
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

    .btn-add-to-cart:active:not(:disabled) {
      transform: translateY(0);
      box-shadow: 0 2px 4px rgba(203, 182, 158, 0.2);
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

    .btn-details:active {
      transform: translateY(0);
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
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
        grid-template-columns: repeat(3, 1fr);
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

      .add-to-cart-btn {
        justify-content: center;
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