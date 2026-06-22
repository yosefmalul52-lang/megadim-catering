import type { MenuCategoryKey } from './menu-structure';

export type LogisticsCategoryKey = MenuCategoryKey | 'fish';

export const DEFAULT_PORTIONS_PER_GN = 40;
export const DEFAULT_MEAT_GRAMS_PER_PORTION = 200;

export interface DishLogisticsLookup {
  gramsPerPortion?: number;
  portionsPerGastronorm?: number;
}

export function logisticsCategoryUsesUnits(category: LogisticsCategoryKey): boolean {
  return category === 'fish' || category === 'vegetarianMain';
}

export function logisticsCategoryUsesGastronorms(category: LogisticsCategoryKey): boolean {
  return category !== 'mainMeat' && !logisticsCategoryUsesUnits(category);
}

export function logisticsQuantityLabel(category: LogisticsCategoryKey): 'יחידות' | 'מנות' {
  return logisticsCategoryUsesUnits(category) ? 'יחידות' : 'מנות';
}

export function roundLogistics(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 10) / 10;
}

export function safePortions(portions: unknown): number {
  const n = Number(portions);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

export function safePositiveDivisor(value: unknown, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return n;
}

export function computeGastronorms(
  portions: unknown,
  portionsPerGastronorm?: unknown
): number {
  const safe = safePortions(portions);
  if (safe <= 0) return 0;
  const divisor = safePositiveDivisor(portionsPerGastronorm, DEFAULT_PORTIONS_PER_GN);
  return roundLogistics(safe / divisor);
}

export function computeMeatKg(portions: unknown, gramsPerPortion?: unknown): number {
  const safe = safePortions(portions);
  if (safe <= 0) return 0;
  const grams = safePositiveDivisor(gramsPerPortion, DEFAULT_MEAT_GRAMS_PER_PORTION);
  return roundLogistics((safe * grams) / 1000);
}

/** Format number to 1 decimal place; omit trailing .0 for whole numbers. */
export function formatLogisticsNumber(value: number): string {
  const rounded = roundLogistics(value);
  return rounded % 1 === 0 ? String(rounded) : rounded.toFixed(1);
}

export function formatGastronormsLabel(
  portions: unknown,
  portionsPerGastronorm?: unknown
): string {
  return `סה"כ ${formatLogisticsNumber(computeGastronorms(portions, portionsPerGastronorm))} גסטרונומים`;
}

export function formatMeatKgLabel(portions: unknown, gramsPerPortion?: unknown): string {
  return `סה"כ ${formatLogisticsNumber(computeMeatKg(portions, gramsPerPortion))} ק"ג`;
}

export function formatLogisticsSuffix(
  portions: unknown,
  menuCategoryKey: LogisticsCategoryKey,
  logistics: DishLogisticsLookup = {}
): string {
  const metric = formatLogisticsMetric(portions, menuCategoryKey, logistics);
  if (!metric) return '';
  return `סה"כ ${metric}`;
}

/** Compact metric for UI badges, e.g. `22.5 ק"ג` or `3.8 גסטרונומים`. Null when invalid. */
export function formatLogisticsMetric(
  portions: unknown,
  menuCategoryKey: LogisticsCategoryKey,
  logistics: DishLogisticsLookup = {}
): string | null {
  const safeCount = safePortions(portions);
  if (safeCount <= 0) return null;

  if (menuCategoryKey === 'mainMeat') {
    const kg = computeMeatKg(safeCount, logistics.gramsPerPortion);
    if (!Number.isFinite(kg) || kg <= 0) return null;
    return `${formatLogisticsNumber(kg)} ק"ג`;
  }

  if (logisticsCategoryUsesUnits(menuCategoryKey)) {
    return null;
  }

  const gn = computeGastronorms(safeCount, logistics.portionsPerGastronorm);
  if (!Number.isFinite(gn) || gn <= 0) return null;
  const unit = gn === 1 ? 'גסטרונום' : 'גסטרונומים';
  return `${formatLogisticsNumber(gn)} ${unit}`;
}

export interface CategoryLogisticsDisplayLine {
  categoryLabel: string;
  dish: string;
  portions: number;
  logisticsMetric: string | null;
  /** Readable line: "חזה עוף - 11 מנות (2.7 ק"ג)" */
  displayText: string;
  note?: string;
}

/** e.g. חזה עוף על האש - 11 מנות (2.7 ק"ג) | דג - 12 יחידות */
export function formatCategoryLogisticsDisplayText(
  dish: string,
  portions: number,
  logisticsMetric: string | null,
  menuCategoryKey: LogisticsCategoryKey = 'side'
): string {
  const metricPart = logisticsMetric ? ` (${logisticsMetric})` : '';
  const quantityLabel = logisticsQuantityLabel(menuCategoryKey);
  return `${dish} - ${portions} ${quantityLabel}${metricPart}`;
}

/** Structured kitchen/packing row for template binding with optional logistics badge. */
export function buildCategoryLogisticsLine(
  label: string,
  dish: string,
  portions: unknown,
  menuCategoryKey: LogisticsCategoryKey,
  logistics: DishLogisticsLookup = {},
  note = ''
): CategoryLogisticsDisplayLine | null {
  const trimmed = (dish || '').trim();
  if (!trimmed) return null;

  const safeCount = safePortions(portions);
  const logisticsMetric = formatLogisticsMetric(safeCount, menuCategoryKey, logistics);
  const noteTrim = (note || '').trim();
  const displayText = formatCategoryLogisticsDisplayText(
    trimmed,
    safeCount,
    logisticsMetric,
    menuCategoryKey
  );

  return {
    categoryLabel: label,
    dish: trimmed,
    portions: safeCount,
    logisticsMetric,
    displayText,
    ...(noteTrim ? { note: noteTrim } : {})
  };
}

/** Packing / kitchen line with portion count and logistics. */
export function formatCategoryLogisticsLine(
  label: string,
  dish: string,
  portions: unknown,
  menuCategoryKey: LogisticsCategoryKey,
  logistics: DishLogisticsLookup = {},
  note = ''
): string {
  const line = buildCategoryLogisticsLine(label, dish, portions, menuCategoryKey, logistics, note);
  if (!line) return '';

  const metricPart = line.logisticsMetric ? ` (${line.logisticsMetric})` : '';
  const notePart = line.note ? ` | הערת לקוח: ${line.note}` : '';
  const quantityLabel = logisticsQuantityLabel(menuCategoryKey);
  return `${line.dish} - ${line.portions} ${quantityLabel}${metricPart}${notePart}`;
}

export function formatLogisticsBrief(lines: CategoryLogisticsDisplayLine[]): string {
  return lines
    .filter((line) => line.logisticsMetric || line.displayText.includes('יחידות'))
    .map((line) =>
      line.logisticsMetric
        ? `${line.categoryLabel} - ${line.logisticsMetric}`
        : `${line.categoryLabel} - ${line.portions} יחידות`
    )
    .join(', ');
}

/** @deprecated Use DEFAULT_PORTIONS_PER_GN */
export const PORTIONS_PER_GN = DEFAULT_PORTIONS_PER_GN;
