export interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
}

export interface Order {
  id: string;
  customerName: string;
  phone: string;
  email?: string;
  items: OrderItem[];
  totalAmount: number;
  status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivered' | 'cancelled';
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
