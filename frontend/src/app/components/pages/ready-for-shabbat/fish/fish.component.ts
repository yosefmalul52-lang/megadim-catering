import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { MenuService, MenuItem } from '../../../../services/menu.service';
import { CartService } from '../../../../services/cart.service';

@Component({
  selector: 'app-fish',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './fish.component.html',
  styleUrls: ['./fish.component.scss']
})
export class FishComponent implements OnInit {
  fishDishes: MenuItem[] = [];
  isLoading: boolean = true;

  constructor(
    private menuService: MenuService,
    private cartService: CartService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.menuService.getProductsByCategory('fish').subscribe({
      next: (items) => {
        this.fishDishes = items;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading fish:', err);
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
      category: item.category || 'fish'
    });
  }

  viewDetails(item: MenuItem): void {
    const id = item.id || item._id;
    if (id) this.router.navigate(['/ready-for-shabbat/fish', id]);
  }

  getPrice(item: MenuItem): number {
    return item.price || item.pricePer100g || (item.pricingOptions?.[0]?.price) || 0;
  }
}
