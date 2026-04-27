"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const order_controller_1 = require("../controllers/order.controller");
const router = express_1.default.Router();
const orderController = new order_controller_1.OrderController();
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    throw new Error('JWT_SECRET must be set in environment (e.g. backend/.env)');
}
// Rate limiter for checkout endpoint only
const checkoutLimiter = (0, express_rate_limit_1.default)({
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
const optionalAuthenticate = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _j;
    const cookieToken = (_j = req.cookies) === null || _j === void 0 ? void 0 : _j.token;
    const authHeader = req.headers.authorization;
    const bearerToken = (authHeader === null || authHeader === void 0 ? void 0 : authHeader.startsWith('Bearer ')) ? authHeader.replace('Bearer ', '').trim() : null;
    const token = cookieToken || bearerToken;
    if (!token) {
        req.user = null;
        return next();
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        console.log('KZ Decoded Token:', JSON.stringify(decoded, null, 2));
        // KZ: The payload uses 'id' field (as set in auth.routes.ts: payload = { id: user._id, role: user.role })
        const userId = decoded.id || decoded.userId || decoded._id;
        console.log('KZ: Extracted userId from token:', userId);
        console.log('KZ: userId type:', typeof userId);
        if (!userId) {
            console.warn('KZ: No user ID found in token payload - proceeding as guest');
            req.user = null;
            return next();
        }
        const User = require('../models/User');
        const user = yield User.findById(userId);
        console.log('KZ: User lookup result:', user ? 'Found' : 'Not Found');
        if (user && user.isActive) {
            req.user = {
                _id: user._id,
                id: user._id.toString(), // KZ: Ensure 'id' is set as string
                username: user.username,
                role: user.role,
                fullName: user.fullName,
                phone: user.phone
            };
            console.log('KZ: req.user set successfully:', {
                id: req.user.id,
                _id: req.user._id,
                username: req.user.username,
                role: req.user.role
            });
        }
        else {
            console.warn('KZ: User not found or inactive - proceeding as guest');
            req.user = null;
        }
    }
    catch (err) {
        // Invalid token - continue as guest
        console.warn('KZ: Invalid token in optional auth, proceeding as guest. Error:', err.message);
        req.user = null;
    }
    next();
});
// Public routes - checkout is rate-limited and optionally authenticated
router.post('/checkout', checkoutLimiter, optionalAuthenticate, orderController.submitOrder);
router.post('/send', checkoutLimiter, orderController.sendOrder);
// Customer routes (authenticated; returns only current user's orders)
router.get('/my-orders', authenticate, orderController.getMyOrders);
// Staff: list / reports — driver has subset (see role-access)
router.get('/', authenticate, requireCapability(CAP.ORDERS_LIST), orderController.getAllOrders);
router.get('/analytics/revenue-by-source', authenticate, requireCapability(CAP.ORDERS_ANALYTICS), orderController.getRevenueBySource);
router.get('/analytics/monthly-revenue', authenticate, requireCapability(CAP.ORDERS_ANALYTICS), orderController.getMonthlyRevenue);
router.get('/stats', authenticate, requireCapability(CAP.ORDERS_STATS), orderController.getOrderStatistics);
router.get('/stats/revenue', authenticate, requireCapability(CAP.ORDERS_STATS_REVENUE), orderController.getRevenueStats);
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
exports.default = router;
