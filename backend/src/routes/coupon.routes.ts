import express from 'express';
import rateLimit from 'express-rate-limit';
import { asyncHandler } from '../middleware/errorHandler';
import * as couponController from '../controllers/coupon.controller';

const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { requireAdmin } = require('../config/role-access');

const applyCouponLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: {
    success: false,
    message: 'Too many attempts. Please try again in a minute.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

router.post('/apply', applyCouponLimiter, couponController.applyCoupon);

router.get('/', authenticate, requireAdmin, couponController.listCoupons);
router.post('/', authenticate, requireAdmin, asyncHandler(couponController.createCoupon as any));
router.put('/:id', authenticate, requireAdmin, asyncHandler(couponController.updateCoupon as any));

export default router;
