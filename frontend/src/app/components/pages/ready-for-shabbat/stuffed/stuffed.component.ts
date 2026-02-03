import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { MenuService, MenuItem } from '../../../../services/menu.service';
import { CartService } from '../../../../services/cart.service';

@Component({
  selector: 'app-stuffed',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './stuffed.component.html',
  styleUrls: ['./stuffed.component.scss']
})
export class StuffedComponent implements OnInit {
  stuffedDishes: MenuItem[] = [];
  isLoading: boolean = true;

  constructor(
    private menuService: MenuService,
    private cartService: CartService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Fetch 'stuffed' category (maps to 'ממולאים' in MenuService)
    this.menuService.getProductsByCategory('stuffed').subscribe({
      next: (items) => {
        this.stuffedDishes = items;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading stuffed:', err);
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
      category: item.category || 'stuffed'
    });
  }

  viewDetails(item: MenuItem): void {
    const id = item.id || item._id;
    if (id) this.router.navigate(['/ready-for-shabbat/stuffed', id]);
  }

  getPrice(item: MenuItem): number {
    return item.price || item.pricePer100g || (item.pricingOptions?.[0]?.price) || 0;
  }
}

