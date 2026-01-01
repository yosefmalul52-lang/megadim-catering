import { Component, OnInit, inject, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';

import { MenuService, MenuItem } from '../../../../../services/menu.service';
import { CartService } from '../../../../../services/cart.service';

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

        <!-- Recommended Salads Slider -->
        <div class="recommended-section" *ngIf="salad && recommendedSalads.length > 0">
          <h2 class="recommended-title">עוד סלטים מומלצים</h2>
          <div class="salads-slider">
            <button 
              class="slider-btn prev" 
              (click)="scrollSlider(1)"
              aria-label="גלול ימינה"
            >
              <i class="fas fa-chevron-right"></i>
            </button>
            <div class="slider-container">
              <div class="slider-track" #sliderTrack>
                <div 
                  *ngFor="let recommendedSalad of recommendedSalads" 
                  class="salad-card"
                >
                  <div class="card-image">
                    <img 
                      [src]="recommendedSalad.imageUrl || '/assets/images/placeholder-dish.jpg'" 
                      [alt]="recommendedSalad.name"
                      loading="lazy"
                    >
                  </div>
                  <div class="card-content">
                    <h3 class="card-name">{{ recommendedSalad.name }}</h3>
                    <p class="card-description">{{ recommendedSalad.description }}</p>
                    <button 
                      class="card-details-btn"
                      (click)="navigateToSalad(recommendedSalad.id)"
                      [attr.aria-label]="'פרטים על ' + recommendedSalad.name"
                    >
                      <i class="fas fa-info-circle"></i>
                      פרטים
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <button 
              class="slider-btn next" 
              (click)="scrollSlider(-1)"
              aria-label="גלול שמאלה"
            >
              <i class="fas fa-chevron-left"></i>
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .salad-detail-page {
      min-height: 100vh;
      background-color: #fdf5f0;
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
      font-weight: bold;
      color: #0E1A24;
      margin: 0 0 0.25rem 0;
      line-height: 1.2;
      padding-bottom: 0.75rem;
      border-bottom: 2px solid #cbb69e;
    }

    /* Price and Size Section */
    .price-size-section {
      background: #f8f9fa;
      padding: 1rem;
      border-radius: 0.75rem;
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
      gap: 0.5rem;
    }

    .size-btn {
      flex: 1;
      padding: 0.75rem 0.5rem;
      border: 2px solid #ddd;
      border-radius: 0.5rem;
      background: white;
      color: #0E1A24;
      cursor: pointer;
      transition: all 0.3s ease;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.2rem;
    }

    .size-btn:hover {
      border-color: #cbb69e;
      background: #f8f9fa;
    }

    .size-btn.active {
      border-color: #cbb69e;
      background: #cbb69e;
      color: #0E1A24;
      box-shadow: 0 2px 8px rgba(203, 182, 158, 0.3);
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
      color: #0E1A24;
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
      display: flex;
      align-items: center;
      gap: 0.5rem;
      border: 2px solid #ddd;
      border-radius: 0.5rem;
      overflow: hidden;
      background: white;
    }

    .quantity-btn {
      width: 40px;
      height: 40px;
      background: #f8f9fa;
      color: #0E1A24;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.3s ease;
      font-size: 0.875rem;
    }

    .quantity-btn:hover:not(:disabled) {
      background: #cbb69e;
      color: white;
    }

    .quantity-btn:disabled {
      background: #e0e0e0;
      color: #999;
      cursor: not-allowed;
    }

    .quantity-input {
      width: 60px;
      height: 40px;
      text-align: center;
      border: none;
      border-left: 1px solid #ddd;
      border-right: 1px solid #ddd;
      font-size: 1rem;
      font-weight: 600;
      color: #0E1A24;
      background: white;
      -moz-appearance: textfield;
    }

    .quantity-input::-webkit-outer-spin-button,
    .quantity-input::-webkit-inner-spin-button {
      -webkit-appearance: none;
      margin: 0;
    }

    .quantity-input:focus {
      outline: none;
      background: #f8f9fa;
    }

    /* Add to Cart Button */
    .btn-add-to-cart {
      width: 100%;
      padding: 1rem 1.5rem;
      background: #0E1A24;
      color: white;
      border: none;
      border-radius: 0.5rem;
      font-size: 1rem;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      transition: all 0.3s ease;
      margin-top: 0.5rem;
    }

    .btn-add-to-cart:hover:not(:disabled) {
      background: #1a2d3d;
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(14, 26, 36, 0.3);
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
      color: #6c757d;
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
      aspect-ratio: 1;
      border-radius: 1rem;
      overflow: hidden;
      background: white;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
      cursor: crosshair;
    }

    .product-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
      transition: transform 0.3s ease;
      transform-origin: center center;
      transform: scale(1);
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
      box-shadow: 0 4px 8px rgba(203, 182, 158, 0.3);
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
export class SaladDetailComponent implements OnInit, AfterViewInit {
  @ViewChild('sliderTrack') sliderTrack!: ElementRef<HTMLDivElement>;
  @ViewChild('productImage') productImage!: ElementRef<HTMLImageElement>;

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private menuService = inject(MenuService);
  private cartService = inject(CartService);

  salad: MenuItem | null = null;
  isLoading = true;
  selectedSize: 'small' | 'large' = 'small';
  quantity = 1;
  currentPrice = 0;
  recommendedSalads: Array<{id: string, name: string, description: string, imageUrl: string}> = [];

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

  ngAfterViewInit(): void {
    // Load recommended salads after view init
    this.loadRecommendedSalads();
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
          this.updatePrice();
          this.loadRecommendedSalads();
        } else {
          // If still not found, show not found message
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
          this.updatePrice();
        } else {
          this.salad = null;
        }
        this.isLoading = false;
      }
    });
  }

  private getFeaturedSaladById(id: string): MenuItem | undefined {
    // This matches the featuredSalads from SaladsComponent
    const featuredSalads = this.getAllFeaturedSalads();
    const found = featuredSalads.find(s => s.id === id);
    if (found) {
      return {
        id: found.id,
        name: found.name,
        description: found.description,
        price: found.pricePer100g,
        imageUrl: found.imageUrl,
        category: 'סלטים',
        tags: found.tags,
        isAvailable: true,
        pricePer100g: found.pricePer100g
      } as MenuItem & { pricePer100g: number };
    }
    return undefined;
  }

  private getAllFeaturedSalads(): Array<{id: string, name: string, description: string, pricePer100g: number, imageUrl: string, tags: string[]}> {
    // Complete list matching SaladsComponent.featuredSalads
    return [
      { id: 'hummus', name: 'סלט חומוס', description: 'חומוס קלאסי ביתי עשוי מגרגרי חומוס איכותיים, טחינה משובחת, לימון טרי ושום. מרקם קרמי ועדין עם טעם עשיר ומאוזן.', pricePer100g: 8.5, imageUrl: '/assets/images/salads/hummus.jpg', tags: ['טבעוני', 'ללא גלוטן'] },
      { id: 'tahini', name: 'סלט טחינה', description: 'טחינה קרמית ומרוכזת עשויה משומשום איכותי, מתובלת בלימון טרי ושום. מרקם חלק ועשיר שמביא טעם מזרח תיכוני אותנטי.', pricePer100g: 9.0, imageUrl: '/assets/images/salads/grinding.jpg', tags: ['טבעוני', 'ללא גלוטן'] },
      { id: 'tahini-red', name: 'טחינה פיקנטית אדומה', description: 'טחינה קרמית משובחת מעורבת עם סחוג אדום חריף ופלפלים חריפים טריים. שילוב מושלם בין הקרמיות לחריפות המתובלת.', pricePer100g: 9.5, imageUrl: '/assets/images/salads/Red-tahini.jpg', tags: ['טבעוני', 'ללא גלוטן', 'חריף'] },
      { id: 'tahini-green', name: 'טחינה פיקנטית ירוקה', description: 'טחינה קרמית מעורבת עם סחוג ירוק חריף ועשבי תיבול טריים. טעם מרענן וחריף שמביא איזון מושלם בין הקרמיות לחריפות.', pricePer100g: 9.5, imageUrl: '/assets/images/salads/Green-tahini.jpg', tags: ['טבעוני', 'ללא גלוטן', 'חריף'] },
      { id: 'matbucha', name: 'מטבוחה', description: 'מטבוחה מסורתית ביתית עשויה מעגבניות טריות ופלפלים מתוקים, מבושלת לאט על אש נמוכה. טעם עשיר ומתובל שמביא את הטעמים האותנטיים של המטבח המזרח תיכוני.', pricePer100g: 8.8, imageUrl: '/assets/images/salads/Matbuchah-salad.jpg', tags: ['טבעוני', 'ללא גלוטן'] },
      { id: 'eggplant-spicy', name: 'חציל פיקנטי', description: 'חציל צלוי איכותי מתובל בתבלינים חריפים ועשבי תיבול. מרקם רך ועשיר עם טעם חריף ומעניין.', pricePer100g: 10.0, imageUrl: '/assets/images/salads/Spicy-eggplant.jpg', tags: ['טבעוני', 'בריא', 'חריף'] },
      { id: 'eggplant-mayo', name: 'חציל במיונז', description: 'חציל צלוי איכותי מעורבב עם מיונז קרמי ביתי. שילוב מושלם בין הטעם העשיר של החציל הצלוי לקרמיות של המיונז.', pricePer100g: 9.8, imageUrl: '/assets/images/salads/Eggplant-mayonnaise.jpg', tags: ['טבעוני'] },
      { id: 'eggplant-tahini', name: 'חציל בטחינה', description: 'חציל צלוי איכותי מעורבב בטחינה קרמית משובחת, מתובל בפטרוזיליה טרייה ולימון. שילוב קלאסי ומעודן שמביא את הטעמים הטובים ביותר של המטבח המזרח תיכוני.', pricePer100g: 10.0, imageUrl: '/assets/images/salads/Tahini-eggplant.jpg', tags: ['טבעוני', 'בריא'] },
      { id: 'zhug-green', name: 'סחוג ירוק', description: 'סחוג ירוק חריף מסורתי עשוי מעשבי תיבול טריים ופלפלים חריפים. טעם מרענן וחריף שמביא אנרגיה וטעם ייחודי לכל מנה.', pricePer100g: 9.5, imageUrl: '/assets/images/salads/green-sahug.jpg', tags: ['טבעוני', 'ללא גלוטן', 'חריף'] },
      { id: 'zhug-red', name: 'סחוג אדום', description: 'סחוג אדום חריף עשוי מפלפלים חריפים טריים ותבלינים איכותיים. טעם עשיר וחריף שמביא חום וטעם ייחודי.', pricePer100g: 9.5, imageUrl: '/assets/images/salads/Sahug-red.jpg', tags: ['טבעוני', 'ללא גלוטן', 'חריף'] },
      { id: 'amba-mango', name: 'עמבה מנגו', description: 'עמבה מסורתית עשויה ממנגו בשל ואיכותי, מתובלת בתבלינים מיוחדים. שילוב מושלם בין המתיקות הטבעית לחריפות המתובלת.', pricePer100g: 9.2, imageUrl: '/assets/images/salads/mango-mango.jpg', tags: ['טבעוני', 'ללא גלוטן'] },
      { id: 'amba-lemon', name: 'עמבה לימון', description: 'עמבה מסורתית מעורבת עם לימון טרי וחמוץ. שילוב מרענן בין החריפות המתובלת לחמיצות הלימון, יוצר טעם ייחודי ומעניין.', pricePer100g: 9.2, imageUrl: '/assets/images/salads/Amba-lemon.jpg', tags: ['טבעוני', 'ללא גלוטן'] },
      { id: 'eggplant-tahmis', name: 'חצילים בתחמיץ', description: 'חצילים איכותיים בתחמיץ ביתי מתוק וחמוץ, מבושלים לאט עם תבלינים מיוחדים. שילוב מושלם בין הטעם העשיר למתיקות והחמיצות של התחמיץ.', pricePer100g: 9.8, imageUrl: '/assets/images/salads/Eggplant-in-pickle.jpg', tags: ['טבעוני', 'בריא'] },
      { id: 'peppers-pickle', name: 'פלפלים חריפים בתחמיץ', description: 'פלפלים חריפים טריים בתחמיץ ביתי מתוק וחמוץ, מבושלים לאט עם תבלינים. שילוב מושלם בין החריפות הטבעית למתיקות והחמיצות של התחמיץ.', pricePer100g: 9.8, imageUrl: '/assets/images/salads/Hot-peppers.jpg', tags: ['טבעוני', 'בריא', 'חריף'] },
      { id: 'hilbe', name: 'חילבה', description: 'חילבה מסורתית ביתית עשויה מזרעי חילבה איכותיים, מתובלת בתבלינים מיוחדים. מרקם חלק ועשיר עם טעם ייחודי שמביא את הטעמים האותנטיים של המטבח התימני.', pricePer100g: 9.0, imageUrl: '/assets/images/salads/fenugreek.jpg', tags: ['טבעוני', 'ללא גלוטן'] },
      { id: 'tabbouleh', name: 'טאבולה', description: 'טאבולה טרייה ומרעננת עשויה מפטרוזיליה טרייה, עגבניות מתוקות, נענע ולימון. שילוב מושלם של טעמים טריים ומרעננים שמביא אנרגיה וטעם ייחודי.', pricePer100g: 9.8, imageUrl: '/assets/images/salads/tabula.jpg', tags: ['טבעוני', 'בריא', 'ללא גלוטן'] },
      { id: 'hum-fried-sweet-potato', name: 'הום פרייד בטטה', description: 'בטטה טרייה מטוגנת בסגנון ביתי מעורבת עם חומוס קרמי. שילוב מושלם בין המתיקות הטבעית של הבטטה לטעם העשיר של החומוס.', pricePer100g: 9.5, imageUrl: '/assets/images/salads/Home-fries.jpg', tags: ['טבעוני', 'בריא'] },
      { id: 'coleslaw', name: 'קולסלאו', description: 'קולסלאו קלאסי טרי עשוי מכרוב לבן טרי וגזר, מתובל ברוטב מיוחד. מרקם פריך וטעם מרענן שמביא טעם קלאסי ומשביע.', pricePer100g: 7.5, imageUrl: '/assets/images/salads/Coleslaw.jpg', tags: ['טבעוני', 'בריא', 'ללא גלוטן'] },
      { id: 'carrot-moroccan', name: 'גזר מרוקאי', description: 'גזר טרי מתובל בסגנון מרוקאי אותנטי עם תבלינים מיוחדים. טעם עשיר ומתובל שמביא את הטעמים האותנטיים של המטבח המרוקאי.', pricePer100g: 8.5, imageUrl: '/assets/images/salads/Moroccan-carrots.jpg', tags: ['טבעוני', 'בריא', 'ללא גלוטן'] },
      { id: 'carrot-lemon', name: 'גזר בלימון', description: 'גזר טרי ופריך מתובל ברוטב לימון טרי וחמוץ. שילוב מושלם בין המתיקות הטבעית לחמיצות המרעננת, יוצר טעם קליל ומרענן.', pricePer100g: 8.5, imageUrl: '/assets/images/salads/Carrots-in-lemon.jpg', tags: ['טבעוני', 'בריא', 'ללא גלוטן'] },
      { id: 'carrot-lemon-pineapple', name: 'גזר בלימון ואננס', description: 'גזר טרי מעורבב עם לימון טרי ואננס מתוק וטרופי. שילוב ייחודי בין המתיקות הטבעית לחמיצות הלימון, יוצר טעם מרענן ומיוחד.', pricePer100g: 9.0, imageUrl: '/assets/images/salads/Pineapple-carrot.jpg', tags: ['טבעוני', 'בריא', 'ללא גלוטן'] },
      { id: 'waldorf', name: 'סלט וולדורף', description: 'סלט וולדורף קלאסי עשוי מתפוחים מתוקים, אגוזים קלויים וסלרי טרי. שילוב מושלם של טעמים מתוקים ופריכים עם מרקם עשיר.', pricePer100g: 10.5, imageUrl: '/assets/images/salads/Waldorf.jpg', tags: ['טבעוני', 'בריא'] },
      { id: 'cabbage-purple-asian', name: 'כרוב סגול בסגנון אסיאתי', description: 'כרוב סגול טרי מתובל בסגנון אסיאתי עם תבלינים מיוחדים ורוטב ייחודי. טעם עשיר ומעניין שמביא את הטעמים האותנטיים של המטבח האסיאתי.', pricePer100g: 8.8, imageUrl: '/assets/images/salads/Asian-cabbage.jpg', tags: ['טבעוני', 'בריא', 'ללא גלוטן'] },
      { id: 'cabbage-white-cranberry', name: 'כרוב לבן חמוציות', description: 'כרוב לבן טרי ופריך מעורבב עם חמוציות מתוקות ואיכותיות. שילוב מושלם בין הפריכות למתיקות החמוציות, יוצר טעם מרענן ומעניין.', pricePer100g: 9.0, imageUrl: '/assets/images/salads/Cranberry-cabbage.jpg', tags: ['טבעוני', 'בריא', 'ללא גלוטן'] },
      { id: 'egg-salad', name: 'סלט ביצים', description: 'סלט ביצים קלאסי ביתי עשוי מביצים טריות, מיונז קרמי ביתי ותבלינים. מרקם עשיר וטעם קלאסי שמביא את הטעמים המוכרים והאהובים.', pricePer100g: 9.5, imageUrl: '/assets/images/salads/Egg-salad.jpg', tags: ['צמחוני'] },
      { id: 'beet-eastern', name: 'סלק מזרחי', description: 'סלק טרי מתובל בסגנון מזרחי אותנטי עם תבלינים מיוחדים. טעם עשיר ומתובל שמביא את הטעמים האותנטיים של המטבח המזרחי.', pricePer100g: 9.2, imageUrl: '/assets/images/salads/beet-salad.jpg', tags: ['טבעוני', 'בריא', 'ללא גלוטן'] },
      { id: 'corn-salad', name: 'סלט תירס', description: 'סלט תירס טרי ופריך מעורבב עם ירקות טריים ורוטב מיוחד. שילוב מושלם של טעמים מתוקים וטעימים עם מרקם פריך.', pricePer100g: 8.0, imageUrl: '/assets/images/salads/Corn-salad.jpg', tags: ['טבעוני', 'בריא', 'ללא גלוטן'] },
      { id: 'pickles-magadim', name: 'חמוצי מגדים (טירשי)', description: 'חמוצים ביתיים מסורתיים עשויים מירקות טריים בתחמיץ מיוחד. טעם חמוץ ומרענן שמביא את הטעמים האותנטיים של המטבח המסורתי.', pricePer100g: 8.5, imageUrl: '/assets/images/salads/Pickles-in-brine.jpg', tags: ['טבעוני', 'ללא גלוטן'] },
      { id: 'eggplant-liver-taste', name: 'חציל בטעם כבד', description: 'חציל צלוי איכותי מתובל בתבלינים מיוחדים שיוצרים טעם עשיר ומעניין הדומה לכבד. שילוב מושלם בין הטעם העשיר של החציל לטעם המיוחד.', pricePer100g: 10.2, imageUrl: '/assets/images/salads/Heavy-eggplant.jpg', tags: ['טבעוני', 'בריא'] },
      { id: 'zucchini-liver-taste', name: 'קישוא בטעם כבד', description: 'קישוא טרי מתובל בתבלינים מיוחדים שיוצרים טעם עשיר ומעניין הדומה לכבד. שילוב מושלם בין הטעם העדין של הקישוא לטעם המיוחד.', pricePer100g: 10.2, imageUrl: '/assets/images/salads/Liver-flavored-zucchini.jpg', tags: ['טבעוני', 'בריא'] },
      { id: 'root-vegetables', name: 'סלט ירקות שורש', description: 'סלט ירקות שורש טריים ומתובלים עשוי ממגוון ירקות שורש איכותיים. שילוב מושלם של טעמים עשירים ומתובלים עם מרקם פריך.', pricePer100g: 9.5, imageUrl: '/assets/images/salads/root-vegetables.jpg', tags: ['טבעוני', 'בריא', 'ללא גלוטן'] },
      { id: 'chopped-liver', name: 'כבד קצוץ', description: 'כבד קצוץ מסורתי ביתי עשוי מכבד איכותי, בצל מטוגן ותבלינים מיוחדים. מרקם עשיר וטעם קלאסי שמביא את הטעמים המוכרים והאהובים.', pricePer100g: 12.0, imageUrl: '/assets/images/salads/Chopped-liver.jpg', tags: ['בשרי'] },
      { id: 'herring-white', name: 'הרינג לבן', description: 'הרינג לבן מסורתי איכותי עשוי מדג הרינג טרי, מתובל בתבלינים מיוחדים. טעם עשיר ומעניין שמביא את הטעמים האותנטיים של המטבח המסורתי.', pricePer100g: 11.5, imageUrl: '/assets/images/salads/Herring-white.jpg', tags: ['דגים'] },
      { id: 'herring-red', name: 'הרינג אדום', description: 'הרינג אדום איכותי עשוי מדג הרינג טרי מעורבב עם עגבניות מתוקות ותבלינים מיוחדים. שילוב מושלם בין הטעם העשיר של הדג למתיקות העגבניות.', pricePer100g: 11.5, imageUrl: '/assets/images/salads/red-herring.jpg', tags: ['דגים'] },
      { id: 'herring-herbs', name: 'הרינג בעשבי תיבול', description: 'הרינג איכותי מתובל בעשבי תיבול טריים. שילוב מושלם בין הטעם העשיר של הדג לטעמים המרעננים של עשבי התיבול.', pricePer100g: 11.8, imageUrl: '/assets/images/salads/Herring-with-herbs.jpg', tags: ['דגים'] },
      { id: 'herring-spicy', name: 'הרינג חריף', description: 'הרינג איכותי מתובל בתבלינים חריפים ומיוחדים. טעם עשיר וחריף שמביא חום וטעם ייחודי, מושלם לחובבי החריפות והטעמים החזקים.', pricePer100g: 11.8, imageUrl: '/assets/images/salads/Spicy-herring.jpg', tags: ['דגים', 'חריף'] },
      { id: 'herring-mustard-mayo', name: 'הרינג בחרדל ומיונז', description: 'הרינג איכותי מעורבב עם חרדל איכותי ומיונז קרמי ביתי. שילוב מושלם בין הטעם העשיר של הדג לחריפות החרדל ולקרמיות המיונז.', pricePer100g: 11.8, imageUrl: '/assets/images/salads/Herring-mustard.jpg', tags: ['דגים'] },
      { id: 'herring-piquant', name: 'הרינג פיקנטי', description: 'הרינג איכותי מתובל בתבלינים חריפים ופיקנטיים מיוחדים. טעם עשיר וחריף שמביא חום וטעם ייחודי, מושלם לחובבי החריפות והטעמים החזקים.', pricePer100g: 11.8, imageUrl: '/assets/images/salads/Spicy-herring1.jpg', tags: ['דגים', 'חריף'] }
    ];
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

  loadRecommendedSalads(): void {
    const allSalads = this.getAllFeaturedSalads();
    const currentSaladId = this.salad?.id;
    
    // Filter out current salad and get 10 random salads
    const filteredSalads = allSalads
      .filter(s => s.id !== currentSaladId)
      .map(s => ({
        id: s.id,
        name: s.name,
        description: s.description,
        imageUrl: s.imageUrl
      }));
    
    // Shuffle and take first 10
    const shuffled = filteredSalads.sort(() => 0.5 - Math.random());
    this.recommendedSalads = shuffled.slice(0, 10);
  }

  scrollSlider(direction: number): void {
    if (!this.sliderTrack) return;
    
    const track = this.sliderTrack.nativeElement;
    const scrollAmount = 300; // pixels to scroll
    const currentScroll = track.scrollLeft;
    const newScroll = currentScroll + (scrollAmount * direction);
    
    track.scrollTo({
      left: newScroll,
      behavior: 'smooth'
    });
  }

  navigateToSalad(saladId: string): void {
    this.router.navigate(['/ready-for-shabbat/salads', saladId]).then(() => {
      // Scroll to top of the page after navigation
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
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

