import { MENU_DAY_FIELDS, type MenuDayField } from './portal-week';

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

export type MenuWeek = Record<MenuDayField, MenuDayItems>;

export function emptyMenuDayItems(): MenuDayItems {
  return { mainMeat: '', vegetarianMain: '', carb1: '', carb2: '', side: '', saladFruit: '' };
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
  return MENU_DAY_FIELDS.reduce((acc, key) => {
    acc[key] = emptyMenuDayItems();
    return acc;
  }, {} as MenuWeek);
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
    mainMeat: String(row.mainMeat ?? '').trim(),
    vegetarianMain: String(row.vegetarianMain ?? '').trim(),
    carb1: String(row.carb1 ?? '').trim(),
    carb2: String(row.carb2 ?? '').trim(),
    side: String(row.side ?? '').trim(),
    saladFruit: String(row.saladFruit ?? '').trim()
  };
}

/** Normalize category notes — supports legacy single `notes` on order day. */
export function normalizeCategoryNotes(raw: unknown, legacyNotes?: string): CategoryNotes {
  if (raw && typeof raw === 'object') {
    const row = raw as Record<string, unknown>;
    return {
      mainMeatNote: String(row.mainMeatNote ?? '').trim(),
      vegetarianMainNote: String(row.vegetarianMainNote ?? '').trim(),
      carb1Note: String(row.carb1Note ?? '').trim(),
      carb2Note: String(row.carb2Note ?? '').trim(),
      sideNote: String(row.sideNote ?? '').trim(),
      saladFruitNote: String(row.saladFruitNote ?? '').trim()
    };
  }
  const legacy = String(legacyNotes ?? raw ?? '').trim();
  return legacy ? { ...emptyCategoryNotes(), mainMeatNote: legacy } : emptyCategoryNotes();
}

export function normalizeMenuWeek(raw: unknown): MenuWeek {
  const base = emptyMenuWeek();
  if (!raw || typeof raw !== 'object') {
    return base;
  }
  const source = raw as Record<string, unknown>;
  for (const dayKey of MENU_DAY_FIELDS) {
    if (dayKey in source) {
      base[dayKey] = normalizeMenuDayItems(source[dayKey]);
    }
  }
  return base;
}

export function isMenuDayPublished(day: MenuDayItems): boolean {
  return MENU_CATEGORIES.some((c) => day[c.key].length > 0);
}

export function isMenuWeekPublished(menu: Partial<MenuWeek> | null | undefined): boolean {
  if (!menu) return false;
  return MENU_DAY_FIELDS.some((key) => isMenuDayPublished(normalizeMenuDayItems(menu[key])));
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
