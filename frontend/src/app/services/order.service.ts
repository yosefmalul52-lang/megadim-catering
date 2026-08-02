import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { MatSnackBar } from '@angular/material/snack-bar';
import { environment } from '../../environments/environment';
import { CartItem } from './cart.service';
import {
  DashboardOverviewData,
  DashboardQueryParams,
  normalizeOverview
} from '../utils/dashboard-overview.util';

export interface OrderRequest {
  customerName: string;
  phone: string;
  email?: string;
  items: Array<{
    id: string;
    name: string;
    quantity: number;
    price: number;
    category?: string; // Include category for kitchen report
  }>;
  notes?: string;
  deliveryAddress?: string;
  preferredDeliveryTime?: string;
  eventDate?: string;
  eventType?: string;
  guestCount?: number;
}

export interface OrderResponse {
  success: boolean;
  orderId: string;
  orderNumber?: string;
  message: string;
  estimatedDelivery?: string;
  totalAmount: number;
}

export interface OrderItem {
  productId?: string;
  id?: string;
  name: string;
  price: number;
  quantity: number;
  category?: string;
  selectedOption?: {
    label: string;
    amount: string;
    price: number;
  };
  imageUrl?: string;
  description?: string;
}

export interface Order {
  _id?: string;
  id?: string;
  orderNumber?: string;
  /** When 'catering', order appears in Catering/Events tab; otherwise Shabbat. */
  orderType?: 'shabbat' | 'catering';
  /**
   * Distinguishes between the two catering pipelines:
   * 'shabbat' = Shabbat & holiday catering form; 'events' = wedding/corporate events form.
   */
  cateringKind?: 'shabbat' | 'events';
  /** Event type label for event catering orders (e.g. 'חתונה', 'אירוע עסקי'). */
  eventType?: string;
  /** Number of guests for event catering orders. */
  guestCount?: number;
  /** Event venue / location — used by event catering. */
  venue?: string;
  customerDetails: {
    fullName: string;
    phone: string;
    email?: string;
    address?: string;
    notes?: string;
    eventDate?: string;
    deliveryType?: 'pickup' | 'delivery';
    pricePerPortion?: number;
    /** Fallback pricing for orders created before root-level subtotal/deliveryFee was added. */
    subtotal?: number;
    deliveryFee?: number;
  };
  items: OrderItem[];
  /** Optional pricing breakdown returned by backend checkout/manual-order flows. */
  subtotal?: number;
  deliveryFee?: number;
  totalPrice: number;
  status:
    | 'pending'
    | 'processing'
    | 'ready'
    | 'cancelled'
    | 'new'
    | 'in-progress'
    | 'out_for_delivery'
    | 'delivery_failed'
    | 'delivered';
  createdAt: string | Date;
  updatedAt?: string | Date;
  isDeleted?: boolean;
  assignedDriverId?: string | null;
  assignedDriverName?: string;
  assignedAt?: string | Date | null;
  /** Catering-specific: number of portions. */
  numberOfPortions?: number | string;
  /** Shabbat/holiday catering: portion count for evening (first meal). */
  portionsEvening?: number;
  /** Shabbat/holiday catering: portion count for morning (second meal). */
  portionsMorning?: number;
  /** Catering-specific: e.g. evening, morning, both. */
  mealTime?: string;
  /** Catering-specific: human-readable meal types summary. */
  mealTypes?: string;
  // ── Payment pipeline ────────────────────────────────────────────────────
  /**
   * pending        → no payment action taken yet
   * authorized     → pre-auth hold placed; awaiting admin capture
   * captured       → charge finalised
   * voided         → hold released (order cancelled before capture)
   * failed         → payment attempt failed
   */
  paymentStatus?: 'pending' | 'awaiting_payment' | 'authorized' | 'captured' | 'voided' | 'failed';
  /** Provider-issued auth code from the pre-auth response. */
  authCode?: string;
  /** Provider's transaction ID — used to capture or void. */
  transactionId?: string;
  /** Amount that was pre-authorized — used to warn if totalPrice changed after auth. */
  authorizedAmount?: number;
  /** Internal admin notes — never overwrites customerDetails.notes. */
  adminNotes?: string;
  /** Admin-only: exclude from business dashboard revenue when true. */
  isTestOrder?: boolean;
}

export interface DriverOrderAssignmentPayload {
  driverId: string | null;
}

export interface DashboardStats {
  pendingCount: number;
  eventsTodayCount: number;
  monthlyRevenue: number;
}

export interface OrderSourceTabCounts {
  total: number;
  pending: number;
  processing: number;
  ready: number;
  failed: number;
  archive: number;
}

export interface OrderTabCounts {
  shabbat: OrderSourceTabCounts;
  catering: OrderSourceTabCounts;
  events: OrderSourceTabCounts;
}

export type AdminOrderSource = 'shabbat' | 'catering' | 'events';
export type AdminOrderStatusTab = 'pending' | 'processing' | 'ready' | 'failed' | 'archive';
export type AdminOrdersSortBy =
  | 'createdAt'
  | 'eventDate'
  | 'customerName'
  | 'totalPrice'
  | 'status'
  | 'orderNumber';

export interface AdminOrdersPageParams {
  page?: number;
  limit?: number;
  source?: AdminOrderSource;
  statusTab?: AdminOrderStatusTab;
  /** @deprecated Legacy combined search */
  search?: string;
  /** @deprecated Legacy combined date */
  dateFrom?: string;
  /** @deprecated Legacy combined date */
  dateTo?: string;
  orderNumberSearch?: string;
  customerSearch?: string;
  createdFrom?: string;
  createdTo?: string;
  eventFrom?: string;
  eventTo?: string;
  sortBy?: AdminOrdersSortBy;
  sortDir?: 'asc' | 'desc';
  hasCustomerNotes?: boolean;
  hasAdminNotes?: boolean;
}

export interface AdminOrdersPageResult {
  orders: Order[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface RevenueBySourcePoint {
  source: string;
  totalRevenue: number;
  ordersCount: number;
}

export interface MonthlyRevenuePoint {
  month: string;
  totalRevenue: number;
  ordersCount: number;
}

export interface KitchenReportMeta {
  generatedAt: string;
  activeOrdersCount: number;
  appliedDate?: string;
}

export type BulkOrderAction = 'status' | 'archive' | 'restore' | 'permanent_delete';

export interface BulkOrderResult {
  matchedCount: number;
  modifiedCount: number;
  deletedCount: number;
}

@Injectable({
  providedIn: 'root'
})
export class OrderService {
  private http = inject(HttpClient);
  private snackBar = inject(MatSnackBar);

  private static readonly LOAD_ERROR_MESSAGE = 'אירעה שגיאה בטעינת הנתונים';

  private handleDataLoadError(error: unknown): Observable<never> {
    this.snackBar.open(OrderService.LOAD_ERROR_MESSAGE, 'סגור', { duration: 6000 });
    return throwError(() => error);
  }

  submitOrder(orderRequest: OrderRequest): Observable<OrderResponse> {
    return this.http.post<{success: boolean, data: OrderResponse}>(`${environment.apiUrl}/order/checkout`, orderRequest).pipe(
      map(response => response.data),
      catchError((error: any) => {
        console.error('Error submitting order:', error);
        throw error;
      })
    );
  }

  // Alias for createOrder (for consistency)
  createOrder(orderRequest: OrderRequest): Observable<OrderResponse> {
    return this.submitOrder(orderRequest);
  }

  /** Payload for the protected admin manual-order endpoint. */
  createManualOrder(payload: {
    customerName: string;
    phone: string;
    email?: string;
    address?: { city?: string; street?: string; apartment?: string } | string;
    deliveryMethod: 'delivery' | 'pickup';
    eventDate?: string;
    items: Array<{ id: string; name: string; quantity: number; price: number; category?: string }>;
    subtotal: number;
    deliveryFee: number;
    totalAmount: number;
    notes?: string;
    paymentStatus?: 'paid' | 'unpaid';
  }): Observable<{ success: boolean; orderId: string; order?: unknown }> {
    return this.http.post<{ success: boolean; orderId: string; order?: unknown }>(
      `${environment.apiUrl}/orders/manual`,
      payload
    ).pipe(
      catchError((err: unknown) => {
        console.error('Error creating manual order:', err);
        throw err;
      })
    );
  }

  getDashboardStats(): Observable<DashboardStats> {
    return this.http
      .get<{ success: boolean; data: DashboardStats }>(`${environment.apiUrl}/order/dashboard-stats`)
      .pipe(
        map((res) => res.data),
        catchError((err) => {
          console.error('Error fetching dashboard stats:', err);
          return this.handleDataLoadError(err);
        })
      );
  }

  /**
   * Unified admin business dashboard (KPIs, trend, top items, payment alerts).
   * GET /api/order/dashboard-overview
   */
  getDashboardOverview(query: DashboardQueryParams): Observable<DashboardOverviewData> {
    let params = new HttpParams().set('timezone', query.timezone || 'Asia/Jerusalem');
    if (query.preset) params = params.set('preset', query.preset);
    if (query.from) params = params.set('from', query.from);
    if (query.to) params = params.set('to', query.to);
    if (query.salesPreset) params = params.set('salesPreset', query.salesPreset);
    if (query.salesFrom) params = params.set('salesFrom', query.salesFrom);
    if (query.salesTo) params = params.set('salesTo', query.salesTo);

    return this.http
      .get<{ success: boolean; data: DashboardOverviewData }>(
        `${environment.apiUrl}/order/dashboard-overview`,
        { params }
      )
      .pipe(
        map((res) => {
          const normalized = normalizeOverview(res?.data);
          if (!normalized) {
            throw new Error('Invalid dashboard overview response');
          }
          return normalized;
        }),
        catchError((err: unknown) => {
          console.error('Error fetching dashboard overview:', err);
          return throwError(() => err);
        })
      );
  }

  /**
   * Admin-only: mark / unmark an order as test (excluded from business KPIs).
   * PATCH /api/order/:id/test-order  body: { isTestOrder: boolean }
   */
  setOrderTestFlag(
    orderId: string,
    isTestOrder: boolean
  ): Observable<{ success: boolean; data: Order; message?: string }> {
    return this.http
      .patch<{ success: boolean; data: Order; message?: string }>(
        `${environment.apiUrl}/order/${orderId}/test-order`,
        { isTestOrder }
      )
      .pipe(
        catchError((err: unknown) => {
          console.error('Error updating test-order flag:', err);
          return throwError(() => err);
        })
      );
  }

  /** Per-source tab counts for admin orders dashboard (full DB counts, not limited to list page size). */
  getOrderTabCounts(): Observable<OrderTabCounts> {
    return this.http
      .get<{ success: boolean; data: OrderTabCounts }>(`${environment.apiUrl}/order/admin/tab-counts`)
      .pipe(
        map((res) => res.data),
        catchError((err) => {
          console.error('Error fetching order tab counts:', err);
          return throwError(() => err);
        })
      );
  }

  /** Paginated admin orders list with server-side filters (admin dashboard). */
  getAdminOrdersPage(params: AdminOrdersPageParams): Observable<AdminOrdersPageResult> {
    const query: Record<string, string> = {};
    if (params.page != null) query['page'] = String(params.page);
    if (params.limit != null) query['limit'] = String(params.limit);
    if (params.source) query['source'] = params.source;
    if (params.statusTab) query['statusTab'] = params.statusTab;
    if (params.search?.trim()) query['search'] = params.search.trim();
    if (params.dateFrom) query['dateFrom'] = params.dateFrom;
    if (params.dateTo) query['dateTo'] = params.dateTo;
    if (params.orderNumberSearch?.trim()) {
      query['orderNumberSearch'] = params.orderNumberSearch.trim();
    }
    if (params.customerSearch?.trim()) query['customerSearch'] = params.customerSearch.trim();
    if (params.createdFrom) query['createdFrom'] = params.createdFrom;
    if (params.createdTo) query['createdTo'] = params.createdTo;
    if (params.eventFrom) query['eventFrom'] = params.eventFrom;
    if (params.eventTo) query['eventTo'] = params.eventTo;
    if (params.sortBy) query['sortBy'] = params.sortBy;
    if (params.sortDir) query['sortDir'] = params.sortDir;
    if (params.hasCustomerNotes) query['hasCustomerNotes'] = 'true';
    if (params.hasAdminNotes) query['hasAdminNotes'] = 'true';

    return this.http
      .get<{
        success: boolean;
        data: Order[];
        pagination: { page: number; limit: number; total: number; totalPages: number };
      }>(`${environment.apiUrl}/order`, { params: query })
      .pipe(
        map((res) => ({
          orders: (res.data || []).map((order) => ({
            ...order,
            id: order._id || order.id
          })),
          pagination: res.pagination
        })),
        catchError((error: unknown) => {
          console.error('Error fetching admin orders page:', error);
          return throwError(() => error);
        })
      );
  }

  // Admin methods for order management. archive=true for archived/cancelled orders.
  getAllOrders(
    archive = false,
    limit?: number,
    paymentFilter?: 'valid' | 'failed'
  ): Observable<Order[]> {
    const params: Record<string, string> = {};
    if (archive) params['archive'] = '1';
    else if (paymentFilter === 'failed') params['paymentFilter'] = 'failed';
    if (typeof limit === 'number' && limit > 0) params['limit'] = String(limit);
    return this.http.get<{ success: boolean; data: Order[] }>(`${environment.apiUrl}/order`, { params }).pipe(
      map((response: { success: boolean; data: Order[] }) => {
        const data = response.data || [];
        return data.map((order: Order) => ({
          ...order,
          id: order._id || order.id
        }));
      }),
      catchError((error: any) => {
        console.error('Error fetching orders:', error);
        return this.handleDataLoadError(error);
      })
    );
  }

  deleteOrder(orderId: string): Observable<void> {
    return this.http.delete<{ success: boolean }>(`${environment.apiUrl}/order/${orderId}`).pipe(
      map(() => {}),
      catchError((error: any) => {
        console.error('Error deleting order:', error);
        throw error;
      })
    );
  }

  restoreOrder(orderId: string): Observable<Order> {
    return this.http.put<{ success: boolean; data: Order }>(`${environment.apiUrl}/order/${orderId}/restore`, {}).pipe(
      map((res) => {
        const order = res.data;
        return { ...order, id: order._id || order.id };
      }),
      catchError((error: any) => {
        console.error('Error restoring order:', error);
        throw error;
      })
    );
  }

  hardDeleteOrder(orderId: string): Observable<void> {
    return this.http.delete<{ success: boolean }>(`${environment.apiUrl}/order/${orderId}/permanent`).pipe(
      map(() => {}),
      catchError((error: any) => {
        console.error('Error permanently deleting order:', error);
        throw error;
      })
    );
  }

  getOrderById(orderId: string): Observable<Order | null> {
    return this.http.get<{success: boolean, data: Order}>(`${environment.apiUrl}/order/${orderId}`).pipe(
      map(response => ({
        ...response.data,
        id: response.data._id || response.data.id
      })),
      catchError((error: any) => {
        console.error('Error fetching order:', error);
        return this.handleDataLoadError(error);
      })
    );
  }

  updateOrderStatus(orderId: string, status: Order['status']): Observable<Order> {
    return this.http.put<{success: boolean, data: Order}>(`${environment.apiUrl}/order/${orderId}/status`, { status }).pipe(
      map(response => ({
        ...response.data,
        id: response.data._id || response.data.id
      })),
      catchError((error: any) => {
        console.error('Error updating order status:', error);
        throw error;
      })
    );
  }

  getDriverMyOrders(params?: { fromDate?: string; toDate?: string; limit?: number }): Observable<Order[]> {
    const query: Record<string, string> = {};
    if (params?.fromDate) query['fromDate'] = params.fromDate;
    if (params?.toDate) query['toDate'] = params.toDate;
    if (params?.limit) query['limit'] = String(params.limit);
    return this.http
      .get<{ success: boolean; data: Order[] }>(`${environment.apiUrl}/order/driver/my`, { params: query })
      .pipe(
        map((res) => (res?.data || []).map((order) => ({ ...order, id: order._id || order.id }))),
        catchError((err) => {
          console.error('Error fetching driver orders:', err);
          return this.handleDataLoadError(err);
        })
      );
  }

  assignOrderToDriver(orderId: string, payload: DriverOrderAssignmentPayload): Observable<Order> {
    return this.http
      .patch<{ success: boolean; data: Order }>(`${environment.apiUrl}/order/${orderId}/assign-driver`, payload)
      .pipe(
        map((res) => ({ ...res.data, id: res.data._id || res.data.id })),
        catchError((err) => {
          console.error('Error assigning driver:', err);
          throw err;
        })
      );
  }

  /** Update order event/delivery date (Admin). */
  updateOrderDate(orderId: string, newDate: string | Date): Observable<Order> {
    const dateStr = typeof newDate === 'string' ? newDate : new Date(newDate).toISOString().slice(0, 10);
    const payload = { eventDate: dateStr, newDate: dateStr };
    const id = String(orderId).trim();
    const url = `${environment.apiUrl}/order/${id}/date`;
    return this.http.put<{ success: boolean; data: Order }>(url, payload).pipe(
      map((response) => {
        const order = response?.data;
        if (!order) throw new Error('No order in response');
        return { ...order, id: order._id || order.id };
      }),
      catchError((error: any) => {
        console.error('Error updating order date:', error);
        throw error;
      })
    );
  }

  /** Admin: update retail order shipping cost; backend recalculates totalPrice. */
  updateShippingCost(orderId: string, shippingCost: number): Observable<Order> {
    const id = String(orderId).trim();
    return this.http
      .patch<{ success: boolean; data: Order; message?: string }>(
        `${environment.apiUrl}/order/${id}/shipping-cost`,
        { shippingCost }
      )
      .pipe(
        map((response) => ({
          ...response.data,
          id: response.data._id || response.data.id
        })),
        catchError((error: any) => {
          console.error('Error updating shipping cost:', error);
          throw error;
        })
      );
  }

  /** Admin: update internal order notes without modifying customer notes. */
  updateOrderAdminNotes(orderId: string, adminNotes: string): Observable<Order> {
    const id = String(orderId).trim();
    return this.http
      .patch<{ success: boolean; data: Order; message?: string }>(
        `${environment.apiUrl}/order/admin/${id}/admin-notes`,
        { adminNotes }
      )
      .pipe(
        map((response) => ({
          ...response.data,
          id: response.data._id || response.data.id
        })),
        catchError((error: any) => {
          console.error('Error updating admin notes:', error);
          throw error;
        })
      );
  }

  /** Admin: update Shabbat/holiday catering portion counts. */
  updateOrderPortions(
    orderId: string,
    portions: { portionsEvening: number; portionsMorning: number }
  ): Observable<Order> {
    const id = String(orderId).trim();
    return this.http
      .patch<{ success: boolean; data: Order; message?: string }>(
        `${environment.apiUrl}/order/admin/${id}/portions`,
        portions
      )
      .pipe(
        map((response) => ({
          ...response.data,
          id: response.data._id || response.data.id
        })),
        catchError((error: any) => {
          console.error('Error updating order portions:', error);
          throw error;
        })
      );
  }

  /** Admin: replace items of an existing order and let backend recalculate totalPrice from DB prices. */
  updateOrderItems(
    orderId: string,
    items: Array<{
      productId?: string;
      id?: string;
      name?: string;
      quantity: number;
      category?: string;
      price?: number;
      description?: string;
      selectedOption?: { label: string; amount?: string; price?: number };
    }>
  ): Observable<Order> {
    return this.http.put<{ success: boolean; data: Order }>(
      `${environment.apiUrl}/order/admin/${orderId}/items`,
      { items }
    ).pipe(
      map((response) => ({
        ...response.data,
        id: response.data._id || response.data.id
      })),
      catchError((error: any) => {
        console.error('Error updating order items:', error);
        throw error;
      })
    );
  }

  bulkUpdateOrders(payload: {
    orderIds: string[];
    action: BulkOrderAction;
    status?: Order['status'];
  }): Observable<BulkOrderResult> {
    return this.http
      .post<{ success: boolean; data: BulkOrderResult }>(`${environment.apiUrl}/order/bulk`, payload)
      .pipe(
        map((res) => res.data),
        catchError((error: any) => {
          console.error('Error updating orders in bulk:', error);
          throw error;
        })
      );
  }

  // Get user's own orders (Customer)
  getMyOrders(): Observable<Order[]> {
    return this.http.get<Order[]>(`${environment.apiUrl}/orders/myorders`).pipe(
      map((orders) => {
        // Normalize id field for convenience
        return (orders || []).map((order: Order) => ({
          ...order,
          id: (order as any)._id || order.id
        }));
      }),
      catchError((error: any) => {
        console.error('Error fetching my orders:', error);
        return this.handleDataLoadError(error);
      })
    );
  }

  // Helper method to convert cart items to order items
  static convertCartItemsToOrderItems(cartItems: CartItem[]): OrderRequest['items'] {
    return cartItems.map(item => ({
      id: item.id,
      name: item.name,
      quantity: item.quantity,
      price: item.price
    }));
  }

  // Method to generate order summary for WhatsApp or email
  generateOrderSummary(orderRequest: OrderRequest): string {
    const itemsList = orderRequest.items
      .map(item => `• ${item.name} x${item.quantity} - ₪${item.price * item.quantity}`)
      .join('\n');
    
    const totalAmount = orderRequest.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    return `
הזמנה חדשה - מגדים קייטרינג

👤 לקוח: ${orderRequest.customerName}
📞 טלפון: ${orderRequest.phone}
${orderRequest.email ? `📧 אימייל: ${orderRequest.email}` : ''}

🍽️ פרטי ההזמנה:
${itemsList}

💰 סה"כ: ₪${totalAmount}

${orderRequest.eventType ? `🎉 סוג אירוע: ${orderRequest.eventType}` : ''}
${orderRequest.guestCount ? `👥 מספר אורחים: ${orderRequest.guestCount}` : ''}
${orderRequest.eventDate ? `📅 תאריך אירוע: ${orderRequest.eventDate}` : ''}
${orderRequest.deliveryAddress ? `📍 כתובת: ${orderRequest.deliveryAddress}` : ''}
${orderRequest.notes ? `📝 הערות: ${orderRequest.notes}` : ''}
    `.trim();
  }

  // Get revenue statistics for the last 7 days
  getRevenueStats(): Observable<{ date: string; total: number }[]> {
    return this.http.get<{ success: boolean; data: { date: string; total: number }[] }>(
      `${environment.apiUrl}/order/stats/revenue`
    ).pipe(
      map(response => response.data),
      catchError(error => {
        console.error('Error fetching revenue stats:', error);
        return this.handleDataLoadError(error);
      })
    );
  }

  getRevenueBySource(params?: {
    from?: string;
    to?: string;
    includeArchived?: boolean;
  }): Observable<RevenueBySourcePoint[]> {
    const query: Record<string, string> = {};
    if (params?.from) query['from'] = params.from;
    if (params?.to) query['to'] = params.to;
    if (typeof params?.includeArchived === 'boolean') {
      query['includeArchived'] = String(params.includeArchived);
    }
    return this.http
      .get<{ success: boolean; data: RevenueBySourcePoint[] }>(
        `${environment.apiUrl}/order/analytics/revenue-by-source`,
        { params: query }
      )
      .pipe(
        map((res) => res.data || []),
        catchError((error) => {
          console.error('Error fetching revenue by source:', error);
          return this.handleDataLoadError(error);
        })
      );
  }

  getMonthlyRevenue(params?: {
    from?: string;
    to?: string;
    includeArchived?: boolean;
  }): Observable<MonthlyRevenuePoint[]> {
    const query: Record<string, string> = {};
    if (params?.from) query['from'] = params.from;
    if (params?.to) query['to'] = params.to;
    if (typeof params?.includeArchived === 'boolean') {
      query['includeArchived'] = String(params.includeArchived);
    }
    return this.http
      .get<{ success: boolean; data: MonthlyRevenuePoint[] }>(
        `${environment.apiUrl}/order/analytics/monthly-revenue`,
        { params: query }
      )
      .pipe(
        map((res) => res.data || []),
        catchError((error) => {
          console.error('Error fetching monthly revenue analytics:', error);
          return this.handleDataLoadError(error);
        })
      );
  }

  // Get kitchen preparation report
  getKitchenReport(date?: string, includeCatering?: boolean): Observable<{
    items: {
      productName: string;
      category: string;
      totalPackages: number;
      totalWeightRaw: number;
      displayWeight: string;
      unit?: string;
      isUnitOnly?: boolean;
      prepWindow?: 'now' | 'soon' | 'later';
      prepWindowLabel?: string;
      prepSortOrder?: number;
    }[];
    meta: KitchenReportMeta | null;
  }> {
    const params: Record<string, string> = {};
    if (date) params['date'] = date;
    if (includeCatering) params['includeCatering'] = 'true';
    return this.http.get<{ 
      success: boolean; 
      data: {
        productName: string;
        category: string;
        totalPackages: number; 
        totalWeightRaw: number; 
        displayWeight: string;
        unit?: string;
        isUnitOnly?: boolean;
        prepWindow?: 'now' | 'soon' | 'later';
        prepWindowLabel?: string;
        prepSortOrder?: number;
      }[];
      meta?: KitchenReportMeta;
    }>(
      `${environment.apiUrl}/order/kitchen-report`,
      { params }
    ).pipe(
      map(response => ({
        items: response.data || [],
        meta: response.meta || null
      })),
      catchError(error => {
        console.error('Error fetching kitchen report:', error);
        return of({ items: [], meta: null });
      })
    );
  }

  // Get delivery report for a date range. Returns days keyed by YYYY-MM-DD.
  getDeliveryReport(fromDate: string, toDate?: string): Observable<{
    days: Record<string, { deliveryByCity: { city: string; orders: any[] }[]; pickupByTime: { time: string; orders: any[] }[] }>;
  }> {
    const url = `${environment.apiUrl}/order/delivery-report`;
    const params = toDate
      ? { fromDate, toDate } as Record<string, string>
      : { fromDate } as Record<string, string>;
    return this.http.get<{
      success: boolean;
      data: { days: Record<string, { deliveryByCity: { city: string; orders: any[] }[]; pickupByTime: { time: string; orders: any[] }[] }> };
    }>(url, { params }).pipe(
      map((response) => response.data),
      catchError(error => {
        console.error('Error fetching delivery report:', error);
        return of({ days: {} });
      })
    );
  }

  // ─── Payment ──────────────────────────────────────────────────────────────

  /** Admin: capture a pre-authorized payment. */
  capturePayment(orderId: string): Observable<{ success: boolean; captureRef?: string; message?: string }> {
    return this.http
      .post<{ success: boolean; captureRef?: string; message?: string }>(
        `${environment.apiUrl}/payment/capture/${orderId}`,
        {}
      )
      .pipe(
        catchError((err) => {
          console.error('Error capturing payment:', err);
          throw err;
        })
      );
  }

  /** Admin: void (release) a pre-authorized hold, e.g. when cancelling the order. */
  voidPayment(orderId: string): Observable<{ success: boolean; message?: string }> {
    return this.http
      .post<{ success: boolean; message?: string }>(
        `${environment.apiUrl}/payment/void/${orderId}`,
        {}
      )
      .pipe(
        catchError((err) => {
          console.error('Error voiding payment:', err);
          throw err;
        })
      );
  }

  /** Polling fallback: query the current payment status for an order. */
  getPaymentStatus(orderId: string): Observable<{
    paymentStatus: Order['paymentStatus'];
    transactionId?: string;
    authCode?: string;
    authorizedAmount?: number;
  }> {
    return this.http
      .get<{
        success: boolean;
        paymentStatus: Order['paymentStatus'];
        transactionId?: string;
        authCode?: string;
        authorizedAmount?: number;
      }>(`${environment.apiUrl}/payment/status/${orderId}`)
      .pipe(
        map((res) => ({
          paymentStatus: res.paymentStatus,
          transactionId: res.transactionId,
          authCode: res.authCode,
          authorizedAmount: res.authorizedAmount
        })),
        catchError((err) => {
          console.error('Error fetching payment status:', err);
          throw err;
        })
      );
  }
}
