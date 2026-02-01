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
          
          <div class="hero-subtitle">
            <p class="subtitle-line">שירותי קייטרינג איכותיים וכשרים למהדרין לכל סוגי האירועים – שבתות חתן, בריתות, ואירועים עסקיים.</p>
            <p class="subtitle-line">מטבח עשיר עם טעמים ביתיים וטריות בלתי מתפשרת, שמגיע עד אליכם.</p>
          </div>
          
          <div class="kosher-badge">
            כשר למהדרין
          </div>
          
          <div class="action-btn-wrapper">
            <button class="gold-btn" routerLink="/ready-for-shabbat">לתפריט המלא לחצו >></button>
          </div>
        </div>
      </section>
      
      <!-- Category Cards Section -->
      <section class="category-cards-section">
        <div class="category-cards-container">
          <div class="category-card" routerLink="/catering">
            <div class="card-image" style="background-image: url('https://res.cloudinary.com/dioklg7lx/image/upload/q_auto,f_auto/v1768297872/Saturday-tab_dit4ng.png');">
              <div class="card-overlay">
                <h3 class="gold-text">קייטרינג לאירועים</h3>
              </div>
            </div>
          </div>
          <div class="category-card" routerLink="/shabbat-events">
            <div class="card-image" style="background-image: url('https://res.cloudinary.com/dioklg7lx/image/upload/q_auto,f_auto/v1768297872/Saturday-tab_dit4ng.png');">
              <div class="card-overlay">
                <h3 class="gold-text">קייטרינג לאירועי שבת וחג</h3>
              </div>
            </div>
          </div>
          <div class="category-card" routerLink="/ready-for-shabbat">
            <div class="card-image" style="background-image: url('https://res.cloudinary.com/dioklg7lx/image/upload/q_auto,f_auto/v1768297872/Saturday-tab_dit4ng.png');">
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
    @import url('https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;700&display=swap');
    
    // Force host element to have zero spacing
    :host {
      display: block;
      margin: 0 !important;
      margin-top: 0 !important;
      padding: 0 !important;
      border: none !important;
    }
    
    .home-page {
      min-height: 100vh;
      margin: 0 !important;
      margin-top: 0 !important;
      padding: 0 !important;
      background-color: transparent !important; // No white background
    }
    
    /* Hero Section */
    $gold: #E0C075;
    $navy: #1f3540;
    $white: #FFFFFF;
    
    .hero-section {
      position: relative;
      height: 65vh;
      min-height: 600px; // הגדלנו ב-50 פיקסלים (550px + 50px)
      padding: 120px 20px; // More padding for breathing room
      margin-top: 0 !important;
      margin-bottom: 0 !important;
      text-align: center;
      color: $white;
      direction: rtl;
      overflow: hidden; // HIDDEN - keeps zoom within bounds, no overflow
      border-bottom: none !important;
      box-shadow: none !important;
      background-color: transparent !important; // No unwanted background
      display: flex; // Flexbox for perfect centering
      align-items: center; // Vertically center content
      justify-content: center; // Horizontally center content
      
      // Overlay with specified opacity
      &::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: #443a3a75; // Exact opacity as specified
        z-index: 1;
      }
      
      .hero-bg-image {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-image: url('https://res.cloudinary.com/dioklg7lx/image/upload/q_auto,f_auto/v1768222488/hero1_ime6hz.png') !important;
        background-size: cover; // Ensure full coverage
        background-position: center; // Center the image
        z-index: 0;
        border-bottom: none !important;
        box-shadow: none !important;
        
        // Slow zoom in/out animation
        animation: heroZoom 20s ease-in-out infinite;
      }
      
      // Zoom animation keyframes
      @keyframes heroZoom {
        0% {
          transform: scale(1);
        }
        50% {
          transform: scale(1.1); // Zoom in to 110%
        }
        100% {
          transform: scale(1); // Back to original
        }
      }
      
      .content-container {
        position: relative;
        z-index: 2; // Ensures content sits above the dark overlay
        max-width: 1200px;
        width: 100%;
        margin: 0 auto;
        padding: 40px 20px;
        border-bottom: none !important;
        box-shadow: none !important;
        background-color: transparent !important; // No unwanted background
        font-family: 'Heebo', sans-serif;
        
        // Flexbox layout for perfect centering and vertical rhythm
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0; // We'll use custom gaps for each section
      }
      
      // Premium Main Title
      .main-title {
        font-size: 4rem; // Significantly larger for impact
        font-weight: 800;
        text-shadow: 0 2px 10px rgba(0,0,0,0.5); // Subtle elegant shadow
        line-height: 1.1;
        margin: 0 0 15px 0; // 15px gap to subtitle
        letter-spacing: -0.5px; // Tighter spacing for modern look
      }
      
      // Premium Subtitle Section
      .hero-subtitle {
        font-family: 'Heebo', sans-serif;
        color: $white;
        opacity: 0.9; // Slightly transparent for elegance
        max-width: 900px;
        text-align: center;
        margin: 0 0 25px 0; // 25px gap to kosher badge
        
        .subtitle-line {
          font-size: 1.3rem;
          font-weight: 300; // Lighter font weight for premium feel
          line-height: 1.6; // More line-height for readability
          margin: 12px 0;
          text-shadow: 0 2px 8px rgba(0,0,0,0.7);
        }
      }
      
      // Elegant Kosher Badge
      .kosher-badge {
        font-family: 'Heebo', sans-serif;
        color: #e0c075; // Gold text
        background-color: transparent;
        font-size: 0.9rem; // Slightly smaller for elegance
        font-weight: 700;
        letter-spacing: 2px; // Increased letter spacing for elegance
        text-transform: uppercase; // All caps for premium badge look
        text-shadow: 0 2px 4px rgba(0,0,0,0.9);
        border-top: 1px solid #e0c075;
        border-bottom: 1px solid #e0c075;
        border-left: none;
        border-right: none;
        display: inline-block;
        padding: 5px 0;
        width: fit-content;
        margin: 0 0 35px 0; // 35px gap to button
      }
      
      .action-btn-wrapper {
        margin: 0; // No extra margin, using spacing from kosher badge
      }
      
      // Polished Button Styling
      .gold-btn {
        background-color: #e0c075; // Gold background
        color: #000000; // Black text
        border: none;
        font-size: 1.2rem;
        font-weight: 700; // Bold font
        letter-spacing: 0.5px; // Slight letter spacing
        padding: 12px 40px; // Substantial horizontal padding
        border-radius: 8px; // Rounded corners (8px)
        cursor: pointer;
        transition: all 0.3s ease;
        text-decoration: none;
        display: inline-block;
        font-family: 'Heebo', sans-serif;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.2); // Subtle shadow
        
        &:hover {
          transform: scale(1.05) translateY(-2px); // Scale + lift effect
          box-shadow: 0 8px 15px rgba(0, 0, 0, 0.3); // Enhanced shadow on hover
          background-color: darken(#e0c075, 5%); // Slightly darker on hover
        }
        
        &:active {
          transform: scale(1.02) translateY(0); // Subtle press effect
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.25);
        }
      }
      
      // Mobile Responsive - Tablet
      @media (max-width: 900px) {
        height: 60vh;
        min-height: 550px; // הגדלנו ב-50 פיקסלים (500px + 50px)
        padding: 100px 20px; // Maintain premium spacing
        
        .content-container {
          padding: 30px 20px;
        }
        
        .main-title {
          font-size: 3rem; // Keep it large on tablet
          margin: 0 0 13px 0;
          letter-spacing: -0.3px;
        }
        
        .hero-subtitle {
          max-width: 100%;
          opacity: 0.9;
          margin: 0 0 22px 0;
          
          .subtitle-line {
            font-size: 1.1rem;
            font-weight: 300;
            line-height: 1.6;
            margin: 10px 0;
          }
        }
        
        .kosher-badge {
          font-size: 0.85rem;
          padding: 5px 0;
          letter-spacing: 2px;
          margin: 0 0 30px 0;
        }
        
        .gold-btn {
          font-size: 1.1rem;
          padding: 11px 35px;
          border-radius: 8px;
        }
      }
      
      // Mobile Responsive - Small screens
      @media (max-width: 600px) {
        height: 55vh;
        min-height: 500px; // הגדלנו ב-50 פיקסלים (450px + 50px)
        padding: 80px 15px; // More padding on mobile too
        
        .content-container {
          padding: 20px 15px;
        }
        
        .main-title {
          font-size: 2.5rem; // Still substantial on mobile
          margin: 0 0 12px 0;
          letter-spacing: -0.2px;
        }
        
        .hero-subtitle {
          opacity: 0.9;
          margin: 0 0 20px 0;
          
          .subtitle-line {
            font-size: 1rem;
            font-weight: 300;
            line-height: 1.6;
            margin: 8px 0;
          }
        }
        
        .kosher-badge {
          font-size: 0.8rem;
          padding: 4px 0;
          letter-spacing: 2px;
          margin: 0 0 28px 0;
        }
        
        .gold-btn {
          font-size: 1rem;
          padding: 11px 32px;
          border-radius: 8px;
          letter-spacing: 0.3px;
        }
      }
    }
    
    // --- Category Cards Section ---
    .category-cards-section {
      background-color: #ffffff;
      padding: 60px 20px;
      position: relative;
      width: 100%;
      min-height: 500px;
      
      // --- Category Cards Container ---
      .category-cards-container {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 30px;
        position: relative;
        margin: 0 auto;
        max-width: 1200px;
        width: 100%;
        
        .category-card {
          position: relative;
          height: 480px;
          border-radius: 0;
          overflow: hidden;
          cursor: pointer;
          
          // Clean look - no borders or shadows
          border: none !important;
          box-shadow: none !important;
          background-color: transparent;
          box-sizing: border-box;
          
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
            background-repeat: no-repeat;
            filter: brightness(1); // Full brightness
            transition: all 0.4s ease-in-out;
            transform: scale(1);
            transform-origin: center;
            
            // Blue gradient overlay - matches navbar theme
            &::before {
              content: '';
              position: absolute;
              top: 0;
              left: 0;
              width: 100%;
              height: 100%;
              background: linear-gradient(to bottom, 
                rgba(26, 43, 60, 0) 0%,        // Transparent at top (food is clear)
                rgba(26, 43, 60, 0.3) 50%,     // Light blue in middle
                rgba(26, 43, 60, 0.85) 100%    // Dark site blue at bottom
              );
              z-index: 1;
            }
          }
          
          &:hover {
            .card-image {
              filter: brightness(1.1); // Slight brighten on hover
              transform: scale(1.03);
            }
            
            .card-overlay .gold-text {
              color: lighten(#e0c075, 10%); // Brighten gold on hover
              text-shadow: 0 0 15px rgba(224, 192, 117, 0.6), 0 2px 4px rgba(0,0,0,0.8); // Add glow
              transform: scale(1.05); // Slight scale up
            }
          }

          .card-overlay {
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            z-index: 2; // Positioned above blue gradient overlay
            padding: 40px 20px;
            text-align: center;
            
            .gold-text {
              color: #e0c075; // Gold theme color - stands out sharply against blue
              font-size: 1.8rem;
              font-weight: bold;
              margin: 0;
              text-shadow: 0 2px 8px rgba(0,0,0,0.9); // Stronger shadow for contrast against blue
              transition: all 0.3s ease; // Smooth transition for hover
            }
          }
        }
      }
      
      // Mobile Responsive for Category Cards
      @media (max-width: 900px) {
        padding: 40px 20px;
        
        .category-cards-container {
          grid-template-columns: 1fr;
          gap: 20px;
          
          .category-card {
            height: 400px;
          }
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
