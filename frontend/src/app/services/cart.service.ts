import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl: string;
  category?: string;
  description?: string;
}

export interface CartSummary {
  items: CartItem[];
  totalItems: number;
  totalPrice: number;
}

@Injectable({
  providedIn: 'root'
})
export class CartService {
  private http = inject(HttpClient);
  private cartItemsSubject = new BehaviorSubject<CartItem[]>([]);
  public cartItems$ = this.cartItemsSubject.asObservable();
  
  private isCartOpenSubject = new BehaviorSubject<boolean>(false);
  public isCartOpen$ = this.isCartOpenSubject.asObservable();

  constructor() {
    // Load cart from localStorage on service initialization
    this.loadCartFromStorage();
  }

  get currentCart(): CartItem[] {
    return this.cartItemsSubject.value;
  }

  get cartSummary(): CartSummary {
    const items = this.currentCart;
    const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
    const totalPrice = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    return {
      items,
      totalItems,
      totalPrice
    };
  }

  addItem(item: Omit<CartItem, 'quantity'>): void {
    const currentItems = this.currentCart;
    const existingItemIndex = currentItems.findIndex(cartItem => cartItem.id === item.id);
    
    if (existingItemIndex > -1) {
      // Item already exists, increase quantity
      currentItems[existingItemIndex].quantity += 1;
    } else {
      // New item, add to cart
      currentItems.push({ ...item, quantity: 1 });
    }
    
    this.updateCart(currentItems);
  }

  removeItem(itemId: string): void {
    const currentItems = this.currentCart.filter(item => item.id !== itemId);
    this.updateCart(currentItems);
  }

  updateItemQuantity(itemId: string, quantity: number): void {
    if (quantity <= 0) {
      this.removeItem(itemId);
      return;
    }

    const currentItems = this.currentCart;
    const itemIndex = currentItems.findIndex(item => item.id === itemId);
    
    if (itemIndex > -1) {
      currentItems[itemIndex].quantity = quantity;
      this.updateCart(currentItems);
    }
  }

  increaseQuantity(itemId: string): void {
    const currentItems = this.currentCart;
    const itemIndex = currentItems.findIndex(item => item.id === itemId);
    
    if (itemIndex > -1) {
      currentItems[itemIndex].quantity += 1;
      this.updateCart(currentItems);
    }
  }

  decreaseQuantity(itemId: string): void {
    const currentItems = this.currentCart;
    const itemIndex = currentItems.findIndex(item => item.id === itemId);
    
    if (itemIndex > -1) {
      if (currentItems[itemIndex].quantity > 1) {
        currentItems[itemIndex].quantity -= 1;
        this.updateCart(currentItems);
      } else {
        this.removeItem(itemId);
      }
    }
  }

  clearCart(): void {
    this.updateCart([]);
  }

  openCart(): void {
    this.isCartOpenSubject.next(true);
  }

  closeCart(): void {
    this.isCartOpenSubject.next(false);
  }

  toggleCart(): void {
    this.isCartOpenSubject.next(!this.isCartOpenSubject.value);
  }

  private updateCart(items: CartItem[]): void {
    this.cartItemsSubject.next(items);
    this.saveCartToStorage(items);
  }

  private saveCartToStorage(items: CartItem[]): void {
    try {
      localStorage.setItem('megadim-cart', JSON.stringify(items));
    } catch (error) {
      console.warn('Failed to save cart to localStorage:', error);
    }
  }

  private loadCartFromStorage(): void {
    try {
      const savedCart = localStorage.getItem('megadim-cart');
      if (savedCart) {
        const items: CartItem[] = JSON.parse(savedCart);
        this.cartItemsSubject.next(items);
      }
    } catch (error) {
      console.warn('Failed to load cart from localStorage:', error);
      this.cartItemsSubject.next([]);
    }
  }

  // Method to get cart data for order submission
  getCartForOrder(): {
    items: Array<{id: string, name: string, quantity: number, price: number}>,
    totalPrice: number,
    totalItems: number
  } {
    const summary = this.cartSummary;
    return {
      items: summary.items.map(item => ({
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        price: item.price
      })),
      totalPrice: summary.totalPrice,
      totalItems: summary.totalItems
    };
  }

  // Send order to backend
  sendOrder(customerDetails: {
    fullName: string;
    phone: string;
    email?: string;
    address?: string;
    notes?: string;
  }): Observable<{success: boolean, orderId: string, message: string}> {
    const summary = this.cartSummary;
    
    if (summary.items.length === 0) {
      return new Observable(observer => {
        observer.error(new Error('Cart is empty'));
      });
    }

    // Transform cart items to match backend CreateOrderRequest format
    const orderItems = summary.items.map(item => ({
      id: item.id,
      name: item.name,
      price: item.price,
      quantity: item.quantity
    }));

    // Backend expects CreateOrderRequest format (customerName, not customerDetails)
    const orderPayload = {
      customerName: customerDetails.fullName,
      phone: customerDetails.phone,
      email: customerDetails.email || undefined,
      deliveryAddress: customerDetails.address || undefined,
      notes: customerDetails.notes || undefined,
      items: orderItems
    };

    return this.http.post<{success: boolean, data: {orderId: string, message: string}}>(
      `${environment.apiUrl}/order/checkout`,
      orderPayload
    ).pipe(
      map(response => {
        // Clear cart on success
        this.clearCart();
        return {
          success: true,
          orderId: response.data.orderId,
          message: response.data.message
        };
      }),
      catchError((error: any) => {
        console.error('Error sending order:', error);
        throw error;
      })
    );
  }
}
