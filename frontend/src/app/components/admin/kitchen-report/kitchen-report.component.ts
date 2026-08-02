import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { OrderService } from '../../../services/order.service';
import {
  KitchenReportDTO,
  KitchenReportQuery,
  KITCHEN_FULFILLMENT_OPTIONS,
  KITCHEN_MEAL_OPTIONS,
  addDaysToDateKey,
  formatKitchenGeneratedAt,
  toJerusalemDateKey
} from '../../../utils/kitchen-report.util';

@Component({
  selector: 'app-admin-kitchen-report',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './kitchen-report.component.html',
  styleUrls: ['./kitchen-report.component.scss']
})
export class AdminKitchenReportComponent implements OnInit, OnDestroy {
  private orderService = inject(OrderService);
  private loadSeq = 0;

  readonly mealOptions = KITCHEN_MEAL_OPTIONS;
  readonly fulfillmentOptions = KITCHEN_FULFILLMENT_OPTIONS;

  startDate = '';
  endDate = '';
  meal = 'הכל';
  fulfillmentType = 'הכל';
  preparationSlot = '';
  includeCancelled = true;
  changedOnly = false;
  search = '';
  includeCatering = true;

  report: KitchenReportDTO | null = null;
  isLoading = false;
  errorMessage = '';
  exportBusy: string | null = null;
  expandedDishKeys = new Set<string>();
  expandedOrders = false;

  ngOnInit(): void {
    const today = toJerusalemDateKey();
    this.startDate = today;
    this.endDate = addDaysToDateKey(today, 2);
    this.load();
  }

  ngOnDestroy(): void {
    this.loadSeq += 1;
  }

  get generatedLabel(): string {
    return this.report ? formatKitchenGeneratedAt(this.report.generatedAt) : '';
  }

  get preparationSlotOptions(): string[] {
    const keys = (this.report?.preparationGroups || []).map((g) => g.preparationKey);
    return [...new Set(keys)];
  }

  buildQuery(): KitchenReportQuery {
    return {
      startDate: this.startDate,
      endDate: this.endDate,
      meal: this.meal !== 'הכל' ? this.meal : undefined,
      fulfillmentType: this.fulfillmentType !== 'הכל' ? this.fulfillmentType : undefined,
      preparationSlot: this.preparationSlot || undefined,
      includeCancelled: this.includeCancelled,
      changedOnly: this.changedOnly,
      search: this.search.trim() || undefined,
      includeCatering: this.includeCatering
    };
  }

  load(): void {
    const seq = ++this.loadSeq;
    this.isLoading = true;
    this.errorMessage = '';
    this.orderService.getAdvancedKitchenReport(this.buildQuery()).subscribe({
      next: (report) => {
        if (seq !== this.loadSeq) return;
        this.report = report;
        this.isLoading = false;
      },
      error: (err: unknown) => {
        if (seq !== this.loadSeq) return;
        this.isLoading = false;
        const http = err as HttpErrorResponse;
        this.errorMessage =
          (http?.error && typeof http.error === 'object' && (http.error as any).message) ||
          'לא ניתן לטעון את דוח המטבח';
        if (!this.report) this.report = null;
      }
    });
  }

  applyFilters(): void {
    this.load();
  }

  refresh(): void {
    this.load();
  }

  toggleDish(key: string): void {
    if (this.expandedDishKeys.has(key)) this.expandedDishKeys.delete(key);
    else this.expandedDishKeys.add(key);
  }

  isDishExpanded(key: string): boolean {
    return this.expandedDishKeys.has(key);
  }

  export(format: 'csv' | 'xlsx' | 'pdf' | 'print'): void {
    this.exportBusy = format;
    this.orderService.exportKitchenReport(format, this.buildQuery()).subscribe({
      next: (blob) => {
        this.exportBusy = null;
        if (format === 'print') {
          const html = typeof blob === 'string' ? blob : '';
          const w = window.open('', '_blank');
          if (!w) return;
          w.document.open();
          w.document.write(html);
          w.document.close();
          setTimeout(() => w.print(), 250);
          return;
        }
        const url = URL.createObjectURL(blob as Blob);
        const a = document.createElement('a');
        a.href = url;
        const range = `${this.startDate}_${this.endDate}`;
        a.download =
          format === 'csv'
            ? `kitchen-report_${range}.csv`
            : format === 'xlsx'
              ? `kitchen-report_${range}.xlsx`
              : `kitchen-report_${range}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      },
      error: () => {
        this.exportBusy = null;
        this.errorMessage = 'ייצוא נכשל';
      }
    });
  }

  alertIcon(kind: string): string {
    if (kind === 'allergy') return 'fa-exclamation-triangle';
    if (kind === 'cancellation') return 'fa-ban';
    return 'fa-pen';
  }
}
