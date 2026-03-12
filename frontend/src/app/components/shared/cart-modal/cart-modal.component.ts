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
import { MatRadioModule } from '@angular/material/radio';

import { HttpClient } from '@angular/common/http';
import { CartService, CartItem } from '../../../services/cart.service';
import { LanguageService } from '../../../services/language.service';
import { SiteSettingsService, SiteSettings } from '../../../services/site-settings.service';
import { environment } from '../../../../environments/environment';

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
    MatProgressSpinnerModule,
    MatRadioModule
  ],
  template: `
    <div class="cart-overlay" [class.open]="isCartOpen" (click)="closeCart()">
      <div class="cart-modal" [attr.dir]="'rtl'" (click)="$event.stopPropagation()">
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
            <h3>העגלה שלך ריקה</h3>
            <p>הוסף מנות לעגלה כדי להתחיל הזמנה</p>
            <button class="btn-back-to-menu" (click)="closeCart()">
              חזרה לתפריט
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
        
        <!-- Cart Footer: summary + sticky action buttons (only when cart has items) -->
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

          <div class="cart-footer-actions">
            <button
              type="button"
              class="btn-clear-cart"
              (click)="clearCart()"
              [attr.aria-label]="'נקה את כל העגלה'"
            >
              ניקוי עגלה
            </button>
            <button
              type="button"
              class="btn-go-to-cart"
              (click)="goToCart()"
              [attr.aria-label]="'מעבר לעגלת הקניות'"
            >
              מעבר לעגלת הקניות
            </button>
            <button
              type="button"
              class="btn-checkout"
              (click)="goToCheckout()"
              [attr.aria-label]="'ביצוע ההזמנה'"
            >
              ביצוע ההזמנה
            </button>
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
  settingsService = inject(SiteSettingsService);
  http = inject(HttpClient);
  router = inject(Router);
  snackBar = inject(MatSnackBar);
  fb = inject(FormBuilder);
  
  private destroy$ = new Subject<void>();
  
  isCartOpen = false;
  cartItems: CartItem[] = [];
  cartSummary = this.cartService.cartSummary;
  showCheckoutForm = false;
  isSubmitting = false;
  settings: SiteSettings | null = null;
  
  orderForm!: FormGroup;

  ngOnInit(): void {
    this.orderForm = this.fb.group({
      fullName: ['', [Validators.required]],
      phone: ['', [Validators.required]],
      customerEmail: ['', [Validators.email]],
      eventDate: [null],
      deliveryType: ['pickup' as 'pickup' | 'delivery'],
      address: [''],
      notes: ['']
    });
    this.updateAddressValidators();
    this.orderForm.get('deliveryType')?.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => this.updateAddressValidators());
    
    this.settingsService.getSettings(true).pipe(takeUntil(this.destroy$)).subscribe(s => {
      this.settings = s;
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
    }
  }

  goToCart(): void {
    this.cartService.closeCart();
    this.router.navigate(['/cart']);
  }

  goToCheckout(): void {
    this.cartService.closeCart();
    this.router.navigate(['/checkout']);
  }

  private updateAddressValidators(): void {
    const addressControl = this.orderForm.get('address');
    if (!addressControl) return;
    if (this.orderForm.get('deliveryType')?.value === 'delivery') {
      addressControl.setValidators([Validators.required]);
    } else {
      addressControl.clearValidators();
    }
    addressControl.updateValueAndValidity();
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
    const formValue = this.orderForm.value;
    const deliveryType = (formValue.deliveryType === 'delivery' ? 'delivery' : 'pickup') as 'pickup' | 'delivery';
    const eventDateStr = formValue.eventDate ? this.formatDate(formValue.eventDate) : undefined;
    const summary = this.cartService.cartSummary;
    const items = summary.items.map(i => ({
      id: i.id,
      name: i.name,
      quantity: i.quantity,
      price: i.price
    }));
    const total = summary.totalPrice;

    const customerEmail = (formValue.customerEmail || '').trim();
    const payload = {
      customerName: (formValue.fullName || '').trim(),
      phone: (formValue.phone || '').trim(),
      customerEmail: customerEmail || undefined,
      eventDate: eventDateStr,
      deliveryType,
      address: deliveryType === 'delivery' ? (formValue.address || '').trim() : undefined,
      notes: (formValue.notes || '').trim() || undefined,
      items,
      total
    };

    const waLines = [
      'הזמנה חדשה - קייטרינג מגדים',
      `שם: ${payload.customerName}`,
      `טלפון: ${payload.phone}`,
      `סוג מסירה: ${deliveryType === 'delivery' ? 'משלוח' : 'איסוף עצמי'}`,
      ...(payload.eventDate ? [`תאריך אירוע: ${payload.eventDate}`] : []),
      ...(payload.address ? [`כתובת: ${payload.address}`] : []),
      ...(payload.notes ? [`הערות: ${payload.notes}`] : []),
      '',
      'פרטי ההזמנה:',
      ...items.map(i => `• ${i.name} x${i.quantity} - ₪${(i.price * i.quantity).toFixed(2)}`),
      '',
      `סה"כ: ₪${total.toFixed(2)}`
    ];
    const waMessage = waLines.join('\n');

    const phoneFromSettings = (this.settings?.contactPhone || '073-367-8399').replace(/\D/g, '');
    const cleanPhone = phoneFromSettings.startsWith('0') ? '972' + phoneFromSettings.slice(1) : phoneFromSettings.startsWith('972') ? phoneFromSettings : '972' + phoneFromSettings;

    this.http.post<{ success: boolean; message?: string }>(`${environment.apiUrl}/order/send`, payload).subscribe({
      next: () => {
        window.open('https://wa.me/' + cleanPhone + '?text=' + encodeURIComponent(waMessage), '_blank');
        this.cartService.clearCart();
        this.resetCheckoutForm();
        this.closeCart();
        this.snackBar.open('ההזמנה נשלחה למייל ופתחנו את וואטסאפ להשלמה', 'סגור', {
          duration: 4000,
          horizontalPosition: 'start',
          verticalPosition: 'top'
        });
        this.isSubmitting = false;
      },
      error: (err) => {
        console.error('Error sending order email:', err);
        this.snackBar.open(err.error?.message || 'שגיאה בשליחת ההזמנה למייל', 'סגור', {
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
