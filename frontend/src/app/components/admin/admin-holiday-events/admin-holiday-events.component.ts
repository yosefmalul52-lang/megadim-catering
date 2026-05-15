import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { Subject, takeUntil } from 'rxjs';
import { HolidayEvent, HolidayEventService } from '../../../services/holiday-event.service';
import { UploadService } from '../../../services/upload.service';
import { datetimeLocalToIso, formatDeadlineLabel, isoToDatetimeLocal } from '../../../utils/datetime-local.utils';
import {
  getHolidayVisibilityChecks,
  getHolidayVisibilityStatus,
  HolidayVisibilityCheck,
  HolidayVisibilityStatus,
  isHolidayEventLiveOnSite,
  isHolidayProductAvailable
} from '../../../utils/holiday-visibility.utils';
import {
  HolidayProductDialogComponent,
  HolidayProductFormValue
} from './holiday-product-dialog/holiday-product-dialog.component';

const PLACEHOLDER_IMAGE = '/assets/images/placeholder-dish.jpg';

@Component({
  selector: 'app-admin-holiday-events',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, HolidayProductDialogComponent],
  templateUrl: './admin-holiday-events.component.html',
  styleUrls: ['./admin-holiday-events.component.scss']
})
export class AdminHolidayEventsComponent implements OnInit, OnDestroy {
  private holidayEventService = inject(HolidayEventService);
  private uploadService = inject(UploadService);
  private fb = inject(FormBuilder);
  private toastr = inject(ToastrService);
  private destroy$ = new Subject<void>();

  coverImagePreview: string | null = null;
  isUploadingCover = false;

  events: HolidayEvent[] = [];
  selectedId: string | null = null;
  isLoading = true;
  isSaving = false;
  isDeleting = false;

  productModalOpen = false;
  productModalEditing = false;
  productModalInitial: HolidayProductFormValue | null = null;
  private productModalIndex: number | null = null;

  eventForm: FormGroup = this.fb.group({
    name: ['', Validators.required],
    isActive: [false],
    orderDeadline: ['', Validators.required],
    imageUrl: [''],
    products: this.fb.array([])
  });

  ngOnInit(): void {
    this.loadEvents();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get productsArray(): FormArray {
    return this.eventForm.get('products') as FormArray;
  }

  get hasUnsavedChanges(): boolean {
    return this.eventForm.dirty;
  }

  markFormDirty(): void {
    this.eventForm.markAsDirty();
  }

  private extractErrorMessage(err: unknown): string {
    const e = err as { error?: { message?: string } | string; message?: string; status?: number };
    if (e?.error && typeof e.error === 'object' && e.error.message) {
      return e.error.message;
    }
    if (typeof e?.error === 'string' && e.error.trim()) {
      return e.error;
    }
    if (e?.message) return e.message;
    if (e?.status === 0) {
      return 'לא ניתן להתחבר לשרת. ודא שהבקאנד פועל (npm run dev).';
    }
    return 'שגיאה בשמירה — השינויים לא נשמרו';
  }

  private buildSavePayload(): {
    name: string;
    isActive: boolean;
    orderDeadline: string;
    imageUrl: string;
    products: Array<{
      _id?: string;
      title: string;
      price: number;
      description: string;
      imageUrl: string;
      isAvailable: boolean;
    }>;
  } | null {
    const raw = this.eventForm.getRawValue();
    const orderDeadlineIso = datetimeLocalToIso(raw.orderDeadline);
    if (!orderDeadlineIso) {
      this.toastr.warning('תאריך יעד לא תקין', 'שגיאה', { positionClass: 'toast-top-left' });
      return null;
    }

    const products = this.productsArray.controls
      .map((c) => c.getRawValue())
      .filter((p) => (p.name || '').trim())
      .map((p) => ({
        _id: p._id || undefined,
        title: String(p.name).trim(),
        price: Number(p.price) || 0,
        description: (p.description || '').trim(),
        imageUrl: (p.imageUrl || '').trim(),
        isAvailable: p.isAvailable !== false
      }));

    return {
      name: String(raw.name).trim(),
      isActive: !!raw.isActive,
      orderDeadline: orderDeadlineIso,
      imageUrl: (raw.imageUrl || '').trim(),
      products
    };
  }

  loadEvents(): void {
    this.isLoading = true;
    this.holidayEventService
      .list()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (list) => {
          this.events = list;
          this.isLoading = false;
          if (this.selectedId && !list.some((e) => e._id === this.selectedId)) {
            this.selectedId = null;
          }
          if (!this.selectedId && list.length) {
            this.selectEvent(list[0]._id);
          } else if (this.selectedId) {
            const found = list.find((e) => e._id === this.selectedId);
            if (found) this.applyEventToForm(found);
          } else if (!list.length) {
            this.startNewEvent();
          }
        },
        error: (err) => {
          this.isLoading = false;
          this.toastr.error(err?.error?.message || 'שגיאה בטעינת אירועי חג', 'שגיאה', {
            timeOut: 4000,
            positionClass: 'toast-top-left'
          });
        }
      });
  }

  selectEvent(id: string): void {
    const ev = this.events.find((e) => e._id === id);
    if (!ev) return;
    this.selectedId = id;
    this.applyEventToForm(ev);
  }

  startNewEvent(): void {
    this.selectedId = null;
    const d = new Date();
    d.setDate(d.getDate() + 14);
    this.clearProducts();
    this.coverImagePreview = null;
    this.eventForm.reset({
      name: '',
      isActive: false,
      orderDeadline: isoToDatetimeLocal(d),
      imageUrl: ''
    });
  }

  private applyEventToForm(ev: HolidayEvent): void {
    this.clearProducts();
    (ev.products || []).forEach((p) => {
      this.productsArray.push(this.createProductGroup(p));
    });
    const cover = (ev.imageUrl || '').trim();
    this.coverImagePreview = cover || null;
    this.eventForm.patchValue({
      name: ev.name,
      isActive: ev.isActive,
      orderDeadline: isoToDatetimeLocal(ev.orderDeadline),
      imageUrl: cover
    });
    this.eventForm.markAsPristine();
  }

  onCoverImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      this.toastr.warning('סוג קובץ לא נתמך. השתמש ב-JPG, PNG או WebP', 'תמונה', {
        positionClass: 'toast-top-left'
      });
      input.value = '';
      return;
    }

    this.isUploadingCover = true;
    this.uploadService.uploadImage(file).subscribe({
      next: (res) => {
        this.isUploadingCover = false;
        if (res.imageUrl) {
          this.eventForm.patchValue({ imageUrl: res.imageUrl }, { emitEvent: true });
          this.coverImagePreview = res.imageUrl;
          this.markFormDirty();
        }
        input.value = '';
      },
      error: () => {
        this.isUploadingCover = false;
        this.toastr.error('שגיאה בהעלאת תמונה', 'שגיאה', { positionClass: 'toast-top-left' });
        input.value = '';
      }
    });
  }

  removeCoverImagePreview(): void {
    this.eventForm.patchValue({ imageUrl: '' }, { emitEvent: true });
    this.coverImagePreview = null;
    this.markFormDirty();
  }

  private clearProducts(): void {
    while (this.productsArray.length) {
      this.productsArray.removeAt(0);
    }
  }

  createProductGroup(product?: {
    _id?: string;
    title?: string;
    price?: number;
    description?: string;
    imageUrl?: string;
    isAvailable?: boolean;
  }): FormGroup {
    return this.fb.group({
      _id: [product?._id || ''],
      name: [(product?.title || '').trim(), Validators.required],
      price: [product?.price ?? 0, [Validators.required, Validators.min(0)]],
      description: [product?.description || ''],
      imageUrl: [product?.imageUrl || ''],
      isAvailable: [product?.isAvailable !== false]
    });
  }

  openAddProductModal(): void {
    this.productModalIndex = null;
    this.productModalEditing = false;
    this.productModalInitial = {
      name: '',
      price: 0,
      description: '',
      imageUrl: '',
      isAvailable: true
    };
    this.productModalOpen = true;
  }

  openEditProductModal(index: number): void {
    const raw = this.productsArray.at(index).getRawValue();
    this.productModalIndex = index;
    this.productModalEditing = true;
    this.productModalInitial = {
      _id: raw._id || undefined,
      name: raw.name,
      price: raw.price,
      description: raw.description,
      imageUrl: raw.imageUrl,
      isAvailable: raw.isAvailable !== false
    };
    this.productModalOpen = true;
  }

  closeProductModal(): void {
    this.productModalOpen = false;
    this.productModalIndex = null;
    this.productModalInitial = null;
  }

  onProductModalSaved(value: HolidayProductFormValue): void {
    const patch = {
      _id: value._id || '',
      name: value.name,
      price: value.price,
      description: value.description,
      imageUrl: value.imageUrl,
      isAvailable: value.isAvailable
    };
    if (this.productModalIndex != null) {
      this.productsArray.at(this.productModalIndex).patchValue(patch, { emitEvent: true });
      this.productsArray.at(this.productModalIndex).markAsDirty();
    } else {
      this.productsArray.push(this.createProductGroup({
        _id: value._id,
        title: value.name,
        price: value.price,
        description: value.description,
        imageUrl: value.imageUrl,
        isAvailable: value.isAvailable
      }));
    }
    this.markFormDirty();
    this.closeProductModal();
  }

  removeProduct(index: number): void {
    const name = this.productsArray.at(index).get('name')?.value || 'מוצר זה';
    if (!confirm(`למחוק את "${name}"?`)) return;
    this.productsArray.removeAt(index);
    this.markFormDirty();
  }

  productImage(index: number): string {
    const url = this.productsArray.at(index).get('imageUrl')?.value;
    return (url || '').trim() || PLACEHOLDER_IMAGE;
  }

  isProductAvailable(index: number): boolean {
    return this.productsArray.at(index).get('isAvailable')?.value !== false;
  }

  countAvailableProducts(): number {
    return this.productsArray.controls.filter(
      (c) =>
        (c.get('name')?.value || '').trim() &&
        c.get('isAvailable')?.value !== false
    ).length;
  }

  eventProductSummary(ev: HolidayEvent): string {
    const total = ev.products?.length || 0;
    const available = (ev.products || []).filter(
      (p) => (p.title || '').trim() && isHolidayProductAvailable(p)
    ).length;
    return `${available} זמינים / ${total} סה״כ`;
  }

  save(): void {
    if (this.eventForm.invalid) {
      this.eventForm.markAllAsTouched();
      const productErrors = this.productsArray.controls.some((c) => c.invalid);
      this.toastr.warning(
        productErrors
          ? 'יש מוצר עם שדות לא תקינים (שם או מחיר). ערוך את המוצר או מחק אותו.'
          : 'נא למלא את כל השדות החובה',
        'לא ניתן לשמור',
        { positionClass: 'toast-top-left', timeOut: 5000 }
      );
      return;
    }

    const payload = this.buildSavePayload();
    if (!payload) return;

    if (payload.isActive && payload.products.filter((p) => p.isAvailable).length === 0) {
      this.toastr.warning('לא ניתן להפעיל אירוע ללא לפחות מוצר אחד זמין להזמנה', 'נראות באתר', {
        positionClass: 'toast-top-left'
      });
      return;
    }

    this.isSaving = true;
    const isUpdate = !!this.selectedId;
    const req = isUpdate
      ? this.holidayEventService.update(this.selectedId!, payload)
      : this.holidayEventService.create(payload);

    req.pipe(takeUntil(this.destroy$)).subscribe({
      next: (saved) => {
        this.isSaving = false;
        this.selectedId = saved._id;
        this.events = this.events.map((e) => (e._id === saved._id ? saved : e));
        this.applyEventToForm(saved);
        this.toastr.success(
          isUpdate ? 'האירוע עודכן ונשמר במסד הנתונים' : 'האירוע נוצר ונשמר במסד הנתונים',
          'נשמר בהצלחה',
          { timeOut: 3500, positionClass: 'toast-top-left' }
        );
        this.loadEvents();
      },
      error: (err) => {
        this.isSaving = false;
        console.error('Holiday event save failed:', err);
        this.toastr.error(this.extractErrorMessage(err), 'שגיאה בשמירה', {
          timeOut: 6000,
          positionClass: 'toast-top-left'
        });
      }
    });
  }

  deleteSelected(): void {
    if (!this.selectedId) return;
    const name = this.eventForm.get('name')?.value || 'אירוע זה';
    if (!confirm(`למחוק את "${name}"? לא ניתן לשחזר.`)) return;

    this.isDeleting = true;
    this.holidayEventService
      .delete(this.selectedId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.isDeleting = false;
          this.selectedId = null;
          this.startNewEvent();
          this.toastr.success('האירוע נמחק', 'מחיקה', { positionClass: 'toast-top-left' });
          this.loadEvents();
        },
        error: (err) => {
          this.isDeleting = false;
          this.toastr.error(err?.error?.message || 'שגיאה במחיקה', 'שגיאה', {
            positionClass: 'toast-top-left'
          });
        }
      });
  }

  get editorVisibilityChecks(): HolidayVisibilityCheck[] {
    const v = this.eventForm.getRawValue();
    return getHolidayVisibilityChecks({
      isActive: !!v.isActive,
      orderDeadlineLocal: v.orderDeadline || '',
      products: (v.products || []) as Array<{ name?: string; isAvailable?: boolean }>
    });
  }

  get editorVisibilityStatus(): HolidayVisibilityStatus {
    return getHolidayVisibilityStatus(this.editorVisibilityChecks);
  }

  listVisibilityStatus(ev: HolidayEvent): HolidayVisibilityStatus {
    return getHolidayVisibilityStatus(
      getHolidayVisibilityChecks({
        isActive: ev.isActive,
        orderDeadlineLocal: isoToDatetimeLocal(ev.orderDeadline),
        products: (ev.products || []).map((p) => ({ name: p.title, isAvailable: p.isAvailable }))
      })
    );
  }

  isLiveOnSite(ev: HolidayEvent): boolean {
    return isHolidayEventLiveOnSite(ev);
  }

  deadlineLabel(iso: string): string {
    return formatDeadlineLabel(iso);
  }
}
