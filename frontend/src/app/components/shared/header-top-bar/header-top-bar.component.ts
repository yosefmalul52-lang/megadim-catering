import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { LanguageService } from '../../../services/language.service';
import { CONTACT_PHONE_DISPLAY, CONTACT_TEL_HREF } from '../../../constants/contact.constants';
import { CartService } from '../../../services/cart.service';
import { SearchService } from '../../../services/search.service';
import { AuthService } from '../../../services/auth.service';
import { ToastService } from '../../../services/toast.service';

@Component({
  selector: 'app-header-top-bar',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule],
  template: `
    <div class="header-top-bar">
      <div class="container">
        <div class="top-bar-content">
          <!-- Left side: Social Media and Language -->
          <div class="left-section">
            <div class="social-icons">
              <a 
                [href]="contactTelHref" 
                class="social-icon phone-icon"
                [attr.aria-label]="'התקשרו למספר ' + contactPhoneDisplay"
              >
                <i class="fas fa-phone" aria-hidden="true"></i>
              </a>
              <a 
                href="https://instagram.com/magadim" 
                target="_blank"
                rel="noopener noreferrer"
                class="social-icon instagram-icon"
                aria-label="עקבו אחרינו באינסטגרם"
              >
                <i class="fab fa-instagram" aria-hidden="true"></i>
              </a>
              <a 
                href="https://facebook.com/magadim" 
                target="_blank"
                rel="noopener noreferrer"
                class="social-icon facebook-icon"
                aria-label="עקבו אחרינו בפייסבוק"
              >
                <i class="fab fa-facebook-f" aria-hidden="true"></i>
              </a>
            </div>
            
            <!-- Language Toggle -->
            <button 
              class="language-toggle"
              (click)="languageService.toggleLanguage()"
              [attr.aria-label]="'החלף שפה ל' + (currentLanguage === 'he' ? 'אנגלית' : 'עברית')"
            >
              {{ currentLanguage === 'he' ? 'EN' : 'HE' }}
            </button>
          </div>
          
          <!-- Center: Phone Number (click-to-call) -->
          <div class="center-section">
            <div class="phone-section">
              <a class="phone-text" [href]="contactTelHref">
                להזמנות התקשרו - {{ contactPhoneDisplay }}
              </a>
            </div>
          </div>
          
          <!-- Right side: Action Icons -->
          <div class="right-section">
            <div class="action-icons">
              <button 
                class="icon-btn search-btn"
                (click)="searchService.toggleSearch()"
                [attr.aria-label]="languageService.strings.search"
                [class.active]="isSearchOpen"
              >
                <i class="fas fa-search" aria-hidden="true"></i>
              </button>
              
              <button 
                class="icon-btn cart-btn"
                (click)="cartService.toggleCart()"
                [attr.aria-label]="languageService.strings.cart"
              >
                <i class="fas fa-shopping-cart" aria-hidden="true"></i>
                <span 
                  class="cart-badge" 
                  *ngIf="cartSummary.totalItems > 0"
                  [attr.aria-label]="'סה״כ פריטים בעגלה: ' + cartSummary.totalItems"
                >
                  {{ cartSummary.totalItems }}
                </span>
              </button>
              
              <!-- User Menu: hover dropdown + icon link (wrapper contains both for no hover gap) -->
              <div 
                class="user-menu user-menu-wrapper" 
                [class.user-menu-closed]="!isUserMenuOpen"
                (mouseenter)="onUserMenuEnter()" 
                (mouseleave)="onUserMenuLeave()"
                [class.open]="isUserMenuOpen"
              >
                @if (isLoggedIn$ | async; as loggedIn) {
                  <a 
                    [routerLink]="profileLink" 
                    class="icon-btn user-btn user-icon-link"
                    [attr.aria-label]="currentUser?.role === 'admin' ? 'לוח בקרה' : 'האזור האישי'"
                  >
                    <i class="fas fa-user" aria-hidden="true" style="color: #c5a059;"></i>
                  </a>
                } @else {
                  <a 
                    routerLink="/login" 
                    class="icon-btn user-btn user-icon-link"
                    aria-label="התחבר"
                  >
                    <i class="fas fa-user" aria-hidden="true"></i>
                  </a>
                }
                
                <div class="user-dropdown">
                  @if (!currentUser) {
                    <div class="dropdown-login">
                      <form [formGroup]="loginForm" (ngSubmit)="onDropdownLogin()" class="dropdown-login-form">
                        <input
                          type="email"
                          formControlName="username"
                          class="dropdown-input"
                          placeholder="אימייל"
                          autocomplete="username"
                        >
                        <input
                          [type]="showPassword ? 'text' : 'password'"
                          formControlName="password"
                          class="dropdown-input"
                          placeholder="סיסמה"
                          autocomplete="current-password"
                        >
                        <p class="dropdown-login-error" *ngIf="loginError">{{ loginError }}</p>
                        <button type="submit" class="dropdown-btn dropdown-btn-primary" [disabled]="loginForm.invalid || isLoadingLogin">
                          {{ isLoadingLogin ? 'מתחבר...' : 'התחבר' }}
                        </button>
                        <a routerLink="/login" class="dropdown-link forgot-link">שכחת סיסמה?</a>
                      </form>
                      <div class="dropdown-register">
                        <a routerLink="/register" class="dropdown-link register-link">הרשמה</a>
                      </div>
                    </div>
                  } @else {
                    <div class="dropdown-logged-in">
                      <p class="dropdown-greeting">שלום, {{ currentUser?.fullName || currentUser?.name || currentUser?.username || 'משתמש' }}</p>
                      <a routerLink="/profile" class="dropdown-item" (click)="closeUserMenu()">
                        <i class="fas fa-user" aria-hidden="true"></i>
                        הפרופיל שלי
                      </a>
                      <a routerLink="/my-orders" class="dropdown-item" (click)="closeUserMenu()">
                        <i class="fas fa-shopping-bag" aria-hidden="true"></i>
                        ההזמנות שלי
                      </a>
                      <a routerLink="/admin" class="dropdown-item" *ngIf="currentUser?.role === 'admin'" (click)="closeUserMenu()">
                        <i class="fas fa-cog" aria-hidden="true"></i>
                        לוח בקרה
                      </a>
                      <button type="button" class="dropdown-item logout-btn" (click)="logout()">
                        <i class="fas fa-sign-out-alt" aria-hidden="true"></i>
                        התנתק
                      </button>
                    </div>
                  }
                </div>
              </div>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./header-top-bar.component.scss']
})
export class HeaderTopBarComponent implements OnInit {
  languageService = inject(LanguageService);
  cartService = inject(CartService);
  searchService = inject(SearchService);
  authService = inject(AuthService);
  toastService = inject(ToastService);
  private fb = inject(FormBuilder);
  private router = inject(Router);

  readonly contactPhoneDisplay = CONTACT_PHONE_DISPLAY;
  readonly contactTelHref = CONTACT_TEL_HREF;

  isUserMenuOpen = false;
  private userMenuCloseTimeout: ReturnType<typeof setTimeout> | null = null;
  isSearchOpen = false;
  currentLanguage = 'he';
  currentUser = this.authService.currentUser;
  cartSummary = this.cartService.cartSummary;
  loginForm!: FormGroup;
  loginError = '';
  isLoadingLogin = false;
  showPassword = false;

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
    this.languageService.currentLanguage$.subscribe(lang => {
      this.currentLanguage = lang;
    });
    this.searchService.isSearchOpen$.subscribe(isOpen => {
      this.isSearchOpen = isOpen;
    });
    this.authService.currentUser$.subscribe((user: any) => {
      this.currentUser = user;
    });
    this.cartService.cartItems$.subscribe(() => {
      this.cartSummary = this.cartService.cartSummary;
    });
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
