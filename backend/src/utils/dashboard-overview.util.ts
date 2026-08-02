/**
 * Pure helpers for GET /api/order/dashboard-overview.
 * Timezone-aware range resolution without external date libraries.
 */

export type DashboardPreset = 'today' | 'week' | 'month';

export type DateRange = {
  from: Date;
  to: Date;
  timezone: string;
  dateBasis: 'createdAt';
  preset?: DashboardPreset;
};

export type KpiTriple = {
  value: number;
  previousValue: number;
  changePercent: number | null;
};

const DEFAULT_TZ = 'Asia/Jerusalem';

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

export function normalizePhoneDigits(raw: unknown): string {
  let digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('00972')) digits = digits.slice(5);
  else if (digits.startsWith('972')) digits = digits.slice(3);
  if (!digits.startsWith('0')) digits = `0${digits}`;
  return digits;
}

/** Extract phone candidates from known Order customerDetails shapes (canonical + legacy). */
export function extractOrderPhoneCandidates(customerDetails: unknown): string[] {
  const cd = (customerDetails && typeof customerDetails === 'object'
    ? (customerDetails as Record<string, unknown>)
    : {}) as Record<string, unknown>;
  const nested =
    cd.deliveryDetails && typeof cd.deliveryDetails === 'object'
      ? (cd.deliveryDetails as Record<string, unknown>)
      : {};
  const raw = [cd.phone, nested.phone, cd.customerPhone, cd.mobile];
  return raw.map((v) => String(v || '').trim()).filter(Boolean);
}

export function changePercent(value: number, previousValue: number): number | null {
  if (previousValue === 0) {
    return value === 0 ? 0 : null;
  }
  return ((value - previousValue) / previousValue) * 100;
}

export function kpiTriple(value: number, previousValue: number): KpiTriple {
  return {
    value,
    previousValue,
    changePercent: changePercent(value, previousValue)
  };
}

function zonedParts(date: Date, timeZone: string): ZonedParts {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  const map: Record<string, string> = {};
  for (const part of dtf.formatToParts(date)) {
    if (part.type !== 'literal') map[part.type] = part.value;
  }
  // Intl may return hour "24" for midnight in some environments
  let hour = Number(map.hour);
  if (hour === 24) hour = 0;
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour,
    minute: Number(map.minute),
    second: Number(map.second)
  };
}

/** Convert a wall-clock time in `timeZone` to a UTC Date. */
export function zonedLocalToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeZone: string
): Date {
  let utc = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  for (let i = 0; i < 4; i++) {
    const parts = zonedParts(utc, timeZone);
    const asUtcMs = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second
    );
    const wantedMs = Date.UTC(year, month - 1, day, hour, minute, second);
    utc = new Date(utc.getTime() + (wantedMs - asUtcMs));
  }
  return utc;
}

function startOfZonedDay(date: Date, timeZone: string): Date {
  const p = zonedParts(date, timeZone);
  return zonedLocalToUtc(p.year, p.month, p.day, 0, 0, 0, timeZone);
}

function endOfZonedDay(date: Date, timeZone: string): Date {
  const p = zonedParts(date, timeZone);
  return zonedLocalToUtc(p.year, p.month, p.day, 23, 59, 59, timeZone);
}

function addCalendarDays(year: number, month: number, day: number, delta: number): {
  year: number;
  month: number;
  day: number;
} {
  const utc = new Date(Date.UTC(year, month - 1, day + delta));
  return { year: utc.getUTCFullYear(), month: utc.getUTCMonth() + 1, day: utc.getUTCDate() };
}

function parseIsoBound(raw: string, endOfDay: boolean, timeZone: string): Date | null {
  const s = String(raw || '').trim();
  if (!s) return null;
  // Date-only YYYY-MM-DD → interpret in business timezone
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    return endOfDay
      ? zonedLocalToUtc(y, mo, d, 23, 59, 59, timeZone)
      : zonedLocalToUtc(y, mo, d, 0, 0, 0, timeZone);
  }
  const dt = new Date(s);
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}

export function resolveDashboardRange(input: {
  preset?: string;
  from?: string;
  to?: string;
  timezone?: string;
  now?: Date;
}): DateRange {
  const timezone = String(input.timezone || DEFAULT_TZ).trim() || DEFAULT_TZ;
  const now = input.now ?? new Date();

  const fromParam = input.from ? parseIsoBound(input.from, false, timezone) : null;
  const toParam = input.to ? parseIsoBound(input.to, true, timezone) : null;

  if (fromParam && toParam) {
    if (fromParam.getTime() > toParam.getTime()) {
      const err: any = new Error('Invalid date range: from must be <= to');
      err.statusCode = 400;
      throw err;
    }
    return { from: fromParam, to: toParam, timezone, dateBasis: 'createdAt' };
  }

  const preset = String(input.preset || 'month').toLowerCase() as DashboardPreset;
  const parts = zonedParts(now, timezone);

  if (preset === 'today') {
    return {
      from: startOfZonedDay(now, timezone),
      to: endOfZonedDay(now, timezone),
      timezone,
      dateBasis: 'createdAt',
      preset: 'today'
    };
  }

  if (preset === 'week') {
    // Rolling 7 calendar days ending today (inclusive)
    const startDay = addCalendarDays(parts.year, parts.month, parts.day, -6);
    return {
      from: zonedLocalToUtc(startDay.year, startDay.month, startDay.day, 0, 0, 0, timezone),
      to: endOfZonedDay(now, timezone),
      timezone,
      dateBasis: 'createdAt',
      preset: 'week'
    };
  }

  // Default: current calendar month in business timezone
  const from = zonedLocalToUtc(parts.year, parts.month, 1, 0, 0, 0, timezone);
  const lastDay = new Date(Date.UTC(parts.year, parts.month, 0)).getUTCDate();
  const to = zonedLocalToUtc(parts.year, parts.month, lastDay, 23, 59, 59, timezone);
  return { from, to, timezone, dateBasis: 'createdAt', preset: 'month' };
}

/** Previous window of identical duration, immediately before `from`. */
export function previousRange(range: DateRange): { from: Date; to: Date } {
  const durationMs = range.to.getTime() - range.from.getTime();
  const prevTo = new Date(range.from.getTime() - 1);
  const prevFrom = new Date(prevTo.getTime() - durationMs);
  return { from: prevFrom, to: prevTo };
}

export function trendGranularity(range: DateRange): 'day' | 'month' {
  const days = (range.to.getTime() - range.from.getTime()) / (24 * 60 * 60 * 1000);
  return days <= 62 ? 'day' : 'month';
}

export function formatTrendKey(date: Date, granularity: 'day' | 'month', timeZone: string): string {
  const p = zonedParts(date, timeZone);
  if (granularity === 'month') {
    return `${p.year}-${String(p.month).padStart(2, '0')}`;
  }
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

/** Fill missing day/month buckets with zeros between from and to (inclusive). */
export function fillTrendBuckets(
  range: DateRange,
  points: Array<{ key: string; revenue: number; paidOrdersCount: number }>,
  granularity: 'day' | 'month'
): Array<{ period: string; revenue: number; paidOrdersCount: number }> {
  const byKey = new Map(points.map((p) => [p.key, p]));
  const out: Array<{ period: string; revenue: number; paidOrdersCount: number }> = [];

  if (granularity === 'day') {
    let cursor = startOfZonedDay(range.from, range.timezone);
    const end = endOfZonedDay(range.to, range.timezone);
    while (cursor.getTime() <= end.getTime()) {
      const key = formatTrendKey(cursor, 'day', range.timezone);
      const hit = byKey.get(key);
      out.push({
        period: key,
        revenue: hit?.revenue ?? 0,
        paidOrdersCount: hit?.paidOrdersCount ?? 0
      });
      const p = zonedParts(cursor, range.timezone);
      const next = addCalendarDays(p.year, p.month, p.day, 1);
      cursor = zonedLocalToUtc(next.year, next.month, next.day, 0, 0, 0, range.timezone);
    }
    return out;
  }

  // month buckets
  let p = zonedParts(range.from, range.timezone);
  const endParts = zonedParts(range.to, range.timezone);
  while (
    p.year < endParts.year ||
    (p.year === endParts.year && p.month <= endParts.month)
  ) {
    const key = `${p.year}-${String(p.month).padStart(2, '0')}`;
    const hit = byKey.get(key);
    out.push({
      period: key,
      revenue: hit?.revenue ?? 0,
      paidOrdersCount: hit?.paidOrdersCount ?? 0
    });
    if (p.month === 12) {
      p = { ...p, year: p.year + 1, month: 1 };
    } else {
      p = { ...p, month: p.month + 1 };
    }
  }
  return out;
}

export function countReturningFromPhoneGroups(
  groups: Array<{ phone: unknown; count: number }>
): number {
  const byNorm = new Map<string, number>();
  for (const g of groups) {
    const norm = normalizePhoneDigits(g.phone);
    if (!norm) continue;
    byNorm.set(norm, (byNorm.get(norm) || 0) + Number(g.count || 0));
  }
  let returning = 0;
  for (const n of byNorm.values()) {
    if (n >= 2) returning += 1;
  }
  return returning;
}

/**
 * Unit price for an order line item (proven shapes in Order schema / writers):
 * - items.price (canonical unit price on checkout, catering, admin updates)
 * - items.selectedOption.price (variant unit price; written alongside price on admin updates)
 *
 * items.total is NOT part of the Order item schema or create/update writers — not used.
 * Missing quantity does NOT default to 1 (create paths require quantity; missing → 0 revenue).
 */
export function resolveOrderItemUnitPrice(item: {
  price?: unknown;
  selectedOption?: { price?: unknown } | null;
}): number | null {
  const root = Number(item?.price);
  if (item?.price !== null && item?.price !== undefined && item?.price !== '' && Number.isFinite(root) && root >= 0) {
    return root;
  }
  const optRaw = item?.selectedOption?.price;
  const opt = Number(optRaw);
  if (optRaw !== null && optRaw !== undefined && optRaw !== '' && Number.isFinite(opt) && opt >= 0) {
    return opt;
  }
  return null;
}

export function resolveOrderItemQuantity(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === '') return null;
  const q = Number(raw);
  if (!Number.isFinite(q) || q < 0) return null;
  return q;
}

/** Line revenue = unitPrice × quantity. Returns 0 when either side is missing/invalid. */
export function computeOrderItemLineRevenue(item: {
  price?: unknown;
  quantity?: unknown;
  selectedOption?: { price?: unknown } | null;
  total?: unknown;
}): number {
  // Explicitly ignore item.total — not a stored Order line field in this codebase.
  void item.total;
  const unit = resolveOrderItemUnitPrice(item);
  const qty = resolveOrderItemQuantity(item.quantity);
  if (unit === null || qty === null) return 0;
  return unit * qty;
}

/** Shared match fragments for dashboard metrics. */
export const DASHBOARD_MATCH = {
  notTest: { isTestOrder: { $ne: true } },
  capturedRevenue: {
    isTestOrder: { $ne: true },
    paymentStatus: 'captured',
    status: { $ne: 'cancelled' }
  },
  activeOrders: {
    isTestOrder: { $ne: true },
    isDeleted: { $ne: true },
    status: { $ne: 'cancelled' }
  },
  awaitingPayment: {
    isTestOrder: { $ne: true },
    isDeleted: { $ne: true },
    paymentStatus: { $in: ['awaiting_payment', 'authorized'] }
  },
  failedPayment: {
    isTestOrder: { $ne: true },
    isDeleted: { $ne: true },
    paymentStatus: 'failed'
  }
} as const;
