/** Mirrors backend menu-structure.ts (weekdays + Shabbat package). */

export const MENU_WEEKDAY_FIELDS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday'
] as const;

export type MenuWeekdayField = (typeof MENU_WEEKDAY_FIELDS)[number];

/** @deprecated Use MENU_WEEKDAY_FIELDS */
export const MENU_DAY_FIELDS = MENU_WEEKDAY_FIELDS;

/** @deprecated Use MenuWeekdayField */
export type MenuDayField = MenuWeekdayField;

export const SHABBAT_SALAD_SLOTS = 6;

export const MENU_CATEGORIES = [
  { key: 'mainMeat', label: 'עיקרית בשרית', noteKey: 'mainMeatNote' },
  { key: 'vegetarianMain', label: 'מנה עיקרית צמחונית', noteKey: 'vegetarianMainNote' },
  { key: 'carb1', label: 'פחמימה 1', noteKey: 'carb1Note' },
  { key: 'carb2', label: 'פחמימה 2', noteKey: 'carb2Note' },
  { key: 'side', label: 'תוספת', noteKey: 'sideNote' },
  { key: 'saladFruit', label: 'סלט / פרי', noteKey: 'saladFruitNote' }
] as const;

export type MenuCategoryKey = (typeof MENU_CATEGORIES)[number]['key'];
export type CategoryNoteKey = (typeof MENU_CATEGORIES)[number]['noteKey'];

export interface MenuDayItems {
  mainMeat: string;
  vegetarianMain: string;
  carb1: string;
  carb2: string;
  side: string;
  saladFruit: string;
}

export interface CategoryNotes {
  mainMeatNote: string;
  vegetarianMainNote: string;
  carb1Note: string;
  carb2Note: string;
  sideNote: string;
  saladFruitNote: string;
}

export type MenuWeek = Record<MenuWeekdayField, MenuDayItems>;

export interface FridayNightMeals {
  fish: string;
  mainMeat: string;
  vegetarianMain: string;
  carb1: string;
  carb2: string;
  side: string;
}

export interface ShabbatDayMeals {
  mainMeat: string;
  vegetarianMain: string;
  carb1: string;
  carb2: string;
  side: string;
}

export interface SeudaShlishitMeals {
  carb: string;
  protein: string;
}

export interface ShabbatPackage {
  hasShabbat: boolean;
  fridayNight: FridayNightMeals;
  shabbatDay: ShabbatDayMeals;
  seudaShlishit: SeudaShlishitMeals;
  shabbatSalads: string[];
}

export interface InstitutionMenuContent extends MenuWeek {
  shabbatPackage: ShabbatPackage;
}

export interface ShabbatOrderExtras {
  challahs: number;
  rolls: number;
  grapeJuice: number;
}

export interface ShabbatMealPortionCounts {
  regularCount: number;
  vegetarianCount: number;
}

export interface ShabbatMealPortions {
  fridayNight: ShabbatMealPortionCounts;
  shabbatDay: ShabbatMealPortionCounts;
  seudaShlishit?: ShabbatMealPortionCounts;
}

export type ShabbatMealPortionKey = keyof Pick<ShabbatMealPortions, 'fridayNight' | 'shabbatDay' | 'seudaShlishit'>;

export interface ShabbatOrder {
  regularCount: number;
  vegetarianCount: number;
  wantsSeudaShlishit: boolean;
  extras: ShabbatOrderExtras;
  mealPortions?: ShabbatMealPortions;
  notes?: string;
}

export const ORDER_NOTES_MAX_LENGTH = 1000;

export function normalizeOptionalNotes(raw: unknown, maxLen = ORDER_NOTES_MAX_LENGTH): string {
  if (raw === undefined || raw === null) return '';
  return String(raw).trim().slice(0, maxLen);
}

export const MENU_WEEKDAY_FORM_FIELDS: { key: MenuWeekdayField; label: string; dayOfWeek: number }[] = [
  { key: 'sunday', label: 'יום ראשון', dayOfWeek: 0 },
  { key: 'monday', label: 'יום שני', dayOfWeek: 1 },
  { key: 'tuesday', label: 'יום שלישי', dayOfWeek: 2 },
  { key: 'wednesday', label: 'יום רביעי', dayOfWeek: 3 },
  { key: 'thursday', label: 'יום חמישי', dayOfWeek: 4 }
];

/** @deprecated Use MENU_WEEKDAY_FORM_FIELDS */
export const MENU_DAY_FORM_FIELDS = MENU_WEEKDAY_FORM_FIELDS;

export const FRIDAY_NIGHT_MENU_FIELDS = [
  { key: 'fish', label: 'דג' },
  { key: 'mainMeat', label: 'עיקרית בשרית' },
  { key: 'vegetarianMain', label: 'מנה עיקרית צמחונית' },
  { key: 'carb1', label: 'פחמימה 1' },
  { key: 'carb2', label: 'פחמימה 2' },
  { key: 'side', label: 'תוספת' }
] as const;

export const SHABBAT_DAY_MENU_FIELDS = [
  { key: 'mainMeat', label: 'עיקרית בשרית' },
  { key: 'vegetarianMain', label: 'מנה עיקרית צמחונית' },
  { key: 'carb1', label: 'פחמימה 1' },
  { key: 'carb2', label: 'פחמימה 2' },
  { key: 'side', label: 'תוספת' }
] as const;

export const SEUDA_SHLISHIT_MENU_FIELDS = [
  { key: 'carb', label: 'פחמימה (למשל בורקס)' },
  { key: 'protein', label: 'חלבון (למשל ביצה / טונה)' }
] as const;

export function emptyMenuDayItems(): MenuDayItems {
  return { mainMeat: '', vegetarianMain: '', carb1: '', carb2: '', side: '', saladFruit: '' };
}

export function emptyFridayNightMeals(): FridayNightMeals {
  return { fish: '', mainMeat: '', vegetarianMain: '', carb1: '', carb2: '', side: '' };
}

export function emptyShabbatDayMeals(): ShabbatDayMeals {
  return { mainMeat: '', vegetarianMain: '', carb1: '', carb2: '', side: '' };
}

export function emptySeudaShlishitMeals(): SeudaShlishitMeals {
  return { carb: '', protein: '' };
}

export function emptyShabbatSalads(): string[] {
  return Array.from({ length: SHABBAT_SALAD_SLOTS }, () => '');
}

export function emptyShabbatPackage(): ShabbatPackage {
  return {
    hasShabbat: true,
    fridayNight: emptyFridayNightMeals(),
    shabbatDay: emptyShabbatDayMeals(),
    seudaShlishit: emptySeudaShlishitMeals(),
    shabbatSalads: emptyShabbatSalads()
  };
}

export function emptyMenuWeek(): MenuWeek {
  return MENU_WEEKDAY_FIELDS.reduce((acc, key) => {
    acc[key] = emptyMenuDayItems();
    return acc;
  }, {} as MenuWeek);
}

export function emptyInstitutionMenuContent(): InstitutionMenuContent {
  return { ...emptyMenuWeek(), shabbatPackage: emptyShabbatPackage() };
}

export function emptyMealPortionCounts(): ShabbatMealPortionCounts {
  return { regularCount: 0, vegetarianCount: 0 };
}

export function emptyMealPortions(): ShabbatMealPortions {
  return {
    fridayNight: emptyMealPortionCounts(),
    shabbatDay: emptyMealPortionCounts()
  };
}

export function emptyShabbatOrder(): ShabbatOrder {
  return {
    regularCount: 0,
    vegetarianCount: 0,
    wantsSeudaShlishit: false,
    extras: { challahs: 0, rolls: 0, grapeJuice: 0 }
  };
}

function safePortionCount(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : 0;
}

export function normalizeMealPortionCounts(raw: unknown): ShabbatMealPortionCounts {
  if (!raw || typeof raw !== 'object') {
    return emptyMealPortionCounts();
  }
  const row = raw as Record<string, unknown>;
  return {
    regularCount: safePortionCount(row.regularCount),
    vegetarianCount: safePortionCount(row.vegetarianCount)
  };
}

export function hasStoredMealPortions(order: ShabbatOrder): boolean {
  return !!order.mealPortions?.fridayNight && !!order.mealPortions?.shabbatDay;
}

export function resolveShabbatMealCounts(
  order: ShabbatOrder,
  meal: ShabbatMealPortionKey
): ShabbatMealPortionCounts {
  const legacy = {
    regularCount: safePortionCount(order.regularCount),
    vegetarianCount: safePortionCount(order.vegetarianCount)
  };

  if (meal === 'seudaShlishit') {
    if (!order.wantsSeudaShlishit) {
      return emptyMealPortionCounts();
    }
    if (!hasStoredMealPortions(order)) {
      return legacy;
    }
    return order.mealPortions?.seudaShlishit
      ? normalizeMealPortionCounts(order.mealPortions.seudaShlishit)
      : emptyMealPortionCounts();
  }

  if (!hasStoredMealPortions(order)) {
    return legacy;
  }

  const block = meal === 'fridayNight' ? order.mealPortions!.fridayNight : order.mealPortions!.shabbatDay;
  return normalizeMealPortionCounts(block);
}

export function sumMealPortions(portions: ShabbatMealPortions, includeSeuda: boolean): ShabbatMealPortionCounts {
  let regularCount = safePortionCount(portions.fridayNight.regularCount) + safePortionCount(portions.shabbatDay.regularCount);
  let vegetarianCount =
    safePortionCount(portions.fridayNight.vegetarianCount) + safePortionCount(portions.shabbatDay.vegetarianCount);
  if (includeSeuda && portions.seudaShlishit) {
    regularCount += safePortionCount(portions.seudaShlishit.regularCount);
    vegetarianCount += safePortionCount(portions.seudaShlishit.vegetarianCount);
  }
  return { regularCount, vegetarianCount };
}

export function totalShabbatPortionCount(order: ShabbatOrder): number {
  if (hasStoredMealPortions(order)) {
    const mp = order.mealPortions!;
    let total =
      safePortionCount(mp.fridayNight.regularCount) +
      safePortionCount(mp.fridayNight.vegetarianCount) +
      safePortionCount(mp.shabbatDay.regularCount) +
      safePortionCount(mp.shabbatDay.vegetarianCount);
    if (order.wantsSeudaShlishit && mp.seudaShlishit) {
      total += safePortionCount(mp.seudaShlishit.regularCount) + safePortionCount(mp.seudaShlishit.vegetarianCount);
    }
    return total;
  }
  return safePortionCount(order.regularCount) + safePortionCount(order.vegetarianCount);
}

export function mealPortionsForForm(order: ShabbatOrder): ShabbatMealPortions {
  if (hasStoredMealPortions(order)) {
    const mp = order.mealPortions!;
    const result: ShabbatMealPortions = {
      fridayNight: normalizeMealPortionCounts(mp.fridayNight),
      shabbatDay: normalizeMealPortionCounts(mp.shabbatDay)
    };
    if (order.wantsSeudaShlishit) {
      result.seudaShlishit = mp.seudaShlishit
        ? normalizeMealPortionCounts(mp.seudaShlishit)
        : emptyMealPortionCounts();
    }
    return result;
  }

  const result: ShabbatMealPortions = {
    fridayNight: emptyMealPortionCounts(),
    shabbatDay: emptyMealPortionCounts()
  };
  if (order.wantsSeudaShlishit) {
    result.seudaShlishit = emptyMealPortionCounts();
  }
  return result;
}

export function isLegacyShabbatOrderWithoutMealPortions(order: ShabbatOrder): boolean {
  if (hasStoredMealPortions(order)) return false;
  return safePortionCount(order.regularCount) + safePortionCount(order.vegetarianCount) > 0;
}

export function formatLegacyShabbatOrderSummary(order: ShabbatOrder): string {
  if (!isLegacyShabbatOrderWithoutMealPortions(order)) return '';
  const regular = safePortionCount(order.regularCount);
  const vegetarian = safePortionCount(order.vegetarianCount);
  return `הזמנה ישנה ללא פיצול סעודות: רגיל ${regular}, צמחוני ${vegetarian}. יש להזין כמויות לכל סעודה לפני שמירה.`;
}

export function formatShabbatPortionsSummary(order: ShabbatOrder): string {
  if (!hasStoredMealPortions(order)) {
    return order.wantsSeudaShlishit ? 'כולל סעודה שלישית' : '';
  }
  const parts: string[] = [];
  const fn = resolveShabbatMealCounts(order, 'fridayNight');
  parts.push(`ערב שבת: רגיל ${fn.regularCount}, צמחוני ${fn.vegetarianCount}`);
  const sd = resolveShabbatMealCounts(order, 'shabbatDay');
  parts.push(`שבת בבוקר: רגיל ${sd.regularCount}, צמחוני ${sd.vegetarianCount}`);
  if (order.wantsSeudaShlishit) {
    const seuda = resolveShabbatMealCounts(order, 'seudaShlishit');
    parts.push(`סעודה שלישית: רגיל ${seuda.regularCount}, צמחוני ${seuda.vegetarianCount}`);
  }
  return parts.join(' · ');
}

export function emptyCategoryNotes(): CategoryNotes {
  return {
    mainMeatNote: '',
    vegetarianMainNote: '',
    carb1Note: '',
    carb2Note: '',
    sideNote: '',
    saladFruitNote: ''
  };
}

export function isMenuDayPublished(day: MenuDayItems): boolean {
  return MENU_CATEGORIES.some((c) => (day[c.key] || '').trim().length > 0);
}

function mealBlockHasContent(values: object): boolean {
  return Object.values(values as Record<string, string>).some((v) => String(v ?? '').trim().length > 0);
}

export function isShabbatPackagePublished(pkg: ShabbatPackage): boolean {
  if (!pkg.hasShabbat) return false;
  if (mealBlockHasContent(pkg.fridayNight)) return true;
  if (mealBlockHasContent(pkg.shabbatDay)) return true;
  if (mealBlockHasContent(pkg.seudaShlishit)) return true;
  return pkg.shabbatSalads.some((s) => s.trim().length > 0);
}

export function isMenuWeekPublished(menu: Partial<InstitutionMenuContent> | null | undefined): boolean {
  if (!menu) return false;
  const weekdaysPublished = MENU_WEEKDAY_FIELDS.some((key) =>
    isMenuDayPublished(menu[key] || emptyMenuDayItems())
  );
  return weekdaysPublished || isShabbatPackagePublished(menu.shabbatPackage || emptyShabbatPackage());
}

export function formatMenuDaySummary(day: MenuDayItems): string {
  return MENU_CATEGORIES.filter((c) => c.key !== 'vegetarianMain')
    .map((c) => {
      const val = (day[c.key] || '').trim();
      return val ? `${c.label}: ${val}` : '';
    })
    .filter(Boolean)
    .join(' · ');
}

export function formatVegetarianMainLine(day: MenuDayItems): string {
  const val = (day.vegetarianMain || '').trim();
  return val ? `צמחוני: ${val}` : '';
}

export function formatCategoryWithNote(label: string, dish: string, note: string): string {
  const trimmed = (dish || '').trim();
  if (!trimmed) return '';
  const noteTrim = (note || '').trim();
  return noteTrim ? `${label}: ${trimmed} (הערת מוסד: ${noteTrim})` : `${label}: ${trimmed}`;
}

export function formatFridayNightSummary(meals: FridayNightMeals): string {
  return FRIDAY_NIGHT_MENU_FIELDS.map((f) => {
    const val = (meals[f.key as keyof FridayNightMeals] || '').trim();
    return val ? `${f.label}: ${val}` : '';
  })
    .filter(Boolean)
    .join(' · ');
}

export function formatShabbatDaySummary(meals: ShabbatDayMeals): string {
  return SHABBAT_DAY_MENU_FIELDS.map((f) => {
    const val = (meals[f.key as keyof ShabbatDayMeals] || '').trim();
    return val ? `${f.label}: ${val}` : '';
  })
    .filter(Boolean)
    .join(' · ');
}

export function formatShabbatSaladsSummary(salads: string[]): string {
  const filled = salads.map((s) => s.trim()).filter(Boolean);
  return filled.length ? `סלטים: ${filled.join(', ')}` : '';
}
