import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import { CartService, CartItem } from '../../../services/cart.service';
import { AuthService } from '../../../services/auth.service';
import { SiteSettingsService, SiteSettings } from '../../../services/site-settings.service';
import { LocationService } from '../../../services/location.service';
import { DeliveryService } from '../../../services/delivery.service';
import { CouponService } from '../../../services/coupon.service';
import { toYYYYMMDD } from '../../../utils/date.utils';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-checkout-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatFormFieldModule,
    MatInputModule
  ],
  templateUrl: './checkout-page.component.html',
  styleUrls: ['./checkout-page.component.scss']
})
export class CheckoutPageComponent implements OnInit {
  private cartService = inject(CartService);
  private router = inject(Router);
  private http = inject(HttpClient);
  private snackBar = inject(MatSnackBar);
  private fb = inject(FormBuilder);
  private settingsService = inject(SiteSettingsService);
  private locationService = inject(LocationService);
  private deliveryService = inject(DeliveryService);
  private couponService = inject(CouponService);
  private authService = inject(AuthService);

  couponCodeInput = '';
  appliedCouponCode: string | null = null;
  couponDiscount = 0;
  couponError = '';
  couponApplying = false;

  /** Israeli cities from Gov.il API for city autocomplete */
  citiesList: string[] = [];
  /** Filtered subset for dropdown */
  filteredCities: string[] = [];
  /** Whether the city dropdown is visible */
  showDropdown = false;
  private dropdownHideTimeout: ReturnType<typeof setTimeout> | null = null;
  /** Delivery fee from backend (distance-based from מעלה מכמש) */
  deliveryFee = 0;
  /** True when free-shipping threshold applied */
  isDeliveryFree = false;
  /** Original delivery price before free-shipping promo */
  originalDeliveryFee = 0;
  /** Loading state while calculating delivery fee */
  deliveryFeeLoading = false;
  /** True when destination is outside defined delivery area (OUT_OF_RANGE from API) */
  deliveryOutOfRange = false;
  /** User-facing error message from delivery fee API (400 / other errors) */
  deliveryError: string | null = null;

  orderForm!: FormGroup;
  cartItems: CartItem[] = [];
  cartSummary = this.cartService.cartSummary;
  settings: SiteSettings | null = null;
  isSubmitting = false;
  /** Minimum date for event (today + minimumLeadDays); set after settings load */
  minDate: Date = this.getMinDateForLeadDays(2);
  /** Specific dates open for orders (YYYY-MM-DD); from store settings */
  openDates: string[] = [];
  /** Minimum days from today until allowed order date (from store settings) */
  minimumLeadDays = 2;

  private getMinDateForLeadDays(days: number): Date {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), today.getDate() + days);
  }

  /** Filter: only allow dates >= minDate and in openDates list */
  dateFilter = (d: Date | null): boolean => {
    if (!d) return false;
    const pick = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const min = new Date(this.minDate.getFullYear(), this.minDate.getMonth(), this.minDate.getDate());
    const isTooSoon = pick < min;
    const key = toYYYYMMDD(d);
    return !isTooSoon && this.openDates.includes(key);
  };

  ngOnInit(): void {
    this.orderForm = this.fb.group({
      fullName: ['', [Validators.required]],
      phone: ['', [Validators.required]],
      customerEmail: ['', [Validators.required, Validators.email]],
      eventDate: [null, [Validators.required]],
      deliveryType: ['pickup' as 'pickup' | 'delivery', [Validators.required]],
      city: [''],
      streetAddress: [''],
      notes: [''],
      termsAccepted: [false, [Validators.requiredTrue]]
    });

    // Auto-fill checkout form when user has saved profile (phone/address optional at registration)
    this.authService.currentUser$.subscribe((user) => {
      if (!user || !this.orderForm) return;
      this.orderForm.patchValue({
        fullName: user.fullName || user.name || user.username || '',
        phone: user.phone ?? this.orderForm.get('phone')?.value ?? '',
        customerEmail: this.orderForm.get('customerEmail')?.value || user.username || ''
      });
    });
    this.updateAddressValidators();
    this.orderForm.get('deliveryType')?.valueChanges.subscribe(() => {
      this.updateAddressValidators();
      if (this.orderForm.get('deliveryType')?.value !== 'delivery') {
        this.deliveryFee = 0;
        this.isDeliveryFree = false;
        this.originalDeliveryFee = 0;
        this.deliveryFeeLoading = false;
        this.deliveryOutOfRange = false;
        this.deliveryError = null;
        this.orderForm.get('city')?.setValue('');
        this.orderForm.get('streetAddress')?.setValue('');
      }
    });

    this.locationService.getIsraeliCities().subscribe(cities => {
      this.citiesList = cities;
      this.filteredCities = [...cities];
    });
    this.settingsService.getSettings(true).subscribe(s => (this.settings = s));
    this.http.get<{ success: boolean; data: { openDates?: string[]; minimumLeadDays?: number } }>(`${environment.apiUrl}/settings/delivery`).subscribe({
      next: (res) => {
        const data = res?.data;
        if (data?.openDates && Array.isArray(data.openDates)) {
          this.openDates = data.openDates.filter((s): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s));
        } else {
          this.openDates = [];
        }
        const lead = data?.minimumLeadDays;
        if (typeof lead === 'number' && lead >= 0) {
          this.minimumLeadDays = lead;
        }
        this.minDate = this.getMinDateForLeadDays(this.minimumLeadDays);
      }
    });
    this.cartService.cartItems$.subscribe(items => {
      this.cartItems = items;
      this.cartSummary = this.cartService.cartSummary;
    });
  }

  /** Refresh dropdown list when input is focused */
  onCityFocus(): void {
    this.showDropdown = true;
    this.applyCityFilter(this.orderForm.get('city')?.value ?? '');
  }

  /** Filter dropdown options by input text */
  filterCities(event: any): void {
    const value = event?.target?.value;
    this.applyCityFilter(value != null ? String(value) : '');
  }

  private applyCityFilter(term: string): void {
    const t = (term || '').trim();
    if (!t) {
      this.filteredCities = this.citiesList.slice(0, 100);
    } else {
      this.filteredCities = this.citiesList
        .filter(c => c.includes(t))
        .slice(0, 80);
    }
  }

  /** Delay hide so mousedown on a list item registers before blur */
  hideDropdown(): void {
    if (this.dropdownHideTimeout) clearTimeout(this.dropdownHideTimeout);
    this.dropdownHideTimeout = setTimeout(() => {
      this.showDropdown = false;
      this.dropdownHideTimeout = null;
    }, 200);
  }

  /** Set city, trigger fee calculation, close dropdown */
  selectCity(city: string): void {
    this.orderForm.get('city')?.setValue(city);
    this.orderForm.get('city')?.markAsTouched();
    this.showDropdown = false;
    if (this.dropdownHideTimeout) {
      clearTimeout(this.dropdownHideTimeout);
      this.dropdownHideTimeout = null;
    }
    this.onCitySelected();
  }

  /** Called when user selects or enters a city; fetches delivery fee from backend. Prevents empty requests on blur. */
  onCitySelected(event?: any): void {
    const cityValue =
      (event?.target?.value !== undefined && event?.target?.value !== null
        ? event.target.value
        : this.orderForm.get('city')?.value) ?? '';
    if (
      !cityValue ||
      typeof cityValue !== 'string' ||
      cityValue.trim() === ''
    ) {
      this.deliveryFee = 0;
      this.isDeliveryFree = false;
      this.originalDeliveryFee = 0;
      this.deliveryError = null;
      this.deliveryOutOfRange = false;
      return;
    }
    const city = cityValue.trim();
    // cartTotal must be subtotal before delivery; ensure it's a number (sometimes becomes string/undefined)
    const cartTotal = Number(this.cartSummary.totalPrice ?? 0) || 0;
    this.deliveryFeeLoading = true;
    this.deliveryOutOfRange = false;
    this.deliveryError = null;
    this.deliveryService.calculateFee(city, cartTotal).subscribe({
      next: (res) => {
        this.deliveryFee = res.price;
        this.isDeliveryFree = res.isFree === true;
        this.originalDeliveryFee = res.originalPrice ?? res.price;
        this.deliveryFeeLoading = false;
        this.deliveryOutOfRange = false;
        this.deliveryError = null;
      },
      error: (err) => {
        this.deliveryFee = 0;
        this.isDeliveryFree = false;
        this.originalDeliveryFee = 0;
        this.deliveryFeeLoading = false;
        if (err.status === 400 && err.error?.code === 'OUT_OF_RANGE') {
          this.deliveryOutOfRange = true;
          this.deliveryError =
            err.error?.error || 'היעד מחוץ לאזור החלוקה הרגיל. אנא צרו קשר לתיאום טלפוני.';
        } else {
          this.deliveryError =
            (err.error && typeof err.error === 'object' && err.error.error)
              ? String(err.error.error)
              : 'שגיאה בחישוב דמי המשלוח. אנא נסו שנית.';
        }
        console.error('Delivery calculation failed:', err);
      }
    });
  }

  /** Cart total + delivery fee when delivery selected (0 if out of range), minus coupon discount if applied. */
  get grandTotal(): number {
    const base = this.cartSummary.totalPrice ?? 0;
    const isDelivery = this.orderForm?.get('deliveryType')?.value === 'delivery';
    const fee = this.deliveryOutOfRange ? 0 : this.deliveryFee;
    const beforeCoupon = base + (isDelivery ? fee : 0);
    if (this.appliedCouponCode && this.couponDiscount > 0) {
      return Math.max(0, Math.round((beforeCoupon - this.couponDiscount) * 100) / 100);
    }
    return beforeCoupon;
  }

  applyCoupon(): void {
    const code = (this.couponCodeInput || '').trim();
    if (!code) {
      this.snackBar.open('הזן קוד קופון', 'סגור', { duration: 2000, horizontalPosition: 'start', verticalPosition: 'top' });
      return;
    }
    const base = this.cartSummary.totalPrice ?? 0;
    const isDelivery = this.orderForm?.get('deliveryType')?.value === 'delivery';
    const fee = this.deliveryOutOfRange ? 0 : this.deliveryFee;
    const cartTotal = base + (isDelivery ? fee : 0);
    this.couponError = '';
    this.couponApplying = true;
    this.couponService.applyCoupon(code, cartTotal).subscribe({
      next: (res) => {
        this.couponApplying = false;
        if (res.success && res.discountAmount != null && res.newTotal != null) {
          this.appliedCouponCode = code;
          this.couponDiscount = res.discountAmount;
          this.couponError = '';
          this.snackBar.open('הקופון הוחל בהצלחה', 'סגור', { duration: 2500, horizontalPosition: 'start', verticalPosition: 'top' });
        } else {
          this.couponError = res.message || 'קוד קופון לא תקין או פג תוקף';
        }
      },
      error: (err) => {
        this.couponApplying = false;
        this.appliedCouponCode = null;
        this.couponDiscount = 0;
        this.couponError = err?.error?.message || 'קוד קופון לא תקין או פג תוקף';
      }
    });
  }

  removeCoupon(): void {
    this.appliedCouponCode = null;
    this.couponDiscount = 0;
    this.couponError = '';
    this.couponCodeInput = '';
  }

  /** Submit disabled when delivery selected but destination is out of range */
  get isSubmitDisabled(): boolean {
    return this.orderForm?.invalid || this.isSubmitting || (this.orderForm?.get('deliveryType')?.value === 'delivery' && this.deliveryOutOfRange);
  }

  private updateAddressValidators(): void {
    const cityControl = this.orderForm.get('city');
    const streetControl = this.orderForm.get('streetAddress');
    if (!cityControl || !streetControl) return;
    if (this.orderForm.get('deliveryType')?.value === 'delivery') {
      cityControl.setValidators([Validators.required]);
      streetControl.setValidators([Validators.required]);
    } else {
      cityControl.clearValidators();
      streetControl.clearValidators();
    }
    cityControl.updateValueAndValidity();
    streetControl.updateValueAndValidity();
  }

  placeOrder(): void {
    if (this.cartItems.length === 0) {
      this.snackBar.open('העגלה ריקה', 'סגור', { duration: 3000, horizontalPosition: 'start', verticalPosition: 'top' });
      return;
    }
    if (this.orderForm.invalid) {
      this.orderForm.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    const formValue = this.orderForm.value;
    const deliveryMethod = (formValue.deliveryType === 'delivery' ? 'delivery' : 'pickup') as 'delivery' | 'pickup';
    const eventDateStr = formValue.eventDate ? this.formatDate(formValue.eventDate) : undefined;
    const summary = this.cartService.cartSummary;
    const subtotal = summary.totalPrice ?? 0;
    const deliveryFee = deliveryMethod === 'delivery' ? this.deliveryFee : 0;
    const totalAmount = this.grandTotal;
    const items = summary.items.map(i => ({
      id: i.id,
      name: i.name,
      quantity: i.quantity,
      price: i.price,
      ...(i.category ? { category: i.category } : {}),
      ...(i.imageUrl ? { imageUrl: i.imageUrl } : {})
    }));

    const address =
      deliveryMethod === 'delivery' && (formValue.city || formValue.streetAddress)
        ? {
            city: (formValue.city || '').trim(),
            street: (formValue.streetAddress || '').trim(),
            apartment: ''
          }
        : undefined;

    const currentUser = this.authService.currentUser;
    const orderData = {
      ...formValue,
      customerName: (formValue.fullName || '').trim(),
      email: (formValue.customerEmail || '').trim() || undefined,
      phone: (formValue.phone || '').trim(),
      address,
      deliveryMethod,
      eventDate: eventDateStr,
      items,
      subtotal,
      deliveryFee,
      totalAmount: this.grandTotal,
      notes: (formValue.notes || '').trim() || undefined,
      ...(this.appliedCouponCode ? { couponCode: this.appliedCouponCode } : {}),
      ...(currentUser?.id ? { userId: currentUser.id } : {})
    };

    this.http
      .post<{ success: boolean; orderId: string; order?: unknown }>(`${environment.apiUrl}/orders`, orderData)
      .subscribe({
        next: (res) => {
          this.cartService.clearCart();
          this.orderForm.reset({
            deliveryType: 'pickup',
            city: '',
            streetAddress: '',
            fullName: '',
            phone: '',
            customerEmail: '',
            eventDate: null,
            notes: ''
          });
          this.deliveryFee = 0;
          this.removeCoupon();
          this.isSubmitting = false;
          this.snackBar.open('ההזמנה התקבלה בהצלחה', 'סגור', {
            duration: 3000,
            horizontalPosition: 'start',
            verticalPosition: 'top'
          });
          this.router.navigate(
            ['/order-confirmation', res.orderId],
            { state: { order: (res as any).order } }
          );
        },
        error: (err) => {
          console.error('Error placing order:', err);
          this.snackBar.open(
            err.error?.message || err.error?.error || 'שגיאה בשליחת ההזמנה. נסו שוב.',
            'סגור',
            { duration: 5000, horizontalPosition: 'start', verticalPosition: 'top' }
          );
          this.isSubmitting = false;
        }
      });
  }

  private formatDate(date: Date | string | null): string {
    if (!date) return '';
    const d = typeof date === 'string' ? new Date(date) : new Date(date);
    if (isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  trackByItemId(_index: number, item: CartItem): string {
    return item.id;
  }

  /** Removes duplicated size from item name, e.g. "250 מ\"ל - 250" → "250 מ\"ל" */
  cleanItemName(name: string): string {
    if (!name) return '';
    let s = name.replace(/\s*-\s*\d+\s*\)/g, ')');
    s = s.replace(/\s*-\s*\d+\s*$/, '').trim();
    return s;
  }
}
