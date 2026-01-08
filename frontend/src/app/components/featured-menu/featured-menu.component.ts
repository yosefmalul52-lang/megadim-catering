import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { CartService } from '../../services/cart.service';

interface Category {
  id: string;
  name: string;
  image: string; // Path to icon/image
  filterValue: string; // The value to filter by on the Shabbat page
}

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  isPopular?: boolean;
}

@Component({
  selector: 'app-featured-menu',
  standalone: true,
  imports: [CommonModule, RouterModule, MatButtonModule, MatIconModule, MatSnackBarModule],
  templateUrl: './featured-menu.component.html',
  styleUrls: ['./featured-menu.component.scss']
})
export class FeaturedMenuComponent {
  // Categories aligned with 'Ready for Shabbat' sections
  categories: Category[] = [
    { id: '1', name: 'סלטים', image: 'assets/images/Fish-category.jpg', filterValue: 'salads' },
    { id: '2', name: 'דגים', image: 'assets/images/Fish-category.jpg', filterValue: 'fish' },
    { id: '3', name: 'מנות עיקריות', image: 'assets/images/Fish-category.jpg', filterValue: 'main' },
    { id: '4', name: 'תוספות', image: 'assets/images/Fish-category.jpg', filterValue: 'sides' },
    { id: '5', name: 'ממולאים', image: 'assets/images/Fish-category.jpg', filterValue: 'stuffed' }
  ];

  // Featured products to show regardless of category selection (Mock Data) - Exactly 4 items
  featuredProducts: Product[] = [
    { 
      id: '1', name: 'נסיכת הנילוס ברוטב מרוקאי', description: 'דג ברוטב עגבניות פיקנטי, פלפלים, שום וכוסברה טרייה', price: 65, image: 'assets/images/Fish-category.jpg', isPopular: true 
    },
    { 
      id: '2', name: 'צלי בקר ברוטב יין ופטריות', description: 'נתחי בקר מובחרים בבישול איטי עם ציר בקר, יין אדום ופטריות טריות', price: 110, image: 'assets/images/Fish-category.jpg', isPopular: true 
    },
    { 
      id: '3', name: 'עוף בגריל בתיבול הבית', description: 'כרעיים עוף צלויים בתנור במרינדת דבש, פפריקה ועשבי תיבול', price: 45, image: 'assets/images/Fish-category.jpg' 
    },
    { 
      id: '4', name: 'פלפל ממולא אורז ובשר', description: 'פלפלים אדומים במילוי עשיר של בשר בקר ואורז ברוטב עגבניות', price: 38, image: 'assets/images/Fish-category.jpg' 
    }
  ];

  constructor(
    private cartService: CartService,
    private router: Router,
    private snackBar: MatSnackBar
  ) {}

  addToCart(product: Product): void {
    // Convert Product to CartItem format
    this.cartService.addItem({
      id: product.id,
      name: product.name,
      price: product.price,
      imageUrl: product.image
    });

    // Feedback
    this.snackBar.open(`${product.name} התווסף להזמנה בהצלחה!`, 'סגור', {
      duration: 3000,
      direction: 'rtl',
      panelClass: ['success-snackbar']
    });
  }

  navigateToCategory(category: Category): void {
    // Navigates to the Shabbat page and passes the category as a filter
    this.router.navigate(['/shabbat'], { 
      queryParams: { category: category.filterValue } 
    });
  }
}
