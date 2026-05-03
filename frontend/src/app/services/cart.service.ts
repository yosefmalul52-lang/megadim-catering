import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
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
  private platformId = inject(PLATFORM_ID);
  private cartItemsSubject = new BehaviorSubject<CartItem[]>([]);
  public cartItems$ = this.cartItemsSubject.asObservable();
  
  private isCartOpenSubject = new BehaviorSubject<boolean>(false);
  public isCartOpen$ = this.isCartOpenSubject.asObservable();

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.loadCartFromStorage();
    }
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

  /**
   * Add a specific quantity of an item to the cart.
   * If an item with the same id already exists, its quantity is increased (no duplicate lines).
   */
  addToCart(item: Omit<CartItem, 'quantity'> & { _id?: string }, quantity: number = 1): void {
    const id = (item.id ?? (item as any)._id ?? '').toString().trim();
    if (!id) {
      console.error('❌ Cannot add item to cart: Invalid or missing ID', { item, name: item.name });
      throw new Error('Cannot add item to cart: Item must have a valid ID');
    }

    const safeQuantity = quantity > 0 ? quantity : 1;
    const currentItems = [...this.currentCart];
    const existingIndex = currentItems.findIndex(cartItem => cartItem.id === id);

    const normalizedItem: CartItem = {
      ...item,
      id,
      quantity: safeQuantity
    };

    if (existingIndex !== -1) {
      currentItems[existingIndex].quantity += safeQuantity;
    } else {
      currentItems.push(normalizedItem);
    }

    this.updateCart(currentItems);
  }

  addItem(item: Omit<CartItem, 'quantity'> & { _id?: string }): void {
    const id = (item.id ?? item._id ?? '').toString().trim();
    if (!id) {
      console.error('❌ Cannot add item to cart: Invalid or missing ID', { item, name: item.name });
      throw new Error('Cannot add item to cart: Item must have a valid ID');
    }

    const currentItems = [...this.currentCart];
    const existingItemIndex = currentItems.findIndex(cartItem => cartItem.id === id);

    if (existingItemIndex !== -1) {
      currentItems[existingItemIndex].quantity += 1;
    } else {
      currentItems.push({ ...item, id, quantity: 1 });
    }

    this.updateCart(currentItems);
    this.openCart();
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
    if (!isPlatformBrowser(this.platformId) || typeof localStorage === 'undefined') {
      return;
    }
    try {
      localStorage.setItem('megadim-cart', JSON.stringify(items));
    } catch (error) {
      console.warn('Failed to save cart to localStorage:', error);
    }
  }

  private loadCartFromStorage(): void {
    if (!isPlatformBrowser(this.platformId) || typeof localStorage === 'undefined') {
      return;
    }
    try {
      const savedCart = localStorage.getItem('megadim-cart');
      if (savedCart) {
        const items: CartItem[] = JSON.parse(savedCart);
        
        // Auto-clean: Remove items with invalid IDs (null, undefined, or empty string)
        const validItems = items.filter(item => {
          const hasValidId = item.id && 
                            item.id !== null && 
                            item.id !== undefined && 
                            item.id !== '' && 
                            item.id.trim() !== '';
          
          if (!hasValidId) {
            console.warn('🧹 Removed invalid cart item (missing ID):', {
              name: item.name,
              price: item.price,
              quantity: item.quantity
            });
          }
          
          return hasValidId;
        });
        
        // If we removed any items, save the cleaned cart back to storage
        if (validItems.length !== items.length) {
          console.log(`🧹 Cleaned cart: Removed ${items.length - validItems.length} invalid items`);
          this.saveCartToStorage(validItems);
        }
        
        this.cartItemsSubject.next(validItems);
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
    const orderItems = summary.items.map((item, index) => {
      // Validate and ensure all required fields are present
      // Check for empty string as well as undefined/null
      const itemId = item.id?.trim() || '';
      const itemName = item.name?.trim() || '';
      
      if (!itemId || !itemName || item.quantity === undefined || item.quantity === null || item.price === undefined || item.price === null) {
        console.error(`❌ Invalid cart item at index ${index}:`, {
          id: item.id,
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          fullItem: item
        });
        throw new Error(`פריט ${index + 1} בעגלה לא תקין: חסרים שדות חובה (שם: ${itemName || 'חסר'}, כמות: ${item.quantity || 'חסר'}, מחיר: ${item.price || 'חסר'}). אנא הסר את הפריט ונסה שוב.`);
      }
      
      // Ensure price and quantity are numbers
      const price = typeof item.price === 'number' ? item.price : parseFloat(String(item.price));
      const quantity = typeof item.quantity === 'number' ? item.quantity : parseInt(String(item.quantity), 10);
      
      if (isNaN(price) || price <= 0) {
        console.error(`❌ Invalid price for item at index ${index}:`, item);
        throw new Error(`מחיר לא תקין עבור פריט "${itemName}": ${item.price}. אנא הסר את הפריט ונסה שוב.`);
      }
      
      if (isNaN(quantity) || quantity <= 0) {
        console.error(`❌ Invalid quantity for item at index ${index}:`, item);
        throw new Error(`כמות לא תקינה עבור פריט "${itemName}": ${item.quantity}. אנא הסר את הפריט ונסה שוב.`);
      }
      
      return {
        id: itemId,
        name: itemName,
        price: price,
        quantity: quantity,
        category: item.category || undefined // Include category if available
      };
    });

    // Validate customer details
    if (!customerDetails.fullName || !customerDetails.phone) {
      throw new Error('Customer name and phone are required');
    }

    // Backend expects CreateOrderRequest format (customerName, not customerDetails)
    const orderPayload = {
      customerName: String(customerDetails.fullName).trim(),
      phone: String(customerDetails.phone).trim(),
      email: customerDetails.email ? String(customerDetails.email).trim() : undefined,
      deliveryAddress: customerDetails.address ? String(customerDetails.address).trim() : undefined,
      notes: customerDetails.notes ? String(customerDetails.notes).trim() : undefined,
      items: orderItems
    };
    
    // Log the payload for debugging
    console.log('📦 Sending order payload:', JSON.stringify(orderPayload, null, 2));

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
        console.error('Error details:', {
          status: error.status,
          statusText: error.statusText,
          message: error.message,
          error: error.error,
          url: error.url
        });
        console.error('Order payload that was sent:', JSON.stringify(orderPayload, null, 2));
        throw error;
      })
    );
  }
}
