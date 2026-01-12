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
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
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
// Optional authentication middleware - doesn't fail if no token (for guest orders)
const optionalAuthenticate = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    // KZ: Log Authorization header
    const authHeader = req.headers.authorization;
    console.log('KZ Authorization Header:', authHeader);
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        // No token provided - continue as guest
        console.log('KZ: No Authorization header or not Bearer token - proceeding as guest');
        req.user = null;
        return next();
    }
    // Token provided - try to authenticate
    // KZ: Ensure we correctly strip 'Bearer '
    const token = authHeader.replace('Bearer ', '').trim();
    console.log('KZ: Extracted token (first 20 chars):', token.substring(0, 20) + '...');
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
// Customer routes (Protected with JWT authentication)
router.get('/my-orders', authenticate, orderController.getMyOrders);
// Admin routes (Protected with JWT authentication)
router.get('/', authenticate, orderController.getAllOrders);
router.get('/stats', authenticate, orderController.getOrderStatistics);
router.get('/stats/revenue', authenticate, orderController.getRevenueStats);
router.get('/kitchen-report', authenticate, orderController.getKitchenReport);
router.get('/delivery-report', authenticate, orderController.getDeliveryReport);
router.get('/recent', authenticate, orderController.getRecentOrders);
router.get('/search', authenticate, orderController.searchOrders);
router.get('/:id', authenticate, orderController.getOrderById);
router.put('/:id/status', authenticate, orderController.updateOrderStatus);
router.patch('/:id/status', authenticate, orderController.updateOrderStatus);
router.delete('/:id', authenticate, orderController.deleteOrder);
exports.default = router;
