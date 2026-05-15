import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { UploadService } from '../../../../services/upload.service';
import {
  HolidayPricingOption,
  HolidayProductPricingType,
  HolidayProductWeightUnit
} from '../../../../services/holiday-event.service';

export interface HolidayProductFormValue {
  _id?: string;
  name: string;
  price: number;
  description: string;
  imageUrl: string;
  pricingType: HolidayProductPricingType;
  weightUnit: HolidayProductWeightUnit;
  pricingOptions: HolidayPricingOption[];
  isAvailable: boolean;
}

@Component({
  selector: 'app-holiday-product-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './holiday-product-dialog.component.html',
  styleUrls: ['./holiday-product-dialog.component.scss']
})
export class HolidayProductDialogComponent implements OnChanges {
  private fb = inject(FormBuilder);
  private uploadService = inject(UploadService);
  private toastr = inject(ToastrService);

  @Input() open = false;
  @Input() editing = false;
  @Input() initialValue: HolidayProductFormValue | null = null;

  @Output() saved = new EventEmitter<HolidayProductFormValue>();
  @Output() closed = new EventEmitter<void>();

  productForm: FormGroup = this.buildForm();
  imagePreviewUrl: string | null = null;
  isUploading = false;
  isDragOver = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open']?.currentValue || changes['initialValue']) {
      if (this.open) {
        this.resetForm(this.initialValue);
      }
    }
  }

  get pricingOptionsArray(): FormArray {
    return this.productForm.get('pricingOptions') as FormArray;
  }

  get isFixedPricing(): boolean {
    return this.productForm.get('pricingType')?.value !== 'variants';
  }

  private buildForm(value?: HolidayProductFormValue | null): FormGroup {
    const pricingType: HolidayProductPricingType =
      value?.pricingType === 'variants' ? 'variants' : 'fixed';
    return this.fb.group({
      _id: [value?._id || ''],
      name: [(value?.name || '').trim(), Validators.required],
      price: [value?.price ?? 0, [Validators.min(0)]],
      description: [value?.description || ''],
      imageUrl: [value?.imageUrl || ''],
      pricingType: [pricingType],
      weightUnit: [value?.weightUnit === '100g' ? '100g' : 'unit'],
      pricingOptions: this.fb.array(
        (value?.pricingOptions?.length ? value.pricingOptions : [{ label: '', amount: '', price: 0 }]).map(
          (o) => this.createPricingOptionGroup(o)
        )
      ),
      isAvailable: [value?.isAvailable !== false]
    });
  }

  private createPricingOptionGroup(
    option?: Partial<HolidayPricingOption>
  ): FormGroup {
    return this.fb.group({
      label: [(option?.label || '').trim()],
      amount: [String(option?.amount ?? '').trim()],
      price: [option?.price ?? 0, [Validators.min(0)]]
    });
  }

  private resetForm(value: HolidayProductFormValue | null): void {
    this.productForm = this.buildForm(value);
    this.imagePreviewUrl = value?.imageUrl?.trim() || null;
    this.isDragOver = false;
    this.isUploading = false;
    this.updatePricingValidators();
  }

  /** Validate variant rows only in variants mode; fixed price only in fixed mode. */
  private updatePricingValidators(): void {
    const isVariants = this.productForm.get('pricingType')?.value === 'variants';

    this.pricingOptionsArray.controls.forEach((ctrl) => {
      const group = ctrl as FormGroup;
      const label = group.get('label');
      const amount = group.get('amount');
      const price = group.get('price');

      if (isVariants) {
        label?.setValidators([Validators.required]);
        amount?.setValidators([Validators.required]);
        price?.setValidators([Validators.required, Validators.min(0)]);
      } else {
        label?.clearValidators();
        amount?.clearValidators();
        price?.setValidators([Validators.min(0)]);
      }
      label?.updateValueAndValidity({ emitEvent: false });
      amount?.updateValueAndValidity({ emitEvent: false });
      price?.updateValueAndValidity({ emitEvent: false });
    });

    const priceCtrl = this.productForm.get('price');
    if (isVariants) {
      priceCtrl?.clearValidators();
      priceCtrl?.setValidators([Validators.min(0)]);
    } else {
      priceCtrl?.setValidators([Validators.required, Validators.min(0)]);
    }
    priceCtrl?.updateValueAndValidity({ emitEvent: false });
  }

  onPricingTypeChange(): void {
    const type = this.productForm.get('pricingType')?.value;
    if (type === 'variants' && this.pricingOptionsArray.length === 0) {
      this.addPricingOption();
    }
    this.updatePricingValidators();
  }

  addPricingOption(): void {
    this.pricingOptionsArray.push(this.createPricingOptionGroup());
    this.updatePricingValidators();
  }

  removePricingOption(index: number): void {
    if (this.pricingOptionsArray.length <= 1) return;
    this.pricingOptionsArray.removeAt(index);
  }

  close(event?: Event): void {
    if (event && (event.target as HTMLElement).classList.contains('modal')) {
      this.closed.emit();
    } else if (!event) {
      this.closed.emit();
    }
  }

  onSubmit(): void {
    const type = this.productForm.get('pricingType')?.value as HolidayProductPricingType;
    if (type === 'fixed') {
      const price = Number(this.productForm.get('price')?.value);
      if (!Number.isFinite(price) || price < 0) {
        this.productForm.get('price')?.setErrors({ required: true });
      }
    } else if (this.pricingOptionsArray.length === 0) {
      this.addPricingOption();
    }

    if (this.productForm.invalid) {
      this.productForm.markAllAsTouched();
      return;
    }

    const raw = this.productForm.getRawValue();
    const pricingType: HolidayProductPricingType =
      raw.pricingType === 'variants' ? 'variants' : 'fixed';

    let pricingOptions: HolidayPricingOption[] = [];
    if (pricingType === 'variants') {
      pricingOptions = (raw.pricingOptions || [])
        .map((o: HolidayPricingOption) => ({
          label: String(o.label || '').trim(),
          amount: String(o.amount ?? '').trim(),
          price: Number(o.price) || 0
        }))
        .filter((o: HolidayPricingOption) => o.label && o.amount && o.price >= 0);
      if (!pricingOptions.length) {
        this.toastr.warning('הוסף לפחות אפשרות מחיר אחת', 'תמחור', {
          positionClass: 'toast-top-left'
        });
        return;
      }
    }

    this.saved.emit({
      _id: raw._id || undefined,
      name: String(raw.name).trim(),
      price: Number(raw.price) || 0,
      description: (raw.description || '').trim(),
      imageUrl: (raw.imageUrl || '').trim(),
      pricingType,
      weightUnit: raw.weightUnit === '100g' ? '100g' : 'unit',
      pricingOptions,
      isAvailable: !!raw.isAvailable
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.uploadFile(file);
    input.value = '';
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (!this.isUploading) this.isDragOver = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;
    if (this.isUploading) return;
    const file = event.dataTransfer?.files?.[0];
    if (file) this.uploadFile(file);
  }

  private uploadFile(file: File): void {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      this.toastr.warning('סוג קובץ לא נתמך. השתמש ב-JPG, PNG או WebP', 'תמונה', {
        positionClass: 'toast-top-left'
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      this.imagePreviewUrl = (e.target as FileReader).result as string;
    };
    reader.readAsDataURL(file);

    this.isUploading = true;
    this.uploadService.uploadImage(file).subscribe({
      next: (res) => {
        this.isUploading = false;
        if (res.imageUrl) {
          this.productForm.patchValue({ imageUrl: res.imageUrl });
          this.imagePreviewUrl = res.imageUrl;
        }
      },
      error: () => {
        this.isUploading = false;
        this.toastr.error('שגיאה בהעלאת תמונה', 'שגיאה', { positionClass: 'toast-top-left' });
      }
    });
  }

  removeImagePreview(): void {
    this.productForm.patchValue({ imageUrl: '' });
    this.imagePreviewUrl = null;
  }
}
