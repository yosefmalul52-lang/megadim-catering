/** Open order dates with optional per-date cutoff times (Israel timezone). */

export const DEFAULT_CUTOFF_TIME = '23:59';
export const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/;

export interface OpenDateRule {
  date: string;
  cutoffTime: string;
}

export interface OpenDateSettings {
  openDates?: string[];
  openDateRules?: OpenDateRule[];
}

export function normalizeCutoffTime(raw: unknown): string {
  if (raw == null || raw === '') return DEFAULT_CUTOFF_TIME;
  const s = String(raw).trim();
  const m = TIME_RE.exec(s);
  if (!m) return DEFAULT_CUTOFF_TIME;
  return `${m[1].padStart(2, '0')}:${m[2]}`;
}

export function normalizeOpenDateRules(raw: unknown): OpenDateRule[] {
  if (!Array.isArray(raw)) return [];
  const byDate = new Map<string, string>();
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const date = String(row.date || '').trim();
    if (!DATE_KEY_RE.test(date)) continue;
    byDate.set(date, normalizeCutoffTime(row.cutoffTime));
  }
  return Array.from(byDate.entries())
    .map(([date, cutoffTime]) => ({ date, cutoffTime }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function getIsraelDateTimeParts(now: Date = new Date()): { dateKey: string; minutesOfDay: number } {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  const parts = formatter.formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || '00';
  const dateKey = `${get('year')}-${get('month')}-${get('day')}`;
  const minutesOfDay = Number(get('hour')) * 60 + Number(get('minute'));
  return { dateKey, minutesOfDay };
}

export function resolveCutoffTime(dateKey: string, settings: OpenDateSettings): string | null {
  const rule = settings.openDateRules?.find((r) => r.date === dateKey);
  if (rule) return rule.cutoffTime;
  if (settings.openDates?.includes(dateKey)) return DEFAULT_CUTOFF_TIME;
  return null;
}

export function isCutoffPassed(dateKey: string, cutoffTime: string, now: Date = new Date()): boolean {
  const israelNow = getIsraelDateTimeParts(now);
  if (israelNow.dateKey < dateKey) return false;
  if (israelNow.dateKey > dateKey) return true;
  const [hh, mm] = cutoffTime.split(':').map(Number);
  return israelNow.minutesOfDay > hh * 60 + mm;
}

export function isDateOpenForOrdering(
  dateKey: string,
  settings: OpenDateSettings,
  now: Date = new Date()
): boolean {
  const cutoff = resolveCutoffTime(dateKey, settings);
  if (!cutoff) return false;
  return !isCutoffPassed(dateKey, cutoff, now);
}

export function formatDateDisplayHe(dateKey: string): string {
  const [y, m, d] = dateKey.split('-');
  return `${d}/${m}/${y}`;
}
