import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { interval, Subscription } from 'rxjs';
import { startWith, switchMap } from 'rxjs/operators';

import { OrderService, Order, DashboardStats } from '../../../services/order.service';
import { KitchenReportModalComponent } from '../../modals/kitchen-report-modal/kitchen-report-modal.component';
import { ManualOrderBuilderComponent } from '../manual-order-builder/manual-order-builder.component';

@Component({
  selector: 'app-admin-orders',
  standalone: true,
  imports: [CommonModule, DatePipe, KitchenReportModalComponent, ManualOrderBuilderComponent],
  templateUrl: './admin-orders.component.html',
  styleUrls: ['./admin-orders.component.scss']
})
export class AdminOrdersComponent implements OnInit, OnDestroy {
  orderService = inject(OrderService);
  private route = inject(ActivatedRoute);

  /** When true, hide orders list and show full-page manual order builder */
  isCreatingOrder = false;

  /** Optional filter from query params when navigating from customers page */
  customerFilter: { email?: string; phone?: string } = {};

  orders: Order[] = [];
  archiveOrders: Order[] = [];
  stats: DashboardStats = { pendingCount: 0, eventsTodayCount: 0, monthlyRevenue: 0 };
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
    const emailMatch = !this.customerFilter.email || (!!cd.email && String(cd.email).toLowerCase() === String(this.customerFilter.email).toLowerCase());
    const phoneMatch = !this.customerFilter.phone || (!!cd.phone && String(cd.phone).trim() === String(this.customerFilter.phone).trim());
    return Boolean(emailMatch && phoneMatch);
  }

  get filteredOrders(): Order[] {
    let list: Order[];
    if (this.currentTab === 'archive') list = this.archiveOrders;
    else {
      list = this.orders.filter((o) => {
        if (this.currentTab === 'pending') return this.isPending(o.status);
        if (this.currentTab === 'processing') return this.isProcessing(o.status);
        if (this.currentTab === 'ready') return o.status === 'ready' || o.status === 'delivered';
        return false;
      });
    }
    return list.filter((o) => this.matchesCustomerFilter(o));
  }

  get countPending(): number {
    return this.orders.filter((o) => this.isPending(o.status)).length;
  }
  get countProcessing(): number {
    return this.orders.filter((o) => this.isProcessing(o.status)).length;
  }
  get countReady(): number {
    return this.orders.filter((o) => o.status === 'ready' || o.status === 'delivered').length;
  }
  get countArchive(): number {
    return this.archiveOrders.length;
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
    const text = encodeURIComponent(
      `שלום, הזמנה #${(order._id || order.id)?.toString().slice(-8)}\nלקוח: ${order.customerDetails?.fullName || ''}`
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
    const html = `
      <!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"><title>הזמנה ${order._id || order.id}</title>
      <style>body{font-family:Heebo,Arial;padding:20px;max-width:600px;margin:0 auto}
      table{width:100%;border-collapse:collapse} th,td{border:1px solid #ddd;padding:8px;text-align:right}
      th{background:#f5f5f5} h1{color:#0E1A24} .total{font-weight:bold;font-size:1.2em}</style></head>
      <body>
        <h1>הזמנה #${(order._id || order.id)?.toString().slice(-8)}</h1>
        <p><strong>לקוח:</strong> ${order.customerDetails?.fullName || 'לא צוין'}</p>
        <p><strong>טלפון:</strong> ${order.customerDetails?.phone || 'לא צוין'}</p>
        <p><strong>תאריך אירוע:</strong> ${order.customerDetails?.eventDate || 'לא צוין'}</p>
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

  trackByOrderId(index: number, order: Order): string {
    return order._id || order.id || '';
  }
}
