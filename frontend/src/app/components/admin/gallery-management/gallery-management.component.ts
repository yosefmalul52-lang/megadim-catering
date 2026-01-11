import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCardModule } from '@angular/material/card';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { GalleryService, GalleryItem, CreateGalleryItemRequest } from '../../../services/gallery.service';
import { UploadService } from '../../../services/upload.service';

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
    MatSelectModule,
    MatCardModule,
    MatSnackBarModule
  ],
  templateUrl: './gallery-management.component.html',
  styleUrls: ['./gallery-management.component.scss']
})
export class GalleryManagementComponent implements OnInit {
  galleryService = inject(GalleryService);
  uploadService = inject(UploadService);
  snackBar = inject(MatSnackBar);
  fb = inject(FormBuilder);

  galleryItems: GalleryItem[] = [];
  isLoading = false;
  showAddForm = false;
  selectedFile: File | null = null;
  imagePreview: string | null = null;

  itemForm: FormGroup = this.fb.group({
    title: [''],
    type: ['image', Validators.required],
    url: ['', Validators.required],
    thumbnail: [''],
    order: [0],
    isActive: [true]
  });

  ngOnInit(): void {
    this.loadGalleryItems();
  }

  loadGalleryItems(): void {
    this.isLoading = true;
    this.galleryService.getGalleryItems(undefined, false).subscribe({
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
    this.itemForm.reset({
      type: 'image',
      order: 0,
      isActive: true
    });
    this.selectedFile = null;
    this.imagePreview = null;
  }

  closeAddForm(): void {
    this.showAddForm = false;
    this.itemForm.reset();
    this.selectedFile = null;
    this.imagePreview = null;
  }

  onTypeChange(): void {
    const type = this.itemForm.get('type')?.value;
    if (type === 'video') {
      this.itemForm.get('url')?.setValidators([Validators.required]);
      this.selectedFile = null;
      this.imagePreview = null;
    } else {
      this.itemForm.get('url')?.clearValidators();
      this.itemForm.get('url')?.updateValueAndValidity();
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.selectedFile = input.files[0];
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.imagePreview = e.target.result;
      };
      reader.readAsDataURL(this.selectedFile);
    }
  }

  async saveItem(): Promise<void> {
    if (this.itemForm.invalid) {
      this.snackBar.open('אנא מלא את כל השדות הנדרשים', 'סגור', { duration: 3000 });
      return;
    }

    const formValue = this.itemForm.value;
    this.isLoading = true;

    try {
      let finalUrl = formValue.url;

      // If it's an image and a file was selected, upload it
      if (formValue.type === 'image' && this.selectedFile) {
        try {
          const uploadResult = await this.uploadService.uploadImage(this.selectedFile).toPromise();
          finalUrl = uploadResult?.imageUrl || formValue.url;
        } catch (uploadError) {
          console.error('Upload error:', uploadError);
          this.snackBar.open('שגיאה בהעלאת התמונה', 'סגור', { duration: 3000 });
          this.isLoading = false;
          return;
        }
      }

      // If it's a video, try to extract YouTube ID and generate thumbnail
      let thumbnail = formValue.thumbnail;
      if (formValue.type === 'video' && finalUrl && !thumbnail) {
        const videoId = this.galleryService.extractYouTubeId(finalUrl);
        if (videoId) {
          thumbnail = this.galleryService.generateYouTubeThumbnail(videoId);
        }
      }

      const itemData: CreateGalleryItemRequest = {
        title: formValue.title || '',
        type: formValue.type,
        url: finalUrl,
        thumbnail: thumbnail || '',
        order: formValue.order || 0,
        isActive: formValue.isActive !== false
      };

      this.galleryService.createGalleryItem(itemData).subscribe({
        next: () => {
          this.snackBar.open('פריט הגלריה נוסף בהצלחה', 'סגור', { duration: 3000 });
          this.closeAddForm();
          this.loadGalleryItems();
        },
        error: (error) => {
          console.error('Error creating gallery item:', error);
          this.snackBar.open('שגיאה בהוספת פריט הגלריה', 'סגור', { duration: 3000 });
          this.isLoading = false;
        }
      });
    } catch (error) {
      console.error('Error in saveItem:', error);
      this.snackBar.open('שגיאה בשמירת הפריט', 'סגור', { duration: 3000 });
      this.isLoading = false;
    }
  }

  deleteItem(item: GalleryItem): void {
    if (!confirm(`האם אתה בטוח שברצונך למחוק את הפריט "${item.title || item.url}"?`)) {
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
        this.snackBar.open('פריט הגלריה נמחק בהצלחה', 'סגור', { duration: 3000 });
        this.loadGalleryItems();
      },
      error: (error) => {
        console.error('Error deleting gallery item:', error);
        this.snackBar.open('שגיאה במחיקת פריט הגלריה', 'סגור', { duration: 3000 });
        this.isLoading = false;
      }
    });
  }

  toggleActive(item: GalleryItem): void {
    const itemId = item._id || item.id;
    if (!itemId) return;

    const updates = { isActive: !item.isActive };
    this.galleryService.updateGalleryItem(itemId, updates).subscribe({
      next: () => {
        this.snackBar.open('סטטוס הפריט עודכן', 'סגור', { duration: 2000 });
        this.loadGalleryItems();
      },
      error: (error) => {
        console.error('Error updating gallery item:', error);
        this.snackBar.open('שגיאה בעדכון הפריט', 'סגור', { duration: 3000 });
      }
    });
  }

  getVideoEmbedUrl(url: string): string {
    const videoId = this.galleryService.extractYouTubeId(url);
    if (videoId) {
      return `https://www.youtube.com/embed/${videoId}`;
    }
    return url;
  }

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    if (img) {
      img.src = '/assets/images/placeholder-dish.jpg';
    }
  }
}

