import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { CartService, CartItem } from '../../../services/cart.service';
import { LocaleService } from '../../../i18n/locale.service';
import { localizedProductName } from '../../../i18n/localized-content';

@Component({
  selector: 'app-cart-page',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslateModule],
  templateUrl: './cart-page.component.html',
  styleUrls: ['./cart-page.component.scss']
})
export class CartPageComponent implements OnInit {
  cartService = inject(CartService);
  localeService = inject(LocaleService);
  private translate = inject(TranslateService);
  cartItems: CartItem[] = [];
  cartSummary = this.cartService.cartSummary;

  ngOnInit(): void {
    this.cartService.cartItems$.subscribe(items => {
      this.cartItems = items;
      this.cartSummary = this.cartService.cartSummary;
    });
  }

  displayName(item: CartItem): string {
    return this.cleanItemName(localizedProductName(item, this.localeService.locale));
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
    if (confirm(this.translate.instant('CART.CLEAR_CONFIRM'))) {
      this.cartService.clearCart();
    }
  }

  trackByItemId(_index: number, item: CartItem): string {
    return item.id;
  }
}
