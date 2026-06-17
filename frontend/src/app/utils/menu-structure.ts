/** Mirrors backend menu-structure.ts */

export const MENU_DAY_FIELDS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday'
] as const;

export type MenuDayField = (typeof MENU_DAY_FIELDS)[number];

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

export function isMenuDayPublished(day: MenuDayItems): boolean {
  return MENU_CATEGORIES.some((c) => (day[c.key] || '').trim().length > 0);
}

export function isMenuWeekPublished(menu: Partial<MenuWeek> | null | undefined): boolean {
  if (!menu) return false;
  return MENU_DAY_FIELDS.some((key) => isMenuDayPublished(menu[key] || emptyMenuDayItems()));
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

export const MENU_DAY_FORM_FIELDS: { key: MenuDayField; label: string; dayOfWeek: number }[] = [
  { key: 'sunday', label: 'יום ראשון', dayOfWeek: 0 },
  { key: 'monday', label: 'יום שני', dayOfWeek: 1 },
  { key: 'tuesday', label: 'יום שלישי', dayOfWeek: 2 },
  { key: 'wednesday', label: 'יום רביעי', dayOfWeek: 3 },
  { key: 'thursday', label: 'יום חמישי', dayOfWeek: 4 },
  { key: 'friday', label: 'יום שישי', dayOfWeek: 5 },
  { key: 'saturday', label: 'שבת', dayOfWeek: 6 }
];
