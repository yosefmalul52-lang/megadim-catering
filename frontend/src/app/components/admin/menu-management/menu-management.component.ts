import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { MenuService, MenuItem, PriceVariant } from '../../../services/menu.service';

@Component({
  selector: 'app-menu-management',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  template: `
    <div class="menu-management">
      <div class="container">
        <div class="header">
          <h1>ניהול תפריט</h1>
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
              
              <table class="items-table">
                <thead>
                  <tr>
                    <th>תמונה</th>
                    <th>שם</th>
                    <th>תיאור</th>
                    <th>מחיר</th>
                    <th>מלאי</th>
                    <th>מומלץ</th>
                    <th>פעולות</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let item of categoryGroup.items; trackBy: trackByItemId">
                    <td class="image-cell">
                      <div class="image-wrapper">
                        <img [src]="item.imageUrl || '/assets/images/placeholder-dish.jpg'" 
                             [alt]="item.name" 
                             class="item-thumbnail" 
                             (error)="onImageError($event)"
                             loading="lazy"
                             [attr.data-item-id]="item.id">
                      </div>
                    </td>
                    <td class="name-cell">{{ item.name }}</td>
                    <td class="description-cell">
                      <span *ngIf="item.description && item.description.trim()">{{ item.description }}</span>
                      <span *ngIf="!item.description || !item.description.trim()" class="no-description">
                        <i class="fas fa-info-circle"></i>
                        אין תיאור
                      </span>
                    </td>
                    <td class="price-cell">
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
                    </td>
                    <td class="toggle-cell">
                      <label class="toggle-switch">
                        <input 
                          type="checkbox" 
                          [checked]="item.isAvailable !== false"
                          (change)="toggleStatus(item, 'isAvailable', $event)"
                          [attr.aria-label]="'מלאי עבור ' + item.name"
                        >
                        <span class="toggle-slider"></span>
                      </label>
                    </td>
                    <td class="toggle-cell">
                      <label class="toggle-switch" [title]="item.isPopular ? 'מומלץ - לחץ לביטול' : 'לא מומלץ - לחץ להפוך למומלץ'">
                        <input 
                          type="checkbox" 
                          [checked]="item.isPopular === true"
                          (change)="toggleStatus(item, 'isPopular', $event)"
                          [attr.aria-label]="'מומלץ עבור ' + item.name"
                        >
                        <span class="toggle-slider"></span>
                      </label>
                      <span class="toggle-label" *ngIf="item.isPopular">⭐</span>
                    </td>
                    <td class="actions-cell">
                      <button class="btn-edit" (click)="openEditModal(item)" 
                              [title]="'ערוך כרטיסייה: ' + item.name" 
                              type="button"
                              [attr.aria-label]="'ערוך ' + item.name">
                        <i class="fas fa-edit"></i>
                        <span>ערוך</span>
                      </button>
                      <button class="btn-delete" (click)="deleteItem(item.id || item._id || '')" 
                              [title]="'מחק כרטיסייה: ' + item.name" 
                              type="button"
                              [attr.aria-label]="'מחק ' + item.name">
                        <i class="fas fa-trash"></i>
                        <span>מחק</span>
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
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
              <button class="btn-close" (click)="closeModal()">
                <i class="fas fa-times"></i>
              </button>
            </div>

            <form [formGroup]="itemForm" (ngSubmit)="saveItem()" class="modal-body">
              <div class="form-group">
                <label>שם הכרטיסייה *</label>
                <input type="text" formControlName="name" required>
              </div>

              <div class="form-group">
                <label>קטגוריה *</label>
                <select formControlName="category" required>
                  <option value="">בחר קטגוריה</option>
                  <option *ngFor="let cat of categories" [value]="cat.name">{{ cat.name }}</option>
                </select>
              </div>

              <div class="form-group">
                <label>תיאור</label>
                <textarea formControlName="description" rows="3"></textarea>
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
                           class="price-input">
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
                        <input type="text" formControlName="label" placeholder="גודל (למשל: 250 גרם)" class="variant-label">
                        <input type="number" formControlName="price" step="0.01" min="0" placeholder="מחיר" class="variant-price-input">
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
                        <input type="text" formControlName="label" placeholder="תווית (למשל: Small Tray)" class="option-label">
                        <input type="text" formControlName="amount" placeholder="כמות (למשל: 10 people)" class="option-amount">
                        <input type="number" formControlName="price" step="0.01" min="0" placeholder="מחיר" class="option-price-input">
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
                <label>כתובת תמונה (URL)</label>
                <input type="text" formControlName="imageUrl" placeholder="/assets/images/...">
                <small>הזן נתיב לתמונה או URL</small>
              </div>

              <div class="form-group">
                <label>תגיות (מופרדות בפסיק)</label>
                <input type="text" formControlName="tags" placeholder="תגית1, תגית2">
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

              <div class="form-actions">
                <button type="button" class="btn-cancel" (click)="closeModal()">ביטול</button>
                <button type="submit" class="btn-save" [disabled]="!itemForm.valid">
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
    .menu-management {
      padding: 2rem 0;
      min-height: 60vh;
      background-color: #f5f5f5;
    }

    .container {
      max-width: 1400px;
      margin: 0 auto;
      padding: 0 2rem;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2rem;
    }

    .header h1 {
      color: #0E1A24;
      margin: 0;
    }

    .btn-add {
      background: #1f3444;
      color: white;
      border: none;
      padding: 0.75rem 1.5rem;
      border-radius: 0.5rem;
      cursor: pointer;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      transition: background 0.3s ease;
    }

    .btn-add:hover {
      background: #2a4a5f;
    }

    .category-filter {
      margin-bottom: 2rem;
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .category-filter label {
      font-weight: 600;
      color: #0E1A24;
    }

    .category-filter select {
      padding: 0.5rem 1rem;
      border: 1px solid #ddd;
      border-radius: 0.5rem;
      font-size: 1rem;
      min-width: 200px;
    }

    .menu-items-table {
      background: white;
      border-radius: 0.75rem;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }
    
    .table-header-info {
      padding: 1rem 1.5rem;
      background: #f8f9fa;
      border-bottom: 1px solid #dee2e6;
      font-weight: 600;
      color: #1f3444;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    
    .table-header-info i {
      color: #1f3444;
    }
    
    .info-note {
      font-size: 0.875rem;
      font-weight: normal;
      color: #6c757d;
      margin-right: 1rem;
    }

    .categories-container {
      display: flex;
      flex-direction: column;
      gap: 2rem;
    }
    
    .category-section {
      background: white;
      border-radius: 0.75rem;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }
    
    .category-header {
      background: linear-gradient(135deg, #1f3444 0%, #2a4a5f 100%);
      padding: 1.25rem 1.5rem;
      border-bottom: 2px solid #cbb69e;
    }
    
    .category-title {
      margin: 0;
      color: white;
      font-size: 1.25rem;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    
    .category-title i {
      color: #cbb69e;
    }
    
    .category-count {
      font-size: 0.9rem;
      font-weight: normal;
      opacity: 0.9;
      color: #cbb69e;
    }

    .items-table {
      width: 100%;
      border-collapse: collapse;
    }

    .items-table thead {
      background: #f8f9fa;
      color: #1f3444;
      border-bottom: 2px solid #dee2e6;
    }

    .items-table th {
      padding: 1rem;
      text-align: right;
      font-weight: 600;
      color: #1f3444;
      font-size: 0.95rem;
    }

    .items-table td {
      padding: 1rem;
      border-top: 1px solid #eee;
      vertical-align: top;
    }
    
    .description-cell {
      max-width: 300px;
      line-height: 1.5;
      color: #6c757d;
      font-size: 0.9rem;
    }
    
    .description-cell .no-description {
      color: #999;
      font-style: italic;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    
    .description-cell .no-description i {
      color: #cbb69e;
    }
    
    .price-cell .no-price {
      color: #dc3545;
      font-size: 0.875rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    
    .price-cell .no-price i {
      color: #dc3545;
    }

    .image-cell {
      width: 100px;
      min-width: 100px;
      text-align: center;
    }
    
    .image-wrapper {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
    }

    .item-thumbnail {
      width: 80px;
      height: 80px;
      object-fit: cover;
      border-radius: 0.5rem;
      background-color: #f5f5f5;
      display: block;
      min-width: 80px;
      min-height: 80px;
      border: 1px solid #e0e0e0;
    }
    
    .item-thumbnail[data-error-handled="true"] {
      opacity: 0.7;
      background-color: #e0e0e0;
    }

    .actions-cell {
      display: flex;
      gap: 0.5rem;
    }

    .btn-edit, .btn-delete {
      padding: 0.5rem 1rem;
      border: none;
      border-radius: 0.5rem;
      cursor: pointer;
      font-size: 0.875rem;
      display: flex;
      align-items: center;
      gap: 0.25rem;
      transition: all 0.3s ease;
      font-weight: 500;
    }

    .btn-edit {
      background: #cbb69e;
      color: #0E1A24;
    }

    .btn-edit:hover {
      background: #b8a48a;
      transform: translateY(-1px);
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    .btn-delete {
      background: #dc3545;
      color: white;
    }

    .btn-delete:hover {
      background: #c82333;
      transform: translateY(-1px);
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
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
      color: #1f3444;
      font-weight: 600;
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
      color: #cbb69e;
    }
    
    .single-price {
      font-weight: 600;
      color: #1f3444;
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
      display: inline-block;
      width: 50px;
      height: 26px;
      margin: 0;
      cursor: pointer;
    }

    .toggle-switch input {
      opacity: 0;
      width: 0;
      height: 0;
    }

    .toggle-slider {
      position: absolute;
      cursor: pointer;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: #ccc;
      transition: 0.3s;
      border-radius: 26px;
    }

    .toggle-slider:before {
      position: absolute;
      content: "";
      height: 20px;
      width: 20px;
      left: 3px;
      bottom: 3px;
      background-color: white;
      transition: 0.3s;
      border-radius: 50%;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    }

    .toggle-switch input:checked + .toggle-slider {
      background-color: #28a745;
    }

    .toggle-switch input:checked + .toggle-slider:before {
      transform: translateX(24px);
    }

    .toggle-switch input:focus + .toggle-slider {
      box-shadow: 0 0 0 3px rgba(40, 167, 69, 0.25);
    }

    .toggle-switch:hover .toggle-slider {
      box-shadow: 0 0 0 3px rgba(40, 167, 69, 0.15);
    }

    .toggle-switch input:disabled + .toggle-slider {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .toggle-label {
      display: inline-block;
      margin-right: 0.5rem;
      font-size: 1rem;
      vertical-align: middle;
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
      border-radius: 0.75rem;
      width: 90%;
      max-width: 600px;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
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
      width: 100%;
      padding: 0.75rem;
      border: 1px solid #ddd;
      border-radius: 0.5rem;
      font-size: 1rem;
      font-family: inherit;
    }

    .form-group small {
      display: block;
      margin-top: 0.25rem;
      color: #6c757d;
      font-size: 0.875rem;
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

      .menu-items-table {
        overflow-x: auto;
      }

      .items-table {
        min-width: 800px;
      }
      
      .description-cell {
        max-width: 200px;
      }

      .modal-content {
        width: 95%;
        margin: 1rem;
      }
    }
  `]
})
export class MenuManagementComponent implements OnInit {
  menuService = inject(MenuService);
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
    isAvailable: [true],
    isPopular: [false]
  });

  get pricingVariantsFormArray(): FormArray {
    return this.itemForm.get('pricingVariants') as FormArray;
  }

  get pricingOptionsFormArray(): FormArray {
    return this.itemForm.get('pricingOptions') as FormArray;
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

