import { Component, OnInit, inject, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
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
import { ToastService } from '../../../services/toast.service';
import { SiteSettingsService, SiteSettings } from '../../../services/site-settings.service';
import { MAIN_NAV_LINKS } from '../../../nav-links';
import { CONTACT_TEL_HREF } from '../../../constants/contact.constants';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
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
  toastService = inject(ToastService);
  settingsService = inject(SiteSettingsService);
  private fb = inject(FormBuilder);
  private router = inject(Router);
  
  navLinks = MAIN_NAV_LINKS;
  settings: SiteSettings | null = null;
  isUserMenuOpen = false;
  private userMenuCloseTimeout: ReturnType<typeof setTimeout> | null = null;
  isSearchOpen = false;
  currentUser = this.authService.currentUser;
  cartSummary = this.cartService.cartSummary;
  loginForm!: FormGroup;
  loginError = '';
  isLoadingLogin = false;
  isLoggedIn$: Observable<boolean> = this.authService.currentUser$.pipe(
    map(user => !!user)
  );

  get isLoggedIn(): boolean {
    return this.authService.isLoggedIn();
  }

  get profileLink(): string {
    return this.currentUser?.role === 'admin' ? '/admin' : '/profile';
  }

  ngOnInit(): void {
    this.loginForm = this.fb.group({
      username: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(3)]]
    });
    // Set fallback language (replaces deprecated setDefaultLang)
    this.translateService.setFallbackLang('he');
    this.translateService.use(this.languageService.currentLanguage);
    
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
    const p = this.settings?.contactPhone;
    if (!p) return '073-367-8399';
    if (p.replace(/\D/g, '') === '0528240230') return '073-367-8399';
    return p;
  }

  /** tel: href – from settings (normalized) or fallback. */
  get contactTelHref(): string {
    const p = this.settings?.contactPhone;
    if (!p) return CONTACT_TEL_HREF;
    const digits = p.replace(/\D/g, '');
    if (digits === '0528240230') return CONTACT_TEL_HREF;
    const e164 = digits.startsWith('0') ? '972' + digits.slice(1) : digits.startsWith('972') ? digits : '972' + digits;
    return 'tel:+' + e164;
  }

  onSearchClick(): void {
    this.searchService.toggleSearch();
  }

  onCartClick(): void {
    this.cartService.toggleCart();
  }

  onDropdownLogin(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }
    this.loginError = '';
    this.isLoadingLogin = true;
    this.authService.login({
      username: this.loginForm.value.username,
      password: this.loginForm.value.password
    }).subscribe({
      next: (res) => {
        if (res.success) {
          const name = res.user?.fullName || res.user?.username || 'משתמש';
          this.toastService.success(`ברוך הבא ${name}`);
          this.loginForm.reset();
          this.isUserMenuOpen = false;
        } else {
          this.loginError = res.message || 'שגיאה בהתחברות';
        }
        this.isLoadingLogin = false;
      },
      error: (err) => {
        this.loginError = err.error?.message || (err.status === 401 ? 'אימייל או סיסמה שגויים' : 'שגיאה בהתחברות');
        this.isLoadingLogin = false;
      }
    });
  }

  onUserMenuEnter(): void {
    if (this.userMenuCloseTimeout) {
      clearTimeout(this.userMenuCloseTimeout);
      this.userMenuCloseTimeout = null;
    }
    this.isUserMenuOpen = true;
  }

  onUserMenuLeave(): void {
    this.userMenuCloseTimeout = setTimeout(() => {
      this.isUserMenuOpen = false;
      this.userMenuCloseTimeout = null;
    }, 200);
  }

  closeUserMenu(): void {
    this.isUserMenuOpen = false;
  }

  logout(): void {
    this.authService.logout();
    this.closeUserMenu();
  }
}

