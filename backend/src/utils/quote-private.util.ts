/**
 * Private customer quotes — aligned to Megadim site service categories:
 * 1. events          — קייטרינג לאירועים (₪70/מנה + שדרוגים)
 * 2. catering_shabbat — קייטרינג לאירועי שבת וחג (ארוחה אחת / שתי ארוחות / פרימיום)
 * 3. shabbat_ready   — אוכל מוכן לשבת וחג (שורות פריטים מהתפריט)
 */

export type QuoteAudience = 'business' | 'private';

export type PrivateServiceCategory = 'events' | 'catering_shabbat' | 'shabbat_ready';

/** Package within a category (legacy keys remapped on normalize). */
export type PrivateTemplateKey =
  | 'events_base'
  | 'one_meal'
  | 'two_meals'
  | 'premium_hosted'
  | 'itemized'
  | 'custom'
  /** @deprecated use two_meals */
  | 'shabbat_basic'
  /** @deprecated use premium_hosted */
  | 'shabbat_premium';

export type ReceptionBarTier = 'none' | 'standard' | 'premium';
export type MealScope = 'evening' | 'morning' | 'both';
export type DeliveryType = '' | 'pickup' | 'delivery';

export interface MealStructure {
  appetizerChoices: number;
  mainChoices: number;
  sides: number;
  dessert: boolean;
}

export interface ReadyFoodLine {
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface PrivatePackage {
  serviceCategory: PrivateServiceCategory;
  templateKey: PrivateTemplateKey;
  basePricePerPortion: number;
  /** Primary guest/portion count (events + package estimate). */
  portions: number;
  bread: string;
  saladsCount: number;
  friday: MealStructure;
  saturday: MealStructure;
  thirdMealNotes: string;
  extras: string[];
  whatsappText: string;

  /** catering_shabbat */
  mealScope: MealScope;
  portionsEvening: number;
  portionsMorning: number;
  includeThirdMeal: boolean;
  thirdMealPricePerPortion: number;
  includeAppetizerUpgrade: boolean;
  appetizerPricePerPortion: number;
  appetizerMealsCount: number;
  includeFishUpgrade: boolean;
  fishPricePerPortion: number;
  includeDessertUpgrade: boolean;
  dessertPricePerPortion: number;
  dessertMealsCount: number;
  includeKosherUpgrade: boolean;
  kosherPricePerPortion: number;
  kosherMealsCount: number;

  /** events */
  eventType: string;
  includeFirstCourse: boolean;
  firstCourseChoices: number;
  includeDesserts: boolean;
  receptionBar: ReceptionBarTier;
  mainChoices: number;
  sidesCount: number;

  /** shabbat_ready */
  readyLines: ReadyFoodLine[];
  deliveryFee: number;
  deliveryType: DeliveryType;
}

function roundMoney(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function meal(partial?: Partial<MealStructure>): MealStructure {
  return {
    appetizerChoices: Math.max(0, Math.trunc(Number(partial?.appetizerChoices) || 0)),
    mainChoices: Math.max(0, Math.trunc(Number(partial?.mainChoices) || 0)),
    sides: Math.max(0, Math.trunc(Number(partial?.sides) || 0)),
    dessert: partial?.dessert === true
  };
}

function readyLine(partial?: Partial<ReadyFoodLine>): ReadyFoodLine {
  return {
    description: String(partial?.description || '').trim().slice(0, 300),
    quantity: Math.max(0, roundMoney(Number(partial?.quantity) || 0)),
    unitPrice: Math.max(0, roundMoney(Number(partial?.unitPrice) || 0))
  };
}

export const PRIVATE_CATEGORY_LABELS: Record<PrivateServiceCategory, string> = {
  events: 'קייטרינג לאירועים',
  catering_shabbat: 'קייטרינג לאירועי שבת וחג',
  shabbat_ready: 'אוכל מוכן לשבת וחג'
};

const EVENTS_BASE = 70;
const EVENTS_FIRST = 20;
const EVENTS_DESSERT = 8;
const EVENTS_RECEPTION_STD = 30;
const EVENTS_RECEPTION_PREM = 45;
const EVENTS_KOSHER = 7;

const SHABBAT_ONE = 70;
const SHABBAT_TWO = 135;
const SHABBAT_PREMIUM = 255;
const SHABBAT_APP = 20;
const SHABBAT_THIRD = 25;
const SHABBAT_THIRD_PREMIUM = 60;
const SHABBAT_FISH = 18;
const SHABBAT_DESSERT = 8;
const SHABBAT_KOSHER = 7;

function emptyBase(partial: Partial<PrivatePackage>): PrivatePackage {
  return {
    serviceCategory: 'catering_shabbat',
    templateKey: 'custom',
    basePricePerPortion: 0,
    portions: 10,
    bread: '',
    saladsCount: 0,
    friday: meal(),
    saturday: meal(),
    thirdMealNotes: '',
    extras: [],
    whatsappText: '',
    mealScope: 'both',
    portionsEvening: 10,
    portionsMorning: 10,
    includeThirdMeal: false,
    thirdMealPricePerPortion: 0,
    includeAppetizerUpgrade: false,
    appetizerPricePerPortion: 0,
    appetizerMealsCount: 0,
    includeFishUpgrade: false,
    fishPricePerPortion: SHABBAT_FISH,
    includeDessertUpgrade: false,
    dessertPricePerPortion: SHABBAT_DESSERT,
    dessertMealsCount: 0,
    includeKosherUpgrade: false,
    kosherPricePerPortion: SHABBAT_KOSHER,
    kosherMealsCount: 0,
    eventType: '',
    includeFirstCourse: false,
    firstCourseChoices: 2,
    includeDesserts: false,
    receptionBar: 'none',
    mainChoices: 2,
    sidesCount: 3,
    readyLines: [],
    deliveryFee: 0,
    deliveryType: '',
    ...partial
  };
}

export const PRIVATE_TEMPLATE_EVENTS: PrivatePackage = emptyBase({
  serviceCategory: 'events',
  templateKey: 'events_base',
  basePricePerPortion: EVENTS_BASE,
  portions: 50,
  bread: 'לחמניות',
  saladsCount: 8,
  mainChoices: 2,
  sidesCount: 3,
  includeFirstCourse: false,
  firstCourseChoices: 2,
  includeDesserts: false,
  receptionBar: 'none',
  includeKosherUpgrade: false,
  kosherPricePerPortion: EVENTS_KOSHER,
  kosherMealsCount: 1,
  friday: meal({ mainChoices: 2, sides: 3 }),
  saturday: meal()
});

export const PRIVATE_TEMPLATE_ONE_MEAL: PrivatePackage = emptyBase({
  serviceCategory: 'catering_shabbat',
  templateKey: 'one_meal',
  basePricePerPortion: SHABBAT_ONE,
  portions: 10,
  mealScope: 'evening',
  portionsEvening: 10,
  portionsMorning: 0,
  bread: '',
  saladsCount: 6,
  friday: meal({ appetizerChoices: 0, mainChoices: 2, sides: 3 }),
  saturday: meal(),
  includeAppetizerUpgrade: false,
  appetizerPricePerPortion: SHABBAT_APP,
  appetizerMealsCount: 1,
  includeThirdMeal: false,
  thirdMealPricePerPortion: SHABBAT_THIRD,
  thirdMealNotes: 'סלטים + פשטידת ירקות',
  fishPricePerPortion: SHABBAT_FISH,
  dessertPricePerPortion: SHABBAT_DESSERT,
  dessertMealsCount: 1,
  kosherPricePerPortion: SHABBAT_KOSHER,
  kosherMealsCount: 1
});

export const PRIVATE_TEMPLATE_TWO_MEALS: PrivatePackage = emptyBase({
  serviceCategory: 'catering_shabbat',
  templateKey: 'two_meals',
  basePricePerPortion: SHABBAT_TWO,
  portions: 10,
  mealScope: 'both',
  portionsEvening: 10,
  portionsMorning: 10,
  bread: 'לחמניות (בהזמנה מ־20 מנות)',
  saladsCount: 8,
  friday: meal({ appetizerChoices: 0, mainChoices: 2, sides: 3 }),
  saturday: meal({ appetizerChoices: 0, mainChoices: 2, sides: 3 }),
  includeAppetizerUpgrade: false,
  appetizerPricePerPortion: SHABBAT_APP,
  appetizerMealsCount: 2,
  includeThirdMeal: false,
  thirdMealPricePerPortion: SHABBAT_THIRD,
  thirdMealNotes: 'סלטים + פשטידת ירקות',
  fishPricePerPortion: SHABBAT_FISH,
  dessertPricePerPortion: SHABBAT_DESSERT,
  dessertMealsCount: 2,
  kosherPricePerPortion: SHABBAT_KOSHER,
  kosherMealsCount: 2
});

export const PRIVATE_TEMPLATE_PREMIUM: PrivatePackage = emptyBase({
  serviceCategory: 'catering_shabbat',
  templateKey: 'premium_hosted',
  basePricePerPortion: SHABBAT_PREMIUM,
  portions: 10,
  mealScope: 'both',
  portionsEvening: 10,
  portionsMorning: 10,
  bread: 'חלות ולחמניות',
  saladsCount: 8,
  friday: meal({ appetizerChoices: 2, mainChoices: 2, sides: 3, dessert: true }),
  saturday: meal({ appetizerChoices: 2, mainChoices: 0, sides: 2, dessert: true }),
  includeThirdMeal: false,
  thirdMealPricePerPortion: SHABBAT_THIRD_PREMIUM,
  thirdMealNotes: 'סלטים, קיש ופשטידות',
  extras: [
    'שתיה של קוקה קולה',
    'מפות ומפיות (בחירת צבעים לכל סעודה)',
    'כלים מזכוכית או חרסינה',
    'מנהל אירוע לתפעול, הכנה וסידור שולחנות'
  ]
});

export const PRIVATE_TEMPLATE_READY: PrivatePackage = emptyBase({
  serviceCategory: 'shabbat_ready',
  templateKey: 'itemized',
  portions: 0,
  readyLines: [{ description: '', quantity: 1, unitPrice: 0 }],
  deliveryFee: 0,
  deliveryType: 'pickup'
});

/** @deprecated alias */
export const PRIVATE_TEMPLATE_BASIC = PRIVATE_TEMPLATE_TWO_MEALS;

function clonePkg(src: PrivatePackage): PrivatePackage {
  return {
    ...src,
    friday: { ...src.friday },
    saturday: { ...src.saturday },
    extras: [...src.extras],
    readyLines: src.readyLines.map((l) => ({ ...l }))
  };
}

export function resolveTemplateKey(key?: string | null): PrivateTemplateKey {
  const k = String(key || '').trim();
  if (k === 'shabbat_basic') return 'two_meals';
  if (k === 'shabbat_premium') return 'premium_hosted';
  if (
    k === 'events_base' ||
    k === 'one_meal' ||
    k === 'two_meals' ||
    k === 'premium_hosted' ||
    k === 'itemized' ||
    k === 'custom'
  ) {
    return k;
  }
  return 'two_meals';
}

export function categoryForTemplate(key: PrivateTemplateKey): PrivateServiceCategory {
  if (key === 'events_base') return 'events';
  if (key === 'itemized') return 'shabbat_ready';
  return 'catering_shabbat';
}

export function getPrivateTemplate(key: PrivateTemplateKey | string): PrivatePackage {
  const resolved = resolveTemplateKey(key);
  if (resolved === 'events_base') return clonePkg(PRIVATE_TEMPLATE_EVENTS);
  if (resolved === 'one_meal') return clonePkg(PRIVATE_TEMPLATE_ONE_MEAL);
  if (resolved === 'two_meals' || resolved === 'shabbat_basic') return clonePkg(PRIVATE_TEMPLATE_TWO_MEALS);
  if (resolved === 'premium_hosted' || resolved === 'shabbat_premium') {
    return clonePkg(PRIVATE_TEMPLATE_PREMIUM);
  }
  if (resolved === 'itemized') return clonePkg(PRIVATE_TEMPLATE_READY);
  return emptyBase({
    serviceCategory: 'catering_shabbat',
    templateKey: 'custom',
    portions: 1
  });
}

export function getDefaultPackageForCategory(category: PrivateServiceCategory): PrivatePackage {
  if (category === 'events') return getPrivateTemplate('events_base');
  if (category === 'shabbat_ready') return getPrivateTemplate('itemized');
  return getPrivateTemplate('two_meals');
}

function receptionPrice(tier: ReceptionBarTier): number {
  if (tier === 'standard') return EVENTS_RECEPTION_STD;
  if (tier === 'premium') return EVENTS_RECEPTION_PREM;
  return 0;
}

export function computeEventsRatePerPortion(pkg: PrivatePackage): number {
  let rate = Math.max(0, pkg.basePricePerPortion || EVENTS_BASE);
  if (pkg.includeFirstCourse) rate += EVENTS_FIRST;
  if (pkg.includeDesserts) rate += EVENTS_DESSERT;
  rate += receptionPrice(pkg.receptionBar || 'none');
  if (pkg.includeKosherUpgrade) rate += pkg.kosherPricePerPortion || EVENTS_KOSHER;
  return roundMoney(rate);
}

function effectiveShabbatPortions(pkg: PrivatePackage): number {
  if (pkg.mealScope === 'evening') return Math.max(0, pkg.portionsEvening || pkg.portions || 0);
  if (pkg.mealScope === 'morning') return Math.max(0, pkg.portionsMorning || pkg.portions || 0);
  const e = Math.max(0, pkg.portionsEvening || 0);
  const m = Math.max(0, pkg.portionsMorning || 0);
  if (e || m) return Math.max(e, m);
  return Math.max(0, pkg.portions || 0);
}

export function computePrivatePackageTotal(pkg: PrivatePackage): number {
  const category = pkg.serviceCategory || categoryForTemplate(resolveTemplateKey(pkg.templateKey));

  if (category === 'events') {
    const guests = Math.max(0, pkg.portions || 0);
    return roundMoney(computeEventsRatePerPortion(pkg) * guests);
  }

  if (category === 'shabbat_ready') {
    const linesTotal = (pkg.readyLines || []).reduce(
      (sum, line) => sum + (Number(line.quantity) || 0) * (Number(line.unitPrice) || 0),
      0
    );
    return roundMoney(linesTotal + Math.max(0, Number(pkg.deliveryFee) || 0));
  }

  // catering_shabbat
  const portions = effectiveShabbatPortions(pkg);
  let total = portions * (pkg.basePricePerPortion || 0);
  if (pkg.includeThirdMeal) {
    total += portions * (pkg.thirdMealPricePerPortion || 0);
  }
  if (pkg.includeAppetizerUpgrade) {
    total += portions * (pkg.appetizerPricePerPortion || 0) * Math.max(0, pkg.appetizerMealsCount || 0);
  }
  if (pkg.includeFishUpgrade) {
    total += portions * (pkg.fishPricePerPortion || 0);
  }
  if (pkg.includeDessertUpgrade) {
    total +=
      portions * (pkg.dessertPricePerPortion || 0) * Math.max(0, pkg.dessertMealsCount || 0);
  }
  if (pkg.includeKosherUpgrade) {
    total += portions * (pkg.kosherPricePerPortion || 0) * Math.max(0, pkg.kosherMealsCount || 0);
  }
  return roundMoney(total);
}

function mealLines(label: string, m: MealStructure): string[] {
  const lines: string[] = [`${label}:`];
  if (m.appetizerChoices > 0) lines.push(`מנה ראשונה - ${m.appetizerChoices} לבחירה`);
  if (m.mainChoices > 0) lines.push(`מנה עיקרית - ${m.mainChoices} לבחירה`);
  if (m.sides > 0) lines.push(`${m.sides} תוספות`);
  if (m.dessert) lines.push('קינוח');
  return lines;
}

function buildEventsWhatsApp(pkg: PrivatePackage): string {
  const rate = computeEventsRatePerPortion(pkg);
  const lines: string[] = ['היי זו הצעת המחיר:', '', 'קייטרינג לאירועים', ''];
  if (pkg.eventType) lines.push(`סוג אירוע: ${pkg.eventType}`);
  lines.push(`תפריט בסיסי: ${pkg.basePricePerPortion || EVENTS_BASE} ש״ח למנה`);
  lines.push(`כולל: ${pkg.bread || 'לחמניות'}, ${pkg.saladsCount || 8} סלטים, ${pkg.mainChoices || 2} עיקריות, ${pkg.sidesCount || 3} תוספות`);
  if (pkg.includeFirstCourse) {
    lines.push(`תוספת מנה ראשונה: +${EVENTS_FIRST} ש״ח (${pkg.firstCourseChoices || 2} לבחירה)`);
  }
  if (pkg.includeDesserts) lines.push(`תוספת קינוחים: +${EVENTS_DESSERT} ש״ח למנה`);
  if (pkg.receptionBar === 'standard') {
    lines.push(`בר קבלת פנים בסיסי: +${EVENTS_RECEPTION_STD} ש״ח למנה (4 תחנות)`);
  } else if (pkg.receptionBar === 'premium') {
    lines.push(`בר קבלת פנים משודרג: +${EVENTS_RECEPTION_PREM} ש״ח למנה (6 תחנות)`);
  }
  if (pkg.includeKosherUpgrade) {
    lines.push(`כשרות מחפוד: +${pkg.kosherPricePerPortion || EVENTS_KOSHER} ש״ח למנה`);
  }
  lines.push('');
  lines.push(`מחיר למנה כולל שדרוגים: ${rate} ש״ח`);
  if (pkg.portions > 0) {
    lines.push(`מספר אורחים: ${pkg.portions}`);
    lines.push(`סה״כ משוער: ${computePrivatePackageTotal(pkg).toLocaleString('he-IL')} ש״ח`);
  }
  if (pkg.deliveryType === 'delivery') lines.push('כולל משלוח / הגשה לפי תיאום');
  else if (pkg.deliveryType === 'pickup') lines.push('איסוף עצמי');
  return lines.join('\n').trim();
}

function buildCateringShabbatWhatsApp(pkg: PrivatePackage): string {
  const key = resolveTemplateKey(pkg.templateKey);
  const lines: string[] = ['היי זו הצעת המחיר:', '', 'קייטרינג לאירועי שבת וחג', ''];

  if (key === 'one_meal') {
    lines.push(`חבילת ארוחה אחת: ${pkg.basePricePerPortion} ש״ח למנה`);
  } else if (key === 'premium_hosted') {
    lines.push(`חבילת שבת פרימיום (כולל שירות): ${pkg.basePricePerPortion} ש״ח למנה ל־2 סעודות`);
  } else {
    lines.push(`חבילת שתי ארוחות (ערב + בוקר): ${pkg.basePricePerPortion} ש״ח למנה`);
  }

  if (pkg.includeAppetizerUpgrade && pkg.appetizerPricePerPortion > 0) {
    lines.push(
      `תוספת מנה ראשונה: ${pkg.appetizerPricePerPortion} ש״ח למנה לסעודה` +
        (pkg.appetizerMealsCount > 0 ? ` (×${pkg.appetizerMealsCount} סעודות)` : '')
    );
  }
  if (pkg.includeThirdMeal || (pkg.thirdMealPricePerPortion > 0 && pkg.includeThirdMeal)) {
    lines.push(`תוספת סעודה שלישית: ${pkg.thirdMealPricePerPortion} ש״ח למנה`);
  }
  if (pkg.includeFishUpgrade) {
    lines.push(`תוספת דג: ${pkg.fishPricePerPortion} ש״ח למנה`);
  }
  if (pkg.includeDessertUpgrade) {
    lines.push(
      `קינוחי ביסקוטי: ${pkg.dessertPricePerPortion} ש״ח לאדם לארוחה` +
        (pkg.dessertMealsCount > 0 ? ` (×${pkg.dessertMealsCount} ארוחות)` : '')
    );
  }
  if (pkg.includeKosherUpgrade) {
    lines.push(
      `כשרות מחפוד: ${pkg.kosherPricePerPortion} ש״ח למנה לארוחה` +
        (pkg.kosherMealsCount > 0 ? ` (×${pkg.kosherMealsCount} ארוחות)` : '')
    );
  }

  lines.push('');
  if (pkg.bread) lines.push(pkg.bread);
  if (pkg.saladsCount > 0) lines.push(`${pkg.saladsCount} סוגי סלטים`);

  const showEvening = pkg.mealScope !== 'morning';
  const showMorning = pkg.mealScope !== 'evening';
  if (showEvening) {
    lines.push('');
    lines.push(...mealLines('ערב שבת', pkg.friday));
    if (pkg.portionsEvening > 0) lines.push(`מנות ערב: ${pkg.portionsEvening}`);
  }
  if (showMorning) {
    lines.push('');
    lines.push(...mealLines(key === 'one_meal' && pkg.mealScope === 'morning' ? 'ארוחה' : 'שבת בוקר / צהריים', pkg.saturday));
    if (pkg.portionsMorning > 0) lines.push(`מנות בוקר: ${pkg.portionsMorning}`);
  }
  if (pkg.includeThirdMeal) {
    lines.push('');
    lines.push('סעודה שלישית:');
    lines.push(pkg.thirdMealNotes || 'סלטים ופשטידות');
  }
  if (pkg.extras.length) {
    lines.push('');
    for (const extra of pkg.extras) lines.push(extra);
  }

  const portions = effectiveShabbatPortions(pkg);
  if (portions > 0) {
    lines.push('');
    lines.push(`מספר מנות (לחישוב): ${portions}`);
    lines.push(`סה״כ משוער: ${computePrivatePackageTotal(pkg).toLocaleString('he-IL')} ש״ח`);
  }
  return lines.join('\n').trim();
}

function buildReadyWhatsApp(pkg: PrivatePackage): string {
  const lines: string[] = ['היי זו הצעת המחיר:', '', 'אוכל מוכן לשבת וחג', ''];
  const items = (pkg.readyLines || []).filter((l) => l.description.trim());
  if (!items.length) {
    lines.push('(טרם נוספו פריטים)');
  } else {
    for (const line of items) {
      const lineTotal = roundMoney((line.quantity || 0) * (line.unitPrice || 0));
      lines.push(
        `• ${line.description} — ${line.quantity} × ${line.unitPrice} ש״ח = ${lineTotal.toLocaleString('he-IL')} ש״ח`
      );
    }
  }
  if (pkg.deliveryFee > 0) {
    lines.push(`דמי משלוח: ${pkg.deliveryFee} ש״ח`);
  }
  if (pkg.deliveryType === 'pickup') lines.push('איסוף עצמי');
  else if (pkg.deliveryType === 'delivery') lines.push('משלוח');
  lines.push('');
  lines.push(`סה״כ משוער: ${computePrivatePackageTotal(pkg).toLocaleString('he-IL')} ש״ח`);
  return lines.join('\n').trim();
}

/** Build WhatsApp message matching Megadim private quote style per category. */
export function buildPrivateWhatsAppText(pkg: PrivatePackage): string {
  const category = pkg.serviceCategory || categoryForTemplate(resolveTemplateKey(pkg.templateKey));
  if (category === 'events') return buildEventsWhatsApp(pkg);
  if (category === 'shabbat_ready') return buildReadyWhatsApp(pkg);
  return buildCateringShabbatWhatsApp(pkg);
}

export function normalizePrivatePackage(input?: Partial<PrivatePackage> | null): PrivatePackage {
  const resolvedKey = resolveTemplateKey(input?.templateKey);
  const inferredCategory =
    (input?.serviceCategory as PrivateServiceCategory) || categoryForTemplate(resolvedKey);
  const base = getDefaultPackageForCategory(inferredCategory);
  // If a specific package was chosen, seed from that template
  const seeded =
    resolvedKey === 'custom'
      ? base
      : getPrivateTemplate(resolvedKey).serviceCategory === inferredCategory
        ? getPrivateTemplate(resolvedKey)
        : base;

  const receptionRaw = String(input?.receptionBar ?? seeded.receptionBar ?? 'none');
  const receptionBar: ReceptionBarTier =
    receptionRaw === 'standard' || receptionRaw === 'premium' ? receptionRaw : 'none';

  const mealScopeRaw = String(input?.mealScope ?? seeded.mealScope ?? 'both');
  const mealScope: MealScope =
    mealScopeRaw === 'evening' || mealScopeRaw === 'morning' ? mealScopeRaw : 'both';

  const deliveryRaw = String(input?.deliveryType ?? seeded.deliveryType ?? '');
  const deliveryType: DeliveryType =
    deliveryRaw === 'pickup' || deliveryRaw === 'delivery' ? deliveryRaw : '';

  const extras = Array.isArray(input?.extras)
    ? input!.extras.map((x) => String(x || '').trim()).filter(Boolean).slice(0, 20)
    : seeded.extras;

  const readyLines = Array.isArray(input?.readyLines)
    ? input!.readyLines.map(readyLine).slice(0, 40)
    : seeded.readyLines.map(readyLine);

  // Legacy friday/saturday only packages
  const friday = meal(input?.friday ?? seeded.friday);
  const saturday = meal(input?.saturday ?? seeded.saturday);

  return {
    serviceCategory: inferredCategory,
    templateKey: resolvedKey === 'shabbat_basic' || resolvedKey === 'shabbat_premium' ? resolveTemplateKey(resolvedKey) : resolvedKey,
    basePricePerPortion: Math.max(
      0,
      roundMoney(Number(input?.basePricePerPortion ?? seeded.basePricePerPortion) || 0)
    ),
    portions: Math.max(0, Math.trunc(Number(input?.portions ?? seeded.portions) || 0)),
    bread: String(input?.bread ?? seeded.bread ?? '').trim().slice(0, 120),
    saladsCount: Math.max(0, Math.trunc(Number(input?.saladsCount ?? seeded.saladsCount) || 0)),
    friday,
    saturday,
    thirdMealNotes: String(input?.thirdMealNotes ?? seeded.thirdMealNotes ?? '').trim().slice(0, 300),
    extras,
    whatsappText: String(input?.whatsappText || '').trim().slice(0, 8000),
    mealScope,
    portionsEvening: Math.max(
      0,
      Math.trunc(Number(input?.portionsEvening ?? seeded.portionsEvening) || 0)
    ),
    portionsMorning: Math.max(
      0,
      Math.trunc(Number(input?.portionsMorning ?? seeded.portionsMorning) || 0)
    ),
    includeThirdMeal: input?.includeThirdMeal === true,
    thirdMealPricePerPortion: Math.max(
      0,
      roundMoney(Number(input?.thirdMealPricePerPortion ?? seeded.thirdMealPricePerPortion) || 0)
    ),
    includeAppetizerUpgrade: input?.includeAppetizerUpgrade === true,
    appetizerPricePerPortion: Math.max(
      0,
      roundMoney(Number(input?.appetizerPricePerPortion ?? seeded.appetizerPricePerPortion) || 0)
    ),
    appetizerMealsCount: Math.max(
      0,
      Math.trunc(Number(input?.appetizerMealsCount ?? seeded.appetizerMealsCount) || 0)
    ),
    includeFishUpgrade: input?.includeFishUpgrade === true,
    fishPricePerPortion: Math.max(
      0,
      roundMoney(Number(input?.fishPricePerPortion ?? seeded.fishPricePerPortion) || 0)
    ),
    includeDessertUpgrade: input?.includeDessertUpgrade === true,
    dessertPricePerPortion: Math.max(
      0,
      roundMoney(Number(input?.dessertPricePerPortion ?? seeded.dessertPricePerPortion) || 0)
    ),
    dessertMealsCount: Math.max(
      0,
      Math.trunc(Number(input?.dessertMealsCount ?? seeded.dessertMealsCount) || 0)
    ),
    includeKosherUpgrade: input?.includeKosherUpgrade === true,
    kosherPricePerPortion: Math.max(
      0,
      roundMoney(Number(input?.kosherPricePerPortion ?? seeded.kosherPricePerPortion) || 0)
    ),
    kosherMealsCount: Math.max(
      0,
      Math.trunc(Number(input?.kosherMealsCount ?? seeded.kosherMealsCount) || 0)
    ),
    eventType: String(input?.eventType ?? seeded.eventType ?? '').trim().slice(0, 120),
    includeFirstCourse: input?.includeFirstCourse === true,
    firstCourseChoices: Math.max(
      0,
      Math.trunc(Number(input?.firstCourseChoices ?? seeded.firstCourseChoices) || 0)
    ),
    includeDesserts: input?.includeDesserts === true,
    receptionBar,
    mainChoices: Math.max(0, Math.trunc(Number(input?.mainChoices ?? seeded.mainChoices) || 0)),
    sidesCount: Math.max(0, Math.trunc(Number(input?.sidesCount ?? seeded.sidesCount) || 0)),
    readyLines: readyLines.length ? readyLines : [{ description: '', quantity: 1, unitPrice: 0 }],
    deliveryFee: Math.max(0, roundMoney(Number(input?.deliveryFee ?? seeded.deliveryFee) || 0)),
    deliveryType
  };
}

export function applyPrivatePackageToQuoteFields(pkgInput?: Partial<PrivatePackage> | null): {
  privatePackage: PrivatePackage;
  subtotalInclVat: number;
  discountAmount: number;
  totalInclVat: number;
  totalExVat: number;
  vatAmount: number;
  discountPercent: number;
  lines: Array<{
    sku: string;
    description: string;
    quantity: number;
    unitPriceInclVat: number;
    lineTotalInclVat: number;
    sortOrder: number;
  }>;
} {
  const pkg = normalizePrivatePackage(pkgInput);
  pkg.whatsappText = buildPrivateWhatsAppText(pkg);
  const total = computePrivatePackageTotal(pkg);
  const category = pkg.serviceCategory;
  const lines: Array<{
    sku: string;
    description: string;
    quantity: number;
    unitPriceInclVat: number;
    lineTotalInclVat: number;
    sortOrder: number;
  }> = [];

  if (category === 'events') {
    const rate = computeEventsRatePerPortion(pkg);
    lines.push({
      sku: 'EVENTS',
      description: `קייטרינג לאירועים — ${rate}₪ למנה (${pkg.portions} אורחים)`,
      quantity: pkg.portions || 1,
      unitPriceInclVat: rate,
      lineTotalInclVat: roundMoney((pkg.portions || 0) * rate),
      sortOrder: 0
    });
  } else if (category === 'shabbat_ready') {
    (pkg.readyLines || [])
      .filter((l) => l.description.trim())
      .forEach((l, i) => {
        lines.push({
          sku: `READY-${i + 1}`,
          description: l.description,
          quantity: l.quantity || 1,
          unitPriceInclVat: l.unitPrice,
          lineTotalInclVat: roundMoney((l.quantity || 0) * (l.unitPrice || 0)),
          sortOrder: i
        });
      });
    if (pkg.deliveryFee > 0) {
      lines.push({
        sku: 'DELIVERY',
        description: 'דמי משלוח',
        quantity: 1,
        unitPriceInclVat: pkg.deliveryFee,
        lineTotalInclVat: pkg.deliveryFee,
        sortOrder: lines.length
      });
    }
    if (!lines.length) {
      lines.push({
        sku: 'READY',
        description: 'אוכל מוכן לשבת וחג',
        quantity: 1,
        unitPriceInclVat: 0,
        lineTotalInclVat: 0,
        sortOrder: 0
      });
    }
  } else {
    const portions = effectiveShabbatPortions(pkg);
    const label =
      resolveTemplateKey(pkg.templateKey) === 'one_meal'
        ? 'ארוחה אחת'
        : resolveTemplateKey(pkg.templateKey) === 'premium_hosted'
          ? 'שבת פרימיום'
          : 'שתי ארוחות שבת';
    lines.push({
      sku: 'SHABBAT',
      description: `קייטרינג שבת/חג — ${label} — ${pkg.basePricePerPortion}₪ למנה (${portions} מנות)`,
      quantity: portions || 1,
      unitPriceInclVat: pkg.basePricePerPortion,
      lineTotalInclVat: roundMoney(portions * pkg.basePricePerPortion),
      sortOrder: 0
    });
    if (pkg.includeThirdMeal && pkg.thirdMealPricePerPortion > 0) {
      lines.push({
        sku: 'SEUDA3',
        description: `תוספת סעודה שלישית — ${pkg.thirdMealPricePerPortion}₪ למנה`,
        quantity: portions || 1,
        unitPriceInclVat: pkg.thirdMealPricePerPortion,
        lineTotalInclVat: roundMoney(portions * pkg.thirdMealPricePerPortion),
        sortOrder: 1
      });
    }
    if (pkg.includeAppetizerUpgrade && pkg.appetizerPricePerPortion > 0) {
      const qty = portions * (pkg.appetizerMealsCount || 0);
      lines.push({
        sku: 'APP',
        description: `תוספת מנה ראשונה — ${pkg.appetizerPricePerPortion}₪ למנה לסעודה`,
        quantity: qty || 1,
        unitPriceInclVat: pkg.appetizerPricePerPortion,
        lineTotalInclVat: roundMoney(qty * pkg.appetizerPricePerPortion),
        sortOrder: 2
      });
    }
    if (pkg.includeFishUpgrade && pkg.fishPricePerPortion > 0) {
      lines.push({
        sku: 'FISH',
        description: `תוספת דג — ${pkg.fishPricePerPortion}₪ למנה`,
        quantity: portions || 1,
        unitPriceInclVat: pkg.fishPricePerPortion,
        lineTotalInclVat: roundMoney(portions * pkg.fishPricePerPortion),
        sortOrder: 3
      });
    }
    if (pkg.includeDessertUpgrade && pkg.dessertPricePerPortion > 0) {
      const qty = portions * (pkg.dessertMealsCount || 0);
      lines.push({
        sku: 'DESSERT',
        description: `קינוחי ביסקוטי — ${pkg.dessertPricePerPortion}₪ לאדם לארוחה`,
        quantity: qty || 1,
        unitPriceInclVat: pkg.dessertPricePerPortion,
        lineTotalInclVat: roundMoney(qty * pkg.dessertPricePerPortion),
        sortOrder: 4
      });
    }
    if (pkg.includeKosherUpgrade && pkg.kosherPricePerPortion > 0) {
      const qty = portions * (pkg.kosherMealsCount || 0);
      lines.push({
        sku: 'KOSHER',
        description: `כשרות מחפוד — ${pkg.kosherPricePerPortion}₪ למנה לארוחה`,
        quantity: qty || 1,
        unitPriceInclVat: pkg.kosherPricePerPortion,
        lineTotalInclVat: roundMoney(qty * pkg.kosherPricePerPortion),
        sortOrder: 5
      });
    }
  }

  return {
    privatePackage: pkg,
    subtotalInclVat: total,
    discountAmount: 0,
    totalInclVat: total,
    totalExVat: total,
    vatAmount: 0,
    discountPercent: 0,
    lines
  };
}
