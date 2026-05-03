import { Component, OnInit, inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
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
import { MarketingService } from './services/marketing.service';
import { MAIN_NAV_LINKS } from './nav-links';
import { CONTACT_WHATSAPP_HREF } from './constants/contact.constants';

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

    <!-- Cookie Consent Banner (GDPR / Israeli Privacy Law compliant) -->
    <div class="cookie-banner" *ngIf="showCookieBanner" role="dialog" aria-label="העדפות עוגיות">
      <p class="cookie-text">
        אתר זה עושה שימוש בעוגיות (Cookies) כדי להבטיח לך את חווית הגלישה הטובה ביותר, לאבטח את החיבור שלך ולשמור את סל הקניות. למידע נוסף, קרא את
        <a routerLink="/privacy-policy" class="cookie-link">מדיניות הפרטיות</a>
        שלנו.
      </p>
      <div class="cookie-actions">
        <button type="button" class="accept-btn" (click)="acceptAll()">אישור הכל</button>
        <button type="button" class="reject-btn" (click)="rejectAll()">דחה הכל</button>
      </div>
    </div>

    <!-- Floating WhatsApp Button (bottom-left so it doesn't overlap accessibility on the right) -->
    <a
      *ngIf="!isLoginOrAdminPage"
      [href]="whatsappHref"
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
  private platformId = inject(PLATFORM_ID);

  readonly whatsappHref = CONTACT_WHATSAPP_HREF;

  // Content direction property (NOT document direction)
  textDir: 'rtl' | 'ltr' = 'rtl';
  isLoginOrAdminPage = false;
  showCookieBanner = false;
  navLinks = MAIN_NAV_LINKS;

  constructor() {
    // Instantiate early so UTMs are captured from the landing URL and subsequent navigations.
    inject(MarketingService);
  }

  ngOnInit(): void {
    if (typeof localStorage !== 'undefined') {
      const consent = localStorage.getItem('cookieConsent');
      // Show banner only if no valid choice yet (legacy 'accepted' treated as 'all')
      const hasChoice = consent === 'all' || consent === 'essential' || consent === 'rejected' || consent === 'accepted';
      if (!hasChoice) this.showCookieBanner = true;
    }
    // Subscribe to language changes to update content direction
    this.languageService.currentLanguage$.subscribe(lang => {
      this.textDir = lang === 'he' ? 'rtl' : 'ltr';
      if (isPlatformBrowser(this.platformId)) {
        document.documentElement.setAttribute('lang', lang);
      }
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

  acceptAll(): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('cookieConsent', 'all');
    }
    this.showCookieBanner = false;
  }

  acceptEssentialOnly(): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('cookieConsent', 'essential');
    }
    this.showCookieBanner = false;
  }

  /**
   * Reject all non-essential cookies. We still store 'rejected' so the banner stays hidden.
   * Legally, strictly necessary cookies (session/auth, cart) may still be used for the site
   * to function; "reject" means the user does not consent to optional/marketing cookies.
   */
  rejectAll(): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('cookieConsent', 'rejected');
    }
    this.showCookieBanner = false;
  }
}
