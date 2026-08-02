/**
 * Pure helpers for operational dashboard sections
 * (action items, day summaries, prep, insights).
 * No DB access — safe for unit tests.
 */

export type ActionSeverity = 'critical' | 'high' | 'medium' | 'low';

export type ActionItemType =
  | 'payment_failed'
  | 'payment_awaiting'
  | 'new_pending'
  | 'upcoming_not_ready'
  | 'delivery_no_driver'
  | 'missing_info'
  | 'special_notes';

export type DashboardActionItem = {
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
  sortKey: string;
};

export type DayStatusCount = { status: string; count: number };

export type DayOpsSummary = {
  date: string;
  ordersCount: number;
  expectedRevenue: number;
  portionsTotal: number;
  deliveries: number;
  pickups: number;
  /** Orders with missing deliveryType/deliveryMethod — never counted as delivery. */
  unknownFulfillment: number;
  awaitingApproval: number;
  nearestOrderId?: string;
  nearestOrderNumber?: string;
  nearestCustomerName?: string;
  byStatus: DayStatusCount[];
};

export type PrepTopItem = { name: string; quantity: number };

export type UpcomingPreparation = {
  eventDate: string | null;
  ordersCount: number;
  portionsTotal: number;
  portionsEvening: number;
  portionsMorning: number;
  topItems: PrepTopItem[];
  notesOrders: Array<{
    id: string;
    orderNumber?: string;
    customerName?: string;
    notePreview: string;
  }>;
};

export type UpcomingOrderRow = {
  id: string;
  orderNumber?: string;
  customerName?: string;
  eventDate?: string | null;
  fulfillment: 'delivery' | 'pickup' | 'unknown';
  totalPrice: number;
  paymentStatus?: string;
  status: string;
  isTestOrder?: boolean;
};

export type DashboardInsight = {
  id: string;
  text: string;
};

const SEVERITY_RANK: Record<ActionSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3
};

/** Detect pickup vs delivery from known customerDetails fields. */
export function resolveFulfillment(customerDetails: unknown): 'delivery' | 'pickup' | 'unknown' {
  const cd =
    customerDetails && typeof customerDetails === 'object'
      ? (customerDetails as Record<string, unknown>)
      : {};
  const raw = String(cd.deliveryType || cd.deliveryMethod || '')
    .trim()
    .toLowerCase();
  if (!raw) return 'unknown';
  if (raw === 'pickup' || raw === 'self-pickup' || raw === 'self_pickup') return 'pickup';
  if (raw === 'delivery') return 'delivery';
  return 'unknown';
}

/**
 * Portions for prep/ops:
 * 1) portionsEvening + portionsMorning when either present
 * 2) else numberOfPortions when > 0
 * 3) else sum of items.quantity
 */
export function resolveOrderPortions(order: {
  portionsEvening?: unknown;
  portionsMorning?: unknown;
  numberOfPortions?: unknown;
  items?: Array<{ quantity?: unknown }>;
}): { total: number; evening: number; morning: number } {
  const eveRaw = order.portionsEvening;
  const morRaw = order.portionsMorning;
  const hasEve = eveRaw !== undefined && eveRaw !== null && eveRaw !== '';
  const hasMor = morRaw !== undefined && morRaw !== null && morRaw !== '';
  if (hasEve || hasMor) {
    const evening = Math.max(0, Number(eveRaw) || 0);
    const morning = Math.max(0, Number(morRaw) || 0);
    return { total: evening + morning, evening, morning };
  }
  const nop = Number(order.numberOfPortions);
  if (Number.isFinite(nop) && nop > 0) {
    return { total: nop, evening: 0, morning: 0 };
  }
  const items = Array.isArray(order.items) ? order.items : [];
  let sum = 0;
  for (const it of items) {
    const q = Number(it?.quantity);
    if (Number.isFinite(q) && q > 0) sum += q;
  }
  return { total: sum, evening: 0, morning: 0 };
}

export function extractEventDate(customerDetails: unknown): string | null {
  const cd =
    customerDetails && typeof customerDetails === 'object'
      ? (customerDetails as Record<string, unknown>)
      : {};
  const raw = String(cd.eventDate || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
}

export function extractCustomerName(customerDetails: unknown): string {
  const cd =
    customerDetails && typeof customerDetails === 'object'
      ? (customerDetails as Record<string, unknown>)
      : {};
  return String(cd.fullName || cd.name || cd.customerName || '').trim();
}

export function extractCustomerPhone(customerDetails: unknown): string {
  const cd =
    customerDetails && typeof customerDetails === 'object'
      ? (customerDetails as Record<string, unknown>)
      : {};
  const nested =
    cd.deliveryDetails && typeof cd.deliveryDetails === 'object'
      ? (cd.deliveryDetails as Record<string, unknown>)
      : {};
  return String(cd.phone || nested.phone || cd.customerPhone || cd.mobile || '').trim();
}

export function hasSpecialNotes(order: {
  adminNotes?: unknown;
  customerDetails?: unknown;
}): boolean {
  const admin = String(order.adminNotes || '').trim();
  if (admin) return true;
  const cd =
    order.customerDetails && typeof order.customerDetails === 'object'
      ? (order.customerDetails as Record<string, unknown>)
      : {};
  const customer = String(cd.notes || cd.comments || cd.specialRequests || '').trim();
  return !!customer;
}

export function notePreview(order: {
  adminNotes?: unknown;
  customerDetails?: unknown;
}): string {
  const admin = String(order.adminNotes || '').trim();
  if (admin) return admin.slice(0, 80);
  const cd =
    order.customerDetails && typeof order.customerDetails === 'object'
      ? (order.customerDetails as Record<string, unknown>)
      : {};
  const customer = String(cd.notes || cd.comments || cd.specialRequests || '').trim();
  return customer.slice(0, 80);
}

/** Pending approval statuses used in admin UI. */
export function isAwaitingApprovalStatus(status: unknown): boolean {
  const s = String(status || '');
  return s === 'pending' || s === 'new';
}

/** Statuses considered "in prep / ready enough" for upcoming delivery. */
export function isPrepReadyStatus(status: unknown): boolean {
  const s = String(status || '');
  return (
    s === 'processing' ||
    s === 'in-progress' ||
    s === 'ready' ||
    s === 'out_for_delivery' ||
    s === 'delivered'
  );
}

export function sortActionItems(items: DashboardActionItem[]): DashboardActionItem[] {
  return [...items].sort((a, b) => {
    const sev = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    if (sev !== 0) return sev;
    const da = a.eventDate || '9999-99-99';
    const db = b.eventDate || '9999-99-99';
    if (da !== db) return da < db ? -1 : 1;
    return a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0;
  });
}

export function buildDaySummaryFromOrders(
  date: string,
  orders: Array<Record<string, unknown>>
): DayOpsSummary {
  const byStatusMap = new Map<string, number>();
  let expectedRevenue = 0;
  let portionsTotal = 0;
  let deliveries = 0;
  let pickups = 0;
  let unknownFulfillment = 0;
  let awaitingApproval = 0;
  let nearest: { id: string; orderNumber?: string; customerName?: string; createdAt: string } | null =
    null;

  for (const o of orders) {
    const status = String(o.status || 'unknown');
    byStatusMap.set(status, (byStatusMap.get(status) || 0) + 1);
    expectedRevenue += Number(o.totalPrice) || 0;
    const portions = resolveOrderPortions(o as any);
    portionsTotal += portions.total;
    const fulfillment = resolveFulfillment(o.customerDetails);
    if (fulfillment === 'pickup') pickups += 1;
    else if (fulfillment === 'delivery') deliveries += 1;
    else unknownFulfillment += 1;
    if (isAwaitingApprovalStatus(status)) awaitingApproval += 1;

    const id = String(o._id || o.id || '');
    const createdAt = o.createdAt ? new Date(o.createdAt as any).toISOString() : '';
    if (id && (!nearest || (createdAt && createdAt < nearest.createdAt))) {
      nearest = {
        id,
        orderNumber: o.orderNumber ? String(o.orderNumber) : undefined,
        customerName: extractCustomerName(o.customerDetails) || undefined,
        createdAt: createdAt || 'z'
      };
    }
  }

  const byStatus = Array.from(byStatusMap.entries())
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count);

  return {
    date,
    ordersCount: orders.length,
    expectedRevenue,
    portionsTotal,
    deliveries,
    pickups,
    unknownFulfillment,
    awaitingApproval,
    nearestOrderId: nearest?.id,
    nearestOrderNumber: nearest?.orderNumber,
    nearestCustomerName: nearest?.customerName,
    byStatus
  };
}

export function filterSoldTopItems(
  items: Array<{ name?: string; quantity?: number; revenue?: number }>
): Array<{ name: string; quantity: number; revenue: number }> {
  return (items || [])
    .map((i) => ({
      name: String(i?.name || '').trim(),
      quantity: Number(i?.quantity) || 0,
      revenue: Number(i?.revenue) || 0
    }))
    .filter((i) => i.name && i.quantity > 0 && i.revenue > 0);
}

export type TopSellingItem = { name: string; quantity: number; revenue: number };
export type TopSellingCategory = { category: string; items: TopSellingItem[] };
export type TopSellingMonth = { month: string; categories: TopSellingCategory[] };

/** Empty / missing category → "כללי". */
export function normalizeItemCategory(raw: unknown): string {
  const c = String(raw ?? '').trim();
  return c || 'כללי';
}

/**
 * Build per-month → per-category Top 3 (by quantity, then revenue).
 * Input rows are already aggregated at (month, category, name) grain.
 */
export function buildTopSellingByMonth(
  rows: Array<{
    month?: string;
    category?: string;
    name?: string;
    quantity?: number;
    revenue?: number;
  }>,
  topN = 3
): TopSellingMonth[] {
  type Agg = { name: string; quantity: number; revenue: number };
  const byMonth = new Map<string, Map<string, Agg[]>>();

  for (const raw of rows || []) {
    const month = String(raw?.month || '').trim();
    if (!/^\d{4}-\d{2}$/.test(month)) continue;
    const name = String(raw?.name || '').trim();
    const quantity = Number(raw?.quantity) || 0;
    if (!name || quantity <= 0) continue;
    const category = normalizeItemCategory(raw?.category);
    const revenue = Number(raw?.revenue) || 0;
    if (!byMonth.has(month)) byMonth.set(month, new Map());
    const byCat = byMonth.get(month)!;
    if (!byCat.has(category)) byCat.set(category, []);
    byCat.get(category)!.push({ name, quantity, revenue });
  }

  const months = [...byMonth.keys()].sort((a, b) => b.localeCompare(a));
  return months.map((month) => {
    const byCat = byMonth.get(month)!;
    const categories: TopSellingCategory[] = [...byCat.entries()]
      .map(([category, items]) => {
        const merged = new Map<string, Agg>();
        for (const item of items) {
          const prev = merged.get(item.name);
          if (prev) {
            prev.quantity += item.quantity;
            prev.revenue += item.revenue;
          } else {
            merged.set(item.name, { ...item });
          }
        }
        const ranked = [...merged.values()]
          .sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue || a.name.localeCompare(b.name, 'he'))
          .slice(0, Math.max(1, topN));
        const totalQty = ranked.reduce((s, i) => s + i.quantity, 0);
        return { category, items: ranked, totalQty };
      })
      .sort((a, b) => b.totalQty - a.totalQty || a.category.localeCompare(b.category, 'he'))
      .map(({ category, items }) => ({ category, items }));

    return { month, categories };
  });
}

export function filterPrepTopItems(
  items: Array<{ name?: string; quantity?: number }>
): PrepTopItem[] {
  return (items || [])
    .map((i) => ({
      name: String(i?.name || '').trim(),
      quantity: Number(i?.quantity) || 0
    }))
    .filter((i) => i.name && i.quantity > 0);
}

/**
 * Deterministic insights (max 3). Skip when evidence is weak.
 * Does not repeat urgent alert copy when actionItems already cover that type.
 */
export function buildDashboardInsights(input: {
  awaitingPayments?: number;
  failedPayments?: number;
  tomorrow?: DayOpsSummary | null;
  today?: DayOpsSummary | null;
  topSoldItem?: { name: string; quantity: number } | null;
  strongestTrendDay?: { period: string; paidOrdersCount: number } | null;
  revenueChangePercent?: number | null;
  revenuePreviousSample?: number;
  actionItemTypes?: ActionItemType[];
}): DashboardInsight[] {
  const out: DashboardInsight[] = [];
  const covered = new Set(input.actionItemTypes || []);

  if (
    !covered.has('payment_awaiting') &&
    Number(input.awaitingPayments) > 0 &&
    out.length < 3
  ) {
    out.push({
      id: 'awaiting_payments',
      text: `${formatHe(input.awaitingPayments!)} תשלומים ממתינים לטיפול.`
    });
  }

  if (!covered.has('payment_failed') && Number(input.failedPayments) > 0 && out.length < 3) {
    out.push({
      id: 'failed_payments',
      text: `${formatHe(input.failedPayments!)} תשלומים נכשלו ודורשים בדיקה.`
    });
  }

  const tomorrow = input.tomorrow;
  if (tomorrow && tomorrow.ordersCount > 0 && out.length < 3) {
    out.push({
      id: 'tomorrow_load',
      text: `מחר צפויות ${formatHe(tomorrow.ordersCount)} הזמנות ו־${formatHe(tomorrow.portionsTotal)} מנות.`
    });
  }

  const strong = input.strongestTrendDay;
  if (strong && strong.paidOrdersCount >= 2 && out.length < 3) {
    const label = hebrewWeekdayFromPeriod(strong.period);
    if (label) {
      out.push({
        id: 'strongest_day',
        text: `${label} הוא יום ההזמנות החזק ביותר בטווח שנבחר.`
      });
    }
  }

  const top = input.topSoldItem;
  if (top && top.name && top.quantity > 0 && out.length < 3) {
    out.push({
      id: 'top_item',
      text: `המנה הנמכרת ביותר בטווח היא ${top.name}.`
    });
  }

  const ch = input.revenueChangePercent;
  const prevSample = Number(input.revenuePreviousSample) || 0;
  if (
    ch !== null &&
    ch !== undefined &&
    Number.isFinite(ch) &&
    prevSample >= 3 &&
    Math.abs(ch) >= 5 &&
    out.length < 3
  ) {
    const abs = Math.round(Math.abs(ch));
    out.push({
      id: 'revenue_change',
      text:
        ch > 0
          ? `ההכנסה עלתה ב־${abs}% לעומת התקופה הקודמת.`
          : `ההכנסה ירדה ב־${abs}% לעומת התקופה הקודמת.`
    });
  }

  return out.slice(0, 3);
}

function formatHe(n: number): string {
  return new Intl.NumberFormat('he-IL').format(n);
}

function hebrewWeekdayFromPeriod(period: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(period);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  const names = ['יום ראשון', 'יום שני', 'יום שלישי', 'יום רביעי', 'יום חמישי', 'יום שישי', 'יום שבת'];
  return names[d.getUTCDay()] || null;
}

/** Enrich trend points with averageOrderValue = revenue / paidOrdersCount (0 when none). */
export function withAverageOrderValue(
  trend: Array<{ period: string; revenue: number; paidOrdersCount: number }>
): Array<{ period: string; revenue: number; paidOrdersCount: number; averageOrderValue: number }> {
  return (trend || []).map((p) => ({
    ...p,
    averageOrderValue:
      p.paidOrdersCount > 0 && Number.isFinite(p.revenue) ? p.revenue / p.paidOrdersCount : 0
  }));
}
