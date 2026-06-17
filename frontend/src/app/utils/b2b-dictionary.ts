import type { MenuCategoryKey } from './menu-structure';

export const B2B_DICTIONARY_CATEGORIES = [
  { value: 'mainMeat', label: 'עיקרית בשרית' },
  { value: 'vegetarianMain', label: 'מנה צמחונית' },
  { value: 'carb', label: 'פחמימה' },
  { value: 'side', label: 'תוספת' },
  { value: 'saladFruit', label: 'סלט / פרי' },
  { value: 'fish', label: 'דג' }
] as const;

export type B2BDictionaryCategory = (typeof B2B_DICTIONARY_CATEGORIES)[number]['value'];

export interface B2BMenuItem {
  id: string;
  name: string;
  category: B2BDictionaryCategory;
  gramsPerPortion: number;
  portionsPerGastronorm: number;
  isActive: boolean;
}

/** Map weekly menu category key (or Shabbat field) to dictionary category. */
export function dictionaryCategoryForMenuKey(
  menuKey: MenuCategoryKey | 'fish' | 'carb' | 'protein'
): B2BDictionaryCategory {
  if (menuKey === 'carb1' || menuKey === 'carb2' || menuKey === 'carb') return 'carb';
  if (menuKey === 'protein') return 'side';
  if (menuKey === 'fish') return 'fish';
  return menuKey as B2BDictionaryCategory;
}

export function dictionaryCategoryLabel(category: B2BDictionaryCategory): string {
  return B2B_DICTIONARY_CATEGORIES.find((c) => c.value === category)?.label || category;
}
