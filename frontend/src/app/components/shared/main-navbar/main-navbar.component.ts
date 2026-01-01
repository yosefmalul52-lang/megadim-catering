import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';

import { LanguageService } from '../../../services/language.service';
import { AuthService, User } from '../../../services/auth.service';

@Component({
  selector: 'app-main-navbar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <nav class="main-navbar">
      <div class="container">
        <div class="navbar-content">
          <!-- Logo -->
          <div class="logo-section">
            <a routerLink="/" class="logo" [attr.aria-label]="'חזרה לדף הבית - ' + languageService.strings.heroTitle">
              <span class="logo-text">{{ languageService.strings.heroTitle }}</span>
            </a>
          </div>
          
          <!-- Desktop Navigation Menu -->
          <div class="nav-menu desktop-menu">
            <ul class="nav-list">
              <li class="nav-item">
                <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}" class="nav-link">
                  {{ languageService.strings.home }}
                </a>
              </li>
              
              <li class="nav-item">
                <a routerLink="/about" routerLinkActive="active" class="nav-link">
                  {{ languageService.strings.about }}
                </a>
              </li>
              
              <li class="nav-item">
                <a routerLink="/events-catering" routerLinkActive="active" class="nav-link">
                  {{ languageService.strings.eventsCatering }}
                </a>
              </li>
              
              <!-- Ready for Shabbat Dropdown -->
              <li class="nav-item dropdown" [class.open]="isShabbatDropdownOpen">
                <button 
                  class="nav-link dropdown-toggle"
                  (click)="toggleShabbatDropdown()"
                  [attr.aria-expanded]="isShabbatDropdownOpen"
                  aria-haspopup="true"
                >
                  {{ languageService.strings.readyForShabbat }}
                  <i class="fas fa-chevron-down dropdown-icon" [class.rotated]="isShabbatDropdownOpen"></i>
                </button>
                
                <ul class="dropdown-menu" *ngIf="isShabbatDropdownOpen">
                  <li>
                    <a routerLink="/ready-for-shabbat/main-dishes" class="dropdown-link" (click)="closeDropdowns()">
                      {{ languageService.strings.mainDishes }}
                    </a>
                  </li>
                  <li>
                    <a routerLink="/ready-for-shabbat/sides" class="dropdown-link" (click)="closeDropdowns()">
                      {{ languageService.strings.sides }}
                    </a>
                  </li>
                  <li>
                    <a routerLink="/ready-for-shabbat/salads" class="dropdown-link" (click)="closeDropdowns()">
                      {{ languageService.strings.salads }}
                    </a>
                  </li>
                  <li>
                    <a routerLink="/ready-for-shabbat/desserts" class="dropdown-link" (click)="closeDropdowns()">
                      {{ languageService.strings.desserts }}
                    </a>
                  </li>
                  <li>
                    <a routerLink="/ready-for-shabbat/fish" class="dropdown-link" (click)="closeDropdowns()">
                      דגים
                    </a>
                  </li>
                </ul>
              </li>
              
              <li class="nav-item">
                <a routerLink="/cholent-bar" routerLinkActive="active" class="nav-link">
                  {{ languageService.strings.cholentBar }}
                </a>
              </li>
              
              <li class="nav-item">
                <a routerLink="/holiday-food" routerLinkActive="active" class="nav-link">
                  {{ languageService.strings.holidayFood }}
                </a>
              </li>
              
              <li class="nav-item">
                <a routerLink="/kosher" routerLinkActive="active" class="nav-link">
                  {{ languageService.strings.kosherCertificate }}
                </a>
              </li>
              
              <li class="nav-item">
                <a routerLink="/contact" routerLinkActive="active" class="nav-link">
                  {{ languageService.strings.contact }}
                </a>
              </li>
              
              <!-- Admin Link (only when logged in as admin) -->
              <li class="nav-item" *ngIf="isLoggedIn && currentUser?.role === 'admin'">
                <a routerLink="/admin" routerLinkActive="active" class="nav-link admin-link">
                  <i class="fas fa-cog" aria-hidden="true"></i>
                  <span>ניהול</span>
                </a>
              </li>
              
              <!-- My Orders Link (only when logged in as regular user) -->
              <li class="nav-item" *ngIf="isLoggedIn && currentUser?.role !== 'admin'">
                <a routerLink="/my-orders" routerLinkActive="active" class="nav-link">
                  <i class="fas fa-shopping-bag" aria-hidden="true"></i>
                  <span>הזמנות שלי</span>
                </a>
              </li>
            </ul>
          </div>
          
          <!-- Mobile Menu Toggle -->
          <button 
            class="mobile-menu-toggle"
            (click)="toggleMobileMenu()"
            [attr.aria-expanded]="isMobileMenuOpen"
            [attr.aria-label]="isMobileMenuOpen ? 'סגור תפריט' : 'פתח תפריט'"
          >
            <span class="hamburger-line" [class.active]="isMobileMenuOpen"></span>
            <span class="hamburger-line" [class.active]="isMobileMenuOpen"></span>
            <span class="hamburger-line" [class.active]="isMobileMenuOpen"></span>
          </button>
        </div>
        
        <!-- Mobile Navigation Menu -->
        <div class="mobile-menu" [class.open]="isMobileMenuOpen">
          <ul class="mobile-nav-list">
            <li class="mobile-nav-item">
              <a routerLink="/" class="mobile-nav-link" (click)="closeMobileMenu()">
                {{ languageService.strings.home }}
              </a>
            </li>
            
            <li class="mobile-nav-item">
              <a routerLink="/about" class="mobile-nav-link" (click)="closeMobileMenu()">
                {{ languageService.strings.about }}
              </a>
            </li>
            
            <li class="mobile-nav-item">
              <a routerLink="/events-catering" class="mobile-nav-link" (click)="closeMobileMenu()">
                {{ languageService.strings.eventsCatering }}
              </a>
            </li>
            
            <!-- Mobile Shabbat Menu -->
            <li class="mobile-nav-item mobile-dropdown" [class.open]="isMobileShabbatDropdownOpen">
              <button 
                class="mobile-nav-link dropdown-toggle"
                (click)="toggleMobileShabbatDropdown()"
                [attr.aria-expanded]="isMobileShabbatDropdownOpen"
              >
                {{ languageService.strings.readyForShabbat }}
                <i class="fas fa-chevron-down dropdown-icon" [class.rotated]="isMobileShabbatDropdownOpen"></i>
              </button>
              
              <ul class="mobile-dropdown-menu" *ngIf="isMobileShabbatDropdownOpen">
                <li>
                  <a routerLink="/ready-for-shabbat/main-dishes" class="mobile-dropdown-link" (click)="closeMobileMenu()">
                    {{ languageService.strings.mainDishes }}
                  </a>
                </li>
                <li>
                  <a routerLink="/ready-for-shabbat/sides" class="mobile-dropdown-link" (click)="closeMobileMenu()">
                    {{ languageService.strings.sides }}
                  </a>
                </li>
                <li>
                  <a routerLink="/ready-for-shabbat/salads" class="mobile-dropdown-link" (click)="closeMobileMenu()">
                    {{ languageService.strings.salads }}
                  </a>
                </li>
                <li>
                  <a routerLink="/ready-for-shabbat/desserts" class="mobile-dropdown-link" (click)="closeMobileMenu()">
                    {{ languageService.strings.desserts }}
                  </a>
                </li>
                <li>
                  <a routerLink="/ready-for-shabbat/fish" class="mobile-dropdown-link" (click)="closeMobileMenu()">
                    דגים
                  </a>
                </li>
              </ul>
            </li>
            
            <li class="mobile-nav-item">
              <a routerLink="/cholent-bar" class="mobile-nav-link" (click)="closeMobileMenu()">
                {{ languageService.strings.cholentBar }}
              </a>
            </li>
            
            <li class="mobile-nav-item">
              <a routerLink="/holiday-food" class="mobile-nav-link" (click)="closeMobileMenu()">
                {{ languageService.strings.holidayFood }}
              </a>
            </li>
            
            <li class="mobile-nav-item">
              <a routerLink="/kosher" class="mobile-nav-link" (click)="closeMobileMenu()">
                {{ languageService.strings.kosherCertificate }}
              </a>
            </li>
            
            <li class="mobile-nav-item">
              <a routerLink="/contact" class="mobile-nav-link" (click)="closeMobileMenu()">
                {{ languageService.strings.contact }}
              </a>
            </li>
            
            <!-- Admin Link (Mobile - only when logged in as admin) -->
            <li class="mobile-nav-item" *ngIf="isLoggedIn && currentUser?.role === 'admin'">
              <a routerLink="/admin" class="mobile-nav-link admin-link" (click)="closeMobileMenu()">
                <i class="fas fa-cog" aria-hidden="true"></i>
                <span>ניהול</span>
              </a>
            </li>
            
            <!-- My Orders Link (Mobile - only when logged in as regular user) -->
            <li class="mobile-nav-item" *ngIf="isLoggedIn && currentUser?.role !== 'admin'">
              <a routerLink="/my-orders" class="mobile-nav-link" (click)="closeMobileMenu()">
                <i class="fas fa-shopping-bag" aria-hidden="true"></i>
                <span>הזמנות שלי</span>
              </a>
            </li>
          </ul>
        </div>
      </div>
    </nav>
  `,
  styleUrls: ['./main-navbar.component.scss']
})
export class MainNavbarComponent implements OnInit, OnDestroy {
  languageService = inject(LanguageService);
  authService = inject(AuthService);
  private destroy$ = new Subject<void>();
  
  isShabbatDropdownOpen = false;
  isMobileMenuOpen = false;
  isMobileShabbatDropdownOpen = false;
  
  isLoggedIn = false;
  currentUser: User | null = null;
  userName = '';

  toggleShabbatDropdown(): void {
    this.isShabbatDropdownOpen = !this.isShabbatDropdownOpen;
  }

  toggleMobileMenu(): void {
    this.isMobileMenuOpen = !this.isMobileMenuOpen;
    if (this.isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      this.isMobileShabbatDropdownOpen = false;
    }
  }

  toggleMobileShabbatDropdown(): void {
    this.isMobileShabbatDropdownOpen = !this.isMobileShabbatDropdownOpen;
  }

  closeDropdowns(): void {
    this.isShabbatDropdownOpen = false;
  }

  closeMobileMenu(): void {
    this.isMobileMenuOpen = false;
    this.isMobileShabbatDropdownOpen = false;
    document.body.style.overflow = '';
  }

  ngOnInit(): void {
    // Subscribe to auth state
    this.authService.isLoggedIn$
      .pipe(takeUntil(this.destroy$))
      .subscribe(isLoggedIn => {
        this.isLoggedIn = isLoggedIn;
        this.updateUserName();
      });

    this.authService.currentUser$
      .pipe(takeUntil(this.destroy$))
      .subscribe(user => {
        this.currentUser = user;
        this.updateUserName();
        // Debug: Log current user role
        console.log('🔍 MainNavbar - Current User Role:', user?.role);
        console.log('🔍 MainNavbar - Is Logged In:', this.isLoggedIn);
        console.log('🔍 MainNavbar - Full User Object:', user);
      });

    // Initial check
    this.isLoggedIn = this.authService.isLoggedIn();
    this.currentUser = this.authService.currentUser;
    this.updateUserName();
    
    // Debug: Log initial state
    console.log('🔍 MainNavbar - Initial User Role:', this.currentUser?.role);
    console.log('🔍 MainNavbar - Initial Is Logged In:', this.isLoggedIn);

    // Close dropdowns when clicking outside
    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.dropdown') && !target.closest('.mobile-dropdown')) {
        this.closeDropdowns();
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  updateUserName(): void {
    if (this.currentUser) {
      this.userName = this.currentUser.fullName || this.currentUser.username || 'משתמש';
    } else {
      this.userName = '';
    }
  }

}
