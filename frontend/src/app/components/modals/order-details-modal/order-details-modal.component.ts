import { Component, Input, Output, EventEmitter, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Order, OrderItem } from '../../../services/order.service';
import { CartService } from '../../../services/cart.service';
import { ToastService } from '../../../services/toast.service';

@Component({
  selector: 'app-order-details-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="modal-backdrop" (click)="closeModal()">
      <div class="modal-container" (click)="$event.stopPropagation()">
        <!-- Modal Header -->
        <div class="modal-header">
          <div class="header-info">
            <div class="order-date-header">
              <i class="fas fa-calendar-alt" aria-hidden="true"></i>
              <span>{{ formatDate(order?.createdAt) }}</span>
            </div>
            <div class="order-total-header">
              <span class="total-label">סה"כ הזמנה</span>
              <span class="total-amount">₪{{ order?.totalPrice | number:'1.2-2' }}</span>
            </div>
          </div>
          <button
            type="button"
            class="btn-close"
            (click)="closeModal()"
            [attr.aria-label]="'סגור'"
          >
            <i class="fas fa-times" aria-hidden="true"></i>
          </button>
        </div>

        <!-- Modal Body (Scrollable) -->
        <div class="modal-body">
          <div class="items-list">
            <div
              *ngFor="let item of order?.items; let i = index; trackBy: trackByItemIndex"
              class="item-row"
            >
              <div class="item-checkbox">
                <input
                  type="checkbox"
                  [id]="'item-' + i"
                  [checked]="isItemSelected(item)"
                  (change)="toggleItemSelection(item)"
                />
                <label [for]="'item-' + i"></label>
              </div>
              
              <div class="item-image">
                <img
                  [src]="item.imageUrl || '/assets/images/placeholder-food.jpg'"
                  [alt]="item.name"
                  (error)="handleImageError($event)"
                />
              </div>
              
              <div class="item-details">
                <h3 class="item-name">{{ item.name }}</h3>
                <div class="item-meta">
                  <span class="item-quantity">
                    <i class="fas fa-box" aria-hidden="true"></i>
                    {{ item.quantity }} יח'
                  </span>
                  <span class="item-price">
                    ₪{{ item.price | number:'1.2-2' }} ליחידה
                  </span>
                </div>
                <div class="item-total" *ngIf="item.quantity > 1">
                  סה"כ: ₪{{ (item.price * item.quantity) | number:'1.2-2' }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Modal Footer -->
        <div class="modal-footer">
          <button
            type="button"
            class="btn-add-to-cart"
            (click)="addToCart()"
            [disabled]="selectedItems.size === 0"
          >
            <i class="fas fa-shopping-cart" aria-hidden="true"></i>
            <span>הוסף פריטים נבחרים לעגלה ({{ selectedItems.size }})</span>
          </button>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./order-details-modal.component.scss']
})
export class OrderDetailsModalComponent implements OnInit {
  @Input() order: Order | null = null;
  @Output() close = new EventEmitter<void>();

  private cartService = inject(CartService);
  private toastService = inject(ToastService);

  selectedItems = new Set<OrderItem>();

  ngOnInit(): void {
    // Select all items by default
    if (this.order?.items) {
      this.order.items.forEach(item => {
        this.selectedItems.add(item);
      });
    }
  }

  formatDate(date: string | Date | undefined): string {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('he-IL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  isItemSelected(item: OrderItem): boolean {
    return this.selectedItems.has(item);
  }

  toggleItemSelection(item: OrderItem): void {
    if (this.selectedItems.has(item)) {
      this.selectedItems.delete(item);
    } else {
      this.selectedItems.add(item);
    }
  }

  addToCart(): void {
    if (this.selectedItems.size === 0) {
      this.toastService.warning('אנא בחר לפחות פריט אחד');
      return;
    }

    let addedCount = 0;
    let skippedCount = 0;

    this.selectedItems.forEach(item => {
      // Try to find the ID in all possible MongoDB locations
      const realId = 
        (item as any).product?.id ||         // Populated product.id
        (item as any).product?._id ||        // Populated product._id
        (item as any).productId ||           // Direct productId field
        (item as any)._id ||                 // Direct _id field (MongoDB)
        (item as any).id ||                  // Direct id field
        (item as any).product?.productId || // Nested product.productId
        null;

      if (!realId || realId === '') {
        console.error('❌ Cannot re-order item, ID missing:', {
          item,
          availableFields: Object.keys(item),
          product: (item as any).product ? Object.keys((item as any).product) : 'no product'
        });
        skippedCount++;
        return; // Don't add broken items
      }

      // Create a clean CartItem object with normalized data
      const cartItem = {
        id: String(realId), // Ensure it's a string
        name: item.name || (item as any).product?.name || 'פריט ללא שם',
        price: item.price || 0,
        imageUrl: item.imageUrl || (item as any).product?.imageUrl || (item as any).product?.image || (item as any).image || '',
        description: item.description || (item as any).product?.description || '',
        category: (item as any).category || (item as any).product?.category || undefined
      };

      // Validate the cart item before adding
      if (!cartItem.id || cartItem.id.trim() === '') {
        console.error('❌ Invalid cart item ID after normalization:', cartItem);
        skippedCount++;
        return;
      }

      // Add item to cart using the service
      this.cartService.addItem(cartItem);
      
      // Update quantity to match order quantity
      const quantity = item.quantity || 1;
      if (quantity > 1) {
        this.cartService.updateItemQuantity(cartItem.id, quantity);
      }
      
      addedCount++;
    });

    if (skippedCount > 0) {
      this.toastService.warning(`נוספו ${addedCount} פריטים, ${skippedCount} פריטים נדחו (חסר ID)`);
    } else {
      this.toastService.success(`נוספו ${addedCount} פריטים לעגלה בהצלחה!`);
    }
    
    this.closeModal();
  }

  closeModal(): void {
    this.close.emit();
  }

  trackByItemIndex(index: number): number {
    return index;
  }

  handleImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    if (img) {
      img.src = '/assets/images/placeholder-food.jpg';
    }
  }
}

