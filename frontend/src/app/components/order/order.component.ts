import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { OrderService, OrderRequest } from '../../services/order.service';
import { CartService } from '../../services/cart.service';

@Component({
  selector: 'app-order',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatSnackBarModule,
    MatProgressSpinnerModule
  ],
  template: `
    <div class="order-page">
      <div class="container">
        <mat-card class="order-card">
          <mat-card-header>
            <mat-card-title>הזמנה חדשה</mat-card-title>
          </mat-card-header>
          
          <mat-card-content>
            <form [formGroup]="orderForm" (ngSubmit)="onSubmit()">
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>שם מלא</mat-label>
                <input matInput formControlName="customerName" placeholder="הזן שם מלא" required>
                <mat-error *ngIf="orderForm.get('customerName')?.hasError('required')">
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
                <mat-label>אימייל (אופציונלי)</mat-label>
                <input matInput type="email" formControlName="email" placeholder="your@email.com">
                <mat-error *ngIf="orderForm.get('email')?.hasError('email')">
                  אימייל לא תקין
                </mat-error>
              </mat-form-field>

              <mat-form-field appearance="outline" class="full-width">
                <mat-label>כתובת משלוח (אופציונלי)</mat-label>
                <input matInput formControlName="deliveryAddress" placeholder="רחוב, עיר">
              </mat-form-field>

              <mat-form-field appearance="outline" class="full-width">
                <mat-label>תאריך אירוע</mat-label>
                <input matInput [matDatepicker]="picker" formControlName="eventDate" placeholder="בחר תאריך">
                <mat-datepicker-toggle matIconSuffix [for]="picker"></mat-datepicker-toggle>
                <mat-datepicker #picker></mat-datepicker>
              </mat-form-field>

              <mat-form-field appearance="outline" class="full-width">
                <mat-label>סוג אירוע (אופציונלי)</mat-label>
                <input matInput formControlName="eventType" placeholder="חתונה, בר מצווה, וכו'">
              </mat-form-field>

              <mat-form-field appearance="outline" class="full-width">
                <mat-label>מספר אורחים (אופציונלי)</mat-label>
                <input matInput type="number" formControlName="guestCount" placeholder="50" min="1">
              </mat-form-field>

              <mat-form-field appearance="outline" class="full-width">
                <mat-label>הערות (אופציונלי)</mat-label>
                <textarea matInput formControlName="notes" 
                          placeholder="הערות מיוחדות, אלרגיות, או בקשות נוספות..."
                          rows="4"
                          maxlength="500"></textarea>
                <mat-hint align="end">{{ (orderForm.get('notes')?.value || '').length }}/500</mat-hint>
              </mat-form-field>

              <div class="form-actions">
                <button
                  type="submit"
                  mat-raised-button
                  color="primary"
                  [disabled]="orderForm.invalid || isSubmitting || cartItems.length === 0"
                  class="submit-button"
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
  `,
  styles: [`
    .order-page {
      min-height: 80vh;
      padding: 2rem 0;
      background-color: #f5f5f5;
    }

    .container {
      max-width: 800px;
      margin: 0 auto;
      padding: 0 1rem;
    }

    .order-card {
      background-color: white;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    mat-card-header {
      margin-bottom: 1.5rem;
    }

    mat-card-title {
      font-size: 1.75rem;
      font-weight: 600;
      color: #1f3444;
    }

    .full-width {
      width: 100%;
      margin-bottom: 1rem;
    }

    .form-actions {
      margin-top: 2rem;
      display: flex;
      justify-content: flex-end;
    }

    .submit-button {
      min-width: 150px;
    }

    @media (max-width: 768px) {
      .order-page {
        padding: 1rem 0;
      }

      .container {
        padding: 0 0.75rem;
      }

      .submit-button {
        width: 100%;
      }
    }
  `]
})
export class OrderComponent implements OnInit {
  private orderService = inject(OrderService);
  private cartService = inject(CartService);
  private snackBar = inject(MatSnackBar);
  private fb = inject(FormBuilder);

  orderForm!: FormGroup;
  isSubmitting = false;
  cartItems = this.cartService.getCart();

  ngOnInit(): void {
    this.orderForm = this.fb.group({
      customerName: ['', [Validators.required]],
      phone: ['', [Validators.required]],
      email: ['', [Validators.email]],
      deliveryAddress: [''],
      eventDate: [''],
      eventType: [''],
      guestCount: [''],
      notes: ['']
    });
  }

  onSubmit(): void {
    if (this.orderForm.invalid || this.cartItems.length === 0) {
      return;
    }

    this.isSubmitting = true;

    // Convert cart items to order items
    const orderItems = this.cartItems.map(item => ({
      id: item.id,
      name: item.name,
      quantity: item.quantity,
      price: item.price,
      category: item.category
    }));

    // Prepare order request
    const orderRequest: OrderRequest = {
      customerName: this.orderForm.value.customerName,
      phone: this.orderForm.value.phone,
      email: this.orderForm.value.email || undefined,
      items: orderItems,
      deliveryAddress: this.orderForm.value.deliveryAddress || undefined,
      preferredDeliveryTime: this.orderForm.value.eventDate ? this.formatDate(this.orderForm.value.eventDate) : undefined,
      eventDate: this.orderForm.value.eventDate ? this.formatDate(this.orderForm.value.eventDate) : undefined,
      eventType: this.orderForm.value.eventType || undefined,
      guestCount: this.orderForm.value.guestCount ? parseInt(this.orderForm.value.guestCount, 10) : undefined,
      notes: this.orderForm.value.notes || undefined
    };

    // Submit order
    this.orderService.createOrder(orderRequest).subscribe({
      next: (response) => {
        this.isSubmitting = false;
        
        if (response.success) {
          // Show success message
          this.snackBar.open('ההזמנה נשלחה!', 'סגור', {
            duration: 5000,
            horizontalPosition: 'center',
            verticalPosition: 'top',
            direction: 'rtl'
          });

          // Clear cart
          this.cartService.clearCart();

          // Reset form
          this.orderForm.reset();
        } else {
          // Show error message
          this.snackBar.open('שגיאה בשליחת ההזמנה. נסה שוב.', 'סגור', {
            duration: 5000,
            horizontalPosition: 'center',
            verticalPosition: 'top',
            direction: 'rtl',
            panelClass: ['error-snackbar']
          });
        }
      },
      error: (error) => {
        this.isSubmitting = false;
        console.error('Error submitting order:', error);
        
        // Show error message
        const errorMessage = error?.error?.message || 'שגיאה בשליחת ההזמנה. נסה שוב.';
        this.snackBar.open(errorMessage, 'סגור', {
          duration: 5000,
          horizontalPosition: 'center',
          verticalPosition: 'top',
          direction: 'rtl',
          panelClass: ['error-snackbar']
        });
      }
    });
  }

  private formatDate(date: Date | string): string {
    if (!date) return '';
    const d = new Date(date);
    return d.toISOString().split('T')[0]; // YYYY-MM-DD format
  }
}

