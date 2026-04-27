import express, { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { OrderController } from '../controllers/order.controller';

const router = express.Router();
const orderController = new OrderController();

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET must be set in environment (e.g. backend/.env)');
}

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
const { requireAdmin, requireCapability, CAP } = require('../config/role-access');

// Optional authentication middleware - doesn't fail if no token (for guest orders)
const optionalAuthenticate = async (req: Request, res: Response, next: NextFunction) => {
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
    console.log('KZ Decoded Token:', JSON.stringify(decoded, null, 2));
    
    // KZ: The payload uses 'id' field (as set in auth.routes.ts: payload = { id: user._id, role: user.role })
    const userId = decoded.id || decoded.userId || decoded._id;
    console.log('KZ: Extracted userId from token:', userId);
    console.log('KZ: userId type:', typeof userId);
    
    if (!userId) {
      console.warn('KZ: No user ID found in token payload - proceeding as guest');
      (req as any).user = null;
      return next();
    }
    
    const User = require('../models/User');
    const user = await User.findById(userId);
    
    console.log('KZ: User lookup result:', user ? 'Found' : 'Not Found');
    
    if (user && user.isActive) {
      (req as any).user = {
        _id: user._id,
        id: user._id.toString(), // KZ: Ensure 'id' is set as string
        username: user.username,
        role: user.role,
        fullName: user.fullName,
        phone: user.phone
      };
      console.log('KZ: req.user set successfully:', {
        id: (req as any).user.id,
        _id: (req as any).user._id,
        username: (req as any).user.username,
        role: (req as any).user.role
      });
    } else {
      console.warn('KZ: User not found or inactive - proceeding as guest');
      (req as any).user = null;
    }
  } catch (err: any) {
    // Invalid token - continue as guest
    console.warn('KZ: Invalid token in optional auth, proceeding as guest. Error:', err.message);
    (req as any).user = null;
  }
  
  next();
};

// Public routes - checkout is rate-limited and optionally authenticated
router.post('/checkout', checkoutLimiter, optionalAuthenticate, orderController.submitOrder);
router.post('/send', checkoutLimiter, orderController.sendOrder);

// Customer routes (authenticated; returns only current user's orders)
router.get('/my-orders', authenticate, orderController.getMyOrders);

// Staff: list / reports — driver has subset (see role-access)
router.get('/', authenticate, requireCapability(CAP.ORDERS_LIST), orderController.getAllOrders);
router.get(
  '/analytics/revenue-by-source',
  authenticate,
  requireCapability(CAP.ORDERS_ANALYTICS),
  orderController.getRevenueBySource
);
router.get(
  '/analytics/monthly-revenue',
  authenticate,
  requireCapability(CAP.ORDERS_ANALYTICS),
  orderController.getMonthlyRevenue
);
router.get('/stats', authenticate, requireCapability(CAP.ORDERS_STATS), orderController.getOrderStatistics);
router.get(
  '/stats/revenue',
  authenticate,
  requireCapability(CAP.ORDERS_STATS_REVENUE),
  orderController.getRevenueStats
);
router.get('/kitchen-report', authenticate, requireAdmin, orderController.getKitchenReport);
router.get('/delivery-report', authenticate, requireCapability(CAP.DELIVERIES_MY_LIST), orderController.getDeliveryReport);
router.get('/recent', authenticate, requireCapability(CAP.ORDERS_RECENT), orderController.getRecentOrders);
router.get('/search', authenticate, requireCapability(CAP.ORDERS_SEARCH), orderController.searchOrders);
router.get('/dashboard-stats', authenticate, requireCapability(CAP.ORDERS_DASHBOARD_STATS), orderController.getDashboardStats);
router.get('/driver/my', authenticate, requireCapability(CAP.DELIVERIES_MY_LIST), orderController.getDriverMyOrders);
router.patch('/:id/assign-driver', authenticate, requireAdmin, orderController.assignOrderToDriver);

// Get order by ID (authenticate only; controller restricts to own order for non-admin)
router.get('/:id', authenticate, orderController.getOrderById);

// Mutate orders — sensitive ops admin only
router.put('/:id/restore', authenticate, requireAdmin, orderController.restoreOrder);
router.delete('/:id/permanent', authenticate, requireAdmin, orderController.permanentDeleteOrder);
router.put('/:id/status', authenticate, requireCapability(CAP.DELIVERIES_MY_UPDATE_STATUS), orderController.updateOrderStatus);
router.patch('/:id/status', authenticate, requireCapability(CAP.DELIVERIES_MY_UPDATE_STATUS), orderController.updateOrderStatus);
router.patch('/:id/date', authenticate, requireCapability(CAP.ORDERS_DATE_WRITE), orderController.updateOrderDate);
router.put('/:id/date', authenticate, requireCapability(CAP.ORDERS_DATE_WRITE), orderController.updateOrderDate);
router.put('/admin/:id/items', authenticate, requireAdmin, orderController.updateOrderItems);
router.delete('/:id', authenticate, requireAdmin, orderController.deleteOrder);

export default router;
