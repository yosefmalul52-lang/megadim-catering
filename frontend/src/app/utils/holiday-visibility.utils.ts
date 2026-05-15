import { HolidayEvent } from '../services/holiday-event.service';
import { datetimeLocalToIso, isoToDatetimeLocal } from './datetime-local.utils';

export interface HolidayVisibilityCheck {
  id: 'active' | 'deadline' | 'products';
  label: string;
  ok: boolean;
  detail?: string;
}

export type HolidayVisibilityStatus = 'live' | 'partial' | 'hidden';

export interface HolidayVisibilityDraft {
  isActive: boolean;
  orderDeadlineLocal: string;
  products: Array<{ name?: string; title?: string; isAvailable?: boolean }>;
}

export function isHolidayProductAvailable(p: { isAvailable?: boolean } | null | undefined): boolean {
  return p?.isAvailable !== false;
}

function countAvailableProducts(
  products: Array<{ name?: string; title?: string; isAvailable?: boolean }>
): number {
  return products.filter(
    (p) => ((p.name ?? p.title) || '').trim().length > 0 && isHolidayProductAvailable(p)
  ).length;
}

export function getHolidayVisibilityChecks(
  draft: HolidayVisibilityDraft,
  now = Date.now()
): HolidayVisibilityCheck[] {
  const isActive = !!draft.isActive;
  const availableCount = countAvailableProducts(draft.products);

  let deadlineOk = false;
  let deadlineDetail = 'לא הוגדר תאריך יעד';
  if (draft.orderDeadlineLocal?.trim()) {
    const iso = datetimeLocalToIso(draft.orderDeadlineLocal);
    const ms = iso ? new Date(iso).getTime() : NaN;
    if (!Number.isNaN(ms)) {
      deadlineOk = ms > now;
      deadlineDetail = deadlineOk ? 'תאריך יעד בעתיד' : 'תאריך היעד כבר עבר';
    }
  }

  return [
    {
      id: 'active',
      label: 'מסומן כפעיל באתר',
      ok: isActive,
      detail: isActive ? 'האירוע מסומן פעיל' : 'יש לסמן "פעיל באתר"'
    },
    {
      id: 'deadline',
      label: 'תאריך יעד להזמנה בעתיד',
      ok: deadlineOk,
      detail: deadlineDetail
    },
    {
      id: 'products',
      label: 'לפחות מוצר אחד זמין להזמנה',
      ok: availableCount > 0,
      detail:
        availableCount > 0
          ? `${availableCount} מוצרים זמינים באתר`
          : 'הפעל לפחות מוצר אחד או הוסף מוצר זמין'
    }
  ];
}

export function getHolidayVisibilityStatus(checks: HolidayVisibilityCheck[]): HolidayVisibilityStatus {
  if (checks.every((c) => c.ok)) return 'live';
  if (checks.some((c) => c.ok)) return 'partial';
  return 'hidden';
}

export function isHolidayEventLiveOnSite(
  event: Pick<HolidayEvent, 'isActive' | 'orderDeadline' | 'products'>,
  now = Date.now()
): boolean {
  const products = (event.products || []).map((p) => ({
    name: p.title,
    isAvailable: p.isAvailable
  }));
  return (
    getHolidayVisibilityStatus(
      getHolidayVisibilityChecks(
        {
          isActive: event.isActive,
          orderDeadlineLocal: isoToDatetimeLocal(event.orderDeadline),
          products
        },
        now
      )
    ) === 'live'
  );
}
