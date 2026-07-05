/** Shared B2B institution menu structure (weekdays + Shabbat package). */

export const MENU_WEEKDAY_FIELDS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday'
] as const;

export type MenuWeekdayField = (typeof MENU_WEEKDAY_FIELDS)[number];

/** @deprecated Use MENU_WEEKDAY_FIELDS — Sunday–Thursday only; Fri/Sat are shabbatPackage. */
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

/** Sunday–Thursday daily menu blocks. */
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
  /** Six saladFruit dictionary selections for the weekend. */
  shabbatSalads: string[];
}

/** Full institution menu content stored per week (weekdays + Shabbat package). */
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
  /** Institution notes for the Shabbat package (optional). */
  notes?: string;
}

export const ORDER_NOTES_MAX_LENGTH = 1000;

export function normalizeOptionalNotes(raw: unknown, maxLen = ORDER_NOTES_MAX_LENGTH): string {
  if (raw === undefined || raw === null) return '';
  return String(raw).trim().slice(0, maxLen);
}

function trimString(value: unknown): string {
  return String(value ?? '').trim();
}

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

export function emptyMenuWeek(): MenuWeek {
  return MENU_WEEKDAY_FIELDS.reduce((acc, key) => {
    acc[key] = emptyMenuDayItems();
    return acc;
  }, {} as MenuWeek);
}

export function emptyInstitutionMenuContent(): InstitutionMenuContent {
  return {
    ...emptyMenuWeek(),
    shabbatPackage: emptyShabbatPackage()
  };
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

export function normalizeMealPortions(raw: unknown): ShabbatMealPortions | undefined {
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }
  const row = raw as Record<string, unknown>;
  if (!row.fridayNight && !row.shabbatDay) {
    return undefined;
  }
  const portions: ShabbatMealPortions = {
    fridayNight: normalizeMealPortionCounts(row.fridayNight),
    shabbatDay: normalizeMealPortionCounts(row.shabbatDay)
  };
  if (row.seudaShlishit !== undefined && row.seudaShlishit !== null) {
    portions.seudaShlishit = normalizeMealPortionCounts(row.seudaShlishit);
  }
  return portions;
}

/** True when persisted order includes per-meal portion breakdown. */
export function hasStoredMealPortions(order: ShabbatOrder): boolean {
  return !!order.mealPortions?.fridayNight && !!order.mealPortions?.shabbatDay;
}

/** Per-meal counts; falls back to legacy regularCount/vegetarianCount when mealPortions absent. */
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

/** Form defaults: use stored mealPortions; legacy orders without split return empty per-meal fields. */
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

/** Normalize a single day's menu — supports legacy plain string. */
export function normalizeMenuDayItems(raw: unknown): MenuDayItems {
  if (typeof raw === 'string') {
    const text = raw.trim();
    return text ? { ...emptyMenuDayItems(), mainMeat: text } : emptyMenuDayItems();
  }
  if (!raw || typeof raw !== 'object') {
    return emptyMenuDayItems();
  }
  const row = raw as Record<string, unknown>;
  return {
    mainMeat: trimString(row.mainMeat),
    vegetarianMain: trimString(row.vegetarianMain),
    carb1: trimString(row.carb1),
    carb2: trimString(row.carb2),
    side: trimString(row.side),
    saladFruit: trimString(row.saladFruit)
  };
}

function normalizeMealStrings<T extends object>(
  raw: unknown,
  keys: readonly string[],
  empty: () => T
): T {
  const base = empty();
  if (!raw || typeof raw !== 'object') {
    return base;
  }
  const row = raw as Record<string, unknown>;
  const out: Record<string, string> = { ...(base as Record<string, string>) };
  for (const key of keys) {
    out[key] = trimString(row[key]);
  }
  return out as T;
}

export function normalizeFridayNightMeals(raw: unknown): FridayNightMeals {
  return normalizeMealStrings(
    raw,
    ['fish', 'mainMeat', 'vegetarianMain', 'carb1', 'carb2', 'side'],
    emptyFridayNightMeals
  );
}

export function normalizeShabbatDayMeals(raw: unknown): ShabbatDayMeals {
  return normalizeMealStrings(
    raw,
    ['mainMeat', 'vegetarianMain', 'carb1', 'carb2', 'side'],
    emptyShabbatDayMeals
  );
}

export function normalizeSeudaShlishitMeals(raw: unknown): SeudaShlishitMeals {
  return normalizeMealStrings(raw, ['carb', 'protein'], emptySeudaShlishitMeals);
}

export function normalizeShabbatSalads(raw: unknown): string[] {
  const slots = emptyShabbatSalads();
  if (!Array.isArray(raw)) {
    return slots;
  }
  for (let i = 0; i < SHABBAT_SALAD_SLOTS; i++) {
    slots[i] = trimString(raw[i]);
  }
  return slots;
}

export function normalizeShabbatPackage(raw: unknown): ShabbatPackage {
  if (!raw || typeof raw !== 'object') {
    return emptyShabbatPackage();
  }
  const row = raw as Record<string, unknown>;
  return {
    hasShabbat: row.hasShabbat !== false,
    fridayNight: normalizeFridayNightMeals(row.fridayNight),
    shabbatDay: normalizeShabbatDayMeals(row.shabbatDay),
    seudaShlishit: normalizeSeudaShlishitMeals(row.seudaShlishit),
    shabbatSalads: normalizeShabbatSalads(row.shabbatSalads)
  };
}

export function normalizeShabbatOrderExtras(raw: unknown): ShabbatOrderExtras {
  if (!raw || typeof raw !== 'object') {
    return { challahs: 0, rolls: 0, grapeJuice: 0 };
  }
  const row = raw as Record<string, unknown>;
  return {
    challahs: Math.max(0, Number(row.challahs) || 0),
    rolls: Math.max(0, Number(row.rolls) || 0),
    grapeJuice: Math.max(0, Number(row.grapeJuice) || 0)
  };
}

export function normalizeShabbatOrder(raw: unknown): ShabbatOrder {
  if (!raw || typeof raw !== 'object') {
    return emptyShabbatOrder();
  }
  const row = raw as Record<string, unknown>;
  const wantsSeudaShlishit = row.wantsSeudaShlishit === true;
  const mealPortions = normalizeMealPortions(row.mealPortions);
  const extras = normalizeShabbatOrderExtras(row.extras);

  if (mealPortions) {
    const legacy = sumMealPortions(mealPortions, wantsSeudaShlishit);
    const normalized: ShabbatOrder = {
      regularCount: legacy.regularCount,
      vegetarianCount: legacy.vegetarianCount,
      wantsSeudaShlishit,
      extras,
      notes: normalizeOptionalNotes(row.notes),
      mealPortions: {
        fridayNight: mealPortions.fridayNight,
        shabbatDay: mealPortions.shabbatDay
      }
    };
    if (wantsSeudaShlishit && mealPortions.seudaShlishit) {
      normalized.mealPortions!.seudaShlishit = mealPortions.seudaShlishit;
    }
    return normalized;
  }

  return {
    regularCount: safePortionCount(row.regularCount),
    vegetarianCount: safePortionCount(row.vegetarianCount),
    wantsSeudaShlishit,
    extras,
    notes: normalizeOptionalNotes(row.notes)
  };
}

/** Normalize category notes — supports legacy single `notes` on order day. */
export function normalizeCategoryNotes(raw: unknown, legacyNotes?: string): CategoryNotes {
  if (raw && typeof raw === 'object') {
    const row = raw as Record<string, unknown>;
    return {
      mainMeatNote: trimString(row.mainMeatNote),
      vegetarianMainNote: trimString(row.vegetarianMainNote),
      carb1Note: trimString(row.carb1Note),
      carb2Note: trimString(row.carb2Note),
      sideNote: trimString(row.sideNote),
      saladFruitNote: trimString(row.saladFruitNote)
    };
  }
  const legacy = trimString(legacyNotes ?? raw);
  return legacy ? { ...emptyCategoryNotes(), mainMeatNote: legacy } : emptyCategoryNotes();
}

export function normalizeMenuWeek(raw: unknown): MenuWeek {
  const base = emptyMenuWeek();
  if (!raw || typeof raw !== 'object') {
    return base;
  }
  const source = raw as Record<string, unknown>;
  for (const dayKey of MENU_WEEKDAY_FIELDS) {
    if (dayKey in source) {
      base[dayKey] = normalizeMenuDayItems(source[dayKey]);
    }
  }
  return base;
}

export function normalizeInstitutionMenuContent(raw: unknown): InstitutionMenuContent {
  const weekdays = normalizeMenuWeek(raw);
  let shabbatPackage = emptyShabbatPackage();

  if (raw && typeof raw === 'object') {
    const source = raw as Record<string, unknown>;
    if ('shabbatPackage' in source) {
      shabbatPackage = normalizeShabbatPackage(source.shabbatPackage);
    } else if (source.friday || source.saturday) {
      const friday = normalizeMenuDayItems(source.friday);
      const saturday = normalizeMenuDayItems(source.saturday);
      const salads = emptyShabbatSalads();
      if (friday.saladFruit) salads[0] = friday.saladFruit;
      if (saturday.saladFruit) salads[1] = saturday.saladFruit;
      shabbatPackage = normalizeShabbatPackage({
        hasShabbat: true,
        fridayNight: {
          fish: '',
          mainMeat: friday.mainMeat,
          vegetarianMain: friday.vegetarianMain,
          carb1: friday.carb1,
          carb2: friday.carb2,
          side: friday.side
        },
        shabbatDay: {
          mainMeat: saturday.mainMeat,
          vegetarianMain: saturday.vegetarianMain,
          carb1: saturday.carb1,
          carb2: saturday.carb2,
          side: saturday.side
        },
        seudaShlishit: emptySeudaShlishitMeals(),
        shabbatSalads: salads
      });
    }
  }

  return { ...weekdays, shabbatPackage };
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

export function isMenuDayPublished(day: MenuDayItems): boolean {
  return MENU_CATEGORIES.some((c) => day[c.key].length > 0);
}

export function isMenuWeekPublished(menu: Partial<InstitutionMenuContent> | null | undefined): boolean {
  if (!menu) return false;
  const normalized = normalizeInstitutionMenuContent(menu);
  const weekdaysPublished = MENU_WEEKDAY_FIELDS.some((key) =>
    isMenuDayPublished(normalizeMenuDayItems(normalized[key]))
  );
  return weekdaysPublished || isShabbatPackagePublished(normalized.shabbatPackage);
}

/** Compact summary for kitchen report row (excludes vegetarian main — use formatVegetarianMainLine). */
export function formatMenuDaySummary(day: MenuDayItems): string {
  return MENU_CATEGORIES.filter((c) => c.key !== 'vegetarianMain')
    .map((c) => {
      const val = day[c.key];
      return val ? `${c.label}: ${val}` : '';
    })
    .filter(Boolean)
    .join(' · ');
}

export function formatVegetarianMainLine(day: MenuDayItems): string {
  const val = day.vegetarianMain.trim();
  return val ? `צמחוני: ${val}` : '';
}

export function formatCategoryWithNote(label: string, dish: string, note: string): string {
  const trimmed = dish.trim();
  if (!trimmed) return '';
  const noteTrim = note.trim();
  return noteTrim ? `${label}: ${trimmed} (הערת מוסד: ${noteTrim})` : `${label}: ${trimmed}`;
}
