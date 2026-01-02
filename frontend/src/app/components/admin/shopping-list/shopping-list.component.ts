import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

interface ShoppingListItem {
  name: string;
  total: number;
  unit: string;
  category: string;
}

interface ShoppingListByCategory {
  [category: string]: ShoppingListItem[];
}

@Component({
  selector: 'app-shopping-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="shopping-list-page">
      <div class="container">
        <!-- Top Toolbar -->
        <div class="toolbar">
          <div class="toolbar-left">
            <h1 class="page-title">
              <i class="fas fa-shopping-basket"></i>
              רשימת קניות מרוכזת
            </h1>
          </div>
          <div class="toolbar-right">
            <div class="safety-margin-toggle">
              <label class="toggle-switch">
                <input type="checkbox" [(ngModel)]="safetyMarginEnabled" (change)="onSafetyMarginChange()">
                <span class="toggle-label-text">הוסף 10% ביטחון</span>
              </label>
            </div>
            <button class="btn-export" (click)="copyToWhatsApp()">
              <i class="fab fa-whatsapp"></i>
              העתק לוואטסאפ
            </button>
          </div>
        </div>

        <!-- Loading State -->
        <div *ngIf="isLoading" class="loading">
          <i class="fas fa-spinner fa-spin"></i>
          <span>מחשב רשימת קניות...</span>
        </div>

        <!-- Error State -->
        <div *ngIf="errorMessage" class="error-message">
          <i class="fas fa-exclamation-circle"></i>
          {{ errorMessage }}
        </div>

        <!-- Shopping List by Category -->
        <div *ngIf="!isLoading && !errorMessage && shoppingList" class="shopping-list-container">
          <!-- Empty State -->
          <div *ngIf="getCategoryCount() === 0" class="empty-state">
            <i class="fas fa-shopping-basket"></i>
            <h3>אין הזמנות פעילות</h3>
            <p>לא נמצאו הזמנות פעילות לחישוב רשימת קניות</p>
          </div>

          <!-- Category Cards Grid -->
          <div *ngIf="getCategoryCount() > 0" class="categories-grid">
            <div *ngFor="let category of getCategories()" class="category-card">
              <!-- Category Header -->
              <div class="category-header">
                <div class="category-title-row">
                  <h2 class="category-title">{{ translateCategory(category) }}</h2>
                  <span class="category-badge">{{ getItemCount(category) }} פריטים</span>
                </div>
              </div>
              
              <!-- Ingredients List -->
              <div class="items-list">
                <div *ngFor="let item of shoppingList[category]; let last = last" class="item-row" [class.last-row]="last">
                  <div class="item-name">{{ item.name }}</div>
                  <div class="item-quantity">{{ formatQuantity(item.total) }}</div>
                  <div class="item-unit">{{ translateUnit(item.unit) }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .shopping-list-page {
      padding: 2rem;
      min-height: 100vh;
      background: #f3f4f6;
    }

    .container {
      max-width: 1400px;
      margin: 0 auto;
    }

    /* Top Toolbar */
    .toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2rem;
      padding: 1.5rem;
      background: white;
      border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }

    .toolbar-left {
      display: flex;
      align-items: center;
    }

    .page-title {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      font-size: 1.75rem;
      font-weight: 700;
      color: #1e293b;
      margin: 0;
    }

    .page-title i {
      color: #10b981;
    }

    .toolbar-right {
      display: flex;
      align-items: center;
      gap: 1.5rem;
    }

    /* Toggle Switch */
    .safety-margin-toggle {
      display: flex;
      align-items: center;
    }

    .toggle-switch {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      cursor: pointer;
      position: relative;
    }

    .toggle-switch input[type="checkbox"] {
      width: 44px;
      height: 24px;
      appearance: none;
      background: #cbd5e1;
      border-radius: 9999px;
      cursor: pointer;
      transition: all 0.3s ease;
      position: relative;
    }

    .toggle-switch input[type="checkbox"]::before {
      content: '';
      position: absolute;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: white;
      top: 2px;
      left: 2px;
      transition: transform 0.3s ease;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    }

    .toggle-switch input[type="checkbox"]:checked {
      background: #10b981;
    }

    .toggle-switch input[type="checkbox"]:checked::before {
      transform: translateX(20px);
    }

    .toggle-label-text {
      font-weight: 600;
      color: #475569;
      font-size: 0.9rem;
      user-select: none;
    }

    /* Export Button */
    .btn-export {
      padding: 0.75rem 1.5rem;
      background: #10b981;
      color: white;
      border: none;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.95rem;
    }

    .btn-export:hover {
      background: #059669;
      transform: translateY(-2px);
      box-shadow: 0 4px 8px rgba(16, 185, 129, 0.3);
    }

    /* Loading & Error States */
    .loading {
      text-align: center;
      padding: 4rem 2rem;
      color: #64748b;
    }

    .loading i {
      font-size: 2.5rem;
      margin-bottom: 1rem;
      color: #10b981;
    }

    .error-message {
      background: #fee2e2;
      color: #991b1b;
      padding: 1rem 1.5rem;
      border-radius: 8px;
      margin-bottom: 2rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    /* Shopping List Container */
    .shopping-list-container {
      margin-top: 0;
    }

    .empty-state {
      text-align: center;
      padding: 4rem 2rem;
      background: white;
      border-radius: 16px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
    }

    .empty-state i {
      font-size: 4rem;
      color: #cbd5e1;
      margin-bottom: 1rem;
    }

    .empty-state h3 {
      color: #475569;
      margin-bottom: 0.5rem;
      font-size: 1.5rem;
    }

    .empty-state p {
      color: #64748b;
    }

    /* Categories Grid */
    .categories-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 1.5rem;
    }

    /* Category Card */
    .category-card {
      background: white;
      border-radius: 16px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
      overflow: hidden;
    }

    /* Category Header */
    .category-header {
      padding: 1.25rem 1.5rem;
      border-bottom: 1px solid #e2e8f0;
      background: white;
    }

    .category-title-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .category-title {
      font-size: 1.25rem;
      font-weight: 700;
      color: #1e293b;
      margin: 0;
    }

    .category-badge {
      background: #d1fae5;
      color: #065f46;
      padding: 0.375rem 0.75rem;
      border-radius: 9999px;
      font-size: 0.875rem;
      font-weight: 600;
    }

    /* Items List */
    .items-list {
      padding: 0;
    }

    .item-row {
      display: grid;
      grid-template-columns: 2fr 1fr 1fr;
      gap: 1rem;
      padding: 0.75rem 1.5rem;
      align-items: center;
      border-bottom: 1px dotted #e2e8f0;
    }

    .item-row.last-row {
      border-bottom: none;
    }

    .item-row:hover {
      background: #f8fafc;
    }

    .item-name {
      font-weight: 600;
      color: #1e293b;
      text-align: right;
    }

    .item-quantity {
      font-size: 1.25rem;
      font-weight: 700;
      color: #1e293b;
      text-align: center;
    }

    .item-unit {
      color: #64748b;
      font-size: 0.9rem;
      text-align: left;
    }

    /* Responsive */
    @media (max-width: 1024px) {
      .categories-grid {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 768px) {
      .shopping-list-page {
        padding: 1rem;
      }

      .toolbar {
        flex-direction: column;
        gap: 1rem;
        align-items: flex-start;
      }

      .toolbar-right {
        width: 100%;
        flex-direction: column;
        align-items: stretch;
      }

      .btn-export {
        width: 100%;
        justify-content: center;
      }

      .item-row {
        grid-template-columns: 1fr;
        gap: 0.5rem;
        text-align: right;
      }

      .item-quantity,
      .item-unit {
        text-align: right;
      }
    }
  `]
})
export class ShoppingListComponent implements OnInit {
  private http = inject(HttpClient);
  
  shoppingList: ShoppingListByCategory | null = null;
  isLoading = false;
  errorMessage = '';
  safetyMarginEnabled = false;

  ngOnInit(): void {
    this.loadShoppingList();
  }

  loadShoppingList(): void {
    this.isLoading = true;
    this.errorMessage = '';
    
    const safetyMargin = this.safetyMarginEnabled ? 10 : 0;
    const url = `${environment.apiUrl}/shopping?safetyMargin=${safetyMargin}`;
    
    this.http.get<{ success: boolean; data: ShoppingListByCategory }>(url).subscribe({
      next: (response) => {
        if (response.success) {
          this.shoppingList = response.data;
          console.log('🛒 Shopping list loaded:', this.shoppingList);
        } else {
          this.errorMessage = 'שגיאה בטעינת רשימת הקניות';
        }
        this.isLoading = false;
      },
      error: (error) => {
        console.error('❌ Error loading shopping list:', error);
        this.errorMessage = 'שגיאה בטעינת רשימת הקניות. אנא נסה שוב.';
        this.isLoading = false;
      }
    });
  }

  onSafetyMarginChange(): void {
    this.loadShoppingList();
  }

  getCategories(): string[] {
    if (!this.shoppingList) return [];
    return Object.keys(this.shoppingList).sort();
  }

  getCategoryCount(): number {
    return this.getCategories().length;
  }

  getItemCount(category: string): number {
    if (!this.shoppingList || !this.shoppingList[category]) return 0;
    return this.shoppingList[category].length;
  }

  formatQuantity(quantity: number): string {
    // Round to 2 decimal places, remove trailing zeros
    return parseFloat(quantity.toFixed(2)).toString();
  }

  translateCategory(category: string): string {
    const translations: { [key: string]: string } = {
      'General': 'כללי',
      'Vegetables': 'ירקות',
      'Fish': 'דגים',
      'Meat': 'בשר',
      'Dry Goods': 'מוצרים יבשים',
      'Spices': 'תבלינים',
      'Dairy': 'מוצרי חלב',
      'Other': 'אחר',
      'כללי / מוצרים ללא מתכון': 'כללי / מוצרים ללא מתכון'
    };
    return translations[category] || category;
  }

  translateUnit(unit: string): string {
    const translations: { [key: string]: string } = {
      'piece': 'יח\'',
      'יחידות': 'יח\'',
      'kg': 'ק"ג',
      'g': 'גרם',
      'liter': 'ליטר',
      'l': 'ליטר',
      'ml': 'מ"ל',
      'bunch': 'חבילה',
      'חבילה': 'חבילה'
    };
    return translations[unit] || unit;
  }

  copyToWhatsApp(): void {
    if (!this.shoppingList || this.getCategoryCount() === 0) {
      alert('אין פריטים להעתקה');
      return;
    }

    const date = new Date().toLocaleDateString('he-IL');
    let message = `🛒 רשימת קניות מרוכזת - מגדים\n📅 ${date}\n\n`;

    this.getCategories().forEach(category => {
      message += `📁 ${this.translateCategory(category)}\n`;
      message += '─'.repeat(20) + '\n';
      
      this.shoppingList![category].forEach(item => {
        message += `• ${item.name}: ${this.formatQuantity(item.total)} ${this.translateUnit(item.unit)}\n`;
      });
      
      message += '\n';
    });

    // Copy to clipboard
    navigator.clipboard.writeText(message).then(() => {
      alert('✅ הרשימה הועתקה ללוח! ניתן להדביק בוואטסאפ');
    }).catch((err) => {
      console.error('Failed to copy:', err);
      // Fallback: show in prompt
      prompt('העתק את הטקסט הבא:', message);
    });
  }
}

