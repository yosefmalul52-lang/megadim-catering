import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { CartItem } from './cart.service';

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
  message: string;
  estimatedDelivery?: string;
  totalAmount: number;
}

export interface OrderItem {
  name: string;
  price: number;
  quantity: number;
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
  /** When 'catering', order appears in Catering/Events tab; otherwise Shabbat. */
  orderType?: 'shabbat' | 'catering';
  customerDetails: {
    fullName: string;
    phone: string;
    email?: string;
    address?: string;
    notes?: string;
    eventDate?: string;
  };
  items: OrderItem[];
  totalPrice: number;
  status: 'pending' | 'processing' | 'ready' | 'cancelled' | 'new' | 'in-progress' | 'delivered';
  createdAt: string | Date;
  updatedAt?: string | Date;
  isDeleted?: boolean;
  /** Catering-specific: number of portions. */
  numberOfPortions?: number | string;
  /** Catering-specific: e.g. evening, morning, both. */
  mealTime?: string;
  /** Catering-specific: human-readable meal types summary. */
  mealTypes?: string;
}

export interface DashboardStats {
  pendingCount: number;
  eventsTodayCount: number;
  monthlyRevenue: number;
}

@Injectable({
  providedIn: 'root'
})
export class OrderService {
  private http = inject(HttpClient);

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

  /** Payload for admin manual (phone) order – same shape as checkout + manualOrder & paymentStatus. */
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
    const body = {
      ...payload,
      manualOrder: true
    };
    return this.http.post<{ success: boolean; orderId: string; order?: unknown }>(
      `${environment.apiUrl}/orders`,
      body
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
          return of({ pendingCount: 0, eventsTodayCount: 0, monthlyRevenue: 0 });
        })
      );
  }

  // Admin methods for order management. archive=true for archived/cancelled orders.
  getAllOrders(archive = false): Observable<Order[]> {
    const params: Record<string, string> = {};
    if (archive) params['archive'] = '1';
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
        return of([]);
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
        return of(null);
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
        return of([]);
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
        return of([]);
      })
    );
  }

  // Get kitchen preparation report
  getKitchenReport(): Observable<{ 
    productName: string;
    category: string;
    totalPackages: number; 
    totalWeightRaw: number; 
    displayWeight: string;
    unit?: string;
    isUnitOnly?: boolean;
  }[]> {
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
      }[] 
    }>(
      `${environment.apiUrl}/order/kitchen-report`
    ).pipe(
      map(response => response.data),
      catchError(error => {
        console.error('Error fetching kitchen report:', error);
        return of([]);
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
}
