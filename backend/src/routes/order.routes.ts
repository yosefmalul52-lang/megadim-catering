import express, { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { OrderController } from '../controllers/order.controller';

const router = express.Router();
const orderController = new OrderController();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Rate limiter for checkout endpoint only
const checkoutLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 checkout requests per windowMs
  message: {
    error: 'Too many order submissions from this IP, please try again later.',
    retryAfter: '15 minutes'
  }
});

// Import authenticate middleware (using require for JS file)
const { authenticate } = require('../middleware/auth');

// Optional authentication middleware - doesn't fail if no token (for guest orders)
const optionalAuthenticate = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // No token provided - continue as guest
    (req as any).user = null;
    return next();
  }

  // Token provided - try to authenticate
  const token = authHeader.substring(7);
  
  try {
    const decoded: any = jwt.verify(token, JWT_SECRET);
    const User = require('../models/User');
    
    const user = await User.findById(decoded.userId);
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
  } catch (err) {
    // Invalid token - continue as guest
    console.warn('Invalid token in optional auth, proceeding as guest');
    (req as any).user = null;
  }
  
  next();
};

// Public routes - checkout is rate-limited and optionally authenticated
router.post('/checkout', checkoutLimiter, optionalAuthenticate, orderController.submitOrder);

// Customer routes (Protected with JWT authentication)
router.get('/my-orders', authenticate, orderController.getMyOrders);

// Admin routes (Protected with JWT authentication)
router.get('/', authenticate, orderController.getAllOrders);
router.get('/stats', authenticate, orderController.getOrderStatistics);
router.get('/recent', authenticate, orderController.getRecentOrders);
router.get('/search', authenticate, orderController.searchOrders);
router.get('/:id', authenticate, orderController.getOrderById);
router.put('/:id/status', authenticate, orderController.updateOrderStatus);
router.patch('/:id/status', authenticate, orderController.updateOrderStatus);
router.delete('/:id', authenticate, orderController.deleteOrder);

export default router;
