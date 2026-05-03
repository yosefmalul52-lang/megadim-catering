import Coupon, { ICoupon } from '../models/coupon.model';
import Order from '../models/Order';
import Customer from '../models/Customer';

const VAGUE_ERROR_MESSAGE = 'Invalid or expired coupon';

export interface ApplyCouponResult {
  valid: true;
  discountAmount: number;
  newTotal: number;
  couponId: string;
}

export interface ApplyCouponInvalid {
  valid: false;
  message: string;
}

function normalizePhone(raw: unknown): string {
  let digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('00972')) {
    digits = digits.slice(5);
  } else if (digits.startsWith('972')) {
    digits = digits.slice(3);
  }
  if (!digits.startsWith('0')) digits = `0${digits}`;
  return digits;
}

const SLEEPING_DAYS = 30;
const SLEEPING_MS = SLEEPING_DAYS * 24 * 60 * 60 * 1000;

type CustomerCategory = 'all' | 'returning' | 'sleeping' | 'vip' | 'registered' | 'new';

function toCategory(raw: unknown): CustomerCategory {
  const value = String(raw || '')
    .trim()
    .toLowerCase();
  if (value === 'returning' || value === 'sleeping' || value === 'vip' || value === 'registered' || value === 'new') {
    return value;
  }
  return 'all';
}

function getEffectiveCustomerCategory(customer: any): CustomerCategory {
  const current = toCategory(customer?.customerCategory);
  const orderCount = Number(customer?.orderCount || 0);
  const hasOrders = orderCount > 0;
  const last = customer?.lastOrderDate ? new Date(customer.lastOrderDate) : null;
  const lastMs = last && !Number.isNaN(last.getTime()) ? last.getTime() : null;
  const now = Date.now();
  const isSleeping = !!(hasOrders && lastMs !== null && now - lastMs >= SLEEPING_MS);
  const isReg = customer?.isRegistered === true;

  if (current === 'vip') return 'vip';
  if (isSleeping) return 'sleeping';
  if (current === 'sleeping') {
    if (!hasOrders) return 'all';
    if (orderCount > 1) return 'returning';
    return isReg ? 'registered' : 'all';
  }
  if (current === 'registered') return isReg ? 'registered' : 'all';
  if (current === 'returning') return 'returning';
  if (isReg) return 'registered';
  return 'all';
}

async function getCompletedOrdersCountForPhone(phone: string): Promise<number> {
  const normalized = normalizePhone(phone);
  if (!normalized) return 0;
  const suffix = normalized.slice(-7);
  const docs = await Order.find(
    {
      isDeleted: { $ne: true },
      status: { $in: ['ready', 'delivered', 'completed'] },
      'customerDetails.phone': { $exists: true, $ne: null, $regex: suffix }
    },
    { 'customerDetails.phone': 1 }
  ).lean();
  let count = 0;
  for (const d of docs) {
    const p = normalizePhone((d as any)?.customerDetails?.phone);
    if (p && p === normalized) count += 1;
  }
  return count;
}

/**
 * Single source of truth: validate coupon and compute discount.
 * Used by both POST /coupons/apply (preview) and order checkout (final validation).
 */
export async function validateAndApplyCoupon(
  code: string,
  cartTotal: number,
  customerPhone?: string
): Promise<ApplyCouponResult | ApplyCouponInvalid> {
  const normalizedCode = (code || '').trim().toUpperCase();
  if (!normalizedCode) {
    return { valid: false, message: VAGUE_ERROR_MESSAGE };
  }

  const coupon = await Coupon.findOne({ code: normalizedCode }).lean();
  if (!coupon) {
    return { valid: false, message: VAGUE_ERROR_MESSAGE };
  }

  if (!coupon.isActive) {
    return { valid: false, message: VAGUE_ERROR_MESSAGE };
  }

  if (coupon.maxUses != null && coupon.usageCount >= coupon.maxUses) {
    return { valid: false, message: VAGUE_ERROR_MESSAGE };
  }

  const now = new Date();
  if (coupon.expiresAt && now >= new Date(coupon.expiresAt)) {
    return { valid: false, message: VAGUE_ERROR_MESSAGE };
  }

  const minOrder = Number(coupon.minOrderValue) || 0;
  if (cartTotal < minOrder) {
    return { valid: false, message: VAGUE_ERROR_MESSAGE };
  }

  const normalizedPhone = normalizePhone(customerPhone || '');
  const targetCustomerCategory = toCategory((coupon as any).targetCustomerCategory);

  if (targetCustomerCategory !== 'all') {
    if (!normalizedPhone) {
      return { valid: false, message: 'קופון זה זמין רק ללקוחות מזוהים בקטגוריה מתאימה' };
    }

    const customer = await Customer.findOne({ normalizedPhone }).lean();
    if (!customer) {
      return { valid: false, message: 'לא נמצא לקוח תואם לקופון זה' };
    }
    if (customer?.manualStatus === 'BLACKLIST') {
      return { valid: false, message: 'לקוח זה חסום לשימוש בקופונים' };
    }

    if (targetCustomerCategory === 'new') {
      const orderCount = Number(customer?.orderCount || 0);
      if (orderCount > 0) {
        return { valid: false, message: 'הקופון זמין ללקוחות חדשים בלבד' };
      }
    } else {
      const effectiveCategory = getEffectiveCustomerCategory(customer);
      if (effectiveCategory !== targetCustomerCategory) {
        return { valid: false, message: 'הקופון לא תקף לקטגוריית הלקוח הנוכחית' };
      }
    }
  }

  if (coupon.isVipOnly === true) {
    if (!normalizedPhone) {
      return { valid: false, message: 'מספר טלפון נדרש כדי לממש קופון VIP' };
    }

    const customer = await Customer.findOne({ normalizedPhone }).lean();
    if (customer?.manualStatus === 'BLACKLIST') {
      return { valid: false, message: 'לקוח זה חסום לשימוש בקופונים' };
    }
    if (customer?.manualStatus !== 'VIP') {
      const completedOrdersCount = await getCompletedOrdersCountForPhone(normalizedPhone);
      if (completedOrdersCount <= 1) {
        return { valid: false, message: 'קופון זה שמור ללקוחות VIP חוזרים בלבד' };
      }
    }
  }

  if (normalizedPhone && Array.isArray(coupon.usedByPhones)) {
    const usesByPhone = coupon.usedByPhones.filter((p) => p === normalizedPhone).length;
    const perCustomerLimit = Math.max(1, Number((coupon as any).maxUsesPerCustomer || 1));
    if (usesByPhone >= perCustomerLimit) {
      return { valid: false, message: 'חרגת ממכסת השימוש האישית בקופון זה' };
    }
  }

  let discountAmount: number;
  if (coupon.discountType === 'percentage') {
    const pct = Math.min(100, Math.max(0, Number(coupon.discountValue) || 0));
    discountAmount = Math.round((cartTotal * pct) / 100 * 100) / 100;
  } else {
    discountAmount = Math.min(cartTotal, Math.max(0, Number(coupon.discountValue) || 0));
  }

  const newTotal = Math.max(0, Math.round((cartTotal - discountAmount) * 100) / 100);

  return {
    valid: true,
    discountAmount,
    newTotal,
    couponId: String(coupon._id)
  };
}

/**
 * Increment coupon usage atomically. Call only after order is successfully saved.
 */
export async function incrementCouponUsage(couponId: string, customerPhone?: string): Promise<void> {
  const normalizedPhone = normalizePhone(customerPhone || '');
  const perCustomerLimitExpr =
    normalizedPhone
      ? {
          $lt: [
            {
              $size: {
                $filter: {
                  input: '$usedByPhones',
                  as: 'p',
                  cond: { $eq: ['$$p', normalizedPhone] }
                }
              }
            },
            { $ifNull: ['$maxUsesPerCustomer', 1] }
          ]
        }
      : true;
  const filter: Record<string, unknown> = {
    _id: couponId,
    isActive: true,
    $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }]
  };
  filter.$expr = {
    $and: [
      {
        $or: [{ $eq: ['$maxUses', null] }, { $lt: ['$usageCount', '$maxUses'] }]
      },
      perCustomerLimitExpr
    ]
  };

  const update: Record<string, unknown> = {
    $inc: { usageCount: 1 },
    ...(normalizedPhone ? { $push: { usedByPhones: normalizedPhone } } : {})
  };

  const result = await Coupon.updateOne(filter, update);
  if (result.modifiedCount !== 1) {
    throw new Error('Coupon usage update failed due to limits or duplicate phone');
  }
}

export async function updateCouponRevenue(couponId: string, orderAmount: number): Promise<void> {
  const amount = Number(orderAmount || 0);
  if (!couponId || !Number.isFinite(amount) || amount <= 0) return;
  await Coupon.updateOne({ _id: couponId }, { $inc: { totalRevenueGenerated: amount } });
}
