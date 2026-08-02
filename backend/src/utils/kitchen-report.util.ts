/**
 * Pure helpers for the advanced kitchen report.
 * No DB access — unit-testable.
 */

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

export type KitchenOrderNote = {
  orderId: string;
  orderNumber?: string;
  customerName?: string;
  meal: KitchenMeal;
  fulfillment: KitchenFulfillment;
  preparationLabel: string;
  deliveryTime?: string;
  city?: string;
  customerNotes?: string;
  adminNotes?: string;
  allergies?: string;
  specialRequests?: string;
  itemNotes: Array<{ dishName: string; note: string }>;
  lastChange?: KitchenChangeEntry | null;
  status: string;
  isCancelled: boolean;
  isChanged: boolean;
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
};

export type KitchenReportDTO = {
  generatedAt: string;
  timezone: string;
  range: { startDate: string; endDate: string };
  filters: Record<string, string | boolean | null | undefined>;
  summary: KitchenReportSummary;
  alerts: KitchenAlert[];
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

const JERUSALEM = 'Asia/Jerusalem';
const MAX_RANGE_DAYS = 31;

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

export function isCancelledOrder(order: { status?: unknown; isDeleted?: unknown }): boolean {
  if (order?.isDeleted === true) return true;
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
    const err: any = new Error(`Date range cannot exceed ${MAX_RANGE_DAYS} days`);
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

export function normalizeMeal(order: any): KitchenMeal {
  const mealTime = String(order?.mealTime || '').trim();
  const mealTypes = String(order?.mealTypes || '').trim();
  const combined = `${mealTime} ${mealTypes}`.trim();
  const lower = combined.toLowerCase();

  if (/סעודה\s*שלישית|שלישית/.test(combined)) return 'סעודה שלישית';
  if (/ליל|ערב|כניסת\s*שבת|friday|evening/.test(lower) || /ערב/.test(combined)) {
    if (/בוקר|morning/.test(lower) && /ערב|ליל/.test(combined)) {
      // Both meals listed — keep as general unless clearly one
    } else if (/ערב|ליל/.test(combined)) {
      return 'ליל שבת';
    }
  }
  if (/בוקר|morning|שבת\s*בבוקר/.test(lower) || /בוקר/.test(combined)) return 'שבת בבוקר';
  if (/ליל\s*שבת|ערב\s*שבת/.test(combined)) return 'ליל שבת';

  if (order?.cateringKind === 'events' || order?.eventType) return 'אירוע';
  if (order?.orderType === 'catering' || order?.orderType === 'shabbat') {
    if (combined) return 'ארוחה כללית';
    return 'ארוחה כללית';
  }
  if (combined) return 'ארוחה כללית';
  return 'לא משויך';
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
 * Resolve preparation instant.
 * Manual kitchenPreparationAt wins; else eventDate (+ optional preferred time).
 */
export function resolvePreparation(order: any, now = new Date()): {
  preparationAt: Date | null;
  preparationKey: string;
  preparationLabel: string;
  isManualPreparation: boolean;
  eventDateKey: string | null;
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
      eventDateKey
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
      eventDateKey
    };
  }

  return {
    preparationAt: null,
    preparationKey: 'ללא מועד',
    preparationLabel: 'ללא מועד',
    isManualPreparation: false,
    eventDateKey: null
  };
}

export function dishIdentityKey(item: {
  name?: unknown;
  selectedOption?: { label?: unknown; amount?: unknown };
  category?: unknown;
}): string {
  const name = String(item?.name || '').trim();
  const option = String(item?.selectedOption?.label || '').trim();
  const size = String(item?.selectedOption?.amount || '').trim();
  const category = String(item?.category || '').trim();
  return [name, option, size, category].join('||').toLowerCase();
}

export function parseUnitFromItem(item: any): string {
  const amount = String(item?.selectedOption?.amount || '').trim();
  if (/מ"?ל|ml/i.test(amount)) return 'מ"ל';
  if (/ק"?ג|kg/i.test(amount)) return 'ק"ג';
  if (/גר|g\b/i.test(amount)) return 'גרם';
  const name = String(item?.name || '');
  if (/מ"?ל/.test(name)) return 'מ"ל';
  if (/ק"?ג/.test(name)) return 'ק"ג';
  return 'יח\'';
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

export function mealFromItemCategory(itemCategory: string, orderMeal: KitchenMeal): KitchenMeal {
  const cat = String(itemCategory || '');
  if (/ערב/.test(cat)) return 'ליל שבת';
  if (/בוקר/.test(cat)) return 'שבת בבוקר';
  return orderMeal;
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
    by: last.by ? String(last.by) : undefined
  };
}

export function buildKitchenChangeEntry(
  type: KitchenChangeType,
  summary: string,
  by?: string,
  at = new Date()
): KitchenChangeEntry {
  return {
    at: at.toISOString(),
    type,
    summary: String(summary || '').trim() || 'עודכן',
    by: by ? String(by).trim() : undefined
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
    includeCatering
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
  endDate: string
): boolean {
  const prep = resolvePreparation(order);
  const key = prep.eventDateKey || (prep.preparationAt ? toJerusalemDateKey(prep.preparationAt) : null);
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
  menuCategoryByProductId: Map<string, string> = new Map(),
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

    if (!orderMatchesKitchenRange(order, filters.startDate, filters.endDate)) continue;

    const fulfillment = normalizeFulfillment(order.customerDetails);
    if (fulfillmentFilter && fulfillment !== fulfillmentFilter) continue;

    const orderMeal = normalizeMeal(order);
    if (filters.meal && filters.meal !== 'הכל' && filters.meal !== orderMeal) {
      // Still allow item-level meal override via category; filter after line expansion if needed
    }

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

    const itemNotes: Array<{ dishName: string; note: string }> = [];
    const items = Array.isArray(order.items) ? order.items : [];

    const noteRow: KitchenOrderNote = {
      orderId: String(order._id || order.id || ''),
      orderNumber: orderNumber || undefined,
      customerName: customerName || undefined,
      meal: orderMeal,
      fulfillment,
      preparationLabel: prep.preparationLabel,
      deliveryTime: deliveryTime || undefined,
      city: city || undefined,
      customerNotes: customerNotes || undefined,
      adminNotes: adminNotes || undefined,
      allergies: allergies || undefined,
      specialRequests: specialRequests || undefined,
      itemNotes,
      lastChange,
      status: String(order.status || ''),
      isCancelled: cancelled,
      isChanged
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

    for (const item of items) {
      const name = String(item?.name || '').trim();
      if (!name) continue;
      const qty = effectiveLineQuantity(order, item);
      if (qty <= 0) continue;

      let category = String(item?.category || '').trim();
      const productId = String(item?.productId || '').trim();
      if (!category && productId && menuCategoryByProductId.has(productId)) {
        category = menuCategoryByProductId.get(productId) || '';
      }
      if (!category) category = 'כללי';

      const lineMeal = mealFromItemCategory(category, orderMeal);
      if (filters.meal && filters.meal !== 'הכל' && filters.meal !== lineMeal && filters.meal !== orderMeal) {
        continue;
      }

      const desc = String(item?.description || '').trim();
      if (desc) itemNotes.push({ dishName: name, note: desc });

      if (!prepGroup.meals.has(lineMeal)) {
        prepGroup.meals.set(lineMeal, {
          meal: lineMeal,
          dishes: new Map(),
          orderIds: new Set(),
          deliveries: 0,
          pickups: 0,
          portions: 0
        });
      }
      const mealGroup = prepGroup.meals.get(lineMeal)!;
      mealGroup.orderIds.add(noteRow.orderId);
      mealGroup.portions += qty;
      totalPortions += qty;

      const optionLabel = String(item?.selectedOption?.label || '').trim();
      const sizeLabel = String(item?.selectedOption?.amount || '').trim();
      const key = dishIdentityKey({ name, selectedOption: item?.selectedOption, category });
      distinctDishKeys.add(key);

      if (!mealGroup.dishes.has(key)) {
        mealGroup.dishes.set(key, {
          key,
          name,
          optionLabel,
          sizeLabel,
          category,
          unit: parseUnitFromItem(item),
          quantity: 0,
          orderCount: 0,
          sources: [],
          _sourceIds: new Set()
        });
      }
      const dish = mealGroup.dishes.get(key)!;
      dish.quantity += qty;
      if (!dish._sourceIds.has(noteRow.orderId)) {
        dish._sourceIds.add(noteRow.orderId);
        dish.orderCount += 1;
      }
      dish.sources.push({
        orderId: noteRow.orderId,
        orderNumber: orderNumber || undefined,
        customerName: customerName || undefined,
        quantity: qty,
        meal: lineMeal,
        fulfillment
      });
    }

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
          dishes: [...mg.dishes.values()]
            .map(({ _sourceIds, ...rest }) => rest)
            .sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name, 'he'))
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
      includeCatering: filters.includeCatering
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
      cancelledOrders
    },
    alerts: alerts.slice(0, 50),
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
