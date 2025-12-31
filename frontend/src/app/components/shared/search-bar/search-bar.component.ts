import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';

import { SearchService, SearchResult } from '../../../services/search.service';
import { LanguageService } from '../../../services/language.service';

@Component({
  selector: 'app-search-bar',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="search-overlay" [class.open]="isSearchOpen" (click)="closeSearch()">
      <div class="search-container" (click)="$event.stopPropagation()">
        <div class="search-header">
          <div class="search-input-wrapper">
            <i class="fas fa-search search-icon" aria-hidden="true"></i>
            <input
              #searchInput
              type="text"
              class="search-input"
              [(ngModel)]="searchQuery"
              (input)="onSearchInput($event)"
              [placeholder]="languageService.strings.search + '...'"
              [attr.aria-label]="languageService.strings.search"
              autocomplete="off"
            >
            <button
              class="clear-search-btn"
              *ngIf="searchQuery"
              (click)="clearSearch()"
              [attr.aria-label]="'נקה חיפוש'"
            >
              <i class="fas fa-times" aria-hidden="true"></i>
            </button>
          </div>
          
          <button
            class="close-search-btn"
            (click)="closeSearch()"
            [attr.aria-label]="languageService.strings.close"
          >
            <i class="fas fa-times" aria-hidden="true"></i>
          </button>
        </div>
        
        <div class="search-content" *ngIf="isSearchOpen">
          <!-- Loading State -->
          <div class="search-loading" *ngIf="isSearching">
            <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
            <span>{{ languageService.strings.loading }}</span>
          </div>
          
          <!-- Popular Searches (when no query) -->
          <div class="popular-searches" *ngIf="!searchQuery && !isSearching">
            <h3 class="section-title">חיפושים פופולריים</h3>
            <div class="popular-tags">
              <button
                *ngFor="let tag of popularSearches"
                class="popular-tag"
                (click)="searchQuery = tag; onSearchInput(null)"
                [attr.aria-label]="'חפש ' + tag"
              >
                {{ tag }}
              </button>
            </div>
          </div>
          
          <!-- Search Results -->
          <div class="search-results" *ngIf="searchResults.length > 0 && !isSearching">
            <h3 class="section-title">תוצאות חיפוש</h3>
            
            <!-- Dishes Results -->
            <div class="results-section" *ngIf="dishResults.length > 0">
              <h4 class="subsection-title">מנות</h4>
              <div class="results-list">
                <div
                  *ngFor="let result of dishResults"
                  class="result-item dish-result"
                  (click)="selectResult(result)"
                  tabindex="0"
                  role="button"
                  [attr.aria-label]="'בחר מנה: ' + result.name"
                  (keydown.enter)="selectResult(result)"
                  (keydown.space)="selectResult(result)"
                >
                  <div class="result-image">
                    <img
                      [src]="result.imageUrl || 'assets/images/placeholder-dish.jpg'"
                      [alt]="result.name"
                      loading="lazy"
                    >
                  </div>
                  <div class="result-content">
                    <h5 class="result-title">{{ result.name }}</h5>
                    <p class="result-description">{{ result.description }}</p>
                    <div class="result-meta">
                      <span class="result-category">{{ result.category }}</span>
                      <span class="result-price" *ngIf="result.price">₪{{ result.price }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- Pages Results -->
            <div class="results-section" *ngIf="pageResults.length > 0">
              <h4 class="subsection-title">דפים</h4>
              <div class="results-list">
                <a
                  *ngFor="let result of pageResults"
                  [routerLink]="result.route"
                  class="result-item page-result"
                  (click)="closeSearch()"
                  [attr.aria-label]="'עבור לדף: ' + result.name"
                >
                  <div class="result-icon">
                    <i 
                      class="fas"
                      [class.fa-home]="result.id === 'home'"
                      [class.fa-info-circle]="result.id === 'about'"
                      [class.fa-utensils]="result.id === 'events-catering'"
                      [class.fa-calendar]="result.id === 'ready-for-shabbat'"
                      [class.fa-fire]="result.id === 'cholent-bar'"
                      [class.fa-star]="result.id === 'holiday-food'"
                      [class.fa-certificate]="result.id === 'kosher-certificate'"
                      [class.fa-envelope]="result.id === 'contact'"
                      [class.fa-list]="!['home', 'about', 'events-catering', 'ready-for-shabbat', 'cholent-bar', 'holiday-food', 'kosher-certificate', 'contact'].includes(result.id)"
                      aria-hidden="true"
                    ></i>
                  </div>
                  <div class="result-content">
                    <h5 class="result-title">{{ result.name }}</h5>
                    <p class="result-description">{{ result.description }}</p>
                  </div>
                </a>
              </div>
            </div>
          </div>
          
          <!-- No Results -->
          <div class="no-results" *ngIf="searchQuery && searchResults.length === 0 && !isSearching">
            <i class="fas fa-search" aria-hidden="true"></i>
            <h3>לא נמצאו תוצאות</h3>
            <p>נסה חיפוש אחר או עיין בתפריט המלא</p>
            <button class="btn btn-primary" routerLink="/ready-for-shabbat" (click)="closeSearch()">
              עיין בתפריט
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./search-bar.component.scss']
})
export class SearchBarComponent implements OnInit, OnDestroy {
  searchService = inject(SearchService);
  languageService = inject(LanguageService);
  
  private destroy$ = new Subject<void>();
  
  isSearchOpen = false;
  isSearching = false;
  searchQuery = '';
  searchResults: SearchResult[] = [];
  popularSearches: string[] = [];

  get dishResults(): SearchResult[] {
    return this.searchResults.filter(result => result.type === 'dish');
  }

  get pageResults(): SearchResult[] {
    return this.searchResults.filter(result => result.type === 'page' || result.type === 'category');
  }

  ngOnInit(): void {
    // Subscribe to search state
    this.searchService.isSearchOpen$
      .pipe(takeUntil(this.destroy$))
      .subscribe(isOpen => {
        this.isSearchOpen = isOpen;
        if (isOpen) {
          setTimeout(() => {
            const searchInput = document.querySelector('.search-input') as HTMLInputElement;
            if (searchInput) {
              searchInput.focus();
            }
          }, 100);
        }
      });
    
    // Subscribe to search results
    this.searchService.searchResults$
      .pipe(takeUntil(this.destroy$))
      .subscribe(results => {
        this.searchResults = results;
      });
    
    // Subscribe to searching state
    this.searchService.isSearching$
      .pipe(takeUntil(this.destroy$))
      .subscribe(isSearching => {
        this.isSearching = isSearching;
      });
    
    // Load popular searches
    this.popularSearches = this.searchService.getPopularSearches();
    
    // Close search on escape key
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.isSearchOpen) {
        this.closeSearch();
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onSearchInput(event: Event | null): void {
    if (event) {
      const target = event.target as HTMLInputElement;
      this.searchQuery = target.value;
    }
    
    this.searchService.search(this.searchQuery);
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.searchService.clearSearch();
  }

  closeSearch(): void {
    this.searchService.closeSearch();
    this.clearSearch();
  }

  selectResult(result: SearchResult): void {
    if (result.type === 'dish') {
      // For dish results, you might want to add to cart or navigate to menu
      console.log('Selected dish:', result);
      // TODO: Implement dish selection logic (e.g., add to cart modal)
    }
    this.closeSearch();
  }
}
