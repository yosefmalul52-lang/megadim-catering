import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { interval, Subscription } from 'rxjs';
import { startWith, switchMap } from 'rxjs/operators';

import { OrderService, Order, DashboardStats } from '../../../services/order.service';
import { MenuService, MenuItem } from '../../../services/menu.service';
import { KitchenReportModalComponent } from '../../modals/kitchen-report-modal/kitchen-report-modal.component';
import { ManualOrderBuilderComponent } from '../manual-order-builder/manual-order-builder.component';

type SelectedOptionPayload = {
  label: string;
  amount?: string;
  price: number;
};

type EditableOrderItem = {
  productId: string;
  baseName: string;
  name: string;
  quantity: number;
  category?: string;
  unitPrice?: number;
  selectedOption?: SelectedOptionPayload;
};

type SearchResultItem = {
  productId: string;
  baseName: string;
  displayName: string;
  category: string;
  unitPrice: number;
  selectedOption?: SelectedOptionPayload;
};

@Component({
  selector: 'app-admin-orders',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, KitchenReportModalComponent, ManualOrderBuilderComponent],
  templateUrl: './admin-orders.component.html',
  styleUrls: ['./admin-orders.component.scss']
})
export class AdminOrdersComponent implements OnInit, OnDestroy {
  orderService = inject(OrderService);
  menuService = inject(MenuService);
  private route = inject(ActivatedRoute);

  /** When true, hide orders list and show full-page manual order builder */
  isCreatingOrder = false;

  /** Optional filter from query params when navigating from customers page */
  customerFilter: { email?: string; phone?: string } = {};
  /** Frequency map by normalized phone for VIP/returning badges. */
  private phoneFrequency: Record<string, number> = {};

  orders: Order[] = [];
  archiveOrders: Order[] = [];
  stats: DashboardStats = { pendingCount: 0, eventsTodayCount: 0, monthlyRevenue: 0 };
  /** Top-level tab: Shabbat (e-commerce) vs Catering/Events. */
  orderSourceTab: 'shabbat' | 'catering' = 'shabbat';
  currentTab: 'pending' | 'processing' | 'ready' | 'archive' = 'pending';
  isLoading = true;
  isRefreshing = false;
  isLoadingArchive = false;
  statusUpdatingId: string | null = null;
  selectedOrder: Order | null = null;
  orderToEditStatus: Order | null = null;
  showKitchenReport = false;
  successMessage = '';
  errorMessage = '';
  /** When true, show date picker in order details modal for event/delivery date. */
  isEditingEventDate = false;
  /** Current value of the date input (YYYY-MM-DD). */
  editEventDateValue = '';
  dateUpdatingId: string | null = null;
  isEditingItems = false;
  editableItems: EditableOrderItem[] = [];
  availableMenuItems: MenuItem[] = [];
  searchTerm = '';
  isSavingItems = false;

  readonly statusOptions = [
    { value: 'pending', label: 'ממתין' },
    { value: 'processing', label: 'בטיפול' },
    { value: 'ready', label: 'מוכן' }
  ];

  private autoRefreshSubscription?: Subscription;
  private previousOrderCount = 0;
  autoRefreshEnabled = true;
  private readonly REFRESH_INTERVAL = 30000;

  ngOnInit(): void {
    this.loadStats();
    this.loadOrders();
    this.loadArchiveOrders();
    this.startAutoRefresh();
    this.route.queryParams.subscribe((params) => {
      this.customerFilter = {};
      if (params['customerEmail']) this.customerFilter.email = params['customerEmail'];
      if (params['customerPhone']) this.customerFilter.phone = params['customerPhone'];
    });
  }

  ngOnDestroy(): void {
    this.stopAutoRefresh();
  }

  loadStats(): void {
    this.orderService.getDashboardStats().subscribe((s) => (this.stats = s));
  }

  private startAutoRefresh(): void {
    if (!this.autoRefreshEnabled) return;
    this.autoRefreshSubscription = interval(this.REFRESH_INTERVAL)
      .pipe(
        startWith(0),
        switchMap(() => this.orderService.getAllOrders(false))
      )
      .subscribe({
        next: (orders: Order[]) => {
          const newOrderCount = orders.length;
          if (newOrderCount > this.previousOrderCount && this.previousOrderCount > 0) {
            this.successMessage = `התקבלו ${newOrderCount - this.previousOrderCount} הזמנות חדשות!`;
            setTimeout(() => (this.successMessage = ''), 5000);
            this.playNotificationSound();
          }
          this.orders = orders;
          this.previousOrderCount = newOrderCount;
          this.isRefreshing = false;
          this.loadStats();
          if (this.currentTab === 'archive') this.loadArchiveOrders();
        },
        error: () => (this.isRefreshing = false)
      });
  }

  private stopAutoRefresh(): void {
    this.autoRefreshSubscription?.unsubscribe();
    this.autoRefreshSubscription = undefined;
  }

  private playNotificationSound(): void {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 800;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.2);
    } catch {}
  }

  manualRefresh(): void {
    if (this.isRefreshing) return;
    this.isRefreshing = true;
    this.loadOrders();
    if (this.currentTab === 'archive') this.loadArchiveOrders();
  }

  loadOrders(): void {
    if (!this.isRefreshing) this.isLoading = true;
    this.orderService.getAllOrders(false).subscribe({
      next: (orders: Order[]) => {
        if (this.isRefreshing && orders.length > this.previousOrderCount && this.previousOrderCount > 0) {
          this.successMessage = `התקבלו ${orders.length - this.previousOrderCount} הזמנות חדשות!`;
          setTimeout(() => (this.successMessage = ''), 5000);
        }
        this.orders = orders;
        this.rebuildPhoneFrequency();
        this.previousOrderCount = orders.length;
        this.isLoading = false;
        this.isRefreshing = false;
        this.loadStats();
      },
      error: () => {
        this.errorMessage = 'שגיאה בטעינת ההזמנות';
        this.isLoading = false;
        this.isRefreshing = false;
      }
    });
  }

  loadArchiveOrders(): void {
    this.isLoadingArchive = true;
    this.orderService.getAllOrders(true).subscribe({
      next: (list) => {
        this.archiveOrders = list;
        this.rebuildPhoneFrequency();
        this.isLoadingArchive = false;
      },
      error: () => {
        this.isLoadingArchive = false;
        this.errorMessage = 'שגיאה בטעינת הארכיון';
        setTimeout(() => (this.errorMessage = ''), 3000);
      }
    });
  }

  setCurrentTab(tab: 'pending' | 'processing' | 'ready' | 'archive'): void {
    this.currentTab = tab;
    if (tab === 'archive') this.loadArchiveOrders();
  }

  /** Called when archive list might have changed so the view updates immediately */
  private refreshArchiveIfActive(): void {
    if (this.currentTab === 'archive') this.loadArchiveOrders();
  }

  private matchesCustomerFilter(order: Order): boolean {
    if (!this.customerFilter.email && !this.customerFilter.phone) return true;
    const cd = order.customerDetails || {};
    const emailMatch =
      !this.customerFilter.email ||
      (!!cd.email && String(cd.email).toLowerCase() === String(this.customerFilter.email).toLowerCase());
    const phoneMatch =
      !this.customerFilter.phone ||
      (!!cd.phone &&
        this.normalizePhone(String(cd.phone)) === this.normalizePhone(String(this.customerFilter.phone)));
    return Boolean(emailMatch && phoneMatch);
  }

  /**
   * Normalize Israeli phone numbers for matching:
   * - remove non-digits
   * - convert +972 / 972 prefix to local 0-prefix when possible
   */
  normalizePhone(raw: string | undefined | null): string {
    let digits = String(raw || '').replace(/\D/g, '');
    if (!digits) return '';
    if (digits.startsWith('972')) {
      digits = digits.slice(3);
      if (!digits.startsWith('0')) digits = `0${digits}`;
    } else if (digits.startsWith('00972')) {
      digits = digits.slice(5);
      if (!digits.startsWith('0')) digits = `0${digits}`;
    }
    return digits;
  }

  private getOrderPhoneKey(order: Order): string {
    return this.normalizePhone(order.customerDetails?.phone);
  }

  private rebuildPhoneFrequency(): void {
    const map: Record<string, number> = {};
    const all = [...this.orders, ...this.archiveOrders];
    for (const order of all) {
      const key = this.getOrderPhoneKey(order);
      if (!key) continue;
      map[key] = (map[key] || 0) + 1;
    }
    this.phoneFrequency = map;
  }

  isReturningCustomer(order: Order): boolean {
    const key = this.getOrderPhoneKey(order);
    return !!key && (this.phoneFrequency[key] || 0) > 1;
  }

  getCustomerBadge(order: Order): 'VIP' | 'Returning' | null {
    const key = this.getOrderPhoneKey(order);
    if (!key) return null;
    const count = this.phoneFrequency[key] || 0;
    if (count >= 3) return 'VIP';
    if (count >= 2) return 'Returning';
    return null;
  }

  /** True if order is from catering/events (saved with orderType or catering-specific fields). */
  private isCateringOrder(order: Order): boolean {
    if (order.orderType === 'catering') return true;
    if (order.numberOfPortions !== undefined && order.numberOfPortions !== null && order.numberOfPortions !== '') return true;
    if (order.mealTime != null && String(order.mealTime).trim() !== '') return true;
    return false;
  }

  /** Orders from cart/checkout (Ready for Shabbat). */
  get shabbatOrders(): Order[] {
    return this.orders.filter((o) => !this.isCateringOrder(o));
  }

  /** Orders from catering/events form (same collection, differentiated by orderType / numberOfPortions / mealTime). */
  get cateringOrders(): Order[] {
    return this.orders.filter((o) => this.isCateringOrder(o));
  }

  private getArchiveBySource(): Order[] {
    return this.archiveOrders.filter((o) =>
      this.orderSourceTab === 'catering' ? this.isCateringOrder(o) : !this.isCateringOrder(o)
    );
  }

  private getActiveOrdersBySource(): Order[] {
    return this.orderSourceTab === 'shabbat' ? this.shabbatOrders : this.cateringOrders;
  }

  get filteredOrders(): Order[] {
    let list: Order[];
    if (this.currentTab === 'archive') list = this.getArchiveBySource();
    else {
      const sourceList = this.getActiveOrdersBySource();
      list = sourceList.filter((o) => {
        if (this.currentTab === 'pending') return this.isPending(o.status);
        if (this.currentTab === 'processing') return this.isProcessing(o.status);
        if (this.currentTab === 'ready') return o.status === 'ready' || o.status === 'delivered';
        return false;
      });
    }
    return list.filter((o) => this.matchesCustomerFilter(o));
  }

  get countPending(): number {
    const list = this.orderSourceTab === 'shabbat' ? this.shabbatOrders : this.cateringOrders;
    return list.filter((o) => this.isPending(o.status)).length;
  }
  get countProcessing(): number {
    const list = this.orderSourceTab === 'shabbat' ? this.shabbatOrders : this.cateringOrders;
    return list.filter((o) => this.isProcessing(o.status)).length;
  }
  get countReady(): number {
    const list = this.orderSourceTab === 'shabbat' ? this.shabbatOrders : this.cateringOrders;
    return list.filter((o) => o.status === 'ready' || o.status === 'delivered').length;
  }
  get countArchive(): number {
    return this.getArchiveBySource().length;
  }

  get emptyStateMessage(): string {
    const messages: Record<string, string> = {
      pending: 'אין הזמנות ממתינות כרגע',
      processing: 'אין הזמנות בטיפול כרגע',
      ready: 'אין הזמנות מוכנות כרגע',
      archive: 'אין פריטים בארכיון'
    };
    return messages[this.currentTab] || 'אין הזמנות';
  }

  archiveOrder(order: Order): void {
    const orderId = (order._id || order.id)?.toString();
    if (!orderId) return;
    const confirmed = window.confirm('להעביר הזמנה זו לארכיון? לא תימחק לצמיתות.');
    if (!confirmed) return;
    this.statusUpdatingId = orderId;
    this.orderService.deleteOrder(orderId).subscribe({
      next: () => {
        this.orders = this.orders.filter((o) => (o._id || o.id) !== orderId);
        this.archiveOrders = [...this.archiveOrders, { ...order, isDeleted: true }];
        this.rebuildPhoneFrequency();
        this.successMessage = 'ההזמנה הועברה לארכיון בהצלחה';
        setTimeout(() => (this.successMessage = ''), 3000);
        this.statusUpdatingId = null;
        this.loadStats();
        this.refreshArchiveIfActive();
      },
      error: () => {
        this.errorMessage = 'שגיאה בהעברה לארכיון';
        setTimeout(() => (this.errorMessage = ''), 3000);
        this.statusUpdatingId = null;
      }
    });
  }

  restoreOrder(order: Order): void {
    const orderId = (order._id || order.id)?.toString();
    if (!orderId) return;
    this.statusUpdatingId = orderId;
    this.orderService.restoreOrder(orderId).subscribe({
      next: (restored) => {
        this.archiveOrders = this.archiveOrders.filter((o) => (o._id || o.id) !== orderId);
        this.orders = [restored, ...this.orders];
        this.rebuildPhoneFrequency();
        this.successMessage = 'ההזמנה שוחזרה בהצלחה והועברה לטאב ממתינים';
        setTimeout(() => (this.successMessage = ''), 3000);
        this.statusUpdatingId = null;
        this.loadStats();
        this.refreshArchiveIfActive();
      },
      error: () => {
        this.errorMessage = 'שגיאה בשחזור ההזמנה';
        setTimeout(() => (this.errorMessage = ''), 3000);
        this.statusUpdatingId = null;
      }
    });
  }

  permanentlyDeleteOrder(order: Order): void {
    const orderId = (order._id || order.id)?.toString();
    if (!orderId) return;
    const confirmDelete = window.confirm(
      'האם אתה בטוח שברצונך למחוק את ההזמנה לצמיתות? פעולה זו אינה ניתנת לביטול.'
    );
    if (!confirmDelete) return;
    this.statusUpdatingId = orderId;
    this.orderService.hardDeleteOrder(orderId).subscribe({
      next: () => {
        this.archiveOrders = this.archiveOrders.filter((o) => (o._id || o.id) !== orderId);
        this.rebuildPhoneFrequency();
        this.successMessage = 'ההזמנה נמחקה לצמיתות';
        setTimeout(() => (this.successMessage = ''), 3000);
        this.statusUpdatingId = null;
        this.loadStats();
        this.refreshArchiveIfActive();
      },
      error: () => {
        this.errorMessage = 'שגיאה במחיקה לצמיתות';
        setTimeout(() => (this.errorMessage = ''), 3000);
        this.statusUpdatingId = null;
      }
    });
  }

  getWhatsAppLink(order: Order): string {
    const phone = (order.customerDetails?.phone || '').replace(/\D/g, '');
    const num = phone.startsWith('0') ? '972' + phone.slice(1) : phone.startsWith('972') ? phone : '972' + phone;
    const orderCode = order.orderNumber || (order._id || order.id)?.toString().slice(-8) || '';
    const text = encodeURIComponent(
      `שלום, הזמנה #${orderCode}\nלקוח: ${order.customerDetails?.fullName || ''}`
    );
    return `https://wa.me/${num}?text=${text}`;
  }

  printOrder(order: Order): void {
    const itemsHtml = (order.items || [])
      .map(
        (i) =>
          `<tr><td>${i.name}</td><td>${i.quantity}</td><td>₪${(i.price * i.quantity).toFixed(2)}</td></tr>`
      )
      .join('');
    const orderCode = order.orderNumber || (order._id || order.id)?.toString().slice(-8) || '';
    const cd: any = order.customerDetails || {};
    const deliveryMethodRaw = (cd.deliveryType || cd.deliveryMethod || '').toString().toLowerCase();
    const isPickup = deliveryMethodRaw === 'pickup' || deliveryMethodRaw === 'self-pickup' || deliveryMethodRaw === 'self_pickup';
    const orderTypeLabel = isPickup ? 'סוג הזמנה: איסוף עצמי' : 'סוג הזמנה: משלוח';

    const deliveryDetails: any = cd.deliveryDetails || {};
    const addressObj = typeof cd.address === 'object' && cd.address !== null ? cd.address : null;
    const street = deliveryDetails.street || addressObj?.street || '';
    const houseNumber = deliveryDetails.number || addressObj?.number || '';
    const city = deliveryDetails.city || addressObj?.city || cd.city || cd.deliveryCity || '';
    const floor = deliveryDetails.floor || addressObj?.floor || '';
    const apartment = deliveryDetails.apartment || addressObj?.apartment || '';
    const textualAddress = typeof cd.address === 'string' ? cd.address : '';
    const prettyAddress = [
      city ? `עיר: ${city}` : '',
      street ? `רחוב: ${street}` : '',
      houseNumber ? `מספר: ${houseNumber}` : '',
      floor ? `קומה: ${floor}` : '',
      apartment ? `דירה: ${apartment}` : ''
    ]
      .filter(Boolean)
      .join(' | ');
    const addressDisplay = isPickup
      ? 'כתובת: איסוף מבית העסק'
      : (prettyAddress || textualAddress || 'כתובת לא צוינה');

    const customerNotes = (cd.notes || cd.comments || cd.specialRequests || '').toString().trim();
    const notesHtml = customerNotes
      ? `<div class="notes-section"><div class="notes-title">הערות הלקוח:</div><div>${customerNotes}</div></div>`
      : '';
    const html = `
      <!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"><title>הזמנה ${orderCode}</title>
      <style>
      body{font-family:Heebo,Arial,sans-serif;padding:20px;max-width:760px;margin:0 auto;color:#111;background:#fff}
      h1{margin:0 0 8px;color:#111}
      .meta{margin:0 0 14px;font-size:14px}
      .order-type{font-size:24px;font-weight:800;line-height:1.2;margin:6px 0 14px;padding:10px 12px;border:2px solid #111}
      .section{margin:10px 0 14px;padding:10px 12px;border:1px solid #111}
      .section-title{font-weight:800;margin-bottom:4px}
      .notes-section{margin:12px 0;padding:12px;border:2px solid #111}
      .notes-title{font-weight:800;margin-bottom:6px}
      table{width:100%;border-collapse:collapse;margin-top:10px}
      th,td{border:1px solid #111;padding:8px;text-align:right;color:#000}
      th{background:#fff;font-weight:800}
      .total{font-weight:800;font-size:1.2em;margin-top:12px}
      @media print{
        *{color:#000 !important;background:#fff !important;box-shadow:none !important}
        body{margin:0;padding:8mm;max-width:none}
        .order-type,.section,.notes-section{border:1px solid #000 !important}
        table{page-break-inside:auto}
        tr{page-break-inside:avoid}
        thead{display:table-header-group}
      }
      </style></head>
      <body>
        <h1>הזמנה #${orderCode}</h1>
        <div class="order-type">${orderTypeLabel}</div>
        <div class="meta"><strong>סטטוס:</strong> ${this.getStatusLabel(order.status || '')}</div>
        <p><strong>לקוח:</strong> ${order.customerDetails?.fullName || 'לא צוין'}</p>
        <p><strong>טלפון:</strong> ${order.customerDetails?.phone || 'לא צוין'}</p>
        <p><strong>תאריך אירוע:</strong> ${order.customerDetails?.eventDate || 'לא צוין'}</p>
        <div class="section">
          <div class="section-title">כתובת משלוח / איסוף</div>
          <div>${addressDisplay}</div>
        </div>
        ${notesHtml}
        <table><thead><tr><th>פריט</th><th>כמות</th><th>סה"כ</th></tr></thead><tbody>${itemsHtml}</tbody></table>
        <p class="total">סה"כ לתשלום: ₪${(order.totalPrice ?? 0).toFixed(2)}</p>
      </body></html>`;
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(html);
      w.document.close();
      w.focus();
      setTimeout(() => {
        w.print();
        w.close();
      }, 300);
    }
  }

  isPending(status: string): boolean {
    return status === 'pending' || status === 'new';
  }

  isProcessing(status: string): boolean {
    return status === 'processing' || status === 'in-progress';
  }

  isCompleted(status: string): boolean {
    return status === 'ready' || status === 'delivered' || status === 'cancelled';
  }

  changeStatus(order: Order, newStatus: Order['status']): void {
    const orderId = (order._id || order.id)?.toString();
    if (!orderId) return;
    this.statusUpdatingId = orderId;
    const prev = order.status;
    order.status = newStatus;
    this.orderService.updateOrderStatus(orderId, newStatus).subscribe({
      next: (updated) => {
        const idx = this.orders.findIndex((o) => (o._id || o.id) === orderId);
        if (idx > -1) this.orders[idx] = updated;
        this.successMessage =
          newStatus === 'processing'
            ? 'ההזמנה אושרה ומייל נשלח ללקוח'
            : `סטטוס עודכן ל-${this.getStatusLabel(newStatus)}`;
        setTimeout(() => (this.successMessage = ''), 3000);
        this.statusUpdatingId = null;
        this.loadStats();
        this.previousOrderCount = this.orders.length;
      },
      error: () => {
        order.status = prev;
        this.errorMessage = 'שגיאה בעדכון סטטוס';
        setTimeout(() => (this.errorMessage = ''), 3000);
        this.statusUpdatingId = null;
      }
    });
  }

  openStatusEdit(order: Order): void {
    this.orderToEditStatus = order;
  }

  closeStatusEdit(): void {
    this.orderToEditStatus = null;
  }

  applyStatus(value: string): void {
    const order = this.orderToEditStatus;
    if (!order) return;
    const orderId = order._id || order.id || '';
    if (!orderId) return;
    const prev = order.status;
    order.status = value as Order['status'];
    this.orderService.updateOrderStatus(orderId, value as Order['status']).subscribe({
      next: (updated) => {
        const idx = this.orders.findIndex((o) => (o._id || o.id) === orderId);
        if (idx > -1) this.orders[idx] = updated;
        this.successMessage = `סטטוס עודכן ל-${this.getStatusLabel(value)}`;
        setTimeout(() => (this.successMessage = ''), 3000);
        this.closeStatusEdit();
        this.loadStats();
      },
      error: () => {
        order.status = prev;
        this.errorMessage = 'שגיאה בעדכון סטטוס';
        setTimeout(() => (this.errorMessage = ''), 3000);
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
    const originalStatus = order.status;
    order.status = newStatus;
    this.orderService.updateOrderStatus(orderId, newStatus).subscribe({
      next: (updatedOrder: Order) => {
        const index = this.orders.findIndex((o) => (o._id || o.id) === orderId);
        if (index > -1) this.orders[index] = updatedOrder;
        this.successMessage = `סטטוס ההזמנה עודכן ל-${this.getStatusLabel(newStatus)}`;
        setTimeout(() => (this.successMessage = ''), 3000);
        this.loadStats();
      },
      error: () => {
        order.status = originalStatus;
        select.value = originalStatus;
        this.errorMessage = 'שגיאה בעדכון סטטוס ההזמנה';
        setTimeout(() => (this.errorMessage = ''), 3000);
      }
    });
  }

  viewOrderDetails(order: Order): void {
    this.selectedOrder = order;
  }

  closeModal(): void {
    this.selectedOrder = null;
    this.isEditingEventDate = false;
    this.isEditingItems = false;
    this.editableItems = [];
    this.searchTerm = '';
  }

  startEditingItems(): void {
    if (!this.selectedOrder) return;
    this.isEditingItems = true;
    this.searchTerm = '';
    this.editableItems = (this.selectedOrder.items || []).map((item) => ({
      productId: String((item as any).productId || (item as any).id || ''),
      baseName: String((item as any).name || '').split(' - ')[0].trim(),
      name: String(item.name || ''),
      quantity: Number(item.quantity || 1),
      category: String((item as any).category || ''),
      unitPrice: Number((item as any).price || 0),
      selectedOption: (item as any).selectedOption
        ? {
            label: String((item as any).selectedOption.label || '').trim(),
            amount: String((item as any).selectedOption.amount || '').trim() || undefined,
            price: Number((item as any).selectedOption.price ?? (item as any).price ?? 0)
          }
        : undefined
    }));

    if (!this.availableMenuItems.length) {
      this.menuService.getMenuItems().subscribe({
        next: (items) => {
          this.availableMenuItems = Array.isArray(items) ? items.filter((i) => (i._id || i.id)) : [];
        },
        error: () => {
          this.errorMessage = 'שגיאה בטעינת רשימת המוצרים';
          setTimeout(() => (this.errorMessage = ''), 3000);
        }
      });
    }
  }

  cancelEditingItems(): void {
    this.isEditingItems = false;
    this.editableItems = [];
    this.searchTerm = '';
    this.isSavingItems = false;
  }

  removeEditableItem(index: number): void {
    this.editableItems.splice(index, 1);
  }

  get searchResults(): SearchResultItem[] {
    const term = (this.searchTerm || '').trim().toLowerCase();
    if (!term) return [];
    const flattened: SearchResultItem[] = [];
    for (const product of this.availableMenuItems) {
      const productId = String(product._id || product.id || '').trim();
      if (!productId) continue;
      const baseName = String(product.name || '').trim();
      const category = String(product.category || '').trim();
      const options = Array.isArray((product as any).pricingOptions) ? (product as any).pricingOptions : [];
      const variants = Array.isArray((product as any).pricingVariants) ? (product as any).pricingVariants : [];
      const hasOptions = options.length > 0;
      const hasVariants = !hasOptions && variants.length > 0;

      if (hasOptions) {
        for (const option of options) {
          const label = String(option?.label || '').trim();
          const amount = String(option?.amount || '').trim();
          const unitPrice = Number(option?.price ?? 0);
          flattened.push({
            productId,
            baseName,
            displayName: `${baseName} - ${label} (${unitPrice}₪)`,
            category,
            unitPrice,
            selectedOption: { label, amount: amount || undefined, price: unitPrice }
          });
        }
      } else if (hasVariants) {
        for (const variant of variants) {
          const label = String(variant?.label || variant?.size || '').trim();
          const amount = String(variant?.size || '').trim();
          const unitPrice = Number(variant?.price ?? 0);
          flattened.push({
            productId,
            baseName,
            displayName: `${baseName} - ${label} (${unitPrice}₪)`,
            category,
            unitPrice,
            selectedOption: { label, amount: amount || undefined, price: unitPrice }
          });
        }
      } else {
        const unitPrice = Number(product.price || 0);
        flattened.push({
          productId,
          baseName,
          displayName: `${baseName} (${unitPrice}₪)`,
          category,
          unitPrice
        });
      }
    }

    return flattened
      .filter((row) => {
        const name = row.displayName.toLowerCase();
        const category = row.category.toLowerCase();
        return name.includes(term) || category.includes(term);
      })
      .slice(0, 50);
  }

  get editableSubtotal(): number {
    return this.editableItems.reduce((sum, item) => {
      const unitPrice = Number.isFinite(Number(item.unitPrice || 0)) ? Number(item.unitPrice || 0) : 0;
      return sum + unitPrice * Number(item.quantity || 0);
    }, 0);
  }

  addProductToOrder(product: SearchResultItem): void {
    const productId = String(product.productId || '').trim();
    if (!productId) return;
    const selectedLabel = String(product.selectedOption?.label || '').trim();
    const nextName = selectedLabel ? `${product.baseName} - ${selectedLabel}` : product.baseName;

    const existing = this.editableItems.find((i) => {
      const existingLabel = String(i.selectedOption?.label || '').trim();
      return i.productId === productId && existingLabel === selectedLabel;
    });
    if (existing) {
      existing.quantity += 1;
    } else {
      this.editableItems.push({
        productId,
        baseName: product.baseName,
        name: nextName,
        quantity: 1,
        category: product.category || '',
        unitPrice: Number(product.unitPrice || 0),
        selectedOption: product.selectedOption
          ? {
              label: product.selectedOption.label,
              amount: product.selectedOption.amount,
              price: Number(product.selectedOption.price || 0)
            }
          : undefined
      });
    }
    this.searchTerm = '';
  }

  saveEditedItems(): void {
    const order = this.selectedOrder;
    if (!order) return;
    const orderId = (order._id || order.id || '').toString();
    if (!orderId) return;

    const payloadItems = this.editableItems
      .map((item) => ({
        productId: String(item.productId || '').trim(),
        name: String(item.name || '').trim(),
        quantity: Number(item.quantity || 0),
        selectedOption: item.selectedOption
          ? {
              label: String(item.selectedOption.label || '').trim(),
              amount: String(item.selectedOption.amount || '').trim() || undefined,
              price: Number(item.selectedOption.price || item.unitPrice || 0)
            }
          : undefined
      }))
      .filter((item) => item.productId && item.quantity > 0);

    if (!payloadItems.length) {
      this.errorMessage = 'יש לבחור לפחות מוצר אחד להזמנה';
      setTimeout(() => (this.errorMessage = ''), 3000);
      return;
    }

    this.isSavingItems = true;
    this.orderService.updateOrderItems(orderId, payloadItems).subscribe({
      next: (updated) => {
        const normalizedUpdated: Order = {
          ...updated,
          id: (updated._id || updated.id || '').toString()
        };

        // Immediate UI reactivity: replace the updated order in local arrays.
        const replaceInList = (list: Order[]) => {
          const idx = list.findIndex((o) => ((o._id || o.id || '').toString() === orderId));
          if (idx !== -1) list[idx] = normalizedUpdated;
        };
        replaceInList(this.orders);
        replaceInList(this.archiveOrders);

        this.selectedOrder = normalizedUpdated;
        this.cancelEditingItems();
        // Auto-close details modal after successful save.
        this.closeModal();

        this.successMessage = 'פריטי ההזמנה עודכנו בהצלחה';
        setTimeout(() => (this.successMessage = ''), 3000);
        // Keep data in sync with server snapshot.
        this.loadOrders();
        this.loadStats();
      },
      error: (err) => {
        this.isSavingItems = false;
        this.errorMessage = err?.error?.message || 'שגיאה בעדכון פריטי ההזמנה';
        setTimeout(() => (this.errorMessage = ''), 3000);
      }
    });
  }

  /** Return event date as YYYY-MM-DD for <input type="date">. */
  getEventDateForInput(order: Order | null): string {
    if (!order?.customerDetails?.eventDate) return '';
    const d = order.customerDetails.eventDate;
    const date = typeof d === 'string' ? new Date(d) : new Date(d);
    if (isNaN(date.getTime())) return '';
    return date.toISOString().slice(0, 10);
  }

  startEditingEventDate(): void {
    if (!this.selectedOrder) return;
    this.editEventDateValue = this.getEventDateForInput(this.selectedOrder) || new Date().toISOString().slice(0, 10);
    this.isEditingEventDate = true;
  }

  cancelEditingEventDate(): void {
    this.isEditingEventDate = false;
    this.dateUpdatingId = null;
  }

  saveEventDate(): void {
    const order = this.selectedOrder;
    if (!order || !this.editEventDateValue.trim()) return;
    const orderId = (order._id || order.id)?.toString();
    if (!orderId) return;

    this.dateUpdatingId = orderId;
    this.orderService.updateOrderDate(orderId, this.editEventDateValue.trim()).subscribe({
      next: (response) => {
        console.log('Update Success:', response);
        const updated = response;
        const newEventDate =
          updated.customerDetails?.eventDate != null
            ? (typeof updated.customerDetails.eventDate === 'string'
                ? updated.customerDetails.eventDate
                : new Date(updated.customerDetails.eventDate).toISOString().slice(0, 10))
            : this.editEventDateValue.trim();
        this.selectedOrder = { ...updated, id: (updated._id || updated.id)?.toString(), customerDetails: { ...(updated.customerDetails || {}), eventDate: newEventDate } };
        const updateInList = (list: Order[]) => {
          const idx = list.findIndex((o) => (o._id || o.id)?.toString() === orderId);
          if (idx !== -1) {
            list[idx] = { ...list[idx], customerDetails: { ...list[idx].customerDetails, eventDate: newEventDate } };
          }
        };
        updateInList(this.orders);
        updateInList(this.archiveOrders);
        this.dateUpdatingId = null;
        this.isEditingEventDate = false;
        this.successMessage = 'תאריך האספקה עודכן בהצלחה';
        setTimeout(() => (this.successMessage = ''), 3000);
      },
      error: (err) => {
        console.error('Update Failed:', err);
        this.dateUpdatingId = null;
        this.errorMessage = err?.error?.message || 'שגיאה בעדכון התאריך';
        setTimeout(() => (this.errorMessage = ''), 3000);
      }
    });
  }

  openManualOrderBuilder(): void {
    this.isCreatingOrder = true;
  }

  onManualOrderBack(): void {
    this.isCreatingOrder = false;
  }

  onManualOrderCreated(): void {
    this.isCreatingOrder = false;
    this.loadOrders();
    this.loadStats();
    this.successMessage = 'הזמנה טלפונית נוספה בהצלחה';
    setTimeout(() => (this.successMessage = ''), 5000);
  }

  openKitchenReport(): void {
    this.showKitchenReport = true;
  }

  closeKitchenReport(): void {
    this.showKitchenReport = false;
  }

  formatDate(date: string | Date | undefined): string {
    if (!date) return 'לא צוין';
    return new Date(date).toLocaleDateString('he-IL', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      pending: 'ממתין',
      new: 'חדש',
      processing: 'בטיפול',
      'in-progress': 'בטיפול',
      ready: 'מוכן',
      delivered: 'נמסר',
      cancelled: 'בוטל'
    };
    return labels[status] || status;
  }

  /** Human-readable meal types for catering orders (e.g. evening/morning/both). */
  getMealTypesLabel(order: Order): string {
    if (order.mealTypes) return order.mealTypes;
    const m = order.mealTime;
    if (!m) return '—';
    const map: Record<string, string> = { evening: 'ערב שבת', morning: 'שבת בבוקר', both: 'ערב + בוקר' };
    return map[m] || m;
  }

  trackByOrderId(index: number, order: Order): string {
    return order._id || order.id || '';
  }
}
