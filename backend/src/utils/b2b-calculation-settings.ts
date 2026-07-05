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

function parsePositiveNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const n = typeof value === 'number' ? value : parseFloat(String(value));
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function parseNonNegativeNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const n = typeof value === 'number' ? value : parseFloat(String(value));
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

export function parseCalculationSettings(raw: unknown): B2BCalculationSettings | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('מבנה הגדרות חישוב לא תקין');
  }

  const row = raw as Record<string, unknown>;
  const enabled = row.enabled === true;
  if (!enabled) {
    return { enabled: false, reportUnit: 'portion', calculationMethod: 'per_portion' };
  }

  const reportUnit = String(row.reportUnit ?? '').trim() as B2BReportUnit;
  if (!(B2B_REPORT_UNITS as readonly string[]).includes(reportUnit)) {
    throw new Error('יחידת מידה בדוחות לא תקינה');
  }

  const calculationMethod = String(row.calculationMethod ?? '').trim() as B2BCalculationMethod;
  if (!(B2B_CALCULATION_METHODS as readonly string[]).includes(calculationMethod)) {
    throw new Error('שיטת חישוב לא תקינה');
  }

  const roundingRaw = row.rounding === undefined || row.rounding === null || row.rounding === ''
    ? 'none'
    : String(row.rounding).trim();
  if (!(B2B_ROUNDING_MODES as readonly string[]).includes(roundingRaw)) {
    throw new Error('סוג עיגול לא תקין');
  }
  const rounding = roundingRaw as B2BRoundingMode;

  let minimumQuantity: number | undefined;
  if (row.minimumQuantity !== undefined && row.minimumQuantity !== null && row.minimumQuantity !== '') {
    const min = parseNonNegativeNumber(row.minimumQuantity);
    if (min === null) throw new Error('כמות מינימום חייבת להיות מספר שאינו שלילי');
    minimumQuantity = min;
  }

  const result: B2BCalculationSettings = {
    enabled: true,
    reportUnit,
    calculationMethod,
    rounding
  };
  if (minimumQuantity !== undefined) result.minimumQuantity = minimumQuantity;

  if (calculationMethod === 'per_portion') {
    const q = parsePositiveNumber(row.quantityPerPortion);
    if (q === null) throw new Error('כמות לכל מנה חייבת להיות מספר חיובי');
    result.quantityPerPortion = q;
  } else if (calculationMethod === 'fixed_per_order') {
    const q = parsePositiveNumber(row.quantityPerOrder);
    if (q === null) throw new Error('כמות קבועה להזמנה חייבת להיות מספר חיובי');
    result.quantityPerOrder = q;
  } else if (calculationMethod === 'per_x_portions') {
    const q = parsePositiveNumber(row.quantityPerXPortions);
    const x = parsePositiveNumber(row.xPortions);
    if (q === null) throw new Error('כמות לכל X מנות חייבת להיות מספר חיובי');
    if (x === null) throw new Error('לכל כמה מנות חייב להיות מספר חיובי');
    result.quantityPerXPortions = q;
    result.xPortions = x;
  }

  return result;
}

export function serializeCalculationSettings(
  raw: unknown
): B2BCalculationSettings | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const row = raw as B2BCalculationSettings;
  if (!row.enabled) return undefined;
  return {
    enabled: true,
    reportUnit: row.reportUnit,
    calculationMethod: row.calculationMethod,
    ...(row.quantityPerPortion !== undefined ? { quantityPerPortion: row.quantityPerPortion } : {}),
    ...(row.quantityPerOrder !== undefined ? { quantityPerOrder: row.quantityPerOrder } : {}),
    ...(row.quantityPerXPortions !== undefined ? { quantityPerXPortions: row.quantityPerXPortions } : {}),
    ...(row.xPortions !== undefined ? { xPortions: row.xPortions } : {}),
    rounding: row.rounding || 'none',
    ...(row.minimumQuantity !== undefined ? { minimumQuantity: row.minimumQuantity } : {})
  };
}
