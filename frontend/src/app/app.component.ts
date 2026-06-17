import { Component, OnInit, inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterOutlet, Router, NavigationEnd, RouterModule } from '@angular/router';
import { filter, take } from 'rxjs/operators';
import { MatSidenavModule, MatSidenavContainer, MatSidenav } from '@angular/material/sidenav';
import { MatButtonModule } from '@angular/material/button';
import { TranslateModule } from '@ngx-translate/core';

import { HeaderComponent } from './components/shared/header/header.component';
import { SearchBarComponent } from './components/shared/search-bar/search-bar.component';
import { CartModalComponent } from './components/shared/cart-modal/cart-modal.component';
import { FooterComponent } from './components/shared/footer/footer.component';
import { ToastComponent } from './components/shared/toast/toast.component';
import { WhatsappCtaComponent } from './components/shared/whatsapp-cta/whatsapp-cta.component';

import { LanguageService } from './services/language.service';
import { MarketingService } from './services/marketing.service';
import { AnalyticsService } from './services/analytics.service';
import { MetaPixelService } from './services/meta-pixel.service';
import { AuthService } from './services/auth.service';
import { MAIN_NAV_LINKS } from './nav-links';
import { isInstitutionAllowedPath } from './utils/auth-redirect';

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
    ToastComponent,
    WhatsappCtaComponent
  ],
  template: `
    <div class="app-container" [dir]="textDir">
    <mat-sidenav-container class="mat-sidenav-wrapper" autosize>
      <mat-sidenav #sidenav mode="over" position="start" class="mobile-sidenav">
        <div class="sidenav-content">
          <button mat-button *ngFor="let link of navLinks" [routerLink]="link.path" (click)="sidenav.close()">{{ link.labelKey | translate }}</button>
        </div>
      </mat-sidenav>
      
      <!-- Header (hidden on admin, portal, kiosk, employee) -->
      <app-header *ngIf="!isLoginOrAdminPage && !isPortalRoute" [sidenav]="sidenav"></app-header><!--
      --><main class="main-content" [class.full-screen]="isLoginOrAdminPage || isPortalRoute">
        <router-outlet></router-outlet>
      </main><!--
      --><app-footer *ngIf="!isLoginOrAdminPage && !isPortalRoute"></app-footer>

      <!-- Search overlay (fixed; placed after layout flow to avoid header/content gap) -->
      <app-search-bar *ngIf="!isLoginOrAdminPage && !isPortalRoute"></app-search-bar>
      
      <!-- Cart Modal -->
      <app-cart-modal *ngIf="!isLoginOrAdminPage && !isPortalRoute"></app-cart-modal>
      
      <!-- Toast Notifications (available on all pages) -->
      <app-toast></app-toast>
    </mat-sidenav-container>

    <!-- Cookie Consent Banner (GDPR / Israeli Privacy Law compliant) -->
    <div class="cookie-banner" *ngIf="showCookieBanner && !isPortalRoute" role="dialog" aria-label="העדפות עוגיות">
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

    <app-whatsapp-cta
      *ngIf="!isLoginOrAdminPage && !isPortalRoute"
      variant="fab"
      ctaLocation="global_fab"
    ></app-whatsapp-cta>
    </div>
  `,
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  private languageService = inject(LanguageService);
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);
  private analyticsService = inject(AnalyticsService);
  private metaPixelService = inject(MetaPixelService);
  private authService = inject(AuthService);

  // Content direction property (NOT document direction)
  textDir: 'rtl' | 'ltr' = 'rtl';
  isLoginOrAdminPage = false;
  isPortalRoute = false;
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

    this.analyticsService.initializeAnalytics();
    this.metaPixelService.initializePixel();

    // Check if current route is login or admin
    this.updatePageVisibility();

    // Listen to route changes
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
        this.updatePageVisibility();
        this.enforceInstitutionPortalOnly();
      });

    this.authService.sessionInitDone$
      .pipe(filter((done) => done), take(1))
      .subscribe(() => this.enforceInstitutionPortalOnly());
  }

  private enforceInstitutionPortalOnly(): void {
    const user = this.authService.currentUser;
    if (user?.role !== 'institution') return;
    const url = this.router.url;
    if (isInstitutionAllowedPath(url)) return;
    this.router.navigate(['/portal']);
  }

  private updatePageVisibility(): void {
    const url = this.router.url.split('?')[0];
    this.isPortalRoute = url.startsWith('/portal');
    // Hide header/footer on admin, portal, and special app pages; show on login and register
    this.isLoginOrAdminPage =
      url.startsWith('/admin') ||
      url.startsWith('/time-clock') ||
      url.startsWith('/employee-login') ||
      url.startsWith('/my-zone');
  }

  acceptAll(): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('cookieConsent', 'all');
    }
    this.showCookieBanner = false;
    this.analyticsService.initializeAnalytics();
    this.metaPixelService.initializePixel();
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
