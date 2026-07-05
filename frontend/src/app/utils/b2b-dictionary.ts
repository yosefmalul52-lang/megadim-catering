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

/** Meat mains: kitchen reports show total kg from grams-per-portion. */
export function isMeatKgCategory(category: B2BDictionaryCategory): boolean {
  return category === 'mainMeat';
}

/** Fish and vegetarian mains: counted as discrete units, not gastronorms. */
export function isUnitCountCategory(category: B2BDictionaryCategory): boolean {
  return category === 'fish' || category === 'vegetarianMain';
}

/** Carbs, sides, salads: kitchen reports convert portions → gastronorms. */
export function isGastronormCategory(category: B2BDictionaryCategory): boolean {
  return !isMeatKgCategory(category) && !isUnitCountCategory(category);
}

export function dictionaryCategoryLabel(category: B2BDictionaryCategory): string {
  return B2B_DICTIONARY_CATEGORIES.find((c) => c.value === category)?.label || category;
}

export const B2B_REPORT_UNITS = [
  'portion',
  'unit',
  'kg',
  'gram',
  'liter',
  'ml',
  'tray',
  'pan',
  'box',
  'package'
] as const;
export type B2BReportUnit = (typeof B2B_REPORT_UNITS)[number];

export const B2B_CALCULATION_METHODS = [
  'per_portion',
  'fixed_per_order',
  'per_x_portions',
  'manual'
] as const;
export type B2BCalculationMethod = (typeof B2B_CALCULATION_METHODS)[number];

export const B2B_ROUNDING_MODES = ['none', 'ceil', 'floor', 'round'] as const;
export type B2BRoundingMode = (typeof B2B_ROUNDING_MODES)[number];

export interface B2BCalculationSettings {
  enabled: boolean;
  reportUnit: B2BReportUnit;
  calculationMethod: B2BCalculationMethod;
  quantityPerPortion?: number;
  quantityPerOrder?: number;
  quantityPerXPortions?: number;
  xPortions?: number;
  rounding?: B2BRoundingMode;
  minimumQuantity?: number;
}

export interface B2BMenuItem {
  id: string;
  name: string;
  category: B2BDictionaryCategory;
  gramsPerPortion: number;
  portionsPerGastronorm: number;
  calculationSettings?: B2BCalculationSettings;
  isActive: boolean;
}

export const B2B_REPORT_UNIT_OPTIONS: { value: B2BReportUnit; label: string }[] = [
  { value: 'portion', label: 'מנה' },
  { value: 'unit', label: 'יחידה' },
  { value: 'kg', label: 'ק"ג' },
  { value: 'gram', label: 'גרם' },
  { value: 'liter', label: 'ליטר' },
  { value: 'ml', label: 'מ"ל' },
  { value: 'tray', label: 'מגש' },
  { value: 'pan', label: 'תבנית / גסטרונום' },
  { value: 'box', label: 'קופסה' },
  { value: 'package', label: 'חבילה' }
];

export const B2B_CALCULATION_METHOD_OPTIONS: { value: B2BCalculationMethod; label: string }[] = [
  { value: 'per_portion', label: 'לפי מספר מנות' },
  { value: 'fixed_per_order', label: 'כמות קבועה להזמנה' },
  { value: 'per_x_portions', label: 'כמות לכל X מנות' },
  { value: 'manual', label: 'ידני בלבד' }
];

export const B2B_ROUNDING_OPTIONS: { value: B2BRoundingMode; label: string }[] = [
  { value: 'none', label: 'ללא עיגול' },
  { value: 'ceil', label: 'עיגול למעלה' },
  { value: 'floor', label: 'עיגול למטה' },
  { value: 'round', label: 'עיגול רגיל' }
];

export function reportUnitLabel(unit: B2BReportUnit, quantity = 1): string {
  const q = Math.abs(quantity);
  const plural = q === 1 ? false : q !== 1;
  switch (unit) {
    case 'portion':
      return plural ? 'מנות' : 'מנה';
    case 'unit':
      return plural ? 'יחידות' : 'יחידה';
    case 'kg':
      return 'ק"ג';
    case 'gram':
      return 'גרם';
    case 'liter':
      return plural ? 'ליטרים' : 'ליטר';
    case 'ml':
      return 'מ"ל';
    case 'tray':
      return plural ? 'מגשים' : 'מגש';
    case 'pan':
      return plural ? 'תבניות' : 'תבנית';
    case 'box':
      return plural ? 'קופסאות' : 'קופסה';
    case 'package':
      return plural ? 'חבילות' : 'חבילה';
    default:
      return unit;
  }
}

/** Display label for manual calculation rows in reports and badges. */
export function formatManualReportLabel(reportUnit?: B2BReportUnit): string {
  if (!reportUnit) return 'ידני';
  const unit = reportUnitLabel(reportUnit, 1);
  return unit ? `ידני / ${unit}` : 'ידני';
}

export function formatCalculationSettingsSummary(settings: B2BCalculationSettings): string {
  if (!settings.enabled) return '';
  if (settings.calculationMethod === 'manual') {
    return `מותאם: ${formatManualReportLabel(settings.reportUnit)}`;
  }

  const unit = reportUnitLabel(settings.reportUnit, 1);

  if (settings.calculationMethod === 'per_portion' && settings.quantityPerPortion !== undefined) {
    return `מותאם: ${settings.quantityPerPortion} ${unit} למנה`;
  }
  if (settings.calculationMethod === 'fixed_per_order' && settings.quantityPerOrder !== undefined) {
    return `מותאם: ${settings.quantityPerOrder} ${unit} להזמנה`;
  }
  if (
    settings.calculationMethod === 'per_x_portions' &&
    settings.quantityPerXPortions !== undefined &&
    settings.xPortions !== undefined
  ) {
    return `מותאם: ${settings.quantityPerXPortions} ${unit} לכל ${settings.xPortions} מנות`;
  }

  return 'מותאם';
}

export function dictionaryLogisticsBadge(item: B2BMenuItem): string {
  if (item.calculationSettings?.enabled) {
    return formatCalculationSettingsSummary(item.calculationSettings);
  }
  if (isMeatKgCategory(item.category)) {
    return `${item.gramsPerPortion} ג' למנה`;
  }
  if (isUnitCountCategory(item.category)) {
    return 'נמדד ביחידות';
  }
  return `${item.portionsPerGastronorm || 40} מנות/גסטרונום`;
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
