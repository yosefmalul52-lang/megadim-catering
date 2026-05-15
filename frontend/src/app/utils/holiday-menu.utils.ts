import { MenuItem } from '../services/menu.service';
import { HolidayEvent, HolidayEventProduct } from '../services/holiday-event.service';
import { isHolidayEventLiveOnSite, isHolidayProductAvailable } from './holiday-visibility.utils';

/** Cart / order summary label for holiday catalog items */
export const HOLIDAY_CART_CATEGORY = 'מכירת חג';

export const HOLIDAY_ROUTE_ID = 'holiday';

const PLACEHOLDER_IMAGE = '/assets/images/placeholder-dish.jpg';

export interface ShabbatCategoryTile {
  id: string;
  title: string;
  image: string;
  nameKey?: string;
}

export function holidayProductCartId(
  eventId: string,
  product: HolidayEventProduct,
  index: number
): string {
  const pid = product._id || `idx-${index}`;
  return `he:${eventId}:${pid}`;
}

/** Map embedded holiday product to MenuItem for unified product-card rendering */
export function mapHolidayProductToMenuItem(
  product: HolidayEventProduct,
  eventId: string,
  index: number
): MenuItem {
  const id = holidayProductCartId(eventId, product, index);
  return {
    id,
    _id: id,
    name: product.title,
    description: product.description || '',
    price: Number(product.price) || 0,
    imageUrl: product.imageUrl?.trim() || PLACEHOLDER_IMAGE,
    category: HOLIDAY_CART_CATEGORY,
    tags: ['holiday'],
    isAvailable: true
  };
}

export function mapHolidayEventToMenuItems(event: HolidayEvent): MenuItem[] {
  return (event.products || [])
    .filter((p) => (p.title || '').trim() && isHolidayProductAvailable(p))
    .map((p, i) => mapHolidayProductToMenuItem(p, event._id, i));
}

export function isHolidayEventStillOrderable(event: HolidayEvent, now = Date.now()): boolean {
  return isHolidayEventLiveOnSite(event, now);
}

/** Cover image for Bento hero: event imageUrl → first available product → fallback. */
export function getHolidayCategoryImageUrl(
  holiday: HolidayEvent,
  fallback = PLACEHOLDER_IMAGE
): string {
  const fromEvent = holiday.imageUrl?.trim();
  if (fromEvent) return fromEvent;

  const fromProduct = holiday.products
    ?.filter((p) => isHolidayProductAvailable(p))
    .find((p) => p.imageUrl?.trim())
    ?.imageUrl?.trim();
  return fromProduct || fallback;
}

/** Bento tile injected at front of Shabbat menu when a holiday is live. */
export function buildHolidayBentoTile(
  holiday: HolidayEvent,
  fallbackImage = PLACEHOLDER_IMAGE
): ShabbatCategoryTile {
  return {
    id: HOLIDAY_ROUTE_ID,
    title: holiday.name,
    image: getHolidayCategoryImageUrl(holiday, fallbackImage)
  };
}
