/** Sunday–Thursday institutional ordering week (dayOfWeek 0–4). Shabbat is shabbatOrder. */
import {
  MENU_CATEGORIES,
  MENU_DAY_FIELDS,
  emptyShabbatOrder,
  normalizeCategoryNotes,
  normalizeShabbatOrder,
  type MenuDayField,
  type ShabbatOrder
} from './menu-structure';

export { MENU_DAY_FIELDS, type MenuDayField };

export const PORTAL_WORK_DAYS = [0, 1, 2, 3, 4] as const;

const WEEK_KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export interface PortalSettingsLike {
  customMessage?: string;
}

export type WeekStartKey = string;

/** Format UTC calendar date as canonical YYYY-MM-DD week key. */
export function formatWeekStartKey(date: Date): WeekStartKey {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Sunday (YYYY-MM-DD UTC) of the calendar week containing `now`.
 * Canonical week identifier: 00:00:00 UTC on Sunday.
 */
export function getWeekStartKey(now: Date = new Date()): WeekStartKey {
  const d = new Date(now);
  const day = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - day);
  d.setUTCHours(0, 0, 0, 0);
  return formatWeekStartKey(d);
}

/** Sunday UTC of the week after the one containing `now`. */
export function getNextWeekStartKey(now: Date = new Date()): WeekStartKey {
  const d = weekKeyToUtcDate(getWeekStartKey(now));
  d.setUTCDate(d.getUTCDate() + 7);
  return formatWeekStartKey(d);
}

/** Sunday UTC one week before the given week key. */
export function getPreviousWeekStartKey(key: WeekStartKey): WeekStartKey {
  const d = weekKeyToUtcDate(key);
  d.setUTCDate(d.getUTCDate() - 7);
  return formatWeekStartKey(d);
}

/** Parse any input into normalized Sunday YYYY-MM-DD (UTC), or null if invalid. */
export function parseWeekStartKey(value: string | Date | undefined | null): WeekStartKey | null {
  if (!value) return null;

  if (value instanceof Date) {
    if (isNaN(value.getTime())) return null;
    const d = new Date(value);
    const day = d.getUTCDay();
    d.setUTCDate(d.getUTCDate() - day);
    d.setUTCHours(0, 0, 0, 0);
    return formatWeekStartKey(d);
  }

  const raw = String(value).trim();
  const m = WEEK_KEY_RE.exec(raw);
  if (!m) return null;

  const probe = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0));
  if (isNaN(probe.getTime())) return null;
  const day = probe.getUTCDay();
  probe.setUTCDate(probe.getUTCDate() - day);
  probe.setUTCHours(0, 0, 0, 0);
  return formatWeekStartKey(probe);
}

/** UTC midnight Date for the week key. */
export function weekKeyToUtcDate(key: WeekStartKey): Date {
  const m = WEEK_KEY_RE.exec(key);
  if (!m) throw new Error(`Invalid weekStartDate key: ${key}`);
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0));
}

/** Local midnight Date for deadline calculations (calendar date in server locale). */
export function weekKeyToLocalDate(key: WeekStartKey): Date {
  const m = WEEK_KEY_RE.exec(key);
  if (!m) throw new Error(`Invalid weekStartDate key: ${key}`);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0);
}

/** True when the parsed key lands on a UTC Sunday. */
export function isSundayWeekKey(key: WeekStartKey): boolean {
  const d = weekKeyToUtcDate(key);
  return d.getUTCDay() === 0;
}

/** MongoDB query matching string keys and legacy Date-stored documents. */
export function weekStartDateQuery(key: WeekStartKey): Record<string, unknown> {
  const start = weekKeyToUtcDate(key);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return {
    $or: [{ weekStartDate: key }, { weekStartDate: { $gte: start, $lt: end } }]
  };
}

/** @deprecated Use getWeekStartKey */
export function getWeekStartDate(now: Date = new Date()): Date {
  return weekKeyToUtcDate(getWeekStartKey(now));
}

/** @deprecated Use parseWeekStartKey */
export function parseWeekStartDateParam(value: string | Date | undefined | null): Date | null {
  const key = parseWeekStartKey(value);
  return key ? weekKeyToUtcDate(key) : null;
}

/** @deprecated Use formatWeekStartKey */
export function formatWeekStartDate(date: Date): string {
  return formatWeekStartKey(date);
}

/** @deprecated Use getNextWeekStartKey */
export function getNextWeekStartDate(now: Date = new Date()): Date {
  return weekKeyToUtcDate(getNextWeekStartKey(now));
}

export function normalizeToWeekStart(date: Date): Date {
  const key = parseWeekStartKey(date);
  return key ? weekKeyToUtcDate(key) : weekKeyToUtcDate(getWeekStartKey(date));
}

export const DAY_LABELS_HE = [
  'יום ראשון',
  'יום שני',
  'יום שלישי',
  'יום רביעי',
  'יום חמישי'
] as const;

export const SHABBAT_ORDER_LABEL = 'חבילת שבת';

export function parseDeadlineTime(time: string): { hours: number; minutes: number } {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(time || '').trim());
  if (!match) return { hours: 12, minutes: 0 };
  return {
    hours: Math.min(23, Math.max(0, Number(match[1]))),
    minutes: Math.min(59, Math.max(0, Number(match[2])))
  };
}

/** Parse orderDeadline from ISO string or Date. */
export function parseOrderDeadline(value: unknown): Date | null {
  if (value == null || value === '') return null;
  const d = value instanceof Date ? value : new Date(String(value));
  if (isNaN(d.getTime())) return null;
  return d;
}

/** True when server time is past the menu's per-week orderDeadline. */
export function computeIsLockedByDeadline(
  orderDeadline: Date | string | null | undefined,
  now: Date = new Date()
): boolean {
  const deadline = orderDeadline instanceof Date ? orderDeadline : parseOrderDeadline(orderDeadline);
  if (!deadline) return false;
  return now.getTime() > deadline.getTime();
}

/**
 * Portal default week: explicit query param, else current week unless its deadline passed → next week.
 */
export async function resolvePortalWeekStartKey(
  requestedKey: string | undefined | null,
  getDeadlineForWeek: (weekKey: WeekStartKey) => Promise<Date | string | null | undefined>,
  now: Date = new Date()
): Promise<WeekStartKey> {
  const explicit = parseWeekStartKey(requestedKey ?? undefined);
  if (explicit) return explicit;

  const currentWeek = getWeekStartKey(now);
  const deadline = await getDeadlineForWeek(currentWeek);
  if (computeIsLockedByDeadline(deadline, now)) {
    return getNextWeekStartKey(now);
  }
  return currentWeek;
}

/** @deprecated Per-institution deadline — use computeIsLockedByDeadline with menu.orderDeadline */
export function computeIsLocked(
  _settings: PortalSettingsLike,
  _weekStartKey: WeekStartKey,
  _now: Date = new Date()
): boolean {
  return false;
}

export function defaultOrderDays() {
  return PORTAL_WORK_DAYS.map((dayOfWeek) => ({
    dayOfWeek,
    regularCount: 0,
    vegetarianCount: 0,
    notes: ''
  }));
}

export function sumOrderPortions(
  days: Array<{ regularCount?: number; vegetarianCount?: number }> | undefined,
  shabbatOrder?: { regularCount?: number; vegetarianCount?: number } | null
): number {
  const weekdayTotal = !Array.isArray(days)
    ? 0
    : days.reduce((sum, d) => sum + (Number(d.regularCount) || 0) + (Number(d.vegetarianCount) || 0), 0);
  const shabbatTotal = shabbatOrder
    ? (Number(shabbatOrder.regularCount) || 0) + (Number(shabbatOrder.vegetarianCount) || 0)
    : 0;
  return weekdayTotal + shabbatTotal;
}

export function hasMeaningfulOrder(
  days: Array<{ regularCount?: number; vegetarianCount?: number }> | undefined,
  shabbatOrder?: { regularCount?: number; vegetarianCount?: number } | null
): boolean {
  return sumOrderPortions(days, shabbatOrder) > 0;
}

export function isMenuPublished(_menu: Record<string, unknown> | null | undefined): boolean {
  // Delegated — import isMenuWeekPublished from menu-structure in controllers
  return false;
}

export function normalizeOrderDayNotes(row: Record<string, unknown>): string {
  if (row.notes !== undefined && row.notes !== null) {
    return String(row.notes).trim();
  }
  if (row.categoryNotes && typeof row.categoryNotes === 'object') {
    const cn = normalizeCategoryNotes(row.categoryNotes);
    const parts = MENU_CATEGORIES.map((c) => cn[c.noteKey]).filter(Boolean);
    return parts.join(' · ');
  }
  return '';
}

export function normalizeOrderDays(raw: unknown) {
  const list = Array.isArray(raw) ? raw : [];
  const byDay = new Map<
    number,
    {
      dayOfWeek: number;
      regularCount: number;
      vegetarianCount: number;
      notes: string;
    }
  >();

  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const day = Number(row.dayOfWeek);
    if (!PORTAL_WORK_DAYS.includes(day as (typeof PORTAL_WORK_DAYS)[number])) continue;

    byDay.set(day, {
      dayOfWeek: day,
      regularCount: Math.max(0, Number(row.regularCount) || 0),
      vegetarianCount: Math.max(0, Number(row.vegetarianCount) || 0),
      notes: normalizeOrderDayNotes(row)
    });
  }

  return PORTAL_WORK_DAYS.map((dayOfWeek) =>
    byDay.get(dayOfWeek) || {
      dayOfWeek,
      regularCount: 0,
      vegetarianCount: 0,
      notes: ''
    }
  );
}

const COUNT_FIELD_LABELS: Record<string, string> = {
  regularCount: 'מנות רגילות',
  vegetarianCount: 'מנות צמחוניות'
};

function parseStrictNonNegativeInteger(
  value: unknown,
  fieldLabel: string
): { ok: true; value: number } | { ok: false; message: string } {
  if (value === undefined || value === null || value === '') {
    return { ok: true, value: 0 };
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
      return { ok: false, message: `${fieldLabel} חייב להיות מספר שלם שאינו שלילי` };
    }
    return { ok: true, value };
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return { ok: true, value: 0 };
    if (!/^\d+$/.test(trimmed)) {
      return { ok: false, message: `${fieldLabel} חייב להיות מספר שלם שאינו שלילי` };
    }
    return { ok: true, value: parseInt(trimmed, 10) };
  }

  return { ok: false, message: `${fieldLabel} חייב להיות מספר שלם שאינו שלילי` };
}

/** Validate order day counts before save — rejects negatives and decimals. */
export function validateOrderDaysPayload(raw: unknown):
  | { ok: true; days: ReturnType<typeof normalizeOrderDays> }
  | { ok: false; message: string } {
  if (!Array.isArray(raw)) {
    return { ok: false, message: 'מבנה הזמנה לא תקין — נדרש מערך ימים' };
  }

  for (const item of raw) {
    if (!item || typeof item !== 'object') {
      return { ok: false, message: 'מבנה הזמנה לא תקין — יום לא תקין' };
    }
    const row = item as Record<string, unknown>;
    const day = Number(row.dayOfWeek);
    if (!PORTAL_WORK_DAYS.includes(day as (typeof PORTAL_WORK_DAYS)[number])) {
      continue;
    }

    for (const field of ['regularCount', 'vegetarianCount'] as const) {
      const value = row[field];
      const label = COUNT_FIELD_LABELS[field];

      if (typeof value === 'number') {
        if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
          return { ok: false, message: `${label} חייב להיות מספר שלם שאינו שלילי` };
        }
        continue;
      }

      const parsed = parseStrictNonNegativeInteger(value, label);
      if (parsed.ok === false) {
        return { ok: false, message: parsed.message };
      }
    }
  }

  return { ok: true, days: normalizeOrderDays(raw) };
}

const SHABBAT_EXTRA_LABELS: Record<string, string> = {
  challahs: 'חלות',
  rolls: 'לחמניות',
  grapeJuice: 'מיץ ענבים'
};

/** Validate Shabbat weekend order block before save — rejects negatives and decimals. */
export function validateShabbatOrderPayload(raw: unknown):
  | { ok: true; shabbatOrder: ShabbatOrder }
  | { ok: false; message: string } {
  if (raw === undefined || raw === null) {
    return { ok: true, shabbatOrder: emptyShabbatOrder() };
  }

  if (typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, message: 'מבנה הזמנת שבת לא תקין' };
  }

  const row = raw as Record<string, unknown>;

  for (const field of ['regularCount', 'vegetarianCount'] as const) {
    const parsed = parseStrictNonNegativeInteger(row[field], COUNT_FIELD_LABELS[field]);
    if (parsed.ok === false) {
      return { ok: false, message: parsed.message };
    }
  }

  const extrasRaw = row.extras;
  if (extrasRaw !== undefined && extrasRaw !== null) {
    if (typeof extrasRaw !== 'object' || Array.isArray(extrasRaw)) {
      return { ok: false, message: 'מבנה תוספות שבת לא תקין' };
    }
    const extras = extrasRaw as Record<string, unknown>;
    for (const field of ['challahs', 'rolls', 'grapeJuice'] as const) {
      const parsed = parseStrictNonNegativeInteger(extras[field], SHABBAT_EXTRA_LABELS[field]);
      if (parsed.ok === false) {
        return { ok: false, message: parsed.message };
      }
    }
  }

  return { ok: true, shabbatOrder: normalizeShabbatOrder(raw) };
}

/** Date-range for legacy BSON Date weekStartDate documents (bypasses Mongoose string cast). */
export function legacyWeekDateRange(key: WeekStartKey): { start: Date; end: Date } {
  const start = weekKeyToUtcDate(key);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}
