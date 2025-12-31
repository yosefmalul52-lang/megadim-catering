import { Component, OnInit, inject, ViewChild, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { ReactiveFormsModule } from '@angular/forms';

import { LanguageService } from '../../../services/language.service';
import { CartService } from '../../../services/cart.service';
import { MenuService } from '../../../services/menu.service';
import { TestimonialsService } from '../../../services/testimonials.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule],
  template: `
    <div class="home-page">
      <!-- Hero Section -->
      <section class="hero-section smooth-section">
        <div class="hero-background-carousel">
          <div 
            *ngFor="let image of backgroundImages; let i = index" 
            class="hero-background-image"
            [class.active]="i === currentBackgroundIndex"
            [style.background-image]="'url(' + getResponsiveImageUrl(image) + ')'"
          ></div>
        </div>
        <div class="hero-overlay"></div>
        <div class="hero-content">
          <h1 class="hero-title">{{ languageService.strings.heroTitle }}</h1>
          <p class="hero-subtitle">{{ languageService.strings.heroSubtitle }}</p>
          <p class="hero-tagline">אוכל ביתי לשבתות, קייטרינג לאירועים – והכול בטעם של <span class="megadim-text">מגדים</span></p>
          <p class="hero-kashrut">- כשר למהדרין -</p>
          <button 
            type="button" 
            (click)="scrollToContact()" 
            class="btn btn-primary hero-cta"
            [attr.aria-label]="'גלול לטופס צור קשר'"
          >
            קבלו תפריט לאירוע שלכם
          </button>
        </div>
      </section>

      <!-- Services Section -->
      <section class="services-section smooth-section">
        <div class="container">
          <div class="services-grid">
            <!-- Service Block 1: Events Catering -->
            <div class="service-item">
              <div class="service-card events-catering-block">
                <div class="events-catering-background"></div>
                <div class="service-background-overlay"></div>
              </div>
              <div class="service-content-wrapper">
                <div class="service-title-wrapper">
                  <h3 class="service-title">{{ languageService.strings.eventsCateringTitle }}</h3>
                </div>
                <button routerLink="/events-catering" class="btn btn-secondary">
                  {{ languageService.strings.eventsCateringButton }}
                </button>
              </div>
            </div>

            <!-- Service Block 2: Shabbat Catering -->
            <div class="service-item">
              <div class="service-card shabbat-catering-block">
                <div class="shabbat-catering-background"></div>
                <div class="service-background-overlay"></div>
              </div>
              <div class="service-content-wrapper">
                <div class="service-title-wrapper">
                  <h3 class="service-title">{{ languageService.strings.shabbatCateringTitle }}</h3>
                </div>
                <button routerLink="/ready-for-shabbat" class="btn btn-secondary">
                  {{ languageService.strings.shabbatCateringButton }}
                </button>
              </div>
            </div>

            <!-- Service Block 3: Ready Food -->
            <div class="service-item">
              <div class="service-card ready-food-block">
                <div class="ready-food-background"></div>
                <div class="service-background-overlay"></div>
              </div>
              <div class="service-content-wrapper">
                <div class="service-title-wrapper">
                  <h3 class="service-title">{{ languageService.strings.readyFoodTitle }}</h3>
                </div>
                <button routerLink="/ready-for-shabbat" class="btn btn-secondary">
                  {{ languageService.strings.readyFoodButton }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Why Choose Us Section -->
      <section class="why-choose-us-section smooth-section">
        <div class="container">
          <div class="why-choose-us-grid">
            <div class="why-item">
              <div class="why-icon">📜</div>
              <h3>כשרות מהודרת ומפוקחת</h3>
              <p>כל שלבי ההכנה מתבצעים תחת השגחה צמודה ובכשרות מהודרת. אנחנו שומרים על רמת הקפדה גבוהה כדי שתוכלו לסעוד בלב שקט ובשמחה.</p>
            </div>
            <div class="why-item">
              <div class="why-icon">👨‍🍳</div>
              <h3>טרי – באותו היום</h3>
              <p>כל מנה מוכנה באהבה ביום ההגשה בלבד, מחומרי גלם טריים ואיכותיים. אנחנו מאמינים שאוכל טוב מתחיל בטריות אמיתית ובנשמה.</p>
            </div>
            <div class="why-item">
              <div class="why-icon">🍲</div>
              <h3>מגוון עשיר של מנות ביתיות</h3>
              <p>מבחר גדול של סלטים, תוספות ובשרים – בטעמים של בית, בעיצוב מוקפד. כל אחד מוצא את הטעם המוכר שהוא אוהב, עם ניחוח של שבת ושל חג.</p>
            </div>
          </div>
          
          <div class="why-extended-text">
            <p class="intro-text">את קייטרינג מגדים הקמנו מתוך אהבה לאוכל, לטעמים, לניחוחות שמעלים זכרונות.</p>
            <p class="intro-text">אצלנו תוכלו ליהנות משפע של אוכל ומטעמים, עשויים מחומרי גלם ומוצרים טריים, בכשרות מהדרין של רבנות מטה בנימין.</p>
            <p class="intro-text">המטבח שלנו פועל תחת סטנדרטים מחמירים של משרד הבריאות, עם רישיון יצרן מס' 100694, כדי להבטיח את בטיחות המזון והאיכות הגבוהה ביותר.</p>
            <p class="intro-text">אנו מתמחים בהכנת מנות ביתיות אותנטיות, המשולבות עם טכניקות בישול מודרניות, כדי להביא לכם חוויה קולינרית ייחודית שתשאיר טעם של עוד.</p>
            <p class="intro-text">השירות שלנו כולל ליווי אישי לכל אירוע, תכנון תפריט מותאם לצרכים שלכם, והגשה מקצועית שתהפוך את האירוע שלכם לחוויה בלתי נשכחת.</p>
          </div>
          <div class="certification-badge">
            <span class="badge-icon">✓</span>
            <span>כשרות מהודרת – רבנות מטה בנימין</span>
          </div>
        </div>
      </section>

      <!-- Menu Carousel Section -->
      <section class="menu-carousel-section smooth-section">
        <div class="container">
          <h2 class="section-title">טעימות מהתפריט</h2>
          
          <!-- Categories Section -->
          <div class="categories-section">
            <div class="categories-container">
              <div class="categories-grid">
                <div 
                  *ngFor="let category of menuCategories; trackBy: trackByCategoryId" 
                  class="category-item"
                  (click)="navigateToCategory(category)"
                >
                  <div class="category-circle">
                    <img 
                      [src]="category.imageUrl || '/assets/images/placeholder-dish.jpg'" 
                      [alt]="category.name"
                      loading="lazy"
                      (error)="handleImageError($event)"
                    >
                  </div>
                  <h3 class="category-name">{{ category.name }}</h3>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Show carousel only if there are items -->
          <div *ngIf="highlightedMenuItems.length > 0" class="carousel-container">
            <button 
              class="carousel-arrow carousel-arrow-left" 
              (click)="scrollCarousel('left')"
              [disabled]="currentCarouselIndex === 0"
              aria-label="גלול שמאלה"
            >
              <i class="fas fa-chevron-left" aria-hidden="true"></i>
            </button>
            
            <div class="carousel-track" #carouselTrack>
              <div 
                *ngFor="let item of highlightedMenuItems; trackBy: trackByItemId" 
                class="carousel-card"
                [class.is-unavailable]="item.isAvailable === false"
              >
                <div class="card-image">
                  <img 
                    [src]="item.imageUrl || '/assets/images/placeholder-dish.jpg'" 
                    [alt]="item.name" 
                    loading="lazy"
                    (error)="handleImageError($event)"
                  >
                  <!-- Popular Badge -->
                  <span class="badge badge-popular" *ngIf="item.isPopular === true">מומלץ</span>
                  <!-- Out of Stock Badge -->
                  <span class="badge badge-out-of-stock" *ngIf="item.isAvailable === false">לא קיים זמנית</span>
                </div>
                <div class="card-content">
                  <h3 class="card-title">{{ item.name }}</h3>
                  <p class="card-description">{{ item.description || 'מנה טעימה מהתפריט שלנו' }}</p>
                  <div class="card-footer">
                    <span class="card-price">₪{{ getPrice(item) }}</span>
                    <button 
                      (click)="addToCart(item)" 
                      class="btn btn-primary btn-sm"
                      [attr.aria-label]="'הוסף ' + item.name + ' לעגלה'"
                    >
                      {{ languageService.strings.addToCart || 'הוסף לעגלה' }}
                    </button>
                  </div>
                </div>
              </div>
            </div>
            
            <button 
              class="carousel-arrow carousel-arrow-right" 
              (click)="scrollCarousel('right')"
              [disabled]="currentCarouselIndex >= maxCarouselIndex"
              aria-label="גלול ימינה"
            >
              <i class="fas fa-chevron-right" aria-hidden="true"></i>
            </button>
          </div>
          
          <!-- Empty state if no items -->
          <div *ngIf="highlightedMenuItems.length === 0" class="menu-empty-state">
            <p>טוען מנות מהתפריט...</p>
          </div>
        </div>
      </section>

      <!-- Testimonials Section -->
      <section class="testimonials-section smooth-section">
        <div class="section-divider"></div>
        <div class="testimonials-background-decoration"></div>
        <div class="container">
          <div class="testimonials-header">
            <div class="testimonials-title-wrapper">
              <h2 class="section-title">מה אומרים עלינו</h2>
              <div class="title-underline"></div>
            </div>
            <p class="testimonials-subtitle">המלצות מלקוחות מרוצים שזכו לחוויה קולינרית בלתי נשכחת</p>
          </div>
          <div class="testimonials-grid">
            <div 
              *ngFor="let testimonial of testimonials; let i = index" 
              class="testimonial-card fade-in-card"
              [style.animation-delay]="(i * 0.15) + 's'"
            >
              <div class="testimonial-card-inner">
                <div class="card-accent-line"></div>
                <div class="quote-icon-top">
                  <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                    <path d="M10 20C10 15 12 10 18 10C22 10 24 12 24 16C24 20 22 22 18 22C16 22 14 21 14 19C14 17 15 16 17 16C18.5 16 19.5 16.5 19.5 18C19.5 19.5 18.5 20.5 17 20.5C13.5 20.5 11 18 11 14C11 9 14 5 20 5C26 5 30 9 30 15C30 21 26 25 20 25C18 25 16 24.5 14.5 23.5L10 20Z" fill="url(#quoteGradient)"/>
                    <defs>
                      <linearGradient id="quoteGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" style="stop-color:#d4a574;stop-opacity:1" />
                        <stop offset="100%" style="stop-color:#c97d60;stop-opacity:1" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
                <div class="stars-rating">
                  <div class="star-wrapper" *ngFor="let star of [1,2,3,4,5]">
                    <i class="fas fa-star" aria-hidden="true"></i>
                  </div>
                </div>
                <div class="testimonial-content">
                  <p class="testimonial-quote">{{ testimonial.content }}</p>
                </div>
                <div class="testimonial-author">
                  <div class="author-avatar">
                    <span>{{ testimonial.authorName.charAt(0) }}</span>
                  </div>
                  <div class="author-info">
                    <span class="author-name">{{ testimonial.authorName }}</span>
                    <span class="author-event">{{ testimonial.eventType }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

    </div>
  `,
  styles: [`
    .home-page {
      min-height: 100vh;
    }
    
    /* Global Styles */
    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 2rem;
    }
    
    .section-title {
      font-size: 2.5rem;
      color: #cbb69e;
      text-align: center;
      margin-bottom: 3rem;
      font-weight: bold;
    }
    
    .btn {
      display: inline-block;
      padding: 1rem 2rem;
      border: none;
      border-radius: 0.5rem;
      text-decoration: none;
      font-weight: 600;
      transition: all 0.3s ease;
      cursor: pointer;
      font-size: 1rem;
    }
    
    .btn-primary {
      background: linear-gradient(to right, #f0e5d5 0%, #cbb69e 100%);
      border: 2px solid #b8a48a;
      color: #6B4423;
    }
    
    .btn-primary:hover {
      background-color: #cbb69e;
      color: #0E1A24;
    }
    
    .btn-secondary {
      background: linear-gradient(to right, #f0e5d5 0%, #cbb69e 100%);
      border: 2px solid #b8a48a;
      color: #8B5A3C;
    }
    
    .btn-secondary:hover {
      background-color: #cbb69e;
      color: #0E1A24;
    }
    
    .btn-sm {
      padding: 0.5rem 1rem;
      font-size: 0.875rem;
    }
    
    .btn-lg {
      padding: 1.25rem 2.5rem;
      font-size: 1.125rem;
    }
    
    /* Hero Section */
    .hero-section {
      position: relative;
      height: calc(100vh - 160px);
      min-height: calc(100vh - 160px);
      max-height: calc(100vh - 160px);
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      overflow: hidden;
    }
    
    .hero-background-carousel {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 0;
    }
    
    .hero-background-image {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      /* Fill full width while fitting within height - no side gaps */
      background-size: 100% auto;
      background-position: center center;
      background-repeat: no-repeat;
      opacity: 0;
      transition: opacity 1.5s ease-in-out;
      image-rendering: -webkit-optimize-contrast;
      image-rendering: auto;
      will-change: opacity, transform;
      backface-visibility: hidden;
      transform: translateZ(0);
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      /* Optimize image quality for different screen sizes */
      -webkit-backface-visibility: hidden;
      -moz-backface-visibility: hidden;
      -ms-transform: translateZ(0);
      -webkit-transform: translateZ(0);
    }
    
    .hero-background-image.active {
      opacity: 1;
      animation: slowZoomInOut 20s ease-in-out infinite;
    }
    
    @keyframes slowZoomInOut {
      0%, 100% {
        transform: scale(1) translateZ(0);
      }
      50% {
        transform: scale(1.15) translateZ(0);
      }
    }
    
    .hero-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(14, 26, 36, 0.4);
      z-index: 1;
    }
    
    .hero-content {
      position: relative;
      z-index: 2;
      max-width: 700px;
      padding: 2rem;
      color: white;
    }
    
    .hero-title {
      font-size: 7rem;
      color: #c5b19b;
      margin-bottom: 0.75rem;
      font-weight: bold;
      text-shadow: 3px 3px 10px rgba(64, 35, 25, 0.5);
      font-family: 'Secular One', sans-serif;
      letter-spacing: 0.03em;
    }
    
    .hero-tagline {
      font-size: 1.6rem;
      color: white;
      margin-bottom: 1rem;
      margin-top: 0;
      font-weight: 500;
      text-shadow: 2px 2px 4px rgba(0,0,0,0.5);
      line-height: 1.6;
      font-family: 'Google Sans', sans-serif;
    }
    
    .hero-tagline .megadim-text {
      color: white !important;
      font-weight: 600;
      text-shadow: 2px 2px 4px rgba(0,0,0,0.5);
    }
    
    .hero-kashrut {
      font-size: 1.4rem;
      color: #cbb69e;
      margin-bottom: 2.5rem;
      margin-top: 0;
      font-weight: 700;
      text-shadow: 2px 2px 4px rgba(0,0,0,0.5);
      line-height: 1.6;
      font-family: 'Google Sans', sans-serif;
      letter-spacing: 0.05em;
    }
    
    .hero-subtitle {
      font-size: 2.5rem;
      color: white;
      margin-bottom: 0.25rem;
      font-weight: bold;
      text-shadow: 2px 2px 4px rgba(0,0,0,0.5);
      opacity: 1;
      font-family: 'Google Sans', sans-serif;
    }
    
    .hero-cta {
      font-size: 1.4rem;
      padding: 1.1rem 2.3rem;
      background: linear-gradient(to right, #f0e5d5 0%, #cbb69e 100%);
      border: 2px solid #b8a48a;
      color: #6B4423;
    }
    
    .hero-cta:hover {
      background-color: #cbb69e;
      color: #0E1A24;
    }
    
    /* Services Section */
    .services-section {
      padding: 6rem 0;
      background-color: white;
      transition: background-color 0.8s ease-in-out;
    }
    
    .services-section.fade-in {
      background-color: white;
    }
    
    .services-section-title {
      font-size: 2.5rem;
      color: #cbb69e;
      text-align: center;
      margin-bottom: 3rem;
      font-weight: bold;
    }
    
    .services-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 2rem;
      margin-bottom: 5rem;
    }
    
    .service-item {
      display: flex;
      flex-direction: column;
    }
    
    .service-card {
      position: relative;
      min-height: 50vh;
      border-radius: 0;
      overflow: hidden;
      border: none;
      box-shadow: 0 8px 24px rgba(31, 52, 68, 0.6);
    }
    
    .events-catering-background,
    .shabbat-catering-background,
    .ready-food-background {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-size: cover;
      background-position: center;
      background-repeat: no-repeat;
      z-index: 0;
      image-rendering: -webkit-optimize-contrast;
      image-rendering: crisp-edges;
      will-change: transform;
      backface-visibility: hidden;
      transform: translateZ(0);
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      -webkit-backface-visibility: hidden;
      -ms-interpolation-mode: bicubic;
      filter: contrast(1.1) saturate(1.05);
    }
    
    .events-catering-background {
      background-image: url('/assets/images/Shabbat-table2.jpg');
    }
    
    .shabbat-catering-background {
      background-image: url('/assets/images/Holiday-catering.jpg');
    }
    
    .ready-food-background {
      background-image: url('/assets/images/Sabbath-Category.jpg');
    }
    
    .service-background-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: linear-gradient(to bottom, rgba(64, 35, 25, 0.6) 0%, rgba(64, 35, 25, 0.3) 50%, transparent 100%);
      z-index: 1;
    }
    
    .service-content-wrapper {
      padding: 2rem 1.5rem;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1.5rem;
      background: white;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }
    
    .service-title-wrapper {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
    }
    
    .service-card {
      display: flex;
      flex-direction: column;
      position: relative;
    }
    
    .service-content-wrapper .service-title {
      color: #cbb69e;
      margin: 0;
      width: 100%;
      font-weight: 900;
      text-align: center;
      font-size: 2rem;
    }
    
    .service-content-wrapper .btn {
      margin: 0;
      background: linear-gradient(to right, #e8d9c9 0%, #d4c4b0 100%);
      color: #6B4423;
      border: 2px solid #b8a48a;
      box-shadow: 0 4px 12px rgba(203, 182, 158, 0.25), 0 0 20px rgba(203, 182, 158, 0.1);
      position: relative;
      overflow: hidden;
      animation: buttonGlow 2s ease-in-out infinite;
      font-weight: 700;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      padding: 1.25rem 2.5rem;
      font-size: 1rem;
    }
    
    .service-content-wrapper .btn::before {
      content: '';
      position: absolute;
      top: 0;
      left: -100%;
      width: 100%;
      height: 100%;
      background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
      transition: left 0.5s;
    }
    
    .service-content-wrapper .btn:hover::before {
      left: 100%;
    }
    
    .service-content-wrapper .btn:hover {
      background-color: #cbb69e;
      color: #6B4423;
      transform: translateY(-3px);
      box-shadow: 0 6px 18px rgba(203, 182, 158, 0.4), 0 0 25px rgba(203, 182, 158, 0.2);
      border-color: #b8a48a;
    }
    
    .service-content-wrapper .btn:active {
      transform: translateY(-1px);
      box-shadow: 0 4px 15px rgba(203, 182, 158, 0.5);
    }
    
    @keyframes buttonGlow {
      0%, 100% {
        box-shadow: 0 4px 12px rgba(203, 182, 158, 0.25), 0 0 20px rgba(203, 182, 158, 0.1);
      }
      50% {
        box-shadow: 0 5px 15px rgba(203, 182, 158, 0.35), 0 0 25px rgba(203, 182, 158, 0.15);
      }
    }
    
    .service-block.reverse {
      direction: ltr;
    }
    
    .service-block.reverse .service-content {
      direction: rtl;
    }
    
    .service-content {
      padding: 2rem;
    }
    
    .service-title {
      font-size: 2.25rem;
      color: #0E1A24;
      margin-bottom: 1.5rem;
      font-weight: bold;
    }
    
    .service-description {
      font-size: 1.125rem;
      color: #6c757d;
      line-height: 1.8;
      margin-bottom: 2rem;
    }
    
    .service-image {
      overflow: hidden;
      border-radius: 1rem;
      box-shadow: 0 8px 32px rgba(0,0,0,0.15);
    }
    
    .service-image img {
      width: 100%;
      height: 400px;
      object-fit: cover;
      transition: transform 0.3s ease;
    }
    
    .service-image:hover img {
      transform: scale(1.05);
    }
    
    /* Why Choose Us Section */
    .why-choose-us-section {
      padding: 6rem 0;
      background: #1f3444;
      color: white;
    }
    
    .why-choose-us-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 3rem;
      margin-bottom: 5rem;
    }
    
    .why-item {
      text-align: center;
      padding: 2rem 1rem;
    }
    
    .why-icon {
      font-size: 3rem;
      color: #cbb69e;
      margin-bottom: 1.5rem;
    }
    
    .why-item h3 {
      font-size: 1.5rem;
      margin-bottom: 1rem;
      color: #cbb69e;
    }
    
    .why-item p {
      color: rgba(255,255,255,0.8);
      line-height: 1.6;
      margin-bottom: 1.5rem;
    }
    
    .why-features {
      margin-top: 1.5rem;
      padding-top: 1.5rem;
      border-top: 1px solid rgba(203, 182, 158, 0.2);
      text-align: right;
    }
    
    .feature-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 0.875rem;
      color: rgba(255, 255, 255, 0.75);
      font-size: 0.95rem;
      justify-content: flex-end;
    }
    
    .feature-item:last-child {
      margin-bottom: 0;
    }
    
    .feature-dot {
      color: #cbb69e;
      font-size: 1.25rem;
      font-weight: bold;
    }
    
    .why-extended-text {
      text-align: center;
      margin-top: 4rem;
      margin-bottom: 2rem;
      max-width: 900px;
      margin-left: auto;
      margin-right: auto;
    }
    
    .intro-text {
      font-size: 1.35rem;
      line-height: 2;
      color: rgba(255, 255, 255, 0.9);
      margin-bottom: 2rem;
      font-weight: 400;
    }
    
    .intro-text:last-of-type {
      margin-bottom: 0;
    }
    
    .certification-badge {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 1rem;
      margin-top: 2rem;
      color: #cbb69e;
      font-size: 1.15rem;
      font-weight: 600;
    }
    
    .badge-icon {
      font-size: 1.75rem;
      color: #cbb69e;
      font-weight: bold;
    }
    
    /* Menu Carousel Section */
    .menu-carousel-section {
      padding: 6rem 0;
      background-color: white;
    }
    
    /* Categories Section */
    .categories-section {
      margin-bottom: 4rem;
      margin-top: 2rem;
    }
    
    .categories-container {
      width: 100%;
    }
    
    .categories-grid {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 2rem;
      flex-wrap: wrap;
      padding: 1rem 0;
    }
    
    .category-item {
      flex: 0 0 160px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
      cursor: pointer;
      transition: transform 0.3s ease;
      scroll-snap-align: center;
    }
    
    .category-item:hover {
      transform: translateY(-5px);
    }
    
    .category-circle {
      width: 160px;
      height: 160px;
      border-radius: 50%;
      overflow: hidden;
      border: 4px solid #0E1A24;
      background: #f5f5f5;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      transition: all 0.3s ease;
    }
    
    .category-item:hover .category-circle {
      border-color: #cbb69e;
      box-shadow: 0 8px 20px rgba(203, 182, 158, 0.3);
      transform: scale(1.05);
    }
    
    .category-circle img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    
    .category-name {
      font-size: 1.1rem;
      font-weight: 600;
      color: #0E1A24;
      text-align: center;
      margin: 0;
      transition: color 0.3s ease;
    }
    
    .category-item:hover .category-name {
      color: #cbb69e;
    }
    
    
    .menu-empty-state {
      text-align: center;
      padding: 3rem 2rem;
      color: #6c757d;
      font-size: 1.1rem;
    }
    
    .carousel-container {
      position: relative;
      overflow: hidden;
      min-height: 400px;
      padding: 0 60px;
      width: 100%;
    }
    
    .carousel-track {
      display: flex;
      gap: 2rem;
      padding: 1rem 0;
      overflow-x: auto;
      overflow-y: hidden;
      scroll-behavior: smooth;
      scrollbar-width: none;
      -ms-overflow-style: none;
      width: 100%;
      scroll-snap-type: x proximity;
      -webkit-overflow-scrolling: touch;
    }
    
    .carousel-track::-webkit-scrollbar {
      display: none;
    }
    
    .carousel-card {
      flex: 0 0 320px;
      background: white;
      border-radius: 1rem;
      box-shadow: 0 8px 24px rgba(0,0,0,0.1);
      overflow: hidden;
      transition: transform 0.3s ease;
      scroll-snap-align: center;
      min-width: 320px;
      max-width: 320px;
      flex-shrink: 0;
    }
    
    .carousel-card:hover {
      transform: translateY(-8px);
    }
    
    .card-image {
      height: 200px;
      width: 100%;
      overflow: hidden;
      background: #f5f5f5;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
    }
    
    .card-image img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: center;
      display: block;
      image-rendering: -webkit-optimize-contrast;
      image-rendering: auto;
      will-change: transform;
      backface-visibility: hidden;
      transform: translateZ(0);
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      transition: transform 0.3s ease, filter 0.3s ease;
    }

    .carousel-card:hover .card-image img {
      transform: scale(1.05);
    }

    .carousel-card.is-unavailable:hover .card-image img {
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
    .card-image:has(.badge-popular) .badge-out-of-stock {
      right: auto;
      left: 10px;
    }

    /* Unavailable State */
    .carousel-card.is-unavailable {
      opacity: 0.6;
    }

    .carousel-card.is-unavailable .card-image {
      filter: grayscale(80%);
    }

    .carousel-card.is-unavailable .btn {
      pointer-events: none;
    }
    
    .card-image img[src=""],
    .card-image img:not([src]) {
      display: none;
    }
    
    .card-content {
      padding: 1.5rem;
    }
    
    .card-title {
      font-size: 1.25rem;
      color: #0E1A24;
      margin-bottom: 0.75rem;
      font-weight: bold;
    }
    
    .card-description {
      color: #6c757d;
      line-height: 1.5;
      margin-bottom: 1.5rem;
      font-size: 0.9rem;
    }
    
    .card-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .card-price {
      font-size: 1.25rem;
      font-weight: bold;
      color: #cbb69e;
    }
    
    .carousel-arrow {
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      background: white;
      border: 2px solid #cbb69e;
      width: 50px;
      height: 50px;
      border-radius: 50%;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      cursor: pointer;
      z-index: 10;
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #cbb69e;
      font-size: 1.2rem;
    }
    
    .carousel-arrow:hover:not(:disabled) {
      background: #cbb69e;
      color: white;
      border-color: #b8a48a;
      transform: translateY(-50%) scale(1.1);
      box-shadow: 0 6px 16px rgba(203, 182, 158, 0.3);
    }
    
    .carousel-arrow:disabled {
      opacity: 0.3;
      cursor: not-allowed;
      background: #f5f5f5;
      border-color: #ddd;
    }
    
    .carousel-arrow-left {
      left: 0;
    }
    
    .carousel-arrow-right {
      right: 0;
    }
    
    /* Testimonials Section */
    .testimonials-section {
      padding: 8rem 0;
      background: white;
      position: relative;
      overflow: hidden;
    }
    
    .section-divider {
      width: 100%;
      height: 2px;
      background: linear-gradient(90deg, transparent, #cbb69e 20%, #cbb69e 80%, transparent);
      margin-bottom: 4rem;
      position: relative;
    }
    
    .testimonials-background-decoration {
      position: absolute;
      top: -50%;
      right: -10%;
      width: 600px;
      height: 600px;
      background: radial-gradient(circle, rgba(212, 165, 116, 0.08) 0%, transparent 70%);
      border-radius: 50%;
      pointer-events: none;
      z-index: 0;
    }
    
    .testimonials-section::before {
      content: '';
      position: absolute;
      bottom: -30%;
      left: -5%;
      width: 500px;
      height: 500px;
      background: radial-gradient(circle, rgba(201, 125, 96, 0.06) 0%, transparent 70%);
      border-radius: 50%;
      pointer-events: none;
      z-index: 0;
    }
    
    .testimonials-header {
      text-align: center;
      margin-bottom: 5rem;
      position: relative;
      z-index: 1;
    }
    
    .testimonials-title-wrapper {
      position: relative;
      display: inline-block;
      margin-bottom: 1rem;
    }
    
    .testimonials-label {
      display: block;
      font-size: 0.9rem;
      font-weight: 600;
      color: #d4a574;
      text-transform: uppercase;
      letter-spacing: 2px;
      margin-bottom: 0.5rem;
      opacity: 0.9;
    }
    
    .testimonials-header .section-title {
      margin-bottom: 1rem;
      position: relative;
    }
    
    .title-underline {
      width: 80px;
      height: 3px;
      background: linear-gradient(90deg, #d4a574 0%, #c97d60 100%);
      margin: 1rem auto;
      border-radius: 2px;
    }
    
    .testimonials-subtitle {
      font-size: 1.15rem;
      color: #5c4a37;
      margin-top: 1.5rem;
      font-weight: 400;
      opacity: 0.85;
      max-width: 600px;
      margin-left: auto;
      margin-right: auto;
      line-height: 1.7;
    }
    
    .testimonials-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 3rem;
      position: relative;
      z-index: 1;
    }
    
    .testimonial-card {
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(10px);
      border-radius: 2rem;
      box-shadow: 
        0 8px 32px rgba(0, 0, 0, 0.06),
        0 2px 8px rgba(203, 182, 158, 0.1),
        inset 0 1px 0 rgba(255, 255, 255, 0.9);
      transition: all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
      position: relative;
      border: 1px solid rgba(203, 182, 158, 0.2);
      overflow: hidden;
      opacity: 1;
      transform: translateY(0);
    }
    
    .testimonial-card::after {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: linear-gradient(135deg, rgba(212, 165, 116, 0.03) 0%, rgba(201, 125, 96, 0.03) 100%);
      opacity: 0;
      transition: opacity 0.5s ease;
      pointer-events: none;
    }
    
    .testimonial-card:hover::after {
      opacity: 1;
    }
    
    .card-accent-line {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 5px;
      background: linear-gradient(90deg, #d4a574 0%, #c97d60 50%, #d4a574 100%);
      background-size: 200% 100%;
      transform: scaleX(0);
      transform-origin: left;
      transition: transform 0.8s cubic-bezier(0.4, 0, 0.2, 1);
      animation: shimmer 3s infinite;
    }
    
    @keyframes shimmer {
      0% {
        background-position: -200% 0;
      }
      100% {
        background-position: 200% 0;
      }
    }
    
    .testimonial-card:hover .card-accent-line {
      transform: scaleX(1);
    }
    
    .testimonial-card.fade-in-card {
      opacity: 0;
      transform: translateY(40px) scale(0.9) rotateX(5deg);
      animation: fadeInUp3D 1s cubic-bezier(0.4, 0, 0.2, 1) forwards;
    }
    
    @keyframes fadeInUp3D {
      from {
        opacity: 0;
        transform: translateY(40px) scale(0.9) rotateX(5deg);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1) rotateX(0deg);
      }
    }
    
    .testimonial-card:hover {
      transform: translateY(-16px) scale(1.03) rotateY(2deg);
      box-shadow: 
        0 24px 60px rgba(203, 182, 158, 0.2),
        0 8px 24px rgba(0, 0, 0, 0.08),
        inset 0 1px 0 rgba(255, 255, 255, 1);
      border-color: rgba(203, 182, 158, 0.35);
    }
    
    .testimonial-card-inner {
      padding: 3rem 2.5rem;
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 360px;
      position: relative;
    }
    
    .quote-icon-top {
      position: absolute;
      top: 2rem;
      right: 2rem;
      width: 70px;
      height: 70px;
      background: linear-gradient(135deg, rgba(212, 165, 116, 0.12) 0%, rgba(201, 125, 96, 0.12) 100%);
      border-radius: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0.7;
      transition: all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
      transform: rotate(-5deg);
    }
    
    .testimonial-card:hover .quote-icon-top {
      opacity: 1;
      transform: rotate(0deg) scale(1.15);
      background: linear-gradient(135deg, rgba(212, 165, 116, 0.2) 0%, rgba(201, 125, 96, 0.2) 100%);
    }
    
    .quote-icon-top svg {
      width: 40px;
      height: 40px;
    }
    
    .stars-rating {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 2rem;
      margin-top: 1rem;
      direction: ltr;
      justify-content: center;
      align-items: center;
    }
    
    .star-wrapper {
      position: relative;
      transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    
    .star-wrapper:nth-child(1) { transition-delay: 0s; }
    .star-wrapper:nth-child(2) { transition-delay: 0.05s; }
    .star-wrapper:nth-child(3) { transition-delay: 0.1s; }
    .star-wrapper:nth-child(4) { transition-delay: 0.15s; }
    .star-wrapper:nth-child(5) { transition-delay: 0.2s; }
    
    .stars-rating i {
      color: #d4a574;
      font-size: 1.4rem;
      filter: drop-shadow(0 2px 4px rgba(212, 165, 116, 0.3));
      transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    
    .testimonial-card:hover .star-wrapper {
      transform: translateY(-3px) scale(1.15);
    }
    
    .testimonial-card:hover .star-wrapper:nth-child(odd) {
      transform: translateY(-3px) scale(1.15) rotate(5deg);
    }
    
    .testimonial-card:hover .star-wrapper:nth-child(even) {
      transform: translateY(-3px) scale(1.15) rotate(-5deg);
    }
    
    .testimonial-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      margin-bottom: 2.5rem;
      position: relative;
    }
    
    .testimonial-quote {
      font-size: 1.2rem;
      line-height: 2.1;
      color: #2d1f14;
      flex: 1;
      font-weight: 400;
      text-align: justify;
      direction: rtl;
      position: relative;
      padding: 0;
      letter-spacing: 0.3px;
    }
    
    .testimonial-author {
      display: flex;
      align-items: center;
      gap: 1.25rem;
      padding-top: 2rem;
      border-top: 1px solid rgba(203, 182, 158, 0.2);
      margin-top: auto;
      direction: rtl;
    }
    
    .author-avatar {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: linear-gradient(135deg, #d4a574 0%, #c97d60 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 1.5rem;
      font-weight: 700;
      box-shadow: 0 4px 12px rgba(212, 165, 116, 0.3);
      flex-shrink: 0;
      transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    
    .testimonial-card:hover .author-avatar {
      transform: scale(1.1) rotate(5deg);
      box-shadow: 0 6px 20px rgba(212, 165, 116, 0.4);
    }
    
    .author-info {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
      flex: 1;
    }
    
    .author-name {
      font-weight: 700;
      color: #2d1f14;
      font-size: 1.15rem;
      letter-spacing: 0.5px;
    }
    
    .author-event {
      color: #5c4a37;
      font-size: 1rem;
      font-weight: 500;
      opacity: 0.85;
    }
    
    
    /* Responsive Design */
    @media (max-width: 1024px) {
      .carousel-container {
        padding: 0 50px;
      }
      
      .carousel-arrow {
        width: 45px;
        height: 45px;
        font-size: 1rem;
      }
      
      /* Optimize hero images for tablets - fill width, fit height */
      .hero-section {
        height: calc(100vh - 160px);
        min-height: calc(100vh - 160px);
        max-height: calc(100vh - 160px);
      }
      
      .hero-background-image {
        background-size: 100% auto;
        background-position: center center;
        image-rendering: -webkit-optimize-contrast;
        image-rendering: auto;
      }
    }
    
    @media (max-width: 768px) {
      .container {
        padding: 0 1rem;
      }
      
      /* Ensure hero section takes full viewport height on mobile */
      .hero-section {
        height: calc(100vh - 160px);
        min-height: calc(100vh - 160px);
        max-height: calc(100vh - 160px);
      }
      
      .hero-title {
        font-size: 5rem;
      }
      
      .hero-tagline {
        font-size: 1.4rem;
        margin-bottom: 0.75rem;
      }
      
      .hero-kashrut {
        font-size: 1.2rem;
        margin-bottom: 1rem;
      }
      
      .hero-subtitle {
        font-size: 2rem;
      }
      
      /* Optimize hero images for mobile - fill width, fit height */
      .hero-background-image {
        background-size: 100% auto;
        background-position: center center;
        image-rendering: -webkit-optimize-contrast;
        image-rendering: auto;
        /* Ensure crisp rendering on high DPI displays */
        -webkit-transform: translateZ(0) scale(1);
        transform: translateZ(0) scale(1);
      }
      
      .section-title {
        font-size: 2rem;
      }
      
      .services-grid {
        grid-template-columns: 1fr;
        gap: 2rem;
      }
      
      .service-card {
        min-height: 39vh;
      }
      
      .why-choose-us-grid {
        grid-template-columns: 1fr;
        margin-bottom: 3rem;
      }
      
      .why-extended-text {
        padding: 0 1rem;
        margin-top: 3rem;
      }
      
      .intro-text {
        font-size: 1.15rem;
        line-height: 1.8;
        margin-bottom: 1.5rem;
      }
      
      .certification-badge {
        font-size: 1rem;
        flex-direction: column;
        gap: 0.75rem;
        padding: 0 1rem;
      }
      
      .badge-icon {
        font-size: 1.5rem;
      }
      
      .why-features {
        text-align: center;
      }
      
      .feature-item {
        justify-content: center;
      }
      
      .carousel-card {
        flex: 0 0 280px;
        min-width: 280px;
        max-width: 280px;
      }
      
      .carousel-container {
        padding: 0 20px;
      }
      
      .testimonials-section {
        padding: 4rem 0;
      }
      
      .testimonials-grid {
        grid-template-columns: 1fr;
        gap: 2.5rem;
      }
      
      .testimonials-header {
        margin-bottom: 3rem;
      }
      
      .testimonials-label {
        font-size: 0.8rem;
        letter-spacing: 1.5px;
      }
      
      .testimonials-subtitle {
        font-size: 1rem;
        padding: 0 1rem;
      }
      
      .testimonial-card-inner {
        min-height: auto;
        padding: 2.5rem 2rem;
      }
      
      .quote-icon-top {
        width: 60px;
        height: 60px;
        top: 1.5rem;
        right: 1.5rem;
        border-radius: 15px;
      }
      
      .quote-icon-top svg {
        width: 35px;
        height: 35px;
      }
      
      .testimonial-quote {
        font-size: 1.1rem;
        line-height: 1.9;
      }
      
      .author-avatar {
        width: 48px;
        height: 48px;
        font-size: 1.3rem;
      }
      
      .author-name {
        font-size: 1.05rem;
      }
      
      .author-event {
        font-size: 0.9rem;
      }
      
      
      .carousel-arrow {
        display: none;
      }
      
      .categories-grid {
        gap: 1.5rem;
      }
      
      .category-circle {
        width: 120px;
        height: 120px;
      }
      
      .category-name {
        font-size: 0.95rem;
      }
    }
    
    /* High DPI / Retina Display Optimization */
    @media (-webkit-min-device-pixel-ratio: 2), (min-resolution: 192dpi) {
      .hero-background-image {
        /* Maintain sharpness on high DPI displays */
        image-rendering: -webkit-optimize-contrast;
        image-rendering: auto;
        -webkit-backface-visibility: hidden;
        backface-visibility: hidden;
      }
    }
    
    /* Large screens - fill width, fit height */
    @media (min-width: 1920px) {
      .hero-section {
        height: calc(100vh - 160px);
        min-height: calc(100vh - 160px);
        max-height: calc(100vh - 160px);
      }
      
      .hero-background-image {
        background-size: 100% auto;
        background-position: center center;
        image-rendering: -webkit-optimize-contrast;
        image-rendering: auto;
      }
    }
    
    /* Ultra-wide screens - fill width, fit height */
    @media (min-width: 2560px) {
      .hero-background-image {
        background-size: 100% auto;
        background-position: center center;
        image-rendering: -webkit-optimize-contrast;
        image-rendering: auto;
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
  
  // Categories state - only existing categories in the site
  menuCategories: any[] = [
    {
      id: 'main-dishes',
      name: 'מנות עיקריות',
      imageUrl: '/assets/images/fish/Fish-stretched.jpg', // Using available image for main dishes
      route: '/ready-for-shabbat/main-dishes'
    },
    {
      id: 'side-dishes',
      name: 'תוספות',
      imageUrl: '/assets/images/salads/root-vegetables.jpg', // Vegetables image for side dishes
      route: '/ready-for-shabbat/side-dishes'
    },
    {
      id: 'salads',
      name: 'סלטים',
      imageUrl: '/assets/images/salads/hummus.jpg',
      route: '/ready-for-shabbat/salads'
    },
    {
      id: 'desserts',
      name: 'קינוחים',
      imageUrl: '/assets/images/placeholder-dish.jpg',
      route: '/ready-for-shabbat/desserts'
    },
    {
      id: 'fish',
      name: 'דגים',
      imageUrl: '/assets/images/Fish-category.jpg',
      route: '/ready-for-shabbat/fish'
    }
  ];
  
  // Background carousel - responsive images
  backgroundImages: string[] = [
    '/assets/images/main-picture3.png',
    '/assets/images/main-picture4.png',
    '/assets/images/Fish-category.jpg'
  ];
  currentBackgroundIndex = 2; // Show only the third image (index 2)
  private backgroundInterval?: any;
  
  // Get responsive image URL based on screen size
  getResponsiveImageUrl(baseUrl: string): string {
    if (typeof window === 'undefined') return baseUrl;
    
    const width = window.innerWidth;
    const pixelRatio = window.devicePixelRatio || 1;
    
    // For high DPI displays, ensure we're using the best quality
    // The browser will handle scaling, but we ensure proper rendering
    return baseUrl;
  }

  constructor() {
  }

  ngOnInit(): void {
    this.loadHighlightedMenuItems();
    this.loadTestimonials();
    // Removed startBackgroundCarousel() to show only the third image
  }

  ngAfterViewInit(): void {
    this.setupSmoothScrolling();
    this.setupCarouselResize();
  }

  ngOnDestroy(): void {
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
    }
    if (this.backgroundInterval) {
      clearInterval(this.backgroundInterval);
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', this.onWindowResize.bind(this));
    }
  }

  private setupCarouselResize(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', () => {
        this.calculateMaxCarouselIndex();
      });
    }
  }
  
  private startBackgroundCarousel(): void {
    // Change background image every 5 seconds
    this.backgroundInterval = setInterval(() => {
      this.currentBackgroundIndex = (this.currentBackgroundIndex + 1) % this.backgroundImages.length;
    }, 5000);
  }

  private setupSmoothScrolling(): void {
    // Create intersection observer for smooth animations
    this.intersectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('fade-in');
          }
        });
      },
      {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
      }
    );

    // Observe all smooth sections
    const smoothSections = document.querySelectorAll('.smooth-section');
    smoothSections.forEach(section => {
      this.intersectionObserver?.observe(section);
    });
  }

  private loadHighlightedMenuItems(): void {
    this.menuService.getMenuItems().subscribe({
      next: (items) => {
        const highlightedItems: any[] = [];
        
        // Available salad images
        const saladImages = [
          '/assets/images/salads/hummus.jpg',
          '/assets/images/salads/Tahini-eggplant.jpg',
          '/assets/images/salads/tabula.jpg',
          '/assets/images/salads/beet-salad.jpg',
          '/assets/images/salads/Coleslaw.jpg'
        ];
        
        // Available fish images
        const fishImages = [
          '/assets/images/fish/Salmon-teriyaki.jpg',
          '/assets/images/fish/Fish-stretched.jpg'
        ];
        
        // Get 5 salads from "סלטים" category
        const salads = items
          .filter(item => {
            const isSalad = item.category === 'סלטים';
            const isAvailable = item.isAvailable !== false;
            return isSalad && isAvailable;
          })
          .slice(0, 5)
          .map((salad, index) => ({
            ...salad,
            imageUrl: salad.imageUrl || saladImages[index] || '/assets/images/placeholder-dish.jpg'
          }));
        highlightedItems.push(...salads);
        
        // Get 2 fish dishes from "דגים" category
        const fishDishes = items
          .filter(item => {
            const isFish = item.category === 'דגים';
            const isAvailable = item.isAvailable !== false;
            return isFish && isAvailable;
          })
          .slice(0, 2)
          .map((fish, index) => ({
            ...fish,
            imageUrl: fish.imageUrl || fishImages[index] || '/assets/images/placeholder-dish.jpg'
          }));
        highlightedItems.push(...fishDishes);
        
        // Use items from API - NO fallback hardcoded data
        // If server is down, list will be empty (proving we are no longer using hardcoded data)
        this.highlightedMenuItems = highlightedItems;
        
        // Calculate max index after view is ready
        setTimeout(() => {
          this.calculateMaxCarouselIndex();
        }, 100);
      },
      error: (error) => {
        console.error('Error loading menu items:', error);
        // If server is down, list will be empty (proving we are no longer using hardcoded data)
        this.highlightedMenuItems = [];
        // Calculate max index after view is ready
        setTimeout(() => {
          this.calculateMaxCarouselIndex();
        }, 100);
      }
    });
  }

  private loadTestimonials(): void {
    // Set fallback testimonials immediately to ensure content is shown
    this.testimonials = [
      {
        id: '1',
        content: 'האוכל של מגדים פשוט מדהים. הרגשנו כאילו אמא מבשלת לנו במטבח, אבל ברמה של מסעדת יוקרה.',
        authorName: 'משפחת לוי',
        eventType: 'בר מצווה'
      },
      {
        id: '2',
        content: 'השירות אישי, הכל מגיע חם וטרי, והטעם? ביתי ומנחם בדיוק כמו שחיפשנו.',
        authorName: 'חברת "טק-סולושנס"',
        eventType: 'קייטרינג מוסדי'
      },
      {
        id: '3',
        content: 'מכירת האוכל המוכן לשבת היא הצלה של ממש. טעמים עשירים ושפע שמרגיש שנעשה מכל הלב.',
        authorName: 'רחל כהן',
        eventType: 'לקוחה קבועה'
      }
    ];
    
    // Try to load from service, but keep fallback if it fails
    this.testimonialsService.getTestimonials().subscribe({
      next: (testimonials) => {
        if (testimonials && testimonials.length > 0) {
          this.testimonials = testimonials.slice(0, 3); // Take first 3
        }
      },
      error: (error) => {
        console.error('Error loading testimonials:', error);
        // Keep fallback testimonials that were already set
      }
    });
  }

  scrollToContact(): void {
    // Scroll to contact page or footer
    window.location.href = '/contact';
  }

  getPrice(item: any): number {
    // Priority 1: pricingOptions (first option price)
    if (item.pricingOptions && item.pricingOptions.length > 0) {
      return item.pricingOptions[0].price;
    }
    
    // Priority 2: pricingVariants (first variant price)
    if (item.pricingVariants && item.pricingVariants.length > 0) {
      return item.pricingVariants[0].price;
    }
    
    // Priority 3: single price
    if (item.price !== undefined && item.price !== null) {
      return item.price;
    }
    
    return 0;
  }

  addToCart(item: any): void {
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
      description: item.description
    });
    
    // Optional: Show success message or animation
    console.log('Item added to cart:', item.name);
  }

  scrollCarousel(direction: 'left' | 'right'): void {
    if (!this.carouselTrack) return;

    // Card width (320px) + gap (2rem = 32px) = 352px
    const cardWidth = 320;
    const gap = 32;
    const scrollAmount = cardWidth + gap;
    const element = this.carouselTrack.nativeElement;
    const currentScroll = element.scrollLeft;
    
    if (direction === 'right') {
      const newScroll = currentScroll + scrollAmount;
      element.scrollTo({
        left: newScroll,
        behavior: 'smooth'
      });
      this.currentCarouselIndex = Math.min(this.currentCarouselIndex + 1, this.maxCarouselIndex);
    } else {
      const newScroll = currentScroll - scrollAmount;
      element.scrollTo({
        left: newScroll,
        behavior: 'smooth'
      });
      this.currentCarouselIndex = Math.max(this.currentCarouselIndex - 1, 0);
    }
  }

  private calculateMaxCarouselIndex(): void {
    if (typeof window === 'undefined') {
      this.maxCarouselIndex = 0;
      return;
    }
    // Calculate based on number of visible cards
    const containerWidth = window.innerWidth;
    const cardWidth = 320;
    const gap = 32;
    const padding = 120; // 60px on each side
    const visibleWidth = containerWidth - padding;
    const visibleCards = Math.floor(visibleWidth / (cardWidth + gap));
    this.maxCarouselIndex = Math.max(0, this.highlightedMenuItems.length - Math.max(1, visibleCards));
  }

  trackByItemId(index: number, item: any): string {
    return item.id || item._id || '';
  }
  
  trackByCategoryId(index: number, category: any): string {
    return category.id;
  }
  
  navigateToCategory(category: any): void {
    if (category.route) {
      this.router.navigate([category.route]);
    }
  }

  // Handle window resize for carousel
  onWindowResize(): void {
    this.calculateMaxCarouselIndex();
  }

  // Handle image loading errors
  handleImageError(event: any): void {
    if (event && event.target) {
      event.target.src = '/assets/images/placeholder-dish.jpg';
    }
  }
}
