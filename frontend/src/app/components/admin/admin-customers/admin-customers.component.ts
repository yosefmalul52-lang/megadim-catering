import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe, JsonPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  UsersService,
  AdminUser,
  UpdateCrmPayload,
  CustomerAuditResponse,
  ResolvedSiteUser,
  SiteUserRole
} from '../../../services/users.service';
import { OrderService, Order } from '../../../services/order.service';
import { forkJoin } from 'rxjs';

export type FilterType = 'all' | 'returning' | 'sleeping' | 'vip' | 'registered';
export type ManualStatus = 'NONE' | 'VIP' | 'BLACKLIST';
export type CustomerCategory = 'all' | 'returning' | 'sleeping' | 'vip' | 'registered';

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
  currentPage = 1;

  isAuditModalOpen = false;
  isAuditLoading = false;
  auditError = '';
  auditReport: CustomerAuditResponse | null = null;

  linkedSiteUser: ResolvedSiteUser | null = null;
  linkedUserLoading = false;
  linkedUserError = '';
  panelSiteRole: SiteUserRole = 'user';
  isSavingSiteRole = false;
  readonly siteRoleOptions: { value: SiteUserRole; label: string }[] = [
    { value: 'user', label: 'לקוח (אתר)' },
    { value: 'driver', label: 'נהג / סטאף משלוחים' },
    { value: 'admin', label: 'מנהל מערכת' }
  ];

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.usersService.getUsers().subscribe({
      next: (list) => {
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
  }

  private applyFilter(): void {
    switch (this.currentFilter) {
      case 'returning':
        this.filteredUsers = this.users.filter((u) => (u.customerCategory || 'all') === 'returning');
        break;
      case 'sleeping':
        this.filteredUsers = this.users.filter((u) => (u.customerCategory || 'all') === 'sleeping');
        break;
      case 'vip':
        this.filteredUsers = this.users.filter((u) => (u.customerCategory || 'all') === 'vip');
        break;
      case 'registered':
        this.filteredUsers = this.users.filter(
          (u) =>
            u.isRegistered === true || (u.customerCategory || 'all') === 'registered'
        );
        break;
      default:
        this.filteredUsers = [...this.users];
    }
    this.ensurePageInRange();
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

    forkJoin([this.orderService.getAllOrders(false), this.orderService.getAllOrders(true)]).subscribe({
      next: ([activeOrders, archivedOrders]) => {
        const all = [...activeOrders, ...archivedOrders];
        this.customerOrders = all
          .filter((order) => this.isOrderVisibleInHistory(order))
          .filter((order) => this.isOrderOfCustomer(order, phone, email))
          .sort(
            (a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime()
          );
        this.isLoadingOrderHistory = false;
      },
      error: () => {
        this.orderHistoryError = 'שגיאה בטעינת היסטוריית הזמנות';
        this.isLoadingOrderHistory = false;
      }
    });
  }

  closeOrderHistory(): void {
    this.isHistoryModalOpen = false;
    this.isLoadingOrderHistory = false;
    this.orderHistoryError = '';
    this.historyCustomer = null;
    this.customerOrders = [];
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

}
