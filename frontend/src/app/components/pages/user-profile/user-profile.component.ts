import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

import { AuthService, User } from '../../../services/auth.service';
import { OrderService, Order, OrderItem } from '../../../services/order.service';
import { CartService, CartItem } from '../../../services/cart.service';

@Component({
  selector: 'app-user-profile',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './user-profile.component.html',
  styleUrls: ['./user-profile.component.scss']
})
export class UserProfileComponent implements OnInit {
  private authService = inject(AuthService);
  private orderService = inject(OrderService);
  private cartService = inject(CartService);
  private router = inject(Router);

  currentUser: User | null = null;
  orders: Order[] = [];
  isLoading = true;
  errorMessage = '';

  ngOnInit(): void {
    this.currentUser = this.authService.currentUser;
    this.loadOrders();
  }

  get customerName(): string {
    if (!this.currentUser) {
      return 'אורח';
    }
    return this.currentUser.fullName || this.currentUser.username || this.currentUser.name || 'לקוח';
  }

  get hasOrders(): boolean {
    return this.orders && this.orders.length > 0;
  }

  loadOrders(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.orderService.getMyOrders().subscribe({
      next: (orders) => {
        this.orders = orders || [];
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading user orders:', error);
        this.errorMessage = error?.error?.message || 'שגיאה בטעינת היסטוריית ההזמנות. אנא נסה שוב מאוחר יותר.';
        this.isLoading = false;
      }
    });
  }

  formatDate(date: string | Date | undefined | null, includeTime: boolean = false): string {
    if (!date) {
      return '';
    }

    const d = new Date(date);
    if (Number.isNaN(d.getTime())) {
      return '';
    }

    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    };

    if (includeTime) {
      options.hour = '2-digit';
      options.minute = '2-digit';
    }

    return d.toLocaleDateString('he-IL', options);
  }

  getStatusLabel(status: string): string {
    const map: Record<string, string> = {
      pending: 'ממתין',
      processing: 'בטיפול',
      ready: 'מוכן',
      delivered: 'נמסר',
      cancelled: 'בוטל',
      'in-progress': 'בהכנה',
      new: 'התקבלה'
    };
    return map[status] || status;
  }

  getStatusClass(status: string): string {
    return `status-${status}`;
  }

  getItemsSummary(items: OrderItem[]): string {
    if (!items || items.length === 0) {
      return '';
    }

    const parts = items.map((item) => {
      const quantity = item.quantity || 1;
      return `${quantity}x ${item.name}`;
    });

    const summary = parts.join(', ');
    return summary.length > 80 ? summary.substring(0, 77) + '...' : summary;
  }

  trackByOrderId(index: number, order: Order): string {
    return (order.id as string) || ((order as any)._id as string) || index.toString();
  }

  reorder(order: Order): void {
    if (!order || !order.items || order.items.length === 0) {
      return;
    }

    const confirmed = window.confirm('האם תרצה לרוקן את העגלה הנוכחית ולהוסיף את פריטי ההזמנה הזו?');
    if (!confirmed) {
      return;
    }

    // Clear existing cart
    this.cartService.clearCart();

    // Add items from past order into cart
    order.items.forEach((item: OrderItem) => {
      if (!item || !item.name) {
        return;
      }

      const productId = (item as any).productId || item.name;
      const quantity = item.quantity && item.quantity > 0 ? item.quantity : 1;

      const cartItem: CartItem = {
        id: String(productId),
        name: item.name,
        price: item.price,
        quantity,
        imageUrl: (item as any).imageUrl || '',
        category: (item as any).category,
        description: (item as any).description
      };

      try {
        this.cartService.addToCart(cartItem, quantity);
      } catch (err) {
        console.error('Failed to add item to cart from reorder:', err);
      }
    });

    // Navigate user directly to checkout
    this.router.navigate(['/checkout']);
  }
}

