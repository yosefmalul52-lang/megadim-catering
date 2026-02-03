import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, tap, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface PriceVariant {
  size: string;  // e.g., "250g", "500g", "small", "large"
  label: string; // e.g., "250 גרם", "500 גרם"
  price: number;
  weight?: number; // Optional: weight in grams for sorting
}

export interface PricingOption {
  label: string;  // e.g., "Small Tray", "Large Tray"
  price: number;
  amount: string; // e.g., "10 people", "250 גרם"
}

export interface MenuItem {
  _id?: string; // MongoDB ID from backend
  id?: string; // Alias for _id for frontend compatibility
  name: string;
  category: string;
  description: string;
  price?: number; // Optional: for backward compatibility or fixed-price items
  pricePer100g?: number; // Optional: price per 100 grams (for admin-controlled display)
  pricingVariants?: PriceVariant[]; // Array of size/price variants (legacy)
  pricingOptions?: PricingOption[]; // Array of pricing options (new structure)
  imageUrl: string;
  tags: string[];
  isAvailable?: boolean;
  isPopular?: boolean;
  popular?: boolean;
  isFeatured?: boolean; // Optional: Show in Featured section on homepage
  servingSize?: string;
  ingredients?: string[];
  allergens?: string[];
  nutritionInfo?: {
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
  };
  createdAt?: string; // From MongoDB timestamps
  updatedAt?: string; // From MongoDB timestamps
  __v?: number; // MongoDB version key
}

export interface MenuCategory {
  id: string;
  name: string;
  description: string;
  imageUrl?: string;
  items?: MenuItem[];
}

@Injectable({
  providedIn: 'root'
})
export class MenuService {
  private http = inject(HttpClient);
  
  private menuItemsSubject = new BehaviorSubject<MenuItem[]>([]);
  public menuItems$ = this.menuItemsSubject.asObservable();
  
  private categoriesSubject = new BehaviorSubject<MenuCategory[]>([]);
  public categories$ = this.categoriesSubject.asObservable();
  
  private loadingSubject = new BehaviorSubject<boolean>(false);
  public loading$ = this.loadingSubject.asObservable();

  // Master Product List - Centralized data source for ALL products
  // This ensures Product Details page works for ALL items, even if not in backend
  // SINGLE SOURCE OF TRUTH - All category components must use this data
  private _allProducts: MenuItem[] = [
    // Main Dishes
    {
      id: 'asado',
      _id: 'asado',
      name: 'אסאדו',
      category: 'מנות עיקריות',
      description: 'אסאדו ארגנטינאי מסורתי עשוי מבשר איכותי, מתובל בתבלינים מיוחדים וצלוי על הגריל. טעם עשיר ומענג שמביא את הטעמים האותנטיים של המטבח הארגנטינאי.',
      price: 72,
      imageUrl: 'https://res.cloudinary.com/dioklg7lx/image/upload/v1768906615/IMG_9690_u75cnk.jpg',
      tags: ['בשרי', 'מיוחד'],
      isAvailable: true,
      isPopular: true,
      pricingOptions: [],
      pricingVariants: []
    },
    {
      id: 'roasted-beef',
      _id: 'roasted-beef',
      name: 'צלי בקר',
      category: 'מנות עיקריות',
      description: 'צלי בקר איכותי מבושל לאט עם ירקות שורש ותבלינים מיוחדים. מרקם רך ועשיר עם טעם עמוק ומשביע שמביא את הטעמים הקלאסיים של המטבח המסורתי.',
      price: 64,
      imageUrl: 'https://res.cloudinary.com/dioklg7lx/image/upload/v1768906615/IMG_9690_u75cnk.jpg',
      tags: ['בשרי', 'מסורתי'],
      isAvailable: true,
      pricingOptions: [],
      pricingVariants: []
    },
    {
      id: 'liver-sauce',
      _id: 'liver-sauce',
      name: 'כבד ברוטב',
      category: 'מנות עיקריות',
      description: 'כבד איכותי ברוטב עשיר ומתובל, מבושל לאט עם בצל ותבלינים מיוחדים. טעם עשיר ומעניין שמביא את הטעמים המוכרים והאהובים של המטבח המסורתי.',
      price: 48,
      imageUrl: 'https://res.cloudinary.com/dioklg7lx/image/upload/v1768906615/IMG_9690_u75cnk.jpg',
      tags: ['בשרי', 'מסורתי'],
      isAvailable: true,
      pricingOptions: [],
      pricingVariants: []
    },
    {
      id: 'moussaka',
      _id: 'moussaka',
      name: 'מוסאקה',
      category: 'מנות עיקריות',
      description: 'מוסאקה מסורתית עם חצילים, בשר טחון ורוטב בצל. מנה עשירה ומשביעה.',
      price: 65,
      imageUrl: 'https://res.cloudinary.com/dioklg7lx/image/upload/v1768906615/IMG_9690_u75cnk.jpg',
      tags: [],
      isAvailable: true,
      pricingOptions: [],
      pricingVariants: []
    },
    // Fish
    {
      id: 'salmon-teriyaki',
      _id: 'salmon-teriyaki',
      name: 'סלמון ברוטב טריאקי',
      category: 'דגים',
      description: 'פילה סלמון איכותי ברוטב טריאקי מתוק וחריף, אפוי בתנור. מנה בריאה וטעימה עם טעם אסיאתי אותנטי.',
      price: 85,
      imageUrl: 'https://res.cloudinary.com/dioklg7lx/image/upload/v1768906613/IMG_9721_rrsv3d.jpg',
      tags: ['בריא'],
      isAvailable: true,
      pricingOptions: [],
      pricingVariants: []
    },
    {
      id: 'salmon',
      _id: 'salmon',
      name: 'סלמון אפוי',
      category: 'דגים',
      description: 'סלמון טרי אפוי בתנור עם עשבי תיבול ולימון. מנה בריאה וטעימה.',
      price: 85,
      imageUrl: 'https://res.cloudinary.com/dioklg7lx/image/upload/v1768906613/IMG_9721_rrsv3d.jpg',
      tags: ['בריא'],
      isAvailable: true,
      pricingOptions: [],
      pricingVariants: []
    },
    {
      id: 'gefilte-fish',
      _id: 'gefilte-fish',
      name: 'גפילטע פיש',
      category: 'דגים',
      description: 'גפילטע פיש מסורתי לשבת, מוכן בסגנון ביתי עם גזר וצנון.',
      price: 55,
      imageUrl: 'https://res.cloudinary.com/dioklg7lx/image/upload/v1768906613/IMG_9721_rrsv3d.jpg',
      tags: [],
      isAvailable: true,
      pricingOptions: [],
      pricingVariants: []
    },
    // Salads
    {
      id: 'hummus',
      _id: 'hummus',
      name: 'סלט חומוס',
      category: 'סלטים',
      description: 'חומוס קלאסי ביתי עשוי מגרגרי חומוס איכותיים, טחינה משובחת, לימון טרי ושום. מרקם קרמי ועדין עם טעם עשיר ומאוזן.',
      price: 17,
      imageUrl: 'https://res.cloudinary.com/dioklg7lx/image/upload/v1768237285/Salads-category_qyrqyf.png',
      tags: ['טבעוני', 'ללא גלוטן'],
      isAvailable: true,
      pricingOptions: [
        { label: '250 גרם', price: 17, amount: '250 גרם' },
        { label: '500 גרם', price: 29, amount: '500 גרם' }
      ],
      pricingVariants: []
    },
    {
      id: 'tahini',
      _id: 'tahini',
      name: 'סלט טחינה',
      category: 'סלטים',
      description: 'טחינה קרמית ומרוכזת עשויה משומשום איכותי, מתובלת בלימון טרי ושום. מרקם חלק ועשיר שמביא טעם מזרח תיכוני אותנטי.',
      price: 18,
      imageUrl: 'https://res.cloudinary.com/dioklg7lx/image/upload/v1768237285/Salads-category_qyrqyf.png',
      tags: ['טבעוני', 'ללא גלוטן'],
      isAvailable: true,
      pricingOptions: [
        { label: '250 גרם', price: 18, amount: '250 גרם' },
        { label: '500 גרם', price: 32, amount: '500 גרם' }
      ],
      pricingVariants: []
    },
    // Sides
    {
      id: 'rice',
      _id: 'rice',
      name: 'אורז לבן',
      category: 'תוספות',
      description: 'אורז לבן מבושל בסגנון ביתי, פריך וטעים. מתאים לכל מנה עיקרית.',
      price: 15,
      imageUrl: 'https://res.cloudinary.com/dioklg7lx/image/upload/v1768906621/IMG_9702_f9k2xj.jpg',
      tags: ['טבעוני', 'ללא גלוטן'],
      isAvailable: true,
      pricingOptions: [],
      pricingVariants: []
    },
    {
      id: 'potatoes',
      _id: 'potatoes',
      name: 'תפוחי אדמה',
      category: 'תוספות',
      description: 'תפוחי אדמה מבושלים או צלויים, מתובלים בתבלינים. תוספת קלאסית וטעימה.',
      price: 12,
      imageUrl: 'https://res.cloudinary.com/dioklg7lx/image/upload/v1768906621/IMG_9702_f9k2xj.jpg',
      tags: ['טבעוני', 'ללא גלוטן'],
      isAvailable: true,
      pricingOptions: [],
      pricingVariants: []
    },
    // Desserts (קינוחים)
    {
      id: 'chocolate-mousse',
      _id: 'chocolate-mousse',
      name: 'מוס שוקולד אישי',
      category: 'קינוחים',
      description: 'מוס שוקולד בלגי עשיר ואוורירי, מוגש בכוסית אישית. קינוח מושלם ושוקולדי.',
      price: 15,
      imageUrl: 'https://res.cloudinary.com/dioklg7lx/image/upload/v1768914768/IMG_9679_ad0nxy.jpg',
      tags: ['חלבי/פרווה', 'שוקולד'],
      isAvailable: true,
      pricingOptions: [],
      pricingVariants: []
    },
    {
      id: 'cheesecake-crumb',
      _id: 'cheesecake-crumb',
      name: 'עוגת גבינה פירורים',
      category: 'קינוחים',
      description: 'עוגת גבינה קרה עם פירורים פריכים, במרקם שמנת עשיר. מוגש בפרוסה אישית.',
      price: 18,
      imageUrl: 'https://res.cloudinary.com/dioklg7lx/image/upload/v1768914768/IMG_9679_ad0nxy.jpg',
      tags: ['חלבי'],
      isAvailable: true,
      pricingOptions: [],
      pricingVariants: []
    },
    {
      id: 'malabi',
      _id: 'malabi',
      name: 'מלבי שמנת',
      category: 'קינוחים',
      description: 'מלבי שמנת מסורתי עם סירופ מי ורדים, קוקוס ובוטנים. טעם של בית.',
      price: 12,
      imageUrl: 'https://res.cloudinary.com/dioklg7lx/image/upload/v1768914768/IMG_9679_ad0nxy.jpg',
      tags: ['ללא גלוטן'],
      isAvailable: true,
      pricingOptions: [],
      pricingVariants: []
    },
    {
      id: 'apple-pie',
      _id: 'apple-pie',
      name: 'פאי תפוחים אישי',
      category: 'קינוחים',
      description: 'פאי תפוחים חם וביתי עם קינמון ובצק פריך. מומלץ להגיש חם.',
      price: 22,
      imageUrl: 'https://res.cloudinary.com/dioklg7lx/image/upload/v1768914768/IMG_9679_ad0nxy.jpg',
      tags: ['פרווה'],
      isAvailable: true,
      pricingOptions: [],
      pricingVariants: []
    },
    // Stuffed (ממולאים) - keeping the old tiramisu here for backward compatibility
    {
      id: 'tiramisu',
      _id: 'tiramisu',
      name: 'טירמיסו',
      category: 'ממולאים',
      description: 'טירמיסו קלאסי איטלקי עם קפה, ביסקוויטים וקרם מתוק. קינוח מושלם לסיום הארוחה.',
      price: 35,
      imageUrl: 'https://res.cloudinary.com/dioklg7lx/image/upload/v1768914768/IMG_9679_ad0nxy.jpg',
      tags: [],
      isAvailable: true,
      pricingOptions: [],
      pricingVariants: []
    }
  ];

  // Mock data for development - now uses backend API data format
  private mockMenuItems: MenuItem[] = [];

  private mockCategories: MenuCategory[] = [
    {
      id: 'main-dishes',
      name: 'מנות עיקריות',
      description: 'מנות עיקריות מסורתיות וביתיות'
    },
    {
      id: 'sides',
      name: 'תוספות',
      description: 'תוספות טעימות למנה העיקרית'
    },
    {
      id: 'salads',
      name: 'סלטים',
      description: 'סלטים טריים וביתיים'
    },
    {
      id: 'desserts',
      name: 'ממולאים',
      description: 'ממולאים טעימים ומושקעים'
    },
    {
      id: 'cholent',
      name: 'צ\'ולנט',
      description: 'צ\'ולנט מסורתי לשבת'
    },
    {
      id: 'holiday',
      name: 'אוכל לחג',
      description: 'מנות מיוחדות לחגים'
    }
  ];

  constructor() {
    // Initialize with mock data
    this.loadMenuItems();
  }

  getMenuItems(): Observable<MenuItem[]> {
    // Always reload from backend to get latest data
    return this.loadMenuItems();
  }

  loadMenuItems(): Observable<MenuItem[]> {
    this.loadingSubject.next(true);
    
    const apiUrl = `${environment.apiUrl}/menu`;
    console.log('🔄 Loading menu items from:', apiUrl);
    
    // Call the backend API - ensure we get ALL items without any filters
    return this.http.get<{success: boolean, data: MenuItem[], count: number}>(apiUrl, {
      headers: {
        'Content-Type': 'application/json'
      },
      params: {} // Explicitly no filters to get all items
    }).pipe(
      map(response => {
        console.log('📦 Raw API response:', {
          hasSuccess: !!response?.success,
          hasData: !!response?.data,
          isArray: Array.isArray(response),
          dataLength: response?.data?.length || 0,
          count: response?.count || 0,
          responseType: typeof response
        });
        
        // Handle different response formats
        let items: MenuItem[] = [];
        
        if (response && response.success && response.data && Array.isArray(response.data)) {
          // Standard format: {success: true, data: [...], count: X}
          items = response.data;
          console.log('✅ Using standard format, got', items.length, 'items');
        } else if (response && Array.isArray(response)) {
          // Direct array format
          items = response;
          console.log('✅ Using direct array format, got', items.length, 'items');
        } else if (response && response.data && Array.isArray(response.data)) {
          // Format without success field
          items = response.data;
          console.log('✅ Using data-only format, got', items.length, 'items');
        } else {
          console.warn('⚠️ Unexpected response format:', response);
        }
        
        // Count items by category for debugging
        const categoryCounts: {[key: string]: number} = {};
        items.forEach(item => {
          categoryCounts[item.category] = (categoryCounts[item.category] || 0) + 1;
        });
        console.log('📊 Items by category:', categoryCounts);
        
        const processedItems = items.map(item => ({
          ...item,
          id: item._id || item.id || '', // Ensure id is always a string, never undefined
          imageUrl: this.sanitizeImageUrl(item.imageUrl)
        })).filter(item => item.id); // Filter out items without valid ID
        
        console.log('✅ Processed', processedItems.length, 'items total');
        return processedItems;
      }),
      tap(items => {
        // Update state only once to prevent multiple renders
        console.log('💾 Storing', items.length, 'items in state');
        this.menuItemsSubject.next(items);
        this.loadingSubject.next(false);
      }),
      catchError(error => {
        console.error('❌ Error loading menu items from API:', error);
        console.error('Error details:', {
          status: error.status,
          statusText: error.statusText,
          message: error.message,
          url: error.url,
          error: error.error,
          name: error.name
        });
        this.loadingSubject.next(false);
        // Return empty array on error
        return of([]);
      })
    );
  }

  loadCategories(): Observable<MenuCategory[]> {
    // Always extract categories from menu items to ensure consistency
    // First, make sure menu items are loaded
    if (this.menuItemsSubject.value.length === 0) {
      // If no items loaded yet, load them first
      return this.loadMenuItems().pipe(
        map(() => {
          const categories = this.extractCategoriesFromMenuItems();
          this.categoriesSubject.next(categories);
          return categories;
        })
      );
    }
    
    // Extract categories from already loaded menu items
    const categories = this.extractCategoriesFromMenuItems();
    this.categoriesSubject.next(categories);
    return of(categories);
  }

  private extractCategoriesFromMenuItems(): MenuCategory[] {
    // Get unique categories from current menu items
    const categoryMap = new Map<string, MenuCategory>();
    
    // Use current menu items from subject
    const currentItems = this.menuItemsSubject.value;
    
    console.log('📋 Extracting categories from', currentItems.length, 'menu items');
    
    currentItems.forEach(item => {
      if (item.category && !categoryMap.has(item.category)) {
        // Map category names to IDs and routes
        const categoryId = this.getCategoryId(item.category);
        
        categoryMap.set(item.category, {
          id: categoryId,
          name: item.category,
          description: `מנות ${item.category} טעימות ומגוונות`,
          imageUrl: this.getCategoryImageUrl(item.category)
        });
      }
    });
    
    const categories = Array.from(categoryMap.values());
    
    console.log('✅ Extracted', categories.length, 'categories:', categories.map(c => c.name).join(', '));
    
    // If still no categories, use default categories from home page
    if (categories.length === 0) {
      console.warn('⚠️ No categories found in menu items, using default categories');
      return [
        {
          id: 'main-dishes',
          name: 'מנות עיקריות',
          description: 'מנות עיקריות מסורתיות וביתיות',
          imageUrl: '/assets/images/fish/Fish-stretched.jpg'
        },
        {
          id: 'side-dishes',
          name: 'תוספות',
          description: 'תוספות טעימות למנה העיקרית',
          imageUrl: '/assets/images/salads/root-vegetables.jpg'
        },
        {
          id: 'salads',
          name: 'סלטים',
          description: 'סלטים טריים וביתיים',
          imageUrl: '/assets/images/salads/hummus.jpg'
        },
        {
          id: 'desserts',
          name: 'ממולאים',
          description: 'ממולאים טעימים ומושקעים',
          imageUrl: '/assets/images/placeholder-dish.jpg'
        },
        {
          id: 'fish',
          name: 'דגים',
          description: 'דגים טריים ומעולים לשבת וחג',
          imageUrl: '/assets/images/Fish-category.jpg'
        }
      ];
    }
    
    return categories;
  }

  private getCategoryId(categoryName: string): string {
    const categoryMap: {[key: string]: string} = {
      'מנות עיקריות': 'main-dishes',
      'תוספות': 'side-dishes',
      'סלטים': 'salads',
      'ממולאים': 'desserts',
      'דגים': 'fish',
      'צ\'ולנט': 'cholent',
      'אוכל לחג': 'holiday'
    };
    
    return categoryMap[categoryName] || categoryName.toLowerCase().replace(/\s+/g, '-');
  }

  private getCategoryImageUrl(categoryName: string): string {
    const imageMap: {[key: string]: string} = {
      'מנות עיקריות': '/assets/images/fish/Fish-stretched.jpg',
      'תוספות': '/assets/images/salads/root-vegetables.jpg',
      'סלטים': '/assets/images/salads/hummus.jpg',
      'ממולאים': '/assets/images/placeholder-dish.jpg',
      'דגים': '/assets/images/Fish-category.jpg',
      'צ\'ולנט': '/assets/images/placeholder-dish.jpg',
      'אוכל לחג': '/assets/images/placeholder-dish.jpg'
    };
    
    return imageMap[categoryName] || '/assets/images/placeholder-dish.jpg';
  }

  getItemsByCategory(categoryId: string): MenuItem[] {
    // Try to find category by ID first
    const categories = this.categoriesSubject.value;
    const category = categories.find(cat => cat.id === categoryId);
    const categoryName = category?.name || categoryId;
    
    // Filter items by category name
    return this.menuItemsSubject.value.filter(item => item.category === categoryName);
  }

  getItemById(id: string): MenuItem | undefined {
    return this.menuItemsSubject.value.find(item => item.id === id);
  }

  getPopularItems(limit: number = 6): MenuItem[] {
    return this.menuItemsSubject.value
      .filter(item => item.isPopular)
      .slice(0, limit);
  }

  searchItems(query: string): MenuItem[] {
    const searchTerm = query.toLowerCase();
    return this.menuItemsSubject.value.filter(item =>
      item.name.toLowerCase().includes(searchTerm) ||
      item.description.toLowerCase().includes(searchTerm) ||
      item.category.toLowerCase().includes(searchTerm) ||
      item.tags.some(tag => tag.toLowerCase().includes(searchTerm))
    );
  }

  // Admin methods (for dashboard)
  updateMenuItem(id: string, updates: Partial<MenuItem>): Observable<MenuItem> {
    console.log('🔄 Updating menu item:', id, 'with data:', JSON.stringify(updates, null, 2));
    
    // Ensure we use _id if id is provided (for MongoDB compatibility)
    const itemId = id || updates._id || '';
    
    if (!itemId) {
      return new Observable(observer => {
        observer.error(new Error('Item ID is required for update'));
      });
    }
    
    return this.http.put<{success: boolean, data: MenuItem}>(`${environment.apiUrl}/menu/${itemId}`, updates).pipe(
      map(response => {
        console.log('✅ Item updated successfully:', response.data);
        const updatedItem = {
          ...response.data,
          id: response.data._id || response.data.id,
          imageUrl: this.sanitizeImageUrl(response.data.imageUrl)
        };
        
        // Force reload from backend to ensure consistency
        this.loadMenuItems().subscribe();
        
        return updatedItem;
      }),
      catchError(error => {
        console.error('❌ Error updating menu item:', error);
        throw error;
      })
    );
  }

  addMenuItem(item: Omit<MenuItem, 'id'>): Observable<MenuItem> {
    console.log('➕ Creating new menu item:', JSON.stringify(item, null, 2));
    return this.http.post<{success: boolean, data: MenuItem}>(`${environment.apiUrl}/menu`, item).pipe(
      map(response => {
        console.log('✅ Item created successfully:', response.data);
        const newItem = {
          ...response.data,
          id: response.data._id || response.data.id,
          imageUrl: this.sanitizeImageUrl(response.data.imageUrl)
        };
        
        // Force reload from backend to ensure consistency
        this.loadMenuItems().subscribe();
        
        return newItem;
      }),
      catchError(error => {
        console.error('❌ Error creating menu item:', error);
        throw error;
      })
    );
  }

  deleteMenuItem(id: string): Observable<boolean> {
    console.log('🗑️ Deleting menu item:', id);
    return this.http.delete<{success: boolean, message: string}>(`${environment.apiUrl}/menu/${id}`).pipe(
      map(response => {
        console.log('✅ Item deleted successfully');
        
        // Force reload from backend to ensure consistency
        this.loadMenuItems().subscribe();
        
        return true;
      }),
      catchError(error => {
        console.error('❌ Error deleting menu item:', error);
        throw error;
      })
    );
  }

  /**
   * Universal method to get a product by ID from ALL categories
   * Searches through all menu items regardless of category
   * First searches in backend data, then falls back to master product list
   */
  getProductById(id: string): Observable<MenuItem | null> {
    if (!id || id.trim() === '') {
      console.warn('⚠️ getProductById called with empty ID');
      return new Observable<MenuItem | null>(observer => {
        observer.next(null);
        observer.complete();
      });
    }

    console.log('🔍 Searching for product with ID:', id);

    return this.getMenuItems().pipe(
      map<MenuItem[], MenuItem | null>(backendItems => {
        // First, search in backend items
        let foundProduct = backendItems.find(item => 
          (item.id && item.id === id) || 
          (item._id && item._id === id) ||
          (item.id && item.id.toString() === id) ||
          (item._id && item._id.toString() === id)
        );
        
        if (foundProduct) {
          console.log('✅ Found product in backend:', foundProduct.name, 'in category:', foundProduct.category);
          return foundProduct;
        }

        // If not found in backend, search in master product list
        console.log('🔍 Product not found in backend, searching in master product list...');
        foundProduct = this._allProducts.find(item => 
          (item.id && item.id === id) || 
          (item._id && item._id === id) ||
          (item.id && item.id.toString() === id) ||
          (item._id && item._id.toString() === id)
        );

        if (foundProduct) {
          console.log('✅ Found product in master list:', foundProduct.name, 'in category:', foundProduct.category);
          return foundProduct;
        }

        // If still not found, return a fallback placeholder to prevent crashes
        console.warn('⚠️ Product not found with ID:', id, '- Returning fallback placeholder');
        const fallbackProduct: MenuItem = {
          id: id,
          _id: id,
          name: 'מוצר לא נמצא',
          category: 'מנות עיקריות',
          description: 'המוצר המבוקש לא נמצא במערכת. אנא נסה שוב מאוחר יותר.',
          price: 0,
          imageUrl: '/assets/images/placeholder-dish.jpg',
          tags: [],
          isAvailable: false,
          pricingOptions: [],
          pricingVariants: []
        };
        
        console.log('📦 Returning fallback product:', fallbackProduct);
        return fallbackProduct;
      }),
      catchError(error => {
        console.error('❌ Error fetching product by ID:', error);
        
        // On error, try to find in master product list
        const foundProduct = this._allProducts.find(item => 
          (item.id && item.id === id) || 
          (item._id && item._id === id) ||
          (item.id && item.id.toString() === id) ||
          (item._id && item._id.toString() === id)
        );

        if (foundProduct) {
          console.log('✅ Found product in master list after error:', foundProduct.name);
          return new Observable<MenuItem | null>(observer => {
            observer.next(foundProduct);
            observer.complete();
          });
        }

        // Return fallback if not found
        const fallbackProduct: MenuItem = {
          id: id,
          _id: id,
          name: 'מוצר לא נמצא',
          category: 'מנות עיקריות',
          description: 'המוצר המבוקש לא נמצא במערכת. אנא נסה שוב מאוחר יותר.',
          price: 0,
          imageUrl: '/assets/images/placeholder-dish.jpg',
          tags: [],
          isAvailable: false,
          pricingOptions: [],
          pricingVariants: []
        };

        return new Observable<MenuItem | null>(observer => {
          observer.next(fallbackProduct);
          observer.complete();
        });
      })
    );
  }

  /**
   * Get all products from master list (for fallback/offline scenarios)
   * Returns Observable for consistency with other methods
   */
  getAllProducts(): Observable<MenuItem[]> {
    return new Observable<MenuItem[]>(observer => {
      observer.next([...this._allProducts]);
      observer.complete();
    });
  }

  /**
   * Get products by category from master list
   * Maps category names (Hebrew or English) to filter products
   */
  getProductsByCategory(category: string): Observable<MenuItem[]> {
    // Map category strings to Hebrew category names
    const categoryMap: { [key: string]: string } = {
      'main-dishes': 'מנות עיקריות',
      'main': 'מנות עיקריות',
      'fish': 'דגים',
      'salads': 'סלטים',
      'desserts': 'קינוחים',
      'sides': 'תוספות',
      'side-dishes': 'תוספות',
      'stuffed': 'ממולאים'
    };

    const hebrewCategory = categoryMap[category.toLowerCase()] || category;
    
    console.log('🔍 getProductsByCategory - Requested:', category, 'Mapped to:', hebrewCategory);
    
    // First try to get from backend
    return this.getMenuItems().pipe(
      map(backendItems => {
        // Filter backend items by category
        const backendFiltered = backendItems.filter(item => 
          item.category === hebrewCategory || 
          item.category === category ||
          item.category?.toLowerCase() === category.toLowerCase()
        );

        // Also get from master list
        const masterFiltered = this._allProducts.filter(item => 
          item.category === hebrewCategory || 
          item.category === category ||
          item.category?.toLowerCase() === category.toLowerCase()
        );

        // Merge and deduplicate by ID
        const allProducts = [...backendFiltered, ...masterFiltered];
        const uniqueProducts = Array.from(
          new Map(allProducts.map(item => [item.id || item._id || '', item])).values()
        );

        console.log(`✅ getProductsByCategory - Found ${uniqueProducts.length} products for category: ${category}`);
        return uniqueProducts;
      }),
      catchError(error => {
        console.error('❌ Error in getProductsByCategory, using master list only:', error);
        // Fallback to master list only
        const masterFiltered = this._allProducts.filter(item => 
          item.category === hebrewCategory || 
          item.category === category ||
          item.category?.toLowerCase() === category.toLowerCase()
        );
        return new Observable<MenuItem[]>(observer => {
          observer.next([...masterFiltered]);
          observer.complete();
        });
      })
    );
  }

  private sanitizeImageUrl(url: string): string {
    if (!url || url.trim() === '') {
      return '/assets/images/placeholder-dish.jpg';
    }
    
    try {
      // If it's already a placeholder, return it
      if (url.includes('placeholder-dish.jpg')) {
        return '/assets/images/placeholder-dish.jpg';
      }
      
      // Check if URL is absolute (starts with http:// or https://)
      if (url.startsWith('http://') || url.startsWith('https://')) {
        return url;
      }
      
      // Extract image name from URL
      const imageName = url.split('/').pop()?.toLowerCase() || '';
      
      // List of known missing images - use placeholder instead
      // These images don't exist in the assets folder
      const missingImages = new Set([
        'eggplant-tahini.jpg',
        'cholent.jpg',
        'hummus-salad.jpg',
        'tabbouleh.jpg',
        'potato-kugel.jpg',
        'malabi-berries.jpg',
        'parve-cholent.jpg',
        'honey-cake.jpg',
        'liver-onions.jpg',
        'green-salad.jpg',
        'basmati-rice.jpg',
        'vegetable-soup.jpg',
        'stuffed-chicken.jpg',
        'egg-salad.jpg',
        'red-cabbage-salad.jpg',
        'eggplant-tomato-salad.jpg',
        'sweet-potato-salad.jpg',
        'quinoa-salad.jpg',
        'black-lentil-salad.jpg',
        'beef-asado.jpg',
        'baked-salmon.jpg',
        'moussaka.jpg',
        'fettuccine-alfredo.jpg',
        'rosemary-potatoes.jpg',
        'grilled-vegetables.jpg',
        'tiramisu.jpg',
        'chocolate-mousse.jpg',
        'cholent-kishke.jpg',
        'gefilte-fish.jpg',
        'charoset.jpg'
      ]);
      
      // If image is in the missing list, return placeholder immediately
      if (imageName && missingImages.has(imageName)) {
        return '/assets/images/placeholder-dish.jpg';
      }
      
      // Normalize the URL - ensure it starts with /assets/images/ if it's a relative path
      if (url.startsWith('/assets/')) {
        // Already has /assets/ prefix, return as is
        return url;
      }
      
      // If URL doesn't start with /, add /assets/images/
      if (!url.startsWith('/')) {
        return `/assets/images/${url}`;
      }
      
      // If it starts with / but not /assets/, assume it should be in /assets/images/
      if (!url.startsWith('/assets/')) {
        // Remove leading / and add /assets/images/
        const cleanPath = url.startsWith('/') ? url.substring(1) : url;
        return `/assets/images/${cleanPath}`;
      }
      
      return url;
    } catch {
      return '/assets/images/placeholder-dish.jpg';
    }
  }
}
