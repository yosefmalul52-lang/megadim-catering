/**
 * Pure helpers for the advanced kitchen report.
 * No DB access — unit-testable.
 */

import {
  dishIdentityKeyFromItem,
  extractBaseProductId,
  findMatchingPricingOption,
  kitchenMissingChoiceLabel,
  parseCompositeSizeIndex,
  parseOptionFromItemName,
  inferSelectedOptionFromCatalog,
  kitchenSizeSortValue,
  looksLikeSizeToken,
  optionFromCatalogIndex,
  stripSizeSuffixFromItemName,
  type CatalogPricingOption
} from './order-item-options.util';

export type { CatalogPricingOption };

export type KitchenMeal =
  | 'ליל שבת'
  | 'שבת בבוקר'
  | 'סעודה שלישית'
  | 'אירוע'
  | 'ארוחה כללית'
  | 'לא משויך';

export type KitchenFulfillment = 'משלוח' | 'איסוף עצמי' | 'לא ידוע';

export type KitchenChangeType =
  | 'items'
  | 'quantity'
  | 'meal'
  | 'preparation'
  | 'delivery'
  | 'fulfillment'
  | 'allergies'
  | 'special_requests'
  | 'cancelled'
  | 'other';

export type KitchenChangeEntry = {
  at: string;
  type: KitchenChangeType;
  summary: string;
  by?: string;
  previousValue?: string;
  newValue?: string;
};

export type KitchenLineSource = {
  orderId: string;
  orderNumber?: string;
  customerName?: string;
  quantity: number;
  meal: KitchenMeal;
  fulfillment: KitchenFulfillment;
};

export type KitchenDishAgg = {
  key: string;
  name: string;
  optionLabel: string;
  sizeLabel: string;
  category: string;
  unit: string;
  quantity: number;
  orderCount: number;
  sources: KitchenLineSource[];
  /** True when option/size must be reviewed before kitchen prep print. */
  missingChoice?: boolean;
};

export type KitchenMealGroup = {
  meal: KitchenMeal;
  dishes: KitchenDishAgg[];
  ordersCount: number;
  portionsTotal: number;
  deliveries: number;
  pickups: number;
};

export type KitchenPrepGroup = {
  preparationKey: string;
  preparationLabel: string;
  preparationAt: string | null;
  isManualPreparation: boolean;
  meals: KitchenMealGroup[];
  ordersCount: number;
  deliveries: number;
  pickups: number;
};

export type KitchenOrderLineItem = {
  productId?: string;
  name: string;
  optionLabel?: string;
  sizeLabel?: string;
  category: string;
  unit: string;
  quantity: number;
  missingChoice?: boolean;
};

/** Canonical kitchen order-type filter keys (not free text). */
export type KitchenOrderKind = 'events' | 'shabbat_ready' | 'catering_shabbat' | 'institutions';
export type KitchenOrderKindFilter = KitchenOrderKind | 'all';

/** Which calendar date drives "orders for this day". */
export type KitchenDateBasis = 'delivery' | 'prep';

export type KitchenOrderNote = {
  orderId: string;
  orderNumber?: string;
  customerName?: string;
  phone?: string;
  address?: string;
  /** Display label — may list multiple meals joined with " + ". */
  meal: string;
  meals: KitchenMeal[];
  fulfillment: KitchenFulfillment;
  preparationLabel: string;
  /** Delivery / fulfillment date (eventDate), separate from prep. */
  deliveryDate?: string | null;
  /** Assigned prep calendar day (manual kitchenPreparationAt), if any. */
  preparationDate?: string | null;
  /** Canonical kind from orderType / cateringKind — never free-text. */
  orderKind: KitchenOrderKind;
  orderKindLabel: string;
  orderType?: string;
  cateringKind?: string;
  deliveryTime?: string;
  city?: string;
  customerNotes?: string;
  adminNotes?: string;
  allergies?: string;
  specialRequests?: string;
  items: KitchenOrderLineItem[];
  itemNotes: Array<{ dishName: string; note: string }>;
  lastChange?: KitchenChangeEntry | null;
  status: string;
  isCancelled: boolean;
  isChanged: boolean;
  /** ISO timestamp of last kitchen print cut for this order, if recorded. */
  lastKitchenPrintAt?: string | null;
};

export type KitchenAlert = {
  id: string;
  kind: 'allergy' | 'change' | 'cancellation';
  severity: 'critical' | 'high' | 'medium';
  title: string;
  detail: string;
  orderId?: string;
  orderNumber?: string;
};

export type KitchenReportSummary = {
  activeOrders: number;
  totalPortions: number;
  distinctDishes: number;
  deliveries: number;
  pickups: number;
  unknownFulfillment: number;
  allergyAlerts: number;
  changedOrders: number;
  cancelledOrders: number;
  /** Line items with missing size/option — block production prep print when > 0. */
  missingChoiceLines: number;
};

export type KitchenReportDTO = {
  generatedAt: string;
  timezone: string;
  range: { startDate: string; endDate: string };
  filters: Record<string, string | boolean | null | undefined>;
  summary: KitchenReportSummary;
  alerts: KitchenAlert[];
  /** Open catering-events outside/alongside the selected range — always shown so ops don't miss them. */
  openEventsAlert?: OpenKitchenEventsAlert | null;
  preparationGroups: KitchenPrepGroup[];
  orderNotes: KitchenOrderNote[];
  cancelledAndChanged: KitchenOrderNote[];
  /** Backward-compatible flat items for the legacy modal. */
  legacyItems: Array<{
    productName: string;
    category: string;
    totalPackages: number;
    totalWeightRaw: number;
    displayWeight: string;
    unit?: string;
    isUnitOnly?: boolean;
  }>;
};

export type OpenKitchenEventOrderRef = {
  orderId: string;
  orderNumber?: string;
  customerName?: string;
  status: string;
  orderKind?: string;
  orderKindLabel?: string;
};

export type OpenKitchenEventsByDate = {
  date: string;
  overdue: boolean;
  count: number;
  orders: OpenKitchenEventOrderRef[];
};

/** Horizon for the kitchen-page open-orders banner (independent of report range). */
export const OPEN_EVENTS_LOOKBACK_DAYS = 30;
export const OPEN_EVENTS_LOOKAHEAD_DAYS = 60;

export type OpenKitchenEventsAlert = {
  window: { from: string; to: string; today: string };
  total: number;
  overdueCount: number;
  upcomingCount: number;
  eventsCount: number;
  byDate: OpenKitchenEventsByDate[];
};

const JERUSALEM = 'Asia/Jerusalem';
const MAX_RANGE_DAYS = 60;

const ACTIVE_STATUSES = new Set(['pending', 'new', 'processing', 'in-progress', 'ready', 'out_for_delivery']);

export function getKitchenTimezone(): string {
  return JERUSALEM;
}

export function getMaxKitchenRangeDays(): number {
  return MAX_RANGE_DAYS;
}

export function isActiveKitchenStatus(status: unknown): boolean {
  return ACTIVE_STATUSES.has(String(status || '').trim());
}

export function addKitchenCalendarDays(dateKey: string, delta: number): string {
  const [y, m, d] = String(dateKey || '')
    .slice(0, 10)
    .split('-')
    .map(Number);
  if (!y || !m || !d) return dateKey;
  const utc = new Date(Date.UTC(y, m - 1, d + delta));
  const yy = utc.getUTCFullYear();
  const mm = String(utc.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(utc.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/**
 * Groups open kitchen orders by eventDate for the kitchen banner.
 * Includes all active order kinds (events, shabbat, etc.) so nothing is missed.
 * Overdue (eventDate < today) listed first, then upcoming dates ascending.
 */
export function buildOpenKitchenEventsAlert(
  orders: any[],
  todayKey = toJerusalemDateKey()
): OpenKitchenEventsAlert {
  const today = parseDateKey(todayKey) || toJerusalemDateKey();
  const from = addKitchenCalendarDays(today, -OPEN_EVENTS_LOOKBACK_DAYS);
  const to = addKitchenCalendarDays(today, OPEN_EVENTS_LOOKAHEAD_DAYS);
  const byDateMap = new Map<string, OpenKitchenEventOrderRef[]>();
  let eventsCount = 0;

  for (const order of orders || []) {
    // Soft-delete = archive (handled). Must not inflate the open/overdue banner.
    if (order?.isDeleted === true) continue;
    if (isCancelledOrder(order)) continue;
    if (!isActiveKitchenStatus(order?.status)) continue;
    const eventDate = parseDateKey(order?.customerDetails?.eventDate);
    if (!eventDate || eventDate < from || eventDate > to) continue;

    const orderKind = classifyKitchenOrderKind(order);
    if (orderKind === 'events') eventsCount += 1;

    const ref: OpenKitchenEventOrderRef = {
      orderId: String(order._id || order.id || ''),
      orderNumber: order.orderNumber ? String(order.orderNumber) : undefined,
      customerName: String(order?.customerDetails?.fullName || '').trim() || undefined,
      status: String(order.status || ''),
      orderKind,
      orderKindLabel: kitchenOrderKindLabel(orderKind)
    };
    if (!ref.orderId) continue;
    const list = byDateMap.get(eventDate) || [];
    list.push(ref);
    byDateMap.set(eventDate, list);
  }

  const byDate: OpenKitchenEventsByDate[] = [...byDateMap.entries()]
    .map(([date, refs]) => ({
      date,
      overdue: date < today,
      count: refs.length,
      orders: refs.slice(0, 12)
    }))
    .sort((a, b) => {
      if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
      return a.date.localeCompare(b.date);
    });

  let overdueCount = 0;
  let upcomingCount = 0;
  for (const row of byDate) {
    if (row.overdue) overdueCount += row.count;
    else upcomingCount += row.count;
  }

  return {
    window: { from, to, today },
    total: overdueCount + upcomingCount,
    overdueCount,
    upcomingCount,
    eventsCount,
    byDate
  };
}

/**
 * True cancellation only — soft-delete (isDeleted) is archive in Megadim ops
 * and must still appear on kitchen reports for the event/delivery date.
 */
export function isCancelledOrder(order: { status?: unknown; isDeleted?: unknown }): boolean {
  return String(order?.status || '').trim() === 'cancelled';
}

export function toJerusalemDateKey(input?: Date | string | null, now = new Date()): string {
  const d = input ? new Date(input) : now;
  if (Number.isNaN(d.getTime())) {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: JERUSALEM,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(now);
  }
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: JERUSALEM,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(d);
}

export function parseDateKey(raw: unknown): string | null {
  const s = String(raw || '').trim();
  if (!s) return null;
  const key = s.includes('T') ? s.slice(0, 10) : s.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
  return key;
}

export function validateKitchenDateRange(startDate?: string, endDate?: string): {
  startDate: string;
  endDate: string;
} {
  const today = toJerusalemDateKey();
  const start = parseDateKey(startDate) || today;
  const end = parseDateKey(endDate) || start;
  if (start > end) {
    const err: any = new Error('startDate must be <= endDate');
    err.statusCode = 400;
    throw err;
  }
  const startMs = Date.parse(`${start}T00:00:00+03:00`);
  const endMs = Date.parse(`${end}T00:00:00+03:00`);
  const days = Math.floor((endMs - startMs) / (24 * 60 * 60 * 1000)) + 1;
  if (days > MAX_RANGE_DAYS) {
    const err: any = new Error(`טווח התאריכים לא יכול לעלות על ${MAX_RANGE_DAYS} ימים`);
    err.statusCode = 400;
    throw err;
  }
  return { startDate: start, endDate: end };
}

export function normalizeFulfillment(customerDetails: any): KitchenFulfillment {
  const cd = customerDetails && typeof customerDetails === 'object' ? customerDetails : {};
  const raw = String(cd.deliveryType || cd.deliveryMethod || '')
    .trim()
    .toLowerCase();
  if (raw === 'delivery' || raw === 'משלוח') return 'משלוח';
  if (raw === 'pickup' || raw === 'איסוף' || raw === 'איסוף עצמי') return 'איסוף עצמי';
  return 'לא ידוע';
}

/**
 * Resolve all kitchen meals an order belongs to.
 * Supports English enums (evening/morning/thirdMeal/both), Hebrew labels, and legacy values.
 * Multi-meal orders (e.g. both) return multiple meals — never collapsed to a single false meal.
 */
export function normalizeMeals(order: any): KitchenMeal[] {
  const mealTime = String(order?.mealTime || '').trim();
  const mealTypes = String(order?.mealTypes || '').trim();
  const combined = `${mealTime} ${mealTypes}`.trim();
  const lower = combined.toLowerCase().replace(/[_-]+/g, ' ');
  const meals = new Set<KitchenMeal>();

  const hasBothToken =
    /\bboth\b/.test(lower) ||
    /ערב\s*(ו|\+|ו־|ו-|\/)?\s*בוקר/.test(combined) ||
    /בוקר\s*(ו|\+|ו־|ו-|\/)?\s*ערב/.test(combined) ||
    /שתי\s*הסעודות|שתי\s*ארוחות/.test(combined);

  if (hasBothToken) {
    meals.add('ליל שבת');
    meals.add('שבת בבוקר');
  }

  if (/\bthird\s*meal\b|\bthirdmeal\b/.test(lower) || /סעודה\s*שלישית/.test(combined)) {
    meals.add('סעודה שלישית');
  } else if (/(^|[\s,])שלישית([\s,]|$)/.test(combined)) {
    meals.add('סעודה שלישית');
  }

  if (
    /\bevening\b/.test(lower) ||
    /\bfriday\b/.test(lower) ||
    /ליל\s*שבת|ערב\s*שבת|כניסת\s*שבת/.test(combined) ||
    /(^|[\s,])ערב([\s,]|$)/.test(combined) ||
    /(^|[\s,])ליל([\s,]|$)/.test(combined)
  ) {
    meals.add('ליל שבת');
  }

  if (
    /\bmorning\b/.test(lower) ||
    /שבת\s*בבוקר/.test(combined) ||
    /(^|[\s,])בוקר([\s,]|$)/.test(combined)
  ) {
    meals.add('שבת בבוקר');
  }

  if (meals.size > 0) return [...meals];

  if (order?.cateringKind === 'events' || order?.eventType) return ['אירוע'];

  // Infer Shabbat meals from item categories (e.g. "סלטים ערב") when mealTime is missing.
  const items = Array.isArray(order?.items) ? order.items : [];
  for (const item of items) {
    const cat = String(item?.category || '');
    if (/ערב/.test(cat)) meals.add('ליל שבת');
    if (/בוקר/.test(cat)) meals.add('שבת בבוקר');
  }
  if (meals.size > 0) return [...meals];

  if (order?.orderType === 'catering' || order?.orderType === 'shabbat') return ['ארוחה כללית'];
  if (combined) return ['ארוחה כללית'];
  return ['לא משויך'];
}

/** Primary meal label for single-value contexts; multi-meal returns the first in stable order. */
export function normalizeMeal(order: any): KitchenMeal {
  const meals = normalizeMeals(order);
  const orderRank: KitchenMeal[] = [
    'ליל שבת',
    'שבת בבוקר',
    'סעודה שלישית',
    'אירוע',
    'ארוחה כללית',
    'לא משויך'
  ];
  for (const m of orderRank) {
    if (meals.includes(m)) return m;
  }
  return meals[0] || 'לא משויך';
}

export function formatOrderMealsLabel(meals: KitchenMeal[]): string {
  return meals.length ? meals.join(' + ') : 'לא משויך';
}

export function mealFilterActive(meal: string | null | undefined): meal is string {
  return !!meal && meal !== 'הכל';
}

export function extractDeliveryCity(customerDetails: any): string {
  const cd = customerDetails && typeof customerDetails === 'object' ? customerDetails : {};
  const nested = cd.deliveryDetails && typeof cd.deliveryDetails === 'object' ? cd.deliveryDetails : {};
  return String(nested.city || cd.city || cd.deliveryCity || '').trim();
}

export function extractDeliveryTime(customerDetails: any): string {
  const cd = customerDetails && typeof customerDetails === 'object' ? customerDetails : {};
  return String(cd.preferredDeliveryTime || '').trim();
}

export function extractCustomerNotes(customerDetails: any): string {
  const cd = customerDetails && typeof customerDetails === 'object' ? customerDetails : {};
  return String(cd.notes || cd.comments || '').trim();
}

export function extractCustomerName(customerDetails: any): string {
  const cd = customerDetails && typeof customerDetails === 'object' ? customerDetails : {};
  return String(cd.fullName || cd.name || '').trim();
}

export function extractCustomerPhone(customerDetails: any): string {
  const cd = customerDetails && typeof customerDetails === 'object' ? customerDetails : {};
  return String(cd.phone || cd.phoneNumber || cd.mobile || '').trim();
}

export function extractCustomerAddress(customerDetails: any): string {
  const cd = customerDetails && typeof customerDetails === 'object' ? customerDetails : {};
  const nested = cd.deliveryDetails && typeof cd.deliveryDetails === 'object' ? cd.deliveryDetails : {};
  const parts = [
    nested.street || cd.street || cd.address,
    nested.houseNumber || cd.houseNumber || cd.buildingNumber,
    nested.apartment || cd.apartment,
    nested.city || cd.city || cd.deliveryCity,
    nested.entrance || cd.entrance,
    nested.floor || cd.floor
  ]
    .map((p) => String(p || '').trim())
    .filter(Boolean);
  if (parts.length) return parts.join(', ');
  return String(cd.fullAddress || cd.addressLine || nested.fullAddress || '').trim();
}

/** Prefer explicit order.allergies; never auto-classify free-text notes as allergies. */
export function extractAllergies(order: any): string {
  return String(order?.allergies || '').trim();
}

export function extractSpecialRequests(order: any): string {
  const root = String(order?.specialRequests || '').trim();
  if (root) return root;
  const cd = order?.customerDetails && typeof order.customerDetails === 'object' ? order.customerDetails : {};
  return String(cd.specialRequests || '').trim();
}

/**
 * Classify an Order document into kitchen report kinds using enum fields only.
 * - events: cateringKind === 'events'
 * - catering_shabbat: catering Shabbat/holiday events
 * - shabbat_ready: cart ready-for-Shabbat (orderType === 'shabbat')
 * Institutions live on InstitutionOrder and are tagged separately by the service layer.
 */
export function classifyKitchenOrderKind(order: any): Exclude<KitchenOrderKind, 'institutions'> {
  if (order?.cateringKind === 'events') return 'events';
  if (order?.cateringKind === 'shabbat' || order?.orderType === 'catering') return 'catering_shabbat';
  if (order?.orderType === 'shabbat') return 'shabbat_ready';
  return 'shabbat_ready';
}

export function kitchenOrderKindLabel(kind: KitchenOrderKind): string {
  if (kind === 'events') return 'קייטרינג לאירועים';
  if (kind === 'catering_shabbat') return 'קייטרינג לאירועי שבת וחג';
  if (kind === 'institutions') return 'מוסדות';
  return 'אוכל מוכן לשבת וחג';
}

export function parseKitchenOrderKindFilter(raw: unknown): KitchenOrderKindFilter {
  const s = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/-/g, '_');
  if (!s || s === 'all' || s === 'הכול' || s === 'הכל') return 'all';
  if (s === 'events' || s === 'event') return 'events';
  if (
    s === 'catering_shabbat' ||
    s === 'shabbat_catering' ||
    s === 'shabbat_events' ||
    s === 'catering_shabbat_events'
  ) {
    return 'catering_shabbat';
  }
  if (s === 'shabbat_ready' || s === 'shabbat' || s === 'ready') return 'shabbat_ready';
  if (s === 'institutions' || s === 'institution') return 'institutions';
  const err: any = new Error('Invalid orderKind');
  err.statusCode = 400;
  throw err;
}

export function orderMatchesKitchenOrderKind(
  order: any,
  orderKind: KitchenOrderKindFilter
): boolean {
  if (orderKind === 'all') return true;
  if (orderKind === 'institutions') {
    return order?.orderKind === 'institutions' || order?.__kitchenOrderKind === 'institutions';
  }
  return classifyKitchenOrderKind(order) === orderKind;
}

export function parseKitchenDateBasis(raw: unknown): KitchenDateBasis {
  const s = String(raw || '')
    .trim()
    .toLowerCase();
  if (!s || s === 'delivery' || s === 'fulfillment' || s === 'event') return 'delivery';
  if (s === 'prep' || s === 'preparation') return 'prep';
  const err: any = new Error('Invalid dateBasis');
  err.statusCode = 400;
  throw err;
}

/**
 * Resolve preparation instant.
 * Manual kitchenPreparationAt wins; else eventDate (+ optional preferred time).
 * Delivery (eventDate) and prep day are returned separately — never conflated.
 */
export function resolvePreparation(order: any, now = new Date()): {
  preparationAt: Date | null;
  preparationKey: string;
  preparationLabel: string;
  isManualPreparation: boolean;
  eventDateKey: string | null;
  preparationDateKey: string | null;
} {
  const cd = order?.customerDetails && typeof order.customerDetails === 'object' ? order.customerDetails : {};
  const eventDateKey = parseDateKey(cd.eventDate);
  const manual = order?.kitchenPreparationAt ? new Date(order.kitchenPreparationAt) : null;
  if (manual && !Number.isNaN(manual.getTime())) {
    const key = toJerusalemDateKey(manual, now);
    const time = new Intl.DateTimeFormat('he-IL', {
      timeZone: JERUSALEM,
      hour: '2-digit',
      minute: '2-digit'
    }).format(manual);
    return {
      preparationAt: manual,
      preparationKey: `${key}T${time}`,
      preparationLabel: `${key} · ${time}`,
      isManualPreparation: true,
      eventDateKey,
      preparationDateKey: key
    };
  }

  const deliveryTime = extractDeliveryTime(cd);
  if (eventDateKey) {
    const label = deliveryTime ? `${eventDateKey} · ${deliveryTime}` : eventDateKey;
    return {
      preparationAt: null,
      preparationKey: label,
      preparationLabel: `${label} (לפי אספקה)`,
      isManualPreparation: false,
      eventDateKey,
      preparationDateKey: null
    };
  }

  return {
    preparationAt: null,
    preparationKey: 'ללא מועד',
    preparationLabel: 'ללא מועד',
    isManualPreparation: false,
    eventDateKey: null,
    preparationDateKey: null
  };
}

export function dishIdentityKey(item: {
  productId?: unknown;
  name?: unknown;
  selectedOption?: { label?: unknown; amount?: unknown };
  category?: unknown;
}): string {
  return dishIdentityKeyFromItem(item);
}

/** Resolve option/size labels for kitchen rows — order data first, never invent aliases. */
export function resolveKitchenOptionLabels(
  item: {
    name?: unknown;
    price?: unknown;
    productId?: unknown;
    selectedOption?: {
      label?: unknown;
      amount?: unknown;
      missingForReview?: unknown;
    } | null;
  },
  catalogOptions?: CatalogPricingOption[] | null
): { optionLabel: string; sizeLabel: string } {
  const missing = kitchenMissingChoiceLabel(item);
  if (missing) {
    return { optionLabel: missing, sizeLabel: '' };
  }

  const fromOptLabel = String(item?.selectedOption?.label || '').trim();
  const fromOptAmount = String(item?.selectedOption?.amount || '').trim();
  if (fromOptLabel || fromOptAmount) {
    // Structured choice from checkout/admin is authoritative.
    return { optionLabel: fromOptLabel, sizeLabel: fromOptAmount };
  }

  const fromIndex = optionFromCatalogIndex(
    catalogOptions,
    parseCompositeSizeIndex(item?.productId)
  );
  if (fromIndex) {
    return {
      optionLabel: String(fromIndex.label || '').trim(),
      sizeLabel: String(fromIndex.amount || '').trim()
    };
  }

  const parsed = parseOptionFromItemName(item?.name);
  if (parsed.label && looksLikeSizeToken(parsed.label)) {
    // Prefer catalog label when the encoded size matches a known option.
    const matched = findMatchingPricingOption(catalogOptions, {
      label: parsed.label,
      amount: parsed.amount
    });
    if (matched) {
      const snap = optionFromCatalogIndex(catalogOptions, matched.index);
      if (snap) {
        return {
          optionLabel: String(snap.label || '').trim(),
          sizeLabel: String(snap.amount || '').trim()
        };
      }
    }
    return {
      optionLabel: String(parsed.label || '').trim(),
      sizeLabel: String(parsed.amount || '').trim()
    };
  }

  const inferred = inferSelectedOptionFromCatalog(item, catalogOptions);
  if (inferred?.missingForReview) {
    return { optionLabel: 'בחירה חסרה לבדיקה', sizeLabel: '' };
  }
  if (inferred && (inferred.label || inferred.amount)) {
    return {
      optionLabel: String(inferred.label || '').trim(),
      sizeLabel: String(inferred.amount || '').trim()
    };
  }

  return { optionLabel: '', sizeLabel: '' };
}

export type MenuKitchenMeta = {
  category: string;
  pricingOptions: CatalogPricingOption[];
};

export function sortKitchenLinesByDishThenSize<
  T extends { name?: string; optionLabel?: string; sizeLabel?: string; category?: string }
>(lines: T[]): T[] {
  return [...lines].sort((a, b) => {
    const cat = String(a.category || '').localeCompare(String(b.category || ''), 'he');
    if (cat) return cat;
    const name = String(a.name || '').localeCompare(String(b.name || ''), 'he');
    if (name) return name;
    const sa = kitchenSizeSortValue(a.sizeLabel, a.optionLabel);
    const sb = kitchenSizeSortValue(b.sizeLabel, b.optionLabel);
    if (sa !== sb) return sa - sb;
    return String(a.optionLabel || '').localeCompare(String(b.optionLabel || ''), 'he');
  });
}

/**
 * Kitchen quantity unit = number of packages/portions the customer ordered.
 * Container size (e.g. 250 מ"ל) belongs in גודל/אפשרות — never as the qty unit.
 */
export function parseUnitFromItem(_item?: unknown): string {
  return "יח'";
}

/**
 * Effective kitchen quantity for a line.
 * Catering dishes often store quantity=1 and scale by portions + meal category.
 * Uses items[] only — never double-counts salads/firstCourses arrays.
 */
export function effectiveLineQuantity(order: any, item: any): number {
  const base = Number(item?.quantity);
  const qty = Number.isFinite(base) && base > 0 ? base : 0;
  if (qty <= 0) return 0;

  const isCatering =
    order?.orderType === 'catering' ||
    (String(order?.mealTime || '').trim() !== '' && Number(order?.numberOfPortions) > 0);

  if (!isCatering) return qty;

  const cat = String(item?.category || '');
  const portionsEvening = Math.max(0, Number(order?.portionsEvening) || 0);
  const portionsMorning = Math.max(0, Number(order?.portionsMorning) || 0);
  const numberOfPortions = Math.max(0, Number(order?.numberOfPortions) || 0);
  const fallback = Math.max(numberOfPortions, 1);

  if (/ערב/.test(cat)) {
    return qty * (portionsEvening > 0 ? portionsEvening : fallback);
  }
  if (/בוקר/.test(cat)) {
    return qty * (portionsMorning > 0 ? portionsMorning : fallback);
  }
  return qty * fallback;
}

export function mealFromItemCategory(
  itemCategory: string,
  orderMeals: KitchenMeal | KitchenMeal[]
): KitchenMeal {
  const cat = String(itemCategory || '');
  if (/ערב/.test(cat)) return 'ליל שבת';
  if (/בוקר/.test(cat)) return 'שבת בבוקר';
  const meals = Array.isArray(orderMeals) ? orderMeals : [orderMeals];
  if (meals.length === 1) return meals[0];
  // Multi-meal order without item meal hint: keep once under general (never double-count).
  return 'ארוחה כללית';
}

/** Whether an order (by order meals or item categories) touches the selected meal filter. */
export function orderTouchesMealFilter(
  order: any,
  items: any[],
  mealFilter: string | null
): boolean {
  if (!mealFilterActive(mealFilter)) return true;
  const orderMeals = normalizeMeals(order);
  if (orderMeals.includes(mealFilter as KitchenMeal)) return true;
  for (const item of items || []) {
    const cat = String(item?.category || '');
    if (mealFromItemCategory(cat, orderMeals) === mealFilter) return true;
  }
  return false;
}

export function summarizeKitchenChanges(log: unknown): KitchenChangeEntry | null {
  if (!Array.isArray(log) || !log.length) return null;
  const last = log[log.length - 1] || {};
  const at = last.at ? new Date(last.at).toISOString() : '';
  if (!at) return null;
  return {
    at,
    type: (last.type as KitchenChangeType) || 'other',
    summary: String(last.summary || '').trim() || 'עודכן',
    by: last.by ? String(last.by) : undefined,
    previousValue:
      last.previousValue != null && String(last.previousValue).trim()
        ? String(last.previousValue)
        : undefined,
    newValue:
      last.newValue != null && String(last.newValue).trim() ? String(last.newValue) : undefined
  };
}

export function buildKitchenChangeEntry(
  type: KitchenChangeType,
  summary: string,
  by?: string,
  at = new Date(),
  meta?: { previousValue?: string; newValue?: string }
): KitchenChangeEntry {
  return {
    at: at.toISOString(),
    type,
    summary: String(summary || '').trim() || 'עודכן',
    by: by ? String(by).trim() : undefined,
    previousValue:
      meta?.previousValue != null && String(meta.previousValue).trim()
        ? String(meta.previousValue).trim().slice(0, 500)
        : undefined,
    newValue:
      meta?.newValue != null && String(meta.newValue).trim()
        ? String(meta.newValue).trim().slice(0, 500)
        : undefined
  };
}

export function validateKitchenReportQuery(query: Record<string, unknown>): {
  startDate: string;
  endDate: string;
  meal: string | null;
  fulfillmentType: string | null;
  preparationSlot: string | null;
  includeCancelled: boolean;
  changedOnly: boolean;
  search: string | null;
  includeCatering: boolean;
  orderKind: KitchenOrderKindFilter;
  dateBasis: KitchenDateBasis;
} {
  const startRaw =
    (typeof query.startDate === 'string' && query.startDate) ||
    (typeof query.date === 'string' && query.date) ||
    undefined;
  const endRaw =
    (typeof query.endDate === 'string' && query.endDate) ||
    (typeof query.date === 'string' && query.date) ||
    startRaw;
  const { startDate, endDate } = validateKitchenDateRange(startRaw, endRaw);

  const meal = typeof query.meal === 'string' && query.meal.trim() ? query.meal.trim() : null;
  const fulfillmentType =
    typeof query.fulfillmentType === 'string' && query.fulfillmentType.trim()
      ? query.fulfillmentType.trim()
      : null;
  const preparationSlot =
    typeof query.preparationSlot === 'string' && query.preparationSlot.trim()
      ? query.preparationSlot.trim()
      : null;
  const includeCancelled = query.includeCancelled === true || query.includeCancelled === 'true' || query.includeCancelled === '1';
  const changedOnly = query.changedOnly === true || query.changedOnly === 'true' || query.changedOnly === '1';
  const search = typeof query.search === 'string' && query.search.trim() ? query.search.trim() : null;
  const includeCatering =
    query.includeCatering === undefined
      ? true
      : query.includeCatering === true || query.includeCatering === 'true' || query.includeCatering === '1';
  const orderKind = parseKitchenOrderKindFilter(query.orderKind);
  const dateBasis = parseKitchenDateBasis(query.dateBasis);

  if (fulfillmentType && !['משלוח', 'איסוף עצמי', 'לא ידוע', 'delivery', 'pickup', 'unknown'].includes(fulfillmentType)) {
    const err: any = new Error('Invalid fulfillmentType');
    err.statusCode = 400;
    throw err;
  }

  return {
    startDate,
    endDate,
    meal,
    fulfillmentType,
    preparationSlot,
    includeCancelled,
    changedOnly,
    search,
    includeCatering,
    orderKind,
    dateBasis
  };
}

function mapFulfillmentFilter(raw: string | null): KitchenFulfillment | null {
  if (!raw) return null;
  if (raw === 'delivery' || raw === 'משלוח') return 'משלוח';
  if (raw === 'pickup' || raw === 'איסוף עצמי') return 'איסוף עצמי';
  if (raw === 'unknown' || raw === 'לא ידוע') return 'לא ידוע';
  return raw as KitchenFulfillment;
}

export function orderMatchesKitchenRange(
  order: any,
  startDate: string,
  endDate: string,
  dateBasis: KitchenDateBasis = 'delivery'
): boolean {
  const prep = resolvePreparation(order);
  let key: string | null = null;
  if (dateBasis === 'prep') {
    key =
      prep.preparationDateKey ||
      (prep.preparationAt ? toJerusalemDateKey(prep.preparationAt) : null) ||
      prep.eventDateKey;
  } else {
    // Delivery / fulfillment day — never fall back to prep when eventDate exists.
    key = prep.eventDateKey || (prep.preparationAt ? toJerusalemDateKey(prep.preparationAt) : null);
  }
  if (!key) return false;
  return key >= startDate && key <= endDate;
}

/**
 * Build the advanced kitchen report DTO from lean order documents.
 * MenuItem lookup map is optional: only fills missing category (never overwrites snapshot name).
 */
export function buildKitchenReportDto(
  orders: any[],
  filters: ReturnType<typeof validateKitchenReportQuery>,
  menuMetaByProductId: Map<string, string | MenuKitchenMeta> = new Map(),
  now = new Date()
): KitchenReportDTO {
  const fulfillmentFilter = mapFulfillmentFilter(filters.fulfillmentType);
  const alerts: KitchenAlert[] = [];
  const orderNotes: KitchenOrderNote[] = [];
  const cancelledAndChanged: KitchenOrderNote[] = [];

  type AccDish = KitchenDishAgg & { _sourceIds: Set<string> };
  type AccMeal = { meal: KitchenMeal; dishes: Map<string, AccDish>; orderIds: Set<string>; deliveries: number; pickups: number; portions: number };
  type AccPrep = {
    preparationKey: string;
    preparationLabel: string;
    preparationAt: string | null;
    isManualPreparation: boolean;
    meals: Map<KitchenMeal, AccMeal>;
    orderIds: Set<string>;
    deliveries: number;
    pickups: number;
  };

  const prepMap = new Map<string, AccPrep>();
  let activeOrders = 0;
  let totalPortions = 0;
  let deliveries = 0;
  let pickups = 0;
  let unknownFulfillment = 0;
  let allergyAlerts = 0;
  let changedOrders = 0;
  let cancelledOrders = 0;
  const distinctDishKeys = new Set<string>();

  for (const order of orders || []) {
    const cancelled = isCancelledOrder(order);
    const active = !cancelled && isActiveKitchenStatus(order.status);
    if (!filters.includeCatering) {
      const isCatering =
        order?.orderType === 'catering' ||
        order?.numberOfPortions != null ||
        String(order?.mealTime || '').trim() !== '';
      if (isCatering) continue;
    }

    if (!orderMatchesKitchenOrderKind(order, filters.orderKind)) continue;

    if (!orderMatchesKitchenRange(order, filters.startDate, filters.endDate, filters.dateBasis)) continue;

    const fulfillment = normalizeFulfillment(order.customerDetails);
    if (fulfillmentFilter && fulfillment !== fulfillmentFilter) continue;

    const orderMeals = normalizeMeals(order);
    const mealFilter = mealFilterActive(filters.meal) ? filters.meal : null;
    const items = Array.isArray(order.items) ? order.items : [];
    if (!orderTouchesMealFilter(order, items, mealFilter)) continue;

    const prep = resolvePreparation(order, now);
    if (filters.preparationSlot && filters.preparationSlot !== prep.preparationKey) continue;

    const search = filters.search?.toLowerCase() || '';
    const orderNumber = String(order.orderNumber || '');
    const customerName = extractCustomerName(order.customerDetails);
    if (search) {
      const hay = `${orderNumber} ${customerName} ${String(order._id || '')}`.toLowerCase();
      if (!hay.includes(search)) continue;
    }

    const lastChange = summarizeKitchenChanges(order.kitchenChangeLog);
    const isChanged = !!lastChange;
    if (filters.changedOnly && !isChanged && !cancelled) continue;

    const allergies = extractAllergies(order);
    const specialRequests = extractSpecialRequests(order);
    const customerNotes = extractCustomerNotes(order.customerDetails);
    const adminNotes = String(order.adminNotes || '').trim();
    const city = extractDeliveryCity(order.customerDetails);
    const deliveryTime = extractDeliveryTime(order.customerDetails);
    const phone = extractCustomerPhone(order.customerDetails);
    const address = extractCustomerAddress(order.customerDetails);

    const itemNotes: Array<{ dishName: string; note: string }> = [];
    const orderItems: KitchenOrderLineItem[] = [];

    const orderKind =
      (order?.__kitchenOrderKind as KitchenOrderKind) ||
      (order?.orderKind as KitchenOrderKind) ||
      classifyKitchenOrderKind(order);

    const noteRow: KitchenOrderNote = {
      orderId: String(order._id || order.id || ''),
      orderNumber: orderNumber || undefined,
      customerName: customerName || undefined,
      phone: phone || undefined,
      address: address || undefined,
      meal: formatOrderMealsLabel(orderMeals),
      meals: orderMeals,
      fulfillment,
      preparationLabel: prep.preparationLabel,
      deliveryDate: prep.eventDateKey,
      preparationDate: prep.preparationDateKey,
      orderKind,
      orderKindLabel: kitchenOrderKindLabel(orderKind),
      orderType: order?.orderType ? String(order.orderType) : undefined,
      cateringKind: order?.cateringKind ? String(order.cateringKind) : undefined,
      deliveryTime: deliveryTime || undefined,
      city: city || undefined,
      customerNotes: customerNotes || undefined,
      adminNotes: adminNotes || undefined,
      allergies: allergies || undefined,
      specialRequests: specialRequests || undefined,
      items: orderItems,
      itemNotes,
      lastChange,
      status: String(order.status || ''),
      isCancelled: cancelled,
      isChanged,
      lastKitchenPrintAt: order?.lastKitchenPrintAt
        ? new Date(order.lastKitchenPrintAt).toISOString()
        : null
    };

    if (cancelled) {
      cancelledOrders += 1;
      cancelledAndChanged.push(noteRow);
      alerts.push({
        id: `cancel-${noteRow.orderId}`,
        kind: 'cancellation',
        severity: 'high',
        title: 'הזמנה בוטלה',
        detail: `${orderNumber || noteRow.orderId} הוסרה מהכנה הפעילה`,
        orderId: noteRow.orderId,
        orderNumber: orderNumber || undefined
      });
      continue;
    }

    if (!active) continue;

    if (filters.changedOnly && !isChanged) continue;

    // Aggregate dishes first; only count the order in summaries if it contributes matching lines.
    const matchedLines: Array<{
      name: string;
      qty: number;
      category: string;
      lineMeal: KitchenMeal;
      optionLabel: string;
      sizeLabel: string;
      unit: string;
      key: string;
      description: string;
      productId?: string;
      missingChoice?: boolean;
    }> = [];

    for (const item of items) {
      const name = String(item?.name || '').trim();
      if (!name) continue;
      const qty = effectiveLineQuantity(order, item);
      if (qty <= 0) continue;

      let category = String(item?.category || '').trim();
      const productId = String(item?.productId || '').trim();
      const baseProductId = extractBaseProductId(productId) || productId;
      const menuMeta = menuMetaByProductId.get(productId) || menuMetaByProductId.get(baseProductId);
      const menuCategory =
        typeof menuMeta === 'string' ? menuMeta : menuMeta?.category || '';
      const catalogOptions =
        typeof menuMeta === 'object' && menuMeta ? menuMeta.pricingOptions : undefined;
      if (!category && menuCategory) {
        category = menuCategory;
      }
      if (!category) category = 'כללי';

      const lineMeal = mealFromItemCategory(category, orderMeals);
      if (mealFilter && lineMeal !== mealFilter) continue;

      const desc = String(item?.description || '').trim();
      const labels = resolveKitchenOptionLabels(item, catalogOptions);
      const missingChoice = labels.optionLabel === 'בחירה חסרה לבדיקה';
      const displayName = stripSizeSuffixFromItemName(name) || name;
      const effectiveOption = item?.selectedOption?.label || item?.selectedOption?.amount
        ? item.selectedOption
        : labels.optionLabel || labels.sizeLabel
          ? { label: labels.optionLabel, amount: labels.sizeLabel, missingForReview: missingChoice }
          : item?.selectedOption;
      matchedLines.push({
        name: displayName,
        qty,
        category,
        lineMeal,
        optionLabel: labels.optionLabel,
        sizeLabel: labels.sizeLabel,
        unit: parseUnitFromItem({
          ...item,
          selectedOption: effectiveOption || item?.selectedOption
        }),
        key: dishIdentityKey({
          productId: item?.productId,
          name,
          selectedOption: effectiveOption || {
            label: labels.optionLabel,
            amount: labels.sizeLabel
          },
          category
        }),
        description: desc,
        productId: String(item?.productId || '').trim() || undefined,
        missingChoice
      });
    }

    if (!matchedLines.length) continue;

    activeOrders += 1;
    if (fulfillment === 'משלוח') deliveries += 1;
    else if (fulfillment === 'איסוף עצמי') pickups += 1;
    else unknownFulfillment += 1;
    if (isChanged) {
      changedOrders += 1;
      cancelledAndChanged.push(noteRow);
      alerts.push({
        id: `change-${noteRow.orderId}-${lastChange?.at || ''}`,
        kind: 'change',
        severity: 'medium',
        title: 'הזמנה עודכנה',
        detail: lastChange?.summary || 'שינוי תפעולי',
        orderId: noteRow.orderId,
        orderNumber: orderNumber || undefined
      });
    }
    if (allergies) {
      allergyAlerts += 1;
      alerts.push({
        id: `allergy-${noteRow.orderId}`,
        kind: 'allergy',
        severity: 'critical',
        title: 'אלרגיה',
        detail: `${customerName || orderNumber || 'הזמנה'}: ${allergies}`,
        orderId: noteRow.orderId,
        orderNumber: orderNumber || undefined
      });
    }

    if (!prepMap.has(prep.preparationKey)) {
      prepMap.set(prep.preparationKey, {
        preparationKey: prep.preparationKey,
        preparationLabel: prep.preparationLabel,
        preparationAt: prep.preparationAt ? prep.preparationAt.toISOString() : null,
        isManualPreparation: prep.isManualPreparation,
        meals: new Map(),
        orderIds: new Set(),
        deliveries: 0,
        pickups: 0
      });
    }
    const prepGroup = prepMap.get(prep.preparationKey)!;
    prepGroup.orderIds.add(noteRow.orderId);
    if (fulfillment === 'משלוח') prepGroup.deliveries += 1;
    if (fulfillment === 'איסוף עצמי') prepGroup.pickups += 1;

    for (const line of matchedLines) {
      if (line.description) itemNotes.push({ dishName: line.name, note: line.description });
      orderItems.push({
        productId: line.productId,
        name: line.name,
        optionLabel: line.optionLabel || undefined,
        sizeLabel: line.sizeLabel || undefined,
        category: line.category,
        unit: line.unit,
        quantity: line.qty,
        missingChoice: line.missingChoice || undefined
      });

      if (!prepGroup.meals.has(line.lineMeal)) {
        prepGroup.meals.set(line.lineMeal, {
          meal: line.lineMeal,
          dishes: new Map(),
          orderIds: new Set(),
          deliveries: 0,
          pickups: 0,
          portions: 0
        });
      }
      const mealGroup = prepGroup.meals.get(line.lineMeal)!;
      mealGroup.orderIds.add(noteRow.orderId);
      mealGroup.portions += line.qty;
      totalPortions += line.qty;
      distinctDishKeys.add(line.key);

      if (!mealGroup.dishes.has(line.key)) {
        mealGroup.dishes.set(line.key, {
          key: line.key,
          name: line.name,
          optionLabel: line.optionLabel,
          sizeLabel: line.sizeLabel,
          category: line.category,
          unit: line.unit,
          quantity: 0,
          orderCount: 0,
          sources: [],
          missingChoice: line.missingChoice === true,
          _sourceIds: new Set()
        });
      }
      const dish = mealGroup.dishes.get(line.key)!;
      dish.quantity += line.qty;
      if (line.missingChoice) dish.missingChoice = true;
      if (!dish._sourceIds.has(noteRow.orderId)) {
        dish._sourceIds.add(noteRow.orderId);
        dish.orderCount += 1;
      }
      dish.sources.push({
        orderId: noteRow.orderId,
        orderNumber: orderNumber || undefined,
        customerName: customerName || undefined,
        quantity: line.qty,
        meal: line.lineMeal,
        fulfillment
      });
    }

    const sortedItems = sortKitchenLinesByDishThenSize(orderItems);
    orderItems.length = 0;
    orderItems.push(...sortedItems);

    orderNotes.push(noteRow);
  }

  const preparationGroups: KitchenPrepGroup[] = [...prepMap.values()]
    .map((pg) => ({
      preparationKey: pg.preparationKey,
      preparationLabel: pg.preparationLabel,
      preparationAt: pg.preparationAt,
      isManualPreparation: pg.isManualPreparation,
      ordersCount: pg.orderIds.size,
      deliveries: pg.deliveries,
      pickups: pg.pickups,
      meals: [...pg.meals.values()]
        .map((mg) => ({
          meal: mg.meal,
          ordersCount: mg.orderIds.size,
          portionsTotal: mg.portions,
          deliveries: mg.deliveries,
          pickups: mg.pickups,
          dishes: sortKitchenLinesByDishThenSize(
            [...mg.dishes.values()].map(({ _sourceIds, ...rest }) => rest)
          )
        }))
        .filter((mg) => mg.dishes.length > 0)
        .sort((a, b) => a.meal.localeCompare(b.meal, 'he'))
    }))
    .filter((pg) => pg.meals.length > 0)
    .sort((a, b) => a.preparationKey.localeCompare(b.preparationKey, 'he'));

  const legacyMap = new Map<string, { productName: string; category: string; totalPackages: number }>();
  for (const pg of preparationGroups) {
    for (const mg of pg.meals) {
      for (const d of mg.dishes) {
        const k = `${d.category}||${d.name}||${d.optionLabel}||${d.sizeLabel}`;
        const prev = legacyMap.get(k);
        if (prev) prev.totalPackages += d.quantity;
        else legacyMap.set(k, { productName: d.name, category: d.category, totalPackages: d.quantity });
      }
    }
  }

  alerts.sort((a, b) => {
    const rank = { critical: 0, high: 1, medium: 2 } as const;
    return rank[a.severity] - rank[b.severity];
  });

  let missingChoiceLines = 0;
  for (const o of orderNotes) {
    for (const it of o.items || []) {
      if (it.missingChoice || it.optionLabel === 'בחירה חסרה לבדיקה') missingChoiceLines += 1;
    }
  }

  return {
    generatedAt: now.toISOString(),
    timezone: JERUSALEM,
    range: { startDate: filters.startDate, endDate: filters.endDate },
    filters: {
      meal: filters.meal,
      fulfillmentType: filters.fulfillmentType,
      preparationSlot: filters.preparationSlot,
      includeCancelled: filters.includeCancelled,
      changedOnly: filters.changedOnly,
      search: filters.search,
      includeCatering: filters.includeCatering,
      orderKind: filters.orderKind,
      dateBasis: filters.dateBasis
    },
    summary: {
      activeOrders,
      totalPortions,
      distinctDishes: distinctDishKeys.size,
      deliveries,
      pickups,
      unknownFulfillment,
      allergyAlerts,
      changedOrders,
      cancelledOrders,
      missingChoiceLines
    },
    alerts: alerts.slice(0, 50),
    openEventsAlert: null,
    preparationGroups,
    orderNotes,
    cancelledAndChanged,
    legacyItems: [...legacyMap.values()].map((x) => ({
      productName: x.productName,
      category: x.category,
      totalPackages: x.totalPackages,
      totalWeightRaw: 0,
      displayWeight: String(x.totalPackages),
      unit: "יח'",
      isUnitOnly: true
    }))
  };
}

export function kitchenReportToCsv(report: KitchenReportDTO): string {
  const rows: string[][] = [
    ['תאריך הכנה', 'ארוחה', 'קטגוריה', 'מנה', 'אפשרות', 'גודל', 'כמות', 'יחידה', 'מספר הזמנות']
  ];
  for (const pg of report.preparationGroups) {
    for (const mg of pg.meals) {
      for (const d of mg.dishes) {
        rows.push([
          pg.preparationLabel,
          mg.meal,
          d.category,
          d.name,
          d.optionLabel,
          d.sizeLabel,
          String(d.quantity),
          d.unit,
          String(d.orderCount)
        ]);
      }
    }
  }
  return rows.map((r) => r.map(csvEscape).join(',')).join('\r\n');
}

function csvEscape(value: string): string {
  const s = String(value ?? '');
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function withBom(csv: string): Buffer {
  return Buffer.from(`\uFEFF${csv}`, 'utf8');
}
