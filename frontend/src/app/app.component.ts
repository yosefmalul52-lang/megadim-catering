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
    RouterModule,
    MatSidenavModule,
    MatButtonModule,
    TranslateModule,
    HeaderComponent,
    SearchBarComponent,
    CartModalComponent,
    FooterComponent,
    ChatWidgetComponent,
    AuthModalComponent,
    ToastComponent
  ],
  template: `
    <div class="app-container" [dir]="textDir">
    <mat-sidenav-container class="mat-sidenav-wrapper" autosize>
      <mat-sidenav #sidenav mode="over" position="start" class="mobile-sidenav">
        <div class="sidenav-content">
          <button mat-button routerLink="/" (click)="sidenav.close()">{{ 'NAV.HOME' | translate }}</button>
          <button mat-button routerLink="/about" (click)="sidenav.close()">{{ 'NAV.ABOUT' | translate }}</button>
          <button mat-button routerLink="/events-catering" (click)="sidenav.close()">{{ 'NAV.CATERING' | translate }}</button>
          <button mat-button routerLink="/ready-for-shabbat" (click)="sidenav.close()">{{ 'NAV.READY_FOOD' | translate }}</button>
          <button mat-button routerLink="/cholent-bar" (click)="sidenav.close()">{{ 'NAV.CHOLENT' | translate }}</button>
          <button mat-button routerLink="/holiday-food" (click)="sidenav.close()">{{ 'NAV.KOSHER' | translate }}</button>
          <button mat-button routerLink="/kosher" (click)="sidenav.close()">{{ 'NAV.KOSHER' | translate }}</button>
          <button mat-button routerLink="/contact" (click)="sidenav.close()">{{ 'NAV.CONTACT' | translate }}</button>
        </div>
      </mat-sidenav>
      
      <!-- Header (3-Row Layout) (hidden on login/admin pages) -->
      <app-header *ngIf="!isLoginOrAdminPage" [sidenav]="sidenav"></app-header>
      
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
    </mat-sidenav-container>
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

  ngOnInit(): void {
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
    this.isLoginOrAdminPage = url.startsWith('/login') || url.startsWith('/admin') || url.startsWith('/time-clock') || url.startsWith('/employee-login') || url.startsWith('/my-zone');
  }
}
