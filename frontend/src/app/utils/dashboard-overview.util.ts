/**
 * Pure helpers for admin business dashboard (GET /api/order/dashboard-overview).
 */

export type DashboardPresetKey = 'today' | 'week' | 'last30' | 'month' | 'year' | 'custom';

/** Primary range presets (aligned with admin-payments). */
export type PrimaryDatePreset =
  | 'today'
  | 'last7'
  | 'last30'
  | 'this_month'
  | 'last_month'
  | 'custom';

export interface DashboardKpiTriple {
  value: number;
  previousValue: number;
  changePercent: number | null;
}

export type BusinessReviewAlertSeverity = 'critical' | 'warning' | 'info';

export interface BusinessReviewKpi {
  value: number;
  previousValue?: number;
  changePercent?: number | null;
  tooltipHe?: string;
  dateBasis?: string;
  cancelledCount?: number;
  deletedExcluded?: boolean;
  methodHe?: string;
  insufficientData?: boolean;
  windowDays?: number;
  basisHe?: string;
}

export interface BusinessReviewAlert {
  id: string;
  severity: BusinessReviewAlertSeverity;
  type: string;
  titleHe: string;
  explanationHe: string;
  orderId: string;
  orderNumber?: string;
  customerName?: string;
  relevantDate: string | null;
  href: string;
}

export interface BusinessReviewUpcomingItem {
  id: string;
  orderNumber?: string;
  customerName?: string;
  eventDate?: string | null;
  fulfillment: 'delivery' | 'pickup' | 'unknown';
  status: string;
  paymentStatus?: string;
  totalPrice: number;
  orderKind?: string;
  window: 'today' | 'tomorrow' | 'next7';
  hasException?: boolean;
  requiresManualReview?: boolean;
}

export interface BusinessReviewTopDish {
  name: string;
  category?: string;
  quantity: number;
  orderCount?: number;
  revenue: number | null;
  revenueReliable?: boolean;
}

export interface BusinessReviewReturningCustomer {
  identityKeyHash: string;
  displayName: string;
  orderCount: number;
  paidTotal: number;
  lastOrderAt: string | null;
  commonOrderKind: string;
}

export interface BusinessReviewBreakdownRow {
  key: string;
  labelHe: string;
  count: number;
  percent: number;
}

export interface BusinessReviewActivityPoint {
  date: string;
  revenue: number;
  paidCount: number;
  ordersCreated: number;
}

export interface BusinessReviewData {
  generatedAt?: string;
  range?: {
    dateFrom: string;
    dateTo: string;
    preset: string;
    timezone: string;
    dateBasis: string;
  };
  previousRange?: { dateFrom: string; dateTo: string } | null;
  kpis?: {
    paidRevenue?: BusinessReviewKpi;
    paidOrders?: BusinessReviewKpi;
    ordersCreated?: BusinessReviewKpi;
    averagePaidOrder?: BusinessReviewKpi;
    returningCustomers?: BusinessReviewKpi;
    upcomingOrders?: BusinessReviewKpi;
    needsAttention?: BusinessReviewKpi;
  };
  activitySeries?: {
    granularity: 'day' | 'month';
    points: BusinessReviewActivityPoint[];
    previousPoints?: BusinessReviewActivityPoint[] | null;
  };
  alerts?: BusinessReviewAlert[];
  upcoming?: {
    window: 'next7' | string;
    items: BusinessReviewUpcomingItem[];
  };
  topDishes?: BusinessReviewTopDish[];
  returningCustomersList?: BusinessReviewReturningCustomer[];
  breakdown?: {
    byOrderKind?: BusinessReviewBreakdownRow[];
    byFulfillment?: BusinessReviewBreakdownRow[];
    byStatus?: BusinessReviewBreakdownRow[];
  };
  notes?: Record<string, string>;
}

export interface DashboardTrendPoint {
  period: string;
  revenue: number;
  paidOrdersCount: number;
  averageOrderValue?: number;
}

export interface DashboardTopItem {
  name: string;
  quantity: number;
  revenue: number;
}

export interface TopSellingCategoryBlock {
  category: string;
  items: DashboardTopItem[];
}

/** @deprecated Kept for older payloads; prefer topSellingByCategory. */
export interface TopSellingMonthBlock {
  month: string; // YYYY-MM
  categories: TopSellingCategoryBlock[];
}

export interface DashboardPaymentAlertItem {
  id: string;
  orderNumber?: string;
  customerName?: string;
  paymentStatus: string;
  status: string;
  totalPrice: number;
  createdAt: string | null;
  reasonCode?: string;
  reasonLabelHe?: string;
  reasonDetailHe?: string;
  cardEnteredHe?: string;
  chargedHe?: string;
}

export type ActionSeverity = 'critical' | 'high' | 'medium' | 'low';
export type ActionItemType =
  | 'payment_failed'
  | 'payment_abandoned'
  | 'payment_awaiting'
  | 'new_pending'
  | 'upcoming_not_ready'
  | 'delivery_no_driver'
  | 'missing_info'
  | 'special_notes';

export interface DashboardActionItem {
  id: string;
  type: ActionItemType;
  severity: ActionSeverity;
  title: string;
  description: string;
  orderId?: string;
  orderNumber?: string;
  customerName?: string;
  eventDate?: string | null;
  amount?: number;
  actionLabel: string;
  actionHref: string;
  sortKey?: string;
}

export interface DayOpsSummary {
  date: string;
  ordersCount: number;
  expectedRevenue: number;
  portionsTotal: number;
  deliveries: number;
  pickups: number;
  unknownFulfillment?: number;
  awaitingApproval: number;
  nearestOrderId?: string;
  nearestOrderNumber?: string;
  nearestCustomerName?: string;
  byStatus: Array<{ status: string; count: number }>;
}

export interface UpcomingPreparation {
  eventDate: string | null;
  ordersCount: number;
  portionsTotal: number;
  portionsEvening: number;
  portionsMorning: number;
  topItems: Array<{ name: string; quantity: number }>;
  notesOrders: Array<{
    id: string;
    orderNumber?: string;
    customerName?: string;
    notePreview: string;
  }>;
}

export interface UpcomingOrderRow {
  id: string;
  orderNumber?: string;
  customerName?: string;
  eventDate?: string | null;
  fulfillment: 'delivery' | 'pickup' | 'unknown';
  totalPrice: number;
  paymentStatus?: string;
  status: string;
  isTestOrder?: boolean;
}

export interface DashboardInsight {
  id: string;
  text: string;
}

export interface DashboardOverviewData {
  range: {
    from: string;
    to: string;
    timezone: string;
    dateBasis: string;
    preset: string | null;
    previous: { from: string; to: string };
  };
  filters?: {
    orderKind?: string;
    orderKindLabel?: string;
    status?: string | null;
    paymentStatus?: string | null;
  };
  kpis: {
    capturedRevenue: DashboardKpiTriple;
    actualRevenue?: DashboardKpiTriple;
    expectedRevenue?: DashboardKpiTriple;
    paidOrders: DashboardKpiTriple;
    averageOrderValue: DashboardKpiTriple;
    totalOrders: DashboardKpiTriple;
    activeOrders: DashboardKpiTriple;
    returningCustomers: DashboardKpiTriple;
    newCustomers?: DashboardKpiTriple;
    cancelledOrders?: DashboardKpiTriple;
    awaitingPayments?: DashboardKpiTriple;
  };
  paymentAlerts: {
    awaiting: number;
    failed: number;
    items?: DashboardPaymentAlertItem[];
  };
  trend: DashboardTrendPoint[];
  ordersByStatus: Array<{ status: string; count: number }>;
  ordersByType: Array<{
    orderType?: string;
    cateringKind?: string;
    orderKind?: string;
    orderKindLabel?: string;
    count: number;
    revenue?: number;
  }>;
  topItems: DashboardTopItem[];
  /** Top 3 per category for the selected KPI date range. */
  topSellingByCategory?: TopSellingCategoryBlock[];
  /** @deprecated Prefer topSellingByCategory. */
  topSellingByMonth?: TopSellingMonthBlock[];
  actionItems?: DashboardActionItem[];
  todaySummary?: DayOpsSummary;
  tomorrowSummary?: DayOpsSummary;
  upcomingPreparation?: UpcomingPreparation;
  financialSummary?: {
    capturedRevenue: number;
    actualRevenue?: number;
    expectedRevenue?: number;
    paidOrders: number;
    averageOrderValue: number;
    awaitingPayments: number;
    awaitingCount?: number;
    awaitingAmount: number;
    failedPayments: number;
    failedCount?: number;
    failedAmount: number;
    returningCustomers: number;
    newCustomers?: number;
    cancelledOrders?: number;
    zeroPriceOrders?: number;
    zeroPriceWarning?: string | null;
    externalInvoices?: { amount: number; count: number; note?: string };
    capturedRevenueChange: DashboardKpiTriple;
    paidOrdersChange: DashboardKpiTriple;
    averageOrderValueChange: DashboardKpiTriple;
    newCustomersChange?: DashboardKpiTriple;
    returningCustomersChange?: DashboardKpiTriple;
  };
  alerts?: {
    zeroPriceOrders?: number;
    zeroPriceWarning?: string | null;
  };
  externalInvoices?: { amount: number; count: number; note?: string };
  upcomingOrders?: UpcomingOrderRow[];
  insights?: DashboardInsight[];
  insightsData?: Record<string, unknown>;
  /** Nested business review (admin-payments paid definition + ops alerts). */
  businessReview?: BusinessReviewData | null;
  generatedAt?: string;
}

export interface DashboardQueryParams {
  preset?: string;
  from?: string;
  to?: string;
  timezone: string;
  salesPreset?: string;
  salesFrom?: string;
  salesTo?: string;
  orderKind?: string;
  status?: string;
  paymentStatus?: string;
}

/** Stable tone (1–7) per category name for sales cards. */
export function salesCategoryTone(category: string): number {
  const key = String(category || '').trim();
  const known: Record<string, number> = {
    'מנות עיקריות': 1,
    תוספות: 2,
    ממולאים: 3,
    דגים: 4,
    סלטים: 5,
    קינוחים: 6,
    כללי: 7
  };
  if (known[key]) return known[key];
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return (hash % 7) + 1;
}

const JERUSALEM_TZ = 'Asia/Jerusalem';

export function formatIls(value: number | null | undefined): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return '₪0';
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    maximumFractionDigits: n % 1 === 0 ? 0 : 2
  }).format(n);
}

export function formatHeNumber(value: number | null | undefined, fractionDigits = 0): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0';
  return new Intl.NumberFormat('he-IL', {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: 0
  }).format(n);
}

export type ChangeTone = 'up' | 'down' | 'flat' | 'na';

export interface ChangeDisplay {
  tone: ChangeTone;
  label: string;
  ariaLabel: string;
}

export function formatChangePercent(changePercent: number | null | undefined): ChangeDisplay {
  if (changePercent === null || changePercent === undefined) {
    return {
      tone: 'na',
      label: 'אין מספיק נתונים להשוואה',
      ariaLabel: 'אין מספיק נתונים להשוואה לתקופה הקודמת'
    };
  }
  const n = Number(changePercent);
  if (!Number.isFinite(n)) {
    return {
      tone: 'na',
      label: 'אין מספיק נתונים להשוואה',
      ariaLabel: 'אין מספיק נתונים להשוואה לתקופה הקודמת'
    };
  }
  if (Math.abs(n) < 0.05) {
    return {
      tone: 'flat',
      label: 'ללא שינוי',
      ariaLabel: 'ללא שינוי לעומת התקופה הקודמת'
    };
  }
  const rounded = Math.round(n * 10) / 10;
  const absLabel = formatHeNumber(Math.abs(rounded), Math.abs(rounded) % 1 === 0 ? 0 : 1);
  if (rounded > 0) {
    return {
      tone: 'up',
      label: `↑ ${absLabel}%`,
      ariaLabel: `עלייה של ${absLabel} אחוזים לעומת התקופה הקודמת`
    };
  }
  return {
    tone: 'down',
    label: `↓ ${absLabel}%`,
    ariaLabel: `ירידה של ${absLabel} אחוזים לעומת התקופה הקודמת`
  };
}

/** Prefer absolute deltas when previous sample is small (< 3). */
export function formatKpiChange(kpi: DashboardKpiTriple | null | undefined): ChangeDisplay {
  if (!kpi) {
    return {
      tone: 'na',
      label: 'אין מספיק נתונים להשוואה',
      ariaLabel: 'אין מספיק נתונים להשוואה'
    };
  }
  const prev = Number(kpi.previousValue);
  const value = Number(kpi.value);
  if (!Number.isFinite(prev) || !Number.isFinite(value)) {
    return formatChangePercent(null);
  }
  if (prev === 0 && value === 0) {
    return { tone: 'flat', label: 'ללא שינוי', ariaLabel: 'ללא שינוי' };
  }
  if (prev === 0) {
    return {
      tone: 'na',
      label: 'אין מספיק נתונים להשוואה',
      ariaLabel: 'אין מספיק נתונים להשוואה'
    };
  }
  if (prev < 3) {
    const diff = value - prev;
    if (Math.abs(diff) < 0.0001) {
      return { tone: 'flat', label: 'ללא שינוי', ariaLabel: 'ללא שינוי' };
    }
    if (diff > 0) {
      return {
        tone: 'up',
        label: `${formatHeNumber(diff)} יותר מהתקופה הקודמת`,
        ariaLabel: `${formatHeNumber(diff)} יותר מהתקופה הקודמת`
      };
    }
    return {
      tone: 'down',
      label: `${formatHeNumber(Math.abs(diff))} פחות מהתקופה הקודמת`,
      ariaLabel: `${formatHeNumber(Math.abs(diff))} פחות מהתקופה הקודמת`
    };
  }
  return formatChangePercent(kpi.changePercent);
}

export function toJerusalemDateKey(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: JERUSALEM_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const y = parts.find((p) => p.type === 'year')?.value;
  const m = parts.find((p) => p.type === 'month')?.value;
  const d = parts.find((p) => p.type === 'day')?.value;
  return `${y}-${m}-${d}`;
}

export function addDaysToDateKey(dateKey: string, deltaDays: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d + deltaDays));
  const yy = utc.getUTCFullYear();
  const mm = String(utc.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(utc.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export function isValidDateKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || '').trim());
}

export function isDateRangeValid(from: string, to: string): boolean {
  if (!isValidDateKey(from) || !isValidDateKey(to)) return false;
  return from <= to;
}

export function buildDashboardQuery(
  preset: DashboardPresetKey,
  customFrom: string,
  customTo: string,
  timezone: string = JERUSALEM_TZ,
  extra?: { orderKind?: string; status?: string; paymentStatus?: string }
): DashboardQueryParams | { error: string } {
  const tz = timezone || JERUSALEM_TZ;
  const filters: Partial<DashboardQueryParams> = {};
  if (extra?.orderKind && extra.orderKind !== 'all') filters.orderKind = extra.orderKind;
  if (extra?.status && extra.status !== 'all') filters.status = extra.status;
  if (extra?.paymentStatus && extra.paymentStatus !== 'all') {
    filters.paymentStatus = extra.paymentStatus;
  }

  if (preset === 'today') return { preset: 'today', timezone: tz, ...filters };
  if (preset === 'week') return { preset: 'week', timezone: tz, ...filters };
  if (preset === 'last30') return { preset: 'last30', timezone: tz, ...filters };
  if (preset === 'month') return { preset: 'month', timezone: tz, ...filters };
  if (preset === 'year') return { preset: 'year', timezone: tz, ...filters };
  if (!isDateRangeValid(customFrom, customTo)) {
    return { error: 'טווח התאריכים אינו תקין: תאריך ההתחלה חייב להיות לפני או שווה לתאריך הסיום' };
  }
  return { from: customFrom, to: customTo, timezone: tz, ...filters };
}

/** Previous calendar month bounds (Jerusalem YYYY-MM-DD). */
export function previousCalendarMonthBounds(todayKey: string = toJerusalemDateKey()): {
  from: string;
  to: string;
} {
  const [y, m] = todayKey.split('-').map(Number);
  const prevM = m === 1 ? 12 : m - 1;
  const prevY = m === 1 ? y - 1 : y;
  const lastDay = new Date(Date.UTC(prevY, prevM, 0)).getUTCDate();
  return {
    from: `${prevY}-${String(prevM).padStart(2, '0')}-01`,
    to: `${prevY}-${String(prevM).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  };
}

/**
 * Map primary (admin-payments) presets onto overview query params.
 * Finance range helpers understand today/week/last30/month/year/custom;
 * businessReview remaps month→this_month and week→last7.
 */
export function buildPrimaryRangeQuery(
  preset: PrimaryDatePreset,
  customFrom: string,
  customTo: string,
  timezone: string = JERUSALEM_TZ,
  extra?: { orderKind?: string; status?: string; paymentStatus?: string }
): DashboardQueryParams | { error: string } {
  const tz = timezone || JERUSALEM_TZ;
  const filters: Partial<DashboardQueryParams> = {};
  if (extra?.orderKind && extra.orderKind !== 'all') filters.orderKind = extra.orderKind;
  if (extra?.status && extra.status !== 'all') filters.status = extra.status;
  if (extra?.paymentStatus && extra.paymentStatus !== 'all') {
    filters.paymentStatus = extra.paymentStatus;
  }

  if (preset === 'today') return { preset: 'today', timezone: tz, ...filters };
  if (preset === 'last7') return { preset: 'week', timezone: tz, ...filters };
  if (preset === 'last30') return { preset: 'last30', timezone: tz, ...filters };
  if (preset === 'this_month') return { preset: 'month', timezone: tz, ...filters };
  if (preset === 'last_month') {
    const bounds = previousCalendarMonthBounds();
    return { from: bounds.from, to: bounds.to, timezone: tz, ...filters };
  }
  if (!isDateRangeValid(customFrom, customTo)) {
    return { error: 'טווח התאריכים אינו תקין: תאריך ההתחלה חייב להיות לפני או שווה לתאריך הסיום' };
  }
  return { from: customFrom, to: customTo, timezone: tz, ...filters };
}

export function mapPrimaryToFinancePreset(preset: PrimaryDatePreset): DashboardPresetKey {
  if (preset === 'last7') return 'week';
  if (preset === 'this_month') return 'month';
  if (preset === 'last_month') return 'custom';
  if (preset === 'today' || preset === 'last30' || preset === 'custom') return preset;
  return 'month';
}

export function mapFinanceToPrimaryPreset(preset: DashboardPresetKey): PrimaryDatePreset {
  if (preset === 'week') return 'last7';
  if (preset === 'month') return 'this_month';
  if (preset === 'today' || preset === 'last30' || preset === 'custom') return preset;
  if (preset === 'year') return 'custom';
  return 'this_month';
}

export function normalizeBusinessReview(
  raw: BusinessReviewData | null | undefined
): BusinessReviewData | null {
  if (!raw || typeof raw !== 'object') return null;
  return {
    ...raw,
    alerts: Array.isArray(raw.alerts) ? raw.alerts : [],
    upcoming: raw.upcoming
      ? {
          window: raw.upcoming.window || 'next7',
          items: Array.isArray(raw.upcoming.items) ? raw.upcoming.items : []
        }
      : undefined,
    topDishes: Array.isArray(raw.topDishes) ? raw.topDishes : [],
    returningCustomersList: Array.isArray(raw.returningCustomersList)
      ? raw.returningCustomersList
      : [],
    breakdown: raw.breakdown
      ? {
          byOrderKind: Array.isArray(raw.breakdown.byOrderKind) ? raw.breakdown.byOrderKind : [],
          byFulfillment: Array.isArray(raw.breakdown.byFulfillment)
            ? raw.breakdown.byFulfillment
            : [],
          byStatus: Array.isArray(raw.breakdown.byStatus) ? raw.breakdown.byStatus : []
        }
      : undefined,
    activitySeries: raw.activitySeries
      ? {
          granularity: raw.activitySeries.granularity === 'month' ? 'month' : 'day',
          points: Array.isArray(raw.activitySeries.points) ? raw.activitySeries.points : [],
          previousPoints: Array.isArray(raw.activitySeries.previousPoints)
            ? raw.activitySeries.previousPoints
            : null
        }
      : undefined
  };
}

export function formatTrendPeriodLabel(period: string): string {
  const s = String(period || '');
  const dayMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (dayMatch) {
    const d = new Date(Date.UTC(Number(dayMatch[1]), Number(dayMatch[2]) - 1, Number(dayMatch[3])));
    return d.toLocaleDateString('he-IL', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  }
  const monthMatch = /^(\d{4})-(\d{2})$/.exec(s);
  if (monthMatch) {
    const d = new Date(Date.UTC(Number(monthMatch[1]), Number(monthMatch[2]) - 1, 1));
    return d.toLocaleDateString('he-IL', { month: 'short', year: 'numeric', timeZone: 'UTC' });
  }
  return s;
}

export function filterNamedTopItems(items: DashboardTopItem[] | null | undefined): DashboardTopItem[] {
  return (items || []).filter(
    (i) => String(i?.name || '').trim().length > 0 && Number(i.quantity) > 0 && Number(i.revenue) > 0
  );
}

export function filterPrepItems(
  items: Array<{ name?: string; quantity?: number }> | null | undefined
): Array<{ name: string; quantity: number }> {
  return (items || [])
    .map((i) => ({ name: String(i?.name || '').trim(), quantity: Number(i?.quantity) || 0 }))
    .filter((i) => i.name && i.quantity > 0);
}

export function paymentStatusLabelHe(status: string): string {
  const map: Record<string, string> = {
    pending: 'ממתין',
    awaiting_payment: 'ננטש בתשלום',
    authorized: 'אושר — טרם נלכד',
    captured: 'חויב',
    voided: 'בוטל',
    failed: 'תשלום נכשל'
  };
  return map[status] || status || 'לא ידוע';
}

export function orderStatusLabelHe(status: string): string {
  const map: Record<string, string> = {
    pending: 'ממתין',
    new: 'חדש',
    processing: 'בטיפול',
    'in-progress': 'בטיפול',
    ready: 'מוכן',
    out_for_delivery: 'במשלוח',
    delivery_failed: 'משלוח נכשל',
    delivered: 'נמסר',
    cancelled: 'בוטל'
  };
  return map[status] || status || 'לא ידוע';
}

export function fulfillmentLabelHe(f: string): string {
  if (f === 'pickup') return 'איסוף';
  if (f === 'delivery') return 'משלוח';
  return 'סוג אספקה חסר';
}

export function severityLabelHe(s: ActionSeverity): string {
  const map: Record<ActionSeverity, string> = {
    critical: 'דחוף',
    high: 'גבוה',
    medium: 'בינוני',
    low: 'נמוך'
  };
  return map[s] || s;
}

export function mapHttpErrorToDashboardMessage(status: number | undefined, fallback?: string): string {
  if (status === 401) return 'פג תוקף ההתחברות. יש להתחבר מחדש.';
  if (status === 403) return 'אין הרשאה לצפייה בדשבורד העסקי.';
  if (status === 0) return 'החיבור לשרת איטי או נכשל. נסו שוב.';
  return fallback || 'שגיאה בטעינת נתוני הדשבורד.';
}

export function emptyDaySummary(date: string): DayOpsSummary {
  return {
    date,
    ordersCount: 0,
    expectedRevenue: 0,
    portionsTotal: 0,
    deliveries: 0,
    pickups: 0,
    unknownFulfillment: 0,
    awaitingApproval: 0,
    byStatus: []
  };
}

export function normalizeTopSellingByCategory(
  raw: TopSellingCategoryBlock[] | null | undefined
): TopSellingCategoryBlock[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((c) => ({
      category: String(c?.category || '').trim() || 'כללי',
      items: (c?.items || [])
        .map((i) => ({
          name: String(i?.name || '').trim(),
          quantity: Number(i?.quantity) || 0,
          revenue: Number(i?.revenue) || 0
        }))
        .filter((i) => i.name && i.quantity > 0)
        .slice(0, 3)
    }))
    .filter((c) => c.items.length > 0);
}

export function normalizeTopSellingByMonth(
  raw: TopSellingMonthBlock[] | null | undefined
): TopSellingMonthBlock[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((m) => ({
      month: String(m?.month || '').trim(),
      categories: normalizeTopSellingByCategory(m?.categories)
    }))
    .filter((m) => /^\d{4}-\d{2}$/.test(m.month) && m.categories.length > 0);
}

/** Hebrew label for YYYY-MM (e.g. אוגוסט 2026). */
export function formatSalesMonthLabel(monthKey: string): string {
  const m = String(monthKey || '').trim();
  if (!/^\d{4}-\d{2}$/.test(m)) return m;
  const [y, mo] = m.split('-').map(Number);
  const d = new Date(Date.UTC(y, mo - 1, 1));
  return d.toLocaleDateString('he-IL', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

export function normalizeOverview(raw: DashboardOverviewData | null | undefined): DashboardOverviewData | null {
  if (!raw || typeof raw !== 'object' || !raw.kpis) return null;
  const today = toJerusalemDateKey();
  return {
    ...raw,
    trend: Array.isArray(raw.trend) ? raw.trend : [],
    topItems: filterNamedTopItems(raw.topItems),
    topSellingByCategory: normalizeTopSellingByCategory(
      raw.topSellingByCategory?.length
        ? raw.topSellingByCategory
        : normalizeTopSellingByMonth(raw.topSellingByMonth)[0]?.categories
    ),
    topSellingByMonth: normalizeTopSellingByMonth(raw.topSellingByMonth),
    paymentAlerts: {
      awaiting: Number(raw.paymentAlerts?.awaiting) || 0,
      failed: Number(raw.paymentAlerts?.failed) || 0,
      items: Array.isArray(raw.paymentAlerts?.items) ? raw.paymentAlerts!.items! : []
    },
    actionItems: Array.isArray(raw.actionItems) ? raw.actionItems : [],
    todaySummary: raw.todaySummary || emptyDaySummary(today),
    tomorrowSummary: raw.tomorrowSummary || emptyDaySummary(addDaysToDateKey(today, 1)),
    upcomingPreparation: raw.upcomingPreparation || {
      eventDate: null,
      ordersCount: 0,
      portionsTotal: 0,
      portionsEvening: 0,
      portionsMorning: 0,
      topItems: [],
      notesOrders: []
    },
    upcomingOrders: Array.isArray(raw.upcomingOrders)
      ? raw.upcomingOrders.filter((o) => !o.isTestOrder)
      : [],
    insights: Array.isArray(raw.insights) ? raw.insights.slice(0, 3) : [],
    financialSummary: raw.financialSummary,
    businessReview: normalizeBusinessReview(raw.businessReview)
  };
}

/** Parse /admin/orders?... href into routerLink + queryParams. */
export function parseAdminHref(href: string): { path: string; queryParams: Record<string, string> } {
  const raw = String(href || '').trim();
  if (!raw) return { path: '/admin/orders', queryParams: {} };
  const [pathPart, qs = ''] = raw.split('?');
  const queryParams: Record<string, string> = {};
  if (qs) {
    for (const pair of qs.split('&')) {
      const [k, v] = pair.split('=');
      if (k) queryParams[decodeURIComponent(k)] = decodeURIComponent(v || '');
    }
  }
  return { path: pathPart || '/admin/orders', queryParams };
}
