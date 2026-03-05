import Coupon, { ICoupon } from '../models/coupon.model';

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

/**
 * Single source of truth: validate coupon and compute discount.
 * Used by both POST /coupons/apply (preview) and order checkout (final validation).
 */
export async function validateAndApplyCoupon(
  code: string,
  cartTotal: number
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

  if (coupon.currentUses >= coupon.maxUses) {
    return { valid: false, message: VAGUE_ERROR_MESSAGE };
  }

  const now = new Date();
  if (now >= new Date(coupon.expiryDate)) {
    return { valid: false, message: VAGUE_ERROR_MESSAGE };
  }

  const minOrder = Number(coupon.minOrderValue) || 0;
  if (cartTotal < minOrder) {
    return { valid: false, message: VAGUE_ERROR_MESSAGE };
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
export async function incrementCouponUsage(couponId: string): Promise<void> {
  await Coupon.updateOne(
    { _id: couponId },
    { $inc: { currentUses: 1 } }
  );
}
