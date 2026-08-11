import { Component, inject, OnInit, OnDestroy, PLATFORM_ID } from '@angular/core';
import { CommonModule, DOCUMENT, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { Subject, takeUntil } from 'rxjs';

import { SearchService, SearchResult } from '../../../services/search.service';
import { LanguageService } from '../../../services/language.service';
import { LocaleService } from '../../../i18n/locale.service';
import { localizedProductName } from '../../../i18n/localized-content';

interface PopularTag {
  /** Hebrew query sent to search (kitchen / catalog terms). */
  query: string;
  /** Optional CATEGORIES.* key for display. */
  labelKey?: string;
}

@Component({
  selector: 'app-search-bar',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, TranslateModule],
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
              [attr.aria-label]="'SEARCH.CLEAR' | translate"
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
            <h3 class="section-title">{{ 'SEARCH.POPULAR' | translate }}</h3>
            <div class="popular-tags">
              <button
                *ngFor="let tag of popularTags"
                class="popular-tag"
                (click)="searchQuery = tag.query; onSearchInput(null)"
                [attr.aria-label]="tag.labelKey ? (tag.labelKey | translate) : tag.query"
              >
                {{ tag.labelKey ? (tag.labelKey | translate) : tag.query }}
              </button>
            </div>
          </div>
          
          <!-- Search Results -->
          <div class="search-results" *ngIf="searchResults.length > 0 && !isSearching">
            <h3 class="section-title">{{ 'SEARCH.RESULTS' | translate }}</h3>
            
            <!-- Dishes Results -->
            <div class="results-section" *ngIf="dishResults.length > 0">
              <h4 class="subsection-title">{{ 'SEARCH.DISHES' | translate }}</h4>
              <div class="results-list">
                <div
                  *ngFor="let result of dishResults"
                  class="result-item dish-result is-coming-soon"
                  tabindex="-1"
                  role="note"
                  [attr.title]="'SEARCH.COMING_SOON' | translate"
                  [attr.aria-label]="displayName(result) + ' - ' + ('SEARCH.COMING_SOON' | translate)"
                >
                  <div class="result-image">
                    <img
                      [src]="result.imageUrl || 'assets/images/placeholder-dish.jpg'"
                      [alt]="displayName(result)"
                      loading="lazy"
                    >
                  </div>
                  <div class="result-content">
                    <h5 class="result-title">{{ displayName(result) }}</h5>
                    <p class="result-description">{{ result.description }}</p>
                    <div class="result-meta">
                      <span class="result-category">{{ result.category }}</span>
                      <span class="result-price" *ngIf="result.price">₪{{ result.price }}</span>
                      <span class="coming-soon-chip">{{ 'SEARCH.COMING_SOON' | translate }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- Pages Results -->
            <div class="results-section" *ngIf="pageResults.length > 0">
              <h4 class="subsection-title">{{ 'SEARCH.RESULTS' | translate }}</h4>
              <div class="results-list">
                <a
                  *ngFor="let result of pageResults"
                  [routerLink]="localizedRoute(result.route)"
                  class="result-item page-result"
                  (click)="closeSearch()"
                  [attr.aria-label]="result.name"
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
            <h3>{{ 'SEARCH.NO_RESULTS' | translate }}</h3>
            <button
              class="btn btn-primary"
              [routerLink]="localeService.localizePath('/ready-for-shabbat')"
              (click)="closeSearch()"
            >
              {{ 'SEARCH.BROWSE_MENU' | translate }}
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
  readonly localeService = inject(LocaleService);
  private readonly doc = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);

  private destroy$ = new Subject<void>();
  private escapeKeydownBound = false;
  private readonly onDocumentKeydown = (event: Event): void => {
    const ke = event as KeyboardEvent;
    if (ke.key === 'Escape' && this.isSearchOpen) {
      this.closeSearch();
    }
  };
  
  isSearchOpen = false;
  isSearching = false;
  searchQuery = '';
  searchResults: SearchResult[] = [];

  readonly popularTags: PopularTag[] = [
    { query: 'חומוס' },
    { query: "צ'ולנט" },
    { query: 'סלטים', labelKey: 'CATEGORIES.SALADS' },
    { query: 'מנות עיקריות', labelKey: 'CATEGORIES.MAIN' },
    { query: 'ממולאים', labelKey: 'CATEGORIES.STUFFED' },
    { query: 'שבת' },
    { query: 'אירועים' }
  ];

  get dishResults(): SearchResult[] {
    return this.searchResults.filter(result => result.type === 'dish');
  }

  get pageResults(): SearchResult[] {
    return this.searchResults.filter(result => result.type === 'page' || result.type === 'category');
  }

  ngOnInit(): void {
    this.searchService.isSearchOpen$
      .pipe(takeUntil(this.destroy$))
      .subscribe(isOpen => {
        this.isSearchOpen = isOpen;
        if (isOpen && isPlatformBrowser(this.platformId)) {
          setTimeout(() => {
            const searchInput = this.doc.querySelector('.search-input') as HTMLInputElement | null;
            if (searchInput) {
              searchInput.focus();
            }
          }, 100);
        }
      });
    
    this.searchService.searchResults$
      .pipe(takeUntil(this.destroy$))
      .subscribe(results => {
        this.searchResults = results;
      });
    
    this.searchService.isSearching$
      .pipe(takeUntil(this.destroy$))
      .subscribe(isSearching => {
        this.isSearching = isSearching;
      });
    
    if (isPlatformBrowser(this.platformId)) {
      this.doc.addEventListener('keydown', this.onDocumentKeydown);
      this.escapeKeydownBound = true;
    }
  }

  ngOnDestroy(): void {
    if (this.escapeKeydownBound) {
      this.doc.removeEventListener('keydown', this.onDocumentKeydown);
      this.escapeKeydownBound = false;
    }
    this.destroy$.next();
    this.destroy$.complete();
  }

  displayName(result: SearchResult): string {
    return localizedProductName(
      { name: result.name, nameEn: result.nameEn },
      this.localeService.locale
    );
  }

  localizedRoute(route?: string): string {
    if (!route) return this.localeService.localizePath('/');
    return this.localeService.localizePath(route);
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
}
