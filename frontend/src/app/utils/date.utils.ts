/**
 * Format a date to 'YYYY-MM-DD' using local date parts only.
 * Use this when sending dates to the API to avoid timezone offset bugs (e.g. UTC vs local).
 */
export function toYYYYMMDD(date: Date): string {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
