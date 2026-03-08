import { Request, Response } from 'express';
import Coupon, { ICoupon } from '../models/coupon.model';
import { validateAndApplyCoupon } from '../services/coupon.service';
import { createValidationError } from '../middleware/errorHandler';

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
    const expiryDate = body.expiryDate ? new Date(body.expiryDate) : null;
    if (!expiryDate || isNaN(expiryDate.getTime())) {
      throw createValidationError('expiryDate is required and must be a valid date');
    }
    const maxUses = Number(body.maxUses);
    if (typeof maxUses !== 'number' || isNaN(maxUses) || maxUses < 1) {
      throw createValidationError('maxUses must be at least 1');
    }

    const coupon = new Coupon({
      code,
      discountType,
      discountValue,
      minOrderValue: minOrderValue || 0,
      expiryDate,
      maxUses,
      currentUses: 0,
      isActive: body.isActive !== false
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
    if (body.expiryDate !== undefined) {
      const d = new Date(body.expiryDate);
      if (isNaN(d.getTime())) throw createValidationError('expiryDate must be a valid date');
      coupon.expiryDate = d;
    }
    if (body.maxUses !== undefined) {
      const v = Number(body.maxUses);
      if (isNaN(v) || v < 1) throw createValidationError('maxUses must be at least 1');
      if (v < coupon.currentUses) throw createValidationError('maxUses cannot be less than currentUses');
      coupon.maxUses = v;
    }
    if (typeof body.isActive === 'boolean') {
      coupon.isActive = body.isActive;
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
    const { code, cartTotal } = req.body || {};
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

    const result = await validateAndApplyCoupon(codeStr, total);
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
