import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';

export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired' | 'converted';
export type QuoteAudience = 'business' | 'private';
export type PrivateServiceCategory = 'events' | 'catering_shabbat' | 'shabbat_ready';
export type PrivateTemplateKey =
  | 'events_base'
  | 'one_meal'
  | 'two_meals'
  | 'premium_hosted'
  | 'itemized'
  | 'custom'
  | 'shabbat_basic'
  | 'shabbat_premium';
export type ReceptionBarTier = 'none' | 'standard' | 'premium';
export type MealScope = 'evening' | 'morning' | 'both';
export type DeliveryType = '' | 'pickup' | 'delivery';

export interface QuoteLine {
  sku?: string;
  description: string;
  quantity: number;
  unitPriceInclVat: number;
  lineTotalInclVat?: number;
  sortOrder?: number;
}

export interface QuoteClient {
  name: string;
  company: string;
  idNumber: string;
  address: string;
  phone: string;
  email: string;
  theirRef: string;
}

export interface QuoteCompanySnapshot {
  name: string;
  address: string;
  phone: string;
  businessId: string;
  producerName: string;
}

export interface QuoteBankSnapshot {
  bankCode: string;
  bankName: string;
  branch: string;
  account: string;
}

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
  portions: number;
  bread: string;
  saladsCount: number;
  friday: MealStructure;
  saturday: MealStructure;
  thirdMealNotes: string;
  extras: string[];
  whatsappText: string;
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
  eventType: string;
  includeFirstCourse: boolean;
  firstCourseChoices: number;
  includeDesserts: boolean;
  receptionBar: ReceptionBarTier;
  mainChoices: number;
  sidesCount: number;
  readyLines: ReadyFoodLine[];
  deliveryFee: number;
  deliveryType: DeliveryType;
}

export interface Quote {
  _id: string;
  quoteNumber: string;
  audience?: QuoteAudience;
  status: QuoteStatus;
  client: QuoteClient;
  eventDate?: string | null;
  eventLocation?: string;
  lines: QuoteLine[];
  privatePackage?: PrivatePackage | null;
  discountPercent: number;
  notes?: string;
  vatRate: number;
  subtotalInclVat: number;
  discountAmount: number;
  totalInclVat: number;
  totalExVat: number;
  vatAmount: number;
  companySnapshot: QuoteCompanySnapshot;
  bankSnapshot: QuoteBankSnapshot;
  issuedBy?: string | null;
  issuedAt?: string | null;
  validUntil?: string | null;
  leadId?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface QuotePayload {
  audience?: QuoteAudience;
  client?: Partial<QuoteClient>;
  eventDate?: string | null;
  eventLocation?: string;
  lines?: QuoteLine[];
  privatePackage?: Partial<PrivatePackage> | null;
  discountPercent?: number;
  notes?: string;
  vatRate?: number;
  validUntil?: string | null;
  leadId?: string | null;
  companySnapshot?: Partial<QuoteCompanySnapshot>;
  bankSnapshot?: Partial<QuoteBankSnapshot>;
  issuedBy?: string | null;
}

export interface QuotesListResponse {
  success: boolean;
  data: Quote[];
  meta: { page: number; limit: number; total: number; pages: number };
  kpis: {
    draftCount: number;
    sentThisMonthCount: number;
    acceptedCount: number;
    openQuotesAmount: number;
  };
}

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  draft: 'טיוטה',
  sent: 'נשלחה',
  accepted: 'התקבלה',
  rejected: 'נדחתה',
  expired: 'פגה',
  converted: 'הומרה להזמנה'
};

export const PRIVATE_CATEGORY_LABELS: Record<PrivateServiceCategory, string> = {
  events: 'קייטרינג לאירועים',
  catering_shabbat: 'קייטרינג לאירועי שבת וחג',
  shabbat_ready: 'אוכל מוכן לשבת וחג'
};

export const MEGADIM_COMPANY_DEFAULTS: QuoteCompanySnapshot = {
  name: 'קייטרינג מגדים (ב.מ.מ) בע"מ',
  address: 'אזור התעשייה, מעלה מכמש 9063400',
  phone: '073-3678399',
  businessId: '516234739',
  producerName: 'בני מהלא'
};

export const MEGADIM_BANK_DEFAULTS: QuoteBankSnapshot = {
  bankCode: '12',
  bankName: 'פועלים',
  branch: '698',
  account: '72490'
};

const roundMoney = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

function meal(partial?: Partial<MealStructure>): MealStructure {
  return {
    appetizerChoices: Math.max(0, Math.trunc(Number(partial?.appetizerChoices) || 0)),
    mainChoices: Math.max(0, Math.trunc(Number(partial?.mainChoices) || 0)),
    sides: Math.max(0, Math.trunc(Number(partial?.sides) || 0)),
    dessert: partial?.dessert === true
  };
}

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
    fishPricePerPortion: 18,
    includeDessertUpgrade: false,
    dessertPricePerPortion: 8,
    dessertMealsCount: 0,
    includeKosherUpgrade: false,
    kosherPricePerPortion: 7,
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
  basePricePerPortion: 70,
  portions: 50,
  bread: 'לחמניות',
  saladsCount: 8,
  mainChoices: 2,
  sidesCount: 3,
  friday: meal({ mainChoices: 2, sides: 3 })
});

export const PRIVATE_TEMPLATE_ONE_MEAL: PrivatePackage = emptyBase({
  serviceCategory: 'catering_shabbat',
  templateKey: 'one_meal',
  basePricePerPortion: 70,
  mealScope: 'evening',
  portionsEvening: 10,
  portionsMorning: 0,
  saladsCount: 6,
  friday: meal({ mainChoices: 2, sides: 3 }),
  appetizerPricePerPortion: 20,
  appetizerMealsCount: 1,
  thirdMealPricePerPortion: 25,
  thirdMealNotes: 'סלטים + פשטידת ירקות',
  dessertMealsCount: 1,
  kosherMealsCount: 1
});

export const PRIVATE_TEMPLATE_TWO_MEALS: PrivatePackage = emptyBase({
  serviceCategory: 'catering_shabbat',
  templateKey: 'two_meals',
  basePricePerPortion: 135,
  bread: 'לחמניות (בהזמנה מ־20 מנות)',
  saladsCount: 8,
  friday: meal({ mainChoices: 2, sides: 3 }),
  saturday: meal({ mainChoices: 2, sides: 3 }),
  appetizerPricePerPortion: 20,
  appetizerMealsCount: 2,
  thirdMealPricePerPortion: 25,
  thirdMealNotes: 'סלטים + פשטידת ירקות',
  dessertMealsCount: 2,
  kosherMealsCount: 2
});

export const PRIVATE_TEMPLATE_PREMIUM: PrivatePackage = emptyBase({
  serviceCategory: 'catering_shabbat',
  templateKey: 'premium_hosted',
  basePricePerPortion: 255,
  bread: 'חלות ולחמניות',
  saladsCount: 8,
  friday: meal({ appetizerChoices: 2, mainChoices: 2, sides: 3, dessert: true }),
  saturday: meal({ appetizerChoices: 2, mainChoices: 0, sides: 2, dessert: true }),
  thirdMealPricePerPortion: 60,
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
  deliveryType: 'pickup'
});

export const PRIVATE_TEMPLATE_BASIC = PRIVATE_TEMPLATE_TWO_MEALS;

function clonePkg(src: PrivatePackage): PrivatePackage {
  return {
    ...src,
    friday: { ...src.friday },
    saturday: { ...src.saturday },
    extras: [...src.extras],
    readyLines: (src.readyLines || []).map((l) => ({ ...l }))
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

export function getPrivateTemplate(key: PrivateTemplateKey | string): PrivatePackage {
  const resolved = resolveTemplateKey(key);
  if (resolved === 'events_base') return clonePkg(PRIVATE_TEMPLATE_EVENTS);
  if (resolved === 'one_meal') return clonePkg(PRIVATE_TEMPLATE_ONE_MEAL);
  if (resolved === 'two_meals') return clonePkg(PRIVATE_TEMPLATE_TWO_MEALS);
  if (resolved === 'premium_hosted') return clonePkg(PRIVATE_TEMPLATE_PREMIUM);
  if (resolved === 'itemized') return clonePkg(PRIVATE_TEMPLATE_READY);
  return emptyBase({ serviceCategory: 'catering_shabbat', templateKey: 'custom', portions: 1 });
}

export function getDefaultPackageForCategory(category: PrivateServiceCategory): PrivatePackage {
  if (category === 'events') return getPrivateTemplate('events_base');
  if (category === 'shabbat_ready') return getPrivateTemplate('itemized');
  return getPrivateTemplate('two_meals');
}

function receptionPrice(tier: ReceptionBarTier): number {
  if (tier === 'standard') return 30;
  if (tier === 'premium') return 45;
  return 0;
}

export function computeEventsRatePerPortion(pkg: PrivatePackage): number {
  let rate = Math.max(0, pkg.basePricePerPortion || 70);
  if (pkg.includeFirstCourse) rate += 20;
  if (pkg.includeDesserts) rate += 8;
  rate += receptionPrice(pkg.receptionBar || 'none');
  if (pkg.includeKosherUpgrade) rate += pkg.kosherPricePerPortion || 7;
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
  const category = pkg.serviceCategory || 'catering_shabbat';
  if (category === 'events') {
    return roundMoney(computeEventsRatePerPortion(pkg) * Math.max(0, pkg.portions || 0));
  }
  if (category === 'shabbat_ready') {
    const linesTotal = (pkg.readyLines || []).reduce(
      (sum, line) => sum + (Number(line.quantity) || 0) * (Number(line.unitPrice) || 0),
      0
    );
    return roundMoney(linesTotal + Math.max(0, Number(pkg.deliveryFee) || 0));
  }
  const portions = effectiveShabbatPortions(pkg);
  let total = portions * (pkg.basePricePerPortion || 0);
  if (pkg.includeThirdMeal) total += portions * (pkg.thirdMealPricePerPortion || 0);
  if (pkg.includeAppetizerUpgrade) {
    total += portions * (pkg.appetizerPricePerPortion || 0) * Math.max(0, pkg.appetizerMealsCount || 0);
  }
  if (pkg.includeFishUpgrade) total += portions * (pkg.fishPricePerPortion || 0);
  if (pkg.includeDessertUpgrade) {
    total += portions * (pkg.dessertPricePerPortion || 0) * Math.max(0, pkg.dessertMealsCount || 0);
  }
  if (pkg.includeKosherUpgrade) {
    total += portions * (pkg.kosherPricePerPortion || 0) * Math.max(0, pkg.kosherMealsCount || 0);
  }
  return roundMoney(total);
}

export function buildPrivateWhatsAppText(pkg: PrivatePackage): string {
  const category = pkg.serviceCategory || 'catering_shabbat';
  const mealLines = (label: string, m: MealStructure): string[] => {
    const out = [`${label}:`];
    if (m.appetizerChoices > 0) out.push(`מנה ראשונה - ${m.appetizerChoices} לבחירה`);
    if (m.mainChoices > 0) out.push(`מנה עיקרית - ${m.mainChoices} לבחירה`);
    if (m.sides > 0) out.push(`${m.sides} תוספות`);
    if (m.dessert) out.push('קינוח');
    return out;
  };

  if (category === 'events') {
    const rate = computeEventsRatePerPortion(pkg);
    const lines: string[] = ['היי זו הצעת המחיר:', '', 'קייטרינג לאירועים', ''];
    if (pkg.eventType) lines.push(`סוג אירוע: ${pkg.eventType}`);
    lines.push(`תפריט בסיסי: ${pkg.basePricePerPortion || 70} ש״ח למנה`);
    lines.push(
      `כולל: ${pkg.bread || 'לחמניות'}, ${pkg.saladsCount || 8} סלטים, ${pkg.mainChoices || 2} עיקריות, ${pkg.sidesCount || 3} תוספות`
    );
    if (pkg.includeFirstCourse) {
      lines.push(`תוספת מנה ראשונה: +20 ש״ח (${pkg.firstCourseChoices || 2} לבחירה)`);
    }
    if (pkg.includeDesserts) lines.push('תוספת קינוחים: +8 ש״ח למנה');
    if (pkg.receptionBar === 'standard') lines.push('בר קבלת פנים בסיסי: +30 ש״ח למנה (4 תחנות)');
    if (pkg.receptionBar === 'premium') lines.push('בר קבלת פנים משודרג: +45 ש״ח למנה (6 תחנות)');
    if (pkg.includeKosherUpgrade) {
      lines.push(`כשרות מחפוד: +${pkg.kosherPricePerPortion || 7} ש״ח למנה`);
    }
    lines.push('');
    lines.push(`מחיר למנה כולל שדרוגים: ${rate} ש״ח`);
    if (pkg.portions > 0) {
      lines.push(`מספר אורחים: ${pkg.portions}`);
      lines.push(`סה״כ משוער: ${computePrivatePackageTotal(pkg).toLocaleString('he-IL')} ש״ח`);
    }
    return lines.join('\n').trim();
  }

  if (category === 'shabbat_ready') {
    const lines: string[] = ['היי זו הצעת המחיר:', '', 'אוכל מוכן לשבת וחג', ''];
    const items = (pkg.readyLines || []).filter((l) => l.description.trim());
    if (!items.length) lines.push('(טרם נוספו פריטים)');
    else {
      for (const line of items) {
        const lineTotal = roundMoney((line.quantity || 0) * (line.unitPrice || 0));
        lines.push(
          `• ${line.description} — ${line.quantity} × ${line.unitPrice} ש״ח = ${lineTotal.toLocaleString('he-IL')} ש״ח`
        );
      }
    }
    if (pkg.deliveryFee > 0) lines.push(`דמי משלוח: ${pkg.deliveryFee} ש״ח`);
    if (pkg.deliveryType === 'pickup') lines.push('איסוף עצמי');
    else if (pkg.deliveryType === 'delivery') lines.push('משלוח');
    lines.push('');
    lines.push(`סה״כ משוער: ${computePrivatePackageTotal(pkg).toLocaleString('he-IL')} ש״ח`);
    return lines.join('\n').trim();
  }

  const key = resolveTemplateKey(pkg.templateKey);
  const lines: string[] = ['היי זו הצעת המחיר:', '', 'קייטרינג לאירועי שבת וחג', ''];
  if (key === 'one_meal') lines.push(`חבילת ארוחה אחת: ${pkg.basePricePerPortion} ש״ח למנה`);
  else if (key === 'premium_hosted') {
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
  if (pkg.includeThirdMeal) {
    lines.push(`תוספת סעודה שלישית: ${pkg.thirdMealPricePerPortion} ש״ח למנה`);
  }
  if (pkg.includeFishUpgrade) lines.push(`תוספת דג: ${pkg.fishPricePerPortion} ש״ח למנה`);
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
  if (pkg.mealScope !== 'morning') {
    lines.push('');
    lines.push(...mealLines('ערב שבת', pkg.friday));
    if (pkg.portionsEvening > 0) lines.push(`מנות ערב: ${pkg.portionsEvening}`);
  }
  if (pkg.mealScope !== 'evening') {
    lines.push('');
    lines.push(...mealLines('שבת בוקר / צהריים', pkg.saturday));
    if (pkg.portionsMorning > 0) lines.push(`מנות בוקר: ${pkg.portionsMorning}`);
  }
  if (pkg.includeThirdMeal) {
    lines.push('');
    lines.push('סעודה שלישית:');
    lines.push(pkg.thirdMealNotes || 'סלטים ופשטידות');
  }
  if (pkg.extras?.length) {
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

@Injectable({ providedIn: 'root' })
export class QuotesService {
  private http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/quotes`;

  list(params: {
    status?: string;
    search?: string;
    audience?: QuoteAudience | 'all';
    page?: number;
    limit?: number;
  } = {}): Observable<QuotesListResponse> {
    let httpParams = new HttpParams();
    if (params.status) httpParams = httpParams.set('status', params.status);
    if (params.search) httpParams = httpParams.set('search', params.search);
    if (params.audience && params.audience !== 'all') {
      httpParams = httpParams.set('audience', params.audience);
    }
    if (params.page) httpParams = httpParams.set('page', String(params.page));
    if (params.limit) httpParams = httpParams.set('limit', String(params.limit));
    return this.http.get<QuotesListResponse>(this.base, { params: httpParams });
  }

  get(id: string): Observable<Quote> {
    return this.http
      .get<{ success: boolean; data: Quote }>(`${this.base}/${id}`)
      .pipe(map((r) => r.data));
  }

  create(payload: QuotePayload): Observable<Quote> {
    return this.http
      .post<{ success: boolean; data: Quote }>(this.base, payload)
      .pipe(map((r) => r.data));
  }

  update(id: string, payload: QuotePayload): Observable<Quote> {
    return this.http
      .put<{ success: boolean; data: Quote }>(`${this.base}/${id}`, payload)
      .pipe(map((r) => r.data));
  }

  changeStatus(id: string, status: QuoteStatus): Observable<Quote> {
    return this.http
      .post<{ success: boolean; data: Quote }>(`${this.base}/${id}/status`, { status })
      .pipe(map((r) => r.data));
  }

  duplicate(id: string): Observable<Quote> {
    return this.http
      .post<{ success: boolean; data: Quote }>(`${this.base}/${id}/duplicate`, {})
      .pipe(map((r) => r.data));
  }

  remove(id: string): Observable<void> {
    return this.http.delete<{ success: boolean }>(`${this.base}/${id}`).pipe(map(() => undefined));
  }

  downloadPdf(id: string): Observable<Blob> {
    return this.http.get(`${this.base}/${id}/pdf`, { responseType: 'blob' });
  }
}

/** Client-side live totals (mirrors backend SSOT for business preview). */
export function computeQuoteTotalsLocal(input: {
  lines: QuoteLine[];
  discountPercent: number;
  vatRate: number;
}): {
  lines: QuoteLine[];
  subtotalInclVat: number;
  discountAmount: number;
  totalInclVat: number;
  totalExVat: number;
  vatAmount: number;
} {
  const round = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
  const lines = (input.lines || [])
    .filter((l) => String(l.description || '').trim())
    .map((l, i) => {
      const quantity = Math.max(0, Number(l.quantity) || 0);
      const unitPriceInclVat = Math.max(0, round(Number(l.unitPriceInclVat) || 0));
      return {
        ...l,
        sku: String(l.sku || '').trim(),
        description: String(l.description || '').trim(),
        quantity,
        unitPriceInclVat,
        lineTotalInclVat: round(quantity * unitPriceInclVat),
        sortOrder: i
      };
    });
  const discountPercent = Math.min(100, Math.max(0, Number(input.discountPercent) || 0));
  const vatRate = Math.max(0, Number(input.vatRate) || 18);
  const subtotalInclVat = round(lines.reduce((s, l) => s + (l.lineTotalInclVat || 0), 0));
  const discountAmount = round((subtotalInclVat * discountPercent) / 100);
  const totalInclVat = Math.max(0, round(subtotalInclVat - discountAmount));
  const totalExVat = round(totalInclVat / (1 + vatRate / 100));
  const vatAmount = round(totalInclVat - totalExVat);
  return { lines, subtotalInclVat, discountAmount, totalInclVat, totalExVat, vatAmount };
}
