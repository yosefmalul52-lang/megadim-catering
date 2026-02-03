import { Component, OnInit, inject, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatBadgeModule } from '@angular/material/badge';
import { MatSidenavModule, MatSidenav } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { LanguageService } from '../../../services/language.service';
import { CartService } from '../../../services/cart.service';
import { SearchService } from '../../../services/search.service';
import { AuthService } from '../../../services/auth.service';
import { AuthModalService } from '../../../services/auth-modal.service';
import { SiteSettingsService, SiteSettings } from '../../../services/site-settings.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatBadgeModule,
    MatSidenavModule,
    MatListModule,
    TranslateModule
  ],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss']
})
export class HeaderComponent implements OnInit {
  @Input() sidenav?: MatSidenav;
  
  languageService = inject(LanguageService);
  translateService = inject(TranslateService);
  cartService = inject(CartService);
  searchService = inject(SearchService);
  authService = inject(AuthService);
  authModalService = inject(AuthModalService);
  settingsService = inject(SiteSettingsService);
  private router = inject(Router);
  
  settings: SiteSettings | null = null;
  isUserMenuOpen = false;
  isSearchOpen = false;
  currentUser = this.authService.currentUser;
  cartSummary = this.cartService.cartSummary;
  currentLanguage = 'he';

  get isLoggedIn(): boolean {
    return this.authService.isLoggedIn();
  }

  ngOnInit(): void {
    // Set default language for TranslateService
    this.translateService.setDefaultLang('he');
    this.translateService.use('he');
    
    // Subscribe to language changes
    this.languageService.currentLanguage$.subscribe(lang => {
      this.currentLanguage = lang;
      this.translateService.use(lang);
    });
    
    // Initial language check
    this.currentLanguage = this.languageService.currentLanguage;
    this.translateService.use(this.currentLanguage);
    
    // Subscribe to search state
    this.searchService.isSearchOpen$.subscribe(isOpen => {
      this.isSearchOpen = isOpen;
    });
    
    // Subscribe to auth state
    this.authService.currentUser$.subscribe((user: any) => {
      this.currentUser = user;
    });
    
    // Subscribe to cart changes
    this.cartService.cartItems$.subscribe(() => {
      this.cartSummary = this.cartService.cartSummary;
    });
    
    // Fetch site settings
    this.settingsService.getSettings().subscribe(settings => {
      this.settings = settings;
    });
  }

  get contactPhone(): string {
    return this.settings?.contactPhone || '052-8240230';
  }

  onSearchClick(): void {
    this.searchService.toggleSearch();
  }

  onCartClick(): void {
    this.cartService.toggleCart();
  }

  onUserClick(): void {
    if (this.isLoggedIn) {
      const user = this.currentUser;
      if (user?.role === 'admin') {
        this.router.navigate(['/admin']);
      } else {
        this.router.navigate(['/my-orders']);
      }
    } else {
      this.authModalService.openModal();
    }
  }

  onLanguageToggle(): void {
    this.languageService.toggleLanguage();
  }

  toggleLanguage(): void {
    const current = this.translateService.currentLang || 'he';
    const target = current === 'he' ? 'en' : 'he';
    
    // Update TranslateService
    this.translateService.use(target);
    
    // Update LanguageService (for direction and other logic)
    this.languageService.setLanguage(target as 'he' | 'en');
    
    // Update currentLanguage immediately for UI
    this.currentLanguage = target;
    
    // Update lang attribute only, NOT dir (html stays ltr for scrollbar)
    document.documentElement.lang = target;
    
    // Save preference to localStorage
    localStorage.setItem('preferredLanguage', target);
  }
}

