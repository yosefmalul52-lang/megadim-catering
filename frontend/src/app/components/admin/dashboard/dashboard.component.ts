import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { BaseChartDirective } from 'ng2-charts';
import { ChartData, ChartOptions, Chart, registerables } from 'chart.js';
import { OrderService } from '../../../services/order.service';
import { AuthService } from '../../../services/auth.service';
import {
  ActionSeverity,
  buildDashboardQuery,
  ChangeDisplay,
  DashboardActionItem,
  DashboardInsight,
  DashboardOverviewData,
  DashboardPresetKey,
  DashboardTopItem,
  DayOpsSummary,
  filterNamedTopItems,
  filterPrepItems,
  formatHeNumber,
  formatIls,
  formatKpiChange,
  formatSalesMonthLabel,
  formatTrendPeriodLabel,
  fulfillmentLabelHe,
  mapHttpErrorToDashboardMessage,
  normalizeOverview,
  orderStatusLabelHe,
  parseAdminHref,
  paymentStatusLabelHe,
  severityLabelHe,
  toJerusalemDateKey,
  TopSellingCategoryBlock,
  TopSellingMonthBlock,
  UpcomingOrderRow,
  UpcomingPreparation
} from '../../../utils/dashboard-overview.util';

Chart.register(...registerables);

type TrendMetric = 'revenue' | 'paidOrdersCount' | 'averageOrderValue';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, BaseChartDirective],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class AdminDashboardComponent implements OnInit, OnDestroy {
  private orderService = inject(OrderService);
  private authService = inject(AuthService);
  private router = inject(Router);

  readonly presetOptions: Array<{ key: DashboardPresetKey; label: string }> = [
    { key: 'today', label: 'היום' },
    { key: 'week', label: '7 ימים' },
    { key: 'last30', label: '30 ימים' },
    { key: 'month', label: 'החודש' },
    { key: 'custom', label: 'מותאם' }
  ];

  selectedPreset: DashboardPresetKey = 'last30';
  customFrom = '';
  customTo = '';
  rangeError = '';

  overview: DashboardOverviewData | null = null;
  isLoading = false;
  isRefreshing = false;
  errorMessage = '';
  staleWarning = false;
  private loadSeq = 0;

  dayView: 'today' | 'tomorrow' = 'today';
  showAllActions = false;
  todayKey = toJerusalemDateKey();
  /** YYYY-MM for the independent top-selling section. */
  selectedSalesMonth = '';

  trendMetric: TrendMetric = 'revenue';
  trendChartData: ChartData<'line'> = { labels: [], datasets: [] };
  trendChartOptions: ChartOptions<'line'> = this.buildChartOptions('revenue');

  ngOnInit(): void {
    const today = toJerusalemDateKey();
    this.todayKey = today;
    this.customTo = today;
    this.customFrom = today;
    this.loadOverview();
  }

  ngOnDestroy(): void {
    this.loadSeq += 1;
  }

  get generatedAtLabel(): string {
    const raw = this.overview?.generatedAt;
    if (!raw) return '';
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('he-IL', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  get financeRangeLabel(): string {
    const match = this.presetOptions.find((p) => p.key === this.selectedPreset);
    if (this.selectedPreset === 'custom' && this.customFrom && this.customTo) {
      return `${this.customFrom} – ${this.customTo}`;
    }
    return match?.label || '30 ימים';
  }

  get actionItems(): DashboardActionItem[] {
    return this.overview?.actionItems || [];
  }

  get visibleActionItems(): DashboardActionItem[] {
    return this.showAllActions ? this.actionItems : this.actionItems.slice(0, 5);
  }

  get activeDaySummary(): DayOpsSummary | null {
    if (!this.overview) return null;
    return this.dayView === 'today'
      ? this.overview.todaySummary || null
      : this.overview.tomorrowSummary || null;
  }

  get prep(): UpcomingPreparation | null {
    return this.overview?.upcomingPreparation || null;
  }

  get prepTopItems(): Array<{ name: string; quantity: number }> {
    return filterPrepItems(this.prep?.topItems);
  }

  get upcomingOrders(): UpcomingOrderRow[] {
    return (this.overview?.upcomingOrders || []).filter((o) => !o.isTestOrder).slice(0, 8);
  }

  get soldItems(): DashboardTopItem[] {
    return filterNamedTopItems(this.overview?.topItems).slice(0, 8);
  }

  get topSellingByMonth(): TopSellingMonthBlock[] {
    return this.overview?.topSellingByMonth || [];
  }

  get salesMonthOptions(): Array<{ key: string; label: string }> {
    return this.topSellingByMonth.map((m) => ({
      key: m.month,
      label: formatSalesMonthLabel(m.month)
    }));
  }

  get selectedSalesCategories(): TopSellingCategoryBlock[] {
    const month = this.topSellingByMonth.find((m) => m.month === this.selectedSalesMonth);
    return month?.categories || [];
  }

  get insights(): DashboardInsight[] {
    return this.overview?.insights || [];
  }

  selectSalesMonth(month: string): void {
    if (!month || this.selectedSalesMonth === month) return;
    this.selectedSalesMonth = month;
  }

  salesMonthLabel(monthKey: string): string {
    return formatSalesMonthLabel(monthKey);
  }

  get finance() {
    const f = this.overview?.financialSummary;
    const k = this.overview?.kpis;
    return {
      capturedRevenue: f?.capturedRevenue ?? k?.capturedRevenue.value ?? 0,
      paidOrders: f?.paidOrders ?? k?.paidOrders.value ?? 0,
      averageOrderValue: f?.averageOrderValue ?? k?.averageOrderValue.value ?? 0,
      awaitingPayments: f?.awaitingCount ?? f?.awaitingPayments ?? this.overview?.paymentAlerts.awaiting ?? 0,
      awaitingAmount: Number(f?.awaitingAmount) || 0,
      failedPayments: f?.failedCount ?? f?.failedPayments ?? this.overview?.paymentAlerts.failed ?? 0,
      failedAmount: Number(f?.failedAmount) || 0,
      returningCustomers: f?.returningCustomers ?? k?.returningCustomers.value ?? 0
    };
  }

  get revenueChange(): ChangeDisplay {
    return formatKpiChange(
      this.overview?.financialSummary?.capturedRevenueChange || this.overview?.kpis.capturedRevenue
    );
  }

  get paidChange(): ChangeDisplay {
    return formatKpiChange(
      this.overview?.financialSummary?.paidOrdersChange || this.overview?.kpis.paidOrders
    );
  }

  get aovChange(): ChangeDisplay {
    return formatKpiChange(
      this.overview?.financialSummary?.averageOrderValueChange ||
        this.overview?.kpis.averageOrderValue
    );
  }

  get hasTrendData(): boolean {
    return (this.overview?.trend?.length || 0) > 0;
  }

  selectPreset(key: DashboardPresetKey): void {
    if (this.selectedPreset === key && key !== 'custom') return;
    this.selectedPreset = key;
    this.rangeError = '';
    if (key === 'custom') {
      if (!this.customFrom || !this.customTo) {
        const today = toJerusalemDateKey();
        this.customTo = today;
        this.customFrom = today;
      }
      return;
    }
    this.loadOverview();
  }

  applyCustomRange(): void {
    this.selectedPreset = 'custom';
    this.loadOverview();
  }

  reload(): void {
    this.loadOverview();
  }

  setTrendMetric(metric: TrendMetric): void {
    if (this.trendMetric === metric) return;
    this.trendMetric = metric;
    this.trendChartOptions = this.buildChartOptions(metric);
    this.applyTrendChart();
  }

  formatMoney(v: number): string {
    return formatIls(v);
  }

  formatCount(v: number): string {
    return formatHeNumber(v);
  }

  paymentLabel(s: string): string {
    return paymentStatusLabelHe(s);
  }

  statusLabel(s: string): string {
    return orderStatusLabelHe(s);
  }

  fulfillmentLabel(s: string): string {
    return fulfillmentLabelHe(s);
  }

  severityLabel(s: ActionSeverity): string {
    return severityLabelHe(s);
  }

  hrefPath(href: string): string {
    return parseAdminHref(href).path;
  }

  hrefQuery(href: string): Record<string, string> {
    return parseAdminHref(href).queryParams;
  }

  private loadOverview(): void {
    const built = buildDashboardQuery(this.selectedPreset, this.customFrom, this.customTo);
    if ('error' in built) {
      this.rangeError = built.error;
      return;
    }
    this.rangeError = '';

    const seq = ++this.loadSeq;
    const hadData = !!this.overview;
    this.isLoading = !hadData;
    this.isRefreshing = hadData;
    this.errorMessage = '';
    this.staleWarning = false;

    this.orderService.getDashboardOverview(built).subscribe({
      next: (data) => {
        if (seq !== this.loadSeq) return;
        this.overview = data;
        this.isLoading = false;
        this.isRefreshing = false;
        this.errorMessage = '';
        this.staleWarning = false;
        this.todayKey = toJerusalemDateKey();
        this.syncSelectedSalesMonth();
        this.applyTrendChart();
      },
      error: (err: unknown) => {
        if (seq !== this.loadSeq) return;
        this.isLoading = false;
        this.isRefreshing = false;
        const http = err as HttpErrorResponse;
        const status = http?.status;
        const serverMsg =
          (http?.error && typeof http.error === 'object' && (http.error as { message?: string }).message) ||
          undefined;
        this.errorMessage = mapHttpErrorToDashboardMessage(status, serverMsg);

        if (hadData) {
          // Keep previous data but mark as stale — never pretend it is fresh.
          this.staleWarning = true;
        } else {
          this.overview = null;
          this.trendChartData = { labels: [], datasets: [] };
        }

        if (status === 401) {
          this.authService.logout();
          this.router.navigate(['/login']);
        }
      }
    });
  }

  private syncSelectedSalesMonth(): void {
    const months = this.topSellingByMonth.map((m) => m.month);
    if (!months.length) {
      this.selectedSalesMonth = '';
      return;
    }
    const currentMonth = toJerusalemDateKey().slice(0, 7);
    if (months.includes(this.selectedSalesMonth)) return;
    if (months.includes(currentMonth)) {
      this.selectedSalesMonth = currentMonth;
      return;
    }
    this.selectedSalesMonth = months[0];
  }

  private applyTrendChart(): void {
    const trend = this.overview?.trend || [];
    const labels = trend.map((p) => formatTrendPeriodLabel(p.period));
    const values = trend.map((p) => {
      if (this.trendMetric === 'revenue') return Number(p.revenue) || 0;
      if (this.trendMetric === 'paidOrdersCount') return Number(p.paidOrdersCount) || 0;
      if (p.averageOrderValue != null) return Number(p.averageOrderValue) || 0;
      return p.paidOrdersCount > 0 ? Number(p.revenue) / Number(p.paidOrdersCount) : 0;
    });

    const label =
      this.trendMetric === 'revenue'
        ? 'הכנסות'
        : this.trendMetric === 'paidOrdersCount'
          ? 'הזמנות ששולמו'
          : 'ממוצע להזמנה';

    this.trendChartData = {
      labels,
      datasets: [
        {
          label,
          data: values,
          borderColor: '#3a5f7d',
          backgroundColor: (context: any) => {
            const chart = context.chart;
            const { ctx, chartArea } = chart || {};
            if (!chartArea) return 'rgba(58, 95, 125, 0.12)';
            const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
            gradient.addColorStop(0, 'rgba(58, 95, 125, 0.2)');
            gradient.addColorStop(1, 'rgba(58, 95, 125, 0)');
            return gradient;
          },
          pointRadius: 0,
          pointHoverRadius: 4,
          pointHoverBackgroundColor: '#1f3540',
          tension: 0.28,
          fill: true,
          borderWidth: 2
        }
      ]
    };
  }

  private buildChartOptions(metric: TrendMetric): ChartOptions<'line'> {
    const isMoney = metric === 'revenue' || metric === 'averageOrderValue';
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          align: 'end',
          rtl: true,
          labels: {
            boxWidth: 10,
            boxHeight: 10,
            color: '#6b6560',
            font: { size: 11, weight: 600 },
            padding: 8
          }
        },
        tooltip: {
          backgroundColor: 'rgba(31, 53, 64, 0.94)',
          padding: 10,
          displayColors: false,
          titleFont: { size: 12, weight: 600 },
          bodyFont: { size: 12 },
          cornerRadius: 4,
          callbacks: {
            label: (context) => {
              const value = context.parsed.y;
              if (value === null || value === undefined || !Number.isFinite(value)) return '0';
              return isMoney ? formatIls(value) : formatHeNumber(value);
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: '#6b6560', maxTicksLimit: 7, maxRotation: 0 },
          border: { display: false }
        },
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(228, 221, 211, 0.9)' },
          ticks: {
            color: '#6b6560',
            callback: (value) => {
              const n = Number(value);
              return isMoney ? formatIls(n) : formatHeNumber(n);
            }
          },
          border: { display: false }
        }
      }
    };
  }
}
