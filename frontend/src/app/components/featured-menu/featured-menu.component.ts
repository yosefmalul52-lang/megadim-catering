import { Component, ElementRef, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { CartService } from '../../services/cart.service';
import { MenuService, MenuItem } from '../../services/menu.service';
import { QuantitySelectorComponent } from '../shared/quantity-selector/quantity-selector.component';

interface Category {
  id: string;
  name: string;
  image: string;
}

@Component({
  selector: 'app-featured-menu',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatIconModule,
    MatSnackBarModule,
    QuantitySelectorComponent,
  ],
  templateUrl: './featured-menu.component.html',
  styleUrls: ['./featured-menu.component.scss'],
})
export class FeaturedMenuComponent implements OnInit {
  private readonly cartService = inject(CartService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly menuService = inject(MenuService);

  @ViewChild('categoryTrack') categoryTrack?: ElementRef<HTMLElement>;

  readonly categories: Category[] = [
    {
      id: 'salads',
      name: 'סלטים',
      image: 'https://res.cloudinary.com/dioklg7lx/image/upload/v1768237285/Salads-category_qyrqyf.png',
    },
    {
      id: 'fish',
      name: 'דגים',
      image: 'https://res.cloudinary.com/dioklg7lx/image/upload/v1768906619/IMG_9719_mmhoct.jpg',
    },
    {
      id: 'main',
      name: 'מנות עיקריות',
      image: 'https://res.cloudinary.com/dioklg7lx/image/upload/v1768906616/IMG_9691_vlsp6w.jpg',
    },
    {
      id: 'sides',
      name: 'תוספות',
      image: 'https://res.cloudinary.com/dioklg7lx/image/upload/v1768906623/IMG_9705_voigt1.jpg',
    },
    {
      id: 'stuffed',
      name: 'ממולאים',
      image: 'https://res.cloudinary.com/dioklg7lx/image/upload/v1768169598/magadim-catering/zvaljwkf37merstx1wmx.jpg',
    },
  ];

  displayedProducts: MenuItem[] = [];
  isLoading = false;
  private readonly itemQuantities: Record<string, number> = {};

  ngOnInit(): void {
    this.loadFeaturedProducts();
  }

  getCategoryRoute(category: Category): string[] {
    return ['/ready-for-shabbat', category.id];
  }

  scrollCategories(direction: -1 | 1): void {
    const el = this.categoryTrack?.nativeElement;
    if (!el) return;

    const chip = el.querySelector<HTMLElement>('.category-chip');
    const styles = getComputedStyle(el);
    const gap = Number.parseFloat(styles.columnGap || styles.gap) || 24;
    const step = chip ? chip.offsetWidth + gap : 220;

    el.scrollBy({ left: direction * step, behavior: 'smooth' });
  }

  private loadFeaturedProducts(): void {
    this.isLoading = true;
    this.menuService.getFeaturedItems().subscribe({
      next: (items) => {
        this.displayedProducts = items;
        this.isLoading = false;
      },
      error: () => {
        this.displayedProducts = [];
        this.isLoading = false;
      },
    });
  }

  isAvailable(item: MenuItem): boolean {
    return item.isAvailable !== false;
  }

  getQuantity(item: MenuItem): number {
    const id = this.getItemId(item);
    return this.itemQuantities[id] ?? 1;
  }

  setQuantity(item: MenuItem, qty: number): void {
    const id = this.getItemId(item);
    if (!id) return;
    this.itemQuantities[id] = Math.max(1, qty);
  }

  getServingHint(item: MenuItem): string | null {
    return item.servingSize?.trim() || null;
  }

  getPriceLabel(item: MenuItem): string {
    const price = this.getUnitPrice(item);
    return price > 0 ? `₪${price}` : '';
  }

  private getUnitPrice(item: MenuItem): number {
    if (item.pricingOptions?.length) {
      return item.pricingOptions[0].price;
    }
    if (item.pricingVariants?.length) {
      return item.pricingVariants[0].price;
    }
    if (item.price != null && item.price > 0) {
      return item.price;
    }
    if (item.pricePer100g != null && item.pricePer100g > 0) {
      return item.pricePer100g;
    }
    return 0;
  }

  addToCart(item: MenuItem): void {
    if (!this.isAvailable(item)) return;

    const itemId = this.getItemId(item);
    const quantity = this.getQuantity(item);
    const price = this.getUnitPrice(item);
    const name = item.name;

    if (price <= 0) {
      this.snackBar.open('לא ניתן להוסיף את הפריט לסל — אין מחיר זמין', 'סגור', {
        duration: 3000,
        direction: 'rtl',
      });
      return;
    }

    this.cartService.addToCart(
      {
        id: itemId,
        name,
        price,
        imageUrl: item.imageUrl,
        description: item.description,
        category: item.category,
      },
      quantity
    );
    this.cartService.openCart();

    this.snackBar.open(`${item.name} התווסף להזמנה בהצלחה!`, 'סגור', {
      duration: 2500,
      direction: 'rtl',
    });
  }

  getItemId(item: MenuItem): string {
    return (item.id || item._id || '').toString();
  }
}
