import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { UploadService } from '../../../../services/upload.service';

export interface HolidayProductFormValue {
  _id?: string;
  name: string;
  price: number;
  description: string;
  imageUrl: string;
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

  private buildForm(value?: HolidayProductFormValue | null): FormGroup {
    return this.fb.group({
      _id: [value?._id || ''],
      name: [(value?.name || '').trim(), Validators.required],
      price: [value?.price ?? 0, [Validators.required, Validators.min(0)]],
      description: [value?.description || ''],
      imageUrl: [value?.imageUrl || ''],
      isAvailable: [value?.isAvailable !== false]
    });
  }

  private resetForm(value: HolidayProductFormValue | null): void {
    this.productForm = this.buildForm(value);
    this.imagePreviewUrl = value?.imageUrl?.trim() || null;
    this.isDragOver = false;
    this.isUploading = false;
  }

  close(event?: Event): void {
    if (event && (event.target as HTMLElement).classList.contains('modal')) {
      this.closed.emit();
    } else if (!event) {
      this.closed.emit();
    }
  }

  onSubmit(): void {
    if (this.productForm.invalid) {
      this.productForm.markAllAsTouched();
      return;
    }
    const raw = this.productForm.getRawValue();
    this.saved.emit({
      _id: raw._id || undefined,
      name: String(raw.name).trim(),
      price: Number(raw.price) || 0,
      description: (raw.description || '').trim(),
      imageUrl: (raw.imageUrl || '').trim(),
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
