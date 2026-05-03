import { Component, OnInit, inject, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OrderService, KitchenReportMeta } from '../../../services/order.service';

export interface KitchenReportItem {
  productName: string;
  category: string;
  totalPackages: number;
  totalWeightRaw: number;
  displayWeight: string;
  unit?: string;
  isUnitOnly?: boolean; // Flag to indicate if this category should show units only
  prepWindow?: 'now' | 'soon' | 'later';
  prepWindowLabel?: string;
  prepSortOrder?: number;
}

export interface GroupedKitchenReport {
  category: string;
  items: KitchenReportItem[];
}

@Component({
  selector: 'app-kitchen-report-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal-overlay" (click)="close()">
      <div class="modal-container" [class.expanded]="isExpanded" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h2 class="modal-title">
            <i class="fas fa-utensils"></i>
            דוח הכנות למטבח
          </h2>
          <div class="header-actions">
            <button
              class="resize-btn"
              type="button"
              (click)="toggleExpanded()"
              [attr.aria-label]="isExpanded ? 'הקטן דוח' : 'הגדל דוח'"
              [title]="isExpanded ? 'הקטן דוח' : 'הגדל דוח'"
            >
              <i class="fas" [ngClass]="isExpanded ? 'fa-compress' : 'fa-expand'"></i>
            </button>
            <button class="close-btn" (click)="close()" aria-label="סגור">
              <i class="fas fa-times"></i>
            </button>
          </div>
        </div>

        <div class="modal-body">
          <div class="report-date">
            <i class="fas fa-calendar"></i>
            תאריך: {{ todayDate }}
          </div>

          <div class="report-status">
            <span class="status-chip">{{ filterStatusLabel }}</span>
            <span class="status-chip">הזמנות פעילות: {{ reportMeta?.activeOrdersCount ?? 0 }}</span>
            <span class="status-chip">קבוצות: {{ visibleGroups.length }}</span>
            <span class="status-chip">פריטים: {{ totalItemsCount }}</span>
            <span class="status-chip">יחידות: {{ totalUnitsCount }}</span>
            <span class="status-chip status-chip-accent">עכשיו להכנה: {{ nowPrepCount }}</span>
          </div>

          <div class="filter-bar">
            <div class="filter-group">
              <label for="kitchen-date-filter">תאריך הזמנה:</label>
              <input
                id="kitchen-date-filter"
                type="date"
                [value]="selectedDate || ''"
                (change)="onDateChange($event)"
              />
              <button type="button" class="btn-clear-date" (click)="clearDateFilter()">
                כל התאריכים
              </button>
            </div>

            <div class="filter-group">
              <label for="kitchen-category-filter">קטגוריה:</label>
              <select
                id="kitchen-category-filter"
                [value]="selectedCategory"
                (change)="onCategoryChange($event)"
              >
                <option value="ALL">כל הקטגוריות / המנות</option>
                <option *ngFor="let category of availableCategories" [value]="category">
                  {{ category }}
                </option>
              </select>
            </div>

            <div class="filter-group prep-toggle-group">
              <label class="toggle-inline">
                <input
                  type="checkbox"
                  [checked]="onlyNowPrep"
                  (change)="onOnlyNowPrepChange($event)"
                />
                <span>הצג רק עכשיו להכנה</span>
              </label>
            </div>
          </div>

          <div *ngIf="isLoading" class="loading-state">
            <i class="fas fa-spinner fa-spin"></i>
            <span>טוען דוח...</span>
          </div>

          <div *ngIf="!isLoading && loadError" class="empty-state">
            <i class="fas fa-triangle-exclamation"></i>
            <p>שגיאה בטעינת הדוח. נסה לרענן שוב.</p>
          </div>

          <div *ngIf="!isLoading && !loadError && reportItems.length === 0" class="empty-state">
            <i class="fas fa-clipboard-list"></i>
            <p>אין הזמנות פעילות כרגע</p>
          </div>

          <div *ngIf="!isLoading && !loadError && reportItems.length > 0 && visibleGroups.length === 0" class="empty-state">
            <i class="fas fa-filter-circle-xmark"></i>
            <p>אין תוצאות עבור הפילטר שנבחר</p>
          </div>

          <div *ngIf="!isLoading && visibleGroups.length > 0" class="report-groups-container">
            <div *ngFor="let group of visibleGroups" class="category-group">
              <h3 class="category-header">{{ group.category }}</h3>
              <div class="report-table-container">
                <table class="kitchen-report-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>שם הפריט</th>
                      <th>יחידות</th>
                      <th>תזמון הכנה</th>
                      <th>משקל כולל להכנה</th>
                      <th>בוצע</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let item of group.items; let i = index" [class.priority-row]="isHighPriority(item)">
                      <td class="row-number">{{ i + 1 }}</td>
                      <td class="product-name">{{ item.productName }}</td>
                      <td class="quantity">{{ item.totalPackages }} יח'</td>
                      <td class="prep-window-cell">
                        <span class="prep-badge" [ngClass]="'prep-' + (item.prepWindow || 'later')">
                          {{ item.prepWindowLabel || getPrepWindowLabel(item.prepWindow) }}
                        </span>
                      </td>
                      <td class="weight">{{ item.displayWeight }}</td>
                      <td class="done-cell">
                        <input
                          type="checkbox"
                          [ngModel]="isDone(item)"
                          (ngModelChange)="setDone(item, $event)"
                          (click)="$event.stopPropagation()"
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div class="divider"></div>
            </div>
          </div>
          
        </div>

        <div class="modal-footer" *ngIf="!isLoading && visibleGroups.length > 0">
          <button class="btn-save-done" (click)="saveDoneChanges()" [disabled]="!hasUnsavedDoneChanges">
            <i class="fas fa-check"></i>
            שמור סימוני בוצע
          </button>
          <button class="btn-print" (click)="printReport()">
            <i class="fas fa-print"></i>
            הדפס דוח
          </button>
          <button class="btn-close-footer" (click)="close()">
            סגור
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(15, 23, 42, 0.42);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      padding: 2rem;
      direction: rtl;
    }

    .modal-container {
      background: white;
      border-radius: 10px;
      box-shadow: 0 18px 36px rgba(15, 23, 42, 0.18);
      max-width: 800px;
      width: 100%;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .modal-container.expanded {
      max-width: 96vw;
      width: 96vw;
      max-height: 94vh;
      height: 94vh;
    }

    .modal-header {
      padding: 1.5rem 2rem;
      border-bottom: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #f8fafc;
    }

    .header-actions {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
    }

    .modal-title {
      margin: 0;
      font-size: 1.5rem;
      font-weight: 700;
      color: #1a2a3a;
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .modal-title i {
      color: #1a2a3a;
    }

    .close-btn {
      background: none;
      border: none;
      font-size: 1.5rem;
      color: #6c757d;
      cursor: pointer;
      padding: 0.5rem;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
      transition: all 0.2s;
    }

    .resize-btn {
      background: none;
      border: none;
      font-size: 1.15rem;
      color: #6c757d;
      cursor: pointer;
      padding: 0.5rem;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
      transition: all 0.2s;
    }

    .close-btn:hover {
      background: #e0e0e0;
      color: #1a2a3a;
    }

    .resize-btn:hover {
      background: #e0e0e0;
      color: #1a2a3a;
    }

    .modal-body {
      padding: 2rem;
      overflow-y: auto;
      flex: 1;
    }

    .report-date {
      margin-bottom: 1rem;
      padding: 0.75rem 1rem;
      background: #f8fafc;
      border-radius: 6px;
      font-weight: 600;
      color: #1a2a3a;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .report-date i {
      color: #1a2a3a;
    }

    .report-status {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-bottom: 1rem;
    }

    .status-chip {
      display: inline-flex;
      align-items: center;
      padding: 0.35rem 0.65rem;
      border: 1px solid #dde3ea;
      border-radius: 6px;
      background: #f8fafc;
      color: #1a2a3a;
      font-size: 0.88rem;
      font-weight: 600;
    }

    .status-chip-accent {
      border-color: #bfdbfe;
      color: #1d4ed8;
      background: #eff6ff;
    }

    .filter-bar {
      display: flex;
      flex-wrap: wrap;
      gap: 1rem;
      align-items: end;
      justify-content: space-between;
      margin-bottom: 1.5rem;
      padding: 0.75rem 1rem;
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
    }

    .filter-group {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    .filter-group label {
      font-weight: 600;
      color: #334155;
    }

    .filter-group input,
    .filter-group select {
      border: 1px solid #d6d6d6;
      border-radius: 6px;
      padding: 0.4rem 0.6rem;
      font-size: 0.95rem;
      min-width: 170px;
      background: #fff;
      color: #0f172a;
    }

    .toggle-inline {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      color: #334155;
      font-weight: 600;
    }

    .toggle-inline input[type='checkbox'] {
      width: 16px;
      height: 16px;
    }

    .btn-clear-date {
      border: 1px solid #d6d6d6;
      background: #f5f5f5;
      color: #1a2a3a;
      border-radius: 6px;
      padding: 0.45rem 0.8rem;
      cursor: pointer;
      font-weight: 600;
    }

    .btn-clear-date:hover {
      background: #ececec;
    }

    .loading-state,
    .empty-state {
      text-align: center;
      padding: 3rem;
      color: #6c757d;
    }

    .loading-state i,
    .empty-state i {
      font-size: 3rem;
      margin-bottom: 1rem;
      color: #1a2a3a;
    }

    .report-groups-container {
      display: flex;
      flex-direction: column;
      gap: 2rem;
    }

    .category-group {
      margin-bottom: 2rem;
      page-break-inside: avoid; /* Prevent table from being cut in the middle when printing */
    }

    .divider {
      height: 1px;
      background: #e0e0e0;
      margin: 1.5rem 0;
    }

    .category-header {
      margin: 0 0 1rem 0;
      padding: 0.85rem 1rem;
      background: #f8fafc;
      color: #0f172a;
      font-size: 1rem;
      font-weight: 700;
      border-radius: 8px;
      text-align: right;
      border: 1px solid #e2e8f0;
    }

    .report-table-container {
      overflow-x: auto;
      margin-top: 0;
    }

    .kitchen-report-table {
      width: 100%;
      border-collapse: collapse;
      background: white;
    }

    .kitchen-report-table thead {
      background: #f1f5f9;
      color: #334155;
      position: sticky;
      top: 0;
      z-index: 1;
    }

    .kitchen-report-table th {
      padding: 1rem;
      text-align: right;
      font-weight: 700;
      font-size: 0.95rem;
      border-bottom: 1px solid #cbd5e1;
    }

    .kitchen-report-table tbody tr {
      border-bottom: 1px solid #e0e0e0;
      transition: background 0.15s;
    }

    .kitchen-report-table tbody tr:hover {
      background: #f8fafc;
    }

    .kitchen-report-table tbody tr.priority-row {
      background: #f8fafc;
    }

    .kitchen-report-table td {
      padding: 1rem;
      text-align: right;
      color: #1a2a3a;
    }

    .row-number {
      font-weight: 600;
      color: #6c757d;
      width: 50px;
    }

    .product-name {
      font-weight: 600;
      color: #1a2a3a;
    }

    .quantity {
      font-weight: 700;
      color: #1a2a3a;
      font-size: 1.1rem;
      text-align: center;
    }

    .weight {
      font-weight: 700;
      color: #0f172a;
      font-size: 1rem;
      text-align: center;
      background: #f8fafc;
      padding: 0.5rem;
      border-radius: 4px;
    }

    .prep-window-cell {
      text-align: center;
    }

    .prep-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 118px;
      border-radius: 999px;
      border: 1px solid #dbe3ec;
      padding: 0.22rem 0.6rem;
      font-size: 0.78rem;
      font-weight: 700;
      background: #f8fafc;
      color: #334155;
      white-space: nowrap;
    }

    .prep-badge.prep-now {
      border-color: #bfdbfe;
      background: #eff6ff;
      color: #1d4ed8;
    }

    .prep-badge.prep-soon {
      border-color: #fde68a;
      background: #fffbeb;
      color: #92400e;
    }

    .prep-badge.prep-later {
      border-color: #dbe3ec;
      background: #f8fafc;
      color: #475569;
    }

    .done-cell {
      text-align: center;
    }

    .done-cell input[type='checkbox'] {
      width: 18px;
      height: 18px;
      cursor: pointer;
    }

    .modal-footer {
      padding: 1.5rem 2rem;
      border-top: 2px solid #e0e0e0;
      display: flex;
      justify-content: flex-end;
      gap: 1rem;
      background: #f8f9fa;
    }

    .btn-save-done {
      padding: 0.75rem 1.5rem;
      background: #0f172a;
      color: #fff;
      border: none;
      border-radius: 6px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      transition: all 0.2s;
    }

    .btn-save-done:hover:not(:disabled) {
      background: #1e293b;
    }

    .btn-save-done:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }

    .btn-print {
      padding: 0.75rem 1.5rem;
      background: #1a2a3a;
      color: white;
      border: none;
      border-radius: 6px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      transition: all 0.2s;
    }

    .btn-print:hover {
      background: #2a3b4c;
      transform: translateY(-1px);
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
    }

    .btn-close-footer {
      padding: 0.75rem 1.5rem;
      background: #f5f5f5;
      color: #1a2a3a;
      border: 1px solid #e0e0e0;
      border-radius: 6px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn-close-footer:hover {
      background: #e8e8e8;
    }

    /* Print Styles */
    @media print {
      .modal-overlay {
        background: white;
        padding: 0;
      }

      .modal-container {
        box-shadow: none;
        max-width: 100%;
        max-height: 100%;
      }

      .modal-header,
      .modal-footer,
      .close-btn {
        display: none !important;
      }

      .modal-body {
        padding: 1rem;
      }

      .kitchen-report-table {
        font-size: 12pt;
      }

      .kitchen-report-table th,
      .kitchen-report-table td {
        padding: 0.5rem;
      }

      .category-group-print {
        margin-bottom: 2rem;
        page-break-inside: avoid;
        break-inside: avoid;
      }
      
      .category-group {
        page-break-inside: avoid;
        break-inside: avoid;
      }

      .category-header-print {
        background: #1a2a3a;
        color: white;
        padding: 0.75rem 1rem;
        margin: 0 0 0.5rem 0;
        font-size: 1.2rem;
        font-weight: 700;
        border-radius: 4px;
      }
    }
  `]
})
export class KitchenReportModalComponent implements OnInit {
  private orderService = inject(OrderService);

  @Output() closeModal = new EventEmitter<void>();

  reportItems: KitchenReportItem[] = [];
  selectedDate: string | null = null;
  selectedCategory: string = 'ALL';
  onlyNowPrep = false;
  isExpanded = false;
  isLoading = true;
  loadError = false;
  reportMeta: KitchenReportMeta | null = null;
  todayDate = '';
  private readonly doneStorageKey = 'kitchen_report_done_v1';
  private doneMap: Record<string, boolean> = {};
  private persistedDoneMap: Record<string, boolean> = {};
  visibleGroups: GroupedKitchenReport[] = [];
  visibleItemsCount = 0;
  visibleUnitsCount = 0;

  get availableCategories(): string[] {
    const set = new Set(
      this.reportItems
        .map((item) => (item.category || '').trim())
        .filter((category) => !!category)
    );
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }

  get hasDateFilter(): boolean {
    return !!(this.selectedDate && this.selectedDate.trim());
  }

  get filterStatusLabel(): string {
    return this.hasDateFilter ? `תאריך נבחר: ${this.selectedDate}` : 'כל התאריכים הפעילים';
  }

  get totalItemsCount(): number {
    return this.visibleItemsCount;
  }

  get totalUnitsCount(): number {
    return this.visibleUnitsCount;
  }

  get nowPrepCount(): number {
    return this.reportItems.filter((item) => (item.prepWindow || 'later') === 'now').length;
  }

  get hasUnsavedDoneChanges(): boolean {
    return JSON.stringify(this.doneMap) !== JSON.stringify(this.persistedDoneMap);
  }

  ngOnInit(): void {
    this.todayDate = this.formatDate(new Date());
    this.hydrateDoneMap();
    this.loadKitchenReport();
  }

  loadKitchenReport(date?: string | null): void {
    this.isLoading = true;
    this.loadError = false;
    const targetDate = date && date.trim() ? date.trim() : undefined;
    this.orderService.getKitchenReport(targetDate).subscribe({
      next: (response) => {
        this.reportItems = this.processData(response.items || []);
        this.reportMeta = response.meta || null;
        this.rebuildVisibleReport();
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading kitchen report:', error);
        this.reportItems = [];
        this.reportMeta = null;
        this.rebuildVisibleReport();
        this.loadError = true;
        this.isLoading = false;
      }
    });
  }

  onDateChange(event: Event): void {
    const value = (event.target as HTMLInputElement | null)?.value || '';
    this.selectedDate = value ? value : null;
    this.loadKitchenReport(this.selectedDate);
  }

  clearDateFilter(): void {
    this.selectedDate = null;
    this.loadKitchenReport(null);
  }

  onCategoryChange(event: Event): void {
    const value = (event.target as HTMLSelectElement | null)?.value || 'ALL';
    this.selectedCategory = value || 'ALL';
    this.rebuildVisibleReport();
  }

  onOnlyNowPrepChange(event: Event): void {
    this.onlyNowPrep = Boolean((event.target as HTMLInputElement | null)?.checked);
    this.rebuildVisibleReport();
  }

  getPrepWindowLabel(value: KitchenReportItem['prepWindow']): string {
    if (value === 'now') return 'עכשיו להכנה';
    if (value === 'soon') return 'להכין בקרוב';
    return 'לתכנון מאוחר יותר';
  }

  private processData(data: any[]): KitchenReportItem[] {
    if (!data || !Array.isArray(data)) {
      return [];
    }

    // Normalize and validate each item
    const processedItems: KitchenReportItem[] = data.map((item, index) => {
      // Ensure all required fields exist with correct property names
      const processed: KitchenReportItem = {
        productName: item.productName || item.name || item.title || `Unknown Product ${index + 1}`,
        category: item.category || 'כללי',
        totalPackages: item.totalPackages || item.quantity || item.packages || 0,
        totalWeightRaw: item.totalWeightRaw || 0,
        displayWeight: item.displayWeight || item.weight || item.totalWeight || '-',
        unit: item.unit || undefined,
        isUnitOnly: item.isUnitOnly || false,
        prepWindow: item.prepWindow || 'later',
        prepWindowLabel: item.prepWindowLabel || this.getPrepWindowLabel(item.prepWindow),
        prepSortOrder: Number.isFinite(Number(item.prepSortOrder)) ? Number(item.prepSortOrder) : 2
      };

      return processed;
    });
    return processedItems;
  }

  private groupByCategory(items: KitchenReportItem[]): GroupedKitchenReport[] {
    if (!items || items.length === 0) {
      return [];
    }

    // Create groups object - NO FILTERING, show ALL categories
    const groups: { [key: string]: KitchenReportItem[] } = {};

    items.forEach((item) => {
      // Default to 'כללי' if category is null/undefined, trim whitespace
      const catName = item.category ? item.category.trim() : 'כללי';

      if (!groups[catName]) {
        groups[catName] = [];
      }
      groups[catName].push(item);
    });


    // Convert object to array for *ngFor
    const groupedArray: GroupedKitchenReport[] = Object.keys(groups).map(key => ({
      category: key,
      items: groups[key]
    }));

    // Optional: Sort categories (Put Mains first, Salads second, etc.)
    const categoryOrder = ['מנות עיקריות', 'סלטים', 'דגים', 'ממולאים', 'תוספות'];
    groupedArray.sort((a, b) => {
      const prepA = Math.min(...a.items.map((item) => Number(item.prepSortOrder ?? 2)));
      const prepB = Math.min(...b.items.map((item) => Number(item.prepSortOrder ?? 2)));
      if (prepA !== prepB) return prepA - prepB;
      const indexA = categoryOrder.indexOf(a.category);
      const indexB = categoryOrder.indexOf(b.category);
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      return a.category.localeCompare(b.category);
    });

    // Filter out empty groups
    const filteredGroups = groupedArray.filter(group => group.items.length > 0);

    return filteredGroups;
  }

  private rebuildVisibleReport(): void {
    const category = typeof this.selectedCategory === 'string' ? this.selectedCategory.trim() : 'ALL';
    let filteredItems =
      category && category !== 'ALL'
        ? this.reportItems.filter((item) => (item.category || '').trim() === category)
        : this.reportItems;
    if (this.onlyNowPrep) {
      filteredItems = filteredItems.filter((item) => (item.prepWindow || 'later') === 'now');
    }
    this.visibleGroups = this.groupByCategory(filteredItems);
    this.visibleItemsCount = this.visibleGroups.reduce((sum, group) => sum + group.items.length, 0);
    this.visibleUnitsCount = this.visibleGroups.reduce(
      (sum, group) => sum + group.items.reduce((inner, item) => inner + Number(item.totalPackages || 0), 0),
      0
    );
  }

  isHighPriority(item: KitchenReportItem): boolean {
    return Number(item.totalPackages || 0) >= 10 || Number(item.totalWeightRaw || 0) >= 5000;
  }

  getDoneKey(item: KitchenReportItem): string {
    return `${this.selectedDate || 'all'}::${String(item.category || '').trim().toLowerCase()}::${String(item.productName || '').trim().toLowerCase()}`;
  }

  isDone(item: KitchenReportItem): boolean {
    return this.doneMap[this.getDoneKey(item)] === true;
  }

  setDone(item: KitchenReportItem, checked: boolean): void {
    const key = this.getDoneKey(item);
    this.doneMap = {
      ...this.doneMap,
      [key]: checked
    };
  }

  toggleDone(item: KitchenReportItem, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.setDone(item, checked);
  }

  private hydrateDoneMap(): void {
    try {
      const raw = localStorage.getItem(this.doneStorageKey);
      this.doneMap = raw ? JSON.parse(raw) as Record<string, boolean> : {};
      this.persistedDoneMap = { ...this.doneMap };
    } catch {
      this.doneMap = {};
      this.persistedDoneMap = {};
    }
  }

  private persistDoneMap(): void {
    try {
      localStorage.setItem(this.doneStorageKey, JSON.stringify(this.doneMap));
      this.persistedDoneMap = { ...this.doneMap };
    } catch {
      // no-op
    }
  }

  saveDoneChanges(): void {
    this.persistDoneMap();
  }


  printReport(): void {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>דוח הכנות למטבח - ${this.todayDate}</title>
            <style>
              body { font-family: 'Arial', sans-serif; direction: rtl; text-align: right; margin: 20px; }
              h1 { color: #333; text-align: center; margin-bottom: 20px; }
              .report-date { text-align: center; margin-bottom: 30px; font-size: 1.1em; color: #555; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; }
              th, td { border: 1px solid #ddd; padding: 10px; text-align: right; }
              th { background-color: #1a2a3a; color: white; font-weight: bold; }
              .weight { background-color: #f0f5ff; font-weight: bold; }
              .no-print { display: none; }
            </style>
          </head>
          <body>
            <h1>דוח הכנות למטבח</h1>
            <div class="report-date">תאריך: ${this.todayDate}</div>
            <div class="report-date">מצב תצוגה: ${this.filterStatusLabel}</div>
            <div class="report-date">קטגוריה: ${this.selectedCategory === 'ALL' ? 'כל הקטגוריות / המנות' : this.selectedCategory}</div>
            <div class="report-date">פילטר הכנה: ${this.onlyNowPrep ? 'רק עכשיו להכנה' : 'כל רמות התזמון'}</div>
            <div class="report-date">סה"כ פריטים: ${this.totalItemsCount} | סה"כ יחידות: ${this.totalUnitsCount}</div>
            <div class="report-date">עכשיו להכנה: ${this.nowPrepCount}</div>
            <div class="report-date">הזמנות פעילות: ${Number(this.reportMeta?.activeOrdersCount || 0)}</div>
            <div class="report-date">נוצר: ${this.reportMeta?.generatedAt ? new Date(this.reportMeta.generatedAt).toLocaleString('he-IL') : this.todayDate}</div>
                   ${this.visibleGroups.map(group => {
                     return `
                     <div class="category-group-print">
                       <h3 class="category-header-print">${group.category}</h3>
                       <table class="kitchen-report-table">
                         <thead>
                           <tr>
                             <th>#</th>
                             <th>שם הפריט</th>
                             <th>יחידות</th>
                             <th>תזמון הכנה</th>
                             <th>משקל כולל להכנה</th>
                           </tr>
                         </thead>
                         <tbody>
                           ${group.items.map((item, i) => `
                             <tr>
                               <td>${i + 1}</td>
                               <td>${item.productName}</td>
                               <td>${item.totalPackages} יח'</td>
                               <td>${item.prepWindowLabel || this.getPrepWindowLabel(item.prepWindow)}</td>
                               <td class="weight">${item.displayWeight}</td>
                             </tr>
                           `).join('')}
                         </tbody>
                       </table>
                     </div>
                   `;
                   }).join('')}
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
      printWindow.close();
    }
  }

  close(): void {
    this.closeModal.emit();
  }

  toggleExpanded(): void {
    this.isExpanded = !this.isExpanded;
  }

  private formatDate(date: Date): string {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }
}

