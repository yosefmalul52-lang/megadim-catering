import mongoose from 'mongoose';
import HolidayEvent from '../models/holidayEvent.model';

export const HOLIDAY_PRODUCT_ID_PREFIX = 'he:';
export const HOLIDAY_CART_CATEGORY = 'מכירת חג';

export function isHolidayOrderProductId(productId: string): boolean {
  return String(productId || '').trim().startsWith(HOLIDAY_PRODUCT_ID_PREFIX);
}

export function parseHolidayOrderProductId(
  cartId: string
): { eventId: string; productId: string } | null {
  const raw = String(cartId || '').trim();
  if (!raw.startsWith(HOLIDAY_PRODUCT_ID_PREFIX)) return null;
  const parts = raw.split(':');
  if (parts.length < 3 || parts[0] !== 'he') return null;
  const eventId = parts[1];
  const productId = parts.slice(2).join(':');
  if (!mongoose.Types.ObjectId.isValid(eventId)) return null;
  return { eventId, productId };
}

export interface HolidayOrderProductSnapshot {
  _id: string;
  name: string;
  price: number;
  description?: string;
  imageUrl?: string;
  category: string;
}

/** Resolve holiday line item from HolidayEvent or saved order payload. */
export async function resolveHolidayOrderProduct(
  cartProductId: string,
  payload?: {
    name?: string;
    price?: number;
    description?: string;
    imageUrl?: string;
    category?: string;
  }
): Promise<HolidayOrderProductSnapshot | null> {
  const parsed = parseHolidayOrderProductId(cartProductId);
  if (!parsed) return null;

  const event = await HolidayEvent.findById(parsed.eventId).lean();
  if (event?.products?.length) {
    const embedded = (event.products as any[]).find(
      (p) => String(p._id) === parsed.productId
    );
    if (embedded) {
      return {
        _id: cartProductId,
        name: String(embedded.title || '').trim(),
        price: Number(embedded.price) || 0,
        description: String(embedded.description || ''),
        imageUrl: embedded.imageUrl ? String(embedded.imageUrl).trim() : '',
        category: HOLIDAY_CART_CATEGORY
      };
    }
  }

  const name = String(payload?.name || '').trim();
  const price = Number(payload?.price);
  if (name && Number.isFinite(price) && price >= 0) {
    return {
      _id: cartProductId,
      name,
      price,
      description: payload?.description ? String(payload.description) : '',
      imageUrl: payload?.imageUrl ? String(payload.imageUrl).trim() : '',
      category: payload?.category || HOLIDAY_CART_CATEGORY
    };
  }

  return null;
}
