import { Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { BaseChartDirective } from 'ng2-charts';
import { Chart, ChartData, ChartOptions, registerables } from 'chart.js';
import {
  Subject,
  Subscription,
  debounceTime,
  distinctUntilChanged,
  forkJoin,
  of,
  switchMap,
  catchError
} from 'rxjs';
import {
  AdminPaymentsService,
  DatePreset,
  ExceptionFilter,
  FunnelBucket,
  PaymentDetail,
  PaymentListRow,
  PaymentsFunnel,
  PaymentsListMeta,
  PaymentsListParams,
  PaymentsRevenueSeries,
  PaymentsSummary
} from '../../../services/admin-payments.service';

Chart.register(...registerables);

type ChartMetric = 'revenue' | 'paidCount';
type PaymentsSortBy = 'createdAt' | 'totalPrice' | 'paymentStatus' | 'orderNumber';
type PaymentsColumnFilterKey =
  | 'orderNumber'
  | 'createdAt'
  | 'customer'
  | 'orderType'
  | 'status'
  | 'reference'
  | 'exception';

const PRESETS: Array<{ key: DatePreset; label: string }> = [
  { key: 'today', label: 'היום' },
  { key: 'last7', label: '7 ימים' },
  { key: 'last30', label: '30 ימים' },
  { key: 'this_month', label: 'החודש' },
  { key: 'last_month', label: 'החודש הקודם' },
  { key: 'custom', label: 'מותאם' }
];

const FUNNEL_KEYS: FunnelBucket[] = ['all', 'paid', 'pending', 'failed_cancelled', 'exceptions'];

@Component({
  selector: 'app-admin-payments',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    BaseChartDirective,
    MatProgressSpinnerModule,
    MatSnackBarModule
  ],
  providers: [DatePipe],
  templateUrl: './admin-payments.component.html',
  styleUrls: ['./admin-payments.component.scss']
})
export class AdminPaymentsComponent implements OnInit, OnDestroy {
  @ViewChild('exceptionsSection') exceptionsSection?: ElementRef<HTMLElement>;

  private paymentsApi = inject(AdminPaymentsService);
  private snackBar = inject(MatSnackBar);
  private datePipe = inject(DatePipe);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  readonly presetOptions = PRESETS;
  readonly funnelKeys = FUNNEL_KEYS;

  preset: DatePreset = 'this_month';
  filterFrom = '';
  filterTo = '';
  filterSearch = '';
  filterStatus = '';
  filterOrderType = '';
  filterFulfillment = '';
  filterIncludeDeleted = true;
  funnelBucket: FunnelBucket = 'all';
  exceptionFilter: ExceptionFilter = 'all';

  /** Column sort (orders-table pattern). */
  sortColumn: PaymentsSortBy | null = 'createdAt';
  sortDirection: 'asc' | 'desc' = 'desc';
  openFilterColumn: PaymentsColumnFilterKey | null = null;

  draftOrderNumberSearch = '';
  draftCustomerSearch = '';
  draftReferenceSearch = '';
  draftCreatedFrom = '';
  draftCreatedTo = '';
  draftOrderType = '';
  draftStatus = '';
  draftException: 'all' | 'yes' | 'no' = 'all';

  appliedOrderNumberSearch = '';
  appliedCustomerSearch = '';
  appliedReferenceSearch = '';
  appliedCreatedFrom = '';
  appliedCreatedTo = '';
  appliedException: 'all' | 'yes' | 'no' = 'all';

  summary: PaymentsSummary | null = null;
  funnel: PaymentsFunnel | null = null;
  revenue: PaymentsRevenueSeries | null = null;
  exceptionRows: PaymentListRow[] = [];

  overviewLoading = false;
  overviewError = '';
  exceptionsLoading = false;
  exceptionsError = '';

  rows: PaymentListRow[] = [];
  meta: PaymentsListMeta = { total: 0, page: 1, limit: 25, totalPages: 0 };
  listLoading = false;
  listError = '';

  chartMetric: ChartMetric = 'revenue';
  chartData: ChartData<'line'> = { labels: [], datasets: [] };
  chartOptions: ChartOptions<'line'> = this.buildChartOptions('revenue');

  detail: PaymentDetail | null = null;
  detailOpen = false;
  detailLoading = false;
  detailError = '';
  private savedScrollY = 0;

  exportBusy = false;
  lastUpdatedAt: string | null = null;

  private overviewTrigger$ = new Subject<void>();
  private listTrigger$ = new Subject<void>();
  private exceptionsTrigger$ = new Subject<void>();
  private search$ = new Subject<string>();
  private syncingFromUrl = false;
  private subs = new Subscription();
  /** Skip duplicate reloads when we write the same query params we just read. */
  private lastQueryKey = '';

  ngOnInit(): void {
    this.subs.add(
      this.overviewTrigger$
        .pipe(
          switchMap(() => {
            this.overviewLoading = true;
            this.overviewError = '';
            const params = this.scopeParams();
            return forkJoin({
              summary: this.paymentsApi.getSummary(params).pipe(
                catchError(() => of({ success: false as const, data: null as PaymentsSummary | null }))
              ),
              funnel: this.paymentsApi.getFunnel(params).pipe(
                catchError(() => of({ success: false as const, data: null as PaymentsFunnel | null }))
              ),
              revenue: this.paymentsApi.getRevenueSeries(params).pipe(
                catchError(() =>
                  of({ success: false as const, data: null as PaymentsRevenueSeries | null })
                )
              )
            });
          })
        )
        .subscribe((result) => {
          this.overviewLoading = false;
          const failed =
            !result.summary.success || !result.funnel.success || !result.revenue.success;
          if (failed && !result.summary.data && !result.funnel.data && !result.revenue.data) {
            this.overviewError = 'שגיאה בטעינת נתוני הבקרה הכספית';
            return;
          }
          this.overviewError = '';
          if (result.summary.data) {
            this.summary = result.summary.data;
            this.lastUpdatedAt = result.summary.data.generatedAt || new Date().toISOString();
          }
          if (result.funnel.data) this.funnel = result.funnel.data;
          if (result.revenue.data) {
            this.revenue = result.revenue.data;
            this.applyChart();
          }
        })
    );

    this.subs.add(
      this.exceptionsTrigger$
        .pipe(
          switchMap(() => {
            this.exceptionsLoading = true;
            this.exceptionsError = '';
            return this.paymentsApi
              .listExceptions({
                ...this.scopeParams(),
                exceptionFilter: this.exceptionFilter
              })
              .pipe(
                catchError(() => {
                  this.exceptionsError = 'שגיאה בטעינת עסקאות שדורשות בדיקה';
                  this.exceptionsLoading = false;
                  return of(null);
                })
              );
          })
        )
        .subscribe((res) => {
          if (!res) return;
          this.exceptionRows = res.data || [];
          this.exceptionsLoading = false;
          this.exceptionsError = '';
        })
    );

    this.subs.add(
      this.listTrigger$
        .pipe(
          switchMap(() => {
            this.listLoading = true;
            this.listError = '';
            return this.paymentsApi.list(this.listParams()).pipe(
              catchError(() => {
                this.listError = 'שגיאה בטעינת רשימת העסקאות';
                this.listLoading = false;
                return of(null);
              })
            );
          })
        )
        .subscribe((res) => {
          if (!res) return;
          this.rows = res.data || [];
          this.meta = res.meta;
          this.listLoading = false;
          this.listError = '';
        })
    );

    this.subs.add(
      this.search$.pipe(debounceTime(300), distinctUntilChanged()).subscribe((value) => {
        this.filterSearch = value;
        this.appliedOrderNumberSearch = '';
        this.appliedCustomerSearch = '';
        this.appliedReferenceSearch = '';
        this.meta.page = 1;
        this.syncUrl();
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
        this.overviewTrigger$.next();
        this.listTrigger$.next();
        this.exceptionsTrigger$.next();
      })
    );
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  get lastUpdatedLabel(): string {
    if (!this.lastUpdatedAt) return '';
    const d = new Date(this.lastUpdatedAt);
    if (Number.isNaN(d.getTime())) return '';
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Jerusalem',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).formatToParts(d);
    const get = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((p) => p.type === type)?.value || '';
    const day = get('day');
    const month = get('month');
    const year = get('year');
    const hour = get('hour');
    const minute = get('minute');
    if (!day || !month || !hour || !minute) return '';
    return `${day}.${month}.${year} · ${hour}:${minute}`;
  }

  get hasChartData(): boolean {
    return (this.revenue?.points?.length || 0) > 0;
  }

  get pages(): number[] {
    const total = this.meta.totalPages || 0;
    const current = this.meta.page || 1;
    const window = 5;
    let start = Math.max(1, current - Math.floor(window / 2));
    let end = Math.min(total, start + window - 1);
    start = Math.max(1, end - window + 1);
    const out: number[] = [];
    for (let i = start; i <= end; i++) out.push(i);
    return out;
  }

  get exceptionsToneClass(): string {
    const tone = this.summary?.exceptions?.tone;
    if (tone === 'critical') return 'tone-critical';
    if (tone === 'warning') return 'tone-warning';
    return 'tone-info';
  }

  onSearchInput(value: string): void {
    this.search$.next(value.trim());
  }

  selectPreset(key: DatePreset): void {
    if (this.preset === key && key !== 'custom') return;
    this.preset = key;
    if (key === 'custom') {
      if (!this.filterFrom || !this.filterTo) {
        const today = this.jerusalemToday();
        this.filterFrom = today;
        this.filterTo = today;
      }
      this.syncUrl();
      return;
    }
    this.filterFrom = '';
    this.filterTo = '';
    this.meta.page = 1;
    this.syncUrl();
  }

  applyCustomRange(): void {
    if (!this.filterFrom || !this.filterTo) {
      this.snackBar.open('נא לבחור טווח תאריכים', 'סגור', { duration: 3000 });
      return;
    }
    if (this.filterFrom > this.filterTo) {
      this.snackBar.open('תאריך ההתחלה חייב להיות לפני תאריך הסיום', 'סגור', { duration: 3500 });
      return;
    }
    this.preset = 'custom';
    this.meta.page = 1;
    this.syncUrl();
  }

  onTableFiltersChange(): void {
    this.meta.page = 1;
    this.syncUrl();
  }

  resetTableFilters(): void {
    this.filterSearch = '';
    this.filterStatus = '';
    this.filterOrderType = '';
    this.filterFulfillment = '';
    this.funnelBucket = 'all';
    this.exceptionFilter = 'all';
    this.appliedOrderNumberSearch = '';
    this.appliedCustomerSearch = '';
    this.appliedReferenceSearch = '';
    this.appliedCreatedFrom = '';
    this.appliedCreatedTo = '';
    this.appliedException = 'all';
    this.draftOrderNumberSearch = '';
    this.draftCustomerSearch = '';
    this.draftReferenceSearch = '';
    this.draftCreatedFrom = '';
    this.draftCreatedTo = '';
    this.draftOrderType = '';
    this.draftStatus = '';
    this.draftException = 'all';
    this.openFilterColumn = null;
    this.meta.page = 1;
    this.syncUrl();
  }

  @HostListener('document:click')
  closeColumnFilterDropdown(): void {
    this.openFilterColumn = null;
  }

  onSortColumn(column: PaymentsSortBy, event?: Event): void {
    event?.stopPropagation();
    this.openFilterColumn = null;
    if (this.sortColumn !== column) {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    } else if (this.sortDirection === 'asc') {
      this.sortDirection = 'desc';
    } else {
      this.sortColumn = 'createdAt';
      this.sortDirection = 'desc';
    }
    this.meta.page = 1;
    this.syncUrl();
  }

  getSortIndicator(column: PaymentsSortBy): string {
    if (this.sortColumn !== column) return '';
    return this.sortDirection === 'asc' ? ' ▲' : ' ▼';
  }

  private syncFilterDraftsFromApplied(): void {
    this.draftOrderNumberSearch = this.appliedOrderNumberSearch;
    this.draftCustomerSearch = this.appliedCustomerSearch;
    this.draftReferenceSearch = this.appliedReferenceSearch;
    this.draftCreatedFrom = this.appliedCreatedFrom;
    this.draftCreatedTo = this.appliedCreatedTo;
    this.draftOrderType = this.filterOrderType;
    this.draftStatus = this.filterStatus;
    this.draftException = this.appliedException;
  }

  toggleColumnFilter(column: PaymentsColumnFilterKey, event: Event): void {
    event.stopPropagation();
    if (this.openFilterColumn === column) {
      this.openFilterColumn = null;
      return;
    }
    this.syncFilterDraftsFromApplied();
    this.openFilterColumn = column;
  }

  applyColumnFilter(column: PaymentsColumnFilterKey, event?: Event): void {
    event?.stopPropagation();
    switch (column) {
      case 'orderNumber':
        this.appliedOrderNumberSearch = this.draftOrderNumberSearch.trim();
        this.appliedCustomerSearch = '';
        this.appliedReferenceSearch = '';
        this.filterSearch = this.appliedOrderNumberSearch;
        break;
      case 'customer':
        this.appliedCustomerSearch = this.draftCustomerSearch.trim();
        this.appliedOrderNumberSearch = '';
        this.appliedReferenceSearch = '';
        this.filterSearch = this.appliedCustomerSearch;
        break;
      case 'reference':
        this.appliedReferenceSearch = this.draftReferenceSearch.trim();
        this.appliedOrderNumberSearch = '';
        this.appliedCustomerSearch = '';
        this.filterSearch = this.appliedReferenceSearch;
        break;
      case 'createdAt':
        this.appliedCreatedFrom = this.draftCreatedFrom;
        this.appliedCreatedTo = this.draftCreatedTo;
        if (this.appliedCreatedFrom || this.appliedCreatedTo) {
          this.preset = 'custom';
          this.filterFrom = this.appliedCreatedFrom || this.appliedCreatedTo;
          this.filterTo = this.appliedCreatedTo || this.appliedCreatedFrom;
        }
        break;
      case 'orderType':
        this.filterOrderType = this.draftOrderType;
        break;
      case 'status':
        this.filterStatus = this.draftStatus;
        break;
      case 'exception':
        this.appliedException = this.draftException;
        this.funnelBucket = this.draftException === 'yes' ? 'exceptions' : 'all';
        break;
    }
    this.openFilterColumn = null;
    this.meta.page = 1;
    this.syncUrl();
  }

  clearColumnFilter(column: PaymentsColumnFilterKey, event?: Event): void {
    event?.stopPropagation();
    switch (column) {
      case 'orderNumber':
        this.draftOrderNumberSearch = '';
        this.appliedOrderNumberSearch = '';
        if (!this.appliedCustomerSearch && !this.appliedReferenceSearch) this.filterSearch = '';
        break;
      case 'customer':
        this.draftCustomerSearch = '';
        this.appliedCustomerSearch = '';
        if (!this.appliedOrderNumberSearch && !this.appliedReferenceSearch) this.filterSearch = '';
        break;
      case 'reference':
        this.draftReferenceSearch = '';
        this.appliedReferenceSearch = '';
        if (!this.appliedOrderNumberSearch && !this.appliedCustomerSearch) this.filterSearch = '';
        break;
      case 'createdAt':
        this.draftCreatedFrom = '';
        this.draftCreatedTo = '';
        this.appliedCreatedFrom = '';
        this.appliedCreatedTo = '';
        break;
      case 'orderType':
        this.draftOrderType = '';
        this.filterOrderType = '';
        break;
      case 'status':
        this.draftStatus = '';
        this.filterStatus = '';
        break;
      case 'exception':
        this.draftException = 'all';
        this.appliedException = 'all';
        if (this.funnelBucket === 'exceptions') this.funnelBucket = 'all';
        break;
    }
    this.openFilterColumn = null;
    this.meta.page = 1;
    this.syncUrl();
  }

  isColumnFilterActive(column: PaymentsColumnFilterKey): boolean {
    switch (column) {
      case 'orderNumber':
        return !!this.appliedOrderNumberSearch.trim();
      case 'customer':
        return !!this.appliedCustomerSearch.trim();
      case 'reference':
        return !!this.appliedReferenceSearch.trim();
      case 'createdAt':
        return !!(this.appliedCreatedFrom || this.appliedCreatedTo);
      case 'orderType':
        return !!this.filterOrderType;
      case 'status':
        return !!this.filterStatus;
      case 'exception':
        return this.appliedException !== 'all';
      default:
        return false;
    }
  }

  get hasActiveColumnFilters(): boolean {
    return (
      !!this.appliedOrderNumberSearch.trim() ||
      !!this.appliedCustomerSearch.trim() ||
      !!this.appliedReferenceSearch.trim() ||
      !!this.appliedCreatedFrom ||
      !!this.appliedCreatedTo ||
      !!this.filterOrderType ||
      !!this.filterStatus ||
      this.appliedException !== 'all' ||
      !!this.filterSearch.trim() ||
      !!this.filterFulfillment
    );
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.meta.totalPages) return;
    this.meta.page = page;
    this.syncUrl();
  }

  focusExceptionsCard(): void {
    this.funnelBucket = 'exceptions';
    this.meta.page = 1;
    this.syncUrl();
    this.scrollToExceptions();
  }

  setChartMetric(metric: ChartMetric | string): void {
    const next = metric === 'paidCount' ? 'paidCount' : 'revenue';
    if (this.chartMetric === next) return;
    this.chartMetric = next;
    this.chartOptions = this.buildChartOptions(next);
    this.applyChart();
  }

  selectExceptionSeverity(filter: ExceptionFilter | string): void {
    const next: ExceptionFilter =
      filter === 'critical' || filter === 'warning' || filter === 'info' ? filter : 'all';
    if (this.exceptionFilter === next) return;
    this.exceptionFilter = next;
    this.meta.page = 1;
    this.syncUrl();
  }

  selectFunnel(bucket: FunnelBucket | string): void {
    const allowed: FunnelBucket[] = ['all', 'paid', 'pending', 'failed_cancelled', 'exceptions'];
    const next = (allowed.includes(bucket as FunnelBucket) ? bucket : 'all') as FunnelBucket;
    if (this.funnelBucket === next) return;
    this.funnelBucket = next;
    this.meta.page = 1;
    this.syncUrl();
    if (next === 'exceptions') {
      this.scrollToExceptions();
    }
  }

  funnelOptionLabel(key: FunnelBucket): string {
    const stage = this.funnelStage(key);
    const base =
      key === 'all'
        ? 'כל העסקאות'
        : key === 'paid'
          ? 'שולמו'
          : key === 'pending'
            ? 'ממתינות'
            : key === 'failed_cancelled'
              ? 'נכשלו או בוטלו'
              : 'דורשות בדיקה';
    if (!stage) return base;
    return `${base} (${this.formatCount(stage.count)})`;
  }

  openDetail(row: PaymentListRow): void {
    this.savedScrollY = window.scrollY;
    this.detailOpen = true;
    this.detail = null;
    this.detailError = '';
    this.detailLoading = true;
    this.paymentsApi
      .getDetail(row.id)
      .pipe(
        catchError(() => {
          this.detailError = 'שגיאה בטעינת פרטי העסקה';
          this.detailLoading = false;
          return of(null);
        })
      )
      .subscribe((res) => {
        if (!res) return;
        this.detail = res.data;
        this.detailLoading = false;
      });
  }

  closeDetail(): void {
    this.detailOpen = false;
    this.detail = null;
    this.detailError = '';
    requestAnimationFrame(() => {
      window.scrollTo({ top: this.savedScrollY });
    });
  }

  refreshDetail(): void {
    if (!this.detail?.id) return;
    this.detailLoading = true;
    this.paymentsApi
      .getDetail(this.detail.id)
      .pipe(
        catchError(() => {
          this.detailError = 'שגיאה ברענון פרטי העסקה';
          this.detailLoading = false;
          return of(null);
        })
      )
      .subscribe((res) => {
        if (!res) return;
        this.detail = res.data;
        this.detailLoading = false;
      });
  }

  exportCsv(): void {
    if (this.exportBusy) return;
    this.exportBusy = true;
    // Full dump for the selected date range — includes archived/past orders;
    // not narrowed by table funnel / search filters.
    const params = this.exportParams();
    this.paymentsApi.exportCsv(params).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = this.exportFilename();
        a.click();
        URL.revokeObjectURL(url);
        this.exportBusy = false;
        this.snackBar.open('הקובץ הורד לפי הטווח שנבחר (כולל הזמנות עבר)', 'סגור', {
          duration: 3200
        });
      },
      error: () => {
        this.exportBusy = false;
        this.snackBar.open('ייצוא להנהלת חשבונות נכשל', 'סגור', { duration: 3500 });
      }
    });
  }

  private exportParams(): PaymentsListParams {
    return {
      ...this.scopeParams(),
      forExport: true,
      includeDeletedPayments: true,
      dateBasis: 'activity',
      sortBy: 'createdAt',
      sortDir: 'desc'
    };
  }

  private exportFilename(): string {
    const from =
      this.preset === 'custom' && this.filterFrom
        ? this.filterFrom
        : this.preset || 'range';
    const to =
      this.preset === 'custom' && this.filterTo ? this.filterTo : this.preset || 'range';
    if (this.preset === 'custom' && this.filterFrom && this.filterTo) {
      return `payments-${this.filterFrom}-to-${this.filterTo}.csv`;
    }
    return `payments-${from}-${new Date().toISOString().slice(0, 10)}.csv`;
  }

  reloadAll(): void {
    this.overviewTrigger$.next();
    this.listTrigger$.next();
    this.exceptionsTrigger$.next();
  }

  statusLabel(status: string): string {
    const map: Record<string, string> = {
      pending: 'ממתין לתשלום',
      awaiting_payment: 'ממתין לתשלום',
      authorized: 'אושר',
      captured: 'שולם',
      voided: 'בוטל',
      failed: 'נכשל',
      refunded: 'הוחזר',
      manual_review: 'דורש בדיקה',
      unknown: 'מצב לא ברור'
    };
    return map[status] || status;
  }

  statusClass(row: PaymentListRow | PaymentDetail): string {
    if (row.requiresManualReview || row.displayStatus === 'manual_review') {
      return 'manual_review';
    }
    return row.displayStatus || row.paymentStatus;
  }

  fulfillmentLabel(f: string): string {
    if (f === 'delivery') return 'משלוח';
    if (f === 'pickup') return 'איסוף';
    return 'לא ידוע';
  }

  orderTypeLabel(t: string | null): string {
    if (t === 'shabbat') return 'שבת';
    if (t === 'catering') return 'קייטרינג';
    return '—';
  }

  severityLabel(s: string | null | undefined): string {
    if (s === 'critical') return 'חשוב';
    if (s === 'warning') return 'אזהרה';
    if (s === 'info') return 'מידע חסר';
    return '—';
  }

  formatAmount(n: number | null | undefined): string {
    const v = Number(n) || 0;
    return `₪${v.toLocaleString('he-IL', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  }

  formatCount(n: number | null | undefined): string {
    return (Number(n) || 0).toLocaleString('he-IL');
  }

  formatDate(value: string | null | undefined): string {
    if (!value) return '—';
    try {
      return (
        new Intl.DateTimeFormat('he-IL', {
          timeZone: 'Asia/Jerusalem',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }).format(new Date(value)) || '—'
      );
    } catch {
      return this.datePipe.transform(value, 'dd/MM/yyyy HH:mm') || '—';
    }
  }

  formatChangePercent(pct: number | null | undefined): string {
    if (pct == null || !Number.isFinite(pct)) return '';
    const sign = pct > 0 ? '+' : '';
    return `${sign}${pct.toLocaleString('he-IL', { maximumFractionDigits: 1 })}%`;
  }

  changeClass(pct: number | null | undefined): string {
    if (pct == null || !Number.isFinite(pct)) return '';
    if (pct > 0) return 'up';
    if (pct < 0) return 'down';
    return 'flat';
  }

  funnelStage(key: FunnelBucket) {
    return this.funnel?.stages?.find((s) => s.key === key) || null;
  }

  trackById(_: number, row: PaymentListRow): string {
    return row.id;
  }

  private applyFromQueryParams(params: ParamMap): void {
    this.syncingFromUrl = true;
    const presetRaw = params.get('preset') || 'this_month';
    const valid: DatePreset[] = ['today', 'last7', 'last30', 'this_month', 'last_month', 'custom'];
    this.preset = valid.includes(presetRaw as DatePreset)
      ? (presetRaw as DatePreset)
      : 'this_month';

    this.filterFrom = params.get('dateFrom') || '';
    this.filterTo = params.get('dateTo') || '';
    this.filterSearch = params.get('search') || '';
    this.filterStatus = params.get('paymentStatus') || '';
    this.filterOrderType = params.get('orderType') || '';
    this.filterFulfillment = params.get('fulfillment') || '';

    const includeRaw = params.get('includeDeletedPayments');
    this.filterIncludeDeleted = !(
      includeRaw === 'false' ||
      includeRaw === '0' ||
      includeRaw === 'active'
    );

    const funnelRaw = params.get('funnelBucket') || 'all';
    this.funnelBucket = FUNNEL_KEYS.includes(funnelRaw as FunnelBucket)
      ? (funnelRaw as FunnelBucket)
      : 'all';

    const exRaw = params.get('exceptionFilter') || 'all';
    this.exceptionFilter =
      exRaw === 'critical' || exRaw === 'warning' || exRaw === 'info'
        ? exRaw
        : 'all';

    this.meta.page = Math.max(1, Number(params.get('page')) || 1);
    this.meta.limit = Math.min(100, Math.max(1, Number(params.get('limit')) || 25));

    const sortRaw = params.get('sortBy') || 'createdAt';
    const validSort: PaymentsSortBy[] = ['createdAt', 'totalPrice', 'paymentStatus', 'orderNumber'];
    this.sortColumn = validSort.includes(sortRaw as PaymentsSortBy)
      ? (sortRaw as PaymentsSortBy)
      : 'createdAt';
    this.sortDirection = params.get('sortDir') === 'asc' ? 'asc' : 'desc';

    this.syncingFromUrl = false;
  }

  private syncUrl(replace = false): void {
    if (this.syncingFromUrl) return;
    const queryParams: Record<string, string | number | boolean | null> = {
      preset: this.preset,
      page: this.meta.page,
      limit: this.meta.limit,
      dateFrom: this.preset === 'custom' && this.filterFrom ? this.filterFrom : null,
      dateTo: this.preset === 'custom' && this.filterTo ? this.filterTo : null,
      search: this.filterSearch.trim() || null,
      paymentStatus: this.filterStatus || null,
      orderType: this.filterOrderType || null,
      fulfillment: this.filterFulfillment || null,
      includeDeletedPayments: this.filterIncludeDeleted ? null : false,
      funnelBucket: this.funnelBucket !== 'all' ? this.funnelBucket : null,
      exceptionFilter: this.exceptionFilter !== 'all' ? this.exceptionFilter : null,
      sortBy: this.sortColumn || 'createdAt',
      sortDir: this.sortDirection
    };

    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
      replaceUrl: replace
    });
  }

  private scopeParams(): PaymentsListParams {
    const params: PaymentsListParams = {
      preset: this.preset,
      includeDeletedPayments: this.filterIncludeDeleted,
      sortBy: this.sortColumn || 'createdAt',
      sortDir: this.sortDirection
    };
    if (this.preset === 'custom') {
      if (this.filterFrom) params.dateFrom = this.filterFrom;
      if (this.filterTo) params.dateTo = this.filterTo;
    }
    return params;
  }

  private listParams(): PaymentsListParams {
    return {
      ...this.scopeParams(),
      page: this.meta.page,
      limit: this.meta.limit,
      search: this.filterSearch.trim() || undefined,
      paymentStatus: this.filterStatus || undefined,
      orderType: this.filterOrderType || undefined,
      fulfillment: this.filterFulfillment || undefined,
      funnelBucket: this.funnelBucket,
      exceptionFilter: this.exceptionFilter,
      sortBy: this.sortColumn || 'createdAt',
      sortDir: this.sortDirection
    };
  }

  private scrollToExceptions(): void {
    requestAnimationFrame(() => {
      this.exceptionsSection?.nativeElement?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  private jerusalemToday(): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jerusalem',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());
  }

  private applyChart(): void {
    const points = this.revenue?.points || [];
    const previous = this.revenue?.previousPoints || null;
    const labels = points.map((p) => this.formatChartLabel(p.date));
    const currentValues = points.map((p) =>
      this.chartMetric === 'revenue' ? Number(p.amount) || 0 : Number(p.count) || 0
    );

    const datasets: ChartData<'line'>['datasets'] = [
      {
        label: this.chartMetric === 'revenue' ? 'הכנסות' : 'עסקאות ששולמו',
        data: currentValues,
        borderColor: '#1e3a5f',
        backgroundColor: 'rgba(37, 99, 235, 0.12)',
        pointRadius: 0,
        pointHoverRadius: 4,
        pointHoverBackgroundColor: '#1e3a5f',
        tension: 0.35,
        fill: true,
        borderWidth: 2.25
      }
    ];

    if (previous && previous.length) {
      const prevValues = previous.map((p) =>
        this.chartMetric === 'revenue' ? Number(p.amount) || 0 : Number(p.count) || 0
      );
      // Align previous series length to current labels for overlay comparison.
      const aligned = labels.map((_, i) => prevValues[i] ?? null);
      datasets.push({
        label: this.chartMetric === 'revenue' ? 'תקופה קודמת' : 'תקופה קודמת (כמות)',
        data: aligned as number[],
        borderColor: '#94a3b8',
        backgroundColor: 'transparent',
        pointRadius: 0,
        pointHoverRadius: 3,
        tension: 0.35,
        fill: false,
        borderWidth: 1.5,
        borderDash: [5, 4]
      });
    }

    this.chartData = { labels, datasets };
  }

  private formatChartLabel(dateKey: string): string {
    if (!dateKey) return '';
    const parts = dateKey.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}`;
    return dateKey;
  }

  private buildChartOptions(metric: ChartMetric): ChartOptions<'line'> {
    const isMoney = metric === 'revenue';
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
            color: '#5a6a74',
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
              return isMoney ? this.formatAmount(value) : this.formatCount(value);
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: '#5a6a74', maxTicksLimit: 8, maxRotation: 0 },
          border: { display: false }
        },
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(217, 224, 230, 0.9)' },
          ticks: {
            color: '#5a6a74',
            callback: (value) => {
              const n = Number(value);
              return isMoney ? this.formatAmount(n) : this.formatCount(n);
            }
          },
          border: { display: false }
        }
      }
    };
  }
}
