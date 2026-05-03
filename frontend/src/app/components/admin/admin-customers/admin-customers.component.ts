import { Component, OnInit, inject, HostListener } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe, JsonPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  UsersService,
  AdminUser,
  UpdateCrmPayload,
  CreateCustomerPayload,
  CustomerAuditResponse,
  ResolvedSiteUser,
  SiteUserRole
} from '../../../services/users.service';
import { OrderService, Order } from '../../../services/order.service';
import { forkJoin } from 'rxjs';

export type FilterType = 'all' | 'returning' | 'sleeping' | 'vip' | 'registered';
export type ManualStatus = 'NONE' | 'VIP' | 'BLACKLIST';
export type CustomerCategory = 'all' | 'returning' | 'sleeping' | 'vip' | 'registered';
type SortField = 'createdAt' | 'lastOrderDate' | 'orderCount' | 'totalSpent' | 'fullName';
type SortDirection = 'desc' | 'asc';

@Component({
  selector: 'app-admin-customers',
  standalone: true,
  imports: [CommonModule, DatePipe, CurrencyPipe, FormsModule, JsonPipe],
  templateUrl: './admin-customers.component.html',
  styleUrls: ['./admin-customers.component.scss']
})
export class AdminCustomersComponent implements OnInit {
  private usersService = inject(UsersService);
  private orderService = inject(OrderService);

  users: AdminUser[] = [];
  filteredUsers: AdminUser[] = [];
  isLoading = true;
  errorMessage = '';
  successMessage = '';
  currentFilter: FilterType = 'all';
  readonly filterOptions: { value: FilterType; label: string }[] = [
    { value: 'all', label: 'כל הלקוחות' },
    { value: 'returning', label: 'לקוחות חוזרים' },
    { value: 'sleeping', label: 'לקוחות ישנים (30+ ימים)' },
    { value: 'vip', label: 'לקוחות VIP' },
    { value: 'registered', label: 'רשומים' }
  ];
  readonly customerCategoryOptions: Array<{ value: CustomerCategory; label: string }> = [
    { value: 'all', label: 'כל הלקוחות' },
    { value: 'returning', label: 'לקוחות חוזרים' },
    { value: 'sleeping', label: 'לקוחות ישנים' },
    { value: 'vip', label: 'לקוחות VIP' },
    { value: 'registered', label: 'רשומים (משתמש באתר)' }
  ];

  selectedUser: AdminUser | null = null;
  panelAdminNotes = '';
  panelDietaryInfo = '';
  panelFullName = '';
  panelPhone = '';
  panelEmail = '';
  panelAddress = '';
  panelCity = '';
  panelManualStatus: ManualStatus = 'NONE';
  panelCustomerCategory: CustomerCategory = 'all';
  isSavingCrm = false;
  statusUpdatingId: string | null = null;
  deletingCustomerId: string | null = null;
  isHistoryModalOpen = false;
  isLoadingOrderHistory = false;
  orderHistoryError = '';
  historyCustomer: AdminUser | null = null;
  customerOrders: Order[] = [];
  readonly pageSize = 15;
  readonly usersFetchLimit = 1000;
  currentPage = 1;
  searchTerm = '';
  sortField: SortField = 'createdAt';
  sortDirection: SortDirection = 'desc';
  cityFilter = '';
  minSpentFilter: number | null = null;
  lastOrderBeforeDaysFilter: number | null = null;

  isAuditModalOpen = false;
  isAuditLoading = false;
  isReconciling = false;
  auditError = '';
  auditReport: CustomerAuditResponse | null = null;

  linkedSiteUser: ResolvedSiteUser | null = null;
  linkedUserLoading = false;
  linkedUserError = '';
  panelSiteRole: SiteUserRole = 'user';
  isSavingSiteRole = false;
  selectedCustomerIds = new Set<string>();
  isAddingCustomer = false;
  isCreatingCustomer = false;
  newCustomerFullName = '';
  newCustomerPhone = '';
  newCustomerEmail = '';
  newCustomerAddress = '';
  newCustomerCity = '';
  readonly siteRoleOptions: { value: SiteUserRole; label: string }[] = [
    { value: 'user', label: 'לקוח (אתר)' },
    { value: 'driver', label: 'נהג / סטאף משלוחים' },
    { value: 'admin', label: 'מנהל מערכת' }
  ];

  ngOnInit(): void {
    this.loadUsers();
  }

  @HostListener('document:keydown.escape')
  onEscapePressed(): void {
    if (this.isAuditModalOpen) {
      this.closeAuditModal();
      return;
    }
    if (this.isHistoryModalOpen) {
      this.closeOrderHistory();
      return;
    }
    if (this.selectedUser) {
      this.closePanel();
    }
  }

  loadUsers(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.usersService
      .getUsers({
        limit: this.usersFetchLimit,
        city: this.cityFilter,
        minTotalSpent: Number(this.minSpentFilter || 0),
        lastOrderBeforeDays: Number(this.lastOrderBeforeDaysFilter || 0)
      })
      .subscribe({
      next: (list) => {
        this.selectedCustomerIds.clear();
        this.users = (list || []).map((u) => ({
          ...u,
          username: u.username || u.email || '',
          tags: Array.isArray(u.tags) ? u.tags : [],
          manualStatus: (u.manualStatus || 'NONE') as ManualStatus,
          customerCategory: (u.customerCategory || 'all') as CustomerCategory,
          isRegistered: u.isRegistered === true
        }));
        this.applyFilter();
        this.isLoading = false;
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err?.error?.message || 'שגיאה בטעינת הלקוחות';
      }
    });
  }

  setFilter(filter: FilterType): void {
    this.currentFilter = filter;
    this.currentPage = 1;
    this.applyFilter();
    this.selectedCustomerIds.clear();
  }

  onSearchTermChange(value: string): void {
    this.searchTerm = value;
    this.currentPage = 1;
    this.applyFilter();
    this.selectedCustomerIds.clear();
  }

  setSort(field: SortField): void {
    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === 'desc' ? 'asc' : 'desc';
    } else {
      this.sortField = field;
      this.sortDirection = field === 'fullName' ? 'asc' : 'desc';
    }
    this.applyFilter();
  }

  clearFiltersAndSearch(): void {
    this.currentFilter = 'all';
    this.searchTerm = '';
    this.sortField = 'createdAt';
    this.sortDirection = 'desc';
    this.cityFilter = '';
    this.minSpentFilter = null;
    this.lastOrderBeforeDaysFilter = null;
    this.currentPage = 1;
    this.loadUsers();
  }

  applyServerFilters(): void {
    this.currentPage = 1;
    this.selectedCustomerIds.clear();
    this.loadUsers();
  }

  private applyFilter(): void {
    const normalizedSearch = this.normalizeSearch(this.searchTerm);
    const byCategory = this.users.filter((u) => this.matchesCategoryFilter(u));
    const bySearch = normalizedSearch
      ? byCategory.filter((u) => this.matchesSearch(u, normalizedSearch))
      : byCategory;
    this.filteredUsers = this.sortUsers(bySearch);
    this.ensurePageInRange();
  }

  private matchesCategoryFilter(user: AdminUser): boolean {
    switch (this.currentFilter) {
      case 'returning':
        return (user.customerCategory || 'all') === 'returning';
      case 'sleeping':
        return (user.customerCategory || 'all') === 'sleeping';
      case 'vip':
        return (user.customerCategory || 'all') === 'vip';
      case 'registered':
        return user.isRegistered === true || (user.customerCategory || 'all') === 'registered';
      default:
        return true;
    }
  }

  private matchesSearch(user: AdminUser, normalizedSearch: string): boolean {
    const candidates = [
      user.fullName,
      user.phone,
      user.email,
      user.username,
      user.address,
      user.city,
      user.adminNotes
    ]
      .map((value) => this.normalizeSearch(String(value || '')))
      .filter(Boolean);
    return candidates.some((value) => value.includes(normalizedSearch));
  }

  private sortUsers(users: AdminUser[]): AdminUser[] {
    const sorted = [...users];
    sorted.sort((a, b) => {
      const direction = this.sortDirection === 'asc' ? 1 : -1;
      if (this.sortField === 'fullName') {
        const aVal = String(a.fullName || '').trim().toLowerCase();
        const bVal = String(b.fullName || '').trim().toLowerCase();
        return aVal.localeCompare(bVal, 'he') * direction;
      }
      if (this.sortField === 'lastOrderDate' || this.sortField === 'createdAt') {
        const aTime = new Date(String(a[this.sortField] || '')).getTime() || 0;
        const bTime = new Date(String(b[this.sortField] || '')).getTime() || 0;
        return (aTime - bTime) * direction;
      }
      const aNum = Number(a[this.sortField] || 0);
      const bNum = Number(b[this.sortField] || 0);
      return (aNum - bNum) * direction;
    });
    return sorted;
  }

  private normalizeSearch(value: string): string {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
  }

  private ensurePageInRange(): void {
    const totalPages = this.totalPages;
    if (this.currentPage > totalPages) this.currentPage = totalPages;
    if (this.currentPage < 1) this.currentPage = 1;
  }

  openPanel(user: AdminUser): void {
    this.selectedUser = user;
    this.panelFullName = user.fullName || '';
    this.panelPhone = user.phone || '';
    this.panelEmail = user.email || user.username || '';
    this.panelAddress = user.address || '';
    this.panelCity = user.city || '';
    this.panelAdminNotes = user.adminNotes ?? '';
    this.panelDietaryInfo = user.dietaryInfo ?? '';
    this.panelManualStatus = (user.manualStatus || 'NONE') as ManualStatus;
    this.panelCustomerCategory = (user.customerCategory || 'all') as CustomerCategory;
    this.clearLinkedSiteUser();
    this.fetchLinkedSiteUser();
  }

  closePanel(): void {
    this.selectedUser = null;
    this.clearLinkedSiteUser();
  }

  openAddCustomerModal(): void {
    this.isAddingCustomer = true;
    this.newCustomerFullName = '';
    this.newCustomerPhone = '';
    this.newCustomerEmail = '';
    this.newCustomerAddress = '';
    this.newCustomerCity = '';
  }

  closeAddCustomerModal(): void {
    this.isAddingCustomer = false;
    this.isCreatingCustomer = false;
  }

  createCustomer(): void {
    if (this.isCreatingCustomer) return;
    const fullName = this.newCustomerFullName.trim();
    const phone = this.newCustomerPhone.trim();
    if (!fullName || !phone) {
      this.errorMessage = 'יש להזין שם מלא וטלפון';
      return;
    }
    const payload: CreateCustomerPayload = {
      fullName,
      phone,
      email: this.newCustomerEmail.trim() || undefined,
      address: this.newCustomerAddress.trim() || undefined,
      city: this.newCustomerCity.trim() || undefined
    };
    this.isCreatingCustomer = true;
    this.usersService.createCustomer(payload).subscribe({
      next: (created) => {
        this.isCreatingCustomer = false;
        this.closeAddCustomerModal();
        this.successMessage = 'לקוח חדש נוסף בהצלחה';
        this.users = [{ ...created, username: created.username || created.email || '' }, ...this.users];
        this.applyFilter();
        setTimeout(() => (this.successMessage = ''), 2500);
      },
      error: (err) => {
        this.isCreatingCustomer = false;
        this.errorMessage = err?.error?.message || 'שגיאה בהוספת לקוח';
      }
    });
  }

  private clearLinkedSiteUser(): void {
    this.linkedSiteUser = null;
    this.linkedUserError = '';
    this.linkedUserLoading = false;
    this.panelSiteRole = 'user';
  }

  /** Resolve Mongo `users` document by CRM email (registered customers only). */
  fetchLinkedSiteUser(): void {
    if (!this.selectedUser?.isRegistered) return;
    const email = String(this.panelEmail || this.selectedUser.username || this.selectedUser.email || '')
      .trim()
      .toLowerCase();
    const phone = String(this.panelPhone || this.selectedUser.phone || '').trim();
    if (!email) {
      if (!phone) {
        this.linkedUserError = 'אין אימייל או טלפון לזיהוי חשבון באתר';
        return;
      }
    }
    this.linkedUserLoading = true;
    this.linkedUserError = '';
    this.linkedSiteUser = null;
    this.usersService.resolveSiteUser(email, phone).subscribe({
      next: (res) => {
        this.linkedUserLoading = false;
        if (res?.success && res.user) {
          this.linkedSiteUser = res.user;
          const r = String(res.user.role || 'user').toLowerCase();
          this.panelSiteRole = (['admin', 'user', 'driver'].includes(r) ? r : 'user') as SiteUserRole;
        } else {
          this.linkedUserError = res?.message || 'משתמש לא נמצא';
        }
      },
      error: (err) => {
        this.linkedUserLoading = false;
        this.linkedUserError =
          err?.error?.message ||
          (err?.status === 404 ? 'אין משתמש רשום עם אימייל זה' : 'שגיאה בטעינת חשבון');
      }
    });
  }

  saveSiteRole(): void {
    if (!this.linkedSiteUser?._id) return;
    this.isSavingSiteRole = true;
    this.errorMessage = '';
    this.usersService.patchSiteUserRole(this.linkedSiteUser._id, this.panelSiteRole).subscribe({
      next: (doc: Record<string, unknown>) => {
        this.isSavingSiteRole = false;
        const newRole = String((doc as { role?: string })?.role || this.panelSiteRole);
        this.linkedSiteUser = { ...this.linkedSiteUser!, role: newRole };
        this.successMessage = 'תפקיד באתר עודכן';
        setTimeout(() => (this.successMessage = ''), 2500);
      },
      error: (err) => {
        this.isSavingSiteRole = false;
        this.errorMessage = err?.error?.message || 'שגיאה בעדכון תפקיד';
      }
    });
  }

  saveCrm(): void {
    if (!this.selectedUser) return;
    this.isSavingCrm = true;
    this.errorMessage = '';
    const payload: UpdateCrmPayload = {
      fullName: this.panelFullName,
      email: this.panelEmail,
      address: this.panelAddress,
      city: this.panelCity,
      adminNotes: this.panelAdminNotes,
      dietaryInfo: this.panelDietaryInfo,
      manualStatus: this.panelManualStatus,
      customerCategory: this.panelCustomerCategory
    };
    const trimmedPhone = String(this.panelPhone || '').trim();
    if (trimmedPhone) {
      payload.phone = trimmedPhone;
    }
    this.usersService.updateUserCrm(this.selectedUser._id, payload).subscribe({
      next: (updated) => {
        const idx = this.users.findIndex(u => u._id === updated._id);
        if (idx !== -1) this.users[idx] = { ...this.users[idx], ...updated };
        this.selectedUser = { ...this.selectedUser!, ...updated };
        this.panelFullName = updated.fullName || '';
        this.panelPhone = updated.phone || '';
        this.panelEmail = updated.email || updated.username || '';
        this.panelAddress = updated.address || '';
        this.panelCity = updated.city || '';
        this.panelAdminNotes = updated.adminNotes ?? '';
        this.panelDietaryInfo = updated.dietaryInfo ?? '';
        this.panelManualStatus = (updated.manualStatus || 'NONE') as ManualStatus;
        this.panelCustomerCategory = (updated.customerCategory || 'all') as CustomerCategory;
        this.applyFilter();
        this.isSavingCrm = false;
        this.successMessage = 'נשמר בהצלחה';
        setTimeout(() => (this.successMessage = ''), 2500);
        if (this.selectedUser?.isRegistered || updated.isRegistered) {
          this.fetchLinkedSiteUser();
        }
      },
      error: (err) => {
        this.isSavingCrm = false;
        this.errorMessage = err?.error?.message || 'שגיאה בשמירה';
      }
    });
  }

  get isCrmDirty(): boolean {
    if (!this.selectedUser) return false;
    return (
      this.panelFullName !== (this.selectedUser.fullName || '') ||
      this.panelPhone !== (this.selectedUser.phone || '') ||
      this.panelEmail !== (this.selectedUser.email || this.selectedUser.username || '') ||
      this.panelAddress !== (this.selectedUser.address || '') ||
      this.panelCity !== (this.selectedUser.city || '') ||
      this.panelAdminNotes !== (this.selectedUser.adminNotes ?? '') ||
      this.panelDietaryInfo !== (this.selectedUser.dietaryInfo ?? '') ||
      this.panelManualStatus !== ((this.selectedUser.manualStatus || 'NONE') as ManualStatus) ||
      this.panelCustomerCategory !== ((this.selectedUser.customerCategory || 'all') as CustomerCategory)
    );
  }

  get canSaveCrm(): boolean {
    return !!this.selectedUser && !this.isSavingCrm && this.isCrmDirty;
  }

  openOrderHistory(user: AdminUser): void {
    this.historyCustomer = user;
    this.isHistoryModalOpen = true;
    this.isLoadingOrderHistory = true;
    this.orderHistoryError = '';
    this.customerOrders = [];

    const phone = this.normalizePhone(user.phone);
    const email = String(user.username || user.email || '')
      .trim()
      .toLowerCase();

    this.orderService.getAllOrders(false, 250).subscribe({
      next: (activeOrders) => {
        const fromActive = activeOrders
          .filter((order) => this.isOrderVisibleInHistory(order))
          .filter((order) => this.isOrderOfCustomer(order, phone, email));
        if (fromActive.length > 0) {
          this.customerOrders = this.sortOrdersByDate(fromActive);
          this.isLoadingOrderHistory = false;
          return;
        }
        this.orderService.getAllOrders(true, 250).subscribe({
          next: (archivedOrders) => {
            this.customerOrders = this.sortOrdersByDate(
              archivedOrders
                .filter((order) => this.isOrderVisibleInHistory(order))
                .filter((order) => this.isOrderOfCustomer(order, phone, email))
            );
            this.isLoadingOrderHistory = false;
          },
          error: () => {
            this.orderHistoryError = 'שגיאה בטעינת היסטוריית הזמנות';
            this.isLoadingOrderHistory = false;
          }
        });
      },
      error: () => {
        this.orderHistoryError = 'שגיאה בטעינת היסטוריית הזמנות';
        this.isLoadingOrderHistory = false;
      }
    });
  }

  private sortOrdersByDate(orders: Order[]): Order[] {
    return [...orders].sort((a, b) => new Date(String(b.createdAt || '')).getTime() - new Date(String(a.createdAt || '')).getTime());
  }

  closeOrderHistory(): void {
    this.isHistoryModalOpen = false;
    this.isLoadingOrderHistory = false;
    this.orderHistoryError = '';
    this.historyCustomer = null;
    this.customerOrders = [];
  }

  retryOrderHistory(): void {
    if (!this.historyCustomer) return;
    this.openOrderHistory(this.historyCustomer);
  }

  getOrderRowTotal(order: Order): number {
    if (typeof order.totalPrice === 'number' && !Number.isNaN(order.totalPrice)) {
      return order.totalPrice;
    }
    return (order.items || []).reduce((sum, item) => {
      const line = Number(item.price || 0) * Number(item.quantity || 0);
      return sum + (Number.isFinite(line) ? line : 0);
    }, 0);
  }

  private isOrderOfCustomer(order: Order, normalizedPhone: string, email: string): boolean {
    const orderPhone = this.normalizePhone(order.customerDetails?.phone);
    const orderEmail = String(order.customerDetails?.email || '')
      .trim()
      .toLowerCase();
    // Strict matching rule:
    // 1) If customer phone exists -> match by phone only (most reliable identifier).
    // 2) If no phone -> fallback to exact email match.
    if (normalizedPhone) {
      return !!orderPhone && orderPhone === normalizedPhone;
    }
    if (email) {
      return !!orderEmail && orderEmail === email;
    }
    return false;
  }

  private isOrderVisibleInHistory(order: Order): boolean {
    if (order?.isDeleted === true) return false;
    const status = String(order?.status || '')
      .trim()
      .toLowerCase();
    return !['cancelled', 'canceled', 'archived', 'superseded', 'replaced', 'deleted'].includes(status);
  }

  private normalizePhone(raw: string | undefined): string {
    let digits = String(raw || '').replace(/\D/g, '');
    if (!digits) return '';
    if (digits.startsWith('00972')) digits = digits.slice(5);
    else if (digits.startsWith('972')) digits = digits.slice(3);
    if (!digits.startsWith('0')) digits = `0${digits}`;
    return digits;
  }

  getWhatsAppLink(user: AdminUser): string {
    let phone = (user.phone || '').replace(/\D/g, '');
    if (phone.startsWith('0')) phone = '972' + phone.slice(1);
    else if (!phone.startsWith('972')) phone = '972' + phone;
    const name = encodeURIComponent((user.fullName || 'לקוח').trim());
    const text = encodeURIComponent(`היי ${user.fullName || 'לקוח'},\n`);
    return `https://wa.me/${phone}?text=${text}`;
  }

  get countAll(): number {
    return this.users.length;
  }

  get countVip(): number {
    return this.users.filter((u) => (u.customerCategory || 'all') === 'vip').length;
  }

  get countReturning(): number {
    return this.users.filter((u) => (u.customerCategory || 'all') === 'returning').length;
  }

  get countSleeping(): number {
    return this.users.filter((u) => (u.customerCategory || 'all') === 'sleeping').length;
  }

  get countRegistered(): number {
    return this.users.filter(
      (u) => u.isRegistered === true || (u.customerCategory || 'all') === 'registered'
    ).length;
  }

  runAudit(): void {
    this.isAuditLoading = true;
    this.auditError = '';
    this.auditReport = null;
    this.isAuditModalOpen = true;
    this.usersService.runCustomerAudit().subscribe({
      next: (report) => {
        this.auditReport = report;
        this.isAuditLoading = false;
      },
      error: (err) => {
        this.isAuditLoading = false;
        this.auditError = err?.error?.message || 'שגיאה בהרצת ביקורת הנתונים';
      }
    });
  }

  runReconcileAndAudit(): void {
    if (this.isReconciling) return;
    this.isReconciling = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.usersService.migrateLegacyCustomers().subscribe({
      next: (res) => {
        this.successMessage =
          res?.message || 'בוצע Reconcile ללקוחות. מריץ ביקורת נתונים מעודכנת...';
        this.loadUsers();
        this.runAudit();
        this.isReconciling = false;
      },
      error: (err) => {
        this.isReconciling = false;
        this.errorMessage = err?.error?.message || 'שגיאה בהרצת Reconcile ללקוחות';
      }
    });
  }

  exportFilteredCustomersCsv(): void {
    const headers = ['שם', 'טלפון', 'אימייל', 'סך הוצאות'];
    const rows = this.filteredUsers.map((u) => [
      u.fullName || '',
      u.phone || '',
      u.email || u.username || '',
      String(Number(u.totalSpent || 0))
    ]);
    const csv = [headers, ...rows]
      .map((row) =>
        row
          .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
          .join(',')
      )
      .join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `crm-customers-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  closeAuditModal(): void {
    this.isAuditModalOpen = false;
    this.auditError = '';
    this.auditReport = null;
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredUsers.length / this.pageSize));
  }

  get pagedUsers(): AdminUser[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredUsers.slice(start, start + this.pageSize);
  }

  get hasPagination(): boolean {
    return this.filteredUsers.length > this.pageSize;
  }

  get displayRangeStart(): number {
    if (this.filteredUsers.length === 0) return 0;
    return (this.currentPage - 1) * this.pageSize + 1;
  }

  get displayRangeEnd(): number {
    return Math.min(this.currentPage * this.pageSize, this.filteredUsers.length);
  }

  getRowNumber(indexInPage: number): number {
    return (this.currentPage - 1) * this.pageSize + indexInPage + 1;
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages || page === this.currentPage) return;
    this.currentPage = page;
  }

  updateCustomerCategory(user: AdminUser, category: CustomerCategory): void {
    if (!user._id || this.statusUpdatingId === user._id || user.customerCategory === category) return;
    this.statusUpdatingId = user._id;
    this.errorMessage = '';
    this.usersService.updateUserCrm(user._id, { customerCategory: category }).subscribe({
      next: (updated) => {
        this.statusUpdatingId = null;
        const idx = this.users.findIndex((u) => u._id === updated._id);
        if (idx !== -1) this.users[idx] = { ...this.users[idx], ...updated };
        if (this.selectedUser?._id === updated._id) {
          this.selectedUser = { ...this.selectedUser, ...updated };
          this.panelManualStatus = (updated.manualStatus || 'NONE') as ManualStatus;
          this.panelCustomerCategory = (updated.customerCategory || 'all') as CustomerCategory;
        }
        this.applyFilter();
        this.successMessage = 'קטגוריית לקוח עודכנה';
        setTimeout(() => (this.successMessage = ''), 2500);
      },
      error: (err) => {
        this.statusUpdatingId = null;
        this.errorMessage = err?.error?.message || 'שגיאה בעדכון קטגוריה';
      }
    });
  }

  deleteCustomer(user: AdminUser): void {
    if (!user?._id || this.deletingCustomerId === user._id) return;
    const displayName = user.fullName || user.phone || 'לקוח זה';
    const ok = window.confirm(`למחוק את ${displayName}?\nפעולה זו אינה ניתנת לשחזור.`);
    if (!ok) return;

    this.deletingCustomerId = user._id;
    this.errorMessage = '';
    this.usersService.deleteUser(user._id).subscribe({
      next: () => {
        this.users = this.users.filter((u) => u._id !== user._id);
        this.filteredUsers = this.filteredUsers.filter((u) => u._id !== user._id);
        if (this.selectedUser?._id === user._id) this.closePanel();
        if (this.historyCustomer?._id === user._id) this.closeOrderHistory();
        this.ensurePageInRange();
        this.deletingCustomerId = null;
        this.successMessage = 'הלקוח נמחק בהצלחה';
        setTimeout(() => (this.successMessage = ''), 2500);
      },
      error: (err) => {
        this.deletingCustomerId = null;
        this.errorMessage = err?.error?.message || 'שגיאה במחיקת הלקוח';
      }
    });
  }

  toggleCustomerSelection(userId: string, checked: boolean): void {
    if (checked) this.selectedCustomerIds.add(userId);
    else this.selectedCustomerIds.delete(userId);
  }

  isCustomerSelected(userId: string): boolean {
    return this.selectedCustomerIds.has(userId);
  }

  toggleSelectAllFiltered(checked: boolean): void {
    if (checked) {
      this.filteredUsers.forEach((u) => this.selectedCustomerIds.add(u._id));
      return;
    }
    this.selectedCustomerIds.clear();
  }

  get areAllFilteredSelected(): boolean {
    return this.filteredUsers.length > 0 && this.filteredUsers.every((u) => this.selectedCustomerIds.has(u._id));
  }

  get selectedCount(): number {
    return this.selectedCustomerIds.size;
  }

  deleteSelectedCustomers(): void {
    const ids = Array.from(this.selectedCustomerIds);
    if (ids.length === 0) return;
    const ok = window.confirm(`למחוק ${ids.length} לקוחות נבחרים? פעולה זו אינה ניתנת לשחזור.`);
    if (!ok) return;
    this.errorMessage = '';
    forkJoin(ids.map((id) => this.usersService.deleteUser(id))).subscribe({
      next: () => {
        this.users = this.users.filter((u) => !this.selectedCustomerIds.has(u._id));
        this.filteredUsers = this.filteredUsers.filter((u) => !this.selectedCustomerIds.has(u._id));
        if (this.selectedUser && this.selectedCustomerIds.has(this.selectedUser._id)) {
          this.closePanel();
        }
        this.selectedCustomerIds.clear();
        this.ensurePageInRange();
        this.successMessage = 'הלקוחות הנבחרים נמחקו בהצלחה';
        setTimeout(() => (this.successMessage = ''), 2500);
      },
      error: (err) => {
        this.errorMessage = err?.error?.message || 'שגיאה במחיקת לקוחות נבחרים';
      }
    });
  }

  get hasActiveQuery(): boolean {
    return (
      this.currentFilter !== 'all' ||
      !!this.searchTerm.trim() ||
      !!this.cityFilter.trim() ||
      Number(this.minSpentFilter || 0) > 0 ||
      Number(this.lastOrderBeforeDaysFilter || 0) > 0
    );
  }

  get canShowTruncationNotice(): boolean {
    return this.users.length >= this.usersFetchLimit;
  }

}
