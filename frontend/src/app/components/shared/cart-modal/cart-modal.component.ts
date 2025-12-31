import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';

import { CartService, CartItem } from '../../../services/cart.service';
import { LanguageService } from '../../../services/language.service';

@Component({
  selector: 'app-cart-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="cart-overlay" [class.open]="isCartOpen" (click)="closeCart()">
      <div class="cart-modal" (click)="$event.stopPropagation()">
        <!-- Cart Header -->
        <div class="cart-header">
          <h2 class="cart-title">
            <i class="fas fa-shopping-cart" aria-hidden="true"></i>
            {{ languageService.strings.cartTitle }}
            <span class="cart-count" *ngIf="cartSummary.totalItems > 0">
              ({{ cartSummary.totalItems }})
            </span>
          </h2>
          <button 
            class="close-cart-btn" 
            (click)="closeCart()"
            [attr.aria-label]="languageService.strings.close"
          >
            <i class="fas fa-times" aria-hidden="true"></i>
          </button>
        </div>
        
        <!-- Cart Content -->
        <div class="cart-content">
          <!-- Empty Cart State -->
          <div class="empty-cart" *ngIf="cartItems.length === 0">
            <i class="fas fa-shopping-cart" aria-hidden="true"></i>
            <h3>העגלה ריקה</h3>
            <p>הוסף מנות לעגלה כדי להתחיל הזמנה</p>
            <button class="btn btn-primary" (click)="closeCart()">
              חזור לתפריט
            </button>
          </div>
          
          <!-- Cart Items -->
          <div class="cart-items" *ngIf="cartItems.length > 0">
            <div 
              class="cart-item" 
              *ngFor="let item of cartItems; trackBy: trackByItemId"
            >
              <div class="item-image">
                <img 
                  [src]="item.imageUrl || 'assets/images/placeholder-dish.jpg'" 
                  [alt]="item.name"
                  loading="lazy"
                >
              </div>
              
              <div class="item-details">
                <h4 class="item-name">{{ item.name }}</h4>
                <p class="item-category" *ngIf="item.category">{{ item.category }}</p>
                <div class="item-price">₪{{ item.price }}</div>
              </div>
              
              <div class="item-quantity">
                <label class="sr-only" [attr.for]="'qty-' + item.id">
                  {{ languageService.strings.quantity }} {{ item.name }}
                </label>
                <div class="quantity-controls">
                  <button 
                    class="qty-btn minus"
                    (click)="decreaseQuantity(item.id)"
                    [attr.aria-label]="'הפחת כמות של ' + item.name"
                    [disabled]="item.quantity <= 1"
                  >
                    <i class="fas fa-minus" aria-hidden="true"></i>
                  </button>
                  
                  <input 
                    type="number" 
                    class="qty-input"
                    [id]="'qty-' + item.id"
                    [value]="item.quantity"
                    (change)="updateQuantity(item.id, $event)"
                    min="1"
                    max="99"
                  >
                  
                  <button 
                    class="qty-btn plus"
                    (click)="increaseQuantity(item.id)"
                    [attr.aria-label]="'הוסף כמות של ' + item.name"
                  >
                    <i class="fas fa-plus" aria-hidden="true"></i>
                  </button>
                </div>
              </div>
              
              <div class="item-total">
                ₪{{ item.price * item.quantity }}
              </div>
              
              <button 
                class="remove-item-btn"
                (click)="removeItem(item.id)"
                [attr.aria-label]="'הסר ' + item.name + ' מהעגלה'"
              >
                <i class="fas fa-trash" aria-hidden="true"></i>
              </button>
            </div>
          </div>
        </div>
        
        <!-- Cart Footer -->
        <div class="cart-footer" *ngIf="cartItems.length > 0">
          <div class="cart-summary">
            <div class="summary-row">
              <span class="summary-label">סה"כ פריטים:</span>
              <span class="summary-value">{{ cartSummary.totalItems }}</span>
            </div>
            <div class="summary-row total-row">
              <span class="summary-label">{{ languageService.strings.total }}:</span>
              <span class="summary-value total-price">₪{{ cartSummary.totalPrice }}</span>
            </div>
          </div>
          
          <!-- Checkout Form -->
          <div class="checkout-section" *ngIf="!showCheckoutForm">
            <div class="cart-actions">
              <button 
                class="btn btn-secondary clear-cart-btn"
                (click)="clearCart()"
                [attr.aria-label]="'נקה את כל העגלה'"
              >
                נקה עגלה
              </button>
              
              <button 
                class="btn btn-primary checkout-btn"
                (click)="showCheckoutForm = true"
              >
                <i class="fas fa-shopping-bag"></i>
                בצע הזמנה
              </button>
            </div>
          </div>

          <!-- Checkout Form -->
          <div class="checkout-form-section" *ngIf="showCheckoutForm">
            <h3 class="checkout-title">פרטי הזמנה</h3>
            
            <form (ngSubmit)="placeOrder()" #checkoutForm="ngForm">
              <div class="form-group">
                <label for="fullName" class="form-label">
                  שם מלא <span class="required">*</span>
                </label>
                <input
                  type="text"
                  id="fullName"
                  name="fullName"
                  class="form-input"
                  [(ngModel)]="customerDetails.fullName"
                  required
                  placeholder="הזן שם מלא"
                >
              </div>

              <div class="form-group">
                <label for="phone" class="form-label">
                  טלפון <span class="required">*</span>
                </label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  class="form-input"
                  [(ngModel)]="customerDetails.phone"
                  required
                  placeholder="052-123-4567"
                  pattern="[0-9-]+"
                >
              </div>

              <div class="form-group">
                <label for="email" class="form-label">אימייל (אופציונלי)</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  class="form-input"
                  [(ngModel)]="customerDetails.email"
                  placeholder="your@email.com"
                >
              </div>

              <div class="form-group">
                <label for="address" class="form-label">כתובת (אופציונלי)</label>
                <input
                  type="text"
                  id="address"
                  name="address"
                  class="form-input"
                  [(ngModel)]="customerDetails.address"
                  placeholder="רחוב, עיר"
                >
              </div>

              <div class="form-group">
                <label for="notes" class="form-label">הערות (אופציונלי)</label>
                <textarea
                  id="notes"
                  name="notes"
                  class="form-textarea"
                  [(ngModel)]="customerDetails.notes"
                  placeholder="הערות מיוחדות, אלרגיות, או בקשות נוספות..."
                  rows="3"
                  maxlength="500"
                ></textarea>
                <small class="note-counter">{{ (customerDetails.notes || '').length }}/500</small>
              </div>

              <div class="checkout-actions">
                <button
                  type="button"
                  class="btn btn-secondary"
                  (click)="showCheckoutForm = false"
                  [disabled]="isProcessingOrder"
                >
                  חזור
                </button>
                <button
                  type="submit"
                  class="btn btn-primary"
                  [disabled]="!checkoutForm.valid || isProcessingOrder || cartItems.length === 0"
                >
                  <span *ngIf="!isProcessingOrder">
                    <i class="fas fa-check"></i>
                    שלח הזמנה
                  </span>
                  <span *ngIf="isProcessingOrder">
                    <i class="fas fa-spinner fa-spin"></i>
                    שולח...
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./cart-modal.component.scss']
})
export class CartModalComponent implements OnInit, OnDestroy {
  cartService = inject(CartService);
  languageService = inject(LanguageService);
  router = inject(Router);
  
  private destroy$ = new Subject<void>();
  
  isCartOpen = false;
  cartItems: CartItem[] = [];
  cartSummary = this.cartService.cartSummary;
  showCheckoutForm = false;
  isProcessingOrder = false;
  
  customerDetails = {
    fullName: '',
    phone: '',
    email: '',
    address: '',
    notes: ''
  };

  ngOnInit(): void {
    // Subscribe to cart state
    this.cartService.isCartOpen$
      .pipe(takeUntil(this.destroy$))
      .subscribe(isOpen => {
        this.isCartOpen = isOpen;
        if (isOpen) {
          document.body.style.overflow = 'hidden';
        } else {
          document.body.style.overflow = '';
        }
      });
    
    // Subscribe to cart items
    this.cartService.cartItems$
      .pipe(takeUntil(this.destroy$))
      .subscribe(items => {
        this.cartItems = items;
        this.cartSummary = this.cartService.cartSummary;
      });
    
    // Close cart on escape key
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.isCartOpen) {
        this.closeCart();
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    document.body.style.overflow = '';
  }

  closeCart(): void {
    this.cartService.closeCart();
  }

  removeItem(itemId: string): void {
    this.cartService.removeItem(itemId);
  }

  updateQuantity(itemId: string, event: Event): void {
    const target = event.target as HTMLInputElement;
    const quantity = parseInt(target.value, 10);
    
    if (quantity && quantity > 0) {
      this.cartService.updateItemQuantity(itemId, quantity);
    } else {
      // Reset to current quantity if invalid input
      const item = this.cartItems.find(i => i.id === itemId);
      if (item) {
        target.value = item.quantity.toString();
      }
    }
  }

  increaseQuantity(itemId: string): void {
    this.cartService.increaseQuantity(itemId);
  }

  decreaseQuantity(itemId: string): void {
    this.cartService.decreaseQuantity(itemId);
  }

  clearCart(): void {
    if (confirm('האם אתה בטוח שברצונך לנקות את העגלה?')) {
      this.cartService.clearCart();
      this.resetCheckoutForm();
    }
  }

  placeOrder(): void {
    if (this.cartItems.length === 0) {
      alert('העגלה ריקה');
      return;
    }

    // Validate required fields
    if (!this.customerDetails.fullName || !this.customerDetails.phone) {
      alert('אנא מלא את כל השדות החובה (שם מלא וטלפון)');
      return;
    }

    this.isProcessingOrder = true;

    this.cartService.sendOrder(this.customerDetails).subscribe({
      next: (response) => {
        console.log('Order submitted successfully:', response);
        
        // Show success message
        alert('הזמנתך התקבלה בהצלחה! נחזור אליך בהקדם לאישור הפרטים.');
        
        // Reset form and close cart
        this.resetCheckoutForm();
        this.closeCart();
        
        // Redirect to home after 2 seconds
        setTimeout(() => {
          this.router.navigate(['/']);
        }, 2000);
      },
      error: (error) => {
        console.error('Error placing order:', error);
        alert('שגיאה בשליחת ההזמנה. אנא נסה שוב או התקשר אלינו ישירות.');
        this.isProcessingOrder = false;
      }
    });
  }

  private resetCheckoutForm(): void {
    this.customerDetails = {
      fullName: '',
      phone: '',
      email: '',
      address: '',
      notes: ''
    };
    this.showCheckoutForm = false;
    this.isProcessingOrder = false;
  }

  trackByItemId(index: number, item: CartItem): string {
    return item.id;
  }
}
