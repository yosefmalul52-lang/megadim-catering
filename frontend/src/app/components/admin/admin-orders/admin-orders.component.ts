import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { interval, Subscription } from 'rxjs';
import { startWith, switchMap } from 'rxjs/operators';

import { OrderService, Order } from '../../../services/order.service';
import { KitchenReportModalComponent } from '../../modals/kitchen-report-modal/kitchen-report-modal.component';

@Component({
  selector: 'app-admin-orders',
  standalone: true,
  imports: [CommonModule, FormsModule, KitchenReportModalComponent],
  template: `
    <div class="admin-orders-page">
      <div class="container">
        <div class="page-header">
          <div class="header-content">
            <p class="page-description">צפה וניהול כל ההזמנות</p>
            <div class="header-actions">
              <button 
                class="btn-kitchen-report"
                (click)="openKitchenReport()"
                data-tooltip="דוח הכנות למטבח"
                [attr.aria-label]="'דוח הכנות למטבח'"
              >
                <i class="fas fa-utensils"></i>
                דוח מטבח
              </button>
              <button 
                class="btn-refresh"
                (click)="manualRefresh()"
                [disabled]="isRefreshing"
                data-tooltip="רענן רשימת הזמנות"
                [attr.aria-label]="'רענן רשימת הזמנות'"
              >
                <i class="fas fa-sync-alt" [class.fa-spin]="isRefreshing"></i>
                <span *ngIf="!isRefreshing">רענן</span>
                <span *ngIf="isRefreshing">מרענן...</span>
              </button>
            </div>
          </div>
          <div class="auto-refresh-indicator" *ngIf="autoRefreshEnabled">
            <i class="fas fa-circle" [class.pulse]="true"></i>
            <span>עדכון אוטומטי פעיל (כל 30 שניות)</span>
          </div>
        </div>

        <!-- Loading State -->
        <div *ngIf="isLoading" class="loading">
          <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
          <span>טוען הזמנות...</span>
        </div>

        <!-- Orders Table -->
        <div *ngIf="!isLoading" class="table-container">
          <table class="orders-table">
            <thead>
              <tr>
                <th>תאריך ושעה</th>
                <th>לקוח</th>
                <th>טלפון</th>
                <th>סה"כ</th>
                <th>סטטוס</th>
                <th>פעולות</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let order of orders; trackBy: trackByOrderId">
                <td class="date-cell">
                  {{ formatDate(order.createdAt) }}
                </td>
                <td class="customer-cell">
                  {{ order.customerDetails.fullName || 'לא צוין' }}
                </td>
                <td class="phone-cell">
                  {{ order.customerDetails.phone || 'לא צוין' }}
                </td>
                <td class="total-cell">
                  ₪{{ order.totalPrice | number:'1.2-2' }}
                </td>
                <td class="status-cell">
                  <select 
                    class="status-select"
                    [value]="order.status"
                    (change)="updateStatus(order, $event)"
                    [attr.aria-label]="'עדכן סטטוס הזמנה ' + (order._id || order.id)"
                  >
                    <option value="new">חדש</option>
                    <option value="in-progress">בטיפול</option>
                    <option value="ready">מוכן</option>
                    <option value="delivered">נמסר</option>
                    <option value="cancelled">בוטל</option>
                  </select>
                  <span class="status-badge" [ngClass]="'status-' + order.status">
                    {{ getStatusLabel(order.status) }}
                  </span>
                </td>
                <td class="actions-cell">
                  <button 
                    class="btn-view-details"
                    (click)="viewOrderDetails(order)"
                    data-tooltip="צפה בפרטי הזמנה"
                    [attr.aria-label]="'צפה בפרטי הזמנה ' + (order._id || order.id)"
                  >
                    <i class="fas fa-eye"></i>
                    פרטים
                  </button>
                </td>
              </tr>
            </tbody>
          </table>

          <!-- Empty State -->
          <div *ngIf="orders.length === 0" class="empty-state">
            <i class="fas fa-shopping-cart" aria-hidden="true"></i>
            <h3>אין הזמנות כרגע</h3>
            <p>כשיתקבלו הזמנות חדשות, הן יופיעו כאן</p>
          </div>
        </div>

        <!-- Order Details Modal -->
        <div class="modal-overlay" *ngIf="selectedOrder" (click)="closeModal()">
          <div class="modal-content" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h2>פרטי הזמנה</h2>
              <button class="btn-close" (click)="closeModal()" aria-label="סגור">
                <i class="fas fa-times"></i>
              </button>
            </div>
            
            <div class="modal-body" *ngIf="selectedOrder">
              <!-- Customer Details -->
              <div class="details-section">
                <h3>פרטי לקוח</h3>
                <div class="detail-row">
                  <span class="detail-label">שם מלא:</span>
                  <span class="detail-value">{{ selectedOrder.customerDetails.fullName || 'לא צוין' }}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">טלפון:</span>
                  <span class="detail-value">{{ selectedOrder.customerDetails.phone || 'לא צוין' }}</span>
                </div>
                <div class="detail-row" *ngIf="selectedOrder.customerDetails.email">
                  <span class="detail-label">אימייל:</span>
                  <span class="detail-value">{{ selectedOrder.customerDetails.email }}</span>
                </div>
                <div class="detail-row" *ngIf="selectedOrder.customerDetails.address">
                  <span class="detail-label">כתובת:</span>
                  <span class="detail-value">{{ selectedOrder.customerDetails.address }}</span>
                </div>
                <div class="detail-row" *ngIf="selectedOrder.customerDetails.notes">
                  <span class="detail-label">הערות:</span>
                  <span class="detail-value">{{ selectedOrder.customerDetails.notes }}</span>
                </div>
              </div>

              <!-- Order Items -->
              <div class="details-section">
                <h3>פריטי ההזמנה</h3>
                <div class="items-list">
                  <div 
                    *ngFor="let item of selectedOrder.items; let i = index" 
                    class="order-item"
                  >
                    <div class="item-info">
                      <span class="item-name">{{ item.name }}</span>
                      <span class="item-quantity">x{{ item.quantity }}</span>
                      <span class="item-price" *ngIf="item.selectedOption">
                        ({{ item.selectedOption.label }} - {{ item.selectedOption.amount }})
                      </span>
                    </div>
                    <div class="item-total">
                      ₪{{ (item.price * item.quantity) | number:'1.2-2' }}
                    </div>
                  </div>
                </div>
              </div>

              <!-- Order Summary -->
              <div class="details-section">
                <div class="order-summary">
                  <div class="summary-row">
                    <span class="summary-label">סה"כ הזמנה:</span>
                    <span class="summary-value">₪{{ selectedOrder.totalPrice | number:'1.2-2' }}</span>
                  </div>
                  <div class="summary-row">
                    <span class="summary-label">סטטוס:</span>
                    <span class="summary-value status-badge" [class]="'status-' + selectedOrder.status">
                      {{ getStatusLabel(selectedOrder.status) }}
                    </span>
                  </div>
                  <div class="summary-row">
                    <span class="summary-label">תאריך הזמנה:</span>
                    <span class="summary-value">{{ formatDate(selectedOrder.createdAt) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Success/Error Messages -->
        <div *ngIf="successMessage" class="message success-message">
          <i class="fas fa-check-circle"></i>
          {{ successMessage }}
        </div>
        <div *ngIf="errorMessage" class="message error-message">
          <i class="fas fa-exclamation-circle"></i>
          {{ errorMessage }}
        </div>
      </div>

      <!-- Kitchen Report Modal -->
      <app-kitchen-report-modal *ngIf="showKitchenReport" (closeModal)="closeKitchenReport()"></app-kitchen-report-modal>
    </div>
  `,
  styles: [`
    .admin-orders-page {
      padding: 2rem 0;
      min-height: 70vh;
      background: #f8f9fa;
    }

    .container {
      max-width: 1400px;
      margin: 0 auto;
      padding: 0 2rem;
    }

    .page-header {
      margin-bottom: 2rem;
    }

    .header-content {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 1rem;
    }

    .header-content > div:first-child {
      text-align: right;
    }

    .page-header h1 {
      color: #0E1A24;
      font-size: 2.5rem;
      margin-bottom: 0.5rem;
      font-weight: bold;
    }

    .page-header p {
      color: #6c757d;
      font-size: 1.1rem;
    }

    .header-actions {
      display: flex;
      gap: 1rem;
      align-items: center;
    }

    .btn-kitchen-report {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.75rem 1.5rem;
      background: transparent;
      color: #1a2a3a;
      border: 2px solid #1a2a3a;
      border-radius: 0.5rem;
      font-weight: 600;
      font-size: 0.95rem;
      cursor: pointer;
      transition: all 0.3s ease;
    }

    .btn-kitchen-report:hover {
      background: #1a2a3a;
      color: white;
      transform: translateY(-1px);
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.15);
    }

    .btn-kitchen-report i {
      font-size: 1rem;
    }

    .btn-refresh {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.75rem 1.5rem;
      background: #1f3444;
      color: white;
      border: none;
      border-radius: 0.5rem;
      font-weight: 600;
      font-size: 0.95rem;
      cursor: pointer;
      transition: all 0.3s ease;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    .btn-refresh:hover:not(:disabled) {
      background: #2a4a5f;
      transform: translateY(-1px);
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.15);
    }

    .btn-refresh:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .btn-refresh i {
      font-size: 1rem;
    }

    .btn-refresh i.fa-spin {
      animation: fa-spin 1s infinite linear;
    }

    .auto-refresh-indicator {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-top: 1rem;
      padding: 0.5rem 1rem;
      background: #e8f5e9;
      border-radius: 0.5rem;
      font-size: 0.85rem;
      color: #2e7d32;
      text-align: right;
    }

    .auto-refresh-indicator i {
      font-size: 0.6rem;
      color: #4caf50;
    }

    .auto-refresh-indicator i.pulse {
      animation: pulse 2s infinite;
    }

    @keyframes pulse {
      0%, 100% {
        opacity: 1;
      }
      50% {
        opacity: 0.5;
      }
    }

    .loading {
      text-align: center;
      padding: 3rem 0;
      color: #6c757d;
    }

    .loading i {
      font-size: 2rem;
      margin-bottom: 1rem;
      color: #cbb69e;
    }

    /* Premium Table Container */
    .table-container {
      background: white;
      border-radius: 12px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
      overflow: hidden;
    }

    .orders-table {
      width: 100%;
      border-collapse: collapse;
    }

    .orders-table thead {
      background: #1f3444;
      border-bottom: 2px solid #0E1A24;
    }

    .orders-table th {
      padding: 16px;
      text-align: right;
      font-weight: 700;
      font-size: 0.85rem;
      text-transform: uppercase;
      color: white;
      letter-spacing: 0.5px;
      border: none;
    }

    .orders-table tbody tr {
      background: white;
      border-bottom: 1px solid #eee;
      transition: background-color 0.2s ease;
    }

    .orders-table tbody tr:hover {
      background-color: #f9fafb;
    }

    .orders-table td {
      padding: 16px;
      vertical-align: middle;
      font-size: 0.95rem;
      border: none;
    }

    .date-cell {
      font-size: 0.9rem;
      color: #6c757d;
      white-space: nowrap;
    }

    .customer-cell {
      font-weight: 600;
      color: #0E1A24;
    }

    .phone-cell {
      font-family: monospace;
      color: #6c757d;
    }

    .total-cell {
      font-weight: 700;
      color: #1f3444;
      font-size: 1.1rem;
    }

    .status-cell {
      position: relative;
    }

    .status-select {
      padding: 0.5rem 1rem;
      border: 2px solid #ddd;
      border-radius: 0.5rem;
      background: white;
      font-size: 0.9rem;
      color: #0E1A24;
      cursor: pointer;
      transition: border-color 0.3s ease;
      width: 100%;
      max-width: 150px;
    }

    .status-select:hover {
      border-color: #cbb69e;
    }

    .status-select:focus {
      outline: none;
      border-color: #cbb69e;
      box-shadow: 0 0 0 3px rgba(203, 182, 158, 0.1);
    }

    /* Premium Status Badges */
    .status-badge {
      display: inline-block;
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 0.8rem;
      font-weight: 600;
      margin-right: 0.5rem;
      white-space: nowrap;
    }

    .status-new {
      background: #e3f2fd;
      color: #1565c0;
    }

    .status-in-progress {
      background: #fff3e0;
      color: #ef6c00;
    }

    .status-ready {
      background: #f3e5f5;
      color: #7b1fa2;
    }

    .status-delivered {
      background: #e8f5e9;
      color: #2e7d32;
    }

    .status-cancelled {
      background: #ffebee;
      color: #c62828;
    }

    .actions-cell {
      text-align: center;
    }

    /* Premium Action Button */
    .btn-view-details {
      padding: 0.5rem 0.75rem;
      background: transparent;
      color: #1f3444;
      border: none;
      border-radius: 0.375rem;
      cursor: pointer;
      font-weight: 700;
      font-size: 0.9rem;
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      transition: all 0.2s ease;
      text-decoration: none;
    }

    .btn-view-details:hover {
      text-decoration: underline;
      color: #0E1A24;
    }

    .btn-view-details i {
      font-size: 0.85rem;
    }

    .empty-state {
      text-align: center;
      padding: 4rem 2rem;
      color: #6c757d;
    }

    .empty-state i {
      font-size: 4rem;
      color: #cbb69e;
      margin-bottom: 1rem;
    }

    /* Modal Styles */
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 2rem;
    }

    .modal-content {
      background: white;
      border-radius: 1rem;
      max-width: 700px;
      width: 100%;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1.5rem;
      border-bottom: 1px solid #eee;
    }

    .modal-header h2 {
      color: #0E1A24;
      margin: 0;
      font-size: 1.5rem;
    }

    .btn-close {
      background: none;
      border: none;
      font-size: 1.5rem;
      color: #6c757d;
      cursor: pointer;
      padding: 0.5rem;
      transition: color 0.3s ease;
    }

    .btn-close:hover {
      color: #0E1A24;
    }

    .modal-body {
      padding: 1.5rem;
    }

    .details-section {
      margin-bottom: 2rem;
    }

    .details-section h3 {
      color: #0E1A24;
      font-size: 1.2rem;
      margin-bottom: 1rem;
      padding-bottom: 0.5rem;
      border-bottom: 2px solid #cbb69e;
    }

    .detail-row {
      display: flex;
      justify-content: space-between;
      padding: 0.75rem 0;
      border-bottom: 1px solid #f0f0f0;
    }

    .detail-label {
      font-weight: 600;
      color: #6c757d;
    }

    .detail-value {
      color: #0E1A24;
      text-align: left;
    }

    .items-list {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .order-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem;
      background: #f8f9fa;
      border-radius: 0.5rem;
    }

    .item-info {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .item-name {
      font-weight: 600;
      color: #0E1A24;
    }

    .item-quantity {
      color: #6c757d;
      font-size: 0.9rem;
    }

    .item-price {
      color: #6c757d;
      font-size: 0.85rem;
    }

    .item-total {
      font-weight: 700;
      color: #1f3444;
      font-size: 1.1rem;
    }

    .order-summary {
      background: #f8f9fa;
      padding: 1.5rem;
      border-radius: 0.5rem;
    }

    .summary-row {
      display: flex;
      justify-content: space-between;
      padding: 0.75rem 0;
      border-bottom: 1px solid #e0e0e0;
    }

    .summary-row:last-child {
      border-bottom: none;
    }

    .summary-label {
      font-weight: 600;
      color: #6c757d;
    }

    .summary-value {
      color: #0E1A24;
      font-weight: 600;
    }

    .message {
      padding: 1rem;
      border-radius: 0.5rem;
      margin-top: 1rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .success-message {
      background: #d4edda;
      color: #155724;
    }

    .error-message {
      background: #f8d7da;
      color: #721c24;
    }

    /* Responsive */
    @media (max-width: 768px) {
      .orders-table {
        font-size: 0.85rem;
      }

      .orders-table th,
      .orders-table td {
        padding: 0.5rem;
      }

      .status-select {
        max-width: 120px;
        font-size: 0.8rem;
      }

      .modal-content {
        margin: 1rem;
        max-height: 95vh;
      }
    }
  `]
})
export class AdminOrdersComponent implements OnInit, OnDestroy {
  orderService = inject(OrderService);

  orders: Order[] = [];
  isLoading = true;
  isRefreshing = false;
  selectedOrder: Order | null = null;
  showKitchenReport = false;
  successMessage = '';
  errorMessage = '';
  
  private autoRefreshSubscription?: Subscription;
  private previousOrderCount = 0;
  autoRefreshEnabled = true;
  private readonly REFRESH_INTERVAL = 30000; // 30 seconds

  ngOnInit(): void {
    this.loadOrders();
    this.startAutoRefresh();
  }

  ngOnDestroy(): void {
    this.stopAutoRefresh();
  }

  private startAutoRefresh(): void {
    if (!this.autoRefreshEnabled) return;

    // Start immediately and then every 30 seconds
    this.autoRefreshSubscription = interval(this.REFRESH_INTERVAL)
      .pipe(
        startWith(0), // Start immediately
        switchMap(() => {
          // Silent refresh - don't show loading spinner
          return this.orderService.getAllOrders();
        })
      )
      .subscribe({
        next: (orders: Order[]) => {
          const newOrderCount = orders.length;
          
          // Check if new orders were added
          if (newOrderCount > this.previousOrderCount && this.previousOrderCount > 0) {
            const newOrdersCount = newOrderCount - this.previousOrderCount;
            this.successMessage = `התקבלו ${newOrdersCount} הזמנות חדשות!`;
            setTimeout(() => {
              this.successMessage = '';
            }, 5000);
            
            // Play subtle notification sound (optional - browser may block autoplay)
            this.playNotificationSound();
          }
          
          // Update orders silently
          this.orders = orders;
          this.previousOrderCount = newOrderCount;
          this.isRefreshing = false;
        },
        error: (error: any) => {
          console.error('Error in auto-refresh:', error);
          this.isRefreshing = false;
          // Don't show error message for background refresh failures
        }
      });
  }

  private stopAutoRefresh(): void {
    if (this.autoRefreshSubscription) {
      this.autoRefreshSubscription.unsubscribe();
      this.autoRefreshSubscription = undefined;
    }
  }

  private playNotificationSound(): void {
    // Create a subtle notification sound using Web Audio API
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 800; // Higher pitch
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime); // Low volume
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.2);
    } catch (error) {
      // Browser may block audio autoplay - silently fail
      console.debug('Could not play notification sound:', error);
    }
  }

  manualRefresh(): void {
    if (this.isRefreshing) return;
    
    this.isRefreshing = true;
    this.loadOrders();
  }

  loadOrders(): void {
    // Only show full loading spinner on initial load
    if (!this.isRefreshing) {
      this.isLoading = true;
    }
    
    this.orderService.getAllOrders().subscribe({
      next: (orders: Order[]) => {
        const newOrderCount = orders.length;
        
        // Check if new orders were added (only on manual refresh)
        if (this.isRefreshing && newOrderCount > this.previousOrderCount && this.previousOrderCount > 0) {
          const newOrdersCount = newOrderCount - this.previousOrderCount;
          this.successMessage = `התקבלו ${newOrdersCount} הזמנות חדשות!`;
          setTimeout(() => {
            this.successMessage = '';
          }, 5000);
        }
        
        this.orders = orders;
        this.previousOrderCount = newOrderCount;
        this.isLoading = false;
        this.isRefreshing = false;
        console.log('✅ Loaded orders:', orders.length);
      },
      error: (error: any) => {
        console.error('Error loading orders:', error);
        this.errorMessage = 'שגיאה בטעינת ההזמנות';
        this.isLoading = false;
        this.isRefreshing = false;
      }
    });
  }

  updateStatus(order: Order, event: Event): void {
    const select = event.target as HTMLSelectElement;
    const newStatus = select.value as Order['status'];
    const orderId = order._id || order.id || '';

    if (!orderId) {
      this.errorMessage = 'שגיאה: מזהה הזמנה חסר';
      return;
    }

    // Optimistically update UI
    const originalStatus = order.status;
    order.status = newStatus;

    this.orderService.updateOrderStatus(orderId, newStatus).subscribe({
      next: (updatedOrder: Order) => {
        // Update the order in the list
        const index = this.orders.findIndex(o => (o._id || o.id) === orderId);
        if (index > -1) {
          this.orders[index] = updatedOrder;
        }
        this.successMessage = `סטטוס ההזמנה עודכן ל-${this.getStatusLabel(newStatus)}`;
        setTimeout(() => {
          this.successMessage = '';
        }, 3000);
      },
      error: (error: any) => {
        console.error('Error updating order status:', error);
        // Revert the change
        order.status = originalStatus;
        select.value = originalStatus;
        this.errorMessage = 'שגיאה בעדכון סטטוס ההזמנה';
        setTimeout(() => {
          this.errorMessage = '';
        }, 3000);
      }
    });
  }

  viewOrderDetails(order: Order): void {
    this.selectedOrder = order;
  }

  closeModal(): void {
    this.selectedOrder = null;
  }

  openKitchenReport(): void {
    this.showKitchenReport = true;
  }

  closeKitchenReport(): void {
    this.showKitchenReport = false;
  }

  formatDate(date: string | Date | undefined): string {
    if (!date) return 'לא צוין';
    const d = new Date(date);
    return d.toLocaleDateString('he-IL', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getStatusLabel(status: string): string {
    const labels: { [key: string]: string } = {
      'new': 'חדש',
      'in-progress': 'בטיפול',
      'ready': 'מוכן',
      'delivered': 'נמסר',
      'cancelled': 'בוטל'
    };
    return labels[status] || status;
  }

  trackByOrderId(index: number, order: Order): string {
    return order._id || order.id || '';
  }
}

