import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ToastrService } from 'ngx-toastr';
import { firstValueFrom } from 'rxjs';
import { GalleryService, GalleryItem, CreateGalleryItemRequest } from '../../../services/gallery.service';
import { UploadService } from '../../../services/upload.service';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB — matches backend image upload limit

@Component({
  selector: 'app-gallery-management',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatCardModule,
    MatCheckboxModule,
    MatSnackBarModule
  ],
  templateUrl: './gallery-management.component.html',
  styleUrls: ['./gallery-management.component.scss']
})
export class GalleryManagementComponent implements OnInit {
  galleryService = inject(GalleryService);
  uploadService = inject(UploadService);
  snackBar = inject(MatSnackBar);
  toastr = inject(ToastrService);
  fb = inject(FormBuilder);

  galleryItems: GalleryItem[] = [];
  isLoading = false;
  showAddForm = false;

  selectedFile: File | null = null;
  imagePreview: string | null = null;
  isUploading = false;
  isDragOver = false;
  showManualImageUrl = false;

  readonly dropzoneHint = 'גרור תמונה לכאן או לחץ לבחירה';

  itemForm: FormGroup = this.fb.group({
    title: [''],
    url: [''],
    order: [0],
    isActive: [true]
  });

  ngOnInit(): void {
    this.loadGalleryItems();
  }

  get imageDisplayUrl(): string | null {
    return this.imagePreview || this.itemForm.get('url')?.value?.trim() || null;
  }

  loadGalleryItems(): void {
    this.isLoading = true;
    this.galleryService.getGalleryItems('image', false).subscribe({
      next: (items) => {
        this.galleryItems = items;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading gallery items:', error);
        this.snackBar.open('שגיאה בטעינת פריטי הגלריה', 'סגור', { duration: 3000 });
        this.isLoading = false;
      }
    });
  }

  openAddForm(): void {
    this.showAddForm = true;
    this.resetMediaState();
    this.itemForm.reset({
      title: '',
      url: '',
      order: 0,
      isActive: true
    });
  }

  closeAddForm(): void {
    this.showAddForm = false;
    this.itemForm.reset();
    this.resetMediaState();
  }

  private resetMediaState(): void {
    if (this.imagePreview?.startsWith('blob:')) {
      URL.revokeObjectURL(this.imagePreview);
    }
    this.selectedFile = null;
    this.imagePreview = null;
    this.isUploading = false;
    this.isDragOver = false;
    this.showManualImageUrl = false;
  }

  onImageFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.handleImageFile(file);
    }
    input.value = '';
  }

  onDragOver(event: DragEvent): void {
    if (this.isUploading) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;
  }

  onDrop(event: DragEvent): void {
    if (this.isUploading) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      this.handleImageFile(file);
    }
  }

  onManualImageUrlInput(): void {
    const url = this.itemForm.get('url')?.value?.trim();
    if (url) {
      if (this.imagePreview?.startsWith('blob:')) {
        URL.revokeObjectURL(this.imagePreview);
      }
      this.imagePreview = url;
      this.selectedFile = null;
    }
  }

  private handleImageFile(file: File): void {
    if (!file.type.startsWith('image/')) {
      this.toastr.error('ניתן להעלות תמונות בלבד בדף זה', 'סוג קובץ לא נתמך', {
        positionClass: 'toast-top-left',
        timeOut: 5000
      });
      return;
    }

    if (!ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
      this.toastr.error('ניתן להעלות תמונות בלבד בדף זה', 'JPG, PNG או WebP בלבד', {
        positionClass: 'toast-top-left',
        timeOut: 5000
      });
      return;
    }

    if (file.size > MAX_IMAGE_BYTES) {
      this.toastr.error('גודל הקובץ חורג מ-5MB', 'קובץ גדול מדי', {
        positionClass: 'toast-top-left',
        timeOut: 5000
      });
      return;
    }

    this.selectedFile = file;
    if (this.imagePreview?.startsWith('blob:')) {
      URL.revokeObjectURL(this.imagePreview);
    }
    this.imagePreview = URL.createObjectURL(file);
    this.uploadImageFile(file);
  }

  private uploadImageFile(file: File): void {
    this.isUploading = true;
    this.uploadService.uploadImage(file).subscribe({
      next: (res) => {
        this.isUploading = false;
        if (res.imageUrl) {
          this.itemForm.patchValue({ url: res.imageUrl });
          if (this.imagePreview?.startsWith('blob:')) {
            URL.revokeObjectURL(this.imagePreview);
          }
          this.imagePreview = res.imageUrl;
          this.selectedFile = null;
        }
      },
      error: (err: { message?: string }) => {
        this.isUploading = false;
        this.toastr.error(err?.message || 'שגיאה בהעלאת התמונה', 'שגיאה', {
          positionClass: 'toast-top-left',
          timeOut: 5000
        });
        this.removeImagePreview();
      }
    });
  }

  removeImagePreview(event?: Event): void {
    event?.stopPropagation();
    if (this.imagePreview?.startsWith('blob:')) {
      URL.revokeObjectURL(this.imagePreview);
    }
    this.imagePreview = null;
    this.selectedFile = null;
    this.itemForm.patchValue({ url: '' });
  }

  async saveItem(): Promise<void> {
    const formValue = this.itemForm.getRawValue();

    if (!formValue.url?.trim() && !this.selectedFile && !this.imagePreview) {
      this.snackBar.open('יש להעלות תמונה לפני השמירה', 'סגור', { duration: 3000 });
      return;
    }

    if (this.isUploading) {
      this.snackBar.open('המתן לסיום העלאת התמונה', 'סגור', { duration: 3000 });
      return;
    }

    this.isLoading = true;

    try {
      let finalUrl = formValue.url?.trim() || '';

      if (this.selectedFile && !finalUrl) {
        const uploadResult = await firstValueFrom(this.uploadService.uploadImage(this.selectedFile));
        finalUrl = uploadResult?.imageUrl || '';
      }

      if (!finalUrl) {
        this.snackBar.open('יש להעלות תמונה לפני השמירה', 'סגור', { duration: 3000 });
        this.isLoading = false;
        return;
      }

      const itemData: CreateGalleryItemRequest = {
        title: formValue.title || '',
        type: 'image',
        url: finalUrl,
        thumbnail: '',
        order: formValue.order || 0,
        isActive: formValue.isActive !== false
      };

      this.galleryService.createGalleryItem(itemData).subscribe({
        next: () => {
          this.snackBar.open('תמונת הגלריה נוספה בהצלחה', 'סגור', { duration: 3000 });
          this.closeAddForm();
          this.loadGalleryItems();
        },
        error: (error) => {
          console.error('Error creating gallery item:', error);
          this.snackBar.open('שגיאה בהוספת תמונת הגלריה', 'סגור', { duration: 3000 });
          this.isLoading = false;
        }
      });
    } catch (error) {
      console.error('Error in saveItem:', error);
      this.snackBar.open('שגיאה בשמירת התמונה', 'סגור', { duration: 3000 });
      this.isLoading = false;
    }
  }

  deleteItem(item: GalleryItem): void {
    if (!confirm(`האם אתה בטוח שברצונך למחוק את התמונה "${item.title || item.url}"?`)) {
      return;
    }

    const itemId = item._id || item.id;
    if (!itemId) {
      this.snackBar.open('שגיאה: לא נמצא מזהה לפריט', 'סגור', { duration: 3000 });
      return;
    }

    this.isLoading = true;
    this.galleryService.deleteGalleryItem(itemId).subscribe({
      next: () => {
        this.snackBar.open('התמונה נמחקה בהצלחה', 'סגור', { duration: 3000 });
        this.loadGalleryItems();
      },
      error: (error) => {
        console.error('Error deleting gallery item:', error);
        this.snackBar.open('שגיאה במחיקת התמונה', 'סגור', { duration: 3000 });
        this.isLoading = false;
      }
    });
  }

  toggleActive(item: GalleryItem): void {
    const itemId = item._id || item.id;
    if (!itemId) return;

    this.galleryService.updateGalleryItem(itemId, { isActive: !item.isActive }).subscribe({
      next: () => {
        this.snackBar.open('סטטוס התמונה עודכן', 'סגור', { duration: 2000 });
        this.loadGalleryItems();
      },
      error: (error) => {
        console.error('Error updating gallery item:', error);
        this.snackBar.open('שגיאה בעדכון התמונה', 'סגור', { duration: 3000 });
      }
    });
  }

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    if (img) {
      img.src = '/assets/images/placeholder-dish.jpg';
    }
  }
}
