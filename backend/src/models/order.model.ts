export interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  category?: string; // Optional category for kitchen report
}

export interface Order {
  id: string;
  customerName: string;
  phone: string;
  email?: string;
  items: OrderItem[];
  totalAmount: number;
  status: 'pending' | 'processing' | 'ready' | 'cancelled' | 'new' | 'in-progress' | 'delivered';
  orderDate: Date;
  deliveryDate?: Date;
  notes?: string;
  deliveryAddress?: string;
  eventType?: string;
  guestCount?: number;
  createdAt: Date;
  updatedAt?: Date;
}

export interface CreateOrderRequest {
  customerName: string;
  phone: string;
  email?: string;
  items: OrderItem[];
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

export interface UpdateOrderRequest {
  status?: Order['status'];
  deliveryDate?: Date;
  notes?: string;
}

/** Payload for POST /api/orders (checkout place order). */
export interface CreateCheckoutOrderRequest {
  customerName: string;
  email?: string;
  phone: string;
  address?: { city?: string; street?: string; apartment?: string } | string;
  deliveryMethod: 'delivery' | 'pickup';
  eventDate?: string;
  items: Array<{ id: string; name: string; quantity: number; price: number; category?: string; imageUrl?: string }>;
  subtotal: number;
  deliveryFee: number;
  totalAmount: number;
  notes?: string;
  /** When true, order is created as manual/phone order and status is set to 'processing'. */
  manualOrder?: boolean;
  /** For manual orders: store in customerDetails.isPaid. */
  paymentStatus?: 'paid' | 'unpaid';
  /** Optional coupon code; server will re-validate and recalculate total. */
  couponCode?: string;
  /** Set by backend from auth token when user is logged in; links order to User. */
  userId?: string | null;
  /** Optional UTM / campaign attribution from the client. */
  marketingData?: Record<string, string>;
}
