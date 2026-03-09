import { Component, OnInit, inject, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, Router, NavigationEnd, RouterModule } from '@angular/router';
import { filter } from 'rxjs/operators';
import { MatSidenavModule, MatSidenavContainer, MatSidenav } from '@angular/material/sidenav';
import { MatButtonModule } from '@angular/material/button';
import { TranslateModule } from '@ngx-translate/core';

import { HeaderComponent } from './components/shared/header/header.component';
import { SearchBarComponent } from './components/shared/search-bar/search-bar.component';
import { CartModalComponent } from './components/shared/cart-modal/cart-modal.component';
import { FooterComponent } from './components/shared/footer/footer.component';
import { ToastComponent } from './components/shared/toast/toast.component';

import { LanguageService } from './services/language.service';
import { MAIN_NAV_LINKS } from './nav-links';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterModule,
    MatSidenavModule,
    MatButtonModule,
    TranslateModule,
    HeaderComponent,
    SearchBarComponent,
    CartModalComponent,
    FooterComponent,
    ToastComponent
  ],
  template: `
    <div class="app-container" [dir]="textDir">
    <mat-sidenav-container class="mat-sidenav-wrapper" autosize>
      <mat-sidenav #sidenav mode="over" position="start" class="mobile-sidenav">
        <div class="sidenav-content">
          <button mat-button *ngFor="let link of navLinks" [routerLink]="link.path" (click)="sidenav.close()">{{ link.labelKey | translate }}</button>
        </div>
      </mat-sidenav>
      
      <!-- Header (hidden only on admin / time-clock / employee / my-zone) -->
      <app-header *ngIf="!isLoginOrAdminPage" [sidenav]="sidenav"></app-header>
      
      <!-- Search Bar -->
      <app-search-bar *ngIf="!isLoginOrAdminPage"></app-search-bar>
      
      <!-- Main Content (full-screen class only when header/footer hidden) -->
      <main class="main-content" [class.full-screen]="isLoginOrAdminPage">
        <router-outlet></router-outlet>
      </main>
      
      <!-- Footer (hidden only on admin / time-clock / employee / my-zone) -->
      <app-footer *ngIf="!isLoginOrAdminPage"></app-footer>
      
      <!-- Cart Modal -->
      <app-cart-modal *ngIf="!isLoginOrAdminPage"></app-cart-modal>
      
      <!-- Toast Notifications (available on all pages) -->
      <app-toast></app-toast>
    </mat-sidenav-container>

    <!-- Cookie Consent Banner -->
    <div class="cookie-banner" *ngIf="showCookieBanner">
      <p>אתר זה עושה שימוש בעוגיות (Cookies) כדי לשפר את חווית הגלישה, לנהל את אזור הלקוח ולאבטח את המידע שלך. בהמשך הגלישה באתר הנך מסכים למדיניות הפרטיות שלנו.</p>
      <div class="cookie-actions">
        <a routerLink="/privacy-policy">למידע נוסף</a>
        <button type="button" class="btn-primary-gold" (click)="acceptCookies()">הבנתי ואישרתי</button>
      </div>
    </div>

    <!-- Floating WhatsApp Button (bottom-left so it doesn't overlap accessibility on the right) -->
    <a
      href="https://wa.me/972528240230"
      target="_blank"
      rel="noopener noreferrer"
      class="fab-whatsapp"
      aria-label="צרו קשר בוואטסאפ"
    >
      <i class="fa-brands fa-whatsapp" aria-hidden="true"></i>
    </a>
    </div>
  `,
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  private languageService = inject(LanguageService);
  private router = inject(Router);
  
  // Content direction property (NOT document direction)
  textDir: 'rtl' | 'ltr' = 'rtl';
  isLoginOrAdminPage = false;
  showCookieBanner = false;
  navLinks = MAIN_NAV_LINKS;

  ngOnInit(): void {
    if (typeof localStorage !== 'undefined' && !localStorage.getItem('cookieConsent')) {
      this.showCookieBanner = true;
    }
    // Subscribe to language changes to update content direction
    this.languageService.currentLanguage$.subscribe(lang => {
      this.textDir = lang === 'he' ? 'rtl' : 'ltr';
      // Update lang attribute only, NOT dir (html stays ltr for scrollbar)
      document.documentElement.setAttribute('lang', lang);
    });

    // Check if current route is login or admin
    this.updatePageVisibility();
    
    // Listen to route changes
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
        this.updatePageVisibility();
      });
  }

  private updatePageVisibility(): void {
    const url = this.router.url;
    // Hide header/footer only on admin and special app pages; show on login and register
    this.isLoginOrAdminPage = url.startsWith('/admin') || url.startsWith('/time-clock') || url.startsWith('/employee-login') || url.startsWith('/my-zone');
  }

  acceptCookies(): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('cookieConsent', 'accepted');
    }
    this.showCookieBanner = false;
  }
}
