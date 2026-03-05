import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CartService, CartItem } from '../../../services/cart.service';

@Component({
  selector: 'app-cart-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './cart-page.component.html',
  styleUrls: ['./cart-page.component.scss']
})
export class CartPageComponent implements OnInit {
  cartService = inject(CartService);
  cartItems: CartItem[] = [];
  cartSummary = this.cartService.cartSummary;

  ngOnInit(): void {
    this.cartService.cartItems$.subscribe(items => {
      this.cartItems = items;
      this.cartSummary = this.cartService.cartSummary;
    });
  }

  /** Removes duplicated size numbers from item names, e.g. "(250 מ\"ל - 250)" → "(250 מ\"ל)" */
  cleanItemName(name: string): string {
    if (!name) return '';
    return name.replace(/\s*-\s*\d+\s*\)/g, ')');
  }

  removeItem(itemId: string): void {
    this.cartService.removeItem(itemId);
  }

  increaseQuantity(itemId: string): void {
    this.cartService.increaseQuantity(itemId);
  }

  decreaseQuantity(itemId: string): void {
    this.cartService.decreaseQuantity(itemId);
  }

  clearCart(): void {
    if (confirm('האם אתה בטוח שברצונך לנקות את העגלה?')) {
      this.cartService.clearCart();
    }
  }

  trackByItemId(_index: number, item: CartItem): string {
    return item.id;
  }
}
