/** Shared week key logic — mirrors backend portal-week.ts (UTC Sunday YYYY-MM-DD). */

import { isMenuWeekPublished, type InstitutionMenuContent } from './menu-structure';

const WEEK_KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export type WeekStartKey = string;

export function formatWeekStartKey(date: Date): WeekStartKey {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getWeekStartKey(now: Date = new Date()): WeekStartKey {
  const d = new Date(now);
  const day = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - day);
  d.setUTCHours(0, 0, 0, 0);
  return formatWeekStartKey(d);
}

export function getNextWeekStartKey(now: Date = new Date()): WeekStartKey {
  const d = weekKeyToUtcDate(getWeekStartKey(now));
  d.setUTCDate(d.getUTCDate() + 7);
  return formatWeekStartKey(d);
}

export function getPreviousWeekStartKey(key: WeekStartKey): WeekStartKey {
  const d = weekKeyToUtcDate(key);
  d.setUTCDate(d.getUTCDate() - 7);
  return formatWeekStartKey(d);
}

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

export function weekKeyToUtcDate(key: WeekStartKey): Date {
  const m = WEEK_KEY_RE.exec(key);
  if (!m) throw new Error(`Invalid weekStartDate key: ${key}`);
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0));
}

/** Normalize date input to Sunday YYYY-MM-DD UTC (matches backend). */
export function normalizeWeekInput(value: string): WeekStartKey | null {
  return parseWeekStartKey(value);
}

export function getCurrentWeekStart(): WeekStartKey {
  return getWeekStartKey();
}

export function getDefaultReportsWeekStart(): WeekStartKey {
  return getCurrentWeekStart();
}

export function getDefaultMenuWeekStart(): WeekStartKey {
  return getNextWeekStartKey();
}

/** Shift week key by N weeks (negative = past). */
export function shiftWeekStartKey(key: WeekStartKey, weeks: number): WeekStartKey {
  const d = weekKeyToUtcDate(key);
  d.setUTCDate(d.getUTCDate() + weeks * 7);
  return formatWeekStartKey(d);
}

/** Week offset from current calendar week (negative = past). */
export function getWeekOffsetFromCurrent(weekStart: WeekStartKey | string): number {
  const start = parseWeekStartKey(weekStart);
  if (!start) return 0;
  const current = getWeekStartKey();
  const diffMs = weekKeyToUtcDate(start).getTime() - weekKeyToUtcDate(current).getTime();
  return Math.round(diffMs / (7 * 24 * 60 * 60 * 1000));
}

/** Hebrew label for week offset relative to current week. */
export function getWeekOffsetLabel(weekStart: WeekStartKey | string): string {
  const offset = getWeekOffsetFromCurrent(weekStart);
  if (offset === 0) return 'שבוע נוכחי';
  if (offset === 1) return 'שבוע הבא';
  if (offset === -1) return 'שבוע קודם';
  if (offset > 1) return `+${offset} שבועות`;
  return `${offset} שבועות`;
}

/** Saturday (end of week) for a Sunday weekStartDate key. */
export function getWeekEndKey(key: WeekStartKey): WeekStartKey {
  const d = weekKeyToUtcDate(key);
  d.setUTCDate(d.getUTCDate() + 6);
  return formatWeekStartKey(d);
}

/** Format week key as DD/MM/YYYY for Hebrew RTL display. */
export function formatWeekDateHe(key: WeekStartKey): string {
  const d = weekKeyToUtcDate(key);
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = d.getUTCFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/**
 * Full Hebrew week range from Sunday through Saturday.
 * @param prefix e.g. 'הזמנה לשבוע' or 'טופס הזמנת מנות לשבוע'
 */
export function getWeekRangeString(
  weekStart: WeekStartKey | string,
  prefix = 'הזמנה לשבוע'
): string {
  const start = parseWeekStartKey(weekStart);
  if (!start) return '';
  const end = getWeekEndKey(start);
  return `${prefix}: מ- ${formatWeekDateHe(start)} עד ${formatWeekDateHe(end)}`;
}

/** Report/section title with full week date range (no colon after prefix). */
export function getWeekRangeTitle(weekStart: WeekStartKey | string, prefix: string): string {
  const start = parseWeekStartKey(weekStart);
  if (!start) return prefix;
  const end = getWeekEndKey(start);
  return `${prefix} מ- ${formatWeekDateHe(start)} עד ${formatWeekDateHe(end)}`;
}

/** Print-friendly kitchen report title with full week range. */
export function getWeekRangeReportString(weekStart: WeekStartKey | string): string {
  return getWeekRangeTitle(weekStart, 'דוח ייצור לשבוע');
}

/** Print-friendly packing report title with full week range. */
export function getWeekRangePackingReportString(weekStart: WeekStartKey | string): string {
  return getWeekRangeTitle(weekStart, 'דוח אריזה ומשלוחים לשבוע');
}

/** For HTML date input: restrict picker to Sundays only. */
export function isSundayDateInput(value: string): boolean {
  const key = parseWeekStartKey(value);
  if (!key) return false;
  return weekKeyToUtcDate(key).getUTCDay() === 0;
}

export function isMenuPublished(menu: Record<string, unknown> | null | undefined): boolean {
  return isMenuWeekPublished(menu as Partial<InstitutionMenuContent>);
}
