import { Component, OnInit, inject, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';

import { MenuService, MenuItem } from '../../../../../services/menu.service';
import { CartService } from '../../../../../services/cart.service';
import { SeoService } from '../../../../../services/seo.service';

@Component({
  selector: 'app-salad-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="salad-detail-page">
      <div class="container">
        <!-- Breadcrumbs -->
        <nav class="breadcrumbs" aria-label="breadcrumb">
          <a routerLink="/ready-for-shabbat/salads">סלטים</a>
          <span class="separator">/</span>
          <span class="current">{{ salad?.name || '' }}</span>
        </nav>

        <div class="product-layout" *ngIf="salad">
          <!-- Right Side - Product Image -->
          <div class="product-image">
            <div 
              class="image-container"
              (mousemove)="onImageMouseMove($event)"
              (mouseleave)="onImageMouseLeave()"
            >
              <img 
                [src]="salad.imageUrl || '/assets/images/placeholder-dish.jpg'" 
                [alt]="salad.name"
                class="product-img"
                #productImage
                loading="eager"
              >
            </div>
          </div>

          <!-- Left Side - Product Info -->
          <div class="product-info">
            <div class="product-header">
              <h1 class="product-name">{{ salad.name }}</h1>
            </div>

            <!-- Product Description -->
            <div class="product-description">
              <h3 class="description-title">תיאור המוצר:</h3>
              <p>{{ salad.description }}</p>
            </div>

            <!-- Price and Size -->
            <div class="price-size-section">
              <div class="price-section">
                <span class="price-label">מחיר:</span>
                <span class="price">₪{{ currentPrice }}</span>
              </div>
              <div class="size-selector-group">
                <label for="size-select" class="size-label">גודל:</label>
                <div class="size-buttons">
                  <button 
                    class="size-btn" 
                    [class.active]="selectedSize === 'small'"
                    (click)="selectSize('small')"
                  >
                    <span class="size-weight">250 גרם</span>
                    <span class="size-price">₪17</span>
                  </button>
                  <button 
                    class="size-btn" 
                    [class.active]="selectedSize === 'large'"
                    (click)="selectSize('large')"
                  >
                    <span class="size-weight">500 גרם</span>
                    <span class="size-price">₪29</span>
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
              [disabled]="!salad.isAvailable"
              [attr.aria-label]="'הוסף לסל ' + salad.name"
            >
              <i class="fas fa-shopping-cart"></i>
              הוסף לסל
            </button>

            <!-- Tags -->
            <div class="product-tags" *ngIf="salad.tags && getFilteredTags().length > 0">
              <span 
                *ngFor="let tag of getFilteredTags()" 
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

        <!-- Loading State -->
        <div *ngIf="!salad && !isLoading" class="not-found">
          <i class="fas fa-exclamation-circle"></i>
          <h2>סלט לא נמצא</h2>
          <p>הסלט המבוקש לא נמצא במערכת.</p>
          <button class="btn-back" (click)="goBack()">
            <i class="fas fa-arrow-right"></i>
            חזור לסלטים
          </button>
        </div>

        <!-- Loading State -->
        <div *ngIf="isLoading" class="loading">
          <i class="fas fa-spinner fa-spin"></i>
          <span>טוען פרטי סלט...</span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .salad-detail-page {
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
      color: #cbb69e;
    }

    .breadcrumbs .separator {
      color: #999;
    }

    .breadcrumbs .current {
      color: #0E1A24;
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
      margin: 0 0 0.5rem 0;
      line-height: 1.2;
      padding-bottom: 0.75rem;
      border-bottom: 2px solid #E0C075;
    }

    /* Price and Size Section – seamless on white */
    .price-size-section {
      padding: 0 0 1.25rem 0;
      margin-bottom: 1.25rem;
      background: #ffffff;
      border-radius: 0;
      border: none;
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
      color: #0E1A24;
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
    }

    .quantity-label {
      font-size: 0.95rem;
      color: #0E1A24;
      font-weight: 600;
    }

    .quantity-controls {
      display: inline-flex;
      align-items: center;
      gap: 0;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      overflow: hidden;
      background: #ffffff;
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
      transition: background 0.2s ease, color 0.2s ease;
      font-size: 0.75rem;
    }

    .quantity-btn:hover:not(:disabled) {
      background: #faf7ef;
      color: #1f3540;
    }

    .quantity-btn:disabled {
      background: #fafafa;
      color: #bbb;
      cursor: not-allowed;
    }

    .quantity-input {
      width: 60px;
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
      background: #ffffff;
    }

    /* Add to Cart Button */
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
      transition: opacity 0.25s ease, box-shadow 0.25s ease, transform 0.2s ease;
      margin-top: 0.5rem;
    }

    .btn-add-to-cart:hover:not(:disabled) {
      opacity: 0.92;
      box-shadow: 0 6px 20px rgba(26, 43, 76, 0.35);
      transform: translateY(-2px);
    }

    .btn-add-to-cart:disabled {
      background: #ccc;
      color: #666;
      cursor: not-allowed;
    }

    .btn-add-to-cart i {
      font-size: 1rem;
    }

    /* Product Description */
    .product-description {
      margin-top: 0;
      margin-bottom: 1rem;
    }

    .description-title {
      font-size: 1rem;
      font-weight: 600;
      color: #0E1A24;
      margin: 0 0 0.4rem 0;
    }

    .product-description p {
      font-size: 1rem;
      line-height: 1.6;
      color: #555555;
      margin: 0;
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
      object-fit: cover; /* Fill the square uniformly */
      display: block;
      transition: transform 0.4s ease;
      transform-origin: center center;
      transform: scale(1);
    }

    .image-container:hover .product-img {
      transform: scale(1.08); /* Premium subtle zoom on hover */
    }


    /* Loading & Not Found */
    .loading, .not-found {
      text-align: center;
      padding: 4rem 0;
      color: #6c757d;
    }

    .loading i, .not-found i {
      font-size: 3rem;
      color: #cbb69e;
      margin-bottom: 1rem;
    }

    .not-found h2 {
      font-size: 2rem;
      color: #0E1A24;
      margin-bottom: 1rem;
    }

    .btn-back {
      margin-top: 2rem;
      padding: 0.875rem 1.5rem;
      background: #cbb69e;
      color: #0E1A24;
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
      background: #b8a48a;
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

    /* Recommended Salads Slider */
    .recommended-section {
      margin-top: 4rem;
      padding-top: 2rem;
      border-top: 1px solid #e0e0e0;
    }

    .recommended-title {
      font-size: 1.75rem;
      font-weight: bold;
      color: #0E1A24;
      margin-bottom: 1.5rem;
      text-align: center;
    }

    .salads-slider {
      position: relative;
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .slider-container {
      flex: 1;
      overflow: hidden;
      position: relative;
    }

    .slider-track {
      display: flex;
      gap: 1.5rem;
      transition: transform 0.3s ease;
      overflow-x: auto;
      scroll-behavior: smooth;
      scrollbar-width: none;
      -ms-overflow-style: none;
    }

    .slider-track::-webkit-scrollbar {
      display: none;
    }

    .salad-card {
      min-width: 280px;
      max-width: 280px;
      background: white;
      border-radius: 0.5rem;
      overflow: hidden;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      transition: all 0.3s ease;
      display: flex;
      flex-direction: column;
    }

    .salad-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 20px rgba(0, 0, 0, 0.15);
    }

    .card-image {
      width: 100%;
      height: 200px;
      overflow: hidden;
      background: #f5f5f5;
    }

    .card-image img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transition: transform 0.3s ease;
    }

    .salad-card:hover .card-image img {
      transform: scale(1.05);
    }

    .card-content {
      padding: 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .card-name {
      font-size: 1.1rem;
      font-weight: bold;
      color: #0E1A24;
      margin: 0;
    }

    .card-description {
      font-size: 0.9rem;
      color: #6c757d;
      line-height: 1.5;
      margin: 0;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .card-details-btn {
      width: 100%;
      padding: 0.75rem 1rem;
      margin-top: 0.75rem;
      background: #cbb69e;
      color: #0E1A24;
      border: none;
      border-radius: 0.5rem;
      font-size: 0.95rem;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      transition: all 0.3s ease;
    }

    .card-details-btn:hover {
      background: #b8a48a;
      transform: translateY(-2px);
      box-shadow: 0 4px 8px rgba(224, 192, 117, 0.3);
    }

    .card-details-btn i {
      font-size: 0.9rem;
    }

    .slider-btn {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      border: 2px solid #cbb69e;
      background: white;
      color: #cbb69e;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.3s ease;
      flex-shrink: 0;
    }

    .slider-btn:hover {
      background: #cbb69e;
      color: white;
      transform: scale(1.1);
    }

    .slider-btn:disabled {
      opacity: 0.3;
      cursor: not-allowed;
    }

    @media (max-width: 768px) {
      .recommended-section {
        margin-top: 3rem;
        padding-top: 1.5rem;
      }

      .recommended-title {
        font-size: 1.5rem;
        margin-bottom: 1rem;
      }

      .salad-card {
        min-width: 240px;
        max-width: 240px;
      }

      .slider-btn {
        width: 40px;
        height: 40px;
      }
    }
  `]
})
export class SaladDetailComponent implements OnInit {
  @ViewChild('sliderTrack') sliderTrack!: ElementRef<HTMLDivElement>;
  @ViewChild('productImage') productImage!: ElementRef<HTMLImageElement>;

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private menuService = inject(MenuService);
  private cartService = inject(CartService);
  private seoService = inject(SeoService);

  salad: MenuItem | null = null;
  isLoading = true;
  selectedSize: 'small' | 'large' = 'small';
  quantity = 1;
  currentPrice = 0;
  ngOnInit(): void {
    // Scroll to top when component initializes
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    // Listen to route parameter changes and scroll to top
    this.route.paramMap.subscribe(params => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      const saladId = params.get('id');
      if (saladId) {
        this.loadSalad(saladId);
      } else {
        this.isLoading = false;
      }
    });
  }

  loadSalad(id: string): void {
    // First try to load from API
    this.menuService.getMenuItems().subscribe({
      next: (items) => {
        // Search in API items first
        let found: MenuItem | undefined = items.find(item => item.id === id);
        
        // If not found, try to find in salads category
        if (!found) {
          const salads = items.filter(item => item.category === 'סלטים');
          found = salads.find(item => item.id === id);
        }
        
        // If still not found, try to load from featured salads
        if (!found) {
          found = this.getFeaturedSaladById(id);
        }
        
        if (found) {
          this.salad = found;
          this.seoService.updateTags({
            title: `${found.name} | קייטרינג מגדים - סלטים`,
            description: found.description || found.name,
            image: found.imageUrl
          });
          this.updatePrice();
        } else {
          console.warn(`Salad with id ${id} not found`);
          this.salad = null;
        }
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading salad:', error);
        // On error, try to load from featured salads
        const found = this.getFeaturedSaladById(id);
        if (found) {
          this.salad = found;
          this.seoService.updateTags({
            title: `${found.name} | קייטרינג מגדים - סלטים`,
            description: found.description || found.name,
            image: found.imageUrl
          });
          this.updatePrice();
        } else {
          this.salad = null;
        }
        this.isLoading = false;
      }
    });
  }

  private getFeaturedSaladById(id: string): MenuItem | undefined {
    // Featured fallback is no longer used – return undefined to avoid TS errors.
    return undefined;
  }


  getPriceForSize(size: 'small' | 'large'): number {
    if (size === 'small') return 17;
    if (size === 'large') return 29;
    return 17;
  }

  updatePrice(): void {
    this.currentPrice = this.getPriceForSize(this.selectedSize) * this.quantity;
  }

  increaseQuantity(): void {
    if (this.quantity < 10) {
      this.quantity++;
      this.updatePrice();
    }
  }

  decreaseQuantity(): void {
    if (this.quantity > 1) {
      this.quantity--;
      this.updatePrice();
    }
  }

  onQuantityChange(): void {
    if (this.quantity < 1) this.quantity = 1;
    if (this.quantity > 10) this.quantity = 10;
    this.updatePrice();
  }

  selectSize(size: 'small' | 'large'): void {
    this.selectedSize = size;
    this.updatePrice();
  }

  addToCart(): void {
    if (!this.salad) return;

    // Ensure we have a valid ID
    const saladId = this.salad.id || this.salad._id || '';
    if (!saladId) {
      console.error('❌ Cannot add to cart: salad ID is missing', this.salad);
      alert('שגיאה: לא ניתן להוסיף את הפריט לעגלה. אנא רענן את הדף ונסה שוב.');
      return;
    }

    const price = this.getPriceForSize(this.selectedSize);
    const totalPrice = price * this.quantity;

    // Validate price
    if (!price || price <= 0 || isNaN(price)) {
      console.error('❌ Cannot add to cart: invalid price', price);
      alert('שגיאה: מחיר לא תקין. אנא נסה שוב.');
      return;
    }

    // Add to cart with selected size and quantity
    for (let i = 0; i < this.quantity; i++) {
      this.cartService.addItem({
        id: `${saladId}-${this.selectedSize}`,
        name: `${this.salad.name} (${this.getSizeLabel(this.selectedSize)})`,
        price: price,
        imageUrl: this.salad.imageUrl || '/assets/images/placeholder-dish.jpg',
        description: this.salad.description,
        category: this.salad.category
      });
    }

    // Open cart after adding item
    this.cartService.openCart();
  }

  getSizeLabel(size: 'small' | 'large'): string {
    const labels = {
      small: '250 גרם',
      large: '500 גרם'
    };
    return labels[size];
  }

  getFilteredTags(): string[] {
    if (!this.salad || !this.salad.tags) {
      return [];
    }
    // Filter out 'דגים' tag
    return this.salad.tags.filter(tag => tag !== 'דגים');
  }


  goBack(): void {
    this.router.navigate(['/ready-for-shabbat/salads']);
  }

  onImageMouseMove(event: MouseEvent): void {
    if (!this.productImage) return;
    
    const img = this.productImage.nativeElement;
    const container = (event.currentTarget as HTMLElement);
    const rect = container.getBoundingClientRect();
    
    // Calculate mouse position relative to the container
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // Calculate percentage position (0-100%)
    const xPercent = (x / rect.width) * 100;
    const yPercent = (y / rect.height) * 100;
    
    // Set transform origin to mouse position and scale (1.5 instead of 2)
    img.style.transformOrigin = `${xPercent}% ${yPercent}%`;
    img.style.transform = 'scale(1.5)';
  }

  onImageMouseLeave(): void {
    if (!this.productImage) return;
    
    const img = this.productImage.nativeElement;
    img.style.transform = 'scale(1)';
    img.style.transformOrigin = 'center center';
  }
}

