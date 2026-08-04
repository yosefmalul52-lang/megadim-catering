import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { BaseChartDirective } from 'ng2-charts';
import { ChartData, ChartOptions, Chart, registerables } from 'chart.js';
import {
  Subject,
  Subscription,
  catchError,
  map,
  of,
  switchMap
} from 'rxjs';
import { OrderService } from '../../../services/order.service';
import { AuthService } from '../../../services/auth.service';
import {
  ActionSeverity,
  buildDashboardQuery,
  buildPrimaryRangeQuery,
  BusinessReviewAlert,
  BusinessReviewAlertSeverity,
  BusinessReviewBreakdownRow,
  BusinessReviewKpi,
  BusinessReviewReturningCustomer,
  BusinessReviewTopDish,
  BusinessReviewUpcomingItem,
  ChangeDisplay,
  DashboardActionItem,
  DashboardInsight,
  DashboardOverviewData,
  DashboardPresetKey,
  DayOpsSummary,
  filterPrepItems,
  formatHeNumber,
  formatIls,
  formatKpiChange,
  formatTrendPeriodLabel,
  fulfillmentLabelHe,
  mapFinanceToPrimaryPreset,
  mapHttpErrorToDashboardMessage,
  mapPrimaryToFinancePreset,
  orderStatusLabelHe,
  parseAdminHref,
  paymentStatusLabelHe,
  PrimaryDatePreset,
  previousCalendarMonthBounds,
  salesCategoryTone,
  severityLabelHe,
  toJerusalemDateKey,
  TopSellingCategoryBlock,
  UpcomingOrderRow,
  UpcomingPreparation
} from '../../../utils/dashboard-overview.util';

Chart.register(...registerables);

type TrendMetric = 'revenue' | 'paidOrdersCount' | 'averageOrderValue';
type UpcomingWindow = 'today' | 'tomorrow' | 'next7';
type AlertSeverityFilter = 'all' | BusinessReviewAlertSeverity;

interface PrimaryKpiCard {
  key: string;
  title: string;
  hint: string;
  valueLabel: string;
  change: ChangeDisplay | null;
  tooltipHe: string;
  tone: 'navy' | 'green' | 'amber' | 'red';
  link: string | string[];
  queryParams?: Record<string, string>;
  fragment?: string;
  insufficient?: boolean;
}

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
  private route = inject(ActivatedRoute);

  readonly primaryPresetOptions: Array<{ key: PrimaryDatePreset; label: string }> = [
    { key: 'today', label: 'היום' },
    { key: 'last7', label: '7 ימים' },
    { key: 'last30', label: '30 ימים' },
    { key: 'this_month', label: 'החודש' },
    { key: 'last_month', label: 'החודש הקודם' },
    { key: 'custom', label: 'מותאם' }
  ];

  readonly presetOptions: Array<{ key: DashboardPresetKey; label: string }> = [
    { key: 'today', label: 'היום' },
    { key: 'week', label: 'השבוע' },
    { key: 'month', label: 'החודש' },
    { key: 'year', label: 'השנה' },
    { key: 'last30', label: '30 ימים' },
    { key: 'custom', label: 'מותאם' }
  ];

  readonly orderKindOptions = [
    { key: 'all', label: 'הכול' },
    { key: 'events', label: 'קייטרינג לאירועים' },
    { key: 'shabbat_ready', label: 'אוכל מוכן לשבת וחג' },
    { key: 'institutions', label: 'מוסדות' }
  ];

  readonly statusOptions = [
    { key: 'all', label: 'כל הסטטוסים' },
    { key: 'pending', label: 'ממתינה' },
    { key: 'new', label: 'חדשה' },
    { key: 'processing', label: 'בטיפול' },
    { key: 'ready', label: 'מוכנה' },
    { key: 'out_for_delivery', label: 'במשלוח' },
    { key: 'delivered', label: 'נמסרה' },
    { key: 'cancelled', label: 'בוטלה' }
  ];

  readonly paymentStatusOptions = [
    { key: 'all', label: 'כל התשלומים' },
    { key: 'pending', label: 'טרם שולם' },
    { key: 'awaiting_payment', label: 'ממתין לתשלום' },
    { key: 'authorized', label: 'מורשה' },
    { key: 'captured', label: 'נגבה' },
    { key: 'failed', label: 'נכשל' },
    { key: 'voided', label: 'בוטל' }
  ];

  readonly upcomingWindowOptions: Array<{ key: UpcomingWindow; label: string }> = [
    { key: 'today', label: 'היום' },
    { key: 'tomorrow', label: 'מחר' },
    { key: 'next7', label: '7 ימים' }
  ];

  readonly alertSeverityOptions: Array<{ key: AlertSeverityFilter; label: string }> = [
    { key: 'all', label: 'כל החומרות' },
    { key: 'critical', label: 'חשוב' },
    { key: 'warning', label: 'אזהרה' },
    { key: 'info', label: 'מידע חסר' }
  ];

  readonly dayViewOptions: Array<{ key: 'today' | 'tomorrow'; label: string }> = [
    { key: 'today', label: 'היום' },
    { key: 'tomorrow', label: 'מחר' }
  ];

  readonly trendMetricOptions: Array<{ key: TrendMetric; label: string }> = [
    { key: 'revenue', label: 'הכנסות' },
    { key: 'paidOrdersCount', label: 'הזמנות' },
    { key: 'averageOrderValue', label: 'ממוצע להזמנה' }
  ];

  readonly quickNavOptions: Array<{ key: string; label: string }> = [
    { key: 'orders-today', label: 'הזמנות היום' },
    { key: 'kitchen', label: 'דוח מטבח' },
    { key: 'delivery', label: 'סידור משלוחים' },
    { key: 'menu', label: 'ניהול תפריט' },
    { key: 'payments', label: 'בקרה כספית' },
    { key: 'customers', label: 'לקוחות' },
    { key: 'institutions', label: 'מוסדות' }
  ];

  quickNavKey = '';

  /** Primary range (admin-payments style) — drives overview load + URL. */
  primaryPreset: PrimaryDatePreset = 'this_month';
  primaryFrom = '';
  primaryTo = '';
  primaryRangeError = '';

  /** Finance section date presets (synced with primary where possible). */
  selectedPreset: DashboardPresetKey = 'month';
  customFrom = '';
  customTo = '';
  rangeError = '';
  orderKindFilter = 'all';
  statusFilter = 'all';
  paymentStatusFilter = 'all';

  /** Independent range for top-selling dishes (not tied to finance). */
  salesPreset: DashboardPresetKey = 'last30';
  salesCustomFrom = '';
  salesCustomTo = '';
  salesRangeError = '';

  overview: DashboardOverviewData | null = null;
  isLoading = false;
  isRefreshing = false;
  errorMessage = '';
  staleWarning = false;

  dayView: 'today' | 'tomorrow' = 'today';
  showAllActions = false;
  showAllReviewAlerts = false;
  /** הכנות קרובות — accordion, closed by default. */
  prepExpanded = false;
  todayKey = toJerusalemDateKey();
  upcomingWindow: UpcomingWindow = 'next7';
  alertSeverityFilter: AlertSeverityFilter = 'all';

  trendMetric: TrendMetric = 'revenue';
  trendChartData: ChartData<'line'> = { labels: [], datasets: [] };
  trendChartOptions: ChartOptions<'line'> = this.buildChartOptions('revenue');

  private loadTrigger$ = new Subject<void>();
  private subs = new Subscription();
  private syncingFromUrl = false;
  private lastQueryKey = '';

  ngOnInit(): void {
    const today = toJerusalemDateKey();
    this.todayKey = today;
    this.customTo = today;
    this.customFrom = today;
    this.primaryTo = today;
    this.primaryFrom = today;
    this.salesCustomTo = today;
    this.salesCustomFrom = today;

    this.subs.add(
      this.loadTrigger$
        .pipe(
          switchMap(() => {
            const finance = buildPrimaryRangeQuery(
              this.primaryPreset,
              this.primaryFrom,
              this.primaryTo,
              'Asia/Jerusalem',
              {
                orderKind: this.orderKindFilter,
                status: this.statusFilter,
                paymentStatus: this.paymentStatusFilter
              }
            );
            if ('error' in finance) {
              this.primaryRangeError = finance.error;
              this.rangeError = finance.error;
              return of({ kind: 'skip' as const });
            }

            let dateQuery = finance;
            if (this.selectedPreset === 'year' && this.primaryPreset === 'custom') {
              const yearQ = buildDashboardQuery('year', this.customFrom, this.customTo, 'Asia/Jerusalem', {
                orderKind: this.orderKindFilter,
                status: this.statusFilter,
                paymentStatus: this.paymentStatusFilter
              });
              if (!('error' in yearQ)) dateQuery = yearQ;
            } else if (this.selectedPreset === 'custom' && this.primaryPreset === 'custom') {
              const customQ = buildDashboardQuery(
                'custom',
                this.customFrom || this.primaryFrom,
                this.customTo || this.primaryTo,
                'Asia/Jerusalem',
                {
                  orderKind: this.orderKindFilter,
                  status: this.statusFilter,
                  paymentStatus: this.paymentStatusFilter
                }
              );
              if ('error' in customQ) {
                this.rangeError = customQ.error;
                this.primaryRangeError = customQ.error;
                return of({ kind: 'skip' as const });
              }
              dateQuery = customQ;
            }

            const sales = buildDashboardQuery(this.salesPreset, this.salesCustomFrom, this.salesCustomTo);
            if ('error' in sales) {
              this.salesRangeError = sales.error;
              return of({ kind: 'skip' as const });
            }

            this.primaryRangeError = '';
            this.rangeError = '';
            this.salesRangeError = '';

            const hadData = !!this.overview;
            this.isLoading = !hadData;
            this.isRefreshing = hadData;
            this.errorMessage = '';
            this.staleWarning = false;

            const built = {
              ...dateQuery,
              salesPreset: sales.preset,
              salesFrom: sales.from,
              salesTo: sales.to
            };

            return this.orderService.getDashboardOverview(built).pipe(
              map((data) => ({ kind: 'ok' as const, data, hadData })),
              catchError((err: unknown) => of({ kind: 'error' as const, err, hadData }))
            );
          })
        )
        .subscribe((result) => {
          if (!result || result.kind === 'skip') return;

          if (result.kind === 'error') {
            this.isLoading = false;
            this.isRefreshing = false;
            const http = result.err as HttpErrorResponse;
            const status = http?.status;
            const serverMsg =
              (http?.error &&
                typeof http.error === 'object' &&
                (http.error as { message?: string }).message) ||
              undefined;
            this.errorMessage = mapHttpErrorToDashboardMessage(status, serverMsg);

            if (result.hadData) {
              this.staleWarning = true;
            } else {
              this.overview = null;
              this.trendChartData = { labels: [], datasets: [] };
            }

            if (status === 401) {
              this.authService.logout();
              this.router.navigate(['/login']);
            }
            return;
          }

          this.overview = result.data;
          this.isLoading = false;
          this.isRefreshing = false;
          this.errorMessage = '';
          this.staleWarning = false;
          this.todayKey = toJerusalemDateKey();
          this.applyTrendChart();
        })
    );

    this.subs.add(
      this.route.queryParamMap.subscribe((params) => {
        if (!params.has('preset')) {
          this.applyFromQueryParams(params);
          this.syncUrl(true);
          return;
        }

        const key = params.keys
          .slice()
          .sort()
          .map((k) => `${k}=${params.get(k)}`)
          .join('&');
        this.applyFromQueryParams(params);
        if (key === this.lastQueryKey) return;
        this.lastQueryKey = key;
        this.loadTrigger$.next();
      })
    );
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  get generatedAtLabel(): string {
    const raw = this.overview?.generatedAt || this.overview?.businessReview?.generatedAt;
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

  get primaryRangeLabel(): string {
    const match = this.primaryPresetOptions.find((p) => p.key === this.primaryPreset);
    if (this.primaryPreset === 'custom' && this.primaryFrom && this.primaryTo) {
      return `${this.primaryFrom} – ${this.primaryTo}`;
    }
    if (this.primaryPreset === 'last_month') {
      const b = previousCalendarMonthBounds(this.todayKey);
      return `${b.from} – ${b.to}`;
    }
    return match?.label || 'החודש';
  }

  get financeRangeLabel(): string {
    return this.rangeLabelFor(this.selectedPreset, this.customFrom, this.customTo);
  }

  get salesRangeLabel(): string {
    return this.rangeLabelFor(this.salesPreset, this.salesCustomFrom, this.salesCustomTo);
  }

  salesTone(category: string): number {
    return salesCategoryTone(category);
  }

  get businessReview() {
    return this.overview?.businessReview || null;
  }

  get reviewAlerts(): BusinessReviewAlert[] {
    return this.businessReview?.alerts || [];
  }

  get filteredReviewAlerts(): BusinessReviewAlert[] {
    const list =
      this.alertSeverityFilter === 'all'
        ? this.reviewAlerts
        : this.reviewAlerts.filter((a) => a.severity === this.alertSeverityFilter);
    return this.showAllReviewAlerts ? list : list.slice(0, 5);
  }

  get hasMoreReviewAlerts(): boolean {
    const list =
      this.alertSeverityFilter === 'all'
        ? this.reviewAlerts
        : this.reviewAlerts.filter((a) => a.severity === this.alertSeverityFilter);
    return list.length > 5;
  }

  get actionItems(): DashboardActionItem[] {
    return this.overview?.actionItems || [];
  }

  get visibleActionItems(): DashboardActionItem[] {
    return this.showAllActions ? this.actionItems : this.actionItems.slice(0, 5);
  }

  get paymentAlertItems() {
    return this.overview?.paymentAlerts?.items || [];
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
    return this.displayedUpcoming as UpcomingOrderRow[];
  }

  get displayedUpcoming(): Array<UpcomingOrderRow | BusinessReviewUpcomingItem> {
    const brItems = this.businessReview?.upcoming?.items;
    if (brItems && brItems.length > 0) {
      const filtered =
        this.upcomingWindow === 'next7'
          ? brItems
          : brItems.filter((o) => o.window === this.upcomingWindow);
      return filtered.slice(0, 12);
    }

    const legacy = (this.overview?.upcomingOrders || []).filter((o) => !o.isTestOrder);
    if (this.upcomingWindow === 'next7') return legacy.slice(0, 12);
    const target =
      this.upcomingWindow === 'today' ? this.todayKey : this.addDaysKey(this.todayKey, 1);
    return legacy.filter((o) => o.eventDate === target).slice(0, 12);
  }

  get selectedSalesCategories(): TopSellingCategoryBlock[] {
    return this.overview?.topSellingByCategory || [];
  }

  get insights(): DashboardInsight[] {
    return this.overview?.insights || [];
  }

  get returningCustomersList(): BusinessReviewReturningCustomer[] {
    return (this.businessReview?.returningCustomersList || []).slice(0, 8);
  }

  get breakdownByKind(): BusinessReviewBreakdownRow[] {
    return this.businessReview?.breakdown?.byOrderKind || [];
  }

  get breakdownByFulfillment(): BusinessReviewBreakdownRow[] {
    return this.businessReview?.breakdown?.byFulfillment || [];
  }

  get paidTopDishes(): BusinessReviewTopDish[] {
    return (this.businessReview?.topDishes || []).slice(0, 8);
  }

  get primaryKpiCards(): PrimaryKpiCard[] {
    const k = this.businessReview?.kpis;
    if (!k) return [];

    const changeOf = (kpi: BusinessReviewKpi | undefined): ChangeDisplay | null => {
      if (!kpi || kpi.previousValue === undefined) return null;
      return formatKpiChange({
        value: Number(kpi.value) || 0,
        previousValue: Number(kpi.previousValue) || 0,
        changePercent: kpi.changePercent ?? null
      });
    };

    return [
      {
        key: 'paidRevenue',
        title: 'הכנסות ששולמו',
        hint: 'לפי הגדרת בקרה כספית',
        valueLabel: formatIls(k.paidRevenue?.value ?? 0),
        change: changeOf(k.paidRevenue),
        tooltipHe: k.paidRevenue?.tooltipHe || '',
        tone: 'green',
        link: '/admin/payments'
      },
      {
        key: 'ordersCreated',
        title: 'מספר הזמנות',
        hint: 'נוצרו בטווח · ללא מחוקות',
        valueLabel: formatHeNumber(k.ordersCreated?.value ?? 0),
        change: changeOf(k.ordersCreated),
        tooltipHe: k.ordersCreated?.tooltipHe || '',
        tone: 'navy',
        link: '/admin/orders'
      },
      {
        key: 'averagePaidOrder',
        title: 'סכום הזמנה ממוצע',
        hint: 'ממוצע לעסקה ששולמה',
        valueLabel: formatIls(k.averagePaidOrder?.value ?? 0),
        change: changeOf(k.averagePaidOrder),
        tooltipHe: k.averagePaidOrder?.tooltipHe || '',
        tone: 'navy',
        link: '/admin/payments'
      },
      {
        key: 'returningCustomers',
        title: 'לקוחות חוזרים',
        hint: k.returningCustomers?.insufficientData ? 'זיהוי לקוח חלקי' : 'לפחות 2 הזמנות בריאות',
        valueLabel: k.returningCustomers?.insufficientData
          ? 'אין מספיק מידע'
          : formatHeNumber(k.returningCustomers?.value ?? 0),
        change: k.returningCustomers?.insufficientData ? null : changeOf(k.returningCustomers),
        tooltipHe: k.returningCustomers?.tooltipHe || '',
        tone: 'amber',
        link: '/admin/customers',
        insufficient: !!k.returningCustomers?.insufficientData
      },
      {
        key: 'upcomingOrders',
        title: 'הזמנות קרובות',
        hint: 'מועד אספקה · 7 ימים',
        valueLabel: formatHeNumber(k.upcomingOrders?.value ?? 0),
        change: null,
        tooltipHe: k.upcomingOrders?.tooltipHe || '',
        tone: 'navy',
        link: '/admin/kitchen-report'
      },
      {
        key: 'needsAttention',
        title: 'פריטים שדורשים טיפול',
        hint: 'התראות מאוחדות',
        valueLabel: formatHeNumber(k.needsAttention?.value ?? 0),
        change: null,
        tooltipHe: k.needsAttention?.tooltipHe || '',
        tone: (k.needsAttention?.value || 0) > 0 ? 'red' : 'green',
        link: '/admin/dashboard',
        fragment: 'needs-attention'
      }
    ];
  }

  get finance() {
    const f = this.overview?.financialSummary;
    const k = this.overview?.kpis;
    return {
      capturedRevenue:
        f?.actualRevenue ?? f?.capturedRevenue ?? k?.actualRevenue?.value ?? k?.capturedRevenue.value ?? 0,
      expectedRevenue: f?.expectedRevenue ?? k?.expectedRevenue?.value ?? 0,
      paidOrders: f?.paidOrders ?? k?.paidOrders.value ?? 0,
      totalOrders: k?.totalOrders?.value ?? 0,
      averageOrderValue: f?.averageOrderValue ?? k?.averageOrderValue.value ?? 0,
      awaitingPayments: f?.awaitingCount ?? f?.awaitingPayments ?? this.overview?.paymentAlerts.awaiting ?? 0,
      awaitingAmount: Number(f?.awaitingAmount) || 0,
      failedPayments: f?.failedCount ?? f?.failedPayments ?? this.overview?.paymentAlerts.failed ?? 0,
      failedAmount: Number(f?.failedAmount) || 0,
      returningCustomers: f?.returningCustomers ?? k?.returningCustomers.value ?? 0,
      newCustomers: f?.newCustomers ?? k?.newCustomers?.value ?? 0,
      cancelledOrders: f?.cancelledOrders ?? k?.cancelledOrders?.value ?? 0,
      zeroPriceWarning: f?.zeroPriceWarning ?? this.overview?.alerts?.zeroPriceWarning ?? null,
      zeroPriceOrders: f?.zeroPriceOrders ?? this.overview?.alerts?.zeroPriceOrders ?? 0,
      externalInvoicesAmount:
        f?.externalInvoices?.amount ?? this.overview?.externalInvoices?.amount ?? 0,
      externalInvoicesCount: f?.externalInvoices?.count ?? this.overview?.externalInvoices?.count ?? 0
    };
  }

  get ordersByType() {
    return this.overview?.ordersByType || [];
  }

  get topDishes() {
    return this.overview?.topItems || [];
  }

  get revenueChange(): ChangeDisplay {
    return formatKpiChange(
      this.overview?.financialSummary?.capturedRevenueChange ||
        this.overview?.kpis.actualRevenue ||
        this.overview?.kpis.capturedRevenue
    );
  }

  get newCustomersChange(): ChangeDisplay {
    return formatKpiChange(
      this.overview?.financialSummary?.newCustomersChange || this.overview?.kpis.newCustomers
    );
  }

  get returningChange(): ChangeDisplay {
    return formatKpiChange(
      this.overview?.financialSummary?.returningCustomersChange ||
        this.overview?.kpis.returningCustomers
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

  onMetricFilterChange(): void {
    this.syncUrl();
  }

  get hasTrendData(): boolean {
    return (this.overview?.trend?.length || 0) > 0;
  }

  selectPrimaryPreset(key: PrimaryDatePreset): void {
    if (this.primaryPreset === key && key !== 'custom') return;
    this.primaryPreset = key;
    this.selectedPreset = mapPrimaryToFinancePreset(key);
    this.primaryRangeError = '';
    this.rangeError = '';
    if (key === 'custom') {
      if (!this.primaryFrom || !this.primaryTo) {
        const today = toJerusalemDateKey();
        this.primaryTo = today;
        this.primaryFrom = today;
      }
      this.customFrom = this.primaryFrom;
      this.customTo = this.primaryTo;
      this.syncUrl();
      return;
    }
    if (key === 'last_month') {
      const b = previousCalendarMonthBounds();
      this.primaryFrom = b.from;
      this.primaryTo = b.to;
      this.customFrom = b.from;
      this.customTo = b.to;
    }
    this.syncUrl();
  }

  applyPrimaryCustomRange(): void {
    this.primaryPreset = 'custom';
    this.selectedPreset = 'custom';
    this.customFrom = this.primaryFrom;
    this.customTo = this.primaryTo;
    this.syncUrl();
  }

  selectPreset(key: DashboardPresetKey): void {
    if (this.selectedPreset === key && key !== 'custom') return;
    this.selectedPreset = key;
    this.rangeError = '';
    if (key === 'year') {
      const today = toJerusalemDateKey();
      const y = today.slice(0, 4);
      this.primaryPreset = 'custom';
      this.primaryFrom = `${y}-01-01`;
      this.primaryTo = today;
      this.customFrom = this.primaryFrom;
      this.customTo = this.primaryTo;
      this.syncUrl();
      return;
    }
    this.primaryPreset = mapFinanceToPrimaryPreset(key);
    if (key === 'custom') {
      if (!this.customFrom || !this.customTo) {
        const today = toJerusalemDateKey();
        this.customTo = today;
        this.customFrom = today;
      }
      this.primaryFrom = this.customFrom;
      this.primaryTo = this.customTo;
      this.syncUrl();
      return;
    }
    this.syncUrl();
  }

  applyCustomRange(): void {
    this.selectedPreset = 'custom';
    this.primaryPreset = 'custom';
    this.primaryFrom = this.customFrom;
    this.primaryTo = this.customTo;
    this.syncUrl();
  }

  selectSalesPreset(key: DashboardPresetKey): void {
    if (this.salesPreset === key && key !== 'custom') return;
    this.salesPreset = key;
    this.salesRangeError = '';
    if (key === 'custom') {
      if (!this.salesCustomFrom || !this.salesCustomTo) {
        const today = toJerusalemDateKey();
        this.salesCustomTo = today;
        this.salesCustomFrom = today;
      }
      return;
    }
    this.loadTrigger$.next();
  }

  applySalesCustomRange(): void {
    this.salesPreset = 'custom';
    this.loadTrigger$.next();
  }

  reload(): void {
    this.loadTrigger$.next();
  }

  setUpcomingWindow(window: UpcomingWindow): void {
    this.upcomingWindow = window;
  }

  togglePrepPanel(): void {
    this.prepExpanded = !this.prepExpanded;
  }

  setAlertSeverityFilter(filter: AlertSeverityFilter): void {
    this.alertSeverityFilter = filter;
    this.showAllReviewAlerts = false;
  }

  setTrendMetric(metric: TrendMetric): void {
    if (this.trendMetric === metric) return;
    this.trendMetric = metric;
    this.trendChartOptions = this.buildChartOptions(metric);
    this.applyTrendChart();
  }

  onQuickNav(key: string): void {
    this.quickNavKey = '';
    if (!key) return;
    const day = this.todayKey || toJerusalemDateKey();
    switch (key) {
      case 'orders-today':
        void this.router.navigate(['/admin/orders'], { queryParams: { eventFrom: day, eventTo: day } });
        break;
      case 'kitchen':
        void this.router.navigate(['/admin/kitchen-report']);
        break;
      case 'delivery':
        void this.router.navigate(['/admin/delivery']);
        break;
      case 'menu':
        void this.router.navigate(['/admin/menu']);
        break;
      case 'payments':
        void this.router.navigate(['/admin/payments']);
        break;
      case 'customers':
        void this.router.navigate(['/admin/customers']);
        break;
      case 'institutions':
        void this.router.navigate(['/admin/institutions']);
        break;
    }
  }

  kpiIcon(key: string): string {
    switch (key) {
      case 'paidRevenue':
        return 'fa-shekel-sign';
      case 'ordersCreated':
        return 'fa-receipt';
      case 'averagePaidOrder':
        return 'fa-chart-line';
      case 'returningCustomers':
        return 'fa-user-check';
      case 'upcomingOrders':
        return 'fa-calendar-day';
      case 'needsAttention':
        return 'fa-exclamation-circle';
      default:
        return 'fa-circle';
    }
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

  formatAlertTime(iso: string): string {
    try {
      return new Intl.DateTimeFormat('he-IL', {
        timeZone: 'Asia/Jerusalem',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(new Date(iso));
    } catch {
      return iso;
    }
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

  reviewSeverityLabel(s: BusinessReviewAlertSeverity): string {
    if (s === 'critical') return 'חשוב';
    if (s === 'warning') return 'אזהרה';
    return 'מידע חסר';
  }

  orderHasException(o: UpcomingOrderRow | BusinessReviewUpcomingItem): boolean {
    if ('hasException' in o && o.hasException) return true;
    if ('requiresManualReview' in o && o.requiresManualReview) return true;
    const pay = String(o.paymentStatus || '');
    return pay === 'failed' || pay === 'awaiting_payment' || pay === 'voided';
  }

  isTestOrderRow(o: UpcomingOrderRow | BusinessReviewUpcomingItem): boolean {
    return 'isTestOrder' in o && !!(o as UpcomingOrderRow).isTestOrder;
  }

  hrefPath(href: string): string {
    return parseAdminHref(href).path;
  }

  hrefQuery(href: string): Record<string, string> {
    return parseAdminHref(href).queryParams;
  }

  private addDaysKey(dateKey: string, delta: number): string {
    const [y, m, d] = dateKey.split('-').map(Number);
    const utc = new Date(Date.UTC(y, m - 1, d + delta));
    return `${utc.getUTCFullYear()}-${String(utc.getUTCMonth() + 1).padStart(2, '0')}-${String(utc.getUTCDate()).padStart(2, '0')}`;
  }

  private rangeLabelFor(preset: DashboardPresetKey, from: string, to: string): string {
    const match = this.presetOptions.find((p) => p.key === preset);
    if (preset === 'custom' && from && to) return `${from} – ${to}`;
    return match?.label || 'החודש';
  }

  private applyFromQueryParams(params: ParamMap): void {
    this.syncingFromUrl = true;
    const presetRaw = params.get('preset') || 'this_month';
    const valid: PrimaryDatePreset[] = [
      'today',
      'last7',
      'last30',
      'this_month',
      'last_month',
      'custom'
    ];
    // Legacy finance keys in URL
    if (presetRaw === 'month') this.primaryPreset = 'this_month';
    else if (presetRaw === 'week') this.primaryPreset = 'last7';
    else {
      this.primaryPreset = valid.includes(presetRaw as PrimaryDatePreset)
        ? (presetRaw as PrimaryDatePreset)
        : 'this_month';
    }

    this.primaryFrom = params.get('from') || '';
    this.primaryTo = params.get('to') || '';
    if (this.primaryPreset === 'custom') {
      if (!this.primaryFrom || !this.primaryTo) {
        const today = toJerusalemDateKey();
        this.primaryFrom = this.primaryFrom || today;
        this.primaryTo = this.primaryTo || today;
      }
    }
    if (this.primaryPreset === 'last_month' && (!this.primaryFrom || !this.primaryTo)) {
      const b = previousCalendarMonthBounds();
      this.primaryFrom = b.from;
      this.primaryTo = b.to;
    }

    this.selectedPreset = mapPrimaryToFinancePreset(this.primaryPreset);
    this.customFrom = this.primaryFrom || this.customFrom;
    this.customTo = this.primaryTo || this.customTo;

    const ok = params.get('orderKind');
    if (ok) this.orderKindFilter = ok;
    const st = params.get('status');
    if (st) this.statusFilter = st;
    const ps = params.get('paymentStatus');
    if (ps) this.paymentStatusFilter = ps;

    this.syncingFromUrl = false;
  }

  private syncUrl(replace = false): void {
    if (this.syncingFromUrl) return;
    const queryParams: Record<string, string | null> = {
      preset: this.primaryPreset,
      from:
        this.primaryPreset === 'custom' && this.primaryFrom ? this.primaryFrom : null,
      to: this.primaryPreset === 'custom' && this.primaryTo ? this.primaryTo : null,
      orderKind: this.orderKindFilter !== 'all' ? this.orderKindFilter : null,
      status: this.statusFilter !== 'all' ? this.statusFilter : null,
      paymentStatus: this.paymentStatusFilter !== 'all' ? this.paymentStatusFilter : null
    };
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
      replaceUrl: replace
    });
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
