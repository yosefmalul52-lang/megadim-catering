/**
 * Expand institution portion counts into real menu dish lines for kitchen report.
 * Mirrors /admin/institutions production portion rules (mainMeat=regular only, etc.).
 */

import {
  MENU_CATEGORIES,
  MENU_DAY_FIELDS,
  type MenuCategoryKey,
  type MenuDayItems,
  type ShabbatPackage
} from './menu-structure';

export type InstitutionKitchenItem = {
  name: string;
  quantity: number;
  category: string;
  menuCategoryKey?: string;
};

export function portionsForInstitutionMenuCategory(
  menuCategoryKey: MenuCategoryKey | string,
  regularCount: number,
  vegetarianCount: number
): number {
  const regular = Math.max(0, Number(regularCount) || 0);
  const vegetarian = Math.max(0, Number(vegetarianCount) || 0);
  if (menuCategoryKey === 'mainMeat') return regular;
  if (menuCategoryKey === 'vegetarianMain') return vegetarian;
  return regular + vegetarian;
}

function pushDish(
  out: InstitutionKitchenItem[],
  dish: unknown,
  quantity: number,
  categoryLabel: string,
  menuCategoryKey?: string
): void {
  const name = String(dish || '').trim();
  if (!name || quantity <= 0) return;
  out.push({
    name,
    quantity,
    category: categoryLabel || 'מוסדות',
    menuCategoryKey
  });
}

/** Weekday Sun–Thu: one kitchen line per filled menu category. */
export function buildInstitutionWeekdayKitchenItems(
  dayMenu: MenuDayItems | Record<string, string> | null | undefined,
  regularCount: number,
  vegetarianCount: number
): InstitutionKitchenItem[] {
  const out: InstitutionKitchenItem[] = [];
  if (!dayMenu) return out;
  for (const c of MENU_CATEGORIES) {
    const portions = portionsForInstitutionMenuCategory(c.key, regularCount, vegetarianCount);
    if (c.key === 'vegetarianMain' && portions <= 0) continue;
    pushDish(out, (dayMenu as any)[c.key], portions, c.label, c.key);
  }
  return out;
}

type ShabbatRule = 'regular' | 'vegetarian' | 'both' | 'saladDouble';

function portionsByShabbatRule(
  rule: ShabbatRule,
  regularCount: number,
  vegetarianCount: number
): number {
  const regular = Math.max(0, Number(regularCount) || 0);
  const vegetarian = Math.max(0, Number(vegetarianCount) || 0);
  if (rule === 'regular') return regular;
  if (rule === 'vegetarian') return vegetarian;
  if (rule === 'saladDouble') return (regular + vegetarian) * 2;
  return regular + vegetarian;
}

function mealCounts(
  shabbatOrder: any,
  meal: 'fridayNight' | 'shabbatDay' | 'seudaShlishit'
): { regular: number; vegetarian: number } {
  const regular = Math.max(0, Number(shabbatOrder?.regularCount) || 0);
  const vegetarian = Math.max(0, Number(shabbatOrder?.vegetarianCount) || 0);
  const mp = shabbatOrder?.mealPortions?.[meal];
  if (mp && (mp.regularCount != null || mp.vegetarianCount != null)) {
    return {
      regular: Math.max(0, Number(mp.regularCount) || 0),
      vegetarian: Math.max(0, Number(mp.vegetarianCount) || 0)
    };
  }
  if (meal === 'seudaShlishit' && !shabbatOrder?.wantsSeudaShlishit) {
    return { regular: 0, vegetarian: 0 };
  }
  return { regular, vegetarian };
}

/** Fri/Sat: expand shared Shabbat package dishes for this institution's counts. */
export function buildInstitutionShabbatKitchenItems(
  pkg: ShabbatPackage | null | undefined,
  shabbatOrder: any
): InstitutionKitchenItem[] {
  const out: InstitutionKitchenItem[] = [];
  if (!pkg?.hasShabbat) return out;

  const friday = mealCounts(shabbatOrder, 'fridayNight');
  const day = mealCounts(shabbatOrder, 'shabbatDay');
  const seuda = mealCounts(shabbatOrder, 'seudaShlishit');

  const fridayFields: Array<{ key: string; label: string; rule: ShabbatRule }> = [
    { key: 'fish', label: 'דג — ערב שבת', rule: 'both' },
    { key: 'mainMeat', label: 'עיקרית בשרית — ערב שבת', rule: 'regular' },
    { key: 'vegetarianMain', label: 'עיקרית צמחונית — ערב שבת', rule: 'vegetarian' },
    { key: 'carb1', label: 'פחמימה 1 — ערב שבת', rule: 'both' },
    { key: 'carb2', label: 'פחמימה 2 — ערב שבת', rule: 'both' },
    { key: 'side', label: 'תוספת — ערב שבת', rule: 'both' }
  ];
  for (const f of fridayFields) {
    pushDish(
      out,
      (pkg.fridayNight as any)?.[f.key],
      portionsByShabbatRule(f.rule, friday.regular, friday.vegetarian),
      f.label,
      f.key
    );
  }

  const dayFields: Array<{ key: string; label: string; rule: ShabbatRule }> = [
    { key: 'mainMeat', label: 'עיקרית בשרית — שבת בבוקר', rule: 'regular' },
    { key: 'vegetarianMain', label: 'עיקרית צמחונית — שבת בבוקר', rule: 'vegetarian' },
    { key: 'carb1', label: 'פחמימה 1 — שבת בבוקר', rule: 'both' },
    { key: 'carb2', label: 'פחמימה 2 — שבת בבוקר', rule: 'both' },
    { key: 'side', label: 'תוספת — שבת בבוקר', rule: 'both' }
  ];
  for (const f of dayFields) {
    pushDish(
      out,
      (pkg.shabbatDay as any)?.[f.key],
      portionsByShabbatRule(f.rule, day.regular, day.vegetarian),
      f.label,
      f.key
    );
  }

  const salads = Array.isArray(pkg.shabbatSalads) ? pkg.shabbatSalads : [];
  const saladQty = portionsByShabbatRule(
    'saladDouble',
    friday.regular + day.regular,
    friday.vegetarian + day.vegetarian
  );
  salads.forEach((dish, i) => {
    pushDish(out, dish, saladQty, `סלט שבת ${i + 1}`, 'saladFruit');
  });

  if (shabbatOrder?.wantsSeudaShlishit) {
    pushDish(
      out,
      pkg.seudaShlishit?.carb,
      portionsByShabbatRule('both', seuda.regular, seuda.vegetarian),
      'פחמימה — סעודה שלישית',
      'carb'
    );
    pushDish(
      out,
      pkg.seudaShlishit?.protein,
      portionsByShabbatRule('both', seuda.regular, seuda.vegetarian),
      'חלבון — סעודה שלישית',
      'protein'
    );
  }

  const extras = shabbatOrder?.extras || {};
  const challahs = Math.max(0, Number(extras.challahs) || 0);
  const rolls = Math.max(0, Number(extras.rolls) || 0);
  const grapeJuice = Math.max(0, Number(extras.grapeJuice) || 0);
  if (challahs > 0) pushDish(out, 'חלות', challahs, 'תוספות שבת');
  if (rolls > 0) pushDish(out, 'לחמניות', rolls, 'תוספות שבת');
  if (grapeJuice > 0) pushDish(out, 'מיץ ענבים', grapeJuice, 'תוספות שבת');

  return out;
}

/** Fallback when week menu is missing/empty — keep generic portion labels. */
export function buildInstitutionGenericKitchenItems(
  regularCount: number,
  vegetarianCount: number,
  mode: 'weekday' | 'shabbat'
): InstitutionKitchenItem[] {
  const out: InstitutionKitchenItem[] = [];
  const regular = Math.max(0, Number(regularCount) || 0);
  const vegetarian = Math.max(0, Number(vegetarianCount) || 0);
  if (mode === 'weekday') {
    if (regular > 0) out.push({ name: 'מנה רגילה (מוסד)', quantity: regular, category: 'מוסדות' });
    if (vegetarian > 0) {
      out.push({ name: 'מנה צמחונית (מוסד)', quantity: vegetarian, category: 'מוסדות' });
    }
  } else {
    if (regular > 0) {
      out.push({ name: 'חבילת שבת רגילה (מוסד)', quantity: regular, category: 'מוסדות' });
    }
    if (vegetarian > 0) {
      out.push({ name: 'חבילת שבת צמחונית (מוסד)', quantity: vegetarian, category: 'מוסדות' });
    }
  }
  return out;
}

export function menuDayFieldForDow(dow: number): (typeof MENU_DAY_FIELDS)[number] | null {
  if (dow < 0 || dow > 4) return null;
  return MENU_DAY_FIELDS[dow] || null;
}
