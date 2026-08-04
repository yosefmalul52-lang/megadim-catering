import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { OrderService } from '../../../services/order.service';
import { KitchenOpsService, KitchenOpsView } from '../../../services/kitchen-ops.service';
import { SiteSettingsService } from '../../../services/site-settings.service';
import {
  KitchenReportDTO,
  KitchenReportQuery,
  KITCHEN_FULFILLMENT_OPTIONS,
  KITCHEN_MEAL_OPTIONS,
  addDaysToDateKey,
  formatKitchenGeneratedAt,
  toJerusalemDateKey
} from '../../../utils/kitchen-report.util';
import { itemVariantFingerprint } from '../../../utils/order-item-options.util';

type EditMode = 'prep' | 'notes' | null;

type PrepRow = {
  key: string;
  name: string;
  optionLabel: string;
  sizeLabel: string;
  category: string;
  unit: string;
  originalQuantity: number;
  plannedQuantity: number;
  orderCount: number;
  sources: Array<{
    assignmentId?: string;
    orderId: string;
    orderNumber?: string;
    orderItemKey: string;
    quantity: number;
    deliveryDate?: string | null;
    prepDate: string;
    orderKind: string;
    orderKindLabel: string;
    notes?: string;
    allergies?: string;
  }>;
};

type DayOrder = KitchenReportDTO['orderNotes'][number];

type OrderKindFilter = 'all' | 'events' | 'shabbat_ready' | 'catering_shabbat' | 'institutions';

const KITCHEN_MAX_RANGE_DAYS = 60;

/** Primary day-of-kitchen modes (ops stays under advanced). */
type KitchenDayMode = 'orders' | 'prep' | 'changes';

type AssignModal = {
  open: boolean;
  orderId: string;
  orderNumber: string;
  orderItemKey: string;
  dishName: string;
  optionLabel: string;
  sizeLabel: string;
  category: string;
  unit: string;
  orderedQuantity: number;
  quantity: number;
  prepDate: string;
  notes: string;
  allergies: string;
  deliveryDate: string;
  orderKindLabel: string;
  assignmentId?: string;
  version?: number;
  splitMode: boolean;
  splits: Array<{ prepDate: string; quantity: number }>;
};

@Component({
  selector: 'app-admin-kitchen-report',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './kitchen-report.component.html',
  styleUrls: ['./kitchen-report.component.scss']
})
export class AdminKitchenReportComponent implements OnInit, OnDestroy {
  private orderService = inject(OrderService);
  private kitchenOps = inject(KitchenOpsService);
  private siteSettings = inject(SiteSettingsService);
  private router = inject(Router);
  private loadSeq = 0;
  private actionBusy = new Set<string>();

  readonly mealOptions = KITCHEN_MEAL_OPTIONS;
  readonly fulfillmentOptions = KITCHEN_FULFILLMENT_OPTIONS;
  readonly views: Array<{ key: KitchenOpsView; label: string }> = [
    { key: 'today', label: 'היום במטבח' },
    { key: 'fulfillment', label: 'כמויות לאספקה' },
    { key: 'event', label: 'תוכנית אירוע' },
    { key: 'changes', label: 'שינויים וביטולים' }
  ];
  readonly stages = [
    { key: '', label: 'כל השלבים' },
    { key: 'thaw', label: 'הפשרה' },
    { key: 'prep', label: 'הכנה מוקדמת' },
    { key: 'cut', label: 'חיתוך' },
    { key: 'mix', label: 'ערבוב' },
    { key: 'cook', label: 'בישול' },
    { key: 'bake', label: 'אפייה' },
    { key: 'cool', label: 'קירור' },
    { key: 'store', label: 'אחסון' },
    { key: 'pack', label: 'אריזה' },
    { key: 'qa', label: 'בקרת איכות' },
    { key: 'load', label: 'העמסה' },
    { key: 'station_clean', label: 'ניקיון' },
    { key: 'general', label: 'כללי' }
  ];

  view: KitchenOpsView = 'today';
  startDate = '';
  endDate = '';
  day = '';
  meal = 'הכל';
  fulfillmentType = 'הכל';
  preparationSlot = '';
  includeCancelled = true;
  changedOnly = false;
  search = '';
  includeCatering = true;
  stageFilter = '';
  overdueOnly = false;
  blockedOnly = false;
  allergiesOnly = false;
  eventOrderId = '';
  orderKind: OrderKindFilter = 'all';
  dayMode: KitchenDayMode = 'orders';
  readonly dayModes: Array<{ key: KitchenDayMode; label: string }> = [
    { key: 'orders', label: 'הזמנות היום' },
    { key: 'prep', label: 'רשימת הכנות' },
    { key: 'changes', label: 'שינויים' }
  ];
  readonly orderKindOptions: Array<{ key: OrderKindFilter; label: string }> = [
    { key: 'all', label: 'הכול' },
    { key: 'shabbat_ready', label: 'אוכל מוכן לשבת וחג' },
    { key: 'catering_shabbat', label: 'קייטרינג לאירועי שבת וחג' },
    { key: 'events', label: 'קייטרינג לאירועים' },
    { key: 'institutions', label: 'מוסדות' }
  ];
  readonly rangePresets: Array<{ key: 'today' | 'tomorrow' | 'week' | 'custom'; label: string }> = [
    { key: 'today', label: 'היום' },
    { key: 'tomorrow', label: 'מחר' },
    { key: 'week', label: '7 ימים קדימה' },
    { key: 'custom', label: 'טווח מותאם' }
  ];
  rangePreset: 'today' | 'tomorrow' | 'week' | 'custom' = 'today';
  printAction = '';
  openJumpDate = '';
  openOrdersExpanded = false;
  expandedOrderIds = new Set<string>();
  moreNavOpen = false;

  report: KitchenReportDTO | null = null;
  prepDay: any = null;
  ops: any = null;
  isLoading = false;
  errorMessage = '';
  successMessage = '';
  exportBusy: string | null = null;
  expandedDishKeys = new Set<string>();
  expandedOrders = true;
  selectedTaskIds = new Set<string>();
  advancedOpen = false;
  prepListsEnabled = true;
  prepRows: PrepRow[] = [];

  assignModal: AssignModal = {
    open: false,
    orderId: '',
    orderNumber: '',
    orderItemKey: '',
    dishName: '',
    optionLabel: '',
    sizeLabel: '',
    category: '',
    unit: "יח'",
    orderedQuantity: 0,
    quantity: 0,
    prepDate: '',
    notes: '',
    allergies: '',
    deliveryDate: '',
    orderKindLabel: '',
    splitMode: false,
    splits: []
  };
  assignSaving = false;
  assignError = '';

  editMode: EditMode = null;
  editOrderId = '';
  editOrderLabel = '';
  editPrepLocal = '';
  editAllergies = '';
  editSpecialRequests = '';
  editSaving = false;
  editError = '';

  wizardOpen = false;
  wizardStep = 1;
  wizardOrderId = '';
  wizardPreview: any = null;
  wizardSaving = false;
  wizardError = '';
  wizardTemplateName = '';
  partialQtyDraft: Record<string, number | null> = {};

  ngOnInit(): void {
    const today = toJerusalemDateKey();
    this.day = today;
    this.startDate = today;
    this.endDate = today;
    this.siteSettings.getSettings(true).subscribe({
      next: (s) => {
        this.prepListsEnabled = s.kitchenPrepListsEnabled !== false;
      },
      error: () => {
        this.prepListsEnabled = true;
      }
    });
    this.load();
  }

  get dayOrders(): DayOrder[] {
    return this.report?.orderNotes || [];
  }

  get missingChoiceLines(): number {
    return Number(this.report?.summary?.missingChoiceLines || 0);
  }

  get hasMissingChoices(): boolean {
    return this.missingChoiceLines > 0;
  }

  get openEventsAlert() {
    return this.report?.openEventsAlert || null;
  }

  formatEventDateChip(dateKey: string): string {
    const key = String(dateKey || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return key || '—';
    const [y, m, d] = key.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d, 12));
    return new Intl.DateTimeFormat('he-IL', {
      timeZone: 'UTC',
      weekday: 'short',
      day: 'numeric',
      month: 'numeric'
    }).format(dt);
  }

  eventDateChipTitle(row: { date: string; count: number; overdue: boolean; orders?: Array<{ orderNumber?: string; customerName?: string }> }): string {
    const names = (row.orders || [])
      .map((o) => o.orderNumber || o.customerName || '')
      .filter(Boolean)
      .slice(0, 4)
      .join(', ');
    const base = `${row.date} · ${row.count} אירועים${row.overdue ? ' (באיחור)' : ''}`;
    return names ? `${base} · ${names}` : base;
  }

  jumpToOpenEventDate(dateKey: string): void {
    const day = String(dateKey || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return;
    this.day = day;
    this.startDate = day;
    this.endDate = day;
    this.openJumpDate = day;
    this.rangePreset = day === toJerusalemDateKey() ? 'today' : 'custom';
    this.orderKind = 'all';
    this.dayMode = 'orders';
    this.load();
  }

  get changeOrders(): DayOrder[] {
    return (this.report?.orderNotes || []).filter((o) => o.isChanged || o.isCancelled);
  }

  get orderKindLabel(): string {
    return this.orderKindOptions.find((o) => o.key === this.orderKind)?.label || 'הכול';
  }

  setDayMode(mode: KitchenDayMode): void {
    this.dayMode = mode;
    if (mode === 'changes') {
      this.advancedOpen = false;
      this.view = 'changes';
    }
  }

  ngOnDestroy(): void {
    this.loadSeq += 1;
  }

  get generatedLabel(): string {
    if (this.ops?.generatedAt) return formatKitchenGeneratedAt(this.ops.generatedAt);
    if (this.prepDay?.generatedAt) return formatKitchenGeneratedAt(this.prepDay.generatedAt);
    return this.report ? formatKitchenGeneratedAt(this.report.generatedAt) : '';
  }

  get preparationSlotOptions(): string[] {
    const keys = (this.report?.preparationGroups || []).map((g) => g.preparationKey);
    return [...new Set(keys)];
  }

  get criticalAllergyBanner(): any[] {
    return this.ops?.changes?.criticalAllergyAcksNeeded || [];
  }

  get rangeLabel(): string {
    const from = this.startDate || this.day || toJerusalemDateKey();
    const to = this.endDate || from;
    return from === to ? from : `${from} – ${to}`;
  }

  get isSingleDayRange(): boolean {
    const from = this.startDate || this.day;
    const to = this.endDate || from;
    return !!from && from === to;
  }

  /** Inclusive calendar-day count between YYYY-MM-DD keys (Jerusalem calendar dates). */
  private rangeDayCount(from: string, to: string): number {
    const startMs = Date.parse(`${from}T00:00:00+03:00`);
    const endMs = Date.parse(`${to}T00:00:00+03:00`);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return 1;
    return Math.floor((endMs - startMs) / (24 * 60 * 60 * 1000)) + 1;
  }

  private assertDateRangeOk(from: string, to: string): boolean {
    const days = this.rangeDayCount(from, to);
    if (days > KITCHEN_MAX_RANGE_DAYS) {
      this.errorMessage = `טווח התאריכים לא יכול לעלות על ${KITCHEN_MAX_RANGE_DAYS} ימים`;
      this.isLoading = false;
      return false;
    }
    return true;
  }

  buildClassicQuery(): KitchenReportQuery {
    const from = this.startDate || this.day || toJerusalemDateKey();
    const to = this.endDate || from;
    return {
      startDate: from,
      endDate: to < from ? from : to,
      meal: this.meal !== 'הכל' ? this.meal : undefined,
      fulfillmentType: this.fulfillmentType !== 'הכל' ? this.fulfillmentType : undefined,
      preparationSlot: this.preparationSlot || undefined,
      includeCancelled: this.includeCancelled,
      changedOnly: this.changedOnly,
      search: this.search.trim() || undefined,
      includeCatering: this.includeCatering,
      orderKind: this.orderKind,
      dateBasis: 'delivery'
    };
  }

  onDayChange(): void {
    this.startDate = this.day;
    this.endDate = this.day;
    this.load();
  }

  onRangeChange(): void {
    const from = this.startDate || toJerusalemDateKey();
    let to = this.endDate || from;
    if (to < from) to = from;
    this.startDate = from;
    this.endDate = to;
    this.day = from;
    this.rangePreset = from === to && from === toJerusalemDateKey() ? 'today' : 'custom';
    if (!this.assertDateRangeOk(from, to)) return;
    this.load();
  }

  setRangeToToday(): void {
    this.applyRangePreset('today');
  }

  onQuickNav(dest: string): void {
    if (dest === 'orders') this.router.navigateByUrl('/admin/orders');
    else if (dest === 'settings') this.router.navigateByUrl('/admin/settings');
  }

  applyRangePreset(preset: 'today' | 'tomorrow' | 'week' | 'custom' | string): void {
    const key = (preset || 'today') as 'today' | 'tomorrow' | 'week' | 'custom';
    this.rangePreset = key;
    const today = toJerusalemDateKey();
    if (key === 'today') {
      this.day = today;
      this.startDate = today;
      this.endDate = today;
      this.load();
      return;
    }
    if (key === 'tomorrow') {
      const tomorrow = addDaysToDateKey(today, 1);
      this.day = tomorrow;
      this.startDate = tomorrow;
      this.endDate = tomorrow;
      this.load();
      return;
    }
    if (key === 'week') {
      this.day = today;
      this.startDate = today;
      this.endDate = addDaysToDateKey(today, 6);
      this.load();
      return;
    }
    // custom — keep current dates, just reveal date inputs
  }

  onOrderKindSelect(kind: OrderKindFilter | string): void {
    this.setOrderKind((kind as OrderKindFilter) || 'all');
  }

  onDayModeSelect(mode: KitchenDayMode | string): void {
    this.setDayMode((mode as KitchenDayMode) || 'orders');
  }

  onOpenJumpDate(dateKey: string): void {
    this.openJumpDate = dateKey;
    if (dateKey) this.jumpToOpenEventDate(dateKey);
  }

  runPrintAction(action: string): void {
    this.printAction = '';
    if (!action) return;
    if (action === 'orders') this.printAllOrders();
    else if (action === 'prep') this.printPrepList();
    else if (action === 'prep-draft') this.printPrepListDraft();
    else if (action === 'deltas') this.printDeltas();
  }

  toggleOpenOrdersPanel(): void {
    this.openOrdersExpanded = !this.openOrdersExpanded;
  }

  formatItemSize(it: { optionLabel?: string; sizeLabel?: string }): string {
    const option = String(it?.optionLabel || '').trim();
    const size = String(it?.sizeLabel || '').trim();
    if (!option && !size) return '—';
    if (option === 'בחירה חסרה לבדיקה') return option;
    if (option && size && option !== size) {
      // Prefer human label when it already contains units (e.g. 250 מ"ל).
      if (/\d/.test(option) && (option.includes('מ') || option.includes('ל') || option.includes('גר') || option.includes('ק'))) {
        return option;
      }
      return `${option} · ${size}`;
    }
    return option || size;
  }

  /** Sum of kitchen line quantities (packages/portions), not distinct dish names. */
  orderKitchenUnits(o: { items?: Array<{ quantity?: number }> | null }): number {
    return (o.items || []).reduce((sum, it) => sum + (Number(it?.quantity) || 0), 0);
  }

  isOrderExpanded(orderId: string): boolean {
    return this.expandedOrderIds.has(orderId);
  }

  toggleOrderExpanded(orderId: string): void {
    if (this.expandedOrderIds.has(orderId)) this.expandedOrderIds.delete(orderId);
    else this.expandedOrderIds.add(orderId);
  }

  setOrderKind(kind: OrderKindFilter): void {
    this.orderKind = kind;
    this.load();
  }

  buildOpsParams(): Record<string, string | boolean | undefined> {
    return {
      view: this.view,
      day: this.day,
      startDate: this.startDate,
      endDate: this.endDate,
      meal: this.meal !== 'הכל' ? this.meal : undefined,
      fulfillmentType: this.fulfillmentType !== 'הכל' ? this.fulfillmentType : undefined,
      includeCancelled: this.includeCancelled,
      changedOnly: this.changedOnly,
      search: this.search.trim() || undefined,
      includeCatering: this.includeCatering,
      stage: this.stageFilter || undefined,
      overdue: this.overdueOnly || undefined,
      blocked: this.blockedOnly || undefined,
      allergiesOnly: this.allergiesOnly || undefined,
      orderId: this.view === 'event' ? this.eventOrderId || undefined : undefined,
      orderKind: this.orderKind
    };
  }

  load(options?: { keepError?: boolean }): void {
    const from = this.startDate || this.day || toJerusalemDateKey();
    const to = this.endDate || from;
    if (!this.assertDateRangeOk(from, to < from ? from : to)) return;

    const seq = ++this.loadSeq;
    this.isLoading = true;
    if (!options?.keepError) this.errorMessage = '';
    this.orderService.getAdvancedKitchenReport(this.buildClassicQuery()).subscribe({
      next: (report) => {
        if (seq !== this.loadSeq) return;
        this.report = report;
        this.isLoading = false;
        // Multi-day: prep-day API is single-day only — aggregate from classic groups.
        if (this.prepListsEnabled && !this.isSingleDayRange) {
          this.prepDay = null;
          this.rebuildPrepRows();
        }
      },
      error: (err: unknown) => {
        if (seq !== this.loadSeq) return;
        this.isLoading = false;
        const http = err as HttpErrorResponse;
        this.errorMessage =
          (http?.error && typeof http.error === 'object' && (http.error as any).message) ||
          'לא ניתן לטעון את דוח המטבח';
      }
    });
    if (this.prepListsEnabled && this.isSingleDayRange) {
      this.kitchenOps.getPrepDayReport({ day: this.startDate || this.day || toJerusalemDateKey(), orderKind: this.orderKind }).subscribe({
        next: (prepDay) => {
          if (seq !== this.loadSeq) return;
          this.prepDay = prepDay;
          this.rebuildPrepRowsFromPrepDay();
        },
        error: () => {
          if (seq !== this.loadSeq) return;
          this.prepDay = null;
          this.rebuildPrepRows();
        }
      });
    }
    this.kitchenOps.getOpsReport(this.buildOpsParams()).subscribe({
      next: (ops) => {
        if (seq !== this.loadSeq) return;
        this.ops = ops;
        if (!this.report && ops?.kitchenQuantitiesReport) {
          this.report = ops.kitchenQuantitiesReport;
        }
      },
      error: () => {
        /* advanced optional */
      }
    });
  }

  rebuildPrepRowsFromPrepDay(): void {
    this.prepRows = (this.prepDay?.lines || []).map((d: any) => ({
      key: d.key,
      name: d.name,
      optionLabel: d.optionLabel || '',
      sizeLabel: d.sizeLabel || '',
      category: d.category || 'כללי',
      unit: d.unit || "יח'",
      originalQuantity: d.quantity,
      plannedQuantity: d.quantity,
      orderCount: d.orderCount,
      sources: d.sources || []
    }));
  }

  rebuildPrepRows(): void {
    const map = new Map<string, PrepRow>();
    for (const pg of this.report?.preparationGroups || []) {
      for (const mg of pg.meals || []) {
        for (const d of mg.dishes || []) {
          const existing = map.get(d.key);
          if (existing) {
            existing.originalQuantity += d.quantity;
            existing.plannedQuantity += d.quantity;
            existing.orderCount += d.orderCount;
            existing.sources.push(
              ...(d.sources || []).map((s: any) => ({
                orderId: s.orderId,
                orderNumber: s.orderNumber,
                orderItemKey: d.key,
                quantity: s.quantity,
                deliveryDate: null,
                prepDate: this.day,
                orderKind: 'shabbat_ready',
                orderKindLabel: 'אוכל מוכן לשבת וחג'
              }))
            );
          } else {
            map.set(d.key, {
              key: d.key,
              name: d.name,
              optionLabel: d.optionLabel || '',
              sizeLabel: d.sizeLabel || '',
              category: d.category || 'כללי',
              unit: d.unit || "יח'",
              originalQuantity: d.quantity,
              plannedQuantity: d.quantity,
              orderCount: d.orderCount,
              sources: (d.sources || []).map((s: any) => ({
                orderId: s.orderId,
                orderNumber: s.orderNumber,
                orderItemKey: d.key,
                quantity: s.quantity,
                deliveryDate: null,
                prepDate: this.day,
                orderKind: 'shabbat_ready',
                orderKindLabel: 'אוכל מוכן לשבת וחג'
              }))
            });
          }
        }
      }
    }
    this.prepRows = [...map.values()].sort((a, b) =>
      a.category === b.category ? a.name.localeCompare(b.name, 'he') : a.category.localeCompare(b.category, 'he')
    );
  }

  resetPrepQuantities(): void {
    for (const row of this.prepRows) row.plannedQuantity = row.originalQuantity;
  }

  private openPrintWindow(title: string, bodyHtml: string): void {
    const w = window.open('', '_blank');
    if (!w) {
      this.errorMessage = 'הדפדפן חסם חלון הדפסה — אפשר חלונות קופצים';
      return;
    }
    w.document.open();
    // bodyHtml may already be a full HTML document (SSOT from server).
    if (/<!doctype html>/i.test(bodyHtml) || /<html[\s>]/i.test(bodyHtml)) {
      w.document.write(bodyHtml);
    } else {
      w.document.write(`<!doctype html><html lang="he" dir="rtl"><head>
<meta charset="utf-8"/>
<title>${title}</title>
</head><body>${bodyHtml}</body></html>`);
    }
    w.document.close();
    setTimeout(() => w.print(), 250);
  }

  private openServerPrintPack(
    pack: 'prep' | 'orders' | 'order' | 'deltas' | 'full',
    opts?: { orderId?: string; allowMissingDraft?: boolean; markPrinted?: boolean }
  ): void {
    this.exportBusy = pack;
    this.errorMessage = '';
    this.orderService
      .getKitchenPrintPack(pack, this.buildClassicQuery(), {
        orderId: opts?.orderId,
        allowMissingDraft: opts?.allowMissingDraft
      })
      .subscribe({
        next: (html) => {
          this.exportBusy = null;
          this.openPrintWindow(`מטבח ${pack}`, html);
          if (opts?.markPrinted && (pack === 'prep' || pack === 'full')) {
            this.orderService.markKitchenPrinted(this.buildClassicQuery()).subscribe({
              next: () => {
                this.successMessage = 'נשמר חתך הדפסה למטבח (ללא מייל ללקוח)';
                setTimeout(() => (this.successMessage = ''), 3000);
                this.load({ keepError: true });
              },
              error: () => {
                /* non-blocking */
              }
            });
          }
        },
        error: (err: HttpErrorResponse) => {
          this.exportBusy = null;
          if (err?.status === 409) {
            this.errorMessage =
              'ההדפסה נחסמה — יש פריטים עם בחירה חסרה לבדיקה. תקנו גדלים בהזמנות ואז הדפיסו מחדש.';
            return;
          }
          this.errorMessage = 'שגיאה בהפקת הדפסת מטבח';
        }
      });
  }

  printSingleOrder(o: DayOrder): void {
    this.openServerPrintPack('order', { orderId: o.orderId });
  }

  printAllOrders(): void {
    if (!this.dayOrders.length) {
      this.errorMessage = 'אין הזמנות להדפסה';
      return;
    }
    this.openServerPrintPack('orders');
  }

  printPrepList(opts?: { allowMissingDraft?: boolean }): void {
    if (this.hasMissingChoices && !opts?.allowMissingDraft) {
      this.errorMessage = `לא ניתן להדפיס רשימת הכנות לייצור — יש ${this.missingChoiceLines} פריטים עם בחירה חסרה.`;
      return;
    }
    this.openServerPrintPack('prep', {
      allowMissingDraft: opts?.allowMissingDraft,
      markPrinted: !opts?.allowMissingDraft
    });
  }

  printPrepListDraft(): void {
    this.printPrepList({ allowMissingDraft: true });
  }

  printDeltas(): void {
    this.openServerPrintPack('deltas');
    this.setDayMode('changes');
  }

  openAssignFromOrderItem(order: DayOrder, item: NonNullable<DayOrder['items']>[number]): void {
    if (String(order.orderId || '').startsWith('inst-')) {
      this.errorMessage = 'הקצאת הכנה למוסדות מתבצעת דרך דוח המוסדות';
      return;
    }
    const optionLabel = item.optionLabel || '';
    const sizeLabel = item.sizeLabel || '';
    const category = item.category || 'כללי';
    const orderItemKey = itemVariantFingerprint({
      productId: (item as { productId?: string }).productId,
      name: item.name,
      category,
      selectedOption: {
        label: optionLabel,
        amount: sizeLabel,
        missingForReview: (item as { missingChoice?: boolean }).missingChoice === true
      }
    });
    this.assignModal = {
      open: true,
      orderId: order.orderId,
      orderNumber: order.orderNumber || order.orderId,
      orderItemKey,
      dishName: item.name,
      optionLabel,
      sizeLabel,
      category,
      unit: item.unit || "יח'",
      orderedQuantity: item.quantity,
      quantity: item.quantity,
      prepDate: order.preparationDate || this.day || toJerusalemDateKey(),
      notes: order.specialRequests || order.customerNotes || '',
      allergies: order.allergies || '',
      deliveryDate: order.deliveryDate || this.day,
      orderKindLabel: order.orderKindLabel || '',
      splitMode: false,
      splits: []
    };
    this.assignError = '';
  }

  openAssignFromPrepSource(row: PrepRow, source: PrepRow['sources'][number]): void {
    if (String(source.orderId || '').startsWith('inst-')) {
      this.errorMessage = 'הקצאת הכנה למוסדות מתבצעת דרך דוח המוסדות';
      return;
    }
    this.assignModal = {
      open: true,
      orderId: source.orderId,
      orderNumber: source.orderNumber || source.orderId,
      orderItemKey: source.orderItemKey,
      dishName: row.name,
      optionLabel: row.optionLabel,
      sizeLabel: row.sizeLabel,
      category: row.category,
      unit: row.unit,
      orderedQuantity: source.quantity,
      quantity: source.quantity,
      prepDate: source.prepDate || this.day,
      notes: source.notes || '',
      allergies: source.allergies || '',
      deliveryDate: source.deliveryDate || '',
      orderKindLabel: source.orderKindLabel || '',
      assignmentId: source.assignmentId,
      splitMode: false,
      splits: [
        { prepDate: source.prepDate || this.day, quantity: Math.ceil(source.quantity / 2) },
        { prepDate: addDaysToDateKey(source.prepDate || this.day, 1), quantity: Math.floor(source.quantity / 2) }
      ]
    };
    this.assignError = '';
  }

  closeAssignModal(): void {
    this.assignModal.open = false;
    this.assignSaving = false;
    this.assignError = '';
  }

  enableSplitMode(): void {
    const q = this.assignModal.quantity || this.assignModal.orderedQuantity;
    this.assignModal.splitMode = true;
    if (!this.assignModal.splits.length) {
      this.assignModal.splits = [
        { prepDate: this.assignModal.prepDate || this.day, quantity: Math.ceil(q / 2) },
        { prepDate: addDaysToDateKey(this.assignModal.prepDate || this.day, 1), quantity: Math.floor(q / 2) }
      ];
    }
  }

  addSplitRow(): void {
    this.assignModal.splits.push({
      prepDate: addDaysToDateKey(this.assignModal.prepDate || this.day, this.assignModal.splits.length),
      quantity: 1
    });
  }

  saveAssignModal(): void {
    if (!this.assignModal.orderId) return;
    this.assignSaving = true;
    this.assignError = '';
    if (this.assignModal.splitMode) {
      this.kitchenOps
        .splitPrepAssignment({
          orderId: this.assignModal.orderId,
          orderItemKey: this.assignModal.orderItemKey,
          dishName: this.assignModal.dishName,
          optionLabel: this.assignModal.optionLabel,
          sizeLabel: this.assignModal.sizeLabel,
          category: this.assignModal.category,
          unit: this.assignModal.unit,
          orderedQuantity: this.assignModal.orderedQuantity,
          notes: this.assignModal.notes,
          splits: this.assignModal.splits
        })
        .subscribe({
          next: () => {
            this.assignSaving = false;
            this.successMessage = 'המנה חולקה לימי הכנה (כמות ההזמנה לא השתנתה)';
            this.closeAssignModal();
            this.load();
          },
          error: (err: unknown) => {
            this.assignSaving = false;
            const http = err as HttpErrorResponse;
            this.assignError =
              (http?.error && typeof http.error === 'object' && (http.error as any).message) ||
              'חלוקת ההכנה נכשלה';
          }
        });
      return;
    }
    this.kitchenOps
      .upsertPrepAssignment({
        assignmentId: this.assignModal.assignmentId,
        orderId: this.assignModal.orderId,
        orderItemKey: this.assignModal.orderItemKey,
        dishName: this.assignModal.dishName,
        optionLabel: this.assignModal.optionLabel,
        sizeLabel: this.assignModal.sizeLabel,
        category: this.assignModal.category,
        unit: this.assignModal.unit,
        quantity: this.assignModal.quantity,
        prepDate: this.assignModal.prepDate,
        notes: this.assignModal.notes,
        version: this.assignModal.version
      })
      .subscribe({
        next: () => {
          this.assignSaving = false;
          this.successMessage = 'תאריך ההכנה נשמר — ההכנה תופיע בדוח של אותו יום';
          this.closeAssignModal();
          this.load();
        },
        error: (err: unknown) => {
          this.assignSaving = false;
          const http = err as HttpErrorResponse;
          this.assignError =
            (http?.error && typeof http.error === 'object' && (http.error as any).message) ||
            'שמירת הקצאת ההכנה נכשלה';
        }
      });
  }

  setView(v: KitchenOpsView | string): void {
    this.view = (v as KitchenOpsView) || 'today';
    this.load();
  }

  applyFilters(): void {
    const from = this.startDate || this.day || toJerusalemDateKey();
    let to = this.endDate || from;
    if (to < from) to = from;
    this.startDate = from;
    this.endDate = to;
    this.day = from;
    this.load();
  }

  onMealChange(): void {
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

  toggleTaskSelect(id: string): void {
    if (this.selectedTaskIds.has(id)) this.selectedTaskIds.delete(id);
    else this.selectedTaskIds.add(id);
  }

  reportNote(task: any): void {
    const notes = window.prompt('הערה למשימה', task.notes || '');
    if (notes == null) return;
    this.runAction(task, 'note', { notes });
  }

  reportShortage(task: any): void {
    const qty = window.prompt('כמה חסר?', '1');
    if (qty == null) return;
    const notes = `חוסר: חסרים ${qty} ${task.unit || ''}`.trim();
    this.runAction(task, 'note', { notes: `${task.notes ? task.notes + ' · ' : ''}${notes}` });
  }

  reportFault(task: any): void {
    const reason = window.prompt('תיאור תקלה', 'תקלה בתחנה');
    if (reason == null || !reason.trim()) return;
    this.runAction(task, 'block', { reason: `תקלה: ${reason.trim()}` });
  }

  assignDemo(task: any): void {
    const assigneeName = window.prompt('שם עובד', task.assigneeName || 'עובד מטבח');
    if (assigneeName == null) return;
    const stationName = window.prompt('שם תחנה', task.stationName || 'קו חם');
    if (stationName == null) return;
    this.runAction(task, 'assign', { assigneeName, stationName });
  }

  markUrgent(task: any): void {
    this.kitchenOps.updateTask(task.id || task._id, { version: task.version, urgency: 'critical' }).subscribe({
      next: () => {
        this.successMessage = 'עודכן לדחוף';
        this.load();
      },
      error: (err: unknown) => {
        const http = err as HttpErrorResponse;
        if (http?.status === 409) {
          this.errorMessage = 'המשימה עודכנה במסך אחר — מרענן…';
          this.load({ keepError: true });
          return;
        }
        this.errorMessage = 'עדכון דחיפות נכשל';
      }
    });
  }

  bulkCompleteSelected(): void {
    const ids = [...this.selectedTaskIds];
    if (!ids.length) {
      this.errorMessage = 'יש לבחור משימות לעדכון מרוכז';
      return;
    }
    this.kitchenOps.bulkActions({ taskIds: ids, action: 'complete' }).subscribe({
      next: () => {
        this.selectedTaskIds.clear();
        this.successMessage = 'עודכנו משימות נבחרות';
        this.load();
      },
      error: (err: unknown) => {
        const http = err as HttpErrorResponse;
        this.errorMessage =
          (http?.error && typeof http.error === 'object' && (http.error as any).message) ||
          'עדכון מרוכז נכשל';
      }
    });
  }

  isActionBusy(id: string): boolean {
    return this.actionBusy.has(id);
  }

  runAction(task: any, action: string, payload?: any): void {
    const id = task.id || task._id;
    if (!id || this.actionBusy.has(id)) return;
    this.actionBusy.add(id);
    this.errorMessage = '';
    this.successMessage = '';
    const key = `${id}:${action}:${Date.now()}`;
    this.kitchenOps.taskAction(id, { action, version: task.version, payload }, key).subscribe({
      next: () => {
        this.actionBusy.delete(id);
        this.successMessage = 'המשימה עודכנה';
        this.load();
      },
      error: (err: unknown) => {
        this.actionBusy.delete(id);
        const http = err as HttpErrorResponse;
        if (http?.status === 409) {
          this.errorMessage = 'המשימה עודכנה במסך אחר — מרענן…';
          this.load({ keepError: true });
          return;
        }
        this.errorMessage =
          (http?.error && typeof http.error === 'object' && (http.error as any).message) ||
          'עדכון המשימה נכשל';
      }
    });
  }

  completePartial(task: any): void {
    const id = task.id || task._id;
    const qty = this.partialQtyDraft[id];
    if (qty == null || Number(qty) < 0) {
      this.errorMessage = 'יש להזין כמות בפועל תקינה';
      return;
    }
    this.runAction(task, 'partial', { actualQuantity: Number(qty) });
  }

  ackAllergy(task: any): void {
    const orderId = task.orderId;
    if (!orderId) return;
    this.kitchenOps
      .syncReview(String(orderId), {
        taskIds: [task.id || task._id],
        decision: 'accept',
        note: 'אלרגיה אושרה ע״י אחראי'
      })
      .subscribe({
        next: () => {
          this.successMessage = 'התראת אלרגיה אושרה ונרשמה';
          this.load();
        },
        error: () => {
          this.errorMessage = 'אישור האלרגיה נכשל';
        }
      });
  }

  openWizard(): void {
    this.wizardOpen = true;
    this.wizardStep = 1;
    this.wizardOrderId = '';
    this.wizardPreview = null;
    this.wizardError = '';
    this.wizardTemplateName = '';
  }

  closeWizard(): void {
    this.wizardOpen = false;
    this.wizardSaving = false;
  }

  previewPlan(): void {
    if (!this.wizardOrderId.trim()) {
      this.wizardError = 'יש להזין מזהה הזמנה';
      return;
    }
    this.wizardSaving = true;
    this.wizardError = '';
    this.kitchenOps.buildPlan({ orderId: this.wizardOrderId.trim(), commit: false }).subscribe({
      next: (data) => {
        this.wizardSaving = false;
        this.wizardPreview = data;
        this.wizardStep = 2;
      },
      error: (err: unknown) => {
        this.wizardSaving = false;
        const http = err as HttpErrorResponse;
        this.wizardError =
          (http?.error && typeof http.error === 'object' && (http.error as any).message) ||
          'תצוגה מקדימה נכשלה';
      }
    });
  }

  commitPlan(): void {
    if (!this.wizardOrderId.trim()) return;
    this.wizardSaving = true;
    this.wizardError = '';
    this.kitchenOps
      .buildPlan({
        orderId: this.wizardOrderId.trim(),
        commit: true,
        saveAsTemplateName: this.wizardTemplateName.trim() || undefined,
        days: this.wizardPreview?.tasks
          ? undefined
          : undefined
      })
      .subscribe({
        next: () => {
          this.wizardSaving = false;
          this.closeWizard();
          this.successMessage = 'תוכנית ההכנה נשמרה';
          this.eventOrderId = this.wizardOrderId.trim();
          this.view = 'event';
          this.load();
        },
        error: (err: unknown) => {
          this.wizardSaving = false;
          const http = err as HttpErrorResponse;
          this.wizardError =
            (http?.error && typeof http.error === 'object' && (http.error as any).message) ||
            'שמירת התוכנית נכשלה';
        }
      });
  }

  openPrepEdit(order: KitchenReportDTO['orderNotes'][number]): void {
    this.editMode = 'prep';
    this.editOrderId = order.orderId;
    this.editOrderLabel = order.orderNumber || order.orderId;
    this.editError = '';
    this.successMessage = '';
    this.editPrepLocal = '';
  }

  openNotesEdit(order: KitchenReportDTO['orderNotes'][number]): void {
    this.editMode = 'notes';
    this.editOrderId = order.orderId;
    this.editOrderLabel = order.orderNumber || order.orderId;
    this.editAllergies = order.allergies || '';
    this.editSpecialRequests = order.specialRequests || '';
    this.editError = '';
    this.successMessage = '';
  }

  cancelEdit(): void {
    this.editMode = null;
    this.editOrderId = '';
    this.editError = '';
    this.editSaving = false;
  }

  saveEdit(): void {
    if (!this.editOrderId || !this.editMode) return;
    this.editError = '';
    this.successMessage = '';
    if (this.editMode === 'prep') {
      const value = this.editPrepLocal ? new Date(this.editPrepLocal).toISOString() : null;
      if (this.editPrepLocal && Number.isNaN(new Date(this.editPrepLocal).getTime())) {
        this.editError = 'זמן הכנה אינו תקין';
        return;
      }
      this.editSaving = true;
      this.orderService.updateKitchenPreparation(this.editOrderId, value).subscribe({
        next: () => {
          this.editSaving = false;
          this.successMessage = 'זמן ההכנה עודכן (תאריך האספקה לא שונה)';
          this.cancelEdit();
          this.load();
        },
        error: (err: unknown) => {
          this.editSaving = false;
          const http = err as HttpErrorResponse;
          this.editError =
            (http?.error && typeof http.error === 'object' && (http.error as any).message) ||
            'שמירת זמן ההכנה נכשלה';
        }
      });
      return;
    }
    if (this.editAllergies.length > 500) {
      this.editError = 'אלרגיות: עד 500 תווים';
      return;
    }
    if (this.editSpecialRequests.length > 1000) {
      this.editError = 'בקשות מיוחדות: עד 1000 תווים';
      return;
    }
    this.editSaving = true;
    this.orderService
      .updateKitchenAllergyInfo(this.editOrderId, {
        allergies: this.editAllergies.trim(),
        specialRequests: this.editSpecialRequests.trim()
      })
      .subscribe({
        next: () => {
          this.editSaving = false;
          this.successMessage = 'אלרגיות ובקשות מיוחדות עודכנו';
          this.cancelEdit();
          this.load();
        },
        error: (err: unknown) => {
          this.editSaving = false;
          const http = err as HttpErrorResponse;
          this.editError =
            (http?.error && typeof http.error === 'object' && (http.error as any).message) ||
            'שמירת הערות המטבח נכשלה';
        }
      });
  }

  export(format: 'csv' | 'xlsx' | 'pdf' | 'print'): void {
    this.exportBusy = format;
    this.errorMessage = '';
    this.kitchenOps.exportOps(format, this.buildOpsParams()).subscribe({
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
        a.download = `kitchen-ops_${this.day}.${format === 'xlsx' ? 'xlsx' : format}`;
        a.click();
        URL.revokeObjectURL(url);
      },
      error: () => {
        // fallback classic export
        this.orderService.exportKitchenReport(format, this.buildClassicQuery()).subscribe({
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
            a.download = `kitchen-report_${this.startDate}_${this.endDate}.${format === 'xlsx' ? 'xlsx' : format}`;
            a.click();
            URL.revokeObjectURL(url);
          },
          error: () => {
            this.exportBusy = null;
            this.errorMessage = 'ייצוא נכשל';
          }
        });
      }
    });
  }

  alertIcon(kind: string): string {
    if (kind === 'allergy') return 'fa-exclamation-triangle';
    if (kind === 'cancellation') return 'fa-ban';
    return 'fa-pen';
  }

  trackTask(_: number, t: any): string {
    return t.id || t._id;
  }
}
