import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { CartService, CartItem } from '../../../services/cart.service';
import { LanguageService } from '../../../services/language.service';

@Component({
  selector: 'app-cart-modal',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatButtonModule,
    MatSnackBarModule,
    MatProgressSpinnerModule
  ],
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
            <mat-card class="order-card">
              <mat-card-header>
                <mat-card-title>הזמנה חדשה</mat-card-title>
              </mat-card-header>
              
              <mat-card-content>
                <form [formGroup]="orderForm" (ngSubmit)="placeOrder()">
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>שם מלא</mat-label>
                    <input matInput formControlName="fullName" placeholder="הזן שם מלא" required>
                    <mat-error *ngIf="orderForm.get('fullName')?.hasError('required')">
                      שם מלא נדרש
                    </mat-error>
                  </mat-form-field>

                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>טלפון</mat-label>
                    <input matInput formControlName="phone" placeholder="052-123-4567" required>
                    <mat-error *ngIf="orderForm.get('phone')?.hasError('required')">
                      טלפון נדרש
                    </mat-error>
                  </mat-form-field>

                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>תאריך אירוע</mat-label>
                    <input matInput [matDatepicker]="picker" formControlName="eventDate" placeholder="בחר תאריך">
                    <mat-datepicker-toggle matIconSuffix [for]="picker"></mat-datepicker-toggle>
                    <mat-datepicker #picker></mat-datepicker>
                  </mat-form-field>

                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>אימייל (אופציונלי)</mat-label>
                    <input matInput type="email" formControlName="email" placeholder="your@email.com">
                    <mat-error *ngIf="orderForm.get('email')?.hasError('email')">
                      אימייל לא תקין
                    </mat-error>
                  </mat-form-field>

                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>כתובת (אופציונלי)</mat-label>
                    <input matInput formControlName="address" placeholder="רחוב, עיר">
                  </mat-form-field>

                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>הערות (אופציונלי)</mat-label>
                    <textarea matInput formControlName="notes" 
                              placeholder="הערות מיוחדות, אלרגיות, או בקשות נוספות..."
                              rows="3"
                              maxlength="500"></textarea>
                    <mat-hint align="end">{{ (orderForm.get('notes')?.value || '').length }}/500</mat-hint>
                  </mat-form-field>

                  <div class="checkout-actions">
                    <button
                      type="button"
                      mat-button
                      (click)="showCheckoutForm = false"
                      [disabled]="isSubmitting"
                    >
                      חזור
                    </button>
                    <button
                      type="submit"
                      mat-raised-button
                      color="primary"
                      [disabled]="orderForm.invalid || isSubmitting || cartItems.length === 0"
                    >
                      <mat-spinner *ngIf="isSubmitting" diameter="20" style="display: inline-block; margin-left: 8px;"></mat-spinner>
                      <span *ngIf="!isSubmitting">שלח הזמנה</span>
                      <span *ngIf="isSubmitting">שולח...</span>
                    </button>
                  </div>
                </form>
              </mat-card-content>
            </mat-card>
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
  snackBar = inject(MatSnackBar);
  fb = inject(FormBuilder);
  
  private destroy$ = new Subject<void>();
  
  isCartOpen = false;
  cartItems: CartItem[] = [];
  cartSummary = this.cartService.cartSummary;
  showCheckoutForm = false;
  isSubmitting = false;
  
  orderForm!: FormGroup;

  ngOnInit(): void {
    // Initialize form
    this.orderForm = this.fb.group({
      fullName: ['', [Validators.required]],
      phone: ['', [Validators.required]],
      eventDate: [null],
      email: ['', [Validators.email]],
      address: [''],
      notes: ['']
    });
    
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
      this.snackBar.open('העגלה ריקה', 'סגור', {
        duration: 3000,
        horizontalPosition: 'start',
        verticalPosition: 'top'
      });
      return;
    }

    if (this.orderForm.invalid) {
      this.orderForm.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;

    // Format event date if provided
    const formValue = this.orderForm.value;
    const customerDetails = {
      fullName: formValue.fullName,
      phone: formValue.phone,
      email: formValue.email || '',
      address: formValue.address || '',
      notes: formValue.notes || '',
      eventDate: formValue.eventDate ? this.formatDate(formValue.eventDate) : undefined
    };

    this.cartService.sendOrder(customerDetails).subscribe({
      next: (response) => {
        console.log('Order submitted successfully:', response);
        
        // Show success message
        this.snackBar.open('ההזמנה התקבלה בהצלחה!', 'סגור', {
          duration: 4000,
          horizontalPosition: 'start',
          verticalPosition: 'top'
        });
        
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
        
        // Show error message
        this.snackBar.open('שגיאה בשליחת ההזמנה', 'סגור', {
          duration: 5000,
          horizontalPosition: 'start',
          verticalPosition: 'top'
        });
        
        this.isSubmitting = false;
      }
    });
  }

  private formatDate(date: Date): string {
    if (!date) return '';
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private resetCheckoutForm(): void {
    this.orderForm.reset();
    this.showCheckoutForm = false;
    this.isSubmitting = false;
  }

  trackByItemId(index: number, item: CartItem): string {
    return item.id;
  }
}
