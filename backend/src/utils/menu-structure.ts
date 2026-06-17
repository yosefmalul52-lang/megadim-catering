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

export interface ShabbatOrder {
  regularCount: number;
  vegetarianCount: number;
  wantsSeudaShlishit: boolean;
  extras: ShabbatOrderExtras;
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

export function emptyShabbatOrder(): ShabbatOrder {
  return {
    regularCount: 0,
    vegetarianCount: 0,
    wantsSeudaShlishit: false,
    extras: { challahs: 0, rolls: 0, grapeJuice: 0 }
  };
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
  return {
    regularCount: Math.max(0, Number(row.regularCount) || 0),
    vegetarianCount: Math.max(0, Number(row.vegetarianCount) || 0),
    wantsSeudaShlishit: row.wantsSeudaShlishit === true,
    extras: normalizeShabbatOrderExtras(row.extras)
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
