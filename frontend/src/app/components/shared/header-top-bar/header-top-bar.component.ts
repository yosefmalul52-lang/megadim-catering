import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';

import { LanguageService } from '../../../services/language.service';
import { CartService } from '../../../services/cart.service';
import { SearchService } from '../../../services/search.service';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-header-top-bar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="header-top-bar">
      <div class="container">
        <div class="top-bar-content">
          <!-- Left side: Social Media and Language -->
          <div class="left-section">
            <div class="social-icons">
              <a 
                href="tel:0528240230" 
                class="social-icon phone-icon"
                [attr.aria-label]="'התקשרו למספר ' + languageService.strings.phoneNumber"
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
          
          <!-- Center: Phone Number -->
          <div class="center-section">
            <div class="phone-section">
              <span class="phone-text">להזמנות התקשרו - 0528240230</span>
            </div>
          </div>
          
          <!-- Right side: Action Icons only -->
          <div class="right-section">
            <!-- Action Icons -->
            <div class="action-icons">
              <!-- Search Icon -->
              <button 
                class="icon-btn search-btn"
                (click)="searchService.toggleSearch()"
                [attr.aria-label]="languageService.strings.search"
                [class.active]="isSearchOpen"
              >
                <i class="fas fa-search" aria-hidden="true"></i>
              </button>
              
              <!-- Cart Icon -->
              <button 
                class="icon-btn cart-btn"
                (click)="cartService.toggleCart()"
                [attr.aria-label]="languageService.strings.cart"
              >
                <i class="fas fa-shopping-cart" aria-hidden="true"></i>
                <span 
                  class="cart-badge" 
                  *ngIf="cartSummary.totalItems > 0"
                  [attr.aria-label]="'סה כ פריטים בעגלה: ' + cartSummary.totalItems"
                >
                  {{ cartSummary.totalItems }}
                </span>
              </button>
              
              <!-- User Menu -->
              <div class="user-menu" [class.open]="isUserMenuOpen">
                <button 
                  class="icon-btn user-btn"
                  (click)="onUserIconClick()"
                  [class.text-primary]="isLoggedIn"
                  [title]="isLoggedIn ? (currentUser?.role === 'admin' ? 'עבור ללוח בקרה' : 'ההזמנות שלי') : 'התחבר/הירשם'"
                  [attr.aria-label]="isLoggedIn ? (currentUser?.role === 'admin' ? 'עבור ללוח בקרה' : 'ההזמנות שלי') : 'התחבר או הירשם'"
                  style="cursor: pointer"
                >
                  <i class="fas fa-user" aria-hidden="true"></i>
                </button>
                
                <!-- User Dropdown -->
                <div class="user-dropdown" *ngIf="isUserMenuOpen">
                  <div *ngIf="!currentUser; else loggedInMenu">
                    <a routerLink="/login" class="dropdown-item" (click)="closeUserMenu()">
                      <i class="fas fa-sign-in-alt" aria-hidden="true"></i>
                      {{ languageService.strings.login }}
                    </a>
                    <a routerLink="/register" class="dropdown-item" (click)="closeUserMenu()">
                      <i class="fas fa-user-plus" aria-hidden="true"></i>
                      {{ languageService.strings.register }}
                    </a>
                  </div>
                  
                  <ng-template #loggedInMenu>
                    <div class="user-info">
                      <span class="user-name">{{ currentUser?.fullName || currentUser?.name || currentUser?.username }}</span>
                      <span class="user-role" *ngIf="currentUser?.role === 'admin'">מנהל</span>
                      <span class="user-role" *ngIf="currentUser?.role === 'user'">לקוח</span>
                    </div>
                    <hr>
                    <a 
                      routerLink="/admin" 
                      class="dropdown-item" 
                      *ngIf="currentUser?.role === 'admin'"
                      (click)="closeUserMenu()"
                    >
                      <i class="fas fa-cog" aria-hidden="true"></i>
                      לוח בקרה
                    </a>
                    <a 
                      routerLink="/my-orders" 
                      class="dropdown-item" 
                      *ngIf="currentUser?.role === 'user'"
                      (click)="closeUserMenu()"
                    >
                      <i class="fas fa-shopping-bag" aria-hidden="true"></i>
                      ההזמנות שלי
                    </a>
                    <button class="dropdown-item logout-btn" (click)="logout()">
                      <i class="fas fa-sign-out-alt" aria-hidden="true"></i>
                      התנתקות
                    </button>
                  </ng-template>
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
  private router = inject(Router);
  
  isUserMenuOpen = false;
  isSearchOpen = false;
  currentLanguage = 'he';
  currentUser = this.authService.currentUser;
  cartSummary = this.cartService.cartSummary;

  // Getter for logged in status
  get isLoggedIn(): boolean {
    return this.authService.isLoggedIn();
  }

  ngOnInit(): void {
    // Subscribe to language changes
    this.languageService.currentLanguage$.subscribe(lang => {
      this.currentLanguage = lang;
    });
    
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
  }

  onUserIconClick(): void {
    if (this.isLoggedIn) {
      // Check user role
      const user = this.currentUser;
      if (user?.role === 'admin') {
        // Admin -> go to admin dashboard
        this.router.navigate(['/admin']);
      } else {
        // Regular user -> go to my orders
        this.router.navigate(['/my-orders']);
      }
    } else {
      // Guest -> go to unified login/signup page
      this.router.navigate(['/login']);
    }
  }

  toggleUserMenu(): void {
    this.isUserMenuOpen = !this.isUserMenuOpen;
  }

  closeUserMenu(): void {
    this.isUserMenuOpen = false;
  }

  logout(): void {
    this.authService.logout();
    this.closeUserMenu();
  }
}
