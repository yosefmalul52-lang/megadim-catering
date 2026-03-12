import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';

import { MenuService, MenuItem, PricingOption, PriceVariant } from '../../../../services/menu.service';
import { CartService } from '../../../../services/cart.service';
import { SeoService } from '../../../../services/seo.service';

@Component({
  selector: 'app-product-details',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="product-details-page">
      <div class="container">
        <!-- Breadcrumbs -->
        <nav class="breadcrumbs" aria-label="breadcrumb">
          <a routerLink="/ready-for-shabbat">אוכל מוכן לשבת</a>
          <span class="separator">/</span>
          <a [routerLink]="getCategoryLink()">{{ getCategoryName() }}</a>
          <span class="separator">/</span>
          <span class="current">{{ product?.name || '' }}</span>
        </nav>

        <!-- Loading State -->
        <div *ngIf="isLoading" class="loading">
          <i class="fas fa-spinner fa-spin"></i>
          <span>טוען פרטי מוצר...</span>
        </div>

        <!-- Product Not Found -->
        <div *ngIf="!isLoading && !product" class="not-found">
          <i class="fas fa-exclamation-circle"></i>
          <h2>מוצר לא נמצא</h2>
          <p>המוצר המבוקש לא נמצא במערכת.</p>
          <button class="btn-back" (click)="goBack()">
            <i class="fas fa-arrow-right"></i>
            חזור לקטלוג
          </button>
        </div>

        <!-- Product Layout -->
        <div class="product-layout" *ngIf="!isLoading && product">
          <!-- Right Side - Product Image -->
          <div class="product-image">
            <div class="image-container">
              <img 
                [src]="product.imageUrl || '/assets/images/placeholder-dish.jpg'" 
                [alt]="product.name"
                class="product-img"
                loading="eager"
              >
            </div>
          </div>

          <!-- Left Side - Product Info -->
          <div class="product-info">
            <div class="product-header">
              <h1 class="product-name">{{ product.name }}</h1>
            </div>

            <!-- Product Description -->
            <div class="product-description">
              <h3 class="description-title">תיאור המוצר:</h3>
              <p>{{ product.description || 'תיאור המוצר יופיע כאן' }}</p>
            </div>

            <!-- Price and Size Section -->
            <div class="price-size-section">
              <div class="price-section">
                <span class="price-label">מחיר:</span>
                <span class="price">₪{{ getCurrentPrice() }}</span>
              </div>
              
              <!-- Size Selector (only if product has pricing options/variants) -->
              <div class="size-selector-group" *ngIf="hasSizeOptions()">
                <label class="size-label">גודל:</label>
                <div class="size-buttons">
                  <button 
                    *ngFor="let option of getSizeOptions(); let i = index"
                    class="size-btn" 
                    [class.active]="selectedSizeIndex === i"
                    (click)="selectSize(i)"
                  >
                    <span class="size-weight">{{ getSizeLabel(option) }}</span>
                    <span class="size-price">₪{{ getSizePrice(option) }}</span>
                  </button>
                </div>
              </div>
            </div>

            <!-- Quantity Section -->
            <div class="quantity-section">
              <label class="quantity-label">כמות:</label>
              <div class="quantity-controls">
                <button 
                  class="quantity-btn minus" 
                  (click)="decreaseQuantity()"
                  [disabled]="quantity <= 1"
                  aria-label="הפחת כמות"
                >
                  <i class="fas fa-minus"></i>
                </button>
                <input 
                  type="number" 
                  class="quantity-input" 
                  [(ngModel)]="quantity"
                  min="1"
                  max="10"
                  (change)="onQuantityChange()"
                  aria-label="כמות"
                >
                <button 
                  class="quantity-btn plus" 
                  (click)="increaseQuantity()"
                  [disabled]="quantity >= 10"
                  aria-label="הגדל כמות"
                >
                  <i class="fas fa-plus"></i>
                </button>
              </div>
            </div>

            <!-- Add to Cart Button -->
            <button 
              class="btn-add-to-cart"
              (click)="addToCart()"
              [disabled]="!product.isAvailable"
              [attr.aria-label]="'הוסף לסל ' + product.name"
            >
              <i class="fas fa-shopping-cart"></i>
              הוסף לסל
            </button>

            <!-- Tags -->
            <div class="product-tags" *ngIf="product.tags && product.tags.length > 0">
              <span 
                *ngFor="let tag of product.tags" 
                class="tag"
                [class.vegan]="tag === 'טבעוני'"
                [class.healthy]="tag === 'בריא'"
                [class.gluten-free]="tag === 'ללא גלוטן'"
                [class.spicy]="tag === 'חריף'"
              >
                {{ tag }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .product-details-page {
      min-height: 100vh;
      background-color: #ffffff;
      padding: 1.5rem 0;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 2rem;
    }

    /* Breadcrumbs */
    .breadcrumbs {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 1.5rem;
      font-size: 0.9rem;
      color: #6c757d;
    }

    .breadcrumbs a {
      color: #6c757d;
      text-decoration: none;
      transition: color 0.2s;
    }

    .breadcrumbs a:hover {
      color: var(--primary-gold);
    }

    .breadcrumbs .separator {
      color: #999;
    }

    .breadcrumbs .current {
      color: #1f3540;
      font-weight: 600;
    }

    /* Product Layout */
    .product-layout {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 3rem;
      align-items: start;
    }

    /* Product Info */
    .product-info {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .product-header {
      margin-bottom: 0.75rem;
    }

    .product-name {
      font-size: 2rem;
      font-weight: 700;
      color: #1f3540;
      margin: 0 0 0.25rem 0;
      line-height: 1.3;
      padding-bottom: 0.75rem;
      border-bottom: 2px solid var(--primary-gold);
    }

    /* Product Description */
    .product-description {
      margin-bottom: 1rem;
    }

    .description-title {
      font-size: 1rem;
      font-weight: 600;
      color: #1f3540;
      margin: 0 0 0.4rem 0;
    }

    .product-description p {
      font-size: 1rem;
      line-height: 1.85;
      color: #555;
      margin: 0;
    }

    /* Price and Size Section - seamless with page, no gray box */
    .price-size-section {
      padding: 0.5rem 0;
      margin-bottom: 1rem;
    }

    .price-section {
      display: flex;
      align-items: baseline;
      gap: 0.5rem;
      margin-bottom: 0.75rem;
    }

    .price-label {
      font-size: 1rem;
      color: #6c757d;
      font-weight: 600;
    }

    .price {
      font-size: 2rem;
      font-weight: bold;
      color: #1f3540;
    }

    .size-selector-group {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .size-label {
      font-size: 0.95rem;
      color: #6c757d;
      font-weight: 600;
    }

    .size-buttons {
      display: flex;
      gap: 0.75rem;
    }

    .size-btn {
      flex: 1;
      padding: 0.85rem 0.75rem;
      border: 1px solid var(--primary-gold);
      border-radius: 8px;
      background: #ffffff;
      color: #1f3540;
      cursor: pointer;
      transition: all 0.3s ease;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.25rem;
    }

    .size-btn:hover {
      border-color: var(--primary-gold);
      background: #faf7ef;
    }

    .size-btn.active {
      border-color: var(--primary-gold);
      background: var(--primary-gold);
      color: #1f3540;
      box-shadow: 0 4px 14px rgba(224, 192, 117, 0.35);
    }

    .size-weight {
      font-size: 0.9rem;
      font-weight: 600;
    }

    .size-price {
      font-size: 0.9rem;
      color: #6c757d;
    }

    .size-btn.active .size-price {
      color: #1f3540;
    }

    /* Quantity Section */
    .quantity-section {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 1rem;
    }

    .quantity-label {
      font-size: 0.95rem;
      color: #1f3540;
      font-weight: 600;
    }

    .quantity-controls {
      display: inline-flex;
      align-items: center;
      gap: 0;
      border: 1px solid rgba(224, 192, 117, 0.6);
      border-radius: 8px;
      overflow: hidden;
      background: #ffffff;
      box-shadow: 0 1px 2px rgba(0,0,0,0.04);
    }

    .quantity-btn {
      width: 40px;
      height: 40px;
      background: #ffffff;
      color: #1f3540;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: color 0.2s ease, background 0.2s ease;
      font-size: 0.75rem;
    }

    .quantity-btn:hover:not(:disabled) {
      background: rgba(224, 192, 117, 0.12);
      color: #1f3540;
    }

    .quantity-btn:disabled {
      background: #fafafa;
      color: #bbb;
      cursor: not-allowed;
    }

    .quantity-input {
      width: 52px;
      height: 40px;
      text-align: center;
      border: none;
      border-left: 1px solid rgba(0,0,0,0.08);
      border-right: 1px solid rgba(0,0,0,0.08);
      font-size: 1rem;
      font-weight: 600;
      color: #1f3540;
      background: #ffffff;
      -moz-appearance: textfield;
    }

    .quantity-input::-webkit-outer-spin-button,
    .quantity-input::-webkit-inner-spin-button {
      -webkit-appearance: none;
      margin: 0;
    }

    .quantity-input:focus {
      outline: none;
    }

    /* Add to Cart Button - Premium Navy */
    .btn-add-to-cart {
      width: 100%;
      padding: 1rem 1.5rem;
      background: #1a2b4c;
      color: #ffffff;
      border: none;
      border-radius: 8px;
      font-size: 1rem;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      transition: opacity 0.25s ease, box-shadow 0.25s ease;
      margin-top: 0.5rem;
    }

    .btn-add-to-cart:hover:not(:disabled) {
      opacity: 0.92;
      box-shadow: 0 6px 20px rgba(26, 43, 76, 0.35);
    }

    .btn-add-to-cart:disabled {
      background: #ccc;
      color: #666;
      cursor: not-allowed;
    }

    .btn-add-to-cart i {
      font-size: 1rem;
    }

    /* Tags */
    .product-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-top: 0.75rem;
    }

    .tag {
      padding: 0.5rem 1rem;
      border-radius: 1.5rem;
      font-size: 0.875rem;
      font-weight: 600;
      background: #f5f5f5;
      color: #1f3540;
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
      color: #1f3540;
    }

    .tag.spicy {
      background: rgba(244, 67, 54, 0.9);
      color: white;
    }

    /* Product Image */
    .product-image {
      position: sticky;
      top: 2rem;
    }

    .image-container {
      position: relative;
      width: 100%;
      aspect-ratio: 1 / 1;
      border-radius: 12px;
      overflow: hidden;
      background: #ffffff;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.06);
      cursor: crosshair;
    }

    .product-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
      transition: transform 0.4s ease;
      transform-origin: center center;
      transform: scale(1);
    }

    .image-container:hover .product-img {
      transform: scale(1.08); /* כמו בדף הסלטים – זום עדין בריחוף */
    }

    /* Loading & Not Found */
    .loading, .not-found {
      text-align: center;
      padding: 4rem 0;
      color: #6c757d;
    }

    .loading i, .not-found i {
      font-size: 3rem;
      color: var(--primary-gold);
      margin-bottom: 1rem;
    }

    .not-found h2 {
      font-size: 2rem;
      color: #1f3540;
      margin-bottom: 1rem;
    }

    .btn-back {
      margin-top: 2rem;
      padding: 0.875rem 1.5rem;
      background: var(--primary-gold);
      color: #1f3540;
      border: none;
      border-radius: 0.5rem;
      font-weight: 700;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      transition: all 0.3s ease;
    }

    .btn-back:hover {
      background: rgba(224, 192, 117, 0.9);
      transform: translateY(-2px);
    }

    /* Responsive */
    @media (max-width: 968px) {
      .product-layout {
        grid-template-columns: 1fr;
        gap: 2rem;
      }

      .product-image {
        position: relative;
        top: 0;
      }

      .product-name {
        font-size: 2rem;
      }

      .price {
        font-size: 2rem;
      }
    }

    @media (max-width: 768px) {
      .container {
        padding: 0 1rem;
      }

      .product-name {
        font-size: 1.75rem;
      }

      .quantity-section {
        flex-direction: column;
        align-items: flex-start;
        gap: 0.75rem;
      }

      .quantity-controls {
        width: 100%;
      }
    }
  `]
})
export class ProductDetailsComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private menuService = inject(MenuService);
  private cartService = inject(CartService);
  private seoService = inject(SeoService);

  product: MenuItem | null = null;
  isLoading = true;
  quantity = 1;
  category: string = '';
  selectedSizeIndex: number = 0;

  ngOnInit(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    this.route.paramMap.subscribe(params => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      const productId = params.get('id');
      
      // Get category from route data or URL path
      const routeData = this.route.snapshot.data;
      const url = this.router.url;
      
      if (routeData && routeData['category']) {
        this.category = routeData['category'];
      } else if (url) {
        // Extract category from URL (e.g., /ready-for-shabbat/main-dishes/123)
        const urlParts = url.split('/');
        const categoryIndex = urlParts.indexOf('ready-for-shabbat');
        if (categoryIndex >= 0 && categoryIndex + 1 < urlParts.length) {
          const potentialCategory = urlParts[categoryIndex + 1];
          // Check if it's a valid category (not 'id' parameter)
          // Support both SHORT paths (main, fish, salads, sides) and old paths (main-dishes, side-dishes)
          if (potentialCategory && potentialCategory !== productId && 
              ['main', 'main-dishes', 'fish', 'salads', 'desserts', 'sides', 'side-dishes'].includes(potentialCategory)) {
            // Map to SHORT route path
            this.category = this.getCategoryRoute(potentialCategory);
          }
        }
      }
      
      if (productId) {
        this.loadProduct(productId);
      } else {
        this.isLoading = false;
      }
    });
  }

  private loadProduct(productId: string): void {
    this.isLoading = true;
    
    console.log('🔍 ProductDetailsComponent - Requested ID:', productId);
    
    // Use the centralized getProductById method
    this.menuService.getProductById(productId).subscribe({
      next: (product) => {
        console.log('🔍 ProductDetailsComponent - Found:', product ? product.name : 'null');
        this.product = product;
        
        if (this.product) {
          this.seoService.updateTags({
            title: `${this.product.name} | קייטרינג מגדים`,
            description: this.product.description || this.product.name,
            image: this.product.imageUrl
          });
          if (this.hasSizeOptions()) {
            this.selectedSizeIndex = 0;
          }
          if (!this.category && this.product.category) {
            this.category = this.getCategoryRoute(this.product.category);
          }
        }
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading product:', error);
        this.product = null;
        this.isLoading = false;
      }
    });
  }

  hasSizeOptions(): boolean {
    if (!this.product) return false;
    const hasPricingOptions = this.product.pricingOptions && this.product.pricingOptions.length > 0;
    const hasPricingVariants = this.product.pricingVariants && this.product.pricingVariants.length > 0;
    return !!(hasPricingOptions || hasPricingVariants);
  }

  getSizeOptions(): (PricingOption | PriceVariant)[] {
    if (!this.product) return [];
    if (this.product.pricingOptions && this.product.pricingOptions.length > 0) {
      return this.product.pricingOptions;
    }
    if (this.product.pricingVariants && this.product.pricingVariants.length > 0) {
      return this.product.pricingVariants;
    }
    return [];
  }

  getSizeLabel(option: PricingOption | PriceVariant): string {
    // Check if it's a PricingOption (has label property)
    if ('label' in option) {
      const pricingOption = option as PricingOption;
      return pricingOption.label || '';
    }
    // Check if it's a PriceVariant (has size property)
    if ('size' in option) {
      const priceVariant = option as PriceVariant;
      return priceVariant.size || priceVariant.label || '';
    }
    return '';
  }

  getSizePrice(option: PricingOption | PriceVariant): number {
    return option.price || 0;
  }

  selectSize(index: number): void {
    this.selectedSizeIndex = index;
  }

  getCurrentPrice(): number {
    if (!this.product) return 0;
    
    // If product has size options, use selected size price
    if (this.hasSizeOptions()) {
      const options = this.getSizeOptions();
      if (options[this.selectedSizeIndex]) {
        return this.getSizePrice(options[this.selectedSizeIndex]);
      }
    }
    
    // Fallback to regular price
    return this.product.price || 0;
  }

  increaseQuantity(): void {
    if (this.quantity < 10) {
      this.quantity++;
    }
  }

  decreaseQuantity(): void {
    if (this.quantity > 1) {
      this.quantity--;
    }
  }

  onQuantityChange(): void {
    if (this.quantity < 1) this.quantity = 1;
    if (this.quantity > 10) this.quantity = 10;
  }

  addToCart(): void {
    if (!this.product || !this.product.isAvailable) return;

    const baseId = String(this.product.id ?? this.product._id ?? '');
    if (!baseId) return;

    let itemName = this.product.name;
    let price = this.getCurrentPrice();
    // Stable cart line id: same product + same size = same line (quantity merged)
    let cartLineId = baseId;

    if (this.hasSizeOptions()) {
      const options = this.getSizeOptions();
      if (options[this.selectedSizeIndex]) {
        const option = options[this.selectedSizeIndex];
        const label = this.getSizeLabel(option);
        itemName = `${this.product.name} (${label})`;
        price = this.getSizePrice(option);
        cartLineId = `${baseId}-size-${this.selectedSizeIndex}`;
      }
    }

    this.cartService.addToCart(
      {
        id: cartLineId,
        name: itemName,
        price,
        imageUrl: this.product.imageUrl ?? '',
        description: this.product.description,
        category: this.product.category
      },
      this.quantity
    );
    this.cartService.openCart();
  }

  /**
   * Maps category names (Hebrew or English long names) to SHORT route paths
   * This ensures "Back to Catalog" always uses the canonical short paths: main, fish, salads, sides
   */
  getCategoryRoute(category: string): string {
    const mapping: { [key: string]: string } = {
      // Hebrew category names -> short routes
      'מנות עיקריות': 'main',
      'דגים': 'fish',
      'סלטים': 'salads',
      'ממולאים': 'desserts',
      'תוספות': 'sides',
      // English long names -> short routes
      'main-dishes': 'main',
      'side-dishes': 'sides',
      // Short routes -> short routes (identity - already short)
      'main': 'main',
      'fish': 'fish',
      'salads': 'salads',
      'desserts': 'desserts',
      'sides': 'sides'
    };
    return mapping[category] || 'main'; // Default fallback to 'main'
  }

  getCategoryLink(): string {
    let categoryToMap = this.category;
    
    // If no category from route, try to get from product
    if (!categoryToMap && this.product && this.product.category) {
      categoryToMap = this.product.category;
    }
    
    if (categoryToMap) {
      const routeCategory = this.getCategoryRoute(categoryToMap);
      return `/ready-for-shabbat/${routeCategory}`;
    }
    
    return '/ready-for-shabbat';
  }

  getCategoryName(): string {
    if (!this.category) {
      // Try to get category from product
      if (this.product && this.product.category) {
        return this.product.category;
      }
      return 'מוצרים';
    }
    
    const categoryNames: { [key: string]: string } = {
      'main': 'מנות עיקריות',
      'main-dishes': 'מנות עיקריות',
      'fish': 'דגים',
      'salads': 'סלטים',
      'desserts': 'ממולאים',
      'sides': 'תוספות',
      'side-dishes': 'תוספות'
    };
    
    return categoryNames[this.category] || 'מוצרים';
  }

  goBack(): void {
    let categoryToMap = this.category;
    
    // If no category from route, try to get from product
    if (!categoryToMap && this.product && this.product.category) {
      categoryToMap = this.product.category;
    }
    
    if (categoryToMap) {
      const routeCategory = this.getCategoryRoute(categoryToMap);
      this.router.navigate(['/ready-for-shabbat', routeCategory]);
    } else {
      this.router.navigate(['/ready-for-shabbat']);
    }
  }
}
