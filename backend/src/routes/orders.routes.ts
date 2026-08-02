import express, { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { OrderController } from '../controllers/order.controller';
import { OrderService } from '../services/order.service';
import Order from '../models/Order';
import { asyncHandler } from '../middleware/errorHandler';

const router = express.Router();
const orderController = new OrderController();

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET must be set in environment (e.g. backend/.env)');
}

const placeOrderLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    error: 'Too many order submissions from this IP, please try again later.',
    retryAfter: '15 minutes'
  }
});

const { authenticate, optionalAuthenticate } = require('../middleware/auth');
const { requireAdmin } = require('../config/role-access');

router.post(
  '/manual',
  placeOrderLimiter,
  authenticate,
  requireAdmin,
  orderController.createManualOrder
);

router.post('/', placeOrderLimiter, optionalAuthenticate, orderController.createOrder);

// Customer endpoint – get orders for the authenticated user
// GET /api/orders/myorders
router.get(
  '/myorders',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const user = (req as any).user;
    const userId = user?._id ?? user?.id;

    if (!userId) {
      return res.status(401).json({ message: 'User authentication required' });
    }

    const orderService = new OrderService();
    const orders = await orderService.getOrdersByUserId(String(userId));
    for (const order of orders) {
      if (order?.items?.length) {
        await orderService.enrichOrderItemsImageUrlPublic((order as any).items);
      }
    }
    res.json(orders);
  })
);

export default router;
