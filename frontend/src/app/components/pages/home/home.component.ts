import { Component, OnInit, inject, ViewChild, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';

import { LanguageService } from '../../../services/language.service';
import { CartService } from '../../../services/cart.service';
import { MenuService } from '../../../services/menu.service';
import { TestimonialsService } from '../../../services/testimonials.service';
import { FeaturedMenuComponent } from '../../featured-menu/featured-menu.component';
import { AboutComponent } from '../../about/about.component';
import { TestimonialsComponent } from '../../testimonials/testimonials.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule, MatButtonModule, FeaturedMenuComponent, AboutComponent, TestimonialsComponent],
  template: `
    <div class="home-page">
      <!-- Hero Section -->
      <section class="hero-section">
        <div class="hero-bg-image" style="background-image: url('/assets/images/Fish-category.jpg');"></div>
        
        <div class="content-container">
          <h1 class="main-title">חווית האוכל המוכן<br>הגדולה בישראל</h1>
          
          <div class="action-btn-wrapper">
            <button mat-stroked-button class="gold-btn" routerLink="/menu">למבחר הגדול בישראל לחצו >></button>
          </div>
        </div>
        
        <div class="hero-cards-grid">
          <div class="hero-card" style="background-image: url('/assets/images/Fish-category.jpg');">
            <div class="card-content">
              <h3>קייטרינג לאירועים</h3>
              <button mat-stroked-button routerLink="/events">קבלת תפריט</button>
            </div>
          </div>
          <div class="hero-card" style="background-image: url('/assets/images/Fish-category.jpg');">
            <div class="card-content">
              <h3>קייטרינג לשבת וחג</h3>
              <button mat-stroked-button routerLink="/menu">הצג מנות לשבת</button>
            </div>
          </div>
          <div class="hero-card" style="background-image: url('/assets/images/Fish-category.jpg');">
            <div class="card-content">
              <h3>אוכל מוכן לשבת</h3>
              <button mat-stroked-button routerLink="/shabbat">תפריט מוכן לשבת</button>
            </div>
          </div>
        </div>
      </section>
      
      <!-- Featured Menu Section -->
      <app-featured-menu></app-featured-menu>
      
      <!-- About Us Section -->
      <app-about></app-about>
      
      <!-- Testimonials Section -->
      <app-testimonials></app-testimonials>
    </div>
  `,
  styles: [`
    .home-page {
      min-height: 100vh;
    }
    
    /* Hero Section */
    $gold: #C3985D;
    $navy: #0D2F46;
    $white: #FFFFFF;
    
    .hero-section {
      position: relative;
      min-height: 600px; // Increased slightly
      padding-top: 100px;
      text-align: center;
      color: $white;
      direction: rtl;
      
      overflow: visible;
      margin-bottom: 250px; // Increased margin for taller cards
      
      .hero-bg-image {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-size: cover;
        background-position: center;
        z-index: 0;
        
        // The Overlay
        &::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.45); // Darken image by 45%
          z-index: 1;
        }
      }
      
      .content-container {
        position: relative;
        z-index: 2;
        max-width: 1200px;
        margin: 0 auto;
        padding: 0 20px;
      }
      
      .main-title {
        font-size: 3.5rem;
        font-weight: 800;
        text-shadow: 0 4px 15px rgba(0,0,0,0.6);
        margin-bottom: 30px;
        line-height: 1.1;
      }
      
      .gold-btn {
        color: $gold;
        border: 2px solid $gold;
        background: rgba(0,0,0,0.5);
        font-size: 1.2rem;
        padding: 8px 30px;
        transition: all 0.3s;
        
        &:hover {
          background: $gold;
          color: $navy;
        }
      }
      
      // --- Floating Cards Grid ---
      .hero-cards-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 30px;
        position: absolute;
        bottom: -225px;
        left: 0;
        right: 0;
        margin: 0 auto;
        max-width: 1200px;
        padding: 0 20px;
        z-index: 20;
        
        .hero-card {
          position: relative;
          height: 480px;
          border-radius: 0;
          overflow: hidden; // Ensures gradient doesn't spill out
          background-size: cover;
          background-position: center;
          
          display: flex;
          align-items: flex-end; // Push content to bottom
          justify-content: center;
          
          box-shadow: 0 20px 40px rgba(0,0,0,0.3);
          transition: transform 0.4s ease;
          
          // --- THE FIX: Gradient Layer ---
          &::after {
            content: '';
            position: absolute;
            bottom: 0;
            left: 0;
            width: 100%;
            height: 60%; // Covers bottom 60% of card
            background: linear-gradient(to top, 
              rgba($navy, 1) 0%,    // Solid Navy at very bottom
              rgba($navy, 0.7) 40%, 
              transparent 100%
            );
            z-index: 1; // Sit above image, below text
          }
          
          &:hover {
            transform: translateY(-10px);
          }
          
          .card-content {
            position: relative;
            z-index: 2; // Text must be above the gradient layer
            width: 100%;
            text-align: center;
            
            // Removed background from here!
            background: transparent;
            
            // Spacing controls
            padding-bottom: 40px;
            
            h3 {
              color: $white;
              font-size: 1.8rem;
              font-weight: 800;
              margin-bottom: 20px;
              text-shadow: 0 2px 10px rgba(0,0,0,0.5);
            }
            
            button {
              color: $white;
              background: rgba(255,255,255,0.1);
              border: 1px solid $white;
              border-radius: 50px;
              padding: 10px 35px;
              font-size: 1.1rem;
              font-weight: 500;
              backdrop-filter: blur(4px);
              transition: all 0.3s;
              
              &:hover {
                background: $white;
                color: #000; // Black text on hover
              }
            }
          }
        }
      }
      
      // Mobile Responsive
      @media (max-width: 900px) {
        margin-bottom: 50px;
        padding-bottom: 50px;
        
        .hero-cards-grid {
          position: relative;
          bottom: auto;
          grid-template-columns: 1fr;
          margin-top: 60px;
        }
        
        .hero-card {
          height: 400px; // Slightly shorter on mobile but still tall
        }
      }
    }
  `]
})
export class HomeComponent implements OnInit, AfterViewInit, OnDestroy {
  languageService = inject(LanguageService);
  cartService = inject(CartService);
  menuService = inject(MenuService);
  testimonialsService = inject(TestimonialsService);
  router = inject(Router);

  @ViewChild('carouselTrack') carouselTrack!: ElementRef;
  
  private intersectionObserver?: IntersectionObserver;

  // Component state
  highlightedMenuItems: any[] = [];
  testimonials: any[] = [];
  currentCarouselIndex = 0;
  maxCarouselIndex = 0;
  menuCategories: any[] = [];

  ngOnInit(): void {
    // Component initialization
  }

  ngAfterViewInit(): void {
    // Component after view init
  }

  ngOnDestroy(): void {
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
    }
  }

  trackByCategoryId(index: number, category: any): any {
    return category?._id || index;
  }

  trackByItemId(index: number, item: any): any {
    return item?._id || index;
  }

  navigateToCategory(category: any): void {
    // Navigation logic
  }

  scrollCarousel(direction: 'left' | 'right'): void {
    // Carousel scroll logic
  }

  addToCart(item: any): void {
    // Add to cart logic
  }

  getPrice(item: any): number {
    return item?.price || 0;
  }

  handleImageError(event: any): void {
    if (event && event.target) {
      event.target.src = '/assets/images/placeholder-dish.jpg';
    }
  }
}
