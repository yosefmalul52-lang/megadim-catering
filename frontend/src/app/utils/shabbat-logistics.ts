import type {
  InstitutionMenuContent,
  ShabbatOrder,
  ShabbatPackage,
  FridayNightMeals,
  ShabbatDayMeals,
  SeudaShlishitMeals
} from './menu-structure';
import { hasStoredMealPortions, resolveShabbatMealCounts } from './menu-structure';
import {
  buildCategoryLogisticsLine,
  formatLogisticsMetric,
  logisticsQuantityLabel,
  type CategoryLogisticsDisplayLine,
  type DishLogisticsLookup,
  type LogisticsCategoryKey
} from './kitchen-logistics';

export type ShabbatPortionRule = 'regular' | 'vegetarian' | 'both' | 'saladDouble';

export interface ShabbatExtrasTotals {
  challahs: number;
  rolls: number;
  grapeJuice: number;
}

export interface ShabbatKitchenTotals {
  regular: number;
  vegetarian: number;
  grandTotal: number;
}

function safeCount(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : 0;
}

export function portionsByRule(
  rule: ShabbatPortionRule,
  regularCount: number,
  vegetarianCount: number
): number {
  switch (rule) {
    case 'regular':
      return regularCount;
    case 'vegetarian':
      return vegetarianCount;
    case 'both':
      return regularCount + vegetarianCount;
    case 'saladDouble':
      return (regularCount + vegetarianCount) * 2;
    default:
      return 0;
  }
}

export function aggregateShabbatExtras(orders: { shabbatOrder?: ShabbatOrder | null }[]): ShabbatExtrasTotals {
  const totals = { challahs: 0, rolls: 0, grapeJuice: 0 };
  for (const order of orders) {
    const extras = order.shabbatOrder?.extras;
    if (!extras) continue;
    totals.challahs += safeCount(extras.challahs);
    totals.rolls += safeCount(extras.rolls);
    totals.grapeJuice += safeCount(extras.grapeJuice);
  }
  return totals;
}

export function aggregateShabbatKitchenTotals(
  orders: { shabbatOrder?: ShabbatOrder | null }[]
): ShabbatKitchenTotals {
  let regular = 0;
  let vegetarian = 0;
  for (const order of orders) {
    const s = order.shabbatOrder;
    if (!s) continue;
    regular += safeCount(s.regularCount);
    vegetarian += safeCount(s.vegetarianCount);
  }
  return { regular, vegetarian, grandTotal: regular + vegetarian };
}

function aggregateMealTotals(
  orders: { shabbatOrder?: ShabbatOrder | null }[],
  meal: 'fridayNight' | 'shabbatDay' | 'seudaShlishit'
): { regular: number; vegetarian: number } {
  let regular = 0;
  let vegetarian = 0;
  for (const order of orders) {
    const s = order.shabbatOrder;
    if (!s) continue;
    if (meal === 'seudaShlishit' && !s.wantsSeudaShlishit) continue;
    const counts = resolveShabbatMealCounts(s, meal);
    regular += counts.regularCount;
    vegetarian += counts.vegetarianCount;
  }
  return { regular, vegetarian };
}

function aggregateShabbatSaladPortions(orders: { shabbatOrder?: ShabbatOrder | null }[]): number {
  let total = 0;
  for (const order of orders) {
    const s = order.shabbatOrder;
    if (!s) continue;
    let regular: number;
    let vegetarian: number;
    if (hasStoredMealPortions(s)) {
      const fn = resolveShabbatMealCounts(s, 'fridayNight');
      const sd = resolveShabbatMealCounts(s, 'shabbatDay');
      regular = fn.regularCount + sd.regularCount;
      vegetarian = fn.vegetarianCount + sd.vegetarianCount;
    } else {
      regular = safeCount(s.regularCount);
      vegetarian = safeCount(s.vegetarianCount);
    }
    total += portionsByRule('saladDouble', regular, vegetarian);
  }
  return total;
}

function saladPortionsForOrder(shabbatOrder: ShabbatOrder): number {
  let regular: number;
  let vegetarian: number;
  if (hasStoredMealPortions(shabbatOrder)) {
    const fn = resolveShabbatMealCounts(shabbatOrder, 'fridayNight');
    const sd = resolveShabbatMealCounts(shabbatOrder, 'shabbatDay');
    regular = fn.regularCount + sd.regularCount;
    vegetarian = fn.vegetarianCount + sd.vegetarianCount;
  } else {
    regular = safeCount(shabbatOrder.regularCount);
    vegetarian = safeCount(shabbatOrder.vegetarianCount);
  }
  return portionsByRule('saladDouble', regular, vegetarian);
}

function logisticsKeyForShabbatField(fieldKey: string): LogisticsCategoryKey {
  if (fieldKey === 'fish') return 'fish';
  if (fieldKey === 'mainMeat') return 'mainMeat';
  if (fieldKey === 'vegetarianMain') return 'vegetarianMain';
  if (fieldKey === 'carb' || fieldKey === 'carb1' || fieldKey === 'carb2') return 'carb1';
  if (fieldKey === 'protein') return 'side';
  if (fieldKey === 'side') return 'side';
  return 'saladFruit';
}

function buildLine(
  sectionLabel: string,
  dishLabel: string,
  dish: string,
  portions: number,
  fieldKey: string,
  logistics: DishLogisticsLookup
): CategoryLogisticsDisplayLine | null {
  if (portions <= 0) return null;
  const key = logisticsKeyForShabbatField(fieldKey);
  const line = buildCategoryLogisticsLine(
    `${sectionLabel} — ${dishLabel}`,
    dish,
    portions,
    key,
    logistics
  );
  return line;
}

function linesFromMealBlock(
  sectionLabel: string,
  meals: Record<string, string>,
  fields: readonly { key: string; label: string; rule: ShabbatPortionRule }[],
  regularTotal: number,
  vegetarianTotal: number,
  lookup: (dish: string, fieldKey: string) => DishLogisticsLookup
): CategoryLogisticsDisplayLine[] {
  const lines: CategoryLogisticsDisplayLine[] = [];
  for (const field of fields) {
    const dish = (meals[field.key] || '').trim();
    if (!dish) continue;
    const portions = portionsByRule(field.rule, regularTotal, vegetarianTotal);
    const line = buildLine(sectionLabel, field.label, dish, portions, field.key, lookup(dish, field.key));
    if (line) lines.push(line);
  }
  return lines;
}

const FRIDAY_NIGHT_RULES: { key: keyof FridayNightMeals; label: string; rule: ShabbatPortionRule }[] = [
  /** Vegetarians also receive the Friday-night fish starter. */
  { key: 'fish', label: 'דג', rule: 'both' },
  { key: 'mainMeat', label: 'עיקרית בשרית', rule: 'regular' },
  { key: 'vegetarianMain', label: 'מנה עיקרית צמחונית', rule: 'vegetarian' },
  { key: 'carb1', label: 'פחמימה 1', rule: 'both' },
  { key: 'carb2', label: 'פחמימה 2', rule: 'both' },
  { key: 'side', label: 'תוספת', rule: 'both' }
];

const SHABBAT_DAY_RULES: { key: keyof ShabbatDayMeals; label: string; rule: ShabbatPortionRule }[] = [
  { key: 'mainMeat', label: 'עיקרית בשרית', rule: 'regular' },
  { key: 'vegetarianMain', label: 'מנה עיקרית צמחונית', rule: 'vegetarian' },
  { key: 'carb1', label: 'פחמימה 1', rule: 'both' },
  { key: 'carb2', label: 'פחמימה 2', rule: 'both' },
  { key: 'side', label: 'תוספת', rule: 'both' }
];

const SEUDA_RULES: { key: keyof SeudaShlishitMeals; label: string; rule: ShabbatPortionRule }[] = [
  { key: 'carb', label: 'פחמימה', rule: 'both' },
  { key: 'protein', label: 'חלבון', rule: 'both' }
];

/** Kitchen report: aggregate Shabbat logistics across all institution orders. */
export function buildAggregatedShabbatKitchenLines(
  menu: InstitutionMenuContent,
  orders: { shabbatOrder?: ShabbatOrder | null }[],
  lookup: (dish: string, fieldKey: string) => DishLogisticsLookup
): CategoryLogisticsDisplayLine[] {
  const pkg = menu.shabbatPackage;
  if (!pkg?.hasShabbat) return [];

  const fridayTotals = aggregateMealTotals(orders, 'fridayNight');
  const dayTotals = aggregateMealTotals(orders, 'shabbatDay');
  const seudaTotals = aggregateMealTotals(orders, 'seudaShlishit');
  const lines: CategoryLogisticsDisplayLine[] = [];

  lines.push(
    ...linesFromMealBlock(
      'ערב שבת',
      pkg.fridayNight as unknown as Record<string, string>,
      FRIDAY_NIGHT_RULES,
      fridayTotals.regular,
      fridayTotals.vegetarian,
      lookup
    )
  );

  lines.push(
    ...linesFromMealBlock(
      'שבת בוקר',
      pkg.shabbatDay as unknown as Record<string, string>,
      SHABBAT_DAY_RULES,
      dayTotals.regular,
      dayTotals.vegetarian,
      lookup
    )
  );

  const saladPortionsTotal = aggregateShabbatSaladPortions(orders);
  for (let i = 0; i < pkg.shabbatSalads.length; i++) {
    const dish = (pkg.shabbatSalads[i] || '').trim();
    if (!dish) continue;
    const line = buildLine('סלטי שבת', `סלט ${i + 1}`, dish, saladPortionsTotal, 'saladFruit', lookup(dish, 'saladFruit'));
    if (line) lines.push(line);
  }

  lines.push(
    ...linesFromMealBlock(
      'סעודה שלישית',
      pkg.seudaShlishit as unknown as Record<string, string>,
      SEUDA_RULES,
      seudaTotals.regular,
      seudaTotals.vegetarian,
      lookup
    )
  );

  return lines;
}

/** Packing report: Shabbat logistics for a single institution order. */
export function buildPackingShabbatLines(
  pkg: ShabbatPackage,
  shabbatOrder: ShabbatOrder,
  lookup: (dish: string, fieldKey: string) => DishLogisticsLookup
): CategoryLogisticsDisplayLine[] {
  if (!pkg?.hasShabbat) return [];

  const friday = resolveShabbatMealCounts(shabbatOrder, 'fridayNight');
  const shabbatDay = resolveShabbatMealCounts(shabbatOrder, 'shabbatDay');
  const lines: CategoryLogisticsDisplayLine[] = [];

  lines.push(
    ...linesFromMealBlock(
      'ערב שבת',
      pkg.fridayNight as unknown as Record<string, string>,
      FRIDAY_NIGHT_RULES,
      friday.regularCount,
      friday.vegetarianCount,
      lookup
    )
  );

  lines.push(
    ...linesFromMealBlock(
      'שבת בוקר',
      pkg.shabbatDay as unknown as Record<string, string>,
      SHABBAT_DAY_RULES,
      shabbatDay.regularCount,
      shabbatDay.vegetarianCount,
      lookup
    )
  );

  const saladPortions = saladPortionsForOrder(shabbatOrder);
  for (let i = 0; i < pkg.shabbatSalads.length; i++) {
    const dish = (pkg.shabbatSalads[i] || '').trim();
    if (!dish) continue;
    const line = buildLine('סלטי שבת', `סלט ${i + 1}`, dish, saladPortions, 'saladFruit', lookup(dish, 'saladFruit'));
    if (line) lines.push(line);
  }

  if (shabbatOrder.wantsSeudaShlishit) {
    const seuda = resolveShabbatMealCounts(shabbatOrder, 'seudaShlishit');
    lines.push(
      ...linesFromMealBlock(
        'סעודה שלישית',
        pkg.seudaShlishit as unknown as Record<string, string>,
        SEUDA_RULES,
        seuda.regularCount,
        seuda.vegetarianCount,
        lookup
      )
    );
  }

  return lines;
}

export function formatShabbatExtrasSummary(extras: ShabbatExtrasTotals): string {
  const parts: string[] = [];
  if (extras.challahs > 0) parts.push(`חלות: ${extras.challahs}`);
  if (extras.rolls > 0) parts.push(`לחמניות: ${extras.rolls}`);
  if (extras.grapeJuice > 0) parts.push(`מיץ ענבים: ${extras.grapeJuice}`);
  return parts.join(' · ');
}

export interface InstitutionKitchenPrintRow {
  sectionLabel: string;
  categoryLabel: string;
  dish: string;
  regular: number;
  vegetarian: number;
  total: number;
  logisticsText: string;
}

function printRowFromField(
  sectionLabel: string,
  fieldLabel: string,
  dish: string,
  fieldKey: string,
  rule: ShabbatPortionRule,
  regularTotal: number,
  vegetarianTotal: number,
  lookup: (dish: string, fieldKey: string) => DishLogisticsLookup
): InstitutionKitchenPrintRow | null {
  const trimmed = (dish || '').trim();
  if (!trimmed) return null;

  let regular = 0;
  let vegetarian = 0;
  let total = 0;
  switch (rule) {
    case 'regular':
      regular = regularTotal;
      total = regularTotal;
      break;
    case 'vegetarian':
      vegetarian = vegetarianTotal;
      total = vegetarianTotal;
      break;
    case 'both':
      regular = regularTotal;
      vegetarian = vegetarianTotal;
      total = regularTotal + vegetarianTotal;
      break;
    case 'saladDouble':
      regular = regularTotal;
      vegetarian = vegetarianTotal;
      total = (regularTotal + vegetarianTotal) * 2;
      break;
  }
  if (total <= 0) return null;

  const key = logisticsKeyForShabbatField(fieldKey);
  const metric = formatLogisticsMetric(total, key, lookup(trimmed, fieldKey));
  const logisticsText = metric || `${total} ${logisticsQuantityLabel(key)}`;

  return {
    sectionLabel,
    categoryLabel: fieldLabel,
    dish: trimmed,
    regular,
    vegetarian,
    total,
    logisticsText
  };
}

function printRowsFromMealBlock(
  sectionLabel: string,
  meals: Record<string, string>,
  fields: readonly { key: string; label: string; rule: ShabbatPortionRule }[],
  regularTotal: number,
  vegetarianTotal: number,
  lookup: (dish: string, fieldKey: string) => DishLogisticsLookup
): InstitutionKitchenPrintRow[] {
  const rows: InstitutionKitchenPrintRow[] = [];
  for (const field of fields) {
    const row = printRowFromField(
      sectionLabel,
      field.label,
      meals[field.key] || '',
      field.key,
      field.rule,
      regularTotal,
      vegetarianTotal,
      lookup
    );
    if (row) rows.push(row);
  }
  return rows;
}

/** Production print: Shabbat rows with per-meal diner counts via resolveShabbatMealCounts. */
export function buildInstitutionProductionShabbatRows(
  menu: InstitutionMenuContent,
  orders: { shabbatOrder?: ShabbatOrder | null }[],
  lookup: (dish: string, fieldKey: string) => DishLogisticsLookup
): InstitutionKitchenPrintRow[] {
  const pkg = menu.shabbatPackage;
  if (!pkg?.hasShabbat) return [];

  const fridayTotals = aggregateMealTotals(orders, 'fridayNight');
  const dayTotals = aggregateMealTotals(orders, 'shabbatDay');
  const seudaTotals = aggregateMealTotals(orders, 'seudaShlishit');
  const rows: InstitutionKitchenPrintRow[] = [];

  rows.push(
    ...printRowsFromMealBlock(
      'ערב שבת',
      pkg.fridayNight as unknown as Record<string, string>,
      FRIDAY_NIGHT_RULES,
      fridayTotals.regular,
      fridayTotals.vegetarian,
      lookup
    )
  );

  rows.push(
    ...printRowsFromMealBlock(
      'שבת בבוקר',
      pkg.shabbatDay as unknown as Record<string, string>,
      SHABBAT_DAY_RULES,
      dayTotals.regular,
      dayTotals.vegetarian,
      lookup
    )
  );

  const saladRegular = fridayTotals.regular + dayTotals.regular;
  const saladVegetarian = fridayTotals.vegetarian + dayTotals.vegetarian;
  for (let i = 0; i < pkg.shabbatSalads.length; i++) {
    const dish = (pkg.shabbatSalads[i] || '').trim();
    if (!dish) continue;
    const row = printRowFromField(
      'סלטי שבת',
      `סלט ${i + 1}`,
      dish,
      'saladFruit',
      'saladDouble',
      saladRegular,
      saladVegetarian,
      lookup
    );
    if (row) rows.push(row);
  }

  const hasSeuda = orders.some((o) => o.shabbatOrder?.wantsSeudaShlishit);
  if (hasSeuda) {
    rows.push(
      ...printRowsFromMealBlock(
        'סעודה שלישית',
        pkg.seudaShlishit as unknown as Record<string, string>,
        SEUDA_RULES,
        seudaTotals.regular,
        seudaTotals.vegetarian,
        lookup
      )
    );
  }

  return rows;
}
