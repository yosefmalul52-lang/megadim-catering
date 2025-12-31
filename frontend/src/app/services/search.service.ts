import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of, combineLatest } from 'rxjs';
import { map, debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { MenuService } from './menu.service';

export interface SearchResult {
  type: 'dish' | 'page' | 'category';
  id: string;
  name: string;
  description?: string;
  category?: string;
  route?: string;
  imageUrl?: string;
  price?: number;
}

export interface SearchResponse {
  results: SearchResult[];
  totalResults: number;
  query: string;
}

@Injectable({
  providedIn: 'root'
})
export class SearchService {
  private http = inject(HttpClient);
  private menuService = inject(MenuService);
  
  private searchQuerySubject = new BehaviorSubject<string>('');
  public searchQuery$ = this.searchQuerySubject.asObservable();
  
  private searchResultsSubject = new BehaviorSubject<SearchResult[]>([]);
  public searchResults$ = this.searchResultsSubject.asObservable();
  
  private isSearchOpenSubject = new BehaviorSubject<boolean>(false);
  public isSearchOpen$ = this.isSearchOpenSubject.asObservable();
  
  private isSearchingSubject = new BehaviorSubject<boolean>(false);
  public isSearching$ = this.isSearchingSubject.asObservable();

  // Page/content search data
  private pageSearchData: SearchResult[] = [
    {
      type: 'page',
      id: 'home',
      name: 'דף הבית',
      description: 'עמוד הבית של מגדים קייטרינג',
      route: '/'
    },
    {
      type: 'page',
      id: 'about',
      name: 'אודות',
      description: 'על מגדים קייטרינג - הסיפור שלנו',
      route: '/about'
    },
    {
      type: 'page',
      id: 'events-catering',
      name: 'קייטרינג לאירועים',
      description: 'שירותי קייטרינג לאירועים פרטיים ועסקיים',
      route: '/events-catering'
    },
    {
      type: 'page',
      id: 'ready-for-shabbat',
      name: 'אוכל מוכן לשבת',
      description: 'מנות מוכנות לשבת קודש',
      route: '/ready-for-shabbat'
    },
    {
      type: 'page',
      id: 'cholent-bar',
      name: 'צ\'ולנט בר',
      description: 'צ\'ולנט טרי וחם לשישי בלילה ומוצאי שבת',
      route: '/cholent-bar'
    },
    {
      type: 'page',
      id: 'holiday-food',
      name: 'אוכל לחג',
      description: 'מנות מיוחדות לחגים',
      route: '/holiday-food'
    },
    {
      type: 'page',
      id: 'kosher-certificate',
      name: 'תעודת כשרות',
      description: 'הכשרות שלנו - כשר מפוקח',
      route: '/kosher'
    },
    {
      type: 'page',
      id: 'contact',
      name: 'צור קשר',
      description: 'פרטי התקשרות ויצירת קשר',
      route: '/contact'
    },
    {
      type: 'category',
      id: 'main-dishes',
      name: 'מנות עיקריות',
      description: 'מנות עיקריות מסורתיות וביתיות',
      route: '/ready-for-shabbat/main-dishes'
    },
    {
      type: 'category',
      id: 'sides',
      name: 'תוספות',
      description: 'תוספות טעימות למנה העיקרית',
      route: '/ready-for-shabbat/sides'
    },
    {
      type: 'category',
      id: 'salads',
      name: 'סלטים',
      description: 'סלטים טריים וביתיים',
      route: '/ready-for-shabbat/salads'
    },
    {
      type: 'category',
      id: 'desserts',
      name: 'קינוחים',
      description: 'קינוחים מתוקים וטעימים',
      route: '/ready-for-shabbat/desserts'
    },
    {
      type: 'category',
      id: 'fish',
      name: 'דגים',
      description: 'דגים טריים ומעולים לשבת וחג',
      route: '/ready-for-shabbat/fish'
    }
  ];

  constructor() {
    // Set up debounced search
    this.searchQuery$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(query => this.performSearch(query))
    ).subscribe(results => {
      this.searchResultsSubject.next(results);
      this.isSearchingSubject.next(false);
    });
  }

  search(query: string): void {
    this.searchQuerySubject.next(query.trim());
    if (query.trim()) {
      this.isSearchingSubject.next(true);
    }
  }

  openSearch(): void {
    this.isSearchOpenSubject.next(true);
  }

  closeSearch(): void {
    this.isSearchOpenSubject.next(false);
    this.clearSearch();
  }

  toggleSearch(): void {
    this.isSearchOpenSubject.next(!this.isSearchOpenSubject.value);
    if (!this.isSearchOpenSubject.value) {
      this.clearSearch();
    }
  }

  clearSearch(): void {
    this.searchQuerySubject.next('');
    this.searchResultsSubject.next([]);
  }

  private performSearch(query: string): Observable<SearchResult[]> {
    if (!query || query.length < 2) {
      return of([]);
    }

    // In production, this would call the backend API
    // return this.http.get<SearchResponse>(`${environment.apiUrl}/search?q=${encodeURIComponent(query)}`);

    // For now, search locally through menu items and pages
    return combineLatest([
      this.menuService.menuItems$,
      of(this.pageSearchData)
    ]).pipe(
      map(([menuItems, pageData]) => {
        const searchTerm = query.toLowerCase();
        const results: SearchResult[] = [];

        // Search menu items
        const dishResults = menuItems
          .filter(item => 
            item.name.toLowerCase().includes(searchTerm) ||
            item.description.toLowerCase().includes(searchTerm) ||
            item.category.toLowerCase().includes(searchTerm) ||
            item.tags.some(tag => tag.toLowerCase().includes(searchTerm))
          )
          .map(item => ({
            type: 'dish' as const,
            id: item.id || item._id || '',
            name: item.name,
            description: item.description,
            category: item.category,
            imageUrl: item.imageUrl,
            price: item.price
          }));

        // Search pages and categories
        const pageResults = pageData.filter(page => 
          page.name.toLowerCase().includes(searchTerm) ||
          (page.description && page.description.toLowerCase().includes(searchTerm))
        );

        // Combine and limit results
        results.push(...dishResults.slice(0, 6));
        results.push(...pageResults.slice(0, 4));

        // Sort by relevance (exact matches first, then partial matches)
        return results.sort((a, b) => {
          const aExact = a.name.toLowerCase() === searchTerm ? 1 : 0;
          const bExact = b.name.toLowerCase() === searchTerm ? 1 : 0;
          
          if (aExact !== bExact) return bExact - aExact;
          
          const aStarts = a.name.toLowerCase().startsWith(searchTerm) ? 1 : 0;
          const bStarts = b.name.toLowerCase().startsWith(searchTerm) ? 1 : 0;
          
          return bStarts - aStarts;
        });
      })
    );
  }

  // Get popular searches
  getPopularSearches(): string[] {
    return [
      'חומוס',
      'צ\'ולנט',
      'סלטים',
      'מנות עיקריות',
      'קינוחים',
      'שבת',
      'אירועים'
    ];
  }

  // Get search suggestions based on current query
  getSearchSuggestions(query: string): Observable<string[]> {
    if (!query || query.length < 2) {
      return of(this.getPopularSearches());
    }

    return combineLatest([
      this.menuService.menuItems$,
      of(this.pageSearchData)
    ]).pipe(
      map(([menuItems, pageData]) => {
        const searchTerm = query.toLowerCase();
        const suggestions: string[] = [];

        // Get suggestions from menu items
        menuItems.forEach(item => {
          if (item.name.toLowerCase().includes(searchTerm)) {
            suggestions.push(item.name);
          }
          if (item.category.toLowerCase().includes(searchTerm)) {
            suggestions.push(item.category);
          }
          item.tags.forEach(tag => {
            if (tag.toLowerCase().includes(searchTerm)) {
              suggestions.push(tag);
            }
          });
        });

        // Get suggestions from pages
        pageData.forEach(page => {
          if (page.name.toLowerCase().includes(searchTerm)) {
            suggestions.push(page.name);
          }
        });

        // Remove duplicates and limit
        return Array.from(new Set(suggestions)).slice(0, 8);
      })
    );
  }
}
