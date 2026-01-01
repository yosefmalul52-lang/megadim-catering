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
  customerDetails: {
    fullName: string;
    phone: string;
    email?: string;
    address?: string;
    notes?: string;
  };
  items: OrderItem[];
  totalPrice: number;
  status: 'new' | 'in-progress' | 'ready' | 'delivered' | 'cancelled';
  createdAt: string | Date;
  updatedAt?: string | Date;
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

  // Admin methods for order management
  getAllOrders(): Observable<Order[]> {
    return this.http.get<{success: boolean, data: Order[]}>(`${environment.apiUrl}/order`).pipe(
      map(response => {
        // Transform MongoDB orders to frontend format
        return response.data.map(order => ({
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

  // Get user's own orders (Customer)
  getMyOrders(): Observable<Order[]> {
    return this.http.get<{success: boolean, data: Order[]}>(`${environment.apiUrl}/order/my-orders`).pipe(
      map(response => {
        // Transform MongoDB orders to frontend format
        return response.data.map(order => ({
          ...order,
          id: order._id || order.id
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
}
