import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { OrderService, Order, OrderItem } from '../../../services/order.service';
import { AuthService } from '../../../services/auth.service';
import { CartService, CartItem } from '../../../services/cart.service';
import { OrderDetailsModalComponent } from '../../modals/order-details-modal/order-details-modal.component';

@Component({
  selector: 'app-my-orders',
  standalone: true,
  imports: [CommonModule, RouterLink, OrderDetailsModalComponent],
  template: `
    <div class="my-orders-page">
      <div class="my-orders-container">
        <!-- Logout (top-left) -->
        <div class="logout-btn-wrapper">
          <button
            type="button"
            class="btn-logout"
            (click)="onLogout()"
            [disabled]="isLoggingOut"
          >
            <i class="fas fa-sign-out-alt" aria-hidden="true"></i>
            <span>{{ isLoggingOut ? 'מתנתק...' : 'התנתק' }}</span>
          </button>
        </div>

        <!-- Header (line–diamond–title–diamond–line, match shabbat-menu) -->
        <header class="page-header">
          <span class="decorative-line"></span>
          <span class="decorative-diamond"></span>
          <h1>ההזמנות שלי</h1>
          <span class="decorative-diamond"></span>
          <span class="decorative-line"></span>
          <p *ngIf="!isLoading && orders.length > 0" class="page-header-sub">
            {{ orders.length === 1 ? 'יש לך הזמנה 1 קודמת' : 'יש לך ' + orders.length + ' הזמנות קודמות' }}
          </p>
        </header>

        <!-- Loading -->
        <section *ngIf="isLoading" class="state state-loading">
          <div class="spinner">
            <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
          </div>
          <p>טוען את ההזמנות שלך...</p>
        </section>

        <!-- Error -->
        <section *ngIf="!isLoading && errorMessage" class="state state-error">
          <i class="fas fa-exclamation-circle" aria-hidden="true"></i>
          <p>{{ errorMessage }}</p>
        </section>

        <!-- Empty -->
        <section *ngIf="!isLoading && !errorMessage && orders.length === 0" class="state state-empty">
          <div class="empty-icon">
            <i class="fas fa-shopping-bag" aria-hidden="true"></i>
          </div>
          <h2>עדיין לא ביצעת הזמנות</h2>
          <p>כשתזמין פעם ראשונה, כל ההיסטוריה שלך תופיע כאן.</p>
          <a routerLink="/" class="btn-primary">
            <i class="fas fa-utensils" aria-hidden="true"></i>
            להתחלת הזמנה
          </a>
        </section>

        <!-- Orders List -->
        <section *ngIf="!isLoading && !errorMessage && orders.length > 0" class="orders-list">
          <article
            class="order-card"
            *ngFor="let order of orders; trackBy: trackByOrderId"
          >
            <div class="card-header">
              <div class="header-right">
                <span class="order-date"><i class="far fa-calendar-alt" aria-hidden="true"></i> {{ order.createdAt | date:'dd/MM/yyyy' }}</span>
                <span class="order-id">#{{ getOrderIdSuffix(order) }}</span>
              </div>
              <div class="header-left">
                <span class="status-badge" [ngClass]="order.status">{{ translateStatus(order.status) }}</span>
              </div>
            </div>

            <div class="card-body">
              <div class="items-summary">
                <i class="fas fa-shopping-bag" aria-hidden="true"></i>
                <p>{{ formatItems(order.items) }}</p>
              </div>
              <div class="order-total">
                <span class="total-label">סה"כ לתשלום</span>
                <span class="total-amount">₪{{ order.totalPrice | number:'1.2-2' }}</span>
              </div>
            </div>

            <div class="card-footer">
              <button type="button" class="btn-outline" (click)="viewOrderDetails(order)">
                <i class="far fa-eye" aria-hidden="true"></i> צפה בפרטים
              </button>
              <button type="button" class="btn-primary-gold" (click)="reorder(order)">
                <i class="fas fa-sync-alt" aria-hidden="true"></i> הזמן שוב
              </button>
            </div>
          </article>
        </section>
      </div>

      <app-order-details-modal
        *ngIf="selectedOrder"
        [order]="selectedOrder"
        (close)="closeOrderModal()"
      ></app-order-details-modal>
    </div>
  `,
  styles: [`
    $navy: #0f172a;
    $navy-soft: #111827;
    $gold: #c5a059;
    $gold-soft: #f3e6c6;
    $bg: #f3f4f6;
    $text-main: #111827;
    $text-muted: #6b7280;
    $border: #e5e7eb;
    $radius-card: 16px;
    $radius-pill: 999px;
    $shadow-soft: 0 10px 30px rgba(15, 23, 42, 0.05);
    $shadow-strong: 0 20px 45px rgba(15, 23, 42, 0.12);
    $font-he: 'Segoe UI', 'Heebo', 'Arial Hebrew', Arial, sans-serif;

    .my-orders-page {
      min-height: 80vh;
      padding: 40px 0;
      background: radial-gradient(circle at top left, rgba(197, 160, 89, 0.08), transparent 55%),
                  radial-gradient(circle at bottom right, rgba(15, 23, 42, 0.08), transparent 55%),
                  $bg;
      direction: rtl;
      display: flex;
      justify-content: center;
      box-sizing: border-box;
    }

    .my-orders-container {
      max-width: 800px;
      width: 100%;
      margin: 40px auto;
      padding: 0 20px;
      box-sizing: border-box;
      direction: rtl;
      position: relative;
    }

    .logout-btn-wrapper {
      position: absolute;
      top: 0;
      left: 0;
      margin: 0;
      padding: 0;
      z-index: 10;
    }

    .page-header {
      display: flex;
      align-items: center;
      justify-content: center;
      flex-wrap: wrap;
      gap: 20px;
      margin-bottom: 40px;
      padding-top: 44px;
      text-align: center;
    }

    .page-header .decorative-line {
      flex: 1;
      max-width: 200px;
      height: 2px;
      border-radius: 2px;
    }

    .page-header .decorative-line:first-of-type {
      background: linear-gradient(to left, transparent, $gold);
    }

    .page-header .decorative-line:last-of-type {
      background: linear-gradient(to right, transparent, $gold);
    }

    .page-header .decorative-diamond {
      width: 12px;
      height: 12px;
      background-color: $gold;
      transform: rotate(45deg);
      flex-shrink: 0;
      box-shadow: 0 2px 4px rgba(197, 160, 89, 0.3);
    }

    .page-header h1 {
      margin: 0;
      font-family: $font-he;
      font-size: 2.4rem;
      font-weight: 700;
      color: $navy-soft;
      letter-spacing: -0.04em;
      flex-shrink: 0;
    }

    .page-header-sub {
      width: 100%;
      margin: 10px 0 0;
      font-family: $font-he;
      font-size: 1.05rem;
      color: $text-muted;
    }

    .state {
      text-align: center;
      font-family: $font-he;
      padding: 48px 24px;
      border-radius: $radius-card;
      background: #ffffff;
      box-shadow: $shadow-soft;
      border: 1px solid $border;

      &.state-loading {
        .spinner {
          margin-bottom: 16px;

          i {
            font-size: 2.4rem;
            color: $gold;
          }
        }

        p {
          margin: 0;
          color: $text-muted;
          font-size: 1rem;
        }
      }

      &.state-error {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;

        i {
          font-size: 2rem;
          color: #dc2626;
        }

        p {
          margin: 0;
          color: #b91c1c;
          font-size: 1rem;
        }
      }

      &.state-empty {
        .empty-icon {
          margin-bottom: 20px;

          i {
            font-size: 3rem;
            color: $gold-soft;
          }
        }

        h2 {
          margin: 0 0 10px;
          font-size: 1.6rem;
          font-weight: 700;
          color: $navy-soft;
        }

        p {
          margin: 0 0 24px;
          font-size: 1rem;
          color: $text-muted;
        }
      }
    }

    .btn-primary {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 18px;
      border-radius: $radius-pill;
      border: none;
      background: linear-gradient(135deg, $navy, #1f2937);
      color: #ffffff;
      font-family: $font-he;
      font-size: 0.95rem;
      font-weight: 600;
      text-decoration: none;
      cursor: pointer;
      box-shadow: 0 10px 30px rgba(15, 23, 42, 0.35);
      transition: all 0.2s ease;

      &:hover {
        transform: translateY(-1px);
        box-shadow: $shadow-strong;
      }

      i {
        font-size: 0.9rem;
      }
    }

    .orders-list {
      display: block;
    }

    .order-card {
      background: #ffffff;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);
      margin-bottom: 24px;
      border: 1px solid #f3f4f6;
      border-right: 4px solid #c5a059;
      overflow: hidden;
      transition: all 0.3s ease;

      &:hover {
        box-shadow: 0 8px 30px rgba(0, 0, 0, 0.08);
        transform: translateY(-2px);
      }

      .card-header {
        background: #fafafa;
        padding: 16px 24px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid #f3f4f6;

        .header-right {
          display: flex;
          align-items: center;
          gap: 15px;
        }

        .order-date {
          font-weight: 600;
          color: #1f2937;
          display: flex;
          align-items: center;
          gap: 6px;
          font-family: $font-he;
          font-size: 0.95rem;

          i {
            color: $gold;
          }
        }

        .order-id {
          color: #9ca3af;
          font-size: 0.9rem;
          font-family: $font-he;
        }

        .header-left {
          display: flex;
          align-items: center;
        }

        .status-badge {
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 0.85rem;
          font-weight: 600;
          font-family: $font-he;
          white-space: nowrap;

          &.pending,
          &.new {
            background: #fef3c7;
            color: #d97706;
          }

          &.completed,
          &.delivered,
          &.ready {
            background: #d1fae5;
            color: #059669;
          }

          &.processing,
          &.in-progress {
            background: #e0f2fe;
            color: #0284c7;
          }

          &.cancelled {
            background: #fee2e2;
            color: #b91c1c;
          }
        }
      }

      .card-body {
        padding: 24px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 16px;
        direction: rtl;
        text-align: right;

        .items-summary {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          color: #4b5563;
          max-width: 60%;
          font-family: $font-he;
          direction: rtl;
          text-align: right;

          i {
            color: #c5a059;
            margin-top: 4px;
            font-size: 1rem;
          }

          p {
            margin: 0;
            line-height: 1.5;
            font-size: 0.95rem;
            unicode-bidi: isolate;
          }
        }

        .order-total {
          text-align: left;
          font-family: $font-he;

          .total-label {
            display: block;
            font-size: 0.85rem;
            color: #6b7280;
            margin-bottom: 4px;
          }

          .total-amount {
            font-size: 1.8rem;
            font-weight: 700;
            color: #1f2937;
          }
        }
      }

      .card-footer {
        padding: 16px 24px;
        background: #ffffff;
        border-top: 1px solid #f3f4f6;
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        flex-wrap: wrap;

        button {
          padding: 10px 20px;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: 0.2s;
          font-family: $font-he;
          font-size: 0.9rem;
          border: none;
        }

        .btn-outline {
          background: transparent;
          border: 1px solid #d1d5db;
          color: #374151;

          &:hover {
            background: #f3f4f6;
          }
        }

        .btn-primary-gold {
          background: #1f2937;
          color: #c5a059;

          &:hover {
            background: #111827;
          }
        }
      }
    }

    .btn-logout {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 9px 20px;
      border-radius: 8px;
      border: none;
      background: linear-gradient(135deg, #dc2626, #b91c1c);
      color: #ffffff;
      font-family: $font-he;
      font-size: 0.95rem;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 14px rgba(220, 38, 38, 0.3);
      transition: all 0.2s ease;

      &:hover:not(:disabled) {
        transform: translateY(-1px);
        box-shadow: 0 6px 20px rgba(220, 38, 38, 0.4);
      }

      &:disabled {
        opacity: 0.7;
        cursor: not-allowed;
      }
    }

    @media (max-width: 768px) {
      .my-orders-page {
        padding: 24px 0;
      }

      .my-orders-container {
        padding: 0 16px;
        margin-top: 24px;
      }

      .order-card .card-body {
        flex-direction: column;
        align-items: flex-start;

        .items-summary {
          max-width: 100%;
        }
      }

      .order-card .card-footer {
        flex-direction: column;
        align-items: stretch;

        button {
          justify-content: center;
          width: 100%;
        }
      }
    }
  `]
})
export class MyOrdersComponent implements OnInit {
  private orderService = inject(OrderService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private cartService = inject(CartService);

  orders: Order[] = [];
  isLoading = true;
  errorMessage = '';
  isLoggingOut = false;
  selectedOrder: Order | null = null;

  ngOnInit(): void {
    this.loadMyOrders();
  }

  loadMyOrders(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.orderService.getMyOrders().subscribe({
      next: (orders) => {
        this.orders = orders;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading orders:', error);
        this.errorMessage = error.error?.message || 'שגיאה בטעינת ההזמנות. אנא נסה שוב.';
        this.isLoading = false;
      }
    });
  }

  formatDate(date: string | Date, includeTime: boolean = false): string {
    if (!date) return '';
    const d = new Date(date);
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

  getOrderIdShort(order: Order): string {
    const orderId = order.id || order._id;
    if (!orderId) return 'N/A';
    return orderId.toString().substring(0, 8);
  }

  private static readonly STATUS_TRANSLATIONS: Record<string, string> = {
    pending: 'ממתין לאישור',
    processing: 'בהכנה',
    completed: 'סופק',
    cancelled: 'בוטל',
    new: 'התקבלה',
    'in-progress': 'בהכנה',
    ready: 'מוכן למשלוח',
    delivered: 'נמסר'
  };

  translateStatus(status: string): string {
    return MyOrdersComponent.STATUS_TRANSLATIONS[status] || status;
  }

  getStatusLabel(status: string): string {
    return this.translateStatus(status);
  }

  getStatusClass(status: string): string {
    return `status-${status}`;
  }

  getItemDisplayName(item: OrderItem): string {
    const name = (item as any).name || (item as any).productName || '';
    const variant = (item as any).variant ?? (item as any).size ?? (item as any).selectedOption?.label ?? '';
    if (!variant) return name;
    if (name.includes('(') && name.includes(')')) return name;
    const cleanVariant = String(variant).split('-')[0].trim();
    if (!cleanVariant) return name;
    return name.trim() + ' (' + cleanVariant + ')';
  }

  formatItems(items: OrderItem[] | null | undefined): string {
    if (!items || items.length === 0) return 'אין פריטים';
    const formatSingleItem = (item: any) => {
      let variantStr = '';
      if (item.variant) {
        const cleanVariant = item.variant.split('-')[0].trim();
        variantStr = cleanVariant ? ` (${cleanVariant})` : '';
      } else if (item.size) {
        const cleanSize = String(item.size).split('-')[0].trim();
        variantStr = cleanSize ? ` (${cleanSize})` : '';
      }
      const name = item.name || item.productName || '';
      return `${name}${variantStr} x${item.quantity ?? 1}`;
    };
    const firstTwo = items.slice(0, 2).map(formatSingleItem).join(', ');
    return items.length > 2 ? `${firstTwo} ועוד ${items.length - 2} פריטים...` : firstTwo;
  }

  getItemsSummary(items: OrderItem[]): string {
    return this.formatItems(items);
  }

  getOrderIdSuffix(order: Order): string {
    const id = order.id || order._id;
    if (!id) return '';
    const str = typeof id === 'string' ? id : String(id);
    return str.length >= 6 ? str.slice(-6) : str;
  }

  trackByOrderId(index: number, order: Order): string {
    return order.id || order._id || index.toString();
  }

  viewOrderDetails(order: Order): void {
    const orderId = order.id || order._id;
    if (!orderId) {
      console.error('Order ID is missing');
      return;
    }

    // Fetch full order details from backend
    this.orderService.getOrderById(orderId).subscribe({
      next: (fullOrder) => {
        if (fullOrder) {
          this.selectedOrder = fullOrder;
        } else {
          console.error('Order not found');
        }
      },
      error: (error) => {
        console.error('Error fetching order details:', error);
        // Fallback: use the order from the list
        this.selectedOrder = order;
      }
    });
  }

  closeOrderModal(): void {
    this.selectedOrder = null;
  }

  onLogout(): void {
    this.isLoggingOut = true;
    this.authService.logout();
    // Router will handle navigation via AuthService, but we can also navigate here
    setTimeout(() => {
      this.router.navigate(['/']);
      this.isLoggingOut = false;
    }, 100);
  }

  reorder(order: Order): void {
    if (!order || !order.items || order.items.length === 0) {
      return;
    }

    const confirmed = window.confirm('האם תרצה לרוקן את העגלה הנוכחית ולהוסיף את פריטי ההזמנה הזו?');
    if (!confirmed) {
      return;
    }

    this.cartService.clearCart();

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

    this.router.navigate(['/checkout']);
  }
}

