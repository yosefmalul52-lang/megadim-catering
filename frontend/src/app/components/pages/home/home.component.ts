import { Component, OnInit, inject, ViewChild, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { LanguageService } from '../../../services/language.service';
import { CartService } from '../../../services/cart.service';
import { MenuService } from '../../../services/menu.service';
import { TestimonialsService } from '../../../services/testimonials.service';
import { FeaturedMenuComponent } from '../../featured-menu/featured-menu.component';
import { AboutComponent } from '../../about/about.component';
import { VideoSectionComponent } from '../../video-section/video-section.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule, MatButtonModule, MatIconModule, FeaturedMenuComponent, AboutComponent, VideoSectionComponent],
  template: `
    <div class="home-page">
      <!-- Hero Section -->
      <section class="hero-section">
        <div class="hero-bg-image"></div>
        
        <div class="content-container">
          <h1 class="main-title">קייטרינג ברמה אחרת</h1>
          
          <div class="action-btn-wrapper">
            <button mat-stroked-button class="gold-btn" routerLink="/ready-for-shabbat">לתפריט המלא לחצו >></button>
          </div>
        </div>
        
        <div class="category-cards-container">
          <div class="category-card" routerLink="/catering">
            <div class="card-image" style="background-image: url('assets/images/Fish-category.jpg');">
              <div class="card-overlay">
                <h3 class="gold-text">קייטרינג לאירועים</h3>
              </div>
            </div>
          </div>
          <div class="category-card" routerLink="/shabbat-events">
            <div class="card-image" style="background-image: url('assets/images/Fish-category.jpg');">
              <div class="card-overlay">
                <h3 class="gold-text">קייטרינג לאירועי שבת וחג</h3>
              </div>
            </div>
          </div>
          <div class="category-card" routerLink="/ready-for-shabbat">
            <div class="card-image" style="background-image: url('assets/images/Fish-category.jpg');">
              <div class="card-overlay">
                <h3 class="gold-text">אוכל מוכן לשבת וחג</h3>
              </div>
            </div>
          </div>
        </div>
      </section>
      
      <!-- Featured Menu Section -->
      <app-featured-menu></app-featured-menu>
      
      <!-- About Us Section -->
      <app-about></app-about>
      
      <!-- Video Section -->
      <app-video-section></app-video-section>
      
      <!-- Testimonials Section -->
      <section class="testimonials-section-premium">
        <div class="container">
          <div class="elegant-title-light">
            <span class="line right-line-light"></span>
            <h2 class="section-title">לקוחות מספרים על מגדים</h2>
            <span class="line left-line-light"></span>
          </div>
          
          <div class="testimonials-grid">
            <div class="testimonial-card">
              <div class="decorative-quote">"</div>
              <div class="card-content">
                <div class="stars">
                  <mat-icon>star</mat-icon><mat-icon>star</mat-icon><mat-icon>star</mat-icon><mat-icon>star</mat-icon><mat-icon>star</mat-icon>
                </div>
                <p class="review-text">
                  הזמנו קייטרינג לשבת חתן, האוכל הגיע חם, ארוז בצורה אסתטית והכי חשוב - הטעם היה פשוט ביתי ומושלם! כולם שיבחו את המנות. תודה רבה על השירות המעולה.
                </p>
                <div class="reviewer-info">
                  <span class="name">משפחת כהן</span>
                  <span class="location">ירושלים</span>
                </div>
              </div>
            </div>
            
            <div class="testimonial-card">
              <div class="decorative-quote">"</div>
              <div class="card-content">
                <div class="stars">
                  <mat-icon>star</mat-icon><mat-icon>star</mat-icon><mat-icon>star</mat-icon><mat-icon>star</mat-icon><mat-icon>star</mat-icon>
                </div>
                <p class="review-text">
                  אין על האוכל של מגדים! אנחנו קונים קבוע לשבתות, הצ'ולנט שלהם הוא הכי טעים שאכלתי. נקי, טרי ותמיד בשפע. ממליץ בחום לכל מי שמחפש איכות.
                </p>
                <div class="reviewer-info">
                  <span class="name">דוד לוי</span>
                  <span class="location">בני ברק</span>
                </div>
              </div>
            </div>
            
            <div class="testimonial-card">
              <div class="decorative-quote">"</div>
              <div class="card-content">
                <div class="stars">
                  <mat-icon>star</mat-icon><mat-icon>star</mat-icon><mat-icon>star</mat-icon><mat-icon>star</mat-icon><mat-icon>star</mat-icon>
                </div>
                <p class="review-text">
                  השירות שלכם פשוט מעל ומעבר. הזמנתי ברגע האחרון וקיבלתי מענה מהיר ואדיב. האוכל היה טעים ברמות, האורחים לא הפסיקו ללקק את האצבעות.
                </p>
                <div class="reviewer-info">
                  <span class="name">רחלי א.</span>
                  <span class="location">פתח תקווה</span>
                </div>
              </div>
            </div>
            
            <div class="testimonial-card">
              <div class="decorative-quote">"</div>
              <div class="card-content">
                <div class="stars">
                  <mat-icon>star</mat-icon><mat-icon>star</mat-icon><mat-icon>star</mat-icon><mat-icon>star</mat-icon><mat-icon>star</mat-icon>
                </div>
                <p class="review-text">
                  הזמנו קייטרינג לברית, הכל הגיע בזמן, חם וטעים. האורחים לא הפסיקו לשבח. תודה לכם!
                </p>
                <div class="reviewer-info">
                  <span class="name">אבי ו.</span>
                  <span class="location">מודיעין</span>
                </div>
              </div>
            </div>
            
            <div class="testimonial-card">
              <div class="decorative-quote">"</div>
              <div class="card-content">
                <div class="stars">
                  <mat-icon>star</mat-icon><mat-icon>star</mat-icon><mat-icon>star</mat-icon><mat-icon>star</mat-icon><mat-icon>star</mat-icon>
                </div>
                <p class="review-text">
                  אוכל ביתי ברמה גבוהה מאוד. התיבול מדויק, המנות נדיבות והשירות עם חיוך. בהחלט נזמין שוב.
                </p>
                <div class="reviewer-info">
                  <span class="name">מירב ג.</span>
                  <span class="location">גבעת שמואל</span>
                </div>
              </div>
            </div>
            
            <div class="testimonial-card">
              <div class="decorative-quote">"</div>
              <div class="card-content">
                <div class="stars">
                  <mat-icon>star</mat-icon><mat-icon>star</mat-icon><mat-icon>star</mat-icon><mat-icon>star</mat-icon><mat-icon>star</mat-icon>
                </div>
                <p class="review-text">
                  פתרון מושלם לשבת. במקום לעמוד במטבח כל היום, קונים ממגדים ונהנים מאוכל של אמא.
                </p>
                <div class="reviewer-info">
                  <span class="name">רוני ס.</span>
                  <span class="location">רמת גן</span>
                </div>
              </div>
            </div>
          </div>
          
          <div class="google-reviews-container">
            <a href="https://www.google.com/search?q=%D7%9E%D7%92%D7%93%D7%99%D7%9D+%D7%A7%D7%99%D7%99%D7%98%D7%A8%D7%99%D7%A0%D7%92&oq=&gs_lcrp=EgZjaHJvbWUqCQgFECMYJxjqAjIJCAAQIxgnGOoCMgkIARAjGCcY6gIyCQgCEC4YJxjqAjIJCAMQIxgnGOoCMgkIBBAjGCcY6gIyCQgFECMYJxjqAjIJCAYQIxgnGOoCMgkIBxAjGCcY6gLSAQkyNjM5ajBqMTWoAgiwAgHxBQPQ0bxGGjtT8QUD0NG8Rho7Uw&sourceid=chrome&ie=UTF-8#lrd=0x151cd528213f4e4b:0xf8f0c7289db20d8f,1,,,," target="_blank" class="google-btn">
              <img src="assets/images/google-icon.png" alt="G" class="google-icon" onerror="this.style.display='none'">
              <mat-icon>reviews</mat-icon>
              לקריאת כל ההמלצות בגוגל
            </a>
          </div>
        </div>
      </section>
    </div>
  `,
  styles: [`
    .home-page {
      min-height: 100vh;
    }
    
    /* Hero Section */
    $gold: #E0C075;
    $navy: #1f3540;
    $white: #FFFFFF;
    
    .hero-section {
      position: relative;
      height: 80vh;
      min-height: 600px; // Fallback for older browsers
      padding-top: 0 !important;
      margin-top: 0 !important;
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
        height: 80vh;
        background-image: url('https://res.cloudinary.com/dioklg7lx/image/upload/q_auto,f_auto/v1768222488/hero1_ime6hz.png') !important;
        background-size: cover !important;
        background-position: center !important;
        z-index: 0;
        
        // The Overlay - Dark overlay for text readability
        &::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.5); // Dark overlay for better text readability
          z-index: 1;
        }
      }
      
      .content-container {
        position: relative;
        z-index: 2;
        max-width: 1200px;
        margin: 0 auto;
        padding: 100px 20px 0 20px; // Keep top padding for content positioning, but ensure no gap above hero
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
      
      // --- Category Cards Container ---
      .category-cards-container {
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
        
        .category-card {
          position: relative;
          height: 480px;
          border-radius: 0;
          overflow: hidden;
          cursor: pointer; // Make entire card clickable
          
          // Gold border
          border: 2px solid #e0c075;
          box-sizing: border-box; // Ensure border doesn't affect layout
          
          box-shadow: 0 20px 40px rgba(0,0,0,0.3);
          transition: transform 0.4s ease;
          
          &:hover {
            transform: translateY(-10px);
          }
          
          .card-image {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-size: cover;
            background-position: center;
            
            // Dark overlay for text readability
            &::after {
              content: '';
              position: absolute;
              bottom: 0;
              left: 0;
              width: 100%;
              height: 60%;
              background: linear-gradient(to top, 
                rgba($navy, 1) 0%,
                rgba($navy, 0.7) 40%, 
                transparent 100%
              );
              z-index: 1;
            }
          }
          
          .card-overlay {
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            z-index: 2;
            padding: 40px 20px;
            text-align: center;
            
            .gold-text {
              color: $white;
              font-size: 1.8rem;
              font-weight: bold;
              margin: 0;
              text-shadow: 0 2px 10px rgba(0,0,0,0.8);
            }
          }
        }
      }
      
      // Mobile Responsive
      @media (max-width: 900px) {
        margin-bottom: 50px;
        padding-bottom: 50px;
        
        .category-cards-container {
          position: relative;
          bottom: auto;
          grid-template-columns: 1fr;
          margin-top: 60px;
        }
        
        .category-card {
          height: 400px; // Slightly shorter on mobile but still tall
        }
      }
    }
    
    /* Testimonials Section Premium */
    .testimonials-section-premium {
      background-color: #ffffff; // Requirement: Solid White
      padding: 80px 20px 100px;
      position: relative;
      direction: rtl;
      
      .container {
        max-width: 1200px;
        margin: 0 auto;
      }
      
      // --- Elegant Title (Light Version) ---
      .elegant-title-light {
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 60px;
        overflow: hidden; // Prevent horizontal scrollbar
        
        .section-title {
          margin: 0 30px;
          color: #1f3540; // Navy title on white bg
          font-size: 3rem;
          font-weight: 700;
          text-align: center;
          white-space: nowrap;
        }
        
        .line {
          flex-grow: 1;
          height: 2px;
          border-radius: 2px;
        }
        
        // Fading Gold to Transparent (works nicely on white)
        .right-line-light {
          background: linear-gradient(to left, transparent, #e0c075);
        }
        
        .left-line-light {
          background: linear-gradient(to right, transparent, #e0c075);
        }
      }
      
      // --- The Grid ---
      .testimonials-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); // Responsive grid
        gap: 30px;
      }
      
      // --- Premium Card Design ---
      .testimonial-card {
        background-color: #ffffff;
        border-radius: 16px;
        padding: 40px 30px;
        position: relative;
        overflow: hidden;
        // Soft shadow for floating effect on white bg
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.05);
        border: 1px solid rgba(224, 192, 117, 0.1); // Very subtle gold border
        transition: transform 0.3s ease, box-shadow 0.3s ease;
        
        &:hover {
          transform: translateY(-5px); // Slight lift on hover
          box-shadow: 0 15px 40px rgba(0, 0, 0, 0.1);
        }
        
        // Giant decorative quote mark in background
        .decorative-quote {
          position: absolute;
          top: -20px;
          right: 20px;
          font-size: 150px;
          line-height: 1;
          color: rgba(224, 192, 117, 0.08); // Very faint gold
          font-family: serif;
          pointer-events: none; // Don't interfere with text
          z-index: 0;
        }
        
        .card-content {
          position: relative;
          z-index: 1; // Ensure text is above the quote mark
          text-align: center;
          
          .stars {
            color: #e0c075; // Gold stars
            margin-bottom: 20px;
            display: flex;
            justify-content: center;
            gap: 2px;
            
            mat-icon {
              font-size: 24px;
              width: 24px;
              height: 24px;
            }
          }
          
          .review-text {
            font-size: 1.1rem;
            line-height: 1.6;
            color: #4a4a4a; // Dark gray for readability
            margin-bottom: 25px;
            font-style: italic;
          }
          
          .reviewer-info {
            .name {
              display: block;
              font-weight: 700;
              color: #1f3540; // Navy
              font-size: 1.2rem;
            }
            
            .location {
              display: block;
              font-size: 0.9rem;
              color: #888;
              margin-top: 5px;
            }
          }
        }
      }
      
      // Responsive
      @media (max-width: 768px) {
        padding: 60px 20px 80px;
        
        .elegant-title-light {
          .section-title {
            font-size: 2.2rem;
            margin: 0 15px;
          }
          
          .line {
            height: 1.5px;
          }
        }
        
        .testimonials-grid {
          grid-template-columns: 1fr; // Single column on mobile
          gap: 20px;
        }
        
        .testimonial-card {
          padding: 30px 20px;
          
          .decorative-quote {
            font-size: 120px;
            top: -15px;
            right: 15px;
          }
        }
      }
      
      // --- Google Reviews Button ---
      .google-reviews-container {
        display: flex;
        justify-content: center;
        margin-top: 60px;
        
        .google-btn {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          text-decoration: none;
          background-color: #ffffff;
          border: 2px solid #e0c075;
          color: #1f3540;
          font-weight: 700;
          font-size: 1.1rem;
          padding: 12px 35px;
          border-radius: 50px;
          transition: all 0.3s ease;
          box-shadow: 0 5px 15px rgba(0,0,0,0.05);
          
          .google-icon {
            width: 24px;
            height: 24px;
          }
          
          mat-icon {
            color: #e0c075;
            font-size: 24px;
            width: 24px;
            height: 24px;
          }
          
          &:hover {
            background-color: #e0c075;
            color: #ffffff;
            transform: translateY(-3px);
            box-shadow: 0 10px 20px rgba(224, 192, 117, 0.3);
            
            mat-icon {
              color: #ffffff;
            }
          }
        }
      }
      
      // Responsive for Google Button
      @media (max-width: 768px) {
        .google-reviews-container {
          margin-top: 40px;
          
          .google-btn {
            font-size: 1rem;
            padding: 10px 25px;
          }
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
