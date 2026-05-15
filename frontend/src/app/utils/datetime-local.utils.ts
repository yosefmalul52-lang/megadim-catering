/** Parse `datetime-local` as local wall-clock time (no UTC shift). */
export function datetimeLocalToIso(local: string): string {
  if (!local?.trim()) return '';
  const [datePart, timePart = '00:00'] = local.trim().split('T');
  const [y, m, d] = datePart.split('-').map(Number);
  const [hh, mm] = timePart.split(':').map(Number);
  if ([y, m, d, hh, mm].some((n) => Number.isNaN(n))) return '';
  return new Date(y, m - 1, d, hh, mm, 0, 0).toISOString();
}

/** Format ISO date for `datetime-local` input in local timezone. */
export function isoToDatetimeLocal(iso: string | Date): string {
  const d = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatDeadlineLabel(iso: string, locale = 'he-IL'): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}
