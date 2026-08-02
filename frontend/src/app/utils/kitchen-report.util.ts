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
    meal: string;
    fulfillment: string;
    preparationLabel: string;
    deliveryTime?: string;
    city?: string;
    customerNotes?: string;
    adminNotes?: string;
    allergies?: string;
    specialRequests?: string;
    itemNotes: Array<{ dishName: string; note: string }>;
    lastChange?: { at: string; summary: string; by?: string } | null;
    status: string;
    isCancelled: boolean;
    isChanged: boolean;
  }>;
  cancelledAndChanged: Array<{
    orderId: string;
    orderNumber?: string;
    customerName?: string;
    isCancelled: boolean;
    isChanged: boolean;
    lastChange?: { at: string; summary: string } | null;
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
  return d.toLocaleString('he-IL', {
    timeZone: 'Asia/Jerusalem',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
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
