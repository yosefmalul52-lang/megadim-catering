import { Component, OnInit, OnDestroy, inject, HostListener } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { interval, Subscription } from 'rxjs';
import { startWith } from 'rxjs/operators';

import { OrderService, Order, DashboardStats, OrderTabCounts, OrderSourceTabCounts, AdminOrdersSortBy } from '../../../services/order.service';
import { MenuService, MenuItem } from '../../../services/menu.service';
import { AuthService } from '../../../services/auth.service';
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

type OrdersColumnFilterKey = 'orderNumber' | 'customer' | 'createdAt' | 'eventDate' | 'notes';

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
  private router = inject(Router);
  private authService = inject(AuthService);

  /** When true, hide orders list and show full-page manual order builder */
  isCreatingOrder = false;

  /** Optional filter from query params when navigating from customers page */
  customerFilter: { email?: string; phone?: string } = {};
  /** Frequency map by normalized phone for VIP/returning badges. */
  private phoneFrequency: Record<string, number> = {};

  orders: Order[] = [];
  stats: DashboardStats = { pendingCount: 0, eventsTodayCount: 0, monthlyRevenue: 0 };
  /** Server-side tab counts — not limited by orders list page size. */
  tabCounts: OrderTabCounts | null = null;
  tabCountsUseFallback = false;
  /** Server-side pagination for current tab view. */
  listPage = 1;
  listLimit = 25;
  listTotal = 0;
  listTotalPages = 1;
  appliedOrderNumberSearch = '';
  appliedCustomerSearch = '';
  listCreatedFrom = '';
  listCreatedTo = '';
  listEventFrom = '';
  listEventTo = '';
  /** Optional client-side fulfillment filter from dashboard deep-links. */
  listFulfillmentFilter: '' | 'delivery' | 'pickup' = '';
  listHasCustomerNotes = false;
  listHasAdminNotes = false;
  openFilterColumn: OrdersColumnFilterKey | null = null;
  showMobileFiltersPanel = false;
  draftOrderNumberSearch = '';
  draftCustomerSearch = '';
  draftCreatedFrom = '';
  draftCreatedTo = '';
  draftEventFrom = '';
  draftEventTo = '';
  draftHasCustomerNotes = false;
  draftHasAdminNotes = false;
  sortColumn: AdminOrdersSortBy | null = null;
  sortDirection: 'asc' | 'desc' = 'asc';
  /** Top-level tab: Shabbat (e-commerce) vs Shabbat Catering form vs Events Catering. */
  orderSourceTab: 'shabbat' | 'catering' | 'events' = 'shabbat';
  currentTab: 'pending' | 'processing' | 'ready' | 'failed' | 'archive' = 'pending';
  isLoading = true;
  isRefreshing = false;
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
  /** When true, show portion count editors for Shabbat catering orders. */
  isEditingPortions = false;
  editPortionsEvening = 0;
  editPortionsMorning = 0;
  portionsUpdatingId: string | null = null;
  editAdminNotesValue = '';
  isSavingAdminNotes = false;
  isEditingItems = false;
  editableItems: EditableOrderItem[] = [];
  kitchenPrepLines: KitchenPrepLine[] = [];
  isSavingKitchenPrep = false;
  isEditingShippingCost = false;
  editingShippingCostValue = 0;
  isSavingShippingCost = false;
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
  autoRefreshEnabled = true;
  private readonly REFRESH_INTERVAL = 30000;

  ngOnInit(): void {
    this.loadStats();
    this.loadTabCounts();
    this.startAutoRefresh();
    this.route.queryParams.subscribe((params) => {
      this.applyDashboardQueryParams(params);
      this.customerFilter = {};
      if (params['customerEmail']) this.customerFilter.email = params['customerEmail'];
      if (params['customerPhone']) this.customerFilter.phone = params['customerPhone'];
      this.listPage = 1;
      this.loadOrdersPage();
      if (params['orderId']) {
        this.openOrderById(String(params['orderId']));
      }
      if (params['create'] === '1' || params['create'] === 'true') {
        this.openManualOrderBuilder();
      }
      if (params['kitchenReport'] === '1' || params['kitchenReport'] === 'true') {
        this.openKitchenReport();
      }
    });
  }

  /**
   * Safe deep-link filters from the ops dashboard.
   * Only applies known enum values; ignores unknown keys.
   */
  private applyDashboardQueryParams(params: Record<string, string>): void {
    const source = String(params['source'] || '').toLowerCase();
    if (source === 'shabbat' || source === 'catering' || source === 'events') {
      this.orderSourceTab = source;
    }

    const statusTab = String(params['statusTab'] || '').toLowerCase();
    if (
      statusTab === 'pending' ||
      statusTab === 'processing' ||
      statusTab === 'ready' ||
      statusTab === 'failed' ||
      statusTab === 'archive'
    ) {
      this.currentTab = statusTab;
    }

    const eventFrom = String(params['eventFrom'] || '').trim();
    const eventTo = String(params['eventTo'] || '').trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(eventFrom)) this.listEventFrom = eventFrom;
    if (/^\d{4}-\d{2}-\d{2}$/.test(eventTo)) this.listEventTo = eventTo;

    const fulfillment = String(params['fulfillment'] || '').toLowerCase();
    if (fulfillment === 'delivery' || fulfillment === 'pickup') {
      this.listFulfillmentFilter = fulfillment;
    } else if (params['fulfillment'] != null) {
      this.listFulfillmentFilter = '';
    }
  }

  /** Admin role only — drivers/staff must not toggle test-order flag. */
  get isAdminUser(): boolean {
    return String(this.authService.currentUser?.role || '').toLowerCase() === 'admin';
  }

  private openOrderById(orderId: string): void {
    if (!orderId) return;
    this.orderService.getOrderById(orderId).subscribe({
      next: (order) => {
        if (order) this.viewOrderDetails(order);
      },
      error: () => {
        this.errorMessage = 'לא ניתן לפתוח את ההזמנה מהקישור';
        setTimeout(() => (this.errorMessage = ''), 3000);
      }
    });
  }

  /**
   * Mark / unmark order as test. Admin only. Confirms before PATCH.
   */
  toggleTestOrder(order: Order): void {
    if (!this.isAdminUser) {
      this.errorMessage = 'רק מנהל יכול לשנות סימון הזמנת בדיקה';
      setTimeout(() => (this.errorMessage = ''), 3000);
      return;
    }
    const orderId = (order._id || order.id)?.toString();
    if (!orderId) return;

    const next = !order.isTestOrder;
    const confirmMsg = next
      ? 'לסמן הזמנה זו כהזמנת בדיקה? היא תוחרג ממדדי הדשבורד העסקי.'
      : 'להסיר סימון הזמנת בדיקה? ההזמנה תחזור להיכלל במדדים העסקיים.';
    if (!confirm(confirmMsg)) return;

    this.statusUpdatingId = orderId;
    this.orderService.setOrderTestFlag(orderId, next).subscribe({
      next: (res) => {
        const updated = res?.data
          ? { ...res.data, id: res.data._id || res.data.id, isTestOrder: next }
          : { isTestOrder: next };
        this._patchOrderInLists(orderId, updated);
        if (this.selectedOrder && (this.selectedOrder._id || this.selectedOrder.id)?.toString() === orderId) {
          this.selectedOrder = { ...this.selectedOrder, ...updated };
        }
        this.successMessage = next ? 'ההזמנה סומנה כהזמנת בדיקה' : 'סימון הזמנת הבדיקה הוסר';
        setTimeout(() => (this.successMessage = ''), 3000);
        this.statusUpdatingId = null;
        this.closeOrderMenu();
      },
      error: (err) => {
        this.errorMessage = err?.error?.message || 'שגיאה בעדכון סימון הזמנת בדיקה';
        setTimeout(() => (this.errorMessage = ''), 3000);
        this.statusUpdatingId = null;
      }
    });
  }

  ngOnDestroy(): void {
    this.stopAutoRefresh();
  }

  loadStats(): void {
    this.orderService.getDashboardStats().subscribe((s) => (this.stats = s));
  }

  loadTabCounts(): void {
    this.orderService.getOrderTabCounts().subscribe({
      next: (counts) => {
        this.tabCounts = counts;
        this.tabCountsUseFallback = false;
      },
      error: () => {
        if (!this.tabCountsUseFallback) {
          console.warn(
            '[admin-orders] getOrderTabCounts failed — falling back to local counts from loaded orders (may be inaccurate above 100 orders)'
          );
        }
        this.tabCountsUseFallback = true;
      }
    });
  }

  private getCurrentSourceCounts(): OrderSourceTabCounts | null {
    if (!this.tabCounts) return null;
    return this.tabCounts[this.orderSourceTab] ?? null;
  }

  private getActiveOrdersBySourceTab(_source: 'shabbat' | 'catering' | 'events'): Order[] {
    return this.orders;
  }

  private getArchiveBySourceTab(_source: 'shabbat' | 'catering' | 'events'): Order[] {
    return this.currentTab === 'archive' ? this.orders : [];
  }

  private getFailedOrdersBySourceTab(_source: 'shabbat' | 'catering' | 'events'): Order[] {
    return this.currentTab === 'failed' ? this.orders : [];
  }

  private countSourceTotalLocal(source: 'shabbat' | 'catering' | 'events'): number {
    const list = this.getActiveOrdersBySourceTab(source);
    const pending = list.filter((o) => this.isPending(o.status)).length;
    const processing = list.filter((o) => this.isProcessing(o.status)).length;
    const ready = list.filter((o) => o.status === 'ready' || o.status === 'delivered').length;
    const failed = this.getFailedOrdersBySourceTab(source).length;
    return pending + processing + ready + failed;
  }

  get countSourceShabbat(): number {
    const c = this.tabCounts?.shabbat;
    if (c) return c.total;
    return this.countSourceTotalLocal('shabbat');
  }

  get countSourceCatering(): number {
    const c = this.tabCounts?.catering;
    if (c) return c.total;
    return this.countSourceTotalLocal('catering');
  }

  get countSourceEvents(): number {
    const c = this.tabCounts?.events;
    if (c) return c.total;
    return this.countSourceTotalLocal('events');
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
      .pipe(startWith(0))
      .subscribe({
        next: () => {
          if (this.isRefreshing || this.isLoading) return;
          this.isRefreshing = true;
          this.loadTabCounts();
          this.loadOrdersPage(undefined, { silent: true });
        }
      });
  }

  private stopAutoRefresh(): void {
    this.autoRefreshSubscription?.unsubscribe();
    this.autoRefreshSubscription = undefined;
  }

  manualRefresh(): void {
    if (this.isRefreshing) return;
    this.isRefreshing = true;
    this.trackKpi('orders_manual_refresh');
    this.loadTabCounts();
    this.loadOrdersPage();
  }

  private buildOrdersPageParams(page = this.listPage) {
    return {
      page,
      limit: this.listLimit,
      source: this.orderSourceTab,
      statusTab: this.currentTab,
      orderNumberSearch: this.appliedOrderNumberSearch.trim() || undefined,
      customerSearch: this.appliedCustomerSearch.trim() || undefined,
      createdFrom: this.listCreatedFrom || undefined,
      createdTo: this.listCreatedTo || undefined,
      eventFrom: this.listEventFrom || undefined,
      eventTo: this.listEventTo || undefined,
      sortBy: this.sortColumn || undefined,
      sortDir: this.sortColumn ? this.sortDirection : undefined,
      hasCustomerNotes: this.listHasCustomerNotes || undefined,
      hasAdminNotes: this.listHasAdminNotes || undefined
    };
  }

  loadOrdersPage(page?: number, options?: { silent?: boolean }): void {
    const targetPage = page ?? this.listPage;
    if (!options?.silent && !this.isRefreshing) this.isLoading = true;

    this.orderService.getAdminOrdersPage(this.buildOrdersPageParams(targetPage)).subscribe({
      next: (result) => {
        const { orders, pagination } = result;
        if (
          orders.length === 0 &&
          pagination.total > 0 &&
          pagination.page > 1
        ) {
          this.loadOrdersPage(pagination.page - 1, options);
          return;
        }

        this.orders = orders;
        this.listPage = pagination.page;
        this.listLimit = pagination.limit;
        this.listTotal = pagination.total;
        this.listTotalPages = pagination.totalPages;
        this.pruneSelection();
        this.rebuildPhoneFrequency();
        this.isLoading = false;
        this.isRefreshing = false;
        if (!options?.silent) {
          this.loadStats();
        }
      },
      error: () => {
        this.errorMessage = 'שגיאה בטעינת ההזמנות';
        this.isLoading = false;
        this.isRefreshing = false;
      }
    });
  }

  private reloadAfterMutation(): void {
    this.loadTabCounts();
    this.loadOrdersPage();
  }

  setOrderSourceTab(tab: 'shabbat' | 'catering' | 'events'): void {
    if (this.orderSourceTab === tab) return;
    this.orderSourceTab = tab;
    this.listPage = 1;
    this.activeOrderMenuId = null;
    this.clearSelection();
    this.loadOrdersPage(1);
  }

  applyListFilters(): void {
    this.openFilterColumn = null;
    this.showMobileFiltersPanel = false;
    this.listPage = 1;
    this.loadOrdersPage(1);
  }

  clearListFilters(): void {
    this.appliedOrderNumberSearch = '';
    this.appliedCustomerSearch = '';
    this.listCreatedFrom = '';
    this.listCreatedTo = '';
    this.listEventFrom = '';
    this.listEventTo = '';
    this.listHasCustomerNotes = false;
    this.listHasAdminNotes = false;
    this.syncFilterDraftsFromApplied();
    this.openFilterColumn = null;
    this.showMobileFiltersPanel = false;
    this.listPage = 1;
    this.loadOrdersPage(1);
  }

  @HostListener('document:click')
  closeColumnFilterDropdown(): void {
    this.openFilterColumn = null;
  }

  private syncFilterDraftsFromApplied(): void {
    this.draftOrderNumberSearch = this.appliedOrderNumberSearch;
    this.draftCustomerSearch = this.appliedCustomerSearch;
    this.draftCreatedFrom = this.listCreatedFrom;
    this.draftCreatedTo = this.listCreatedTo;
    this.draftEventFrom = this.listEventFrom;
    this.draftEventTo = this.listEventTo;
    this.draftHasCustomerNotes = this.listHasCustomerNotes;
    this.draftHasAdminNotes = this.listHasAdminNotes;
  }

  toggleColumnFilter(column: OrdersColumnFilterKey, event: Event): void {
    event.stopPropagation();
    if (this.openFilterColumn === column) {
      this.openFilterColumn = null;
      return;
    }
    this.syncFilterDraftsFromApplied();
    this.openFilterColumn = column;
  }

  applyColumnFilter(column: OrdersColumnFilterKey, event?: Event): void {
    event?.stopPropagation();
    switch (column) {
      case 'orderNumber':
        this.appliedOrderNumberSearch = this.draftOrderNumberSearch.trim();
        break;
      case 'customer':
        this.appliedCustomerSearch = this.draftCustomerSearch.trim();
        break;
      case 'createdAt':
        this.listCreatedFrom = this.draftCreatedFrom;
        this.listCreatedTo = this.draftCreatedTo;
        break;
      case 'eventDate':
        this.listEventFrom = this.draftEventFrom;
        this.listEventTo = this.draftEventTo;
        break;
      case 'notes':
        this.listHasCustomerNotes = this.draftHasCustomerNotes;
        this.listHasAdminNotes = this.draftHasAdminNotes;
        break;
    }
    this.openFilterColumn = null;
    this.listPage = 1;
    this.loadOrdersPage(1);
  }

  clearColumnFilter(column: OrdersColumnFilterKey, event?: Event): void {
    event?.stopPropagation();
    switch (column) {
      case 'orderNumber':
        this.draftOrderNumberSearch = '';
        this.appliedOrderNumberSearch = '';
        break;
      case 'customer':
        this.draftCustomerSearch = '';
        this.appliedCustomerSearch = '';
        break;
      case 'createdAt':
        this.draftCreatedFrom = '';
        this.draftCreatedTo = '';
        this.listCreatedFrom = '';
        this.listCreatedTo = '';
        break;
      case 'eventDate':
        this.draftEventFrom = '';
        this.draftEventTo = '';
        this.listEventFrom = '';
        this.listEventTo = '';
        break;
      case 'notes':
        this.draftHasCustomerNotes = false;
        this.draftHasAdminNotes = false;
        this.listHasCustomerNotes = false;
        this.listHasAdminNotes = false;
        break;
    }
    this.openFilterColumn = null;
    this.listPage = 1;
    this.loadOrdersPage(1);
  }

  isColumnFilterActive(column: OrdersColumnFilterKey): boolean {
    switch (column) {
      case 'orderNumber':
        return !!this.appliedOrderNumberSearch.trim();
      case 'customer':
        return !!this.appliedCustomerSearch.trim();
      case 'createdAt':
        return !!(this.listCreatedFrom || this.listCreatedTo);
      case 'eventDate':
        return !!(this.listEventFrom || this.listEventTo);
      case 'notes':
        return this.listHasCustomerNotes || this.listHasAdminNotes;
      default:
        return false;
    }
  }

  toggleMobileFiltersPanel(event: Event): void {
    event.stopPropagation();
    this.showMobileFiltersPanel = !this.showMobileFiltersPanel;
    if (this.showMobileFiltersPanel) this.syncFilterDraftsFromApplied();
  }

  applyMobileFilters(event: Event): void {
    event.stopPropagation();
    this.appliedOrderNumberSearch = this.draftOrderNumberSearch.trim();
    this.appliedCustomerSearch = this.draftCustomerSearch.trim();
    this.listCreatedFrom = this.draftCreatedFrom;
    this.listCreatedTo = this.draftCreatedTo;
    this.listEventFrom = this.draftEventFrom;
    this.listEventTo = this.draftEventTo;
    this.listHasCustomerNotes = this.draftHasCustomerNotes;
    this.listHasAdminNotes = this.draftHasAdminNotes;
    this.applyListFilters();
  }

  onSortColumn(column: AdminOrdersSortBy, event?: Event): void {
    event?.stopPropagation();
    this.openFilterColumn = null;
    if (this.sortColumn !== column) {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    } else if (this.sortDirection === 'asc') {
      this.sortDirection = 'desc';
    } else {
      this.sortColumn = null;
      this.sortDirection = 'asc';
    }
    this.listPage = 1;
    this.loadOrdersPage(1);
  }

  getSortIndicator(column: AdminOrdersSortBy): string {
    if (this.sortColumn !== column) return '';
    return this.sortDirection === 'asc' ? ' ▲' : ' ▼';
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.listTotalPages || page === this.listPage) return;
    this.loadOrdersPage(page);
  }

  onPageSizeChange(limit: number): void {
    this.listLimit = limit;
    this.listPage = 1;
    this.loadOrdersPage(1);
  }

  get listRangeFrom(): number {
    if (this.listTotal === 0) return 0;
    return (this.listPage - 1) * this.listLimit + 1;
  }

  get listRangeTo(): number {
    if (this.listTotal === 0) return 0;
    return Math.min(this.listPage * this.listLimit, this.listTotal);
  }

  get hasActiveListFilters(): boolean {
    return !!(
      this.appliedOrderNumberSearch.trim() ||
      this.appliedCustomerSearch.trim() ||
      this.listCreatedFrom ||
      this.listCreatedTo ||
      this.listEventFrom ||
      this.listEventTo ||
      this.listHasCustomerNotes ||
      this.listHasAdminNotes
    );
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

  setCurrentTab(tab: 'pending' | 'processing' | 'ready' | 'failed' | 'archive'): void {
    if (this.currentTab === tab) return;
    this.currentTab = tab;
    this.listPage = 1;
    this.activeOrderMenuId = null;
    this.clearSelection();
    this.loadOrdersPage(1);
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
    for (const order of this.orders) {
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

  /** Retail (cart/checkout) orders support manual shipping cost edits. */
  canEditShippingCost(order: Order | null): boolean {
    return !!order && !this.isCateringOrder(order);
  }

  getShippingCost(order: Order | null): number {
    if (!order) return 0;
    const fee = order.deliveryFee ?? order.customerDetails?.deliveryFee;
    return fee != null && Number.isFinite(Number(fee)) ? Number(fee) : 0;
  }

  startEditingShippingCost(): void {
    if (!this.selectedOrder || !this.canEditShippingCost(this.selectedOrder)) return;
    this.editingShippingCostValue = this.getShippingCost(this.selectedOrder);
    this.isEditingShippingCost = true;
  }

  cancelEditingShippingCost(): void {
    this.isEditingShippingCost = false;
  }

  saveShippingCost(): void {
    if (!this.selectedOrder || this.isSavingShippingCost) return;
    const orderId = (this.selectedOrder._id || this.selectedOrder.id)?.toString();
    if (!orderId) return;

    const newCost = Number(this.editingShippingCostValue);
    if (!Number.isFinite(newCost) || newCost < 0) {
      this.errorMessage = 'דמי משלוח חייבים להיות מספר חיובי';
      setTimeout(() => (this.errorMessage = ''), 3000);
      return;
    }

    this.isSavingShippingCost = true;
    this.orderService.updateShippingCost(orderId, newCost).subscribe({
      next: (updated) => {
        this.isSavingShippingCost = false;
        this.isEditingShippingCost = false;

        const normalized: Order = {
          ...updated,
          id: (updated._id || updated.id)?.toString(),
          customerDetails: {
            ...(updated.customerDetails || {}),
            deliveryFee: updated.deliveryFee ?? updated.customerDetails?.deliveryFee,
            subtotal: updated.subtotal ?? updated.customerDetails?.subtotal
          }
        };

        this.selectedOrder = normalized;
        this._patchOrderInLists(orderId, {
          deliveryFee: normalized.deliveryFee,
          subtotal: normalized.subtotal,
          totalPrice: normalized.totalPrice,
          customerDetails: normalized.customerDetails
        });

        if (normalized.paymentStatus === 'authorized') {
          this.authorizedAmountMismatchWarning = true;
        }

        this.successMessage = 'דמי המשלוח עודכנו והסכום חושב מחדש';
        setTimeout(() => (this.successMessage = ''), 3000);
      },
      error: (err) => {
        this.isSavingShippingCost = false;
        this.errorMessage = err?.error?.message || 'שגיאה בעדכון דמי המשלוח';
        setTimeout(() => (this.errorMessage = ''), 3000);
      }
    });
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

  get displayOrders(): Order[] {
    return this.orders.filter((o) => this.matchesCustomerFilter(o) && this.matchesFulfillmentFilter(o));
  }

  private matchesFulfillmentFilter(order: Order): boolean {
    if (!this.listFulfillmentFilter) return true;
    const cd = (order.customerDetails || {}) as Record<string, unknown>;
    const raw = String(cd['deliveryType'] || cd['deliveryMethod'] || '')
      .trim()
      .toLowerCase();
    const isPickup = raw === 'pickup' || raw === 'self-pickup' || raw === 'self_pickup';
    const isDelivery = raw === 'delivery';
    if (this.listFulfillmentFilter === 'pickup') return isPickup;
    if (this.listFulfillmentFilter === 'delivery') return isDelivery;
    return true;
  }

  private getOrderId(order: Order): string {
    return String(order._id || order.id || '').trim();
  }

  private pruneSelection(): void {
    const allowedIds = new Set(
      this.orders.map((order) => this.getOrderId(order)).filter(Boolean)
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
    const ids = this.displayOrders.map((order) => this.getOrderId(order)).filter(Boolean);
    return ids.length > 0 && ids.every((id) => this.selectedOrderIds.has(id));
  }

  get selectedVisibleCount(): number {
    let count = 0;
    for (const order of this.displayOrders) {
      if (this.selectedOrderIds.has(this.getOrderId(order))) count += 1;
    }
    return count;
  }

  toggleSelectAllVisible(checked: boolean): void {
    const next = new Set(this.selectedOrderIds);
    const visibleIds = this.displayOrders.map((order) => this.getOrderId(order)).filter(Boolean);
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
        this.reloadAfterMutation();
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
    const c = this.getCurrentSourceCounts();
    if (c) return c.pending;
    return this.currentTab === 'pending' ? this.listTotal : 0;
  }
  get countProcessing(): number {
    const c = this.getCurrentSourceCounts();
    if (c) return c.processing;
    return this.currentTab === 'processing' ? this.listTotal : 0;
  }
  get countReady(): number {
    const c = this.getCurrentSourceCounts();
    if (c) return c.ready;
    return this.currentTab === 'ready' ? this.listTotal : 0;
  }
  get countArchive(): number {
    const c = this.getCurrentSourceCounts();
    if (c) return c.archive;
    return this.currentTab === 'archive' ? this.listTotal : 0;
  }
  get countFailed(): number {
    const c = this.getCurrentSourceCounts();
    if (c) return c.failed;
    return this.currentTab === 'failed' ? this.listTotal : 0;
  }

  get emptyStateMessage(): string {
    if (this.hasActiveListFilters || this.customerFilter.email || this.customerFilter.phone) {
      return 'לא נמצאו הזמנות לפי הסינון הנוכחי';
    }
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
        this.selectedOrderIds = new Set(Array.from(this.selectedOrderIds).filter((id) => id !== orderId));
        this.successMessage = 'ההזמנה הועברה לארכיון בהצלחה';
        setTimeout(() => (this.successMessage = ''), 3000);
        this.statusUpdatingId = null;
        this.reloadAfterMutation();
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
      next: () => {
        this.selectedOrderIds = new Set(Array.from(this.selectedOrderIds).filter((id) => id !== orderId));
        this.successMessage = 'ההזמנה שוחזרה בהצלחה והועברה לטאב ממתינים';
        setTimeout(() => (this.successMessage = ''), 3000);
        this.statusUpdatingId = null;
        this.currentTab = 'pending';
        this.listPage = 1;
        this.reloadAfterMutation();
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
        this.selectedOrderIds = new Set(Array.from(this.selectedOrderIds).filter((id) => id !== orderId));
        this.successMessage = 'ההזמנה נמחקה לצמיתות';
        setTimeout(() => (this.successMessage = ''), 3000);
        this.statusUpdatingId = null;
        this.reloadAfterMutation();
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

  /** Kitchen print sheet — internal prep document for catering orders. */
  printKitchenSheet(order: Order): void {
    if (!this.supportsKitchenPrepSheet(order)) {
      this.printOrder(order);
      return;
    }

    const html = this.buildKitchenSheetHtml(order);
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(html);
      w.document.close();
      w.focus();
    }
  }

  private escapeKitchenHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private getKitchenCustomerNotes(order: Order): string {
    const cd = order.customerDetails || {};
    const raw = (
      cd.notes ||
      (cd as { comments?: string }).comments ||
      (cd as { specialRequests?: string }).specialRequests ||
      ''
    )
      .toString()
      .trim();
    return raw;
  }

  private parseSeudaShlishitFromNotes(notes: string): boolean | null {
    if (/סעודה שלישית:\s*כן/.test(notes)) return true;
    if (/סעודה שלישית:\s*לא/.test(notes)) return false;
    return null;
  }

  private getKitchenPortionsInfo(order: Order): {
    evening: number;
    morning: number;
    total: number;
    hasBreakdown: boolean;
    legacyOnly: boolean;
    mealLabel: string;
    seudaShlishit: boolean | null;
  } {
    const mealTime = (order.mealTime || '').toString();
    const mealLabel = this.getMealTypesLabel(order);
    const hasBreakdown = this.hasPortionsBreakdown(order);
    const legacy = Math.max(0, Math.trunc(Number(order.numberOfPortions) || 0));

    let evening = 0;
    let morning = 0;
    if (hasBreakdown) {
      evening = Math.max(0, Math.trunc(Number(order.portionsEvening) || 0));
      morning = Math.max(0, Math.trunc(Number(order.portionsMorning) || 0));
    } else if (mealTime === 'evening') {
      evening = legacy;
    } else if (mealTime === 'morning') {
      morning = legacy;
    }

    const total = hasBreakdown ? evening + morning : legacy;
    const seudaShlishit = this.parseSeudaShlishitFromNotes(this.getKitchenCustomerNotes(order));

    return {
      evening,
      morning,
      total,
      hasBreakdown,
      legacyOnly: !hasBreakdown && (mealTime === 'both' || !mealTime),
      mealLabel,
      seudaShlishit
    };
  }

  private classifyCateringCategory(category: string): 'evening' | 'morning' | 'salads' | 'third' | 'other' {
    const cat = category.trim();
    if (cat === 'סלטים') return 'salads';
    if (/ערב|evening/i.test(cat)) return 'evening';
    if (/בוקר|morning/i.test(cat)) return 'morning';
    if (/שלישית|seuda/i.test(cat)) return 'third';
    return 'other';
  }

  private getKitchenRowPortionQty(
    section: 'evening' | 'morning' | 'salads' | 'third' | 'other',
    portions: {
      evening: number;
      morning: number;
      total: number;
    },
    isEvents: boolean,
    guestCount: number
  ): number | string {
    if (isEvents) {
      return guestCount > 0 ? guestCount : 'לפי אורחים';
    }
    if (section === 'evening') {
      return portions.evening > 0 ? portions.evening : portions.total > 0 ? portions.total : 'לפי הזמנה';
    }
    if (section === 'morning') {
      return portions.morning > 0 ? portions.morning : portions.total > 0 ? portions.total : 'לפי הזמנה';
    }
    return portions.total > 0 ? portions.total : 'לפי הזמנה';
  }

  private formatKitchenDeliveryAddress(cd: Record<string, unknown>): string {
    const deliveryMethodRaw = (cd['deliveryType'] || cd['deliveryMethod'] || '').toString().toLowerCase();
    const isPickup =
      deliveryMethodRaw === 'pickup' ||
      deliveryMethodRaw === 'self-pickup' ||
      deliveryMethodRaw === 'self_pickup';
    if (isPickup) return 'איסוף עצמי';

    const deliveryDetails = (cd['deliveryDetails'] || {}) as Record<string, unknown>;
    const addressObj =
      typeof cd['address'] === 'object' && cd['address'] !== null
        ? (cd['address'] as Record<string, unknown>)
        : null;
    const street = String(deliveryDetails['street'] || addressObj?.['street'] || '');
    const houseNumber = String(deliveryDetails['number'] || addressObj?.['number'] || '');
    const city = String(deliveryDetails['city'] || addressObj?.['city'] || cd['city'] || '');
    const textualAddress = typeof cd['address'] === 'string' ? String(cd['address']) : '';
    const parts = [city, street, houseNumber].filter(Boolean);
    return parts.length ? parts.join(', ') : textualAddress || 'לא צוינה';
  }

  private formatKitchenDeliveryType(cd: Record<string, unknown>): string {
    const raw = (cd['deliveryType'] || cd['deliveryMethod'] || '').toString().toLowerCase();
    if (raw === 'delivery') return 'משלוח';
    if (raw === 'pickup' || raw === 'self-pickup' || raw === 'self_pickup') return 'איסוף עצמי';
    return '';
  }

  private buildKitchenSheetHtml(order: Order): string {
    const orderCode = order.orderNumber || (order._id || order.id)?.toString().slice(-8) || '';
    const cd: Record<string, unknown> = order.customerDetails || {};
    const isEvents = this.isEventCateringOrder(order);
    const isShabbat = this.isShabbatCateringOrder(order);
    const printedAt = new Date().toLocaleString('he-IL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    const reportTitle = isEvents
      ? 'דוח הכנה למטבח — קייטרינג אירועים'
      : 'דוח הכנה למטבח — קייטרינג שבת/חג';

    const prepByKey = new Map<string, string>();
    const sameOrder =
      this.selectedOrder &&
      (this.selectedOrder._id || this.selectedOrder.id)?.toString() === (order._id || order.id)?.toString();
    if (sameOrder) {
      this.kitchenPrepLines.forEach((line) => {
        prepByKey.set(`${line.category}::${line.name}`, line.kitchenNotes);
      });
    }

    const itemsByCategory: Record<string, Array<{ name: string; notes: string }>> = {};
    (order.items || []).forEach((item) => {
      const cat = String((item as { category?: string }).category || 'כללי');
      const name = String(item.name || '');
      const key = `${cat}::${name}`;
      const notes =
        prepByKey.get(key) ||
        String((item as { description?: string }).description || '').trim();
      if (!itemsByCategory[cat]) itemsByCategory[cat] = [];
      itemsByCategory[cat].push({ name, notes });
    });

    const categoryOrder = this.getCateringCategoryOrder(order);
    const sortedCategories = [
      ...categoryOrder.filter((c) => itemsByCategory[c]),
      ...Object.keys(itemsByCategory).filter((c) => !categoryOrder.includes(c))
    ];

    type MealSection = 'evening' | 'morning' | 'salads' | 'third' | 'other';
    const sectionLabels: Record<MealSection, string> = {
      evening: 'סעודה ראשונה / ערב',
      morning: 'סעודה שנייה / בוקר',
      salads: 'סלטים ותוספות כלליות',
      third: 'סעודה שלישית',
      other: 'פריטים נוספים / ללא סיווג'
    };
    const sectionOrder: MealSection[] = ['evening', 'morning', 'salads', 'third', 'other'];
    const sectionItems: Record<MealSection, Array<{ category: string; name: string; notes: string }>> = {
      evening: [],
      morning: [],
      salads: [],
      third: [],
      other: []
    };

    sortedCategories.forEach((cat) => {
      const section = isShabbat ? this.classifyCateringCategory(cat) : 'other';
      (itemsByCategory[cat] || []).forEach((row) => {
        sectionItems[section].push({ category: cat, name: row.name, notes: row.notes });
      });
    });

    const portions = this.getKitchenPortionsInfo(order);
    const guestCount = Math.max(0, Math.trunc(Number((order as { guestCount?: string | number }).guestCount) || 0));
    let totalItemRows = 0;
    let sectionsWithItems = 0;

    const renderTable = (section: MealSection): string => {
      const rows = sectionItems[section];
      if (!rows.length && !(section === 'third' && portions.seudaShlishit === true)) return '';

      const qty = this.getKitchenRowPortionQty(section, portions, isEvents, guestCount);
      const itemRows = rows
        .map((row) => {
          totalItemRows += 1;
          const notesCell = row.notes
            ? this.escapeKitchenHtml(row.notes)
            : '<span class="muted">—</span>';
          return `<tr>
            <td class="done-col">☐</td>
            <td>${this.escapeKitchenHtml(row.name)}</td>
            <td class="qty-col">${qty}</td>
            <td class="notes-col">${notesCell}</td>
          </tr>`;
        })
        .join('');

      let body = itemRows;
      if (!rows.length && section === 'third' && portions.seudaShlishit === true) {
        body = `<tr>
          <td class="done-col">☐</td>
          <td colspan="3">סעודה שלישית: כן — לפי ${portions.total || 'סה"כ'} מנות</td>
        </tr>`;
        totalItemRows += 1;
      }

      sectionsWithItems += 1;
      return `
        <div class="meal-section">
          <h2>${sectionLabels[section]}</h2>
          <table>
            <thead>
              <tr>
                <th class="done-col">בוצע</th>
                <th>שם מנה</th>
                <th class="qty-col">כמות</th>
                <th>הערות למטבח</th>
              </tr>
            </thead>
            <tbody>${body}</tbody>
          </table>
        </div>`;
    };

    const tablesHtml = isShabbat
      ? sectionOrder.map((section) => renderTable(section)).join('')
      : (() => {
          const rows = sortedCategories
            .flatMap((cat) => {
              const catItems = itemsByCategory[cat] || [];
              if (!catItems.length) return [];
              const header = `<tr class="cat-row"><td colspan="4"><strong>${this.escapeKitchenHtml(cat)}</strong></td></tr>`;
              const itemRows = catItems
                .map((row) => {
                  totalItemRows += 1;
                  const notesCell = row.notes
                    ? this.escapeKitchenHtml(row.notes)
                    : '<span class="muted">—</span>';
                  const qty = guestCount > 0 ? guestCount : 'לפי אורחים';
                  return `<tr>
                    <td class="done-col">☐</td>
                    <td>${this.escapeKitchenHtml(row.name)}</td>
                    <td class="qty-col">${qty}</td>
                    <td class="notes-col">${notesCell}</td>
                  </tr>`;
                })
                .join('');
              return header + itemRows;
            })
            .join('');
          if (rows) sectionsWithItems = 1;
          return rows
            ? `<div class="meal-section"><h2>פריטי האירוע</h2><table>
              <thead><tr><th class="done-col">בוצע</th><th>שם מנה</th><th class="qty-col">כמות</th><th>הערות למטבח</th></tr></thead>
              <tbody>${rows}</tbody></table></div>`
            : '';
        })();

    const customerNotes = this.getKitchenCustomerNotes(order);
    const adminNotes = (order.adminNotes || '').trim();
    const notesBlocks: string[] = [];
    if (customerNotes) {
      notesBlocks.push(
        `<div class="notes-block"><div class="notes-title">הערות לקוח</div><div>${this.escapeKitchenHtml(customerNotes)}</div></div>`
      );
    }
    if (adminNotes) {
      notesBlocks.push(
        `<div class="notes-block notes-admin"><div class="notes-title">הערות מנהל</div><div>${this.escapeKitchenHtml(adminNotes)}</div></div>`
      );
    }

    const deliveryTypeLabel = this.formatKitchenDeliveryType(cd);
    const addressDisplay = this.formatKitchenDeliveryAddress(cd);
    const email = String(cd['email'] || '').trim();

    let portionsBlock = '';
    if (isEvents) {
      portionsBlock = `
        <div class="portions-block">
          <div><strong>מספר אורחים:</strong> ${guestCount || 'לא צוין'}</div>
          ${(order as { eventType?: string }).eventType ? `<div><strong>סוג אירוע:</strong> ${this.escapeKitchenHtml(String((order as { eventType?: string }).eventType))}</div>` : ''}
          ${(order as { venue?: string }).venue ? `<div><strong>מיקום:</strong> ${this.escapeKitchenHtml(String((order as { venue?: string }).venue))}</div>` : ''}
        </div>`;
    } else {
      const lines: string[] = [];
      if (portions.hasBreakdown || portions.evening > 0) {
        lines.push(`<div><strong>סעודה ראשונה / ערב:</strong> ${portions.evening}</div>`);
      }
      if (portions.hasBreakdown || portions.morning > 0) {
        lines.push(`<div><strong>סעודה שנייה / בוקר:</strong> ${portions.morning}</div>`);
      }
      if (!portions.hasBreakdown && portions.total > 0) {
        lines.push(`<div><strong>סה"כ מנות:</strong> ${portions.total}</div>`);
        if (order.mealTime === 'both') {
          lines.push(`<div class="muted-line">חלוקה ערב/בוקר לא קיימת בהזמנה ישנה</div>`);
        }
      } else if (portions.total > 0) {
        lines.push(`<div><strong>סה"כ מנות:</strong> ${portions.total}</div>`);
      }
      if (portions.mealLabel && portions.mealLabel !== '—') {
        lines.push(`<div><strong>סוג סעודה:</strong> ${this.escapeKitchenHtml(portions.mealLabel)}</div>`);
      }
      if (portions.seudaShlishit === true) {
        lines.push(`<div><strong>סעודה שלישית:</strong> כן</div>`);
      } else if (portions.seudaShlishit === false) {
        lines.push(`<div><strong>סעודה שלישית:</strong> לא</div>`);
      }
      portionsBlock = lines.length ? `<div class="portions-block">${lines.join('')}</div>` : '';
    }

    const summaryBlock = isShabbat
      ? `<div class="summary-block">
          <div class="summary-title">סיכום</div>
          <div><strong>סה"כ מנות ערב:</strong> ${portions.evening}</div>
          <div><strong>סה"כ מנות בוקר:</strong> ${portions.morning}</div>
          <div><strong>סה"כ מנות כללי:</strong> ${portions.total}</div>
          <div><strong>סה"כ פריטים / מנות נבחרות:</strong> ${totalItemRows}</div>
          <div><strong>מספר סקשנים:</strong> ${sectionsWithItems}</div>
        </div>`
      : `<div class="summary-block">
          <div class="summary-title">סיכום</div>
          <div><strong>מספר אורחים:</strong> ${guestCount || '—'}</div>
          <div><strong>סה"כ פריטים:</strong> ${totalItemRows}</div>
        </div>`;

    return `<!DOCTYPE html><html dir="rtl" lang="he"><head><meta charset="utf-8"><title>${reportTitle} ${orderCode}</title>
      <style>
        body{font-family:Heebo,Arial,sans-serif;padding:16px;max-width:900px;margin:0 auto;color:#111;background:#fff}
        h1{margin:0 0 4px;font-size:1.35rem;font-weight:800}
        .subhead{margin:0 0 12px;font-size:0.9rem;color:#333}
        .block{margin:12px 0;padding:10px 12px;border:1px solid #111}
        .block-title{font-weight:800;margin-bottom:6px}
        .portions-block,.summary-block{margin:14px 0;padding:10px 12px;border:1px solid #111}
        .summary-title,.notes-title{font-weight:800;margin-bottom:6px}
        .notes-block{margin:10px 0;padding:10px 12px;border:1px solid #111}
        .notes-admin{border-width:2px}
        .muted{color:#555}
        .muted-line{font-size:0.85rem;color:#555;margin-top:4px}
        .meal-section{margin:16px 0;page-break-inside:avoid}
        .meal-section h2{margin:0 0 8px;font-size:1.05rem;font-weight:800;border-bottom:1px solid #111;padding-bottom:4px}
        table{width:100%;border-collapse:collapse;margin-top:6px}
        th,td{border:1px solid #111;padding:7px 8px;text-align:right;vertical-align:top;color:#000}
        th{background:#f4f4f4;font-weight:700}
        tr.cat-row td{background:#f8f8f8;font-weight:700}
        .done-col{width:42px;text-align:center}
        .qty-col{width:72px;text-align:center;white-space:nowrap}
        .notes-col{min-width:140px}
        .toolbar{margin:12px 0;display:flex;gap:8px}
        .toolbar button{padding:8px 14px;border:1px solid #111;background:#fff;cursor:pointer;font-family:inherit}
        @media print{
          .toolbar{display:none !important}
          body{padding:8mm;max-width:none}
          *{color:#000 !important;background:#fff !important;box-shadow:none !important}
          th{background:#f4f4f4 !important;-webkit-print-color-adjust:exact;print-color-adjust:exact}
          tr{page-break-inside:avoid}
        }
      </style></head><body>
        <h1>${reportTitle}</h1>
        <p class="subhead">
          <strong>מספר הזמנה:</strong> ${this.escapeKitchenHtml(orderCode)}<br>
          <strong>הודפס:</strong> ${printedAt}<br>
          <strong>סטטוס:</strong> ${this.escapeKitchenHtml(this.getStatusLabel(order.status || ''))}
        </p>
        <div class="block">
          <div class="block-title">פרטי לקוח</div>
          <div><strong>שם:</strong> ${this.escapeKitchenHtml(String(cd['fullName'] || 'לא צוין'))}</div>
          <div><strong>טלפון:</strong> ${this.escapeKitchenHtml(String(cd['phone'] || 'לא צוין'))}</div>
          ${email ? `<div><strong>אימייל:</strong> ${this.escapeKitchenHtml(email)}</div>` : ''}
          <div><strong>תאריך אירוע / אספקה:</strong> ${this.escapeKitchenHtml(String(cd['eventDate'] || 'לא צוין'))}</div>
          <div><strong>כתובת:</strong> ${this.escapeKitchenHtml(addressDisplay)}</div>
          ${deliveryTypeLabel ? `<div><strong>סוג אספקה:</strong> ${deliveryTypeLabel}</div>` : ''}
        </div>
        ${portionsBlock}
        ${notesBlocks.join('')}
        <div class="toolbar no-print">
          <button type="button" onclick="window.print()">הדפס</button>
          <button type="button" onclick="window.close()">סגור</button>
        </div>
        ${tablesHtml || '<p class="muted">אין פריטים</p>'}
        ${summaryBlock}
      </body></html>`;
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
        this.reloadAfterMutation();
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
    this.editAdminNotesValue = order.adminNotes || '';
    this.refreshKitchenPrepLines();
  }

  hasCustomerNotes(order: Order | null): boolean {
    if (!order) return false;
    return !!(order.customerDetails?.notes || '').toString().trim();
  }

  hasAdminNotes(order: Order | null): boolean {
    if (!order) return false;
    return !!(order.adminNotes || '').trim();
  }

  hasAnyOrderNotes(order: Order | null): boolean {
    return this.hasCustomerNotes(order) || this.hasAdminNotes(order);
  }

  saveAdminNotes(): void {
    const order = this.selectedOrder;
    if (!order) return;
    const orderId = (order._id || order.id)?.toString();
    if (!orderId) return;

    const value = String(this.editAdminNotesValue || '').trim();
    if (value.length > 1000) {
      this.errorMessage = 'הערת מנהל לא יכולה להיות ארוכה מ-1000 תווים';
      setTimeout(() => (this.errorMessage = ''), 3000);
      return;
    }

    this.isSavingAdminNotes = true;
    this.orderService.updateOrderAdminNotes(orderId, value).subscribe({
      next: (updated) => {
        this.isSavingAdminNotes = false;
        const normalized = { ...updated, id: (updated._id || updated.id)?.toString() };
        this.selectedOrder = normalized;
        this.editAdminNotesValue = normalized.adminNotes || '';
        const updateInList = (list: Order[]) => {
          const idx = list.findIndex((o) => (o._id || o.id)?.toString() === orderId);
          if (idx > -1) list[idx] = normalized;
        };
        updateInList(this.orders);
        this.successMessage = 'הערת המנהל נשמרה';
        setTimeout(() => (this.successMessage = ''), 3000);
      },
      error: (err) => {
        this.isSavingAdminNotes = false;
        this.errorMessage = err?.error?.message || 'שגיאה בשמירת הערת מנהל';
        setTimeout(() => (this.errorMessage = ''), 3000);
      }
    });
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
    this.isEditingPortions = false;
    this.portionsUpdatingId = null;
    this.editAdminNotesValue = '';
    this.isSavingAdminNotes = false;
    this.isEditingItems = false;
    this.isEditingShippingCost = false;
    this.isSavingShippingCost = false;
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

  /** Shabbat catering detail panel — grouped by meal (evening / morning / salads / legacy). */
  getCateringDetailSections(): Array<{
    title: string;
    portions?: number | null;
    legacy?: boolean;
    categories: { category: string; items: { name: string; kitchenNotes?: string }[] }[];
  }> {
    if (!this.selectedOrder || !this.isShabbatCateringOrder(this.selectedOrder)) return [];

    const byCat = this.getCateringViewItemsByCategory();
    const map = new Map(byCat.map((g) => [g.category, g.items]));
    const order = this.selectedOrder;

    const hasSplit = byCat.some(
      (g) => g.category.includes('— ערב') || g.category.includes('— בוקר')
    );
    const hasLegacyCourses = byCat.some(
      (g) => g.category === 'מנות ראשונות' || g.category === 'מנות עיקריות'
    );

    if (!hasSplit && hasLegacyCourses) {
      return [{ title: 'הזמנה ישנה (ללא פיצול ערב/בוקר)', legacy: true, categories: byCat }];
    }

    const sections: Array<{
      title: string;
      portions?: number | null;
      legacy?: boolean;
      categories: { category: string; items: { name: string; kitchenNotes?: string }[] }[];
    }> = [];

    const salads = map.get('סלטים');
    if (salads?.length) {
      sections.push({
        title: 'סלטים (כללי לכל ההזמנה)',
        categories: [{ category: 'סלטים', items: salads }]
      });
    }

    const eveningCategoryKeys = ['מנות ראשונות — ערב', 'מנות עיקריות — ערב', 'תוספות ערב'];
    const eveningGroups = eveningCategoryKeys
      .filter((c) => map.has(c))
      .map((c) => ({ category: c, items: map.get(c)! }));
    if (eveningGroups.length || this.showEveningPortionsView(order)) {
      sections.push({
        title: 'סעודה ראשונה / ערב',
        portions: order.portionsEvening ?? null,
        categories: eveningGroups
      });
    }

    const morningCategoryKeys = ['מנות ראשונות — בוקר', 'מנות עיקריות — בוקר', 'תוספות בוקר'];
    const morningGroups = morningCategoryKeys
      .filter((c) => map.has(c))
      .map((c) => ({ category: c, items: map.get(c)! }));
    if (morningGroups.length || this.showMorningPortionsView(order)) {
      sections.push({
        title: 'סעודה שנייה / שבת בבוקר',
        portions: order.portionsMorning ?? null,
        categories: morningGroups
      });
    }

    const known = new Set([
      'סלטים',
      ...eveningCategoryKeys,
      ...morningCategoryKeys,
      'מנות ראשונות',
      'מנות עיקריות',
      'שונות'
    ]);
    const other = byCat.filter((g) => !known.has(g.category));
    if (other.length) {
      sections.push({ title: 'פריטים נוספים', categories: other });
    }

    return sections;
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
        this.loadOrdersPage();
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
    this.listPage = 1;
    this.reloadAfterMutation();
    this.successMessage = 'הזמנה טלפונית נוספה בהצלחה';
    this.trackKpi('orders_manual_created');
    setTimeout(() => (this.successMessage = ''), 5000);
  }

  openKitchenReport(): void {
    this.trackKpi('orders_kitchen_report_opened');
    void this.router.navigate(['/admin/kitchen-report']);
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

  /** True when order has explicit evening/morning portion breakdown. */
  hasPortionsBreakdown(order: Order): boolean {
    return order.portionsEvening !== undefined && order.portionsEvening !== null
      || order.portionsMorning !== undefined && order.portionsMorning !== null;
  }

  /** Shabbat/holiday catering orders (not events) support admin portion edits. */
  canEditCateringPortions(order: Order | null): boolean {
    if (!order) return false;
    return order.orderType === 'catering'
      && order.cateringKind !== 'events'
      && (order.numberOfPortions != null || !!order.mealTime);
  }

  showEveningPortionField(order: Order | null): boolean {
    if (!order) return false;
    const m = order.mealTime;
    return !m || m === 'evening' || m === 'both';
  }

  showMorningPortionField(order: Order | null): boolean {
    if (!order) return false;
    const m = order.mealTime;
    return !m || m === 'morning' || m === 'both';
  }

  /** Read-only detail panel: show evening only when stored count is > 0. */
  showEveningPortionsView(order: Order | null): boolean {
    if (!order || !this.hasPortionsBreakdown(order)) return false;
    return Math.max(0, Math.trunc(Number(order.portionsEvening) || 0)) > 0;
  }

  /** Read-only detail panel: show morning only when stored count is > 0. */
  showMorningPortionsView(order: Order | null): boolean {
    if (!order || !this.hasPortionsBreakdown(order)) return false;
    return Math.max(0, Math.trunc(Number(order.portionsMorning) || 0)) > 0;
  }

  startEditingPortions(): void {
    const order = this.selectedOrder;
    if (!order) return;
    const mealTime = order.mealTime || 'both';
    const legacy = Number(order.numberOfPortions) || 0;

    if (this.hasPortionsBreakdown(order)) {
      this.editPortionsEvening = Number(order.portionsEvening) || 0;
      this.editPortionsMorning = Number(order.portionsMorning) || 0;
    } else if (mealTime === 'evening') {
      this.editPortionsEvening = legacy;
      this.editPortionsMorning = 0;
    } else if (mealTime === 'morning') {
      this.editPortionsEvening = 0;
      this.editPortionsMorning = legacy;
    } else {
      this.editPortionsEvening = legacy;
      this.editPortionsMorning = 0;
    }

    this.isEditingPortions = true;
  }

  cancelEditingPortions(): void {
    this.isEditingPortions = false;
    this.portionsUpdatingId = null;
  }

  savePortions(): void {
    const order = this.selectedOrder;
    if (!order) return;
    const orderId = (order._id || order.id)?.toString();
    if (!orderId) return;

    const evening = this.showEveningPortionField(order) ? Number(this.editPortionsEvening) : 0;
    const morning = this.showMorningPortionField(order) ? Number(this.editPortionsMorning) : 0;

    if (!Number.isFinite(evening) || !Number.isInteger(evening) || evening < 0) {
      this.errorMessage = 'כמות ערב חייבת להיות מספר שלם שאינו שלילי';
      setTimeout(() => (this.errorMessage = ''), 3000);
      return;
    }
    if (!Number.isFinite(morning) || !Number.isInteger(morning) || morning < 0) {
      this.errorMessage = 'כמות בוקר חייבת להיות מספר שלם שאינו שלילי';
      setTimeout(() => (this.errorMessage = ''), 3000);
      return;
    }
    if (evening + morning <= 0) {
      this.errorMessage = 'יש להזין לפחות מנה אחת';
      setTimeout(() => (this.errorMessage = ''), 3000);
      return;
    }

    this.portionsUpdatingId = orderId;
    this.orderService.updateOrderPortions(orderId, { portionsEvening: evening, portionsMorning: morning }).subscribe({
      next: (updated) => {
        this.portionsUpdatingId = null;
        this.isEditingPortions = false;
        const normalized = { ...updated, id: (updated._id || updated.id)?.toString() };
        this.selectedOrder = normalized;
        const updateInList = (list: Order[]) => {
          const idx = list.findIndex((o) => (o._id || o.id)?.toString() === orderId);
          if (idx > -1) list[idx] = normalized;
        };
        updateInList(this.orders);
        this.successMessage = 'כמויות המנות עודכנו';
        setTimeout(() => (this.successMessage = ''), 3000);
      },
      error: (err) => {
        this.portionsUpdatingId = null;
        this.errorMessage = err?.error?.message || 'שגיאה בעדכון כמויות';
        setTimeout(() => (this.errorMessage = ''), 3000);
      }
    });
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
        this.loadTabCounts();
        this.loadOrdersPage();
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
        this.loadTabCounts();
        this.loadOrdersPage();
      },
      error: (err) => {
        this.isVoiding = false;
        this.errorMessage = err?.error?.message || 'שגיאה בביטול ההרשאה';
        setTimeout(() => (this.errorMessage = ''), 4000);
      }
    });
  }

  /** Patch a single order in the current page list without a full reload. */
  private _patchOrderInLists(orderId: string, patch: Partial<Order>): void {
    const apply = (list: Order[]) => {
      const idx = list.findIndex((o) => (o._id || o.id || '').toString() === orderId);
      if (idx !== -1) list[idx] = { ...list[idx], ...patch };
    };
    apply(this.orders);
  }
}
