import express, { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { OrderController } from '../controllers/order.controller';
import { OrderService } from '../services/order.service';
import Order from '../models/Order';
import { asyncHandler } from '../middleware/errorHandler';

const router = express.Router();
const orderController = new OrderController();

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
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

const { authenticate } = require('../middleware/auth');

const optionalAuthenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const cookieToken = (req as any).cookies?.token;
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.replace('Bearer ', '').trim() : null;
  const token = cookieToken || bearerToken;
  if (!token) {
    (req as any).user = null;
    return next();
  }
  try {
    const decoded: any = jwt.verify(token, JWT_SECRET);
    const userId = decoded.id || decoded.userId || decoded._id;
    if (!userId) {
      (req as any).user = null;
      return next();
    }
    const User = require('../models/User');
    const user = await User.findById(userId);
    if (user && user.isActive) {
      (req as any).user = {
        _id: user._id,
        id: user._id.toString(),
        username: user.username,
        role: user.role,
        fullName: user.fullName,
        phone: user.phone
      };
    } else {
      (req as any).user = null;
    }
  } catch {
    (req as any).user = null;
  }
  next();
};

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
