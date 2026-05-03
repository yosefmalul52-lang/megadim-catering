import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CouponService, Coupon } from '../../../services/coupon.service';
import { forkJoin } from 'rxjs';

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
  isDeletingSelected = false;
  selectedCouponIds = new Set<string>();
  readonly categoryOptions: Array<{ value: 'all' | 'returning' | 'sleeping' | 'vip' | 'new'; label: string }> = [
    { value: 'all', label: 'כל הלקוחות' },
    { value: 'new', label: 'לקוחות חדשים' },
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
      maxUsesPerCustomer: [1, [Validators.required, Validators.min(1)]],
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
        this.retainExistingSelection();
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
    if (target === 'new') return 'לקוחות חדשים';
    if (target === 'returning') return 'לקוחות חוזרים';
    if (target === 'sleeping') return 'לקוחות ישנים';
    if (target === 'vip') return 'לקוחות VIP';
    if (c.isVipOnly) return 'VIP בלבד';
    return 'כללי';
  }

  getUsageDisplay(c: Coupon): string {
    const currentUses = Number(c.currentUses ?? c.usageCount ?? 0);
    const maxUses = c.maxUses == null ? 'ללא הגבלה' : String(c.maxUses);
    return `${currentUses}/${maxUses}`;
  }

  getExpiryDate(coupon: Coupon): string | null {
    return coupon.expiryDate || coupon.expiresAt || null;
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

  toggleCouponSelection(couponId: string, checked: boolean): void {
    if (!couponId) return;
    if (checked) {
      this.selectedCouponIds.add(couponId);
    } else {
      this.selectedCouponIds.delete(couponId);
    }
  }

  isCouponSelected(couponId: string): boolean {
    return this.selectedCouponIds.has(couponId);
  }

  toggleSelectAll(checked: boolean): void {
    if (checked) {
      for (const c of this.coupons) {
        if (c?._id) this.selectedCouponIds.add(c._id);
      }
      return;
    }
    this.selectedCouponIds.clear();
  }

  get selectedCount(): number {
    return this.selectedCouponIds.size;
  }

  get areAllSelected(): boolean {
    return this.coupons.length > 0 && this.coupons.every((c) => this.selectedCouponIds.has(c._id));
  }

  deleteSelectedCoupons(): void {
    if (this.isDeletingSelected || this.selectedCount === 0) return;
    if (!confirm(`למחוק ${this.selectedCount} קופונים נבחרים?`)) return;

    const selectedIds = Array.from(this.selectedCouponIds);
    this.isDeletingSelected = true;
    this.errorMessage = '';

    forkJoin(selectedIds.map((id) => this.couponService.deleteCoupon(id))).subscribe({
      next: () => {
        this.isDeletingSelected = false;
        this.selectedCouponIds.clear();
        this.showSuccess('הקופונים הנבחרים נמחקו בהצלחה');
        this.loadCoupons();
      },
      error: (err) => {
        this.isDeletingSelected = false;
        this.showError(err?.error?.message || 'שגיאה במחיקת קופונים נבחרים');
      }
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
      maxUsesPerCustomer: Number(v.maxUsesPerCustomer) || 1,
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
          maxUsesPerCustomer: 1,
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
    const expiry = this.getExpiryDate(coupon);
    if (!expiry) return false;
    return new Date(expiry) < new Date();
  }

  private showSuccess(msg: string): void {
    this.successMessage = msg;
    setTimeout(() => (this.successMessage = ''), 3000);
  }

  private showError(msg: string): void {
    this.errorMessage = msg;
    setTimeout(() => (this.errorMessage = ''), 5000);
  }

  private retainExistingSelection(): void {
    if (this.selectedCouponIds.size === 0) return;
    const visibleIds = new Set(this.coupons.map((c) => c._id));
    this.selectedCouponIds.forEach((id) => {
      if (!visibleIds.has(id)) this.selectedCouponIds.delete(id);
    });
  }
}
