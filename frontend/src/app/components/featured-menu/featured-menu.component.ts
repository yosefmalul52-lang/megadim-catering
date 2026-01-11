import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { CartService } from '../../services/cart.service';
import { MenuService, MenuItem } from '../../services/menu.service';

interface Category {
  id: string;
  name: string;
  image: string; // Path to icon/image
  filterValue: string; // The value to filter by on the Shabbat page
}

@Component({
  selector: 'app-featured-menu',
  standalone: true,
  imports: [CommonModule, RouterModule, MatButtonModule, MatIconModule, MatSnackBarModule],
  templateUrl: './featured-menu.component.html',
  styleUrls: ['./featured-menu.component.scss']
})
export class FeaturedMenuComponent implements OnInit {
  // Categories aligned with 'Ready for Shabbat' sections
  categories: Category[] = [
    { id: 'salads', name: 'סלטים', image: 'assets/images/Fish-category.jpg', filterValue: 'salads' },
    { id: 'fish', name: 'דגים', image: 'assets/images/Fish-category.jpg', filterValue: 'fish' },
    { id: 'main', name: 'מנות עיקריות', image: 'assets/images/Fish-category.jpg', filterValue: 'main' },
    { id: 'sides', name: 'תוספות', image: 'assets/images/Fish-category.jpg', filterValue: 'sides' },
    { id: 'desserts', name: 'קינוחים', image: 'assets/images/Fish-category.jpg', filterValue: 'desserts' }
  ];

  // Featured products from Main Courses category (Dynamic Data)
  featuredMainCourses: MenuItem[] = [];
  isLoading = false;

  constructor(
    private cartService: CartService,
    private router: Router,
    private snackBar: MatSnackBar,
    private menuService: MenuService
  ) {}

  ngOnInit(): void {
    this.loadFeaturedMainCourses();
  }

  private loadFeaturedMainCourses(): void {
    this.isLoading = true;
    this.menuService.getMenuItems().subscribe({
      next: (items: MenuItem[]) => {
        // Filter only items where isFeatured === true
        const featuredItems = items.filter(item => item.isFeatured === true);
        
        // Take first 4 items (to ensure layout doesn't break)
        this.featuredMainCourses = featuredItems.slice(0, 4);
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading featured main courses:', error);
        this.isLoading = false;
        // Fallback to empty array on error
        this.featuredMainCourses = [];
      }
    });
  }

  addToCart(item: MenuItem): void {
    // Get price using helper method
    const price = this.getPrice(item);
    
    if (price <= 0) {
      console.error(`Cannot add ${item.name} to cart: no price available`);
      this.snackBar.open('לא ניתן להוסיף את הפריט לסל - אין מחיר זמין', 'סגור', {
        duration: 3000,
        direction: 'rtl',
        panelClass: ['error-snackbar']
      });
      return;
    }

    // Convert MenuItem to CartItem format
    this.cartService.addItem({
      id: item.id || item._id || '',
      name: item.name,
      price: price,
      imageUrl: item.imageUrl,
      description: item.description,
      category: item.category
    });

    // Feedback
    this.snackBar.open(`${item.name} התווסף להזמנה בהצלחה!`, 'סגור', {
      duration: 3000,
      direction: 'rtl',
      panelClass: ['success-snackbar']
    });
  }

  getPrice(item: MenuItem): number {
    // Priority 1: pricingOptions (first option price)
    if (item.pricingOptions && item.pricingOptions.length > 0) {
      return item.pricingOptions[0].price;
    }
    
    // Priority 2: pricingVariants (first variant price)
    if (item.pricingVariants && item.pricingVariants.length > 0) {
      return item.pricingVariants[0].price;
    }
    
    // Priority 3: single price
    if (item.price !== undefined && item.price !== null) {
      return item.price;
    }
    
    // Priority 4: pricePer100g (calculate approximate price for 400g)
    if (item.pricePer100g !== undefined && item.pricePer100g !== null) {
      return item.pricePer100g * 4; // Approximate price for 400g serving
    }
    
    return 0;
  }

  navigateToCategory(category: Category): void {
    // Navigates to the category detail page
    this.router.navigate(['/ready-for-shabbat', category.id]);
  }
}
