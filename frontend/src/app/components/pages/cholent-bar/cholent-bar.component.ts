import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { MenuService, MenuItem } from '../../../services/menu.service';
import { CartService } from '../../../services/cart.service';

@Component({
  selector: 'app-cholent-bar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './cholent-bar.component.html',
  styleUrls: ['./cholent-bar.component.scss']
})
export class CholentBarComponent implements OnInit {
  menuService = inject(MenuService);
  cartService = inject(CartService);
  router = inject(Router);
  
  // Group items by category for display
  cholentItems: MenuItem[] = [];
  cholentDishes: MenuItem[] = []; // Only cholent items
  meatSpecials: MenuItem[] = []; // Meat specials (burger, schnitzel, etc.)
  sidesItems: MenuItem[] = [];
  dessertsItems: MenuItem[] = [];
  isLoading: boolean = true;

  ngOnInit(): void {
    // For now, we'll use hardcoded data since the service might not have cholent items yet
    // In production, this would come from MenuService
    this.loadCholentItems();
  }

  private loadCholentItems(): void {
    // Try to load from service first
    this.menuService.getProductsByCategory('cholent').subscribe({
      next: (items) => {
        if (items && items.length > 0) {
          this.cholentItems = items;
          this.groupItemsByCategory();
        } else {
          // Fallback to hardcoded items
          this.loadHardcodedItems();
        }
        this.isLoading = false;
      },
      error: () => {
        this.loadHardcodedItems();
        this.isLoading = false;
      }
    });
  }

  private loadHardcodedItems(): void {
    // Hardcoded items as fallback
    this.cholentItems = [
      { id: 'cholent-meat', name: 'צ\'ולנט בשרי', price: 45, description: 'צלחת צ\'ולנט עשירה + לחמניה טרייה', category: 'cholent', imageUrl: '', tags: [] },
      { id: 'cholent-parve', name: 'צ\'ולנט פרווה', price: 35, description: 'צלחת צ\'ולנט מסורתי + לחמניה טרייה', category: 'cholent', imageUrl: '', tags: [] },
      { id: 'burger-meal', name: 'ארוחת המבורגר', price: 54, description: 'קציצה עסיסית בלחמניה, צ\'יפס ושתייה', category: 'cholent', imageUrl: '', tags: [] },
      { id: 'burger-single', name: 'המבורגר בלחמניה', price: 42, description: 'מוגש עם ירקות טריים ורטבים', category: 'cholent', imageUrl: '', tags: [] },
      { id: 'schnitzel-challah', name: 'חלה שניצל', price: 38, description: 'מבחר סלטים לבחירה וצ\'יפס בצד', category: 'cholent', imageUrl: '', tags: [] },
      { id: 'schnitzel-nuggets', name: 'נשנושי שניצלונים וצ\'יפס', price: 32, description: 'מנה כיפית ופריכה', category: 'cholent', imageUrl: '', tags: [] },
      { id: 'kugel-jerusalem', name: 'קוגל ירושלמי', price: 8, description: 'חריף ומתוק במידה הנכונה', category: 'cholent', imageUrl: '', tags: [] },
      { id: 'kugel-potato', name: 'קוגל תפוחי אדמה', price: 8, description: 'בטעם של בית', category: 'cholent', imageUrl: '', tags: [] },
      { id: 'chopped-liver', name: 'כבד קצוץ', price: 30, description: 'עם בצל מטוגן וקרקרים', category: 'cholent', imageUrl: '', tags: [] },
      { id: 'fries', name: 'צ\'יפס', price: 10, description: 'פריך ולוהט. קטן: 10 ₪ / גדול: 20 ₪', category: 'cholent', imageUrl: '', tags: [] },
      { id: 'chocolate-souffle', name: 'סופלה שוקולד', price: 22, description: 'מוגש חם עם גלידה וניל', category: 'cholent', imageUrl: '', tags: [] },
      { id: 'dessert-platter', name: 'פלטת קינוחים זוגית', price: 40, description: 'מבחר מתוקים מפנק', category: 'cholent', imageUrl: '', tags: [] },
      { id: 'soft-drinks', name: 'שתייה קלה', price: 8, description: 'קולה, פנטה, זירו, XL', category: 'cholent', imageUrl: '', tags: [] },
      { id: 'beer', name: 'בירה קרה', price: 15, description: 'בקבוק בירה צונן', category: 'cholent', imageUrl: '', tags: [] }
    ];
    this.groupItemsByCategory();
  }

  private groupItemsByCategory(): void {
    // Group items by category for display - filter in TypeScript, not in template
    this.cholentDishes = this.cholentItems.filter(item => 
      item.name.includes('צ\'ולנט')
    );
    
    this.meatSpecials = this.cholentItems.filter(item => 
      !item.name.includes('צ\'ולנט') && (
        item.name.includes('המבורגר') || 
        item.name.includes('שניצל') ||
        item.name.includes('כבד')
      )
    );
    
    this.sidesItems = this.cholentItems.filter(item => 
      item.name.includes('קוגל') || 
      item.name.includes('צ\'יפס')
    );
    
    this.dessertsItems = this.cholentItems.filter(item => 
      item.name.includes('סופלה') || 
      item.name.includes('קינוחים') ||
      item.name.includes('שתייה') ||
      item.name.includes('בירה')
    );
  }

  addToCart(item: MenuItem): void {
    const price = item.price || 0;
    if (price <= 0) {
      console.error(`Cannot add ${item.name} to cart: no price available`);
      return;
    }

    this.cartService.addItem({
      id: item.id || item._id || '',
      name: item.name,
      price: price,
      imageUrl: item.imageUrl || '',
      description: item.description || '',
      category: item.category || 'cholent'
    });
  }

  getPrice(item: MenuItem): number {
    return item.price || 0;
  }
}
