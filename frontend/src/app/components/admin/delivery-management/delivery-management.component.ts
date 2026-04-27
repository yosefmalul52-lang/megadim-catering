import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OrderService } from '../../../services/order.service';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { ShippingService } from '../../../services/shipping.service';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../services/auth.service';
import { DriverUser, UsersService } from '../../../services/users.service';

interface DeliveryOrder {
  _id: string;
  status?: string;
  assignedDriverId?: string | null;
  assignedDriverName?: string;
  customerDetails: { name: string; phone: string };
  deliveryDetails: { address: string; city: string; floor: string | null; comments: string | null };
  totalPrice: number;
  isPaid: boolean;
  items?: { name: string; quantity: number; price?: number }[];
  notes?: string | null;
  deliveryMethod?: 'delivery' | 'pickup';
  eventDate?: string | null;
  preferredDeliveryTime?: string | null;
}

interface CityGroup {
  city: string;
  orders: DeliveryOrder[];
}

interface PickupGroup {
  time: string;
  orders: DeliveryOrder[];
}

const HEBREW_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

@Component({
  selector: 'app-delivery-management',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDatepickerModule, MatNativeDateModule],
  template: `
    <div class="delivery-management-page">
      <div class="container">
        <!-- Dashboard: Top section (title + print + calendar) then full-width orders list -->
        <div class="delivery-dashboard-container no-print" *ngIf="!isLoading && !errorMessage">
          <!-- Top section: Header (title + print) then Calendar -->
          <header class="dashboard-top-section">
            <div class="delivery-dashboard-header">
              <h1>סידור משלוחים</h1>
              <button 
                type="button"
                class="btn-print" 
                (click)="printManifest()" 
                [disabled]="selectedOrdersForPrint.size === 0">
                <i class="fas fa-print"></i>
                הדפס סידור עבודה ({{ selectedOrdersForPrint.size }} נבחרו)
              </button>
            </div>
            <div class="calendar-container">
              <div class="calendar-card">
                <div class="calendar-wrap">
                  <mat-calendar
                    [minDate]="fromDate"
                    [maxDate]="toDate"
                    [dateClass]="dateClass"
                    (selectedChange)="onCalendarDateSelected($event)">
                  </mat-calendar>
                </div>
                <div class="calendar-actions">
                  <button 
                    type="button" 
                    class="show-all-btn" 
                    *ngIf="selectedDayFilter"
                    (click)="showAllDays()">
                    הצג את כל השבוע
                  </button>
                  <p class="week-range" *ngIf="!selectedDayFilter">הצגה: {{ fromDateLabel }} – {{ toDateLabel }}</p>
                </div>
              </div>
            </div>
          </header>

          <!-- Orders list: full width below calendar -->
          <div class="orders-list-container">
            <!-- Global empty state when no orders in range -->
            <div *ngIf="!hasAnyOrders" class="global-empty-state">
              <i class="fas fa-calendar-check"></i>
              <h3>אין משלוחים מתוכננים</h3>
              <p>לא נמצאו הזמנות לטווח התאריכים המוצג.</p>
            </div>

            <!-- Days with orders only (empty days hidden) -->
            <div *ngIf="hasAnyOrders && displayDatesWithOrders.length > 0" class="week-list">
              <ng-container *ngFor="let dateStr of displayDatesWithOrders; trackBy: trackByDate">
                <div class="day-divider" [id]="'day-' + dateStr">
                  <h3>יום {{ getDayLabel(dateStr) }}, {{ formatDateShort(dateStr) }}</h3>
                  <span class="order-count-badge">{{ getOrderCountForDate(dateStr) }} הזמנות</span>
                </div>
                <ng-container *ngTemplateOutlet="dayOrdersTpl; context: { $implicit: dateStr }"></ng-container>
              </ng-container>
            </div>
          </div>
        </div>

        <!-- Page Header (when dashboard not shown: loading/error) -->
        <div class="page-header no-print" *ngIf="isLoading || errorMessage">
          <h1 class="page-title">סידור משלוחים</h1>
          <button 
            type="button"
            class="btn-print-manifest" 
            (click)="printManifest()" 
            [disabled]="true">
            <i class="fas fa-print"></i>
            הדפס סידור עבודה לנהג
          </button>
        </div>

        <!-- Loading State -->
        <div *ngIf="isLoading" class="loading-state">
          <i class="fas fa-spinner fa-spin"></i>
          <span>טוען דוח משלוחים...</span>
        </div>

        <!-- Success Toast -->
        <div *ngIf="successMessage" class="success-toast">
          <i class="fas fa-check-circle"></i>
          {{ successMessage }}
        </div>

        <!-- Error State -->
        <div *ngIf="errorMessage" class="error-state">
          <i class="fas fa-exclamation-circle"></i>
          {{ errorMessage }}
        </div>

        <!-- Print-only: Driver table (Name, Address, Phone, Amount, Checkbox) -->
        <div class="print-only-table" style="display: none;">
          <div class="print-header">
            <h1>סידור עבודה לנהג - מגדים</h1>
            <p class="print-date">{{ getPrintDate() }}</p>
          </div>
          <table class="driver-print-table">
            <thead>
              <tr>
                <th>שם</th>
                <th>כתובת</th>
                <th>טלפון</th>
                <th>סכום לגבייה</th>
                <th class="th-check">✓</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let order of allOrdersForPrint">
                <td>{{ order.customerDetails.name }}</td>
                <td>{{ order.deliveryDetails.address }}<span *ngIf="order.deliveryDetails.floor">, קומה {{ order.deliveryDetails.floor }}</span></td>
                <td>{{ order.customerDetails.phone }}</td>
                <td>{{ order.isPaid ? '—' : ('₪' + (order.totalPrice | number:'1.2-2')) }}</td>
                <td class="td-check">[ &nbsp; ]</td>
              </tr>
            </tbody>
          </table>
        </div>

        <ng-template #dayOrdersTpl let-dateStr>
          <ng-container *ngIf="getDayData(dateStr) as day">
            <!-- Deliveries by city for this day -->
            <div *ngIf="day.deliveryByCity.length > 0" class="cities-grid">
              <div *ngFor="let cityGroup of day.deliveryByCity; trackBy: trackByCity" class="city-card delivery-order-card">
                <div class="city-card-header card-header-row">
                  <h2 class="city-name">{{ cityGroup.city }}</h2>
                  <span class="delivery-count-badge">{{ cityGroup.orders.length }} משלוחים</span>
                </div>
                <div class="table-header grid-row">
                  <div class="header-column col-print"></div>
                  <div class="header-column col-time">שעה</div>
                  <div class="header-column customer-column">לקוח / טלפון</div>
                  <div class="header-column destination-column">כתובת</div>
                  <div class="header-column status-column">תשלום</div>
                  <div class="header-column actions-column">פעולות</div>
                </div>
                <div class="orders-list">
                  <details *ngFor="let order of cityGroup.orders; trackBy: trackByOrderId; let last = last" class="order-accordion" [class.delivered]="isOrderDelivered(order)" [class.is-selected]="selectedOrdersForPrint.has(order._id)" [class.last-row]="last">
                    <summary class="order-row grid-row">
                      <div class="order-column col-print" (click)="$event.stopPropagation()">
                        <input type="checkbox" class="print-checkbox" [checked]="selectedOrdersForPrint.has(order._id)" (change)="togglePrintSelection(order._id)" [attr.aria-label]="'בחור להדפסה'">
                      </div>
                      <div class="order-column col-time">{{ getDisplayTime(order) }}</div>
                      <div class="order-column customer-column">
                        <span class="customer-name">{{ order.customerDetails.name }}</span>
                        <a [href]="'tel:' + order.customerDetails.phone" class="customer-phone" (click)="$event.stopPropagation()"><i class="fas fa-phone"></i> {{ order.customerDetails.phone }}</a>
                      </div>
                      <div class="order-column destination-column">
                        <span class="address-text">{{ order.deliveryDetails.city }} – {{ order.deliveryDetails.address }}</span>
                        <span *ngIf="order.deliveryDetails.floor" class="floor-info">קומה {{ order.deliveryDetails.floor }}</span>
                      </div>
                      <div class="order-column status-column">
                        <span *ngIf="!order.isPaid" class="payment-badge unpaid">לא שולם</span>
                        <span *ngIf="order.isPaid" class="payment-badge paid">שולם</span>
                      </div>
                      <div class="order-column actions-column" (click)="$event.stopPropagation()">
                        <div *ngIf="isAdmin" class="assign-driver-wrap">
                          <select
                            class="driver-select"
                            [disabled]="assigningOrderId === order._id"
                            [value]="order.assignedDriverId || ''"
                            (change)="assignDriver(order._id, $any($event.target).value)"
                          >
                            <option value="">לא משויך</option>
                            <option *ngFor="let d of driverUsers" [value]="d._id">
                              {{ d.fullName || d.username }}
                            </option>
                          </select>
                        </div>
                        <div class="action-buttons">
                          <a [href]="getWazeLink(order.deliveryDetails.address)" target="_blank" class="action-btn waze-btn" title="Waze"><i class="fab fa-waze"></i></a>
                          <button type="button" class="action-btn whatsapp-btn" (click)="openWhatsapp(order)" title="WhatsApp"><i class="fab fa-whatsapp"></i></button>
                          <a [href]="'tel:' + order.customerDetails.phone" class="action-btn call-btn" title="התקשר"><i class="fas fa-phone"></i></a>
                          <button type="button" class="action-btn delivered-btn" (click)="markAsDelivered(order._id, cityGroup)" [disabled]="isMarkingDelivered === order._id || isOrderDelivered(order)" title="נמסר">
                            <i class="fas fa-spinner fa-spin" *ngIf="isMarkingDelivered === order._id"></i>
                            <i class="fas fa-check" *ngIf="isOrderDelivered(order)"></i>
                            <span *ngIf="!isOrderDelivered(order)" class="delivered-btn-text">נמסר</span>
                          </button>
                        </div>
                      </div>
                    </summary>
                    <div class="accordion-body">
                      <div class="body-section" *ngIf="order.items && order.items.length"><strong>פריטים:</strong><ul class="items-list"><li *ngFor="let item of order.items">{{ item.quantity }} × {{ item.name }}</li></ul></div>
                      <div class="body-section notes" *ngIf="order.notes || order.deliveryDetails.comments"><strong>הערות:</strong> {{ order.notes || order.deliveryDetails.comments }}</div>
                    </div>
                  </details>
                </div>
              </div>
            </div>
            <!-- Pickups by time for this day -->
            <div *ngIf="day.pickupByTime.length > 0" class="cities-grid pickup-section">
              <div *ngFor="let pickupGroup of day.pickupByTime; trackBy: trackByPickupTime" class="city-card delivery-order-card">
                <div class="city-card-header card-header-row">
                  <h2 class="city-name">איסוף – {{ pickupGroup.time }}</h2>
                  <span class="delivery-count-badge">{{ pickupGroup.orders.length }} הזמנות</span>
                </div>
                <div class="table-header grid-row">
                  <div class="header-column col-print"></div>
                  <div class="header-column customer-column">לקוח / טלפון</div>
                  <div class="header-column destination-column">כתובת / הערות</div>
                  <div class="header-column status-column">תשלום</div>
                  <div class="header-column actions-column">פעולות</div>
                </div>
                <div class="orders-list">
                  <details *ngFor="let order of pickupGroup.orders; trackBy: trackByOrderId; let last = last" class="order-accordion" [class.delivered]="isOrderDelivered(order)" [class.is-selected]="selectedOrdersForPrint.has(order._id)" [class.last-row]="last">
                    <summary class="order-row grid-row">
                      <div class="order-column col-print" (click)="$event.stopPropagation()">
                        <input type="checkbox" class="print-checkbox" [checked]="selectedOrdersForPrint.has(order._id)" (change)="togglePrintSelection(order._id)" [attr.aria-label]="'בחור להדפסה'">
                      </div>
                      <div class="order-column customer-column">
                        <span class="customer-name">{{ order.customerDetails.name }}</span>
                        <a [href]="'tel:' + order.customerDetails.phone" class="customer-phone" (click)="$event.stopPropagation()">{{ order.customerDetails.phone }}</a>
                      </div>
                      <div class="order-column destination-column">
                        <span class="address-text">{{ order.deliveryDetails.address }}</span>
                        <span *ngIf="order.deliveryDetails.comments" class="note-text"> – {{ order.deliveryDetails.comments }}</span>
                      </div>
                      <div class="order-column status-column">
                        <span *ngIf="!order.isPaid" class="payment-badge unpaid">לא שולם</span>
                        <span *ngIf="order.isPaid" class="payment-badge paid">שולם</span>
                      </div>
                      <div class="order-column actions-column" (click)="$event.stopPropagation()">
                        <div *ngIf="isAdmin" class="assign-driver-wrap">
                          <select
                            class="driver-select"
                            [disabled]="assigningOrderId === order._id"
                            [value]="order.assignedDriverId || ''"
                            (change)="assignDriver(order._id, $any($event.target).value)"
                          >
                            <option value="">לא משויך</option>
                            <option *ngFor="let d of driverUsers" [value]="d._id">
                              {{ d.fullName || d.username }}
                            </option>
                          </select>
                        </div>
                        <div class="action-buttons">
                          <button type="button" class="action-btn whatsapp-btn" (click)="openWhatsapp(order)" title="WhatsApp"><i class="fab fa-whatsapp"></i></button>
                          <a [href]="'tel:' + order.customerDetails.phone" class="action-btn call-btn" title="התקשר"><i class="fas fa-phone"></i></a>
                          <button type="button" class="action-btn delivered-btn" (click)="markAsDeliveredPickup(order._id, pickupGroup)" [disabled]="isMarkingDelivered === order._id || isOrderDelivered(order)" title="נמסר">
                            <i class="fas fa-spinner fa-spin" *ngIf="isMarkingDelivered === order._id"></i>
                            <i class="fas fa-check" *ngIf="isOrderDelivered(order)"></i>
                            <span *ngIf="!isOrderDelivered(order)" class="delivered-btn-text">נמסר</span>
                          </button>
                        </div>
                      </div>
                    </summary>
                    <div class="accordion-body">
                      <div class="body-section" *ngIf="order.items && order.items.length"><strong>פריטים:</strong><ul class="items-list"><li *ngFor="let item of order.items">{{ item.quantity }} × {{ item.name }}</li></ul></div>
                      <div class="body-section notes" *ngIf="order.notes || order.deliveryDetails.comments"><strong>הערות:</strong> {{ order.notes || order.deliveryDetails.comments }}</div>
                    </div>
                  </details>
                </div>
              </div>
            </div>
          </ng-container>
        </ng-template>
      </div>
    </div>
  `,
  styles: [`
    // Clean SaaS Theme Variables
    $bg-light: #f3f4f6;
    $text-dark: #334155;
    $text-slate: #1e293b;
    $success-green: #10b981;
    $danger-red: #ef4444;
    $primary-blue: #3b82f6;
    $white: #ffffff;
    $card-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    $yellow-50: #fef3c7;
    $yellow-800: #78350f;

    .delivery-management-page {
      min-height: 100vh;
      background: $bg-light;
      padding: 2rem 0;
      direction: rtl;
      font-family: 'Inter', 'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }

    .container {
      width: 100%;
      max-width: 100%;
      margin: 0;
      padding: 0 2rem;
    }

    // Page Header (above grid, flexbox)
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.75rem;
      flex-wrap: wrap;
      gap: 1rem;
    }

    .page-title {
      color: #1f2937;
      font-size: 2rem;
      font-weight: 700;
      margin: 0;
      letter-spacing: -0.02em;
    }

    .btn-print-manifest {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 8px 16px;
      background: transparent;
      border: 1px solid $success-green;
      color: $success-green;
      border-radius: 6px;
      font-weight: 600;
      font-size: 0.95rem;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .btn-print-manifest:hover:not(:disabled) {
      background: $success-green;
      color: white;
    }

    .btn-print-manifest:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    // Dashboard header (title + print count)
    .delivery-dashboard-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      width: 100%;
      max-width: 1000px;
      margin: 0 auto 30px auto;
      padding-bottom: 20px;
      border-bottom: 1px solid #e5e7eb;
    }
    .delivery-dashboard-header h1 {
      margin: 0;
      font-size: 2rem;
      color: #1f2937;
    }
    .btn-print {
      background: #10b981;
      color: white;
      padding: 10px 20px;
      border-radius: 8px;
      font-weight: 600;
      border: none;
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      transition: 0.2s;
    }
    .btn-print:disabled {
      background: #d1d5db;
      cursor: not-allowed;
    }
    .btn-print:hover:not(:disabled) {
      background: #059669;
    }

    // Dashboard: vertical layout (calendar on top, orders full width below)
    .delivery-dashboard-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 40px;
      width: 100%;
      margin-bottom: 2rem;
    }

    // Top section: title + print + calendar
    .dashboard-top-section {
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1.5rem;
    }

    // Calendar: compact widget, centered
    .calendar-container {
      width: 100%;
      max-width: 400px;
      margin: 0 auto;
    }
    .calendar-card {
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
      padding: 20px;
      border: 1px solid #f0f0f0;
    }
    .calendar-wrap {
      overflow: hidden;
    }
    .calendar-wrap ::ng-deep .mat-calendar {
      font-family: inherit;
      width: 100%;
    }
    .calendar-wrap ::ng-deep .mat-calendar-header,
    .calendar-wrap ::ng-deep .mat-calendar-body-label,
    .calendar-wrap ::ng-deep .mat-calendar-body-cell {
      border: none !important;
    }
    .calendar-wrap ::ng-deep .mat-calendar-body-cell-content {
      border: none !important;
      border-radius: 999px;
    }
    .calendar-wrap ::ng-deep .mat-calendar-body-today:not(.mat-calendar-body-selected) .mat-calendar-body-cell-content {
      background-color: #1f2937 !important;
      color: #fff !important;
      border-radius: 50%;
    }

    /* Dates that the admin enabled for ordering (from openDates) */
    .calendar-wrap ::ng-deep .mat-calendar-body-cell.open-date .mat-calendar-body-cell-content {
      background-color: $primary-blue;
      color: #fff;
      font-weight: 600;
    }

    /* Dates that have deliveries keep the small gold dot indicator */
    .calendar-wrap ::ng-deep .mat-calendar-body-cell.has-deliveries .mat-calendar-body-cell-content {
      position: relative;
      border-radius: 50%;
    }
    .calendar-wrap ::ng-deep .mat-calendar-body-cell.has-deliveries .mat-calendar-body-cell-content::after {
      content: '';
      position: absolute;
      bottom: 2px;
      left: 50%;
      transform: translateX(-50%);
      width: 5px;
      height: 5px;
      background: #c5a059;
      border-radius: 50%;
    }
    .calendar-actions {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      margin-top: 1rem;
      padding-top: 1rem;
      border-top: 1px solid #f0f0f0;
    }
    .show-all-btn {
      padding: 0.6rem 1.2rem;
      border-radius: 8px;
      font-weight: 600;
      border: 2px solid $primary-blue;
      background: $white;
      color: $primary-blue;
      cursor: pointer;
      transition: all 0.2s;
    }
    .show-all-btn:hover {
      background: $primary-blue;
      color: white;
    }
    .week-range {
      margin: 0;
      color: #6b7280;
      font-size: 0.9rem;
    }

    // Orders list: full width below calendar
    .orders-list-container {
      width: 100%;
      max-width: 1200px;
      margin: 0 auto;
    }

    // Global empty state (no orders in range)
    .global-empty-state {
      text-align: center;
      padding: 3rem 2rem;
      background: #fafafa;
      border: 1px dashed #d1d5db;
      border-radius: 12px;
      color: #9ca3af;
    }
    .global-empty-state i {
      font-size: 3rem;
      margin-bottom: 1rem;
      color: #e5e7eb;
    }
    .global-empty-state h3 {
      margin: 0 0 0.5rem 0;
      font-size: 1.25rem;
      font-weight: 700;
      color: #6b7280;
    }
    .global-empty-state p {
      margin: 0;
      font-size: 0.95rem;
    }

    // Day divider – clean solid banner (no floating gold line)
    .week-list {
      margin-top: 0;
    }
    .day-divider {
      background: #f8f9fa;
      border-radius: 8px;
      padding: 12px 20px;
      font-weight: 700;
      font-size: 1.1rem;
      color: #1f2937;
      border-right: 4px solid #c5a059;
      margin: 30px 0 15px 0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      scroll-margin-top: 1rem;
      position: sticky;
      top: 0;
      z-index: 5;
    }
    .day-divider:first-child {
      margin-top: 0;
    }
    .day-divider h3 {
      font-size: 1.1rem;
      font-weight: 700;
      color: #1f2937;
      margin: 0;
    }
    .order-count-badge {
      background: #f3f4f6;
      color: #4b5563;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 0.85rem;
      font-weight: 600;
    }

    // Accordion
    .order-accordion {
      border-bottom: 1px solid #e2e8f0;
      background: $white;
    }
    .order-accordion summary {
      list-style: none;
      cursor: pointer;
    }
    .order-accordion summary::-webkit-details-marker { display: none; }
    .order-accordion .accordion-body {
      padding: 1rem 1.5rem;
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
    }
    .accordion-body .body-section { margin-bottom: 0.75rem; }
    .accordion-body .body-section:last-child { margin-bottom: 0; }
    .items-list { margin: 0.25rem 0 0 1rem; padding: 0; list-style: disc; }
    .accordion-body .notes { font-style: italic; color: #64748b; }
    .col-time { min-width: 4rem; font-weight: 600; }

    // Call button
    .call-btn {
      background: #64748b;
      color: white;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .call-btn:hover { background: #475569; color: white; }

    // Loading & Error States
    .loading-state,
    .empty-state {
      text-align: center;
      padding: 4rem 2rem;
      color: $text-dark;
    }

    .loading-state i,
    .empty-state i {
      font-size: 3rem;
      color: $primary-blue;
      margin-bottom: 1rem;
    }

    .error-state {
      background: #fee2e2;
      color: #991b1b;
      border-radius: 8px;
      padding: 1rem 1.5rem;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 2rem;
      font-weight: 500;
    }

    .success-toast {
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 1000;
      padding: 1rem 1.5rem;
      background: $success-green;
      color: white;
      border-radius: 8px;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
      animation: slideDown 0.3s ease;
      font-weight: 600;
    }

    @keyframes slideDown {
      from {
        opacity: 0;
        transform: translateX(-50%) translateY(-20px);
      }
      to {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }
    }

    // Cities Grid - Full Width
    .cities-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(600px, 1fr));
      gap: 2rem;
      width: 100%;
    }

    // City Card + Delivery Order Card (premium)
    .city-card {
      background: $white;
      border-radius: 12px;
      overflow: hidden;
      page-break-inside: avoid;
    }
    .delivery-order-card {
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 16px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.02);
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .delivery-order-card:hover {
      box-shadow: 0 6px 12px rgba(0, 0, 0, 0.05);
    }
    .order-accordion.is-selected {
      border-color: #c5a059;
      background-color: #fdfbf7;
    }
    .order-accordion.is-selected .order-row {
      background-color: #fdfbf7;
    }
    .col-print {
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 40px;
    }
    .print-checkbox {
      width: 22px;
      height: 22px;
      accent-color: #c5a059;
      cursor: pointer;
      margin: 0;
    }
    .city-card-header.card-header-row {
      padding: 0 0 12px 0;
      margin-bottom: 12px;
      border-bottom: 1px solid #e5e7eb;
      background: transparent;
      display: flex;
      justify-content: space-between;
      align-items: center;
      width: 100%;
    }
    .city-card-header .city-name {
      font-size: 1.15rem;
      font-weight: 700;
      color: #1f2937;
    }
    .delivery-count-badge {
      background: #f3f4f6;
      color: #4b5563;
      padding: 4px 12px;
      border-radius: 8px;
      font-size: 0.85rem;
      font-weight: 600;
    }

    // Grid Row - The "Skeleton" (Desktop)
    .grid-row {
      display: grid;
      gap: 1rem;
      align-items: center;
      padding: 0 1.5rem;
    }
    .city-card .grid-row {
      grid-template-columns: 40px 0.8fr 1.5fr 2fr 1fr 1.5fr;
    }
    .pickup-section .city-card .grid-row {
      grid-template-columns: 40px 1.5fr 2fr 1fr 1.5fr;
    }
    .header-column.col-print {
      width: 40px;
      min-width: 40px;
    }

    // Table Header
    .table-header {
      padding: 0.75rem 1.5rem;
      background: #f8fafc; // Very light gray
      border-bottom: 1px solid #e2e8f0;
    }

    .header-column {
      color: #64748b; // Muted Slate
      font-size: 0.875rem; // Slightly smaller
      font-weight: 600; // Bold
      text-transform: none; // Hebrew doesn't need uppercase
      white-space: nowrap; // Prevent wrapping
    }

    // Column alignment for headers
    .header-column.customer-column,
    .header-column.destination-column {
      text-align: right;
    }

    .header-column.status-column,
    .header-column.actions-column {
      justify-self: center;
      text-align: center;
    }

    // Order Row - Use same grid layout
    .order-row {
      padding: 1.5rem 1.5rem;
      border-bottom: 1px solid #e2e8f0;
      transition: all 0.2s ease;
      background: $white;
    }

    // Column alignment for order rows
    .order-column.customer-column,
    .order-column.destination-column {
      text-align: right;
    }

    .order-column.status-column {
      justify-self: center;
      text-align: center;
    }

    .order-column.actions-column {
      justify-self: center;
      display: flex;
      justify-content: center;
      align-items: center;
    }

    // Prevent wrapping inside columns
    .order-column {
      min-width: 0; // Allow grid to shrink
      overflow-wrap: break-word; // Break long words if needed
      word-wrap: break-word;
    }

    // Notes box must stay inside Address column
    .delivery-notes {
      width: 100%;
      box-sizing: border-box;
    }

    // Orders List
    .orders-list {
      padding: 0;
    }

    // Mobile Breakpoint - Stack columns
    @media (max-width: 900px) {
      .grid-row {
        grid-template-columns: 1fr !important;
        gap: 1rem;
      }

      .order-row {
        padding: 1.25rem 1rem;
      }

      .table-header {
        padding: 0.75rem 1rem;
      }

      // Reset column alignments on mobile
      .order-column,
      .header-column {
        text-align: right !important;
        justify-self: stretch !important;
      }

      .order-column.actions-column {
        justify-content: flex-start !important;
      }
    }

    .order-row:not(.last-row) {
      border-bottom: 1px solid #e2e8f0;
    }

    .order-row:hover {
      background: #f8fafc;
    }

    .order-accordion.delivered .order-row {
      background: #ecfdf5;
      opacity: 0.85;
    }
    .order-accordion.delivered .customer-name,
    .order-accordion.delivered .address-text { text-decoration: line-through; }

    // Print Checkbox (hidden on screen, shown in print)
    .print-checkbox {
      display: none;
    }

    // Order Columns - Default styling
    .order-column {
      min-width: 0; // Allow grid to shrink
      overflow-wrap: break-word; // Break long words if needed
      word-wrap: break-word;
    }

    // Column 1: Customer - Allow vertical stacking of name + phone
    .customer-column {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      align-items: flex-end; // Right align for RTL
    }

    // Column 2: Destination - Allow vertical stacking of address + notes
    .destination-column {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      align-items: flex-end; // Right align for RTL
    }

    .customer-name {
      font-weight: 700;
      color: $text-slate;
      font-size: 1.05rem;
      line-height: 1.4;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      white-space: nowrap; // Prevent name from wrapping
    }

    .delivered-badge {
      font-size: 1rem;
      color: $success-green;
    }

    .customer-phone {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      color: $primary-blue;
      text-decoration: none;
      font-size: 0.95rem;
      transition: color 0.2s ease;
    }

    .customer-phone:hover {
      color: #2563eb;
      text-decoration: underline;
    }

    .customer-phone i {
      font-size: 0.875rem;
    }

    // Column 2: Destination
    .destination-column {
      min-width: 0; // Allow grid to control width
    }

    .address-container {
      display: block; // Use block to keep content in column
      width: 100%;
    }

    .address-link {
      display: inline-flex;
      align-items: flex-start;
      gap: 0.5rem;
      color: $text-dark;
      text-decoration: none;
      transition: color 0.2s ease;
    }

    .address-link:hover {
      color: $primary-blue;
    }

    .address-link i {
      color: $primary-blue;
      font-size: 1rem;
      margin-top: 0.125rem;
      flex-shrink: 0;
    }

    .address-text {
      font-size: 0.95rem;
      line-height: 1.5;
    }

    .floor-info {
      color: $text-dark;
      font-weight: 600;
    }

    // Delivery Notes - Sticky Note Look
    .delivery-notes {
      background: #fefce8; // Light Yellow
      color: #854d0e; // Dark Yellow/Brown for high readability
      padding: 0.5rem 0.75rem; // 8px 12px
      border-radius: 6px;
      border-left: 3px solid #facc15; // Left border accent
      font-size: 0.875rem; // Slightly smaller than address
      font-weight: 700; // Bold
      line-height: 1.5;
      display: flex;
      align-items: flex-start;
      gap: 0.5rem;
      width: 100%;
      box-sizing: border-box;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }

    .note-icon {
      font-size: 1rem;
      flex-shrink: 0;
      margin-top: 0.125rem;
    }

    .note-text {
      flex: 1;
      min-width: 0; // Allows text to wrap
    }

    // Column 3: Status & Payment
    .status-column {
      min-width: 150px;
      align-items: flex-start;
    }

    .payment-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 1rem;
      border-radius: 9999px;
      font-size: 0.875rem;
      font-weight: 600;
      white-space: nowrap;
    }

    .payment-badge.unpaid {
      background: #fee2e2;
      color: #991b1b;
    }

    .payment-badge.paid {
      background: #d1fae5;
      color: #065f46;
    }

    .payment-badge i {
      font-size: 1rem;
    }

    // Column 4: Quick Actions (Driver Toolkit)
    .actions-column {
      min-width: 140px;
      align-items: flex-end;
    }

    .assign-driver-wrap {
      margin-bottom: 0.5rem;
    }

    .driver-select {
      width: 100%;
      min-width: 150px;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      padding: 0.35rem 0.5rem;
      background: #fff;
      color: #111827;
      font-size: 0.85rem;
    }

    .action-buttons {
      display: flex;
      gap: 0.75rem;
      align-items: center;
    }

    .action-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 44px;
      height: 44px;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s ease;
      font-size: 1.2rem;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    .whatsapp-btn {
      background: #25d366;
      color: white;
    }

    .whatsapp-btn:hover {
      background: #20ba5a;
      transform: translateY(-2px);
      box-shadow: 0 4px 8px rgba(37, 211, 102, 0.3);
    }

    .waze-btn {
      background: $primary-blue;
      color: white;
    }

    .waze-btn:hover {
      background: #2563eb;
      transform: translateY(-2px);
      box-shadow: 0 4px 8px rgba(59, 130, 246, 0.3);
    }

    .delivered-btn {
      background: transparent;
      color: $success-green;
      border: 2px solid $success-green;
      width: auto;
      padding: 0.5rem 1rem;
      font-weight: 600;
      font-size: 0.875rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .delivered-btn:hover:not(:disabled) {
      background: $success-green;
      color: white;
      border-color: $success-green;
      transform: translateY(-2px);
      box-shadow: 0 4px 8px rgba(16, 185, 129, 0.3);
    }

    .delivered-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      background: #d1fae5;
      color: #065f46;
      border-color: #d1fae5;
    }

    .delivered-btn-text {
      font-size: 0.875rem;
    }

    // Hide text on mobile, show only icon
    @media (max-width: 768px) {
      .delivered-btn-text {
        display: none;
      }
    }

    // Mobile Responsive
    @media (max-width: 1024px) {
      .cities-grid {
        grid-template-columns: 1fr;
      }

      .order-row {
        grid-template-columns: 1fr;
        gap: 1.5rem;
        padding: 1.25rem 1.5rem;
      }

      .actions-column {
        align-items: flex-start;
      }

      .action-buttons {
        flex-wrap: wrap;
      }
    }

    @media (max-width: 768px) {
      // Hide table header on mobile
      .table-header {
        display: none !important;
      }

      .container {
        padding: 0 1rem;
      }

      .page-header {
        flex-direction: column;
        align-items: flex-start;
      }

      .page-title {
        font-size: 1.75rem;
      }

      .city-card-header {
        padding: 1.25rem 1.5rem;
        flex-direction: column;
        align-items: flex-start;
        gap: 0.75rem;
      }

      .city-name {
        font-size: 1.5rem;
      }

      .order-row {
        padding: 1rem 1.25rem;
      }

      .action-btn {
        width: 48px;
        height: 48px;
        font-size: 1.3rem;
      }
    }

    // Print-only driver table (hidden on screen)
    .print-only-table {
      margin: 0;
    }
    .driver-print-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 1rem;
    }
    .driver-print-table th,
    .driver-print-table td {
      border: 1px solid #ccc;
      padding: 0.5rem 0.75rem;
      text-align: right;
    }
    .driver-print-table .th-check,
    .driver-print-table .td-check {
      width: 3rem;
      text-align: center;
    }

    // Print Styles
    @media print {
      .no-print,
      .page-header,
      .delivery-dashboard-header,
      .dashboard-top-section,
      .calendar-container,
      .delivery-dashboard-container,
      .orders-list-container,
      .btn-print-manifest,
      .btn-print,
      .print-checkbox,
      .col-print,
      .action-btn,
      .action-buttons,
      .success-toast,
      .error-state,
      .loading-state,
      .empty-state,
      .global-empty-state,
      .day-divider,
      .week-list,
      .cities-grid,
      .city-card {
        display: none !important;
      }

      .print-only-table {
        display: block !important;
      }
      .print-header {
        display: block !important;
        text-align: center;
        margin-bottom: 1.5rem;
        page-break-after: avoid;
      }
      .print-header h1 {
        font-size: 1.5rem;
        font-weight: 700;
        color: black;
        margin: 0 0 0.25rem 0;
      }
      .print-date {
        font-size: 1rem;
        color: black;
        margin: 0;
      }
      .driver-print-table {
        width: 100%;
        border-collapse: collapse;
      }
      .driver-print-table th,
      .driver-print-table td {
        border: 1px solid #000;
        padding: 0.4rem 0.6rem;
        color: black;
      }
      .driver-print-table .td-check {
        font-size: 1rem;
      }

      ::ng-deep app-admin-layout aside,
      ::ng-deep .admin-sidebar,
      ::ng-deep .admin-header {
        display: none !important;
      }
      body,
      .delivery-management-page,
      .container {
        background: white !important;
        color: black !important;
        width: 100% !important;
        max-width: 100% !important;
        padding: 0 !important;
        margin: 0 !important;
      }
      * {
        box-shadow: none !important;
        text-shadow: none !important;
      }
      @page { margin: 1.5cm; }
    }
  `]
})
export class DeliveryManagementComponent implements OnInit {
  orderService = inject(OrderService);
  private shippingService = inject(ShippingService);
  private authService = inject(AuthService);
  private usersService = inject(UsersService);

  daysByDate: Record<string, { deliveryByCity: CityGroup[]; pickupByTime: PickupGroup[] }> = {};
  fromDate: Date = new Date();
  toDate: Date = new Date();
  selectedDayFilter: string | null = null;
  selectedOrdersForPrint: Set<string> = new Set();
  isLoading = true;
  errorMessage = '';
  isMarkingDelivered: string | null = null;
  successMessage: string | null = null;
  assigningOrderId: string | null = null;
  isAdmin = false;
  isDriver = false;
  driverUsers: DriverUser[] = [];
  /** Dates that the admin allowed for orders (YYYY-MM-DD) – used to highlight calendar cells. */
  openDates: Set<string> = new Set();

  get fromDateStr(): string { return this.toYYYYMMDD(this.fromDate); }
  get toDateStr(): string { return this.toYYYYMMDD(this.toDate); }
  get fromDateLabel(): string { return this.formatDateShort(this.fromDateStr); }
  get toDateLabel(): string { return this.formatDateShort(this.toDateStr); }

  /** Dates to show: either [selectedDayFilter] or all week dates in range. */
  get displayDates(): string[] {
    if (this.selectedDayFilter) return [this.selectedDayFilter];
    const out: string[] = [];
    const start = new Date(this.fromDate);
    const end = new Date(this.toDate);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      out.push(this.toYYYYMMDD(d));
    }
    return out;
  }

  /** Only dates that have at least one order (used for list; empty days are hidden). */
  get displayDatesWithOrders(): string[] {
    return this.displayDates.filter(dateStr => this.getOrderCountForDate(dateStr) > 0);
  }

  /** True if there is at least one order in the selected date range. */
  get hasAnyOrders(): boolean {
    return this.totalOrdersCount > 0;
  }

  /** Dates that have at least one order (for calendar highlight). */
  get datesWithOrders(): Set<string> {
    const set = new Set<string>();
    Object.keys(this.daysByDate).forEach(dateStr => {
      const day = this.daysByDate[dateStr];
      const total = (day.deliveryByCity?.reduce((s, g) => s + g.orders.length, 0) || 0) +
        (day.pickupByTime?.reduce((s, g) => s + g.orders.length, 0) || 0);
      if (total > 0) set.add(dateStr);
    });
    return set;
  }

  get totalOrdersCount(): number {
    let n = 0;
    Object.values(this.daysByDate).forEach(day => {
      n += (day.deliveryByCity?.reduce((s, g) => s + g.orders.length, 0) || 0) +
        (day.pickupByTime?.reduce((s, g) => s + g.orders.length, 0) || 0);
    });
    return n;
  }

  /** Only orders that are selected for print (used when printing). */
  get allOrdersForPrint(): DeliveryOrder[] {
    const list: DeliveryOrder[] = [];
    this.displayDatesWithOrders.forEach(dateStr => {
      const day = this.daysByDate[dateStr];
      if (!day) return;
      (day.deliveryByCity || []).forEach(g => g.orders.forEach(o => { if (this.selectedOrdersForPrint.has(o._id)) list.push(o); }));
      (day.pickupByTime || []).forEach(g => g.orders.forEach(o => { if (this.selectedOrdersForPrint.has(o._id)) list.push(o); }));
    });
    return list;
  }

  /** Populate selectedOrdersForPrint with all currently displayed order IDs (call after data load). */
  syncSelectedOrdersForPrint(): void {
    const ids = new Set<string>();
    this.displayDatesWithOrders.forEach(dateStr => {
      const day = this.daysByDate[dateStr];
      if (!day) return;
      (day.deliveryByCity || []).forEach(g => g.orders.forEach(o => ids.add(o._id)));
      (day.pickupByTime || []).forEach(g => g.orders.forEach(o => ids.add(o._id)));
    });
    this.selectedOrdersForPrint = ids;
  }

  togglePrintSelection(orderId: string): void {
    const next = new Set(this.selectedOrdersForPrint);
    if (next.has(orderId)) next.delete(orderId);
    else next.add(orderId);
    this.selectedOrdersForPrint = next;
  }

  private toYYYYMMDD(d: Date): string {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  ngOnInit(): void {
    const role = String(this.authService.currentUser?.role || '');
    this.isAdmin = role === 'admin';
    this.isDriver = role === 'driver';
    if (this.isAdmin) {
      this.loadDriverUsers();
    }
    this.loadWeek();
    this.loadOpenDates();
  }

  loadDriverUsers(): void {
    this.usersService.getDriverUsers().subscribe({
      next: (drivers) => {
        this.driverUsers = drivers || [];
      },
      error: (err) => {
        console.error('Failed loading drivers:', err);
        this.driverUsers = [];
      }
    });
  }

  /** Load openDates from global delivery settings so the calendar shows which dates are enabled. */
  loadOpenDates(): void {
    this.shippingService.getGlobalSettings().subscribe({
      next: (res) => {
        const dates = res?.data?.openDates;
        const YYYYMMDD = /^\d{4}-\d{2}-\d{2}$/;
        if (Array.isArray(dates)) {
          this.openDates = new Set(
            dates.filter((s: unknown): s is string => typeof s === 'string' && YYYYMMDD.test(s))
          );
        } else {
          this.openDates = new Set();
        }
      },
      error: (err) => {
        console.error('Failed to load openDates for delivery calendar', err);
        this.openDates = new Set();
      }
    });
  }

  loadWeek(): void {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    this.fromDate = start;
    this.toDate = end;
    this.loadDeliveryReport();
  }

  loadDeliveryReport(): void {
    this.isLoading = true;
    this.errorMessage = '';
    const from = this.toYYYYMMDD(this.fromDate);
    const to = this.toYYYYMMDD(this.toDate);

    this.orderService.getDeliveryReport(from, to).subscribe({
      next: (data: { days: Record<string, { deliveryByCity: CityGroup[]; pickupByTime: PickupGroup[] }> }) => {
        this.daysByDate = data.days || {};
        this.syncSelectedOrdersForPrint();
        this.isLoading = false;
      },
      error: (error: any) => {
        console.error('Error loading delivery report:', error);
        this.errorMessage = 'שגיאה בטעינת דוח המשלוחים';
        this.isLoading = false;
      }
    });
  }

  assignDriver(orderId: string, driverId: string): void {
    if (!this.isAdmin || !orderId) return;
    this.assigningOrderId = orderId;
    this.orderService.assignOrderToDriver(orderId, { driverId: driverId || null }).subscribe({
      next: (updated) => {
        this.assigningOrderId = null;
        this.patchOrderAssignmentLocally(orderId, updated.assignedDriverId || null, updated.assignedDriverName || '');
        this.successMessage = driverId ? 'המשלוח שויך לנהג' : 'שיוך נהג הוסר';
        setTimeout(() => (this.successMessage = null), 2500);
      },
      error: (err) => {
        this.assigningOrderId = null;
        alert(err?.error?.message || 'שגיאה בשיוך נהג');
      }
    });
  }

  private patchOrderAssignmentLocally(orderId: string, assignedDriverId: string | null, assignedDriverName: string): void {
    Object.values(this.daysByDate).forEach((day) => {
      (day.deliveryByCity || []).forEach((group) => {
        group.orders.forEach((o) => {
          if (o._id === orderId) {
            o.assignedDriverId = assignedDriverId;
            o.assignedDriverName = assignedDriverName;
          }
        });
      });
      (day.pickupByTime || []).forEach((group) => {
        group.orders.forEach((o) => {
          if (o._id === orderId) {
            o.assignedDriverId = assignedDriverId;
            o.assignedDriverName = assignedDriverName;
          }
        });
      });
    });
  }

  dateClass = (date: Date, _view?: 'month' | 'year' | 'multi-year'): string => {
    const str = this.toYYYYMMDD(date);
    const classes: string[] = [];
    if (this.openDates.has(str)) {
      classes.push('open-date');
    }
    if (this.datesWithOrders.has(str)) {
      classes.push('has-deliveries');
    }
    return classes.join(' ');
  };

  onCalendarDateSelected(value: Date | null): void {
    if (!value) return;
    this.selectedDayFilter = this.toYYYYMMDD(value);
    const el = document.getElementById('day-' + this.selectedDayFilter);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  showAllDays(): void {
    this.selectedDayFilter = null;
  }

  getDayData(dateStr: string): { deliveryByCity: CityGroup[]; pickupByTime: PickupGroup[] } | null {
    const day = this.daysByDate[dateStr];
    if (!day) return { deliveryByCity: [], pickupByTime: [] };
    return day;
  }

  getOrderCountForDate(dateStr: string): number {
    const day = this.daysByDate[dateStr];
    if (!day) return 0;
    return (day.deliveryByCity?.reduce((s, g) => s + g.orders.length, 0) || 0) +
      (day.pickupByTime?.reduce((s, g) => s + g.orders.length, 0) || 0);
  }

  getDayLabel(dateStr: string): string {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, (m || 1) - 1, d || 1);
    return HEBREW_DAYS[date.getDay()] ?? '';
  }

  formatDateShort(dateStr: string): string {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length < 3) return dateStr;
    return parts[2] + '/' + parts[1];
  }

  trackByDate(_index: number, dateStr: string): string {
    return dateStr;
  }

  printManifest(): void {
    window.print();
  }

  getPrintDate(): string {
    if (this.selectedDayFilter) return this.formatDateShort(this.selectedDayFilter);
    return this.fromDateLabel + ' – ' + this.toDateLabel;
  }

  getCurrentDate(): string {
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();
    return `${day}/${month}/${year}`;
  }

  getDisplayTime(order: DeliveryOrder): string {
    const t = order.preferredDeliveryTime;
    if (t) return t;
    return '—';
  }

  // Smart WhatsApp Button
  openWhatsapp(order: DeliveryOrder): void {
    const phone = order.customerDetails.phone;
    if (!phone) {
      alert('מספר טלפון לא זמין');
      return;
    }

    const cleanPhone = phone.replace(/[^0-9]/g, '');
    
    let whatsappNumber = '';
    if (cleanPhone.startsWith('972')) {
      whatsappNumber = cleanPhone;
    } else if (cleanPhone.startsWith('0')) {
      whatsappNumber = '972' + cleanPhone.substring(1);
    } else {
      whatsappNumber = '972' + cleanPhone;
    }

    const customerName = order.customerDetails.name || 'שלום';
    const message = encodeURIComponent(`היי ${customerName}, השליח של מגדים בדרך אליך עם ההזמנה! 🍲`);
    
    const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${message}`;
    window.open(whatsappUrl, '_blank');
  }

  // Open Waze
  openWaze(order: DeliveryOrder): void {
    const address = order.deliveryDetails.address;
    if (!address) {
      alert('כתובת לא זמינה');
      return;
    }

    const wazeUrl = `https://waze.com/ul?q=${encodeURIComponent(address)}`;
    window.open(wazeUrl, '_blank');
  }

  // Get Waze Link (for template)
  getWazeLink(address: string): string {
    if (!address) {
      return '#';
    }
    return `https://waze.com/ul?q=${encodeURIComponent(address)}`;
  }

  isOrderDelivered(order: DeliveryOrder): boolean {
    return order.status === 'delivered' || order.status === 'completed';
  }

  markAsDelivered(orderId: string, cityGroup: CityGroup): void {
    if (!orderId) return;
    this.isMarkingDelivered = orderId;
    this.orderService.updateOrderStatus(orderId, 'delivered').subscribe({
      next: () => {
        const order = cityGroup.orders.find(o => o._id === orderId);
        if (order) order.status = 'delivered';
        this.successMessage = 'ההזמנה סומנה כנמסרה';
        setTimeout(() => { this.successMessage = null; }, 3000);
        this.isMarkingDelivered = null;
      },
      error: () => {
        alert('שגיאה בעדכון הסטטוס. נסה שוב.');
        this.isMarkingDelivered = null;
      }
    });
  }

  markAsDeliveredPickup(orderId: string, pickupGroup: PickupGroup): void {
    if (!orderId) return;
    this.isMarkingDelivered = orderId;
    this.orderService.updateOrderStatus(orderId, 'delivered').subscribe({
      next: () => {
        const order = pickupGroup.orders.find(o => o._id === orderId);
        if (order) order.status = 'delivered';
        this.successMessage = 'ההזמנה סומנה כנמסרה';
        setTimeout(() => { this.successMessage = null; }, 3000);
        this.isMarkingDelivered = null;
      },
      error: () => {
        alert('שגיאה בעדכון הסטטוס. נסה שוב.');
        this.isMarkingDelivered = null;
      }
    });
  }

  trackByCity(_index: number, cityGroup: CityGroup): string {
    return cityGroup.city;
  }

  trackByPickupTime(_index: number, pickupGroup: PickupGroup): string {
    return pickupGroup.time;
  }

  trackByOrderId(_index: number, order: DeliveryOrder): string {
    return order._id;
  }
}
