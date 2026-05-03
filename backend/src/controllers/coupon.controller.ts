import { Request, Response } from 'express';
import Coupon, { ICoupon } from '../models/coupon.model';
import { validateAndApplyCoupon } from '../services/coupon.service';
import { createValidationError } from '../middleware/errorHandler';

function parseTargetCustomerCategory(raw: unknown): 'all' | 'returning' | 'sleeping' | 'vip' | 'new' {
  const value = String(raw ?? 'all')
    .trim()
    .toLowerCase();
  if (value === 'returning' || value === 'sleeping' || value === 'vip' || value === 'new') return value;
  return 'all';
}

export async function listCoupons(_req: Request, res: Response): Promise<void> {
  try {
    const coupons = await Coupon.find({}).sort({ createdAt: -1 }).lean();
    res.json(coupons);
  } catch (err: any) {
    console.error('listCoupons error:', err);
    res.status(500).json({ success: false, message: 'Failed to list coupons' });
  }
}

export async function createCoupon(req: Request, res: Response): Promise<void> {
  try {
    const body = req.body;
    const code = (body.code || '').trim().toUpperCase();
    if (!code) {
      throw createValidationError('code is required');
    }
    const discountType = body.discountType;
    if (!discountType || !['percentage', 'fixedAmount'].includes(discountType)) {
      throw createValidationError('discountType must be "percentage" or "fixedAmount"');
    }
    const discountValue = Number(body.discountValue);
    if (typeof discountValue !== 'number' || isNaN(discountValue) || discountValue < 0) {
      throw createValidationError('discountValue must be a non-negative number');
    }
    if (discountType === 'percentage' && discountValue > 100) {
      throw createValidationError('percentage discount cannot exceed 100');
    }
    const minOrderValue = Number(body.minOrderValue);
    if (typeof minOrderValue !== 'number' || isNaN(minOrderValue) || minOrderValue < 0) {
      throw createValidationError('minOrderValue must be a non-negative number');
    }
    const expiresAt = body.expiresAt || body.expiryDate ? new Date(body.expiresAt || body.expiryDate) : null;
    if (expiresAt && isNaN(expiresAt.getTime())) {
      throw createValidationError('expiresAt must be a valid date');
    }
    const maxUses = body.maxUses == null || body.maxUses === '' ? null : Number(body.maxUses);
    if (maxUses !== null && (typeof maxUses !== 'number' || isNaN(maxUses) || maxUses < 1)) {
      throw createValidationError('maxUses must be null or at least 1');
    }
    const maxUsesPerCustomer =
      body.maxUsesPerCustomer == null || body.maxUsesPerCustomer === ''
        ? 1
        : Number(body.maxUsesPerCustomer);
    if (typeof maxUsesPerCustomer !== 'number' || isNaN(maxUsesPerCustomer) || maxUsesPerCustomer < 1) {
      throw createValidationError('maxUsesPerCustomer must be at least 1');
    }
    const targetCustomerCategory = parseTargetCustomerCategory(body.targetCustomerCategory);

    const coupon = new Coupon({
      code,
      discountType,
      discountValue,
      minOrderValue: minOrderValue || 0,
      expiresAt,
      maxUses,
      maxUsesPerCustomer,
      usageCount: 0,
      usedByPhones: [],
      totalRevenueGenerated: 0,
      isActive: body.isActive !== false,
      isVipOnly: body.isVipOnly === true,
      targetCustomerCategory
    });
    await coupon.save();
    res.status(201).json(coupon.toObject ? coupon.toObject() : coupon);
  } catch (err: any) {
    if (err.statusCode === 400) throw err;
    console.error('createCoupon error:', err);
    res.status(500).json({ success: false, message: err.message || 'Failed to create coupon' });
  }
}

export async function updateCoupon(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const body = req.body;
    const coupon = await Coupon.findById(id);
    if (!coupon) {
      res.status(404).json({ success: false, message: 'Coupon not found' });
      return;
    }

    if (body.code !== undefined) {
      coupon.code = (String(body.code)).trim().toUpperCase();
    }
    if (body.discountType !== undefined) {
      if (!['percentage', 'fixedAmount'].includes(body.discountType)) {
        throw createValidationError('discountType must be "percentage" or "fixedAmount"');
      }
      coupon.discountType = body.discountType;
    }
    if (body.discountValue !== undefined) {
      const v = Number(body.discountValue);
      if (isNaN(v) || v < 0) throw createValidationError('discountValue must be a non-negative number');
      if (coupon.discountType === 'percentage' && v > 100) throw createValidationError('percentage cannot exceed 100');
      coupon.discountValue = v;
    }
    if (body.minOrderValue !== undefined) {
      const v = Number(body.minOrderValue);
      if (isNaN(v) || v < 0) throw createValidationError('minOrderValue must be a non-negative number');
      coupon.minOrderValue = v;
    }
    if (body.expiresAt !== undefined || body.expiryDate !== undefined) {
      const raw = body.expiresAt !== undefined ? body.expiresAt : body.expiryDate;
      if (raw === null || raw === '') {
        coupon.expiresAt = null;
      } else {
        const d = new Date(raw);
        if (isNaN(d.getTime())) throw createValidationError('expiresAt must be a valid date');
        coupon.expiresAt = d;
      }
    }
    if (body.maxUses !== undefined) {
      const v = body.maxUses === null || body.maxUses === '' ? null : Number(body.maxUses);
      if (v !== null && (isNaN(v) || v < 1)) throw createValidationError('maxUses must be null or at least 1');
      if (v !== null && v < coupon.usageCount) throw createValidationError('maxUses cannot be less than usageCount');
      coupon.maxUses = v;
    }
    if (body.maxUsesPerCustomer !== undefined) {
      const v =
        body.maxUsesPerCustomer == null || body.maxUsesPerCustomer === ''
          ? 1
          : Number(body.maxUsesPerCustomer);
      if (isNaN(v) || v < 1) throw createValidationError('maxUsesPerCustomer must be at least 1');
      coupon.maxUsesPerCustomer = v;
    }
    if (typeof body.isActive === 'boolean') {
      coupon.isActive = body.isActive;
    }
    if (typeof body.isVipOnly === 'boolean') {
      coupon.isVipOnly = body.isVipOnly;
    }
    if (body.targetCustomerCategory !== undefined) {
      coupon.targetCustomerCategory = parseTargetCustomerCategory(body.targetCustomerCategory);
    }

    await coupon.save();
    res.json(coupon.toObject ? coupon.toObject() : coupon);
  } catch (err: any) {
    if (err.statusCode === 400) throw err;
    console.error('updateCoupon error:', err);
    res.status(500).json({ success: false, message: err.message || 'Failed to update coupon' });
  }
}

export async function applyCoupon(req: Request, res: Response): Promise<void> {
  try {
    const { code, cartTotal, customerPhone } = req.body || {};
    const codeStr = typeof code === 'string' ? code.trim() : '';
    const total = Number(cartTotal);
    if (!codeStr) {
      res.status(400).json({ success: false, message: 'Code is required' });
      return;
    }
    if (typeof total !== 'number' || isNaN(total) || total < 0) {
      res.status(400).json({ success: false, message: 'cartTotal must be a non-negative number' });
      return;
    }

    const result = await validateAndApplyCoupon(codeStr, total, customerPhone);
    if (!result.valid) {
      res.status(404).json({ success: false, message: (result as any).message });
      return;
    }

    res.json({
      success: true,
      discountAmount: (result as any).discountAmount,
      newTotal: (result as any).newTotal,
      couponId: (result as any).couponId
    });
  } catch (err: any) {
    console.error('applyCoupon error:', err);
    res.status(500).json({ success: false, message: 'Invalid or expired coupon' });
  }
}

export async function deleteCoupon(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const deleted = await Coupon.findByIdAndDelete(id);
    if (!deleted) {
      res.status(404).json({ success: false, message: 'Coupon not found' });
      return;
    }
    res.json({ success: true, message: 'Coupon deleted successfully' });
  } catch (err: any) {
    console.error('deleteCoupon error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete coupon' });
  }
}
