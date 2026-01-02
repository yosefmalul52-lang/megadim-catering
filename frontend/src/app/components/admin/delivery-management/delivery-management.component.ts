import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OrderService } from '../../../services/order.service';

interface DeliveryOrder {
  _id: string;
  customerDetails: {
    name: string;
    phone: string;
  };
  deliveryDetails: {
    address: string;
    city: string;
    floor: string | null;
    comments: string | null;
  };
  totalPrice: number;
  isPaid: boolean;
  status?: string; // Order status (new, in-progress, ready, delivered, cancelled)
}

interface CityGroup {
  city: string;
  orders: DeliveryOrder[];
}

@Component({
  selector: 'app-delivery-management',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="delivery-management-page">
      <div class="container">
        <!-- Page Header -->
        <div class="page-header">
          <h1 class="page-title">ניהול הפצה ומשלוחים</h1>
          <button 
            class="btn-print-manifest" 
            (click)="printManifest()" 
            [disabled]="isLoading || cityGroups.length === 0">
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

        <!-- Print Header (Only visible when printing) -->
        <div class="print-header" style="display: none;">
          <h1>רשימת חלוקה - מגדים</h1>
          <p class="print-date">{{ getCurrentDate() }}</p>
        </div>

        <!-- City Cards Grid -->
        <div *ngIf="!isLoading && !errorMessage && cityGroups.length > 0" class="cities-grid">
          <div *ngFor="let cityGroup of cityGroups; trackBy: trackByCity" class="city-card print-city-group">
            <!-- City Card Header -->
            <div class="city-card-header">
              <h2 class="city-name">{{ cityGroup.city }}</h2>
              <span class="delivery-count-badge">{{ cityGroup.orders.length }} משלוחים</span>
            </div>

            <!-- Table Header -->
            <div class="table-header grid-row">
              <div class="header-column customer-column">פרטי לקוח</div>
              <div class="header-column destination-column">כתובת והערות</div>
              <div class="header-column status-column">סטטוס תשלום</div>
              <div class="header-column actions-column">פעולות לנהג</div>
            </div>

            <!-- Orders List -->
            <div class="orders-list">
              <div 
                *ngFor="let order of cityGroup.orders; trackBy: trackByOrderId; let last = last" 
                class="order-row grid-row print-order-row"
                [class.delivered]="order._id === deliveredOrderId || isOrderDelivered(order)"
                [class.last-row]="last">
                
                <!-- Column 1: Customer -->
                <div class="order-column customer-column">
                  <div class="customer-name">
                    {{ order.customerDetails.name }}
                    <span *ngIf="order._id === deliveredOrderId || isOrderDelivered(order)" class="delivered-badge">
                      ✅
                    </span>
                  </div>
                  <a [href]="'tel:' + order.customerDetails.phone" class="customer-phone">
                    <i class="fas fa-phone"></i>
                    {{ order.customerDetails.phone }}
                  </a>
                </div>

                <!-- Column 2: Destination -->
                <div class="order-column destination-column">
                  <div class="address-container">
                    <a 
                      [href]="getWazeLink(order.deliveryDetails.address)"
                      target="_blank"
                      class="address-link">
                      <i class="fas fa-map-marker-alt"></i>
                      <span class="address-text">
                        {{ order.deliveryDetails.address }}
                        <span *ngIf="order.deliveryDetails.floor" class="floor-info">
                          (קומה {{ order.deliveryDetails.floor }})
                        </span>
                      </span>
                    </a>
                    <div *ngIf="order.deliveryDetails.comments" class="delivery-notes">
                      <span class="note-icon">📝</span>
                      <span class="note-text">{{ order.deliveryDetails.comments }}</span>
                    </div>
                  </div>
                </div>

                <!-- Column 3: Status & Payment -->
                <div class="order-column status-column">
                  <div *ngIf="!order.isPaid" class="payment-badge unpaid">
                    לא שולם: ₪{{ order.totalPrice | number:'1.2-2' }}
                  </div>
                  <div *ngIf="order.isPaid" class="payment-badge paid">
                    <i class="fas fa-check-circle"></i>
                    שולם
                  </div>
                </div>

                <!-- Column 4: Quick Actions (Driver Toolkit) -->
                <div class="order-column actions-column">
                  <div class="action-buttons">
                    <button 
                      type="button"
                      class="action-btn whatsapp-btn"
                      (click)="openWhatsapp(order)"
                      [attr.aria-label]="'שלח WhatsApp ל-' + order.customerDetails.name"
                      title="WhatsApp">
                      <i class="fab fa-whatsapp"></i>
                    </button>
                    
                    <button 
                      type="button"
                      class="action-btn waze-btn"
                      (click)="openWaze(order)"
                      [attr.aria-label]="'פתח ב-Waze: ' + order.deliveryDetails.address"
                      title="Waze">
                      <i class="fab fa-waze"></i>
                    </button>
                    
                    <button 
                      type="button"
                      class="action-btn delivered-btn"
                      (click)="markAsDelivered(order._id, cityGroup)"
                      [disabled]="isMarkingDelivered === order._id || isOrderDelivered(order)"
                      [attr.aria-label]="'סמן כנמסר'"
                      title="סמן כנמסר">
                      <i class="fas fa-check-circle" *ngIf="isMarkingDelivered !== order._id && !isOrderDelivered(order)"></i>
                      <i class="fas fa-spinner fa-spin" *ngIf="isMarkingDelivered === order._id"></i>
                      <i class="fas fa-check" *ngIf="isOrderDelivered(order)"></i>
                      <span class="delivered-btn-text">נמסר</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div *ngIf="!isLoading && !errorMessage && cityGroups.length === 0" class="empty-state">
          <i class="fas fa-truck"></i>
          <h3>אין משלוחים להצגה כרגע</h3>
          <p>כשיתקבלו הזמנות חדשות, הן יופיעו כאן</p>
        </div>
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

    // Page Header
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2.5rem;
      flex-wrap: wrap;
      gap: 1.5rem;
    }

    .page-title {
      color: $text-slate;
      font-size: 2.25rem;
      font-weight: 700;
      margin: 0;
      letter-spacing: -0.02em;
    }

    .btn-print-manifest {
      display: inline-flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.875rem 1.75rem;
      background: $success-green;
      color: white;
      border: none;
      border-radius: 8px;
      font-weight: 600;
      font-size: 1rem;
      cursor: pointer;
      transition: all 0.2s ease;
      box-shadow: 0 2px 4px rgba(16, 185, 129, 0.2);
    }

    .btn-print-manifest:hover:not(:disabled) {
      background: #059669;
      box-shadow: 0 4px 8px rgba(16, 185, 129, 0.3);
      transform: translateY(-1px);
    }

    .btn-print-manifest:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none;
    }

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

    // City Card
    .city-card {
      background: $white;
      border-radius: 12px;
      box-shadow: $card-shadow;
      overflow: hidden;
      page-break-inside: avoid;
      transition: box-shadow 0.2s ease;
    }

    .city-card:hover {
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }

    .city-card-header {
      padding: 1.5rem 2rem;
      background: linear-gradient(135deg, #f8fafc 0%, #ffffff 100%);
      border-bottom: 2px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .city-name {
      color: $text-slate;
      font-size: 1.75rem;
      font-weight: 700;
      margin: 0;
      letter-spacing: -0.01em;
    }

    .delivery-count-badge {
      background: $success-green;
      color: white;
      padding: 0.5rem 1rem;
      border-radius: 9999px;
      font-size: 0.875rem;
      font-weight: 600;
      letter-spacing: 0.01em;
    }

    // Grid Row - The "Skeleton" (Desktop)
    .grid-row {
      display: grid;
      grid-template-columns: 1.5fr 2.5fr 1.2fr 1.8fr;
      gap: 1.5rem;
      align-items: center;
      padding: 0 1.5rem;
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

    .order-row.delivered {
      background: #ecfdf5;
    }

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

    // Print Styles
    @media print {
      // Hide UI elements
      .page-header,
      .btn-print-manifest,
      .action-btn,
      .success-toast,
      .error-state,
      .loading-state,
      .empty-state,
      .action-buttons {
        display: none !important;
      }

      // Hide sidebar and admin layout
      ::ng-deep app-admin-layout aside,
      ::ng-deep .admin-sidebar,
      ::ng-deep .admin-header {
        display: none !important;
      }

      // Reset background
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

      // Print Header
      .print-header {
        display: block !important;
        text-align: center;
        margin-bottom: 2rem;
        page-break-after: avoid;
      }

      .print-header h1 {
        font-size: 2rem;
        font-weight: 700;
        color: black;
        margin: 0 0 0.5rem 0;
      }

      .print-date {
        font-size: 1.2rem;
        color: black;
        margin: 0;
      }

      // City Cards
      .city-card {
        background: white !important;
        box-shadow: none !important;
        border: 1px solid #ccc !important;
        page-break-inside: avoid;
        margin-bottom: 1.5rem;
      }

      .city-card-header {
        border-bottom: 2px solid black !important;
        background: white !important;
      }

      .city-name {
        color: black !important;
      }

      .delivery-count-badge {
        background: transparent !important;
        color: black !important;
        border: 1px solid black !important;
      }

      // Order Rows - Print Layout
      .order-row {
        border-bottom: 1px solid #ccc !important;
        background: white !important;
        page-break-inside: avoid;
        grid-template-columns: 30px 1.5fr 2fr 1.2fr 1.8fr !important;
      }

      .print-checkbox {
        display: block !important;
        font-size: 1.2rem;
        text-align: center;
        grid-column: 1;
      }

      .order-column {
        color: black !important;
      }

      .customer-name {
        color: black !important;
        font-weight: 700 !important;
      }

      .customer-phone {
        color: black !important;
        text-decoration: none !important;
      }

      .address-link {
        color: black !important;
        text-decoration: none !important;
      }

      .address-link i {
        display: none !important;
      }

      .delivery-notes {
        background: transparent !important;
        color: black !important;
        border-right: 2px solid black !important;
        font-weight: 700 !important;
      }

      .payment-badge {
        background: transparent !important;
        border: 1px solid black !important;
        color: black !important;
      }

      .payment-badge.unpaid::after {
        content: ' - גוביינא';
        font-weight: 700;
      }

      // Remove shadows
      * {
        box-shadow: none !important;
        text-shadow: none !important;
      }

      @page {
        margin: 1.5cm;
      }
    }
  `]
})
export class DeliveryManagementComponent implements OnInit {
  orderService = inject(OrderService);

  cityGroups: CityGroup[] = [];
  isLoading = true;
  errorMessage = '';
  isMarkingDelivered: string | null = null;
  successMessage: string | null = null;
  deliveredOrderId: string | null = null;

  ngOnInit(): void {
    this.loadDeliveryReport();
  }

  loadDeliveryReport(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.orderService.getDeliveryReport().subscribe({
      next: (data: CityGroup[]) => {
        console.log('Report Data:', data);
        console.log('✅ Loaded delivery report:', data.length, 'cities');
        console.log('✅ Total orders:', data.reduce((sum, city) => sum + city.orders.length, 0));
        
        this.cityGroups = data;
        this.isLoading = false;
      },
      error: (error: any) => {
        console.error('Error loading delivery report:', error);
        console.error('Error details:', JSON.stringify(error, null, 2));
        this.errorMessage = 'שגיאה בטעינת דוח המשלוחים';
        this.isLoading = false;
      }
    });
  }

  // Print Manifest
  printManifest(): void {
    window.print();
  }

  // Get current date
  getCurrentDate(): string {
    const today = new Date();
    const day = today.getDate();
    const month = today.getMonth() + 1;
    const year = today.getFullYear();
    return `${day}/${month}/${year}`;
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

  // Check if order is delivered
  isOrderDelivered(order: DeliveryOrder): boolean {
    return order.status === 'delivered' || order.status === 'completed' || order._id === this.deliveredOrderId;
  }

  // Mark as Delivered
  markAsDelivered(orderId: string, cityGroup: CityGroup): void {
    if (!orderId) {
      console.error('Order ID is missing');
      return;
    }

    this.isMarkingDelivered = orderId;
    this.deliveredOrderId = orderId;

    this.orderService.updateOrderStatus(orderId, 'delivered').subscribe({
      next: (updatedOrder) => {
        console.log('✅ Order marked as delivered:', updatedOrder);
        
        // Update order status locally for instant UI feedback
        const orderIndex = cityGroup.orders.findIndex(o => o._id === orderId);
        if (orderIndex !== -1) {
          cityGroup.orders[orderIndex].status = 'delivered';
        }
        
        this.successMessage = 'ההזמנה סומנה כנמסרה';
        setTimeout(() => {
          this.successMessage = null;
        }, 3000);

        // Remove the order from the list after a delay (for visual feedback)
        setTimeout(() => {
          if (orderIndex !== -1) {
            cityGroup.orders.splice(orderIndex, 1);
            
            if (cityGroup.orders.length === 0) {
              const cityIndex = this.cityGroups.findIndex(cg => cg.city === cityGroup.city);
              if (cityIndex !== -1) {
                this.cityGroups.splice(cityIndex, 1);
              }
            }
          }
          this.deliveredOrderId = null;
        }, 2000);

        this.isMarkingDelivered = null;
      },
      error: (error) => {
        console.error('❌ Error marking order as delivered:', error);
        alert('שגיאה בעדכון הסטטוס. נסה שוב.');
        this.isMarkingDelivered = null;
        this.deliveredOrderId = null;
      }
    });
  }

  // Track by functions
  trackByCity(index: number, cityGroup: CityGroup): string {
    return cityGroup.city;
  }

  trackByOrderId(index: number, order: DeliveryOrder): string {
    return order._id;
  }
}
