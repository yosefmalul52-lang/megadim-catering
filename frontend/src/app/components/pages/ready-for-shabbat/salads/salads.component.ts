import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { MatIconModule } from '@angular/material/icon';

import { MenuService, MenuItem } from '../../../../services/menu.service';
import { CartService } from '../../../../services/cart.service';
import { LanguageService } from '../../../../services/language.service';
import { SiteSettingsService, SiteSettings } from '../../../../services/site-settings.service';
import { SeoService } from '../../../../services/seo.service';
import { PageBannerComponent } from '../../../shared/page-banner/page-banner.component';
import { PagePopupComponent } from '../../../shared/page-popup/page-popup.component';

@Component({
  selector: 'app-salads',
  standalone: true,
  imports: [CommonModule, TranslateModule, RouterModule, MatIconModule, PageBannerComponent, PagePopupComponent],
  template: `
    <div class="salads-page">
      <app-page-banner [message]="settings?.pageAnnouncements?.['salads']?.bannerText"></app-page-banner>
      <app-page-popup
        [show]="showPopup"
        [title]="(settings?.pageAnnouncements?.['salads']?.popupTitle) ?? ''"
        [text]="(settings?.pageAnnouncements?.['salads']?.popupText) ?? ''"
        (close)="closePopup()"
      ></app-page-popup>
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

        <!-- Salads Grid (design aligned with Home "What\'s Cooking" cards) -->
        <div class="menu-grid grid-4-cols unified-menu-grid" *ngIf="!isLoading && salads.length > 0">
          <div 
            *ngFor="let salad of salads; trackBy: trackByItemId" 
            class="product-card"
          >
            <div class="card-image-wrapper">
              <img 
                [src]="salad.imageUrl || '/assets/images/placeholder-dish.jpg'" 
                [alt]="salad.name"
                loading="lazy"
              >
              <div class="badge" *ngIf="salad.isPopular === true">מומלץ</div>
              <span class="badge badge-out-of-stock" *ngIf="!isAvailable(salad)">לא זמין כרגע</span>
            </div>
            
            <div class="card-content">
              <h4 class="card-title">{{ salad.name }}</h4>
              <p class="card-desc">{{ salad.description }}</p>
              
              <!-- Price Per 100g (optional line) -->
              <div class="price-unit" *ngIf="salad.pricePer100g">
                {{ 'PRODUCT.PRICE_100G' | translate }} {{ salad.pricePer100g }} {{ 'PRODUCT.SHEKEL' | translate }}
              </div>
              
              <!-- Pricing Options Dropdown - preserved -->
              <select 
                *ngIf="hasPricingOptions(salad)"
                class="form-control card-select"
                [value]="getSelectedOptionIndex(salad.id || salad._id || '')"
                (change)="selectPricingOption(salad.id || salad._id || '', $event)"
              >
                <option value="">בחרו אפשרות</option>
                <option *ngFor="let option of getPricingOptions(salad); let i = index" [value]="i">
                  {{ option.label }} - {{ option.amount }} - ₪{{ option.price }}
                </option>
              </select>
              
              <!-- Size selection (pricingVariants) - preserved -->
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
              
              <div class="card-price" *ngIf="!hasPricingOptions(salad) && !hasPricingVariants(salad)">₪{{ getPrice(salad) }}</div>
              <div class="card-price" *ngIf="(hasPricingOptions(salad) || hasPricingVariants(salad)) && hasSelectedOption(salad)">₪{{ getSelectedPrice(salad) }}</div>
              
              <div class="error-message" *ngIf="hasValidationError(salad.id || salad._id || '')">
                נא לבחור גודל תחילה
              </div>
              
              <div class="card-actions">
                <button 
                  (click)="showDetails(salad)" 
                  class="btn-details"
                  [attr.aria-label]="'פרטים על ' + salad.name"
                >
                  פרטים
                </button>
                <button 
                  (click)="addToCart(salad)" 
                  class="btn-add"
                  [attr.aria-label]="'הוסף לסל ' + salad.name"
                  [disabled]="!isAvailable(salad)"
                >
                  <mat-icon>shopping_cart</mat-icon>
                  הוספה לסל
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
      justify-content: center;
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
  settingsService = inject(SiteSettingsService);
  seoService = inject(SeoService);
  router = inject(Router);

  settings: SiteSettings | null = null;
  showPopup = false;

  salads: MenuItem[] = [];
  isLoading = true;
  selectedSizes: { [key: string]: 'small' | 'large' } = {}; // Legacy support
  selectedOptions: { [key: string]: number } = {}; // For pricingOptions: itemId -> option index
  selectedVariants: { [key: string]: number } = {}; // For pricingVariants: itemId -> variant index
  validationErrors: { [key: string]: boolean } = {}; // Track validation errors per item

  ngOnInit(): void {
    this.seoService.updateTags({
      title: 'סלטי הבית - קייטרינג מגדים | סלטים לשבת',
      description: 'מגוון סלטים טריים בעבודת יד לכבוד שבת המלכה. חומוס, טחינה, חצילים ועוד. הזמינו עכשיו.',
      image: 'https://res.cloudinary.com/dioklg7lx/image/upload/v1768906611/IMG_9750_v7mval.jpg',
      keywords: 'סלטים לשבת, חומוס, טחינה, קייטרינג מגדים, אוכל כשר'
    });
    this.settingsService.getSettings(true).subscribe(s => {
      this.settings = s ?? null;
      const pa = s?.pageAnnouncements?.['salads'];
      if ((pa?.popupTitle?.trim() ?? '') !== '' || (pa?.popupText?.trim() ?? '') !== '') {
        this.showPopup = true;
      }
    });
    this.loadSalads();
  }

  closePopup(): void {
    this.showPopup = false;
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
    let cartLineId = itemId;

    if (this.hasPricingOptions(item)) {
      const optionIndex = this.getSelectedOptionIndex(itemId);
      const options = this.getPricingOptions(item);
      if (optionIndex >= 0 && options[optionIndex]) {
        const option = options[optionIndex];
        itemName = `${item.name} (${option.label} - ${option.amount})`;
        price = option.price;
        cartLineId = `${itemId}-size-${optionIndex}`;
      }
    } else if (this.hasPricingVariants(item)) {
      const variantIndex = this.getSelectedVariantIndex(itemId);
      const variants = this.getPricingVariants(item);
      if (variantIndex >= 0 && variants[variantIndex]) {
        const variant = variants[variantIndex];
        itemName = `${item.name} (${variant.label})`;
        price = variant.price;
        cartLineId = `${itemId}-size-${variantIndex}`;
      }
    }

    this.cartService.addToCart(
      {
        id: cartLineId,
        name: itemName,
        price,
        imageUrl: item.imageUrl ?? '',
        description: item.description,
        category: item.category
      },
      1
    );
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