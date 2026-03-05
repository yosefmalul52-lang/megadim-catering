import { Component, inject, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule } from '@angular/forms';
import { OrderService } from '../../../services/order.service';

@Component({
  selector: 'app-manual-order-builder',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './manual-order-builder.component.html',
  styleUrls: ['./manual-order-builder.component.scss']
})
export class ManualOrderBuilderComponent {
  private fb = inject(FormBuilder);
  private orderService = inject(OrderService);

  @Output() back = new EventEmitter<void>();
  @Output() orderCreated = new EventEmitter<void>();

  form: FormGroup;
  isSubmitting = false;
  errorMessage = '';

  constructor() {
    this.form = this.fb.group({
      customerName: ['', Validators.required],
      phone: ['', Validators.required],
      email: [''],
      eventDate: [null, Validators.required],
      deliveryMethod: ['pickup', Validators.required],
      city: [''],
      street: [''],
      apartment: [''],
      totalAmount: [0, [Validators.required, Validators.min(0)]],
      paymentStatus: ['unpaid', Validators.required],
      adminNotes: [''],
      items: this.fb.array([this.createItemRow()])
    });

    this.form.get('deliveryMethod')?.valueChanges.subscribe((method: string) => {
      const city = this.form.get('city');
      const street = this.form.get('street');
      if (method === 'delivery') {
        city?.setValidators([Validators.required]);
        street?.setValidators([Validators.required]);
      } else {
        city?.clearValidators();
        street?.clearValidators();
      }
      city?.updateValueAndValidity();
      street?.updateValueAndValidity();
    });
  }

  get items(): FormArray {
    return this.form.get('items') as FormArray;
  }

  get isDelivery(): boolean {
    return this.form.get('deliveryMethod')?.value === 'delivery';
  }

  createItemRow(): FormGroup {
    return this.fb.group({
      productName: ['', Validators.required],
      quantity: [1, [Validators.required, Validators.min(1)]],
      price: [0, [Validators.required, Validators.min(0)]]
    });
  }

  addItem(): void {
    this.items.push(this.createItemRow());
  }

  removeItem(index: number): void {
    if (this.items.length > 1) this.items.removeAt(index);
  }

  get computedSubtotal(): number {
    return this.items.controls.reduce((sum, ctrl) => {
      const q = ctrl.get('quantity')?.value ?? 0;
      const p = ctrl.get('price')?.value ?? 0;
      return sum + Number(q) * Number(p);
    }, 0);
  }

  applySubtotalToTotal(): void {
    this.form.get('totalAmount')?.setValue(this.computedSubtotal);
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.value;
    const deliveryMethod = v.deliveryMethod as 'delivery' | 'pickup';
    const address =
      deliveryMethod === 'delivery' && (v.city || v.street)
        ? {
            city: (v.city || '').trim(),
            street: (v.street || '').trim(),
            apartment: (v.apartment || '').trim()
          }
        : undefined;

    const subtotal = this.computedSubtotal;
    const totalAmount = Number(v.totalAmount) ?? subtotal;
    const deliveryFee = 0;

    const items = (v.items as Array<{ productName: string; quantity: number; price: number }>).map((item, i) => ({
      id: `manual-${i}-${Date.now()}`,
      name: (item.productName || '').trim(),
      quantity: Number(item.quantity) || 1,
      price: Number(item.price) || 0
    })).filter(item => item.name);

    if (items.length === 0) {
      this.errorMessage = 'יש להוסיף לפחות פריט אחד';
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';

    this.orderService
      .createManualOrder({
        customerName: (v.customerName || '').trim(),
        phone: (v.phone || '').trim(),
        email: (v.email || '').trim() || undefined,
        address,
        deliveryMethod,
        eventDate: v.eventDate ? this.formatDate(v.eventDate) : undefined,
        items,
        subtotal,
        deliveryFee,
        totalAmount,
        notes: (v.adminNotes || '').trim() || undefined,
        paymentStatus: v.paymentStatus as 'paid' | 'unpaid'
      })
      .subscribe({
        next: () => {
          this.orderCreated.emit();
        },
        error: (err: { error?: { message?: string }; message?: string }) => {
          this.isSubmitting = false;
          this.errorMessage = err?.error?.message || err?.message || 'שגיאה בשמירת ההזמנה';
        }
      });
  }

  private formatDate(d: Date | string): string {
    const x = typeof d === 'string' ? new Date(d) : d;
    const y = x.getFullYear();
    const m = String(x.getMonth() + 1).padStart(2, '0');
    const day = String(x.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  goBack(): void {
    this.back.emit();
  }
}
