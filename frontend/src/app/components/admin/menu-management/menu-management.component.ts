import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { MenuService, MenuItem, PriceVariant } from '../../../services/menu.service';
import { UploadService } from '../../../services/upload.service';

@Component({
  selector: 'app-menu-management',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  template: `
    <div class="menu-management">
      <div class="container">
        <div class="header">
          <button class="btn-add" (click)="openAddModal()">
            <i class="fas fa-plus"></i>
            הוסף כרטיסייה חדשה
          </button>
        </div>

        <!-- Category Filter -->
        <div class="category-filter">
          <label>קטגוריה:</label>
          <select [(ngModel)]="selectedCategory" (change)="filterByCategory()">
            <option value="">כל הקטגוריות</option>
            <option *ngFor="let cat of categories" [value]="cat.name">{{ cat.name }}</option>
          </select>
        </div>

        <!-- Menu Items Table - Grouped by Category -->
        <div class="menu-items-table" *ngIf="!isLoading">
          <div class="table-header-info" *ngIf="filteredItems.length > 0">
            <span>
              <i class="fas fa-list"></i>
              סה"כ כרטיסיות: {{ filteredItems.length }}
              <span class="info-note">(לחץ על "ערוך" כדי לערוך כל כרטיסייה)</span>
            </span>
          </div>
          
          <!-- Grouped by Category -->
          <div *ngIf="filteredItems.length > 0" class="categories-container">
            <div *ngFor="let categoryGroup of itemsByCategory" class="category-section">
              <div class="category-header">
                <h2 class="category-title">
                  <i class="fas fa-folder"></i>
                  {{ categoryGroup.category }}
                  <span class="category-count">({{ categoryGroup.items.length }})</span>
                </h2>
              </div>
              
              <!-- Modern List Layout -->
              <div class="items-list">
                <div *ngFor="let item of categoryGroup.items; trackBy: trackByItemId" class="item-row">
                  <!-- Image Thumbnail -->
                  <div class="item-image">
                    <img [src]="item.imageUrl || '/assets/images/placeholder-dish.jpg'" 
                         [alt]="item.name" 
                         class="item-thumbnail" 
                         (error)="onImageError($event)"
                         loading="lazy"
                         [attr.data-item-id]="item.id">
                  </div>
                  
                  <!-- Item Details -->
                  <div class="item-info">
                    <div class="item-header">
                      <h3 class="item-name">{{ item.name }}</h3>
                      <div class="item-badges">
                        <span *ngIf="item.isPopular" class="badge badge-popular">⭐ מומלץ</span>
                        <span *ngIf="item.isAvailable === false" class="badge badge-unavailable">לא זמין</span>
                      </div>
                    </div>
                    
                    <p class="item-description" *ngIf="item.description && item.description.trim()">
                      {{ item.description }}
                    </p>
                    <p class="item-description no-description" *ngIf="!item.description || !item.description.trim()">
                      <i class="fas fa-info-circle"></i>
                      אין תיאור
                    </p>
                    
                    <div class="item-meta">
                      <div class="item-price">
                        <!-- Display pricing variants if available -->
                        <div *ngIf="hasPricingVariants(item)" class="price-variants">
                          <div *ngFor="let variant of getPricingVariants(item)" class="price-variant-badge">
                            <span class="variant-size">{{ variant.label }}</span>
                            <span class="variant-price">₪{{ variant.price | number:'1.2-2' }}</span>
                          </div>
                        </div>
                        <!-- Fallback to single price if no variants -->
                        <span *ngIf="!hasPricingVariants(item) && item.price !== undefined && item.price !== null" class="single-price">
                          ₪{{ item.price | number:'1.2-2' }}
                        </span>
                        <span *ngIf="!hasPricingVariants(item) && (item.price === undefined || item.price === null)" class="no-price">
                          <i class="fas fa-exclamation-circle"></i>
                          אין מחיר
                        </span>
                      </div>
                      
                      <div class="item-toggles">
                        <label class="toggle-switch" [title]="item.isAvailable !== false ? 'זמין - לחץ לביטול' : 'לא זמין - לחץ להפעלה'">
                          <input 
                            type="checkbox" 
                            [checked]="item.isAvailable !== false"
                            (change)="toggleStatus(item, 'isAvailable', $event)"
                            [attr.aria-label]="'מלאי עבור ' + item.name"
                          >
                          <span class="toggle-slider"></span>
                          <span class="toggle-label" [class.active]="item.isAvailable !== false">{{ item.isAvailable !== false ? 'מוצג' : 'מוסתר' }}</span>
                        </label>
                        
                        <label class="toggle-switch" [title]="item.isPopular ? 'מומלץ - לחץ לביטול' : 'לא מומלץ - לחץ להפוך למומלץ'">
                          <input 
                            type="checkbox" 
                            [checked]="item.isPopular === true"
                            (change)="toggleStatus(item, 'isPopular', $event)"
                            [attr.aria-label]="'מומלץ עבור ' + item.name"
                          >
                          <span class="toggle-slider"></span>
                          <span class="toggle-label" [class.active]="item.isPopular === true">{{ item.isPopular ? 'מוצג' : 'מוסתר' }}</span>
                        </label>
                      </div>
                    </div>
                  </div>
                  
                  <!-- Actions -->
                  <div class="item-actions">
                    <button class="btn-action btn-edit" (click)="openEditModal(item)" 
                            data-tooltip="ערוך פרטים"
                            type="button"
                            [attr.aria-label]="'ערוך ' + item.name">
                      <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-action btn-delete" (click)="deleteItem(item.id || item._id || '')" 
                            data-tooltip="מחק מנה"
                            type="button"
                            [attr.aria-label]="'מחק ' + item.name">
                      <i class="fas fa-trash"></i>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Empty State -->
          <div *ngIf="!isLoading && filteredItems.length === 0" class="empty-state">
            <i class="fas fa-inbox"></i>
            <p>אין פריטים להצגה</p>
            <button class="btn-add-small" (click)="openAddModal()">
              <i class="fas fa-plus"></i>
              הוסף כרטיסייה ראשונה
            </button>
          </div>
        </div>

        <!-- Add/Edit Modal -->
        <div class="modal" *ngIf="showModal" (click)="closeModal($event)">
          <div class="modal-content" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h2>{{ editingItem ? 'ערוך כרטיסייה' : 'הוסף כרטיסייה חדשה' }}</h2>
              <button class="btn-close" (click)="closeModal()" data-tooltip="סגור">
                <i class="fas fa-times"></i>
              </button>
            </div>

            <form [formGroup]="itemForm" (ngSubmit)="saveItem()" class="modal-body">
              <!-- 2-Column Grid Layout -->
              <div class="form-grid">
                <!-- Left Column: Image Upload -->
                <div class="form-column form-column-image">
                  <div class="form-group">
                    <label>תמונה</label>
                    <!-- Styled Upload Box -->
                    <div class="image-upload-box" 
                         [class.has-image]="imagePreviewUrl"
                         [class.uploading]="isUploading">
                      <!-- Hidden File Input -->
                      <input 
                        type="file" 
                        id="imageUpload"
                        accept="image/jpeg,image/jpg,image/png,image/webp"
                        (change)="onFileSelected($event)"
                        [disabled]="isUploading"
                      >
                      
                      <!-- Upload Box Content -->
                      <div class="upload-box-content" *ngIf="!imagePreviewUrl">
                        <div class="upload-icon">
                          <i class="fas" [ngClass]="isUploading ? 'fa-spinner fa-spin' : 'fa-camera'"></i>
                        </div>
                        <p class="upload-text">{{ isUploading ? 'מעלה תמונה...' : 'לחץ להעלאת תמונה' }}</p>
                        <p class="upload-hint">או גרור קובץ לכאן</p>
                      </div>
                      
                      <!-- Image Preview -->
                      <div class="upload-preview" *ngIf="imagePreviewUrl">
                        <img [src]="imagePreviewUrl" alt="תצוגה מקדימה">
                        <button type="button" class="btn-remove-preview" (click)="removeImagePreview()" title="הסר תמונה">
                          <i class="fas fa-times"></i>
                        </button>
                      </div>
                    </div>
                    
                    <!-- Manual URL Input (Fallback) -->
                    <div class="manual-url-input">
                      <label>או הזן כתובת תמונה (URL)</label>
                      <input type="text" formControlName="imageUrl" placeholder="https://... או /assets/images/...">
                      <small>הזן נתיב לתמונה או URL</small>
                    </div>
                  </div>
                </div>
                
                <!-- Right Column: Form Fields -->
                <div class="form-column form-column-fields">
                  <div class="form-group">
                    <label>שם הכרטיסייה *</label>
                    <input type="text" formControlName="name" required class="form-input">
                  </div>

                  <div class="form-group">
                    <label>קטגוריה *</label>
                    <select formControlName="category" required class="form-input">
                      <option value="">בחר קטגוריה</option>
                      <option *ngFor="let cat of categories" [value]="cat.name">{{ cat.name }}</option>
                    </select>
                  </div>

                  <div class="form-group">
                    <label>תיאור</label>
                    <textarea formControlName="description" rows="3" class="form-input"></textarea>
                  </div>

                  <div class="form-group">
                    <label>מחיר</label>
                    <div class="pricing-options">
                      <div class="pricing-option">
                        <label>
                          <input type="radio" [value]="'single'" formControlName="pricingType" (change)="onPricingTypeChange()">
                          מחיר יחיד
                        </label>
                        <input *ngIf="itemForm.get('pricingType')?.value === 'single'" 
                               type="number" 
                               formControlName="price" 
                               step="0.01" 
                               min="0" 
                               placeholder="₪0.00"
                               class="price-input form-input">
                      </div>
                      <div class="pricing-option">
                        <label>
                          <input type="radio" [value]="'variants'" formControlName="pricingType" (change)="onPricingTypeChange()">
                          מחירים לפי גודל (Legacy)
                        </label>
                        <div *ngIf="itemForm.get('pricingType')?.value === 'variants'" class="variants-container">
                          <div *ngFor="let variant of pricingVariantsFormArray.controls; let i = index" 
                               class="variant-row" 
                               [formGroup]="$any(variant)">
                            <input type="text" formControlName="label" placeholder="גודל (למשל: 250 גרם)" class="variant-label form-input">
                            <input type="number" formControlName="price" step="0.01" min="0" placeholder="מחיר" class="variant-price-input form-input">
                            <button type="button" class="btn-remove-variant" (click)="removePricingVariant(i)" *ngIf="pricingVariantsFormArray.length > 1">
                              <i class="fas fa-times"></i>
                            </button>
                          </div>
                          <button type="button" class="btn-add-variant" (click)="addPricingVariant()">
                            <i class="fas fa-plus"></i>
                            הוסף גודל
                          </button>
                        </div>
                      </div>
                      <div class="pricing-option">
                        <label>
                          <input type="radio" [value]="'options'" formControlName="pricingType" (change)="onPricingTypeChange()">
                          אפשרויות מחיר (Label, Amount, Price)
                        </label>
                        <div *ngIf="itemForm.get('pricingType')?.value === 'options'" class="options-container">
                          <div *ngFor="let option of pricingOptionsFormArray.controls; let i = index" 
                               class="option-row" 
                               [formGroup]="$any(option)">
                            <input type="text" formControlName="label" placeholder="תווית (למשל: Small Tray)" class="option-label form-input">
                            <input type="text" formControlName="amount" placeholder="כמות (למשל: 10 people)" class="option-amount form-input">
                            <input type="number" formControlName="price" step="0.01" min="0" placeholder="מחיר" class="option-price-input form-input">
                            <button type="button" class="btn-remove-option" (click)="removePricingOption(i)" *ngIf="pricingOptionsFormArray.length > 1">
                              <i class="fas fa-times"></i>
                            </button>
                          </div>
                          <button type="button" class="btn-add-option" (click)="addPricingOption()">
                            <i class="fas fa-plus"></i>
                            הוסף אפשרות
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div class="form-group">
                    <label>תגיות (מופרדות בפסיק)</label>
                    <input type="text" formControlName="tags" placeholder="תגית1, תגית2" class="form-input">
                  </div>

                  <!-- Recipe Section -->
                  <div class="form-group recipe-section">
                    <label class="recipe-label">
                      <i class="fas fa-utensils"></i>
                      מתכון (רשימת חומרי גלם)
                    </label>
                    <div class="recipe-list" formArrayName="recipe">
                      <div *ngFor="let ingredient of recipeFormArray.controls; let i = index" 
                           [formGroupName]="i" 
                           class="recipe-item">
                        <input type="text" formControlName="name" placeholder="שם חומר גלם" class="recipe-input">
                        <input type="number" formControlName="quantity" step="0.01" min="0" placeholder="כמות" class="recipe-input recipe-quantity">
                        <input type="text" formControlName="unit" placeholder="יחידה (ק״ג, גרם, חבילה)" class="recipe-input recipe-unit">
                        <select formControlName="category" class="recipe-input recipe-category">
                          <option value="">בחר קטגוריה</option>
                          <option value="Fish">דגים</option>
                          <option value="Meat">בשר</option>
                          <option value="Vegetables">ירקות</option>
                          <option value="Dry Goods">מוצרים יבשים</option>
                          <option value="Spices">תבלינים</option>
                          <option value="Dairy">מוצרי חלב</option>
                          <option value="Other">אחר</option>
                        </select>
                        <button type="button" class="btn-remove-ingredient" (click)="removeIngredient(i)" *ngIf="recipeFormArray.length > 0">
                          <i class="fas fa-times"></i>
                        </button>
                      </div>
                    </div>
                    <button type="button" class="btn-add-ingredient" (click)="addIngredient()">
                      <i class="fas fa-plus"></i>
                      הוסף חומר גלם
                    </button>
                  </div>

                  <div class="form-group checkbox-group">
                    <label>
                      <input type="checkbox" formControlName="isAvailable">
                      זמין להזמנה
                    </label>
                    <label>
                      <input type="checkbox" formControlName="isPopular">
                      מומלץ
                    </label>
                  </div>
                </div>
              </div>

              <div class="form-actions">
                <button type="button" class="btn-cancel" (click)="closeModal()" data-tooltip="ביטול שינויים">ביטול</button>
                <button type="submit" class="btn-save" [disabled]="!itemForm.valid" [attr.data-tooltip]="editingItem ? 'עדכן פרטים' : 'שמור מנה חדשה'">
                  {{ editingItem ? 'עדכן' : 'שמור' }}
                </button>
              </div>
            </form>
          </div>
        </div>

        <!-- Loading/Error Messages -->
        <div *ngIf="isLoading" class="loading">
          <i class="fas fa-spinner fa-spin"></i>
          טוען פריטי תפריט...
        </div>
        <div *ngIf="errorMessage" class="error-message">
          <i class="fas fa-exclamation-circle"></i>
          {{ errorMessage }}
        </div>
        <div *ngIf="successMessage" class="success-message">
          <i class="fas fa-check-circle"></i>
          {{ successMessage }}
        </div>
        
        <!-- Debug Info -->
        <div *ngIf="!isLoading && menuItems.length === 0 && !errorMessage" class="info-message">
          <i class="fas fa-info-circle"></i>
          <div>
            <p><strong>לא נמצאו פריטי תפריט.</strong></p>
            <p>לחץ על "הוסף כרטיסייה חדשה" כדי להתחיל, או בדוק:</p>
            <ul style="margin: 0.5rem 0; padding-right: 1.5rem;">
              <li>האם השרת backend רץ על port 4000?</li>
              <li>פתח את הקונסול (F12) לבדיקת שגיאות</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    // Productivity-First Clean SaaS Theme Variables (Semantic Colors)
    $primary-blue: #3b82f6; // Calming Azure
    $success-green: #10b981; // Emerald Green
    $danger-red: #ef4444; // Soft Red
    $text-dark: #0f172a; // Dark Slate
    $white: #ffffff;
    $bg-light: #f3f4f6; // Cool Light Gray
    $gray-light: #f8fafc; // Light gray for headers
    $gray-border: #e2e8f0;
    $hover-bg: #f1f5f9; // Hover effect

    .menu-management {
      padding: 0;
      min-height: 60vh;
    }

    .container {
      max-width: 1400px;
      margin: 0 auto;
      padding: 0 2rem;
    }

    .header {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      margin-bottom: 2rem;
    }

    .btn-add {
      background: #10b981; // Emerald Green (#10b981)
      color: white;
      border: none;
      padding: 0.75rem 1.5rem;
      border-radius: 8px; // Rounded corners (8px)
      cursor: pointer;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      transition: all 0.2s ease;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
      font-family: 'Inter', 'Heebo', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }

    .btn-add:hover {
      background: #059669; // Slightly darker green
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
    }

    .category-filter {
      margin-bottom: 2rem;
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .category-filter label {
      font-weight: 600;
      color: $text-dark; // Dark Slate
      font-family: 'Inter', 'Heebo', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }

    .category-filter select {
      padding: 0.5rem 1rem;
      border: 1px solid #e2e8f0; // Light gray border (#e2e8f0)
      border-radius: 0.5rem;
      font-size: 1rem;
      min-width: 200px;
      background: white; // White background
      font-family: 'Inter', 'Heebo', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      transition: all 0.2s ease;
    }

    .category-filter select:focus {
      outline: none;
      border-color: #3b82f6; // Soft blue border on focus
      background: white;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); // Focus ring in soft blue
    }

    .menu-items-table {
      background: white;
      border-radius: 0.5rem; // Cleaner, less rounded
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1); // Very subtle shadow
    }
    
    .table-header-info {
      padding: 1rem 1.5rem;
      background: $gray-light; // Light gray (#f8fafc) for headers
      border-bottom: 1px solid $gray-border;
      font-weight: 600;
      color: $text-dark; // Dark Slate
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    
    .table-header-info i {
      color: $text-dark;
    }
    
    .info-note {
      font-size: 0.875rem;
      font-weight: normal;
      color: #64748b; // Medium gray
      margin-right: 1rem;
    }

    .categories-container {
      display: flex;
      flex-direction: column;
      gap: 2rem;
    }
    
    .category-section {
      background: transparent; // Remove heavy container
      margin-bottom: 2rem;
    }
    
    .category-header {
      background: #f8fafc; // Very light gray background (#f8fafc)
      padding: 1rem 1.5rem;
      border-bottom: 2px solid #e2e8f0; // Bottom border to separate section cleanly
      margin-bottom: 1rem;
    }
    
    .category-title {
      margin: 0;
      color: #334155; // Dark Slate (#334155)
      font-size: 1.2rem; // Font-size 1.2rem
      font-weight: 600; // Bold (600)
      display: flex;
      align-items: center;
      gap: 0.75rem;
      font-family: 'Inter', 'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    
    .category-title i {
      color: #64748b; // Medium gray for icon
    }
    
    .category-count {
      font-size: 0.9rem;
      font-weight: normal;
      color: #64748b; // Medium gray
    }

    // Modern List Layout (replaces table)
    .items-list {
      display: flex;
      flex-direction: column;
      gap: 1rem; // Spacious gap between cards
      padding: 0; // Remove padding - cards handle their own spacing
    }

    .item-row {
      background: #ffffff; // Pure White (#ffffff)
      border: 1px solid #e2e8f0; // Light border
      border-radius: 12px; // Border Radius 12px
      padding: 1.5rem;
      margin-bottom: 1rem;
      display: flex;
      align-items: center;
      gap: 1.5rem;
      transition: all 0.2s ease;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05); // Very subtle shadow
    }

    .item-row:hover {
      transform: translateY(-2px); // Lift slightly on hover
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1); // Increase shadow on hover
    }

    .item-image {
      flex-shrink: 0;
    }

    .item-thumbnail {
      width: 60px;
      height: 60px;
      object-fit: cover;
      border-radius: 12px; // Rounded square (12px) - perfect circle or rounded square
      background-color: $gray-light;
      border: 1px solid #e5e7eb; // Very thin light-gray border
      display: block;
    }
    
    .item-thumbnail[data-error-handled="true"] {
      opacity: 0.7;
      background-color: #e0e0e0;
    }

    .item-info {
      flex: 1;
      min-width: 0;
    }

    .item-header {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 0.5rem;
    }

    .item-name {
      margin: 0;
      color: #1e293b; // Dark Slate (#1e293b)
      font-size: 1.1rem; // Slightly smaller
      font-weight: 700; // Bold
      flex: 1;
      font-family: 'Inter', 'Heebo', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }

    .item-badges {
      display: flex;
      gap: 0.5rem;
    }

    .badge {
      padding: 0.25rem 0.75rem;
      border-radius: 12px;
      font-size: 0.75rem;
      font-weight: 600;
    }

    .badge-popular {
      background: rgba(59, 130, 246, 0.1); // Soft blue background
      color: $primary-blue; // Royal Blue
    }

    .badge-unavailable {
      background: #f8f9fa;
      color: #6c757d;
    }

    .item-description {
      color: #64748b; // Muted gray (#64748b)
      font-size: 0.875rem; // Smaller font
      line-height: 1.5;
      margin: 0.5rem 0;
      max-width: 500px;
      font-family: 'Inter', 'Heebo', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }

    .item-description.no-description {
      color: #999;
      font-style: italic;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .item-description.no-description i {
      color: $primary-blue; // Royal Blue
    }

    .item-meta {
      display: flex;
      align-items: center;
      gap: 2rem;
      margin-top: 0.75rem;
      flex-wrap: wrap;
    }

    .item-price {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .price-variants {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    
    .price-variant-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 0.75rem;
      background: rgba(59, 130, 246, 0.05); // Very soft blue background
      border: 1px solid rgba(59, 130, 246, 0.2); // Subtle blue border
      border-radius: 0.5rem;
      font-size: 0.875rem;
    }
    
    .variant-size {
      font-weight: 600;
      color: $text-dark; // Dark Slate
    }
    
    .variant-price {
      font-weight: 700;
      color: #1a2a3a;
    }
    
    .single-price {
      font-weight: 700;
      color: #1a2a3a;
      font-size: 1.1rem;
    }

    .no-price {
      color: #dc3545;
      font-size: 0.875rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    
    .no-price i {
      color: #dc3545;
    }

    .item-toggles {
      display: flex;
      gap: 1.5rem;
      align-items: center;
    }

    .item-actions {
      display: flex;
      gap: 0.5rem;
      flex-shrink: 0;
    }

    .btn-action {
      width: 40px;
      height: 40px;
      border: none; // Remove any heavy borders
      border-radius: 8px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
      background: transparent;
      color: #94a3b8; // Light Gray (#94a3b8) - default
      font-size: 1rem;
    }

    .btn-action:hover {
      transform: translateY(-1px);
    }

    .btn-action.btn-edit {
      color: #94a3b8; // Light Gray default
    }

    .btn-action.btn-edit:hover {
      background: rgba(59, 130, 246, 0.1); // Soft blue background
      color: #3b82f6; // Blue on hover
    }

    .btn-action.btn-delete {
      color: #94a3b8; // Light Gray default
    }

    .btn-action.btn-delete:hover {
      background: rgba(239, 68, 68, 0.1); // Light Red background
      color: #ef4444; // Red on hover
    }

    .empty-state {
      text-align: center;
      padding: 3rem;
      color: #6c757d;
      background: white;
      border-radius: 0.75rem;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }
    
    .empty-state i {
      font-size: 3rem;
      margin-bottom: 1rem;
      opacity: 0.5;
    }
    
    .empty-state p {
      margin: 1rem 0;
      font-size: 1.1rem;
    }
    
    .btn-add-small {
      background: #1f3444;
      color: white;
      border: none;
      padding: 0.5rem 1rem;
      border-radius: 0.5rem;
      cursor: pointer;
      font-weight: 600;
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      margin-top: 1rem;
    }
    
    .btn-add-small:hover {
      background: #2a4a5f;
    }
    
    .name-cell, .category-cell, .price-cell {
      font-weight: 500;
    }
    
    .price-cell {
      color: #1a2a3a;
      font-weight: 700;
      min-width: 150px;
    }
    
    .price-variants {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    
    .price-variant-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 0.75rem;
      background: #f8f9fa;
      border: 1px solid #dee2e6;
      border-radius: 0.5rem;
      font-size: 0.875rem;
    }
    
    .variant-size {
      font-weight: 600;
      color: #1f3444;
    }
    
    .variant-price {
      font-weight: 700;
      color: #1a2a3a;
    }
    
    .single-price {
      font-weight: 700;
      color: #1a2a3a;
    }

    /* Toggle Switch Styles */
    .toggle-cell {
      text-align: center;
      vertical-align: middle;
      padding: 1rem 0.5rem;
      min-width: 100px;
      white-space: nowrap;
    }

    .toggle-switch {
      position: relative;
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      cursor: pointer;
    }

    .toggle-switch input {
      opacity: 0;
      width: 0;
      height: 0;
    }

    .toggle-slider {
      position: relative;
      display: inline-block;
      width: 40px; // Smaller and more modern
      height: 22px; // Smaller and more modern
      background-color: #cbd5e1; // Light gray when inactive
      transition: 0.2s;
      border-radius: 22px;
      cursor: pointer;
    }

    .toggle-slider:before {
      position: absolute;
      content: "";
      height: 18px;
      width: 18px;
      left: 2px;
      bottom: 2px;
      background-color: white;
      transition: 0.2s;
      border-radius: 50%;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
    }

    .toggle-switch input:checked + .toggle-slider {
      background-color: #10b981; // Emerald Green (#10b981) when active
    }

    .toggle-switch input:checked + .toggle-slider:before {
      transform: translateX(18px);
    }

    .toggle-switch input:focus + .toggle-slider {
      box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.25);
    }

    .toggle-switch:hover .toggle-slider {
      box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.15);
    }

    .toggle-switch input:disabled + .toggle-slider {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .toggle-label {
      display: inline-block;
      font-size: 0.875rem; // Small font
      font-weight: 500;
      vertical-align: middle;
      color: #64748b; // Muted gray by default
      font-family: 'Inter', 'Heebo', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }

    .toggle-label.active,
    .toggle-switch input:checked + .toggle-slider + .toggle-label {
      color: #10b981; // Emerald Green when active
    }

    /* Modal Styles */
    .modal {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }

    .modal-content {
      background: white;
      border-radius: 12px;
      width: 90%;
      max-width: 1000px;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1.5rem;
      border-bottom: 1px solid #eee;
    }

    .modal-header h2 {
      margin: 0;
      color: #0E1A24;
    }

    .btn-close {
      background: none;
      border: none;
      font-size: 1.5rem;
      cursor: pointer;
      color: #6c757d;
      padding: 0.5rem;
    }

    .btn-close:hover {
      color: #0E1A24;
    }

    .modal-body {
      padding: 1.5rem;
    }

    // 2-Column Grid Layout
    .form-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 2rem;
      margin-bottom: 2rem;
    }

    .form-column {
      display: flex;
      flex-direction: column;
    }

    .form-column-image {
      min-width: 0;
    }

    .form-column-fields {
      min-width: 0;
    }

    .form-input {
      width: 100%;
      padding: 0.75rem 1rem;
      border: 1px solid #ddd;
      border-radius: 8px;
      font-size: 1rem;
      font-family: inherit;
      transition: all 0.3s ease;
    }

    .form-input:focus {
      outline: none;
      border-color: $primary-blue; // Royal Blue
      box-shadow: 0 0 0 3px rgba(203, 182, 158, 0.1);
    }

    .form-group {
      margin-bottom: 1.5rem;
    }

    .form-group label {
      display: block;
      margin-bottom: 0.5rem;
      font-weight: 600;
      color: #0E1A24;
    }

    .form-group input,
    .form-group select,
    .form-group textarea {
      @extend .form-input;
    }

    .form-group small {
      display: block;
      margin-top: 0.25rem;
      color: #6c757d;
      font-size: 0.875rem;
    }

    /* Recipe Section Styles */
    .recipe-section {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 1rem;
      background: #f8fafc;
    }

    .recipe-label {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-weight: 600;
      color: #0E1A24;
      margin-bottom: 1rem;
    }

    .recipe-label i {
      color: #10b981; // Emerald Green
    }

    .recipe-list {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      margin-bottom: 1rem;
    }

    .recipe-item {
      display: grid;
      grid-template-columns: 2fr 1fr 1fr 1.5fr auto;
      gap: 0.5rem;
      align-items: center;
      padding: 0.75rem;
      background: white;
      border-radius: 6px;
      border: 1px solid #e2e8f0;
    }

    .recipe-input {
      padding: 0.5rem;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 0.9rem;
    }

    .recipe-input:focus {
      outline: none;
      border-color: #10b981;
      box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.1);
    }

    .btn-remove-ingredient {
      padding: 0.5rem;
      background: #ef4444;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
    }

    .btn-remove-ingredient:hover {
      background: #dc2626;
      transform: scale(1.05);
    }

    .btn-add-ingredient {
      padding: 0.75rem 1rem;
      background: #10b981; // Emerald Green
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 600;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      width: 100%;
      justify-content: center;
    }

    .btn-add-ingredient:hover {
      background: #059669;
      transform: translateY(-2px);
      box-shadow: 0 4px 8px rgba(16, 185, 129, 0.3);
    }

    @media (max-width: 768px) {
      .recipe-item {
        grid-template-columns: 1fr;
        gap: 0.5rem;
      }
    }
    
    /* Image Upload Styles */
    .image-upload-section {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    
    .file-input-wrapper {
      position: relative;
    }
    
    .file-input-wrapper input[type="file"] {
      position: absolute;
      opacity: 0;
      width: 0;
      height: 0;
    }
    
    .file-input-label {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.75rem 1.5rem;
      background: #1f3444;
      color: white;
      border-radius: 0.5rem;
      cursor: pointer;
      font-weight: 600;
      transition: all 0.3s ease;
      border: 2px dashed transparent;
    }
    
    .file-input-label:hover:not(.uploading) {
      background: #2a4a5f;
      transform: translateY(-2px);
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
    }
    
    .file-input-label.uploading {
      background: #6c757d;
      cursor: not-allowed;
      opacity: 0.8;
    }
    
    .file-input-label i {
      font-size: 1.1rem;
    }
    
    /* Styled Image Upload Box */
    .image-upload-box {
      position: relative;
      width: 100%;
      min-height: 300px;
      border: 2px dashed #ccc;
      border-radius: 12px;
      background: $gray-light;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.3s ease;
      overflow: hidden;
    }

    .image-upload-box:hover:not(.has-image):not(.uploading) {
      border-color: $primary-blue; // Royal Blue
      background: rgba(59, 130, 246, 0.1); // Soft blue background
    }

    .image-upload-box.has-image {
      border: 1px solid $primary-blue; // Royal Blue
      padding: 0;
    }

    .image-upload-box.uploading {
      cursor: not-allowed;
      opacity: 0.7;
    }

    .image-upload-box input[type="file"] {
      position: absolute;
      opacity: 0;
      width: 100%;
      height: 100%;
      cursor: pointer;
      z-index: 2;
    }

    .upload-box-content {
      text-align: center;
      padding: 2rem;
      z-index: 1;
    }

    .upload-icon {
      font-size: 3rem;
      color: $primary-blue; // Royal Blue
      margin-bottom: 1rem;
    }

    .upload-text {
      font-size: 1.1rem;
      font-weight: 600;
      color: $text-dark; // Dark Slate
      margin: 0.5rem 0;
    }

    .upload-hint {
      font-size: 0.9rem;
      color: #6c757d;
      margin: 0;
    }

    .upload-preview {
      position: relative;
      width: 100%;
      height: 100%;
      min-height: 300px;
    }

    .upload-preview img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: center;
      display: block;
      border-radius: 8px;
    }
    
    .image-preview {
      position: relative;
      display: inline-block;
      max-width: 300px;
      border-radius: 0.5rem;
      overflow: hidden;
      border: 2px solid #dee2e6;
      background: #f8f9fa;
    }
    
    .image-preview img {
      width: 100%;
      height: 100%;
      max-height: 300px;
      object-fit: cover;
      object-position: center;
      display: block;
      border-radius: 8px;
    }
    
    .btn-remove-preview {
      position: absolute;
      top: 0.5rem;
      left: 0.5rem;
      background: rgba(220, 53, 69, 0.9);
      color: white;
      border: none;
      border-radius: 50%;
      width: 32px;
      height: 32px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.3s ease;
      font-size: 0.875rem;
    }
    
    .btn-remove-preview:hover {
      background: rgba(220, 53, 69, 1);
      transform: scale(1.1);
    }
    
    .manual-url-input {
      margin-top: 0.5rem;
    }
    
    .manual-url-input label {
      display: block;
      margin-bottom: 0.5rem;
      font-weight: 600;
      color: #0E1A24;
      font-size: 0.9rem;
    }

    .checkbox-group {
      display: flex;
      gap: 2rem;
    }

    .checkbox-group label {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-weight: normal;
    }

    .checkbox-group input[type="checkbox"] {
      width: auto;
    }
    
    .pricing-options {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      margin-top: 0.5rem;
    }
    
    .pricing-option {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    
    .pricing-option label {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-weight: 600;
      margin-bottom: 0;
    }
    
    .pricing-option input[type="radio"] {
      width: auto;
    }
    
    .price-input {
      margin-top: 0.5rem;
    }
    
    .variants-container {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      margin-top: 0.5rem;
      padding: 1rem;
      background: #f8f9fa;
      border-radius: 0.5rem;
      border: 1px solid #dee2e6;
    }
    
    .variant-row {
      display: flex;
      gap: 0.5rem;
      align-items: center;
    }
    
    .variant-label {
      flex: 1;
      min-width: 150px;
    }
    
    .variant-price-input {
      flex: 1;
      min-width: 100px;
    }
    
    .btn-remove-variant {
      background: #dc3545;
      color: white;
      border: none;
      padding: 0.5rem;
      border-radius: 0.25rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 32px;
      height: 32px;
      transition: background 0.3s ease;
    }
    
    .btn-remove-variant:hover {
      background: #c82333;
    }
    
    .options-container {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      margin-top: 0.5rem;
      padding: 1rem;
      background: #f8f9fa;
      border-radius: 0.5rem;
      border: 1px solid #dee2e6;
    }
    
    .option-row {
      display: flex;
      gap: 0.5rem;
      align-items: center;
    }
    
    .option-label {
      flex: 1;
      min-width: 150px;
    }
    
    .option-amount {
      flex: 1;
      min-width: 150px;
    }
    
    .option-price-input {
      flex: 1;
      min-width: 100px;
    }
    
    .btn-remove-option {
      background: #dc3545;
      color: white;
      border: none;
      padding: 0.5rem;
      border-radius: 0.25rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 32px;
      height: 32px;
      transition: background 0.3s ease;
    }
    
    .btn-remove-option:hover {
      background: #c82333;
    }
    
    .btn-add-option {
      background: #1f3444;
      color: white;
      border: none;
      padding: 0.75rem 1rem;
      border-radius: 0.5rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      font-weight: 600;
      transition: background 0.3s ease;
      margin-top: 0.5rem;
    }
    
    .btn-add-option:hover {
      background: #2a4a5f;
    }
    
    .btn-add-variant {
      background: #1f3444;
      color: white;
      border: none;
      padding: 0.5rem 1rem;
      border-radius: 0.5rem;
      cursor: pointer;
      font-weight: 600;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      transition: background 0.3s ease;
      margin-top: 0.5rem;
    }
    
    .btn-add-variant:hover {
      background: #2a4a5f;
    }

    .form-actions {
      display: flex;
      justify-content: flex-end;
      gap: 1rem;
      margin-top: 2rem;
      padding-top: 1.5rem;
      border-top: 1px solid #eee;
    }

    .btn-cancel, .btn-save {
      padding: 0.75rem 1.5rem;
      border: none;
      border-radius: 0.5rem;
      cursor: pointer;
      font-weight: 600;
      transition: all 0.3s ease;
    }

    .btn-cancel {
      background: #f5f5f5;
      color: #0E1A24;
    }

    .btn-cancel:hover {
      background: #e8e8e8;
    }

    .btn-save {
      background: #1f3444;
      color: white;
    }

    .btn-save:hover:not(:disabled) {
      background: #2a4a5f;
    }

    .btn-save:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .loading {
      text-align: center;
      padding: 2rem;
      color: #6c757d;
    }

    .error-message {
      background: #fee;
      color: #c33;
      padding: 1rem;
      border-radius: 0.5rem;
      margin-top: 1rem;
    }

    .success-message {
      background: #efe;
      color: #3c3;
      padding: 1rem;
      border-radius: 0.5rem;
      margin-top: 1rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    
    .info-message {
      background: #e3f2fd;
      color: #1976d2;
      padding: 1rem;
      border-radius: 0.5rem;
      margin-top: 1rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    
    .error-message {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    @media (max-width: 768px) {
      .header {
        flex-direction: column;
        gap: 1rem;
        align-items: stretch;
      }

      .item-row {
        flex-direction: column;
        align-items: flex-start;
        gap: 1rem;
      }

      .item-image {
        align-self: center;
      }

      .item-meta {
        flex-direction: column;
        gap: 1rem;
        align-items: flex-start;
      }

      .form-grid {
        grid-template-columns: 1fr;
        gap: 1.5rem;
      }

      .modal-content {
        width: 95%;
        margin: 1rem;
      }

      .image-upload-box {
        min-height: 250px;
      }
    }
  `]
})
export class MenuManagementComponent implements OnInit {
  menuService = inject(MenuService);
  uploadService = inject(UploadService);
  fb = inject(FormBuilder);

  menuItems: MenuItem[] = [];
  filteredItems: MenuItem[] = [];
  itemsByCategory: { category: string; items: MenuItem[] }[] = [];
  categories: any[] = [];
  selectedCategory: string = '';
  
  showModal = false;
  editingItem: MenuItem | null = null;
  isLoading = false;
  errorMessage = '';
  successMessage = '';
  
  // Image upload state
  isUploading = false;
  imagePreviewUrl: string | null = null;

  itemForm: FormGroup = this.fb.group({
    name: ['', Validators.required],
    category: ['', Validators.required],
    description: [''],
    pricingType: ['single'], // 'single', 'variants', or 'options'
    price: [0, [Validators.min(0.01)]],
    pricingVariants: this.fb.array([]),
    pricingOptions: this.fb.array([]),
    imageUrl: [''],
    tags: [''],
    recipe: this.fb.array([]), // Recipe ingredients array
    isAvailable: [true],
    isPopular: [false]
  });

  get pricingVariantsFormArray(): FormArray {
    return this.itemForm.get('pricingVariants') as FormArray;
  }

  get pricingOptionsFormArray(): FormArray {
    return this.itemForm.get('pricingOptions') as FormArray;
  }

  get recipeFormArray(): FormArray {
    return this.itemForm.get('recipe') as FormArray;
  }

  ngOnInit(): void {
    // Load menu items first, then categories (categories depend on menu items)
    this.loadMenuItems();
  }

  loadMenuItems(): void {
    // Prevent multiple simultaneous loads
    if (this.isLoading) {
      return;
    }
    
    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';
    
    console.log('🔄 Dashboard: Loading menu items...');
    
    // Force reload from backend
    this.menuService.loadMenuItems().subscribe({
      next: (items) => {
        console.log('📥 Dashboard: Received', items?.length || 0, 'items from service');
        
        // Update state in one batch to prevent multiple renders
        this.menuItems = items || [];
        this.filteredItems = items || [];
        this.isLoading = false;
        
        // Group items by category
        this.groupItemsByCategory();
        
        // Count items by category for debugging
        const categoryCounts: {[key: string]: number} = {};
        this.menuItems.forEach(item => {
          categoryCounts[item.category] = (categoryCounts[item.category] || 0) + 1;
        });
        console.log('📊 Dashboard: Items by category:', categoryCounts);
        console.log('📊 Dashboard: Total items:', this.menuItems.length);
        console.log('📊 Dashboard: Filtered items:', this.filteredItems.length);
        
        if (!items || items.length === 0) {
          this.errorMessage = 'לא נמצאו פריטי תפריט. הוסף כרטיסיות חדשות או בדוק את חיבור ה-backend.';
        } else {
          this.successMessage = `נטענו ${items.length} כרטיסיות בהצלחה`;
          setTimeout(() => {
            this.successMessage = '';
          }, 2000);
          
          // Load categories after menu items are loaded
          this.loadCategories();
        }
      },
      error: (error) => {
        console.error('❌ Dashboard: Error loading menu items:', error);
        let errorMsg = 'שגיאה בטעינת פריטי התפריט. ';
        
        if (error.status === 0) {
          errorMsg += 'לא ניתן להתחבר לשרת. ודא שהשרת backend רץ על port 4000.';
        } else if (error.status === 404) {
          errorMsg += 'הנתיב לא נמצא. בדוק את הגדרות ה-API.';
        } else {
          errorMsg += error.message || 'שגיאה לא ידועה';
        }
        
        this.errorMessage = errorMsg;
        this.menuItems = [];
        this.filteredItems = [];
        this.isLoading = false;
      }
    });
  }

  loadCategories(): void {
    this.menuService.loadCategories().subscribe({
      next: (categories) => {
        this.categories = categories;
        console.log('✅ Loaded', categories.length, 'categories in dashboard:', categories.map(c => c.name).join(', '));
      },
      error: (error) => {
        console.error('Error loading categories:', error);
      }
    });
  }

  groupItemsByCategory(): void {
    const categoryMap = new Map<string, MenuItem[]>();
    
    this.filteredItems.forEach(item => {
      const category = item.category || 'ללא קטגוריה';
      if (!categoryMap.has(category)) {
        categoryMap.set(category, []);
      }
      categoryMap.get(category)!.push(item);
    });
    
    // Convert to array and sort by category name
    this.itemsByCategory = Array.from(categoryMap.entries())
      .map(([category, items]) => ({ category, items }))
      .sort((a, b) => a.category.localeCompare(b.category));
    
    console.log('📊 Dashboard: Grouped items by category:', this.itemsByCategory.length, 'categories');
  }

  filterByCategory(): void {
    if (!this.selectedCategory) {
      this.filteredItems = this.menuItems;
      console.log('📊 Dashboard: Showing all items:', this.filteredItems.length);
    } else {
      this.filteredItems = this.menuItems.filter(item => item.category === this.selectedCategory);
      console.log('📊 Dashboard: Filtered by category "' + this.selectedCategory + '":', this.filteredItems.length, 'items');
      console.log('📊 Dashboard: All items in this category:', this.filteredItems.map(i => i.name).join(', '));
    }
    
    // Re-group items after filtering
    this.groupItemsByCategory();
  }

  openAddModal(): void {
    this.editingItem = null;
    this.itemForm.reset({
      name: '',
      category: '',
      description: '',
      pricingType: 'single',
      price: 0,
      pricingVariants: [],
      imageUrl: '',
      tags: '',
      isAvailable: true,
      isPopular: false
    });
    // Clear variants and options arrays
    while (this.pricingVariantsFormArray.length !== 0) {
      this.pricingVariantsFormArray.removeAt(0);
    }
    while (this.pricingOptionsFormArray.length !== 0) {
      this.pricingOptionsFormArray.removeAt(0);
    }
    // Clear recipe array
    while (this.recipeFormArray.length !== 0) {
      this.recipeFormArray.removeAt(0);
    }
    // Clear image preview
    this.imagePreviewUrl = null;
    this.showModal = true;
    this.errorMessage = '';
    this.successMessage = '';
  }

  openEditModal(item: MenuItem): void {
    this.editingItem = item;
    
    // Determine pricing type (priority: options > variants > single)
    const hasOptions = item.pricingOptions && item.pricingOptions.length > 0;
    const hasVariants = item.pricingVariants && item.pricingVariants.length > 0;
    const pricingType = hasOptions ? 'options' : (hasVariants ? 'variants' : 'single');
    
    // Clear existing variants and options
    while (this.pricingVariantsFormArray.length !== 0) {
      this.pricingVariantsFormArray.removeAt(0);
    }
    while (this.pricingOptionsFormArray.length !== 0) {
      this.pricingOptionsFormArray.removeAt(0);
    }
    // Clear recipe array
    while (this.recipeFormArray.length !== 0) {
      this.recipeFormArray.removeAt(0);
    }
    
    // Set image preview if imageUrl exists
    this.imagePreviewUrl = item.imageUrl || null;
    
    // Set form values
    this.itemForm.patchValue({
      name: item.name,
      category: item.category,
      description: item.description || '',
      pricingType: pricingType,
      price: item.price || 0,
      imageUrl: item.imageUrl || '',
      tags: item.tags?.join(', ') || '',
      isAvailable: item.isAvailable !== false,
      isPopular: item.isPopular || false
    });
    
    // Load recipe ingredients if they exist
    if ((item as any).recipe && Array.isArray((item as any).recipe)) {
      (item as any).recipe.forEach((ingredient: any) => {
        const ingredientGroup = this.fb.group({
          name: [ingredient.name || '', Validators.required],
          quantity: [ingredient.quantity || 0, [Validators.required, Validators.min(0.01)]],
          unit: [ingredient.unit || '', Validators.required],
          category: [ingredient.category || '', Validators.required]
        });
        this.recipeFormArray.push(ingredientGroup);
      });
    }
    
    // Add options if they exist
    if (hasOptions && item.pricingOptions) {
      item.pricingOptions.forEach(option => {
        this.addPricingOption(option.label, option.amount, option.price);
      });
    }
    
    // Add variants if they exist (and no options)
    if (!hasOptions && hasVariants && item.pricingVariants) {
      item.pricingVariants.forEach(variant => {
        this.addPricingVariant(variant.label, variant.price);
      });
    }
    
    this.showModal = true;
    this.errorMessage = '';
    this.successMessage = '';
  }

  closeModal(event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.showModal = false;
    this.editingItem = null;
    // Clear variants and options arrays
    while (this.pricingVariantsFormArray.length !== 0) {
      this.pricingVariantsFormArray.removeAt(0);
    }
    while (this.pricingOptionsFormArray.length !== 0) {
      this.pricingOptionsFormArray.removeAt(0);
    }
    // Clear image preview
    this.imagePreviewUrl = null;
    this.itemForm.reset({
      name: '',
      category: '',
      description: '',
      pricingType: 'single',
      price: 0,
      pricingVariants: [],
      imageUrl: '',
      tags: '',
      isAvailable: true,
      isPopular: false
    });
  }
  
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) {
      return;
    }
    
    const file = input.files[0];
    
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      this.errorMessage = 'סוג קובץ לא נתמך. אנא בחר תמונה (JPEG, PNG, או WebP)';
      return;
    }
    
    // Validate file size (5MB limit)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      this.errorMessage = 'הקובץ גדול מדי. גודל מקסימלי: 5MB';
      return;
    }
    
    // Show preview immediately
    const reader = new FileReader();
    reader.onload = (e: any) => {
      this.imagePreviewUrl = e.target.result;
    };
    reader.readAsDataURL(file);
    
    // Upload to Cloudinary
    this.isUploading = true;
    this.errorMessage = '';
    this.successMessage = '';
    
    this.uploadService.uploadImage(file).subscribe({
      next: (response) => {
        if (response.success && response.imageUrl) {
          // Update form with the Cloudinary URL
          this.itemForm.patchValue({ imageUrl: response.imageUrl });
          this.imagePreviewUrl = response.imageUrl; // Update preview with Cloudinary URL
          this.successMessage = 'התמונה הועלתה בהצלחה!';
          this.isUploading = false;
          
          // Clear success message after 3 seconds
          setTimeout(() => {
            this.successMessage = '';
          }, 3000);
        } else {
          this.errorMessage = response.message || 'שגיאה בהעלאת התמונה';
          this.isUploading = false;
        }
      },
      error: (error) => {
        console.error('Error uploading image:', error);
        this.errorMessage = error.message || 'שגיאה בהעלאת התמונה. אנא נסה שוב.';
        this.isUploading = false;
        // Clear preview on error
        this.imagePreviewUrl = null;
      }
    });
  }
  
  removeImagePreview(): void {
    this.imagePreviewUrl = null;
    this.itemForm.patchValue({ imageUrl: '' });
    // Reset file input
    const fileInput = document.getElementById('imageUpload') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  }

  saveItem(): void {
    const formValue = this.itemForm.value;
    const pricingType = formValue.pricingType || 'single';
    
    // Validate based on pricing type
    if (pricingType === 'variants') {
      if (this.pricingVariantsFormArray.length === 0) {
        this.errorMessage = 'אנא הוסף לפחות גודל אחד עם מחיר';
        return;
      }
      const invalidVariants = this.pricingVariantsFormArray.controls.filter(
        control => !control.get('label')?.value?.trim() || !control.get('price')?.value || control.get('price')?.value <= 0
      );
      if (invalidVariants.length > 0) {
        this.errorMessage = 'אנא מלא את כל השדות של כל הגדלים';
        return;
      }
    } else if (pricingType === 'options') {
      if (this.pricingOptionsFormArray.length === 0) {
        this.errorMessage = 'אנא הוסף לפחות אפשרות אחת עם תווית, כמות ומחיר';
        return;
      }
      const invalidOptions = this.pricingOptionsFormArray.controls.filter(
        control => !control.get('label')?.value?.trim() || !control.get('amount')?.value?.trim() || !control.get('price')?.value || control.get('price')?.value <= 0
      );
      if (invalidOptions.length > 0) {
        this.errorMessage = 'אנא מלא את כל השדות של כל האפשרויות (תווית, כמות, מחיר)';
        return;
      }
    } else {
      if (!formValue.price || formValue.price <= 0) {
        this.errorMessage = 'אנא הזן מחיר תקין';
        return;
      }
    }
    
    if (this.itemForm.get('name')?.invalid || this.itemForm.get('category')?.invalid) {
      this.errorMessage = 'אנא מלא את כל השדות הנדרשים';
      return;
    }
    
    const itemData: any = {
      name: formValue.name,
      category: formValue.category,
      description: formValue.description || '',
      imageUrl: formValue.imageUrl || '/assets/images/placeholder-dish.jpg',
      tags: formValue.tags ? formValue.tags.split(',').map((tag: string) => tag.trim()).filter((tag: string) => tag) : [],
      isAvailable: formValue.isAvailable !== false,
      isPopular: formValue.isPopular || false
    };
    
    // Handle pricing based on type
    if (pricingType === 'options' && this.pricingOptionsFormArray.length > 0) {
      // Use pricing options
      itemData.pricingOptions = this.pricingOptionsFormArray.value
        .filter((o: any) => o.label && o.label.trim() && o.amount && o.amount.trim() && o.price !== null && o.price !== undefined && o.price > 0)
        .map((o: any) => ({
          label: o.label.trim(),
          amount: o.amount.trim(),
          price: parseFloat(o.price) || 0
        }));
      // Don't set price if using options (or set to undefined to remove it)
      delete itemData.price;
      delete itemData.pricingVariants;
    } else if (pricingType === 'variants' && this.pricingVariantsFormArray.length > 0) {
      // Use pricing variants
      itemData.pricingVariants = this.pricingVariantsFormArray.value
        .filter((v: any) => v.label && v.label.trim() && v.price !== null && v.price !== undefined && v.price > 0)
        .map((v: any) => ({
          size: v.label.toLowerCase().replace(/\s+/g, '-'),
          label: v.label.trim(),
          price: parseFloat(v.price) || 0,
          weight: this.extractWeight(v.label)
        }));
      // Don't set price if using variants (or set to undefined to remove it)
      delete itemData.price;
      delete itemData.pricingOptions;
    } else {
      // Use single price
      itemData.price = parseFloat(formValue.price) || 0;
      delete itemData.pricingVariants;
      delete itemData.pricingOptions;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    if (this.editingItem) {
      // Update existing item
      console.log('💾 Updating existing item:', this.editingItem.id, itemData);
      this.menuService.updateMenuItem(this.editingItem.id || this.editingItem._id || '', itemData).subscribe({
        next: (updatedItem) => {
          console.log('✅ Item updated successfully:', updatedItem);
          console.log('📦 Updated item data:', JSON.stringify(updatedItem, null, 2));
          this.successMessage = 'הכרטיסייה "' + updatedItem.name + '" עודכנה בהצלחה';
          this.isLoading = false;
          // Force reload all items from backend to ensure we have latest data
          setTimeout(() => {
            this.loadMenuItems();
            this.closeModal();
          }, 500);
        },
        error: (error) => {
          console.error('❌ Error updating menu item:', error);
          this.errorMessage = 'שגיאה בעדכון הכרטיסייה: ' + (error.error?.message || error.message || 'שגיאה לא ידועה');
          this.isLoading = false;
        }
      });
    } else {
      // Create new item
      this.menuService.addMenuItem(itemData).subscribe({
        next: (newItem) => {
          this.successMessage = 'הכרטיסייה "' + newItem.name + '" נוספה בהצלחה';
          this.isLoading = false;
          // Reload all items to show new data
          this.loadMenuItems();
          setTimeout(() => {
            this.closeModal();
          }, 1500);
        },
        error: (error) => {
          console.error('Error creating menu item:', error);
          this.errorMessage = 'שגיאה בהוספת הכרטיסייה';
          this.isLoading = false;
        }
      });
    }
  }

  toggleStatus(item: MenuItem, field: 'isAvailable' | 'isPopular', event: Event): void {
    const checkbox = event.target as HTMLInputElement;
    const newValue = checkbox.checked;
    const itemId = item.id || item._id || '';
    
    console.log(`🔄 Toggling ${field} for item:`, item.name, 'Current value:', (item as any)[field], 'New value:', newValue);
    
    if (!itemId) {
      console.error('❌ Cannot toggle status: item ID is missing');
      checkbox.checked = !newValue; // Revert checkbox
      return;
    }
    
    // Store original value for potential revert
    const originalValue = (item as any)[field];
    console.log(`📝 Original value for ${field}:`, originalValue);
    
    // Optimistically update the UI immediately
    (item as any)[field] = newValue;
    console.log(`✅ Updated local item ${field} to:`, newValue);
    
    // Update in the local arrays for immediate feedback
    const items = [...this.menuItems];
    const itemIndex = items.findIndex(i => (i.id || i._id) === itemId);
    
    if (itemIndex > -1) {
      // Update in menuItems array
      items[itemIndex] = { ...items[itemIndex], [field]: newValue };
      this.menuItems = items;
      
      // Update in filteredItems array
      this.filteredItems = this.filteredItems.map(i => 
        (i.id || i._id) === itemId ? { ...i, [field]: newValue } : i
      );
      
      // Re-group items by category to update the displayed groups
      this.groupItemsByCategory();
    }
    
    // Show field name in Hebrew
    const fieldName = field === 'isAvailable' ? 'מלאי' : 'מומלץ';
    const statusText = newValue ? 'מופעל' : 'כבוי';
    
    // Call API to update in database
    this.menuService.updateMenuItem(itemId, { [field]: newValue }).subscribe({
      next: (updatedItem) => {
        console.log(`✅ ${fieldName} updated successfully for ${item.name}: ${statusText}`);
        
        // Show success toast
        this.showToast(`${fieldName} עודכן ל-${statusText} עבור ${item.name}`, 'success');
        
        // Update the item with the response from server (ensures we have latest data)
        if (itemIndex > -1) {
          items[itemIndex] = updatedItem;
          this.menuItems = items;
          this.filteredItems = this.filteredItems.map(i => 
            (i.id || i._id) === itemId ? updatedItem : i
          );
          this.groupItemsByCategory();
        }
      },
      error: (error) => {
        console.error(`❌ Error updating ${fieldName}:`, error);
        
        // Revert the toggle on error
        checkbox.checked = originalValue;
        (item as any)[field] = originalValue;
        
        // Revert in local arrays
        if (itemIndex > -1) {
          items[itemIndex] = { ...items[itemIndex], [field]: originalValue };
          this.menuItems = items;
          this.filteredItems = this.filteredItems.map(i => 
            (i.id || i._id) === itemId ? { ...i, [field]: originalValue } : i
          );
          this.groupItemsByCategory();
        }
        
        // Show error toast
        this.showToast(`שגיאה בעדכון ${fieldName}: ${error.error?.message || error.message || 'שגיאה לא ידועה'}`, 'error');
      }
    });
  }

  showToast(message: string, type: 'success' | 'error' = 'success'): void {
    // Set toast message
    if (type === 'success') {
      this.successMessage = message;
      this.errorMessage = '';
    } else {
      this.errorMessage = message;
      this.successMessage = '';
    }
    
    // Auto-hide after 3 seconds
    setTimeout(() => {
      if (type === 'success') {
        this.successMessage = '';
      } else {
        this.errorMessage = '';
      }
    }, 3000);
  }

  deleteItem(id: string): void {
    if (!confirm('האם אתה בטוח שברצונך למחוק את הכרטיסייה הזאת?')) {
      return;
    }

    this.isLoading = true;
    this.menuService.deleteMenuItem(id).subscribe({
      next: () => {
        this.successMessage = 'הכרטיסייה נמחקה בהצלחה';
        this.isLoading = false;
        // Reload all items to show updated list
        this.loadMenuItems();
        setTimeout(() => {
          this.successMessage = '';
        }, 2000);
      },
      error: (error) => {
        console.error('Error deleting menu item:', error);
        this.errorMessage = 'שגיאה במחיקת הכרטיסייה';
        this.isLoading = false;
      }
    });
  }

  trackByItemId(index: number, item: MenuItem): string {
    return item.id || item._id || '';
  }

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    if (!img) return;
    
    // Get the placeholder URL
    const placeholderUrl = '/assets/images/placeholder-dish.jpg';
    const currentSrc = img.src || '';
    
    // If we're already trying to load the placeholder, stop to prevent infinite loop
    if (currentSrc.includes('placeholder-dish.jpg') || img.dataset['errorHandled'] === 'true') {
      return;
    }
    
    // Mark as handled to prevent infinite loop
    img.dataset['errorHandled'] = 'true';
    
    // Only set placeholder if current src is not already placeholder
    if (!currentSrc.includes('placeholder-dish.jpg')) {
      img.src = placeholderUrl;
    }
    
    // Remove error handler to prevent infinite loop
    img.onerror = null;
  }

  onImageLoad(event: Event): void {
    const img = event.target as HTMLImageElement;
    if (img) {
      // Image loaded successfully, remove error handling flag if it was set
      img.dataset['errorHandled'] = 'false';
    }
  }

  hasPricingVariants(item: MenuItem): boolean {
    return !!(item.pricingVariants && item.pricingVariants.length > 0);
  }

  getPricingVariants(item: MenuItem): PriceVariant[] {
    if (this.hasPricingVariants(item) && item.pricingVariants) {
      return item.pricingVariants.sort((a, b) => {
        // Sort by weight if available, otherwise by label
        const weightA = a.weight || this.extractWeight(a.label);
        const weightB = b.weight || this.extractWeight(b.label);
        if (weightA && weightB) {
          return weightA - weightB;
        }
        return a.label.localeCompare(b.label);
      });
    }
    return [];
  }

  extractWeight(label: string): number | undefined {
    // Extract numeric weight from label (e.g., "250 גרם" -> 250)
    const match = label.match(/(\d+)/);
    return match ? parseInt(match[1]) : undefined;
  }

  onPricingTypeChange(): void {
    const pricingType = this.itemForm.get('pricingType')?.value;
    
    if (pricingType === 'variants') {
      // Clear single price requirement
      this.itemForm.get('price')?.clearValidators();
      this.itemForm.get('price')?.updateValueAndValidity();
      
      // Clear options
      while (this.pricingOptionsFormArray.length !== 0) {
        this.pricingOptionsFormArray.removeAt(0);
      }
      
      // Add at least one variant if array is empty
      if (this.pricingVariantsFormArray.length === 0) {
        this.addPricingVariant();
      }
    } else if (pricingType === 'options') {
      // Clear single price requirement
      this.itemForm.get('price')?.clearValidators();
      this.itemForm.get('price')?.updateValueAndValidity();
      
      // Clear variants
      while (this.pricingVariantsFormArray.length !== 0) {
        this.pricingVariantsFormArray.removeAt(0);
      }
      
      // Add at least one option if array is empty
      if (this.pricingOptionsFormArray.length === 0) {
        this.addPricingOption();
      }
    } else {
      // Set single price requirement
      this.itemForm.get('price')?.setValidators([Validators.required, Validators.min(0.01)]);
      this.itemForm.get('price')?.updateValueAndValidity();
      
      // Clear variants and options
      while (this.pricingVariantsFormArray.length !== 0) {
        this.pricingVariantsFormArray.removeAt(0);
      }
      while (this.pricingOptionsFormArray.length !== 0) {
        this.pricingOptionsFormArray.removeAt(0);
      }
    }
  }

  addPricingVariant(label: string = '', price: number = 0): void {
    const variantGroup = this.fb.group({
      label: [label, Validators.required],
      price: [price, [Validators.required, Validators.min(0.01)]]
    });
    this.pricingVariantsFormArray.push(variantGroup);
  }

  removePricingVariant(index: number): void {
    if (this.pricingVariantsFormArray.length > 1) {
      this.pricingVariantsFormArray.removeAt(index);
    }
  }

  addPricingOption(label: string = '', amount: string = '', price: number = 0): void {
    const optionGroup = this.fb.group({
      label: [label, Validators.required],
      amount: [amount, Validators.required],
      price: [price, [Validators.required, Validators.min(0.01)]]
    });
    this.pricingOptionsFormArray.push(optionGroup);
  }

  removePricingOption(index: number): void {
    if (this.pricingOptionsFormArray.length > 1) {
      this.pricingOptionsFormArray.removeAt(index);
    }
  }

  // Recipe management methods
  addIngredient(): void {
    const ingredientGroup = this.fb.group({
      name: ['', Validators.required],
      quantity: [0, [Validators.required, Validators.min(0.01)]],
      unit: ['', Validators.required],
      category: ['', Validators.required]
    });
    this.recipeFormArray.push(ingredientGroup);
  }

  removeIngredient(index: number): void {
    if (this.recipeFormArray.length > 0) {
      this.recipeFormArray.removeAt(index);
    }
  }

  getImageUrl(imageUrl: string | undefined): string {
    if (!imageUrl || imageUrl.trim() === '') {
      return '/assets/images/placeholder-dish.jpg';
    }
    
    // If it's already a placeholder, return it
    if (imageUrl.includes('placeholder-dish.jpg')) {
      return '/assets/images/placeholder-dish.jpg';
    }
    
    // If it's an absolute URL, return it as is
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      return imageUrl;
    }
    
    // Extract image name to check if it's missing
    const imageName = imageUrl.split('/').pop()?.toLowerCase() || '';
    
    // List of known missing images - use placeholder instead
    const missingImages = new Set([
      'eggplant-tahini.jpg',
      'cholent.jpg',
      'hummus-salad.jpg',
      'tabbouleh.jpg',
      'potato-kugel.jpg',
      'malabi-berries.jpg',
      'parve-cholent.jpg',
      'honey-cake.jpg',
      'liver-onions.jpg',
      'green-salad.jpg',
      'basmati-rice.jpg',
      'vegetable-soup.jpg',
      'stuffed-chicken.jpg',
      'egg-salad.jpg',
      'red-cabbage-salad.jpg',
      'eggplant-tomato-salad.jpg',
      'sweet-potato-salad.jpg',
      'quinoa-salad.jpg',
      'black-lentil-salad.jpg',
      'beef-asado.jpg',
      'baked-salmon.jpg',
      'moussaka.jpg',
      'fettuccine-alfredo.jpg',
      'rosemary-potatoes.jpg',
      'grilled-vegetables.jpg',
      'tiramisu.jpg',
      'chocolate-mousse.jpg',
      'cholent-kishke.jpg',
      'gefilte-fish.jpg',
      'charoset.jpg'
    ]);
    
    // If image is missing, return placeholder immediately
    if (imageName && missingImages.has(imageName)) {
      return '/assets/images/placeholder-dish.jpg';
    }
    
    // Normalize the URL - ensure it starts with /assets/images/ if it's a relative path
    if (imageUrl.startsWith('/assets/')) {
      // Already has /assets/ prefix, return as is
      return imageUrl;
    }
    
    // If URL doesn't start with /, add /assets/images/
    if (!imageUrl.startsWith('/')) {
      return `/assets/images/${imageUrl}`;
    }
    
    // If it starts with / but not /assets/, assume it should be in /assets/images/
    if (!imageUrl.startsWith('/assets/')) {
      // Remove leading / and add /assets/images/
      const cleanPath = imageUrl.startsWith('/') ? imageUrl.substring(1) : imageUrl;
      return `/assets/images/${cleanPath}`;
    }
    
    return imageUrl;
  }
}

