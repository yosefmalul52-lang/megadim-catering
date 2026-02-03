import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { MenuService, MenuItem } from '../../../../services/menu.service';
import { CartService } from '../../../../services/cart.service';

@Component({
  selector: 'app-side-dishes',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './side-dishes.component.html',
  styleUrls: ['./side-dishes.component.scss']
})
export class SideDishesComponent implements OnInit {
  sideDishes: MenuItem[] = [];
  isLoading: boolean = true;

  constructor(
    private menuService: MenuService,
    private cartService: CartService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Fetch 'sides' category
    this.menuService.getProductsByCategory('sides').subscribe({
      next: (items) => {
        this.sideDishes = items;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading sides:', err);
        this.isLoading = false;
      }
    });
  }

  addToCart(item: MenuItem): void {
    const price = this.getPrice(item);
    if (price <= 0) {
      console.error(`Cannot add ${item.name} to cart: no price available`);
      return;
    }

    this.cartService.addItem({
      id: item.id || item._id || '',
      name: item.name,
      price: price,
      imageUrl: item.imageUrl,
      description: item.description,
      category: item.category || 'sides'
    });
  }

  viewDetails(item: MenuItem): void {
    const id = item.id || item._id;
    if (id) this.router.navigate(['/ready-for-shabbat/sides', id]);
  }

  getPrice(item: MenuItem): number {
    return item.price || item.pricePer100g || (item.pricingOptions?.[0]?.price) || 0;
  }
}
