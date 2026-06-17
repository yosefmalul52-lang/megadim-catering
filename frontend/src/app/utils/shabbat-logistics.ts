import type {
  InstitutionMenuContent,
  ShabbatOrder,
  ShabbatPackage,
  FridayNightMeals,
  ShabbatDayMeals,
  SeudaShlishitMeals
} from './menu-structure';
import {
  buildCategoryLogisticsLine,
  type CategoryLogisticsDisplayLine,
  type DishLogisticsLookup
} from './kitchen-logistics';
import type { MenuCategoryKey } from './menu-structure';

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

function logisticsKeyForShabbatField(fieldKey: string): MenuCategoryKey | 'fish' {
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
    key === 'fish' ? 'side' : key,
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

  const totals = aggregateShabbatKitchenTotals(orders);
  const lines: CategoryLogisticsDisplayLine[] = [];

  lines.push(
    ...linesFromMealBlock(
      'ערב שבת',
      pkg.fridayNight as unknown as Record<string, string>,
      FRIDAY_NIGHT_RULES,
      totals.regular,
      totals.vegetarian,
      lookup
    )
  );

  lines.push(
    ...linesFromMealBlock(
      'שבת בוקר',
      pkg.shabbatDay as unknown as Record<string, string>,
      SHABBAT_DAY_RULES,
      totals.regular,
      totals.vegetarian,
      lookup
    )
  );

  for (let i = 0; i < pkg.shabbatSalads.length; i++) {
    const dish = (pkg.shabbatSalads[i] || '').trim();
    if (!dish) continue;
    const portions = portionsByRule('saladDouble', totals.regular, totals.vegetarian);
    const line = buildLine('סלטי שבת', `סלט ${i + 1}`, dish, portions, 'saladFruit', lookup(dish, 'saladFruit'));
    if (line) lines.push(line);
  }

  let seudaRegular = 0;
  let seudaVegetarian = 0;
  for (const order of orders) {
    const s = order.shabbatOrder;
    if (!s?.wantsSeudaShlishit) continue;
    seudaRegular += safeCount(s.regularCount);
    seudaVegetarian += safeCount(s.vegetarianCount);
  }

  lines.push(
    ...linesFromMealBlock(
      'סעודה שלישית',
      pkg.seudaShlishit as unknown as Record<string, string>,
      SEUDA_RULES,
      seudaRegular,
      seudaVegetarian,
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

  const regular = safeCount(shabbatOrder.regularCount);
  const vegetarian = safeCount(shabbatOrder.vegetarianCount);
  const lines: CategoryLogisticsDisplayLine[] = [];

  lines.push(
    ...linesFromMealBlock(
      'ערב שבת',
      pkg.fridayNight as unknown as Record<string, string>,
      FRIDAY_NIGHT_RULES,
      regular,
      vegetarian,
      lookup
    )
  );

  lines.push(
    ...linesFromMealBlock(
      'שבת בוקר',
      pkg.shabbatDay as unknown as Record<string, string>,
      SHABBAT_DAY_RULES,
      regular,
      vegetarian,
      lookup
    )
  );

  for (let i = 0; i < pkg.shabbatSalads.length; i++) {
    const dish = (pkg.shabbatSalads[i] || '').trim();
    if (!dish) continue;
    const portions = portionsByRule('saladDouble', regular, vegetarian);
    const line = buildLine('סלטי שבת', `סלט ${i + 1}`, dish, portions, 'saladFruit', lookup(dish, 'saladFruit'));
    if (line) lines.push(line);
  }

  if (shabbatOrder.wantsSeudaShlishit) {
    lines.push(
      ...linesFromMealBlock(
        'סעודה שלישית',
        pkg.seudaShlishit as unknown as Record<string, string>,
        SEUDA_RULES,
        regular,
        vegetarian,
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
