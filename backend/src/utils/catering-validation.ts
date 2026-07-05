import { createValidationError } from '../middleware/errorHandler';
import { normalizeCateringLineItems, resolveMealCourseLines } from './catering-lines';

type MealTime = 'evening' | 'morning' | 'both';

function nonEmptyNames(raw: unknown): string[] {
  return normalizeCateringLineItems(raw).map((l) => l.name);
}

function assertNoDuplicates(items: string[], label: string): void {
  const seen = new Set<string>();
  for (const name of items) {
    if (seen.has(name)) {
      throw createValidationError(`${label}: לא ניתן לבחור את אותו פריט פעמיים (${name})`);
    }
    seen.add(name);
  }
}

function assertExactCount(items: string[], count: number, label: string): void {
  const n = items.length;
  if (n !== count) {
    throw createValidationError(`${label}: יש לבחור בדיוק ${count} פריטים (נבחרו ${n})`);
  }
}

function validateCourseGroup(items: string[], label: string): void {
  assertNoDuplicates(items, label);
  assertExactCount(items, 2, label);
}

function validateSidesGroup(items: string[], label: string): void {
  assertNoDuplicates(items, label);
  assertExactCount(items, 3, label);
}

function hasPositivePortion(value: unknown): boolean {
  if (value === undefined || value === null || String(value).trim() === '') return false;
  const n = typeof value === 'number' ? value : parseInt(String(value).trim(), 10);
  return Number.isFinite(n) && n > 0;
}

function assertNoOppositeMealFields(body: Record<string, unknown>, mealTime: MealTime): void {
  if (mealTime === 'evening') {
    if (hasPositivePortion(body.portionsMorning)) {
      throw createValidationError('להזמנת ערב בלבד אין להזין כמות מנות לבוקר');
    }
    if (nonEmptyNames(body.firstCoursesMorning).length > 0) {
      throw createValidationError('להזמנת ערב בלבד אין להזין מנות ראשונות לבוקר');
    }
    if (nonEmptyNames(body.mainCoursesMorning).length > 0) {
      throw createValidationError('להזמנת ערב בלבד אין להזין מנות עיקריות לבוקר');
    }
    if (nonEmptyNames(body.sidesMorning).length > 0) {
      throw createValidationError('להזמנת ערב בלבד אין להזין תוספות לבוקר');
    }
    return;
  }

  if (mealTime === 'morning') {
    if (hasPositivePortion(body.portionsEvening)) {
      throw createValidationError('להזמנת בוקר בלבד אין להזין כמות מנות לערב');
    }
    if (nonEmptyNames(body.firstCoursesEvening).length > 0) {
      throw createValidationError('להזמנת בוקר בלבד אין להזין מנות ראשונות לערב');
    }
    if (nonEmptyNames(body.mainCoursesEvening).length > 0) {
      throw createValidationError('להזמנת בוקר בלבד אין להזין מנות עיקריות לערב');
    }
    if (nonEmptyNames(body.sidesEvening).length > 0) {
      throw createValidationError('להזמנת בוקר בלבד אין להזין תוספות לערב');
    }
  }
}

/** Server-side validation for Shabbat/holiday catering form submissions. */
export function validateShabbatCateringSelection(
  body: Record<string, unknown>,
  mealTime: MealTime
): void {
  assertNoOppositeMealFields(body, mealTime);

  const salads = nonEmptyNames(body.salads);
  assertNoDuplicates(salads, 'סלטים');
  const saladCount = salads.length;
  if (saladCount < 6 || saladCount > 8) {
    throw createValidationError(`סלטים: יש לבחור בין 6 ל-8 פריטים (נבחרו ${saladCount})`);
  }

  const firstCourses = resolveMealCourseLines(
    body,
    mealTime,
    'firstCoursesEvening',
    'firstCoursesMorning',
    'firstCourses'
  );
  const mainCourses = resolveMealCourseLines(
    body,
    mealTime,
    'mainCoursesEvening',
    'mainCoursesMorning',
    'mainCourses'
  );

  const legacyFirst = firstCourses.legacy.map((l) => l.name);
  const legacyMain = mainCourses.legacy.map((l) => l.name);

  if (mealTime === 'both') {
    if (legacyFirst.length || legacyMain.length) {
      throw createValidationError(
        'להזמנת שתי ארוחות יש לבחור מנות ראשונות ועיקריות נפרדות לערב ולבוקר'
      );
    }
    validateCourseGroup(
      firstCourses.evening.map((l) => l.name),
      'מנות ראשונות לערב'
    );
    validateCourseGroup(
      firstCourses.morning.map((l) => l.name),
      'מנות ראשונות לבוקר'
    );
    validateCourseGroup(
      mainCourses.evening.map((l) => l.name),
      'מנות עיקריות לערב'
    );
    validateCourseGroup(
      mainCourses.morning.map((l) => l.name),
      'מנות עיקריות לבוקר'
    );
    validateSidesGroup(nonEmptyNames(body.sidesEvening), 'תוספות לערב');
    validateSidesGroup(nonEmptyNames(body.sidesMorning), 'תוספות לבוקר');
    return;
  }

  if (mealTime === 'evening') {
    const first = legacyFirst.length
      ? legacyFirst
      : firstCourses.evening.map((l) => l.name);
    const main = legacyMain.length ? legacyMain : mainCourses.evening.map((l) => l.name);
    validateCourseGroup(first, 'מנות ראשונות לערב');
    validateCourseGroup(main, 'מנות עיקריות לערב');
    validateSidesGroup(nonEmptyNames(body.sidesEvening), 'תוספות לערב');
    return;
  }

  // morning
  const first = legacyFirst.length ? legacyFirst : firstCourses.morning.map((l) => l.name);
  const main = legacyMain.length ? legacyMain : mainCourses.morning.map((l) => l.name);
  validateCourseGroup(first, 'מנות ראשונות לבוקר');
  validateCourseGroup(main, 'מנות עיקריות לבוקר');
  validateSidesGroup(nonEmptyNames(body.sidesMorning), 'תוספות לבוקר');
}

export function cateringLineNames(raw: unknown): string[] {
  return nonEmptyNames(raw);
}
