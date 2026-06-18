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
  kitchenNotes?: string;
  selectedOption?: SelectedOptionPayload;
};

type KitchenPrepLine = {
  name: string;
  category: string;
  kitchenNotes: string;
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
  failedOrders: Order[] = [];
  archiveOrders: Order[] = [];
  stats: DashboardStats = { pendingCount: 0, eventsTodayCount: 0, monthlyRevenue: 0 };
  /** Top-level tab: Shabbat (e-commerce) vs Shabbat Catering form vs Events Catering. */
  orderSourceTab: 'shabbat' | 'catering' | 'events' = 'shabbat';
  currentTab: 'pending' | 'processing' | 'ready' | 'failed' | 'archive' = 'pending';
  isLoading = true;
  isRefreshing = false;
  isLoadingArchive = false;
  isLoadingFailed = false;
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
  kitchenPrepLines: KitchenPrepLine[] = [];
  isSavingKitchenPrep = false;
  /** True while a capture request is in flight. */
  isCapturing = false;
  /** True while a void request is in flight. */
  isVoiding = false;
  /**
   * Set to true when admin saves edited items on an 'authorized' order.
   * Warns that the capture amount will differ from the pre-auth hold amount.
   */
  authorizedAmountMismatchWarning = false;

  /** Ordered list of catering categories used in view and edit modes. */
  readonly CATERING_CATEGORY_ORDER = [
    'סלטים',
    'מנות ראשונות — ערב',
    'מנות ראשונות — בוקר',
    'מנות עיקריות — ערב',
    'מנות עיקריות — בוקר',
    'מנות ראשונות',
    'מנות עיקריות',
    'תוספות ערב',
    'תוספות בוקר',
    'שונות'
  ];
  readonly EVENTS_CATERING_CATEGORY_ORDER = [
    'תפריט בסיס',
    'שדרוגים',
    'בר קבלת פנים',
    'סלטים',
    'מנות ראשונות',
    'מנות עיקריות',
    'תוספות',
    'קינוחים'
  ];
  /** New catering item fields used in the catering edit panel. */
  cateringNewItemName = '';
  cateringNewItemCategory = 'סלטים';
  availableMenuItems: MenuItem[] = [];
  searchTerm = '';
  isSavingItems = false;
  activeOrderMenuId: string | null = null;
  selectedOrderIds = new Set<string>();
  isBulkUpdating = false;
  bulkStatusTarget: Order['status'] = 'processing';
  private readonly KPI_STORAGE_KEY = 'admin_orders_kpi_v1';

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
    this.loadFailedOrders();
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

  private trackKpi(eventName: string): void {
    try {
      const current = localStorage.getItem(this.KPI_STORAGE_KEY);
      const parsed = current ? JSON.parse(current) as Record<string, number> : {};
      parsed[eventName] = Number(parsed[eventName] || 0) + 1;
      localStorage.setItem(this.KPI_STORAGE_KEY, JSON.stringify(parsed));
    } catch {
      // Keep UX resilient even when storage is unavailable.
    }
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
    this.trackKpi('orders_manual_refresh');
    this.loadOrders();
    if (this.currentTab === 'failed') this.loadFailedOrders();
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
        this.pruneSelection();
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

  loadFailedOrders(): void {
    this.isLoadingFailed = true;
    this.orderService.getAllOrders(false, undefined, 'failed').subscribe({
      next: (list) => {
        this.failedOrders = list;
        this.pruneSelection();
        this.isLoadingFailed = false;
      },
      error: () => {
        this.isLoadingFailed = false;
        this.errorMessage = 'שגיאה בטעינת הזמנות שנכשלו';
        setTimeout(() => (this.errorMessage = ''), 3000);
      }
    });
  }

  loadArchiveOrders(): void {
    this.isLoadingArchive = true;
    this.orderService.getAllOrders(true).subscribe({
      next: (list) => {
        this.archiveOrders = list;
        this.pruneSelection();
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

  setCurrentTab(tab: 'pending' | 'processing' | 'ready' | 'failed' | 'archive'): void {
    this.currentTab = tab;
    this.activeOrderMenuId = null;
    this.clearSelection();
    if (tab === 'failed') this.loadFailedOrders();
    if (tab === 'archive') this.loadArchiveOrders();
  }

  toggleOrderMenu(order: Order): void {
    const id = String(order._id || order.id || '');
    if (!id) return;
    this.activeOrderMenuId = this.activeOrderMenuId === id ? null : id;
  }

  closeOrderMenu(): void {
    this.activeOrderMenuId = null;
  }

  isOrderMenuOpen(order: Order): boolean {
    return this.activeOrderMenuId === String(order._id || order.id || '');
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

  /** True if order is specifically from the events catering form (cateringKind:'events'). */
  private isEventCateringOrder(order: Order): boolean {
    return order.cateringKind === 'events';
  }

  /** True if order is from the Shabbat/holiday catering form (cateringKind:'shabbat' or old orders without cateringKind). */
  isShabbatCateringOrder(order: Order | null): boolean {
    if (!order) return false;
    return this.isCateringOrder(order) && !this.isEventCateringOrder(order);
  }

  /** Shabbat/holiday or events catering — kitchen prep sheet applies to both. */
  supportsKitchenPrepSheet(order: Order | null): boolean {
    return !!order && this.isCateringOrder(order);
  }

  /** Orders from cart/checkout (Ready for Shabbat). */
  get shabbatOrders(): Order[] {
    return this.orders.filter((o) => !this.isCateringOrder(o));
  }

  /** Orders from the Shabbat & holiday catering form. */
  get cateringOrders(): Order[] {
    return this.orders.filter((o) => this.isShabbatCateringOrder(o));
  }

  /** Orders from the events catering form (wedding, corporate, etc.). */
  get eventCateringOrders(): Order[] {
    return this.orders.filter((o) => this.isEventCateringOrder(o));
  }

  private getArchiveBySource(): Order[] {
    if (this.orderSourceTab === 'catering') return this.archiveOrders.filter((o) => this.isShabbatCateringOrder(o));
    if (this.orderSourceTab === 'events') return this.archiveOrders.filter((o) => this.isEventCateringOrder(o));
    return this.archiveOrders.filter((o) => !this.isCateringOrder(o));
  }

  private getActiveOrdersBySource(): Order[] {
    if (this.orderSourceTab === 'catering') return this.cateringOrders;
    if (this.orderSourceTab === 'events') return this.eventCateringOrders;
    return this.shabbatOrders;
  }

  private getFailedOrdersBySource(): Order[] {
    if (this.orderSourceTab === 'catering') {
      return this.failedOrders.filter((o) => this.isShabbatCateringOrder(o));
    }
    if (this.orderSourceTab === 'events') {
      return this.failedOrders.filter((o) => this.isEventCateringOrder(o));
    }
    return this.failedOrders.filter((o) => !this.isCateringOrder(o));
  }

  get filteredOrders(): Order[] {
    let list: Order[];
    if (this.currentTab === 'archive') list = this.getArchiveBySource();
    else if (this.currentTab === 'failed') list = this.getFailedOrdersBySource();
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

  private getOrderId(order: Order): string {
    return String(order._id || order.id || '').trim();
  }

  private pruneSelection(): void {
    const allowedIds = new Set(
      [...this.orders, ...this.failedOrders, ...this.archiveOrders]
        .map((order) => this.getOrderId(order))
        .filter(Boolean)
    );
    const next = new Set<string>();
    this.selectedOrderIds.forEach((id) => {
      if (allowedIds.has(id)) next.add(id);
    });
    this.selectedOrderIds = next;
  }

  clearSelection(): void {
    this.selectedOrderIds = new Set<string>();
  }

  isOrderSelected(order: Order): boolean {
    return this.selectedOrderIds.has(this.getOrderId(order));
  }

  toggleOrderSelection(order: Order, checked: boolean): void {
    const id = this.getOrderId(order);
    if (!id) return;
    const next = new Set(this.selectedOrderIds);
    if (checked) next.add(id);
    else next.delete(id);
    this.selectedOrderIds = next;
  }

  get areAllVisibleSelected(): boolean {
    const ids = this.filteredOrders.map((order) => this.getOrderId(order)).filter(Boolean);
    return ids.length > 0 && ids.every((id) => this.selectedOrderIds.has(id));
  }

  get selectedVisibleCount(): number {
    let count = 0;
    for (const order of this.filteredOrders) {
      if (this.selectedOrderIds.has(this.getOrderId(order))) count += 1;
    }
    return count;
  }

  toggleSelectAllVisible(checked: boolean): void {
    const next = new Set(this.selectedOrderIds);
    const visibleIds = this.filteredOrders.map((order) => this.getOrderId(order)).filter(Boolean);
    for (const id of visibleIds) {
      if (checked) next.add(id);
      else next.delete(id);
    }
    this.selectedOrderIds = next;
  }

  private executeBulkAction(action: 'status' | 'archive' | 'restore' | 'permanent_delete', status?: Order['status']): void {
    const orderIds = Array.from(this.selectedOrderIds);
    if (!orderIds.length || this.isBulkUpdating) return;

    this.isBulkUpdating = true;
    this.orderService.bulkUpdateOrders({ orderIds, action, status }).subscribe({
      next: (result) => {
        const affectedCount = action === 'permanent_delete' ? result.deletedCount : result.modifiedCount;
        this.clearSelection();
        this.loadOrders();
        this.loadArchiveOrders();
        this.loadStats();
        this.successMessage = `עודכנו ${affectedCount} הזמנות בהצלחה`;
        setTimeout(() => (this.successMessage = ''), 3000);
        this.isBulkUpdating = false;
      },
      error: (err) => {
        this.errorMessage = err?.error?.message || 'שגיאה בביצוע פעולה קבוצתית';
        setTimeout(() => (this.errorMessage = ''), 3000);
        this.isBulkUpdating = false;
      }
    });
  }

  applyBulkStatus(): void {
    if (!this.selectedOrderIds.size) return;
    this.executeBulkAction('status', this.bulkStatusTarget);
  }

  bulkArchiveSelected(): void {
    if (!this.selectedOrderIds.size) return;
    if (!window.confirm(`להעביר ${this.selectedOrderIds.size} הזמנות לארכיון?`)) return;
    this.executeBulkAction('archive');
  }

  bulkRestoreSelected(): void {
    if (!this.selectedOrderIds.size) return;
    this.executeBulkAction('restore');
  }

  bulkPermanentDeleteSelected(): void {
    if (!this.selectedOrderIds.size) return;
    if (!window.confirm(`למחוק לצמיתות ${this.selectedOrderIds.size} הזמנות? פעולה זו אינה ניתנת לביטול.`)) return;
    this.executeBulkAction('permanent_delete');
  }

  get countPending(): number {
    const list = this.getActiveOrdersBySource();
    return list.filter((o) => this.isPending(o.status)).length;
  }
  get countProcessing(): number {
    const list = this.getActiveOrdersBySource();
    return list.filter((o) => this.isProcessing(o.status)).length;
  }
  get countReady(): number {
    const list = this.getActiveOrdersBySource();
    return list.filter((o) => o.status === 'ready' || o.status === 'delivered').length;
  }
  get countArchive(): number {
    return this.getArchiveBySource().length;
  }
  get countFailed(): number {
    return this.getFailedOrdersBySource().length;
  }

  get emptyStateMessage(): string {
    const messages: Record<string, string> = {
      pending: 'אין הזמנות ממתינות כרגע',
      processing: 'אין הזמנות בטיפול כרגע',
      ready: 'אין הזמנות מוכנות כרגע',
      failed: 'אין הזמנות שנכשלו או ננטשו',
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
    this.trackKpi('orders_archived');
    this.orderService.deleteOrder(orderId).subscribe({
      next: () => {
        this.orders = this.orders.filter((o) => (o._id || o.id) !== orderId);
        this.failedOrders = this.failedOrders.filter((o) => (o._id || o.id) !== orderId);
        this.selectedOrderIds = new Set(Array.from(this.selectedOrderIds).filter((id) => id !== orderId));
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
    this.trackKpi('orders_restored');
    this.orderService.restoreOrder(orderId).subscribe({
      next: (restored) => {
        this.archiveOrders = this.archiveOrders.filter((o) => (o._id || o.id) !== orderId);
        this.selectedOrderIds = new Set(Array.from(this.selectedOrderIds).filter((id) => id !== orderId));
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
    this.trackKpi('orders_deleted_permanent');
    this.orderService.hardDeleteOrder(orderId).subscribe({
      next: () => {
        this.archiveOrders = this.archiveOrders.filter((o) => (o._id || o.id) !== orderId);
        this.selectedOrderIds = new Set(Array.from(this.selectedOrderIds).filter((id) => id !== orderId));
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
    const totalPrice = Number(order.totalPrice || 0);
    const rawSubtotal = Number((order as any).subtotal ?? (order.customerDetails as any)?.subtotal);
    const rawDeliveryFee = Number((order as any).deliveryFee ?? (order.customerDetails as any)?.deliveryFee);
    const itemsSubtotal = (order.items || []).reduce(
      (sum, i) => sum + Number(i.price || 0) * Number(i.quantity || 0),
      0
    );
    const subtotal = Number.isFinite(rawSubtotal) && rawSubtotal >= 0 ? rawSubtotal : itemsSubtotal;
    const deliveryFee = Number.isFinite(rawDeliveryFee) && rawDeliveryFee >= 0
      ? rawDeliveryFee
      : Math.max(0, totalPrice - subtotal);

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

    const isCatering = order.orderType === 'catering';
    const allItemsFree = (order.items || []).every(i => Number(i.price || 0) === 0);

    // Build items table — catering orders group by category, no price column
    let itemsHtml = '';
    if (isCatering || allItemsFree) {
      // Group items by category
      const byCategory: Record<string, string[]> = {};
      (order.items || []).forEach(i => {
        const cat = (i as any).category || 'כללי';
        if (!byCategory[cat]) byCategory[cat] = [];
        byCategory[cat].push(i.name);
      });
      if (Object.keys(byCategory).length === 0) {
        itemsHtml = '<tr><td colspan="2" style="text-align:center;color:#888;">אין פרטים שמורים</td></tr>';
      } else {
        const categoryOrder = this.getCateringCategoryOrder(order);
        const sortedCategories = [
          ...categoryOrder.filter((c) => byCategory[c]),
          ...Object.keys(byCategory).filter((c) => !categoryOrder.includes(c))
        ];
        itemsHtml = sortedCategories
          .map((cat) =>
            `<tr class="cat-header"><td colspan="2"><strong>${cat}</strong></td></tr>` +
            byCategory[cat].map(n => `<tr><td>${n}</td><td>✓</td></tr>`).join('')
          )
          .join('');
      }
    } else {
      itemsHtml = (order.items || [])
        .map(i => `<tr><td>${i.name}</td><td>${i.quantity}</td><td>₪${(Number(i.price) * Number(i.quantity)).toFixed(2)}</td></tr>`)
        .join('');
    }

    // Header row for table
    const tableHeader = (isCatering || allItemsFree)
      ? '<tr><th>פריט</th><th>נבחר</th></tr>'
      : '<tr><th>פריט</th><th>כמות</th><th>סה"כ</th></tr>';

    // Catering meta block — includes both shabbat and events catering details
    const cateringMetaHtml = isCatering
      ? `<div class="section">
          <div class="section-title">פרטי קייטרינג</div>
          ${ (order as any).eventType ? `<p><strong>סוג אירוע:</strong> ${ (order as any).eventType }</p>` : '' }
          ${ (order as any).guestCount ? `<p><strong>מספר אורחים:</strong> ${ (order as any).guestCount }</p>` : '' }
          ${ cd.deliveryType ? `<p><strong>אספקה:</strong> ${ cd.deliveryType === 'delivery' ? 'משלוח לכתובת' : 'איסוף עצמי' }</p>` : '' }
          ${ (order.subtotal ?? cd.pricePerPortion) ? `<p><strong>מחיר למנה (משוער):</strong> ₪${Number(order.subtotal ?? cd.pricePerPortion).toFixed(0)}</p>` : '' }
          ${ (order as any).venue ? `<p><strong>מיקום האירוע:</strong> ${ (order as any).venue }</p>` : '' }
          ${ (order as any).numberOfPortions && !(order as any).eventType ? `<p><strong>מספר מנות:</strong> ${ (order as any).numberOfPortions }</p>` : '' }
          ${ (order as any).mealTypes ? `<p><strong>סוג ארוחה:</strong> ${ (order as any).mealTypes }</p>` : '' }
        </div>`
      : '';

    // Summary block — hide for shabbat catering with totalPrice 0; show estimate for events
    const isEventsCatering = (order as any).cateringKind === 'events';
    const summaryHtml = (isCatering && totalPrice === 0 && !isEventsCatering)
      ? ''
      : `<div class="summary">
          ${!isEventsCatering ? `<div class="summary-row"><span>סכום פריטים:</span><span>₪${subtotal.toFixed(2)}</span></div>` : ''}
          ${isEventsCatering && (order.subtotal ?? cd.pricePerPortion) ? `<div class="summary-row"><span>מחיר למנה (משוער):</span><span>₪${Number(order.subtotal ?? cd.pricePerPortion).toFixed(0)}</span></div>` : ''}
          ${!isPickup && !isEventsCatering ? `<div class="summary-row"><span>דמי משלוח:</span><span>₪${deliveryFee.toFixed(2)}</span></div>` : ''}
          <div class="summary-row total-row"><span>${isEventsCatering ? 'סה״כ משוער:' : 'סה"כ לתשלום:'}</span><span>₪${totalPrice.toFixed(isEventsCatering ? 0 : 2)}</span></div>
        </div>`;

    const html = `
      <!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"><title>הזמנה ${orderCode}</title>
      <style>
      body{font-family:Heebo,Arial,sans-serif;padding:20px;max-width:760px;margin:0 auto;color:#111;background:#fff}
      h1{margin:0 0 8px;color:#111}
      .meta{margin:0 0 14px;font-size:14px}
      .order-type{font-size:24px;font-weight:800;line-height:1.2;margin:6px 0 14px;padding:10px 12px;border:2px solid #111}
      .section{margin:10px 0 14px;padding:10px 12px;border:1px solid #111}
      .section p{margin:4px 0}
      .section-title{font-weight:800;margin-bottom:4px}
      .notes-section{margin:12px 0;padding:12px;border:2px solid #111}
      .notes-title{font-weight:800;margin-bottom:6px}
      table{width:100%;border-collapse:collapse;margin-top:10px}
      th,td{border:1px solid #111;padding:8px;text-align:right;color:#000}
      th{background:#fff;font-weight:800}
      tr.cat-header td{background:#f4f4f4;font-weight:800;border-top:2px solid #111}
      .summary{margin-top:14px;border:1px solid #111;padding:10px 12px}
      .summary-row{display:flex;justify-content:space-between;align-items:center;padding:4px 0}
      .summary-row + .summary-row{border-top:1px dashed #111}
      .summary-row.total-row{font-weight:800}
      @media print{
        *{color:#000 !important;background:#fff !important;box-shadow:none !important}
        body{margin:0;padding:8mm;max-width:none}
        .order-type,.section,.notes-section{border:1px solid #000 !important}
        table{page-break-inside:auto}
        tr{page-break-inside:avoid}
        thead{display:table-header-group}
        tr.cat-header td{background:#f4f4f4 !important}
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
        ${cateringMetaHtml}
        ${notesHtml}
        <table><thead>${tableHeader}</thead><tbody>${itemsHtml}</tbody></table>
        ${summaryHtml}
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

  /** Save kitchen prep notes (stored on each order item's description field). */
  saveKitchenPrepNotes(): void {
    const order = this.selectedOrder;
    if (!order || !this.supportsKitchenPrepSheet(order)) return;
    const orderId = (order._id || order.id || '').toString();
    if (!orderId) return;

    const sourceItems = order.items || [];
    if (!sourceItems.length) return;

    const payloadItems = sourceItems.map((item, index) => ({
      productId: String((item as { productId?: string }).productId || ''),
      name: String(item.name || ''),
      quantity: Number(item.quantity || 1),
      category: String((item as { category?: string }).category || ''),
      price: Number((item as { price?: number }).price || 0),
      description: (this.kitchenPrepLines[index]?.kitchenNotes || '').trim() || undefined
    }));

    this.isSavingKitchenPrep = true;
    this.orderService.updateOrderItems(orderId, payloadItems).subscribe({
      next: (updated) => {
        this.isSavingKitchenPrep = false;
        const normalized: Order = { ...updated, id: (updated._id || updated.id || '').toString() };
        this.selectedOrder = normalized;
        const replaceInList = (list: Order[]) => {
          const idx = list.findIndex((o) => (o._id || o.id || '').toString() === orderId);
          if (idx > -1) list[idx] = normalized;
        };
        replaceInList(this.orders);
        replaceInList(this.failedOrders);
        replaceInList(this.archiveOrders);
        this.refreshKitchenPrepLines();
        this.successMessage = 'הערות המטבח נשמרו';
        setTimeout(() => (this.successMessage = ''), 3000);
      },
      error: () => {
        this.isSavingKitchenPrep = false;
        this.errorMessage = 'שגיאה בשמירת הערות המטבח';
        setTimeout(() => (this.errorMessage = ''), 3000);
      }
    });
  }

  /** Kitchen print sheet — includes editable prep notes column (admin only). */
  printKitchenSheet(order: Order): void {
    if (!this.supportsKitchenPrepSheet(order)) {
      this.printOrder(order);
      return;
    }

    const orderCode = order.orderNumber || (order._id || order.id)?.toString().slice(-8) || '';
    const cd: Record<string, unknown> = order.customerDetails || {};
    const isEvents = this.isEventCateringOrder(order);
    const portions = isEvents
      ? (order as { guestCount?: string | number }).guestCount
      : (order as { numberOfPortions?: string | number }).numberOfPortions;
    const mealLabel = isEvents ? '' : this.getMealTypesLabel(order);
    const eventType = isEvents ? String((order as { eventType?: string }).eventType || '') : '';
    const venue = isEvents ? String((order as { venue?: string }).venue || '') : '';

    const prepByKey = new Map<string, string>();
    const sameOrder =
      this.selectedOrder &&
      (this.selectedOrder._id || this.selectedOrder.id)?.toString() === (order._id || order.id)?.toString();
    if (sameOrder) {
      this.kitchenPrepLines.forEach((line) => {
        prepByKey.set(`${line.category}::${line.name}`, line.kitchenNotes);
      });
    }

    const byCategory: Record<string, Array<{ name: string; notes: string }>> = {};
    (order.items || []).forEach((item) => {
      const cat = String((item as { category?: string }).category || 'כללי');
      const name = String(item.name || '');
      const key = `${cat}::${name}`;
      const notes =
        prepByKey.get(key) ||
        String((item as { description?: string }).description || '').trim();
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push({ name, notes });
    });

    const categoryOrder = this.getCateringCategoryOrder(order);
    const sortedCategories = [
      ...categoryOrder.filter((c) => byCategory[c]),
      ...Object.keys(byCategory).filter((c) => !categoryOrder.includes(c))
    ];

    let rowIndex = 0;
    const rowsHtml = sortedCategories
      .map((cat) => {
        const header = `<tr class="cat-header"><td colspan="3"><strong>${cat}</strong></td></tr>`;
        const itemRows = byCategory[cat]
          .map((row) => {
            rowIndex += 1;
            const inputId = `kitchen-note-${rowIndex}`;
            const escapedNotes = row.notes
              .replace(/&/g, '&amp;')
              .replace(/"/g, '&quot;')
              .replace(/</g, '&lt;');
            return `<tr>
              <td>${row.name}</td>
              <td class="check-col">✓</td>
              <td><input type="text" class="kitchen-note-input" id="${inputId}" value="${escapedNotes}" placeholder="כמויות, הוראות הכנה, הבהרות..." /></td>
            </tr>`;
          })
          .join('');
        return header + itemRows;
      })
      .join('');

    const html = `<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"><title>דף מטבח ${orderCode}</title>
      <style>
        body{font-family:Heebo,Arial,sans-serif;padding:16px;max-width:900px;margin:0 auto;color:#111}
        h1{margin:0 0 6px;font-size:1.5rem}
        .meta{margin-bottom:14px;font-size:14px;line-height:1.6}
        .toolbar{margin:12px 0 16px;display:flex;gap:8px}
        .toolbar button{padding:8px 14px;border:1px solid #111;background:#fff;cursor:pointer;font-family:inherit}
        table{width:100%;border-collapse:collapse}
        th,td{border:1px solid #111;padding:8px;text-align:right;vertical-align:middle}
        th{background:#f4f4f4;font-weight:700}
        tr.cat-header td{background:#f8f8f8;font-weight:700}
        .check-col{width:48px;text-align:center}
        .kitchen-note-input{width:100%;border:1px solid #bbb;padding:6px 8px;font-family:inherit;font-size:14px;box-sizing:border-box}
        @media print{
          .toolbar{display:none !important}
          .kitchen-note-input{border:none !important;padding:0 !important}
          body{padding:8mm}
        }
      </style></head><body>
        <h1>דף הכנה למטבח — הזמנה #${orderCode}</h1>
        <div class="meta">
          <div><strong>לקוח:</strong> ${String(cd['fullName'] || 'לא צוין')}</div>
          <div><strong>טלפון:</strong> ${String(cd['phone'] || 'לא צוין')}</div>
          <div><strong>תאריך אירוע:</strong> ${String(cd['eventDate'] || 'לא צוין')}</div>
          ${eventType ? `<div><strong>סוג אירוע:</strong> ${eventType}</div>` : ''}
          ${venue ? `<div><strong>מיקום:</strong> ${venue}</div>` : ''}
          ${portions ? `<div><strong>${isEvents ? 'מספר אורחים' : 'מספר מנות'}:</strong> ${portions}</div>` : ''}
          ${mealLabel ? `<div><strong>סוג ארוחה:</strong> ${mealLabel}</div>` : ''}
        </div>
        <div class="toolbar no-print">
          <button type="button" onclick="window.print()">הדפס</button>
          <button type="button" onclick="window.close()">סגור</button>
        </div>
        <table>
          <thead><tr><th>פריט</th><th>נבחר</th><th>הערות למטבח</th></tr></thead>
          <tbody>${rowsHtml || '<tr><td colspan="3">אין פריטים</td></tr>'}</tbody>
        </table>
      </body></html>`;

    const w = window.open('', '_blank');
    if (w) {
      w.document.write(html);
      w.document.close();
      w.focus();
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
    this.applyStatusForOrder(order, newStatus);
  }

  private applyStatusForOrder(order: Order, newStatus: Order['status']): void {
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
        this.trackKpi('orders_status_updated');
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
    this.closeOrderMenu();
  }

  closeStatusEdit(): void {
    this.orderToEditStatus = null;
  }

  applyStatus(value: string): void {
    const order = this.orderToEditStatus;
    if (!order) return;
    const orderId = order._id || order.id || '';
    if (!orderId) return;
    this.closeStatusEdit();
    this.applyStatusForOrder(order, value as Order['status']);
  }

  updateStatus(order: Order, event: Event): void {
    const select = event.target as HTMLSelectElement;
    const newStatus = select.value as Order['status'];
    this.applyStatusForOrder(order, newStatus);
  }

  viewOrderDetails(order: Order): void {
    this.selectedOrder = order;
    this.refreshKitchenPrepLines();
  }

  private refreshKitchenPrepLines(): void {
    if (!this.selectedOrder || !this.supportsKitchenPrepSheet(this.selectedOrder)) {
      this.kitchenPrepLines = [];
      return;
    }
    this.kitchenPrepLines = (this.selectedOrder.items || []).map((item) => ({
      name: String(item.name || ''),
      category: String((item as { category?: string }).category || 'כללי'),
      kitchenNotes: String((item as { description?: string }).description || '').trim()
    }));
  }

  closeModal(): void {
    this.selectedOrder = null;
    this.isEditingEventDate = false;
    this.isEditingItems = false;
    this.editableItems = [];
    this.kitchenPrepLines = [];
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
      kitchenNotes: String((item as any).description || '').trim(),
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
    this.cateringNewItemName = '';
    this.cateringNewItemCategory = 'סלטים';
  }

  /** Public getter so the template can check if the selected order is a catering order. */
  get isSelectedOrderCatering(): boolean {
    return !!this.selectedOrder && this.isCateringOrder(this.selectedOrder);
  }

  /** Category display order for catering orders in admin view/edit. */
  private getCateringCategoryOrder(order?: Order | null): string[] {
    if (order?.cateringKind === 'events') return this.EVENTS_CATERING_CATEGORY_ORDER;
    return this.CATERING_CATEGORY_ORDER;
  }

  /**
   * Returns editableItems grouped by category in the defined catering order.
   * Used in the edit panel for catering orders.
   */
  getCateringItemsByCategory(): { category: string; items: EditableOrderItem[]; startIndex: number }[] {
    const categoryOrder = this.getCateringCategoryOrder(this.selectedOrder);
    const grouped: Record<string, EditableOrderItem[]> = {};
    this.editableItems.forEach((item) => {
      const cat = item.category || 'כללי';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(item);
    });
    const result: { category: string; items: EditableOrderItem[]; startIndex: number }[] = [];
    let offset = 0;
    // Defined order first
    categoryOrder.forEach((cat) => {
      if (grouped[cat]) {
        result.push({ category: cat, items: grouped[cat], startIndex: offset });
        offset += grouped[cat].length;
      }
    });
    // Any extra categories not in the defined order
    Object.keys(grouped).forEach((cat) => {
      if (!categoryOrder.includes(cat)) {
        result.push({ category: cat, items: grouped[cat], startIndex: offset });
        offset += grouped[cat].length;
      }
    });
    return result;
  }

  /**
   * Returns selectedOrder.items grouped by category for the VIEW (read-only) mode.
   */
  getCateringViewItemsByCategory(): { category: string; items: { name: string; kitchenNotes?: string }[] }[] {
    if (!this.selectedOrder) return [];
    const categoryOrder = this.getCateringCategoryOrder(this.selectedOrder);
    const grouped: Record<string, { name: string; kitchenNotes?: string }[]> = {};
    (this.selectedOrder.items || []).forEach((item) => {
      const cat = (item as any).category || 'כללי';
      if (!grouped[cat]) grouped[cat] = [];
      const kitchenNotes = String((item as any).description || '').trim();
      grouped[cat].push({
        name: item.name,
        kitchenNotes: kitchenNotes || undefined
      });
    });
    const result: { category: string; items: { name: string; kitchenNotes?: string }[] }[] = [];
    categoryOrder.forEach((cat) => {
      if (grouped[cat]) result.push({ category: cat, items: grouped[cat] });
    });
    Object.keys(grouped).forEach((cat) => {
      if (!categoryOrder.includes(cat)) result.push({ category: cat, items: grouped[cat] });
    });
    return result;
  }

  /** Add a free-text catering item to the editable list. */
  addCateringItem(): void {
    const name = (this.cateringNewItemName || '').trim();
    if (!name) return;
    this.editableItems.push({
      productId: '',
      baseName: name,
      name,
      quantity: 1,
      category: this.cateringNewItemCategory,
      unitPrice: 0,
      selectedOption: undefined
    });
    this.cateringNewItemName = '';
  }

  /** Get the real index of a catering item within the flat editableItems array. */
  getCateringItemGlobalIndex(catIndex: number, itemIndex: number): number {
    let offset = 0;
    const groups = this.getCateringItemsByCategory();
    for (let i = 0; i < catIndex; i++) offset += groups[i].items.length;
    return offset + itemIndex;
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

    const payloadItems = this.isCateringOrder(order)
      ? this.editableItems
          .filter((item) => item.name.trim() && item.quantity > 0)
          .map((item) => ({
            productId: item.productId || '',
            name: item.name.trim(),
            quantity: Number(item.quantity),
            category: item.category || '',
            price: 0,
            description: (item.kitchenNotes || '').trim() || undefined
          }))
      : this.editableItems
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
        // If the order was authorized, flag a potential amount mismatch for the UI warning
        if (this.selectedOrder?.paymentStatus === 'authorized') {
          this.authorizedAmountMismatchWarning = true;
        }
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
    this.trackKpi('orders_manual_created');
    setTimeout(() => (this.successMessage = ''), 5000);
  }

  openKitchenReport(): void {
    this.showKitchenReport = true;
    this.trackKpi('orders_kitchen_report_opened');
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

  // ─── Payment actions ──────────────────────────────────────────────────────

  /** Human-readable label for paymentStatus. */
  getPaymentStatusLabel(status: Order['paymentStatus']): string {
    const labels: Record<string, string> = {
      pending: 'ממתין לתשלום',
      awaiting_payment: 'ננטש (לא הושלם תשלום)',
      authorized: 'מאושר (טרם חויב)',
      captured: 'חויב',
      voided: 'בוטל (הסכום שוחרר)',
      failed: 'נכשל'
    };
    return labels[status ?? 'pending'] ?? status ?? '—';
  }

  /**
   * True when admin has edited order items while the order is 'authorized'.
   * The new totalPrice might differ from authorizedAmount — admin needs to be aware.
   */
  get isAmountMismatch(): boolean {
    if (!this.selectedOrder) return false;
    if (this.selectedOrder.paymentStatus !== 'authorized') return false;
    const authorized = this.selectedOrder.authorizedAmount;
    if (authorized == null) return false;
    return Math.abs(Number(this.selectedOrder.totalPrice) - authorized) > 0.01;
  }

  /**
   * Finalise the charge for the selected order.
   * Only callable when paymentStatus === 'authorized'.
   */
  capturePayment(): void {
    const order = this.selectedOrder;
    if (!order) return;
    const orderId = (order._id || order.id || '').toString();
    if (!orderId || this.isCapturing) return;

    if (
      this.isAmountMismatch &&
      !window.confirm(
        `שים לב: סכום ההרשאה המקורית היה ₪${order.authorizedAmount?.toFixed(2)}, ` +
        `אך הסכום הנוכחי הוא ₪${order.totalPrice.toFixed(2)}.\n\n` +
        `חיוב בסכום שונה מההרשאה עשוי לדרוש אישור נוסף מהספק.\n\n` +
        `להמשיך עם חיוב בסכום ₪${order.totalPrice.toFixed(2)}?`
      )
    ) {
      return;
    }

    this.isCapturing = true;
    this.orderService.capturePayment(orderId).subscribe({
      next: (res) => {
        this.isCapturing = false;
        // Update selected order and the local list immediately
        const patch: Partial<Order> = { paymentStatus: 'captured', status: 'processing' };
        this.selectedOrder = { ...order, ...patch };
        this._patchOrderInLists(orderId, patch);
        this.successMessage = res.message || 'החיוב בוצע בהצלחה';
        setTimeout(() => (this.successMessage = ''), 4000);
        this.loadStats();
      },
      error: (err) => {
        this.isCapturing = false;
        this.errorMessage = err?.error?.message || 'שגיאה בביצוע החיוב';
        setTimeout(() => (this.errorMessage = ''), 4000);
      }
    });
  }

  /**
   * Release the pre-auth hold when admin cancels the order before capture.
   * Only callable when paymentStatus === 'authorized'.
   */
  voidPayment(): void {
    const order = this.selectedOrder;
    if (!order) return;
    const orderId = (order._id || order.id || '').toString();
    if (!orderId || this.isVoiding) return;

    if (!window.confirm('לבטל את ההרשאה ולשחרר את ההחזקה בכרטיס האשראי של הלקוח?')) return;

    this.isVoiding = true;
    this.orderService.voidPayment(orderId).subscribe({
      next: (res) => {
        this.isVoiding = false;
        const patch: Partial<Order> = { paymentStatus: 'voided', status: 'cancelled' };
        this.selectedOrder = { ...order, ...patch };
        this._patchOrderInLists(orderId, patch);
        this.successMessage = res.message || 'ההרשאה בוטלה וההחזקה שוחררה';
        setTimeout(() => (this.successMessage = ''), 4000);
        this.loadStats();
      },
      error: (err) => {
        this.isVoiding = false;
        this.errorMessage = err?.error?.message || 'שגיאה בביטול ההרשאה';
        setTimeout(() => (this.errorMessage = ''), 4000);
      }
    });
  }

  /** Patch a single order in both `orders` and `archiveOrders` arrays without a full reload. */
  private _patchOrderInLists(orderId: string, patch: Partial<Order>): void {
    const apply = (list: Order[]) => {
      const idx = list.findIndex((o) => (o._id || o.id || '').toString() === orderId);
      if (idx !== -1) list[idx] = { ...list[idx], ...patch };
    };
    apply(this.orders);
    apply(this.archiveOrders);
  }
}
