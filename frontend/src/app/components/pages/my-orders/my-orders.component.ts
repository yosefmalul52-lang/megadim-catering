import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { OrderService, Order } from '../../../services/order.service';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-my-orders',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="my-orders-page">
      <div class="container">
        <div class="page-header">
          <div class="header-top">
            <h1>ההזמנות שלי</h1>
            <div class="header-actions">
              <button
                type="button"
                class="btn-logout"
                (click)="onLogout()"
                [disabled]="isLoggingOut"
                title="התנתק מהחשבון"
              >
                <i class="fas fa-sign-out-alt" aria-hidden="true"></i>
                <span>התנתק</span>
              </button>
            </div>
          </div>
          <p *ngIf="!isLoading && orders.length === 0" class="no-orders-message">
            עדיין לא ביצעת הזמנות. <a routerLink="/">עיין בתפריט שלנו</a>
          </p>
        </div>

        <div *ngIf="isLoading" class="loading-state">
          <i class="fas fa-spinner fa-spin"></i>
          <p>טוען הזמנות...</p>
        </div>

        <div *ngIf="!isLoading && orders.length > 0" class="orders-list">
          <div *ngFor="let order of orders; trackBy: trackByOrderId" class="order-card">
            <div class="order-header">
              <div class="order-info">
                <h3>הזמנה #{{ order.id || order._id }}</h3>
                <span class="order-date">{{ formatDate(order.createdAt) }}</span>
              </div>
              <div class="order-status">
                <span class="status-badge" [ngClass]="'status-' + order.status">
                  {{ getStatusLabel(order.status) }}
                </span>
              </div>
            </div>

            <div class="order-items">
              <h4>פריטים:</h4>
              <ul>
                <li *ngFor="let item of order.items" class="order-item">
                  <div class="item-info">
                    <span class="item-name">{{ item.name }}</span>
                    <span class="item-quantity">x{{ item.quantity }}</span>
                  </div>
                  <span class="item-price">₪{{ (item.price * item.quantity) | number:'1.2-2' }}</span>
                </li>
              </ul>
            </div>

            <div class="order-footer">
              <div class="order-total">
                <strong>סה"כ: ₪{{ order.totalPrice | number:'1.2-2' }}</strong>
              </div>
              <div class="order-details" *ngIf="order.customerDetails">
                <p *ngIf="order.customerDetails.address">
                  <i class="fas fa-map-marker-alt"></i>
                  {{ order.customerDetails.address }}
                </p>
                <p *ngIf="order.customerDetails.notes">
                  <i class="fas fa-sticky-note"></i>
                  {{ order.customerDetails.notes }}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div *ngIf="!isLoading && errorMessage" class="error-message">
          <i class="fas fa-exclamation-circle"></i>
          {{ errorMessage }}
        </div>
      </div>
    </div>
  `,
  styles: [`
    .my-orders-page {
      min-height: 60vh;
      padding: 2rem 0;
      background-color: #f8f9fa;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 2rem;
    }

    .page-header {
      text-align: center;
      margin-bottom: 3rem;
    }

    .header-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
      gap: 1rem;
      flex-wrap: wrap;
    }

    .page-header h1 {
      color: #0E1A24;
      font-size: 2.5rem;
      margin: 0;
      flex: 1;
      text-align: right;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .btn-logout {
      padding: 0.875rem 1.75rem;
      font-size: 1rem;
      font-weight: 600;
      border: 2px solid #d32f2f;
      border-radius: 0.5rem;
      cursor: pointer;
      transition: all 0.3s ease;
      background: transparent;
      color: #d32f2f;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      white-space: nowrap;
      direction: rtl;
      min-width: 140px;
      justify-content: center;
      box-shadow: 0 2px 4px rgba(211, 47, 47, 0.1);
    }

    .btn-logout:hover:not(:disabled) {
      background: #d32f2f;
      color: white;
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(211, 47, 47, 0.4);
      border-color: #b71c1c;
    }

    .btn-logout:active:not(:disabled) {
      transform: translateY(0);
    }

    .btn-logout:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
    }

    .btn-logout i {
      font-size: 1rem;
    }

    .no-orders-message {
      color: #6c757d;
      font-size: 1.1rem;
    }

    .no-orders-message a {
      color: #1f3444;
      text-decoration: none;
      font-weight: 600;
    }

    .no-orders-message a:hover {
      text-decoration: underline;
    }

    .loading-state {
      text-align: center;
      padding: 4rem 0;
      color: #6c757d;
    }

    .loading-state i {
      font-size: 3rem;
      margin-bottom: 1rem;
      color: #1f3444;
    }

    .orders-list {
      display: flex;
      flex-direction: column;
      gap: 2rem;
    }

    .order-card {
      background: white;
      border-radius: 0.75rem;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      padding: 2rem;
      transition: transform 0.3s ease, box-shadow 0.3s ease;
    }

    .order-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 12px rgba(0, 0, 0, 0.15);
    }

    .order-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5rem;
      padding-bottom: 1rem;
      border-bottom: 2px solid #e9ecef;
    }

    .order-info h3 {
      color: #0E1A24;
      margin: 0 0 0.5rem 0;
      font-size: 1.5rem;
    }

    .order-date {
      color: #6c757d;
      font-size: 0.9rem;
    }

    .status-badge {
      display: inline-block;
      padding: 0.5rem 1rem;
      border-radius: 1rem;
      font-size: 0.875rem;
      font-weight: 600;
      text-transform: uppercase;
    }

    .status-new {
      background-color: #e3f2fd;
      color: #1976d2;
    }

    .status-in-progress {
      background-color: #fff3e0;
      color: #f57c00;
    }

    .status-ready {
      background-color: #e8f5e9;
      color: #388e3c;
    }

    .status-delivered {
      background-color: #f1f8e9;
      color: #689f38;
    }

    .status-cancelled {
      background-color: #ffebee;
      color: #d32f2f;
    }

    .order-items {
      margin-bottom: 1.5rem;
    }

    .order-items h4 {
      color: #0E1A24;
      margin-bottom: 1rem;
      font-size: 1.1rem;
    }

    .order-items ul {
      list-style: none;
      padding: 0;
      margin: 0;
    }

    .order-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.75rem 0;
      border-bottom: 1px solid #f0f0f0;
    }

    .order-item:last-child {
      border-bottom: none;
    }

    .item-info {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .item-name {
      color: #0E1A24;
      font-weight: 500;
    }

    .item-quantity {
      color: #6c757d;
      font-size: 0.9rem;
    }

    .item-price {
      color: #0E1A24;
      font-weight: 600;
    }

    .order-footer {
      padding-top: 1rem;
      border-top: 2px solid #e9ecef;
    }

    .order-total {
      text-align: left;
      font-size: 1.25rem;
      color: #0E1A24;
      margin-bottom: 1rem;
    }

    .order-details {
      color: #6c757d;
      font-size: 0.9rem;
    }

    .order-details p {
      margin: 0.5rem 0;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .order-details i {
      color: #1f3444;
    }

    .error-message {
      text-align: center;
      padding: 2rem;
      background-color: #ffebee;
      color: #d32f2f;
      border-radius: 0.5rem;
      margin-top: 2rem;
    }

    .error-message i {
      margin-left: 0.5rem;
    }

    @media (max-width: 768px) {
      .header-top {
        flex-direction: column;
        align-items: stretch;
      }

      .page-header h1 {
        font-size: 2rem;
        text-align: center;
      }

      .btn-logout {
        width: 100%;
        justify-content: center;
      }

      .order-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 1rem;
      }

      .order-card {
        padding: 1.5rem;
      }
    }
  `]
})
export class MyOrdersComponent implements OnInit {
  private orderService = inject(OrderService);
  private authService = inject(AuthService);
  private router = inject(Router);

  orders: Order[] = [];
  isLoading = true;
  errorMessage = '';
  isLoggingOut = false;

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

  formatDate(date: string | Date): string {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('he-IL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getStatusLabel(status: string): string {
    const statusMap: { [key: string]: string } = {
      'new': 'חדש',
      'in-progress': 'בביצוע',
      'ready': 'מוכן',
      'delivered': 'נמסר',
      'cancelled': 'בוטל'
    };
    return statusMap[status] || status;
  }

  trackByOrderId(index: number, order: Order): string {
    return order.id || order._id || index.toString();
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
}

