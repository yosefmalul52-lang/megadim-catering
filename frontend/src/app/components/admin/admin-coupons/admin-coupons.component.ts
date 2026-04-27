import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CouponService, Coupon } from '../../../services/coupon.service';

@Component({
  selector: 'app-admin-coupons',
  standalone: true,
  imports: [CommonModule, DatePipe, ReactiveFormsModule],
  templateUrl: './admin-coupons.component.html',
  styleUrls: ['./admin-coupons.component.scss']
})
export class AdminCouponsComponent implements OnInit {
  private couponService = inject(CouponService);
  private fb = inject(FormBuilder);

  coupons: Coupon[] = [];
  isLoading = true;
  errorMessage = '';
  successMessage = '';
  createForm!: FormGroup;
  isSubmitting = false;
  readonly categoryOptions: Array<{ value: 'all' | 'returning' | 'sleeping' | 'vip'; label: string }> = [
    { value: 'all', label: 'כל הלקוחות' },
    { value: 'returning', label: 'לקוחות חוזרים' },
    { value: 'sleeping', label: 'לקוחות ישנים' },
    { value: 'vip', label: 'לקוחות VIP' }
  ];

  ngOnInit(): void {
    this.createForm = this.fb.group({
      code: ['', [Validators.required]],
      discountType: ['percentage', [Validators.required]],
      discountValue: [10, [Validators.required, Validators.min(0)]],
      minOrderValue: [0, [Validators.required, Validators.min(0)]],
      expiryDate: ['', [Validators.required]],
      maxUses: [100, [Validators.required, Validators.min(1)]],
      isActive: [true],
      isVipOnly: [false],
      targetCustomerCategory: ['all', [Validators.required]]
    });
    this.loadCoupons();
  }

  loadCoupons(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.couponService.getCoupons().subscribe({
      next: (list) => {
        this.coupons = list;
        this.isLoading = false;
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err?.error?.message || 'שגיאה בטעינת הקופונים';
      }
    });
  }

  getDiscountLabel(c: Coupon): string {
    if (c.discountType === 'percentage') return `${c.discountValue}%`;
    return `₪${c.discountValue}`;
  }

  getAudienceLabel(c: Coupon): string {
    const target = c.targetCustomerCategory || 'all';
    if (target === 'returning') return 'לקוחות חוזרים';
    if (target === 'sleeping') return 'לקוחות ישנים';
    if (target === 'vip') return 'לקוחות VIP';
    if (c.isVipOnly) return 'VIP בלבד';
    return 'כללי';
  }

  toggleActive(coupon: Coupon): void {
    this.couponService.updateCoupon(coupon._id, { isActive: !coupon.isActive }).subscribe({
      next: () => {
        coupon.isActive = !coupon.isActive;
        this.showSuccess('הקופון עודכן');
      },
      error: () => this.showError('שגיאה בעדכון הקופון')
    });
  }

  onSubmitCreate(): void {
    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      return;
    }
    const v = this.createForm.value;
    if (v.discountType === 'percentage' && (v.discountValue < 0 || v.discountValue > 100)) {
      this.showError('אחוז הנחה חייב להיות בין 0 ל-100');
      return;
    }
    this.isSubmitting = true;
    this.errorMessage = '';
    this.couponService.createCoupon({
      code: (v.code || '').trim().toUpperCase(),
      discountType: v.discountType,
      discountValue: Number(v.discountValue),
      minOrderValue: Number(v.minOrderValue) || 0,
      expiryDate: v.expiryDate,
      maxUses: Number(v.maxUses) || 1,
      isActive: v.isActive !== false,
      isVipOnly: v.isVipOnly === true,
      targetCustomerCategory: v.targetCustomerCategory || 'all'
    }).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.createForm.reset({
          code: '',
          discountType: 'percentage',
          discountValue: 10,
          minOrderValue: 0,
          expiryDate: '',
          maxUses: 100,
          isActive: true,
          isVipOnly: false,
          targetCustomerCategory: 'all'
        });
        this.loadCoupons();
        this.showSuccess('קופון נוצר בהצלחה');
      },
      error: (err) => {
        this.isSubmitting = false;
        this.showError(err?.error?.message || 'שגיאה ביצירת הקופון');
      }
    });
  }

  isExpired(coupon: Coupon): boolean {
    return new Date(coupon.expiryDate) < new Date();
  }

  private showSuccess(msg: string): void {
    this.successMessage = msg;
    setTimeout(() => (this.successMessage = ''), 3000);
  }

  private showError(msg: string): void {
    this.errorMessage = msg;
    setTimeout(() => (this.errorMessage = ''), 5000);
  }
}
