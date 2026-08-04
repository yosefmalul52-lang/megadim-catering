import {
  KitchenStage,
  KitchenTaskStatus,
  KITCHEN_STAGES,
  KITCHEN_TASK_STATUSES
} from '../models/KitchenPreparationTask';
import {
  dishIdentityKey,
  effectiveLineQuantity,
  extractAllergies,
  extractCustomerName,
  extractSpecialRequests,
  normalizeFulfillment,
  normalizeMeals,
  formatOrderMealsLabel,
  resolvePreparation,
  toJerusalemDateKey
} from './kitchen-report.util';

const JERUSALEM = 'Asia/Jerusalem';

export function isKitchenStage(v: unknown): v is KitchenStage {
  return typeof v === 'string' && (KITCHEN_STAGES as readonly string[]).includes(v);
}

export function isKitchenTaskStatus(v: unknown): v is KitchenTaskStatus {
  return typeof v === 'string' && (KITCHEN_TASK_STATUSES as readonly string[]).includes(v);
}

export function buildOrderItemKey(item: any): string {
  return dishIdentityKey({
    productId: item?.productId,
    name: item?.name,
    selectedOption: item?.selectedOption,
    category: item?.category || ''
  });
}

export function buildOrderSnapshot(order: any) {
  const meals = normalizeMeals(order);
  return {
    orderNumber: String(order?.orderNumber || ''),
    eventDate: String(order?.customerDetails?.eventDate || '').slice(0, 10),
    meal: formatOrderMealsLabel(meals),
    fulfillment: normalizeFulfillment(order?.customerDetails),
    customerName: extractCustomerName(order?.customerDetails),
    allergies: extractAllergies(order),
    specialRequests: extractSpecialRequests(order)
  };
}

/** Resolve planned instant for backfill: manual prep wins; else eventDate noon Jerusalem marked as fallback. */
export function resolveBackfillPlanTime(order: any): {
  at: Date;
  usedDeliveryFallback: boolean;
} {
  const prep = resolvePreparation(order);
  if (prep.preparationAt) {
    return { at: prep.preparationAt, usedDeliveryFallback: false };
  }
  const key = prep.eventDateKey || parseDateOnly(order?.customerDetails?.eventDate);
  if (key) {
    // Noon Asia/Jerusalem ≈ 09:00 UTC (IST+3) — display uses Jerusalem TZ.
    return { at: new Date(`${key}T09:00:00.000Z`), usedDeliveryFallback: true };
  }
  return { at: new Date(), usedDeliveryFallback: true };
}

function parseDateOnly(raw: unknown): string | null {
  const s = String(raw || '').trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

export function jerusalemDayBounds(dateKey: string): { start: Date; end: Date } {
  // Inclusive day in Asia/Jerusalem expressed as UTC instants (± DST handled by fixed offset approx +03).
  // For ops filtering we store plannedStartAt as absolute Date; filter by Jerusalem calendar key.
  return {
    start: new Date(`${dateKey}T00:00:00.000+03:00`),
    end: new Date(`${dateKey}T23:59:59.999+03:00`)
  };
}

export function taskOnJerusalemDay(plannedStartAt: Date | string, dateKey: string): boolean {
  return toJerusalemDateKey(new Date(plannedStartAt)) === dateKey;
}

/** Detect circular dependencies among task ids (adjacency map). */
export function hasCircularDependency(
  edges: Map<string, string[]>,
  startId: string,
  newDeps: string[]
): boolean {
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const clone = new Map(edges);
  clone.set(startId, [...newDeps]);
  const dfs = (node: string): boolean => {
    if (visiting.has(node)) return true;
    if (visited.has(node)) return false;
    visiting.add(node);
    for (const next of clone.get(node) || []) {
      if (dfs(next)) return true;
    }
    visiting.delete(node);
    visited.add(node);
    return false;
  };
  return dfs(startId);
}

export function normalizeKitchenStage(stage: unknown): KitchenStage {
  const raw = String(stage || '').trim();
  const aliases: Record<string, KitchenStage> = {
    pre_prep: 'prep',
    mix_or_season: 'mix',
    bake_or_roast: 'bake',
    quality_check: 'qa',
    load_or_handoff: 'load',
    clean_or_setup: 'station_clean'
  };
  const mapped = (aliases[raw] || raw) as KitchenStage;
  return isKitchenStage(mapped) ? mapped : 'general';
}

/** Prefer canonical status names from the multi-day ops command. */
export function normalizeKitchenTaskStatus(status: unknown): KitchenTaskStatus {
  const raw = String(status || '').trim();
  if (raw === 'partial') return 'partially_completed';
  if (raw === 'done') return 'completed';
  if (isKitchenTaskStatus(raw)) return raw;
  return 'not_started';
}

export function isCompletedTaskStatus(status: unknown): boolean {
  return status === 'done' || status === 'completed';
}

export function stageLabelHe(stage: KitchenStage | string): string {
  const canonical = normalizeKitchenStage(stage);
  const map: Record<string, string> = {
    thaw: 'הפשרה',
    prep: 'הכנה מוקדמת',
    pre_prep: 'הכנה מוקדמת',
    cut: 'חיתוך',
    mix: 'ערבוב / תיבול',
    mix_or_season: 'ערבוב / תיבול',
    cook: 'בישול',
    bake: 'אפייה / צלייה',
    bake_or_roast: 'אפייה / צלייה',
    cool: 'קירור',
    store: 'אחסון',
    pack: 'אריזה',
    qa: 'בקרת איכות',
    quality_check: 'בקרת איכות',
    load: 'העמסה / מסירה',
    load_or_handoff: 'העמסה / מסירה',
    station_clean: 'ניקיון / הכנת עמדה',
    clean_or_setup: 'ניקיון / הכנת עמדה',
    general: 'משימה כללית'
  };
  return map[String(stage)] || map[canonical] || String(stage);
}

export function statusLabelHe(status: KitchenTaskStatus | string): string {
  const map: Record<string, string> = {
    not_started: 'לא התחיל',
    in_progress: 'בביצוע',
    partial: 'הושלם חלקית',
    partially_completed: 'הושלם חלקית',
    done: 'הושלם',
    completed: 'הושלם',
    blocked: 'חסום',
    cancelled: 'בוטל'
  };
  return map[String(status)] || String(status);
}

export function openTaskStatuses(): KitchenTaskStatus[] {
  return ['not_started', 'in_progress', 'partial', 'partially_completed', 'blocked'];
}

export function isOpenTaskStatus(status: KitchenTaskStatus | string): boolean {
  return openTaskStatuses().includes(status as KitchenTaskStatus);
}

/** Ordered quantities from order items — never sum task stages. */
export function orderedQuantitiesFromOrder(order: any): Array<{
  orderItemKey: string;
  name: string;
  optionLabel: string;
  sizeLabel: string;
  category: string;
  orderedQuantity: number;
  unit: string;
}> {
  const items = Array.isArray(order?.items) ? order.items : [];
  const map = new Map<string, any>();
  for (const item of items) {
    const name = String(item?.name || '').trim();
    if (!name) continue;
    const qty = effectiveLineQuantity(order, item);
    if (qty <= 0) continue;
    const key = buildOrderItemKey(item);
    const prev = map.get(key);
    if (prev) prev.orderedQuantity += qty;
    else {
      map.set(key, {
        orderItemKey: key,
        name,
        optionLabel: String(item?.selectedOption?.label || '').trim(),
        sizeLabel: String(item?.selectedOption?.amount || '').trim(),
        category: String(item?.category || '').trim() || 'כללי',
        orderedQuantity: qty,
        unit: /מ"?ל|ml|ק"?ג|kg|גר/i.test(String(item?.selectedOption?.amount || ''))
          ? String(item.selectedOption.amount)
          : "יח'"
      });
    }
  }
  return [...map.values()];
}

export function assertNonNegativeQuantity(value: unknown, label: string): number | null {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) {
    const err: any = new Error(`${label} חייב להיות מספר שאינו שלילי`);
    err.statusCode = 400;
    throw err;
  }
  return n;
}

export { JERUSALEM };
