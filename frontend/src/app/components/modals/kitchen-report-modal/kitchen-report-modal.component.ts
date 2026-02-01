import { Component, OnInit, inject, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OrderService } from '../../../services/order.service';

export interface KitchenReportItem {
  productName: string;
  category: string;
  totalPackages: number;
  totalWeightRaw: number;
  displayWeight: string;
  unit?: string;
  isUnitOnly?: boolean; // Flag to indicate if this category should show units only
}

export interface GroupedKitchenReport {
  category: string;
  items: KitchenReportItem[];
}

@Component({
  selector: 'app-kitchen-report-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="modal-overlay" (click)="close()">
      <div class="modal-container" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h2 class="modal-title">
            <i class="fas fa-utensils"></i>
            דוח הכנות למטבח
          </h2>
          <button class="close-btn" (click)="close()" aria-label="סגור">
            <i class="fas fa-times"></i>
          </button>
        </div>

        <div class="modal-body">
          <div class="report-date">
            <i class="fas fa-calendar"></i>
            תאריך: {{ todayDate }}
          </div>

          <div *ngIf="isLoading" class="loading-state">
            <i class="fas fa-spinner fa-spin"></i>
            <span>טוען דוח...</span>
          </div>

          <div *ngIf="!isLoading && groupedReport.length === 0" class="empty-state">
            <i class="fas fa-clipboard-list"></i>
            <p>אין הזמנות פעילות כרגע</p>
          </div>

          <div *ngIf="!isLoading && groupedReport.length > 0" class="report-groups-container">
            <div *ngFor="let group of groupedReport" class="category-group">
              <h3 class="category-header">{{ group.category }}</h3>
              <div class="report-table-container">
                <table class="kitchen-report-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>שם הפריט</th>
                      <th>יחידות</th>
                      <th>משקל כולל להכנה</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let item of group.items; let i = index">
                      <td class="row-number">{{ i + 1 }}</td>
                      <td class="product-name">{{ item.productName }}</td>
                      <td class="quantity">{{ item.totalPackages }} יח'</td>
                      <td class="weight">{{ item.displayWeight }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div class="divider"></div>
            </div>
          </div>
          
          <div *ngIf="!isLoading && groupedReport.length === 0" class="no-data">
            <i class="fas fa-clipboard-list"></i>
            <p>אין הזמנות פעילות להצגה.</p>
          </div>
        </div>

        <div class="modal-footer" *ngIf="!isLoading && groupedReport.length > 0">
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
      background: rgba(0, 0, 0, 0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      padding: 2rem;
      direction: rtl;
    }

    .modal-container {
      background: white;
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
      max-width: 800px;
      width: 100%;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .modal-header {
      padding: 1.5rem 2rem;
      border-bottom: 2px solid #e0e0e0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #f8f9fa;
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

    .close-btn:hover {
      background: #e0e0e0;
      color: #1a2a3a;
    }

    .modal-body {
      padding: 2rem;
      overflow-y: auto;
      flex: 1;
    }

    .report-date {
      margin-bottom: 1.5rem;
      padding: 0.75rem 1rem;
      background: #f8f9fa;
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
      padding: 1rem 1.5rem;
      background: #1a2a3a;
      color: white;
      font-size: 1.3rem;
      font-weight: 700;
      border-radius: 8px 8px 0 0;
      text-align: right;
      border-bottom: 3px solid #cbb69e;
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
      background: #1a2a3a;
      color: white;
    }

    .kitchen-report-table th {
      padding: 1rem;
      text-align: right;
      font-weight: 700;
      font-size: 0.95rem;
      border-bottom: 2px solid #0E1A24;
    }

    .kitchen-report-table tbody tr {
      border-bottom: 1px solid #e0e0e0;
      transition: background 0.2s;
    }

    .kitchen-report-table tbody tr:hover {
      background: #f8f9fa;
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
      color: #1a2a3a;
      font-size: 1.1rem;
      text-align: center;
      background: #f0f5ff;
      padding: 0.5rem;
      border-radius: 4px;
    }

    .modal-footer {
      padding: 1.5rem 2rem;
      border-top: 2px solid #e0e0e0;
      display: flex;
      justify-content: flex-end;
      gap: 1rem;
      background: #f8f9fa;
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
  groupedReport: GroupedKitchenReport[] = [];
  isLoading = true;
  todayDate = '';

  ngOnInit(): void {
    this.todayDate = this.formatDate(new Date());
    this.loadKitchenReport();
  }

  loadKitchenReport(): void {
    this.isLoading = true;
    console.log('🔍 Frontend: Loading kitchen report...');
    this.orderService.getKitchenReport().subscribe({
      next: (items) => {
        console.log('✅ Frontend: Received report from backend:', items);
        console.log('✅ Frontend: Report items count:', items.length);
        console.log('✅ Frontend: Sample item structure:', items.length > 0 ? items[0] : 'No items');
        
        // Process and normalize data
        this.reportItems = this.processData(items);
        console.log('✅ Frontend: Processed report items:', this.reportItems);
        console.log('✅ Frontend: Processed items count:', this.reportItems.length);
        
        // Group items by category
        this.groupedReport = this.groupByCategory(this.reportItems);
        console.log('✅ Frontend: Grouped report:', this.groupedReport);
        console.log('✅ Frontend: Grouped report count:', this.groupedReport.length);
        console.log('✅ Frontend: Final Grouped Data for View:', JSON.stringify(this.groupedReport, null, 2));
        
        this.isLoading = false;
      },
      error: (error) => {
        console.error('❌ Frontend: Error loading kitchen report:', error);
        console.error('❌ Frontend: Error details:', {
          message: error.message,
          status: error.status,
          statusText: error.statusText,
          error: error.error
        });
        this.isLoading = false;
      }
    });
  }

  private processData(data: any[]): KitchenReportItem[] {
    if (!data || !Array.isArray(data)) {
      console.warn('⚠️ Frontend: Invalid data received, expected array:', data);
      return [];
    }

    console.log('🔍 Frontend: Processing data array of length:', data.length);

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
        isUnitOnly: item.isUnitOnly || false
      };

      // Log if we had to use fallback values
      if (!item.productName) {
        console.warn(`⚠️ Frontend: Item ${index} missing productName, using fallback:`, processed.productName);
      }
      if (!item.totalPackages && !item.quantity && !item.packages) {
        console.warn(`⚠️ Frontend: Item ${index} missing totalPackages, using 0`);
      }
      if (!item.displayWeight && !item.weight && !item.totalWeight) {
        console.warn(`⚠️ Frontend: Item ${index} missing displayWeight, using '-'`);
      }

      return processed;
    });

    console.log('✅ Frontend: Processed items:', processedItems);
    return processedItems;
  }

  private groupByCategory(items: KitchenReportItem[]): GroupedKitchenReport[] {
    if (!items || items.length === 0) {
      console.warn('⚠️ Frontend: No items to group');
      return [];
    }

    console.log('🔍 Frontend: Grouping items by category, total items:', items.length);

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

    console.log('🔍 Frontend: Groups created:', Object.keys(groups));

    // Convert object to array for *ngFor
    const groupedArray: GroupedKitchenReport[] = Object.keys(groups).map(key => ({
      category: key,
      items: groups[key]
    }));

    // Optional: Sort categories (Put Mains first, Salads second, etc.)
    const categoryOrder = ['מנות עיקריות', 'סלטים', 'דגים', 'ממולאים', 'תוספות'];
    groupedArray.sort((a, b) => {
      const indexA = categoryOrder.indexOf(a.category);
      const indexB = categoryOrder.indexOf(b.category);
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      return a.category.localeCompare(b.category);
    });

    // Filter out empty groups
    const filteredGroups = groupedArray.filter(group => group.items.length > 0);

    console.log('✅ Frontend: Final grouped report:', filteredGroups);
    console.log('✅ Frontend: Final grouped report count:', filteredGroups.length);
    console.log('✅ Frontend: Categories in report:', filteredGroups.map(g => g.category));

    return filteredGroups;
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
                   ${this.groupedReport.map(group => {
                     return `
                     <div class="category-group-print">
                       <h3 class="category-header-print">${group.category}</h3>
                       <table class="kitchen-report-table">
                         <thead>
                           <tr>
                             <th>#</th>
                             <th>שם הפריט</th>
                             <th>יחידות</th>
                             <th>משקל כולל להכנה</th>
                           </tr>
                         </thead>
                         <tbody>
                           ${group.items.map((item, i) => `
                             <tr>
                               <td>${i + 1}</td>
                               <td>${item.productName}</td>
                               <td>${item.totalPackages} יח'</td>
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

  private formatDate(date: Date): string {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }
}

