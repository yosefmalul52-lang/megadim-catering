import { Component, OnInit, inject, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatBadgeModule } from '@angular/material/badge';
import { MatSidenavModule, MatSidenav } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';

import { LanguageService } from '../../../services/language.service';
import { CartService } from '../../../services/cart.service';
import { SearchService } from '../../../services/search.service';
import { AuthService } from '../../../services/auth.service';
import { AuthModalService } from '../../../services/auth-modal.service';

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
    MatListModule
  ],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss']
})
export class HeaderComponent implements OnInit {
  @Input() sidenav?: MatSidenav;
  
  languageService = inject(LanguageService);
  cartService = inject(CartService);
  searchService = inject(SearchService);
  authService = inject(AuthService);
  authModalService = inject(AuthModalService);
  private router = inject(Router);
  
  isUserMenuOpen = false;
  isSearchOpen = false;
  currentUser = this.authService.currentUser;
  cartSummary = this.cartService.cartSummary;
  currentLanguage = 'he';

  get isLoggedIn(): boolean {
    return this.authService.isLoggedIn();
  }

  ngOnInit(): void {
    // Subscribe to language changes
    this.languageService.currentLanguage$.subscribe(lang => {
      this.currentLanguage = lang;
    });
    
    // Initial language check
    this.currentLanguage = this.languageService.currentLanguage;
    
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
}

