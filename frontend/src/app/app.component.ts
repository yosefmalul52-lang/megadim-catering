import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

import { HeaderTopBarComponent } from './components/shared/header-top-bar/header-top-bar.component';
import { MainNavbarComponent } from './components/shared/main-navbar/main-navbar.component';
import { SearchBarComponent } from './components/shared/search-bar/search-bar.component';
import { CartModalComponent } from './components/shared/cart-modal/cart-modal.component';
import { FooterComponent } from './components/shared/footer/footer.component';
import { ChatWidgetComponent } from './components/chat-widget/chat-widget.component';
import { AuthModalComponent } from './components/shared/auth-modal/auth-modal.component';
import { ToastComponent } from './components/shared/toast/toast.component';

import { LanguageService } from './services/language.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    HeaderTopBarComponent,
    MainNavbarComponent,
    SearchBarComponent,
    CartModalComponent,
    FooterComponent,
    ChatWidgetComponent,
    AuthModalComponent,
    ToastComponent
  ],
  template: `
    <div class="app-container" [attr.dir]="currentDirection">
      <!-- Header Top Bar (hidden on login/admin pages) -->
      <app-header-top-bar *ngIf="!isLoginOrAdminPage"></app-header-top-bar>
      
      <!-- Main Navigation (hidden on login/admin pages) -->
      <app-main-navbar *ngIf="!isLoginOrAdminPage"></app-main-navbar>
      
      <!-- Search Bar (shown conditionally, hidden on login/admin pages) -->
      <app-search-bar *ngIf="!isLoginOrAdminPage"></app-search-bar>
      
      <!-- Main Content -->
      <main class="main-content" [class.full-screen]="isLoginOrAdminPage">
        <router-outlet></router-outlet>
      </main>
      
      <!-- Footer (hidden on login/admin pages) -->
      <app-footer *ngIf="!isLoginOrAdminPage"></app-footer>
      
      <!-- Cart Modal (hidden on login/admin pages) -->
      <app-cart-modal *ngIf="!isLoginOrAdminPage"></app-cart-modal>
      
      <!-- Floating Chat Widget (hidden on login/admin pages) -->
      <app-chat-widget *ngIf="!isLoginOrAdminPage"></app-chat-widget>
      
      <!-- Auth Modal (available on all pages) -->
      <app-auth-modal></app-auth-modal>
      
      <!-- Toast Notifications (available on all pages) -->
      <app-toast></app-toast>
    </div>
  `,
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  private languageService = inject(LanguageService);
  private router = inject(Router);
  
  currentDirection: 'rtl' | 'ltr' = 'rtl';
  isLoginOrAdminPage = false;

  ngOnInit(): void {
    // Subscribe to language changes to update direction
    this.languageService.currentLanguage$.subscribe(lang => {
      this.currentDirection = lang === 'he' ? 'rtl' : 'ltr';
      document.documentElement.setAttribute('dir', this.currentDirection);
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
    this.isLoginOrAdminPage = url.startsWith('/login') || url.startsWith('/admin');
  }
}
