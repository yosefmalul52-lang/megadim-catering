import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { OrderService, Order } from '../../../services/order.service';
import { AuthService } from '../../../services/auth.service';
import { OrderDetailsModalComponent } from '../../modals/order-details-modal/order-details-modal.component';

@Component({
  selector: 'app-my-orders',
  standalone: true,
  imports: [CommonModule, RouterLink, OrderDetailsModalComponent],
  template: `
    <div class="my-orders-page">
      <div class="container">
        <!-- Page Header -->
        <div class="page-header">
          <h1 class="page-title">ההזמנות שלי</h1>
          <p class="page-subtitle" *ngIf="!isLoading && orders.length > 0">
            סה"כ {{ orders.length }} הזמנות
          </p>
        </div>

        <!-- Loading State -->
        <div *ngIf="isLoading" class="loading-state">
          <div class="loading-spinner">
            <i class="fas fa-spinner fa-spin"></i>
          </div>
          <p class="loading-text">טוען הזמנות...</p>
        </div>

        <!-- Empty State -->
        <div *ngIf="!isLoading && orders.length === 0 && !errorMessage" class="empty-state">
          <div class="empty-icon">
            <i class="fas fa-shopping-bag"></i>
          </div>
          <h2 class="empty-title">עדיין לא ביצעת הזמנות</h2>
          <p class="empty-message">התחל להזמין מהתפריט המגוון שלנו</p>
          <a routerLink="/" class="btn-start-ordering">
            <i class="fas fa-utensils" aria-hidden="true"></i>
            התחל להזמין
          </a>
        </div>

        <!-- Orders Grid -->
        <div *ngIf="!isLoading && orders.length > 0" class="orders-grid">
          <div *ngFor="let order of orders; trackBy: trackByOrderId" class="order-card">
            <!-- Card Header -->
            <div class="order-card-header">
              <div class="order-date">
                <i class="fas fa-calendar-alt" aria-hidden="true"></i>
                <span>{{ formatDate(order.createdAt) }}</span>
              </div>
              <div class="order-id">
                #{{ getOrderIdShort(order) }}
              </div>
            </div>

            <!-- Card Body -->
            <div class="order-card-body">
              <div class="order-total">
                <span class="total-label">סה"כ</span>
                <span class="total-amount">₪{{ order.totalPrice | number:'1.2-2' }}</span>
              </div>
              <div class="order-items-count">
                <i class="fas fa-box" aria-hidden="true"></i>
                <span>{{ order.items.length }} פריטים</span>
              </div>
            </div>

            <!-- Card Footer -->
            <div class="order-card-footer">
              <span class="status-badge" [ngClass]="getStatusClass(order.status)">
                {{ getStatusLabel(order.status) }}
              </span>
              <button
                type="button"
                class="btn-view-details"
                (click)="viewOrderDetails(order)"
                [attr.aria-label]="'צפה בפרטי הזמנה ' + (order.id || order._id)"
              >
                <i class="fas fa-eye" aria-hidden="true"></i>
                <span>צפה בפרטים</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Error Message -->
        <div *ngIf="!isLoading && errorMessage" class="error-message">
          <i class="fas fa-exclamation-circle" aria-hidden="true"></i>
          <span>{{ errorMessage }}</span>
        </div>

        <!-- Logout Button -->
        <div class="logout-section">
          <button
            type="button"
            class="btn-logout"
            (click)="onLogout()"
            [disabled]="isLoggingOut"
            [attr.aria-label]="'התנתק'"
          >
            <i class="fas fa-sign-out-alt" aria-hidden="true"></i>
            <span>{{ isLoggingOut ? 'מתנתק...' : 'התנתק' }}</span>
          </button>
        </div>
      </div>

      <!-- Order Details Modal -->
      <app-order-details-modal
        *ngIf="selectedOrder"
        [order]="selectedOrder"
        (close)="closeOrderModal()"
      ></app-order-details-modal>
    </div>
  `,
  styles: [`
    /* ============================================
       Variables (Luxury Gold/Black/White Theme)
       ============================================ */
    $color-gold: #C5B19B;
    $color-gold-light: #E8DCC8;
    $color-gold-dark: #A08B6F;
    $color-black: #0E1A24;
    $color-navy: #1f3444;
    $color-white: #FFFFFF;
    $color-gray-light: #F5F5F5;
    $color-gray: #6c757d;
    $color-gray-dark: #4A4A4A;
    
    $font-family-hebrew: 'Segoe UI', 'Arial Hebrew', 'David', 'Guttman Yad', 'Arial', sans-serif;
    
    $border-radius: 12px;
    $shadow-subtle: 0 4px 15px rgba(0, 0, 0, 0.05);
    $shadow-hover: 0 8px 25px rgba(0, 0, 0, 0.12);
    
    /* ============================================
       Page Layout
       ============================================ */
    .my-orders-page {
      min-height: 80vh;
      padding: 3rem 0;
      background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%);
      direction: rtl;
    }

    .container {
      max-width: 1400px;
      margin: 0 auto;
      padding: 0 2rem;
    }

    /* ============================================
       Page Header
       ============================================ */
    .page-header {
      text-align: right;
      margin-bottom: 3rem;
    }

    .page-title {
      font-family: $font-family-hebrew;
      font-size: 2.75rem;
      font-weight: 700;
      color: $color-black;
      margin: 0 0 0.5rem 0;
      letter-spacing: -0.5px;
    }

    .page-subtitle {
      font-family: $font-family-hebrew;
      font-size: 1.1rem;
      color: $color-gray;
      margin: 0;
      font-weight: 400;
    }

    /* ============================================
       Logout Section
       ============================================ */
    .logout-section {
      display: flex;
      justify-content: center;
      align-items: center;
      margin-top: 4rem;
      padding-top: 3rem;
      border-top: 1px solid $color-gray-light;
    }

    .btn-logout {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.875rem 2rem;
      font-family: $font-family-hebrew;
      font-size: 1.05rem;
      font-weight: 600;
      color: $color-white;
      background: linear-gradient(135deg, #d32f2f 0%, #c62828 100%);
      border: none;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.3s ease;
      box-shadow: $shadow-subtle;
      white-space: nowrap;

      &:hover:not(:disabled) {
        transform: translateY(-2px);
        box-shadow: $shadow-hover;
        background: linear-gradient(135deg, #c62828 0%, #b71c1c 100%);
      }

      &:active:not(:disabled) {
        transform: translateY(0);
      }

      &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      i {
        font-size: 1rem;
      }
    }

    /* ============================================
       Loading State
       ============================================ */
    .loading-state {
      text-align: center;
      padding: 6rem 0;
    }

    .loading-spinner {
      margin-bottom: 1.5rem;
      
      i {
        font-size: 3.5rem;
        color: $color-gold;
        animation: spin 1s linear infinite;
      }
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    .loading-text {
      font-family: $font-family-hebrew;
      font-size: 1.2rem;
      color: $color-gray;
      margin: 0;
    }

    /* ============================================
       Empty State
       ============================================ */
    .empty-state {
      text-align: center;
      padding: 6rem 2rem;
      max-width: 500px;
      margin: 0 auto;
    }

    .empty-icon {
      margin-bottom: 2rem;
      
      i {
        font-size: 5rem;
        color: $color-gold-light;
      }
    }

    .empty-title {
      font-family: $font-family-hebrew;
      font-size: 2rem;
      font-weight: 700;
      color: $color-black;
      margin: 0 0 1rem 0;
    }

    .empty-message {
      font-family: $font-family-hebrew;
      font-size: 1.1rem;
      color: $color-gray;
      margin: 0 0 2.5rem 0;
      line-height: 1.6;
    }

    .btn-start-ordering {
      display: inline-flex;
      align-items: center;
      gap: 0.75rem;
      padding: 1rem 2rem;
      font-family: $font-family-hebrew;
      font-size: 1.1rem;
      font-weight: 600;
      color: $color-white;
      background: linear-gradient(135deg, $color-black 0%, $color-navy 100%);
      border: none;
      border-radius: $border-radius;
      cursor: pointer;
      text-decoration: none;
      transition: all 0.3s ease;
      box-shadow: $shadow-subtle;

      &:hover {
        transform: translateY(-2px);
        box-shadow: $shadow-hover;
        background: linear-gradient(135deg, $color-navy 0%, $color-black 100%);
      }

      i {
        font-size: 1rem;
      }
    }

    /* ============================================
       Orders Grid
       ============================================ */
    .orders-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 2rem;
      margin-bottom: 2rem;
    }

    /* ============================================
       Order Card
       ============================================ */
    .order-card {
      background: $color-white;
      border-radius: $border-radius;
      box-shadow: $shadow-subtle;
      padding: 1.75rem;
      transition: all 0.3s ease;
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
      border: 1px solid rgba(0, 0, 0, 0.05);

      &:hover {
        transform: translateY(-4px);
        box-shadow: $shadow-hover;
        border-color: $color-gold-light;
      }
    }

    /* Card Header */
    .order-card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 1rem;
      border-bottom: 1px solid $color-gray-light;
    }

    .order-date {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-family: $font-family-hebrew;
      font-size: 0.95rem;
      font-weight: 500;
      color: $color-gray-dark;

      i {
        color: $color-gold;
        font-size: 0.9rem;
      }
    }

    .order-id {
      font-family: $font-family-hebrew;
      font-size: 0.85rem;
      color: $color-gray;
      font-weight: 400;
      letter-spacing: 0.5px;
    }

    /* Card Body */
    .order-card-body {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      flex-grow: 1;
    }

    .order-total {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .total-label {
      font-family: $font-family-hebrew;
      font-size: 0.9rem;
      color: $color-gray;
      font-weight: 500;
    }

    .total-amount {
      font-family: $font-family-hebrew;
      font-size: 2rem;
      font-weight: 700;
      color: $color-black;
      line-height: 1.2;
    }

    .order-items-count {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-family: $font-family-hebrew;
      font-size: 0.95rem;
      color: $color-gray-dark;
      font-weight: 500;

      i {
        color: $color-gold;
        font-size: 0.9rem;
      }
    }

    /* Card Footer */
    .order-card-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
      padding-top: 1rem;
      border-top: 1px solid $color-gray-light;
    }

    /* ============================================
       Status Badge
       ============================================ */
    .status-badge {
      display: inline-flex;
      align-items: center;
      padding: 0.5rem 1rem;
      border-radius: 50px;
      font-family: $font-family-hebrew;
      font-size: 0.85rem;
      font-weight: 600;
      white-space: nowrap;
    }

    .status-new {
      background-color: rgba(25, 118, 210, 0.1);
      color: #1976d2;
    }

    .status-in-progress {
      background-color: rgba(255, 152, 0, 0.1);
      color: #f57c00;
    }

    .status-ready {
      background-color: rgba(76, 175, 80, 0.1);
      color: #4caf50;
    }

    .status-delivered {
      background-color: rgba(76, 175, 80, 0.15);
      color: #2e7d32;
    }

    .status-cancelled {
      background-color: rgba(211, 47, 47, 0.1);
      color: #d32f2f;
    }

    /* ============================================
       View Details Button
       ============================================ */
    .btn-view-details {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.65rem 1.25rem;
      font-family: $font-family-hebrew;
      font-size: 0.9rem;
      font-weight: 600;
      color: $color-black;
      background: transparent;
      border: 2px solid $color-black;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.3s ease;
      white-space: nowrap;

      &:hover {
        background: $color-black;
        color: $color-white;
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      }

      &:active {
        transform: translateY(0);
      }

      i {
        font-size: 0.9rem;
      }
    }

    /* ============================================
       Error Message
       ============================================ */
    .error-message {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.75rem;
      padding: 1.5rem 2rem;
      background-color: rgba(211, 47, 47, 0.1);
      color: #d32f2f;
      border-radius: $border-radius;
      font-family: $font-family-hebrew;
      font-size: 1rem;
      font-weight: 500;
      margin-top: 2rem;

      i {
        font-size: 1.2rem;
      }
    }

    /* ============================================
       Responsive Design
       ============================================ */
    @media (max-width: 1024px) {
      .orders-grid {
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        gap: 1.5rem;
      }
    }

    @media (max-width: 768px) {
      .my-orders-page {
        padding: 2rem 0;
      }

      .container {
        padding: 0 1.5rem;
      }

      .page-title {
        font-size: 2.25rem;
      }

      .orders-grid {
        grid-template-columns: 1fr;
        gap: 1.25rem;
      }

      .order-card {
        padding: 1.5rem;
      }

      .order-card-footer {
        flex-direction: column;
        align-items: stretch;
        gap: 0.75rem;
      }

      .btn-view-details {
        width: 100%;
        justify-content: center;
      }

      .logout-section {
        margin-top: 3rem;
        padding-top: 2rem;
      }

      .btn-logout {
        width: 100%;
        justify-content: center;
        padding: 1rem 2rem;
      }
    }

    @media (max-width: 480px) {
      .page-title {
        font-size: 1.75rem;
      }

      .order-card {
        padding: 1.25rem;
      }

      .total-amount {
        font-size: 1.75rem;
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

  getStatusLabel(status: string): string {
    const statusMap: { [key: string]: string } = {
      'new': 'התקבלה',
      'in-progress': 'בהכנה',
      'ready': 'מוכן למשלוח',
      'delivered': 'נמסר',
      'cancelled': 'בוטל'
    };
    return statusMap[status] || status;
  }

  getStatusClass(status: string): string {
    return `status-${status}`;
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
}

