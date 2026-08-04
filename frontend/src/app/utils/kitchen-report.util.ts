export type KitchenMeal =
  | 'ליל שבת'
  | 'שבת בבוקר'
  | 'סעודה שלישית'
  | 'אירוע'
  | 'ארוחה כללית'
  | 'לא משויך'
  | 'הכל';

export type KitchenFulfillmentFilter = 'הכל' | 'משלוח' | 'איסוף עצמי' | 'לא ידוע';

export interface KitchenReportQuery {
  startDate: string;
  endDate: string;
  meal?: string;
  fulfillmentType?: string;
  preparationSlot?: string;
  includeCancelled?: boolean;
  changedOnly?: boolean;
  search?: string;
  includeCatering?: boolean;
  /** Canonical: all | events | shabbat_ready | catering_shabbat | institutions */
  orderKind?: string;
  /** delivery = eventDate; prep = kitchenPreparationAt / prep day */
  dateBasis?: 'delivery' | 'prep';
}

export interface KitchenReportDTO {
  generatedAt: string;
  timezone: string;
  range: { startDate: string; endDate: string };
  filters: Record<string, unknown>;
  summary: {
    activeOrders: number;
    totalPortions: number;
    distinctDishes: number;
    deliveries: number;
    pickups: number;
    unknownFulfillment: number;
    allergyAlerts: number;
    changedOrders: number;
    cancelledOrders: number;
    missingChoiceLines?: number;
  };
  alerts: Array<{
    id: string;
    kind: 'allergy' | 'change' | 'cancellation';
    severity: 'critical' | 'high' | 'medium';
    title: string;
    detail: string;
    orderId?: string;
    orderNumber?: string;
  }>;
  /** Open catering events across a look-ahead window (independent of selected range). */
  openEventsAlert?: {
    window: { from: string; to: string; today: string };
    total: number;
    overdueCount: number;
    upcomingCount: number;
    eventsCount?: number;
    byDate: Array<{
      date: string;
      overdue: boolean;
      count: number;
      orders: Array<{
        orderId: string;
        orderNumber?: string;
        customerName?: string;
        status: string;
        orderKind?: string;
        orderKindLabel?: string;
      }>;
    }>;
  } | null;
  preparationGroups: Array<{
    preparationKey: string;
    preparationLabel: string;
    preparationAt: string | null;
    isManualPreparation: boolean;
    ordersCount: number;
    deliveries: number;
    pickups: number;
    meals: Array<{
      meal: string;
      ordersCount: number;
      portionsTotal: number;
      deliveries: number;
      pickups: number;
      dishes: Array<{
        key: string;
        name: string;
        optionLabel: string;
        sizeLabel: string;
        category: string;
        unit: string;
        quantity: number;
        orderCount: number;
        sources: Array<{
          orderId: string;
          orderNumber?: string;
          customerName?: string;
          quantity: number;
        }>;
      }>;
    }>;
  }>;
  orderNotes: Array<{
    orderId: string;
    orderNumber?: string;
    customerName?: string;
    phone?: string;
    address?: string;
    meal: string;
    meals?: string[];
    fulfillment: string;
    preparationLabel: string;
    deliveryDate?: string | null;
    preparationDate?: string | null;
    orderKind?: string;
    orderKindLabel?: string;
    orderType?: string;
    cateringKind?: string;
    deliveryTime?: string;
    city?: string;
    customerNotes?: string;
    adminNotes?: string;
    allergies?: string;
    specialRequests?: string;
    items?: Array<{
      productId?: string;
      name: string;
      optionLabel?: string;
      sizeLabel?: string;
      category: string;
      unit: string;
      quantity: number;
      missingChoice?: boolean;
    }>;
    itemNotes: Array<{ dishName: string; note: string }>;
    lastChange?: {
      at: string;
      summary: string;
      by?: string;
      type?: string;
      previousValue?: string;
      newValue?: string;
    } | null;
    status: string;
    isCancelled: boolean;
    isChanged: boolean;
    lastKitchenPrintAt?: string | null;
  }>;
  cancelledAndChanged: Array<{
    orderId: string;
    orderNumber?: string;
    customerName?: string;
    isCancelled: boolean;
    isChanged: boolean;
    lastChange?: {
      at: string;
      summary: string;
      by?: string;
      type?: string;
      previousValue?: string;
      newValue?: string;
    } | null;
    status: string;
  }>;
}

export function toJerusalemDateKey(d = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(d);
}

export function addDaysToDateKey(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function formatKitchenGeneratedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jerusalem',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(d);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value || '';
  const day = get('day');
  const month = get('month');
  const year = get('year');
  const hour = get('hour');
  const minute = get('minute');
  if (!day || !month || !hour || !minute) return '';
  return `${day}.${month}.${year} · ${hour}:${minute}`;
}

export const KITCHEN_MEAL_OPTIONS: Array<{ key: string; label: string }> = [
  { key: 'הכל', label: 'כל הארוחות' },
  { key: 'ליל שבת', label: 'ליל שבת' },
  { key: 'שבת בבוקר', label: 'שבת בבוקר' },
  { key: 'סעודה שלישית', label: 'סעודה שלישית' },
  { key: 'אירוע', label: 'אירוע' },
  { key: 'ארוחה כללית', label: 'ארוחה כללית' },
  { key: 'לא משויך', label: 'לא משויך' }
];

export const KITCHEN_FULFILLMENT_OPTIONS: Array<{ key: string; label: string }> = [
  { key: 'הכל', label: 'הכל' },
  { key: 'משלוח', label: 'משלוח' },
  { key: 'איסוף עצמי', label: 'איסוף עצמי' },
  { key: 'לא ידוע', label: 'לא ידוע' }
];
