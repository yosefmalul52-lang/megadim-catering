"use strict";
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
const checkoutLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: {
        error: 'Too many order submissions from this IP, please try again later.',
        retryAfter: '15 minutes'
    }
});
const { authenticate } = require('../middleware/auth');
const optionalAuthenticate = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    console.log('KZ Authorization Header:', authHeader);
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.log('KZ: No Authorization header or not Bearer token - proceeding as guest');
        req.user = null;
        return next();
    }
    const token = authHeader.replace('Bearer ', '').trim();
    console.log('KZ: Extracted token (first 20 chars):', token.substring(0, 20) + '...');
    try {
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        console.log('KZ Decoded Token:', JSON.stringify(decoded, null, 2));
        const userId = decoded.id || decoded.userId || decoded._id;
        console.log('KZ: Extracted userId from token:', userId);
        console.log('KZ: userId type:', typeof userId);
        if (!userId) {
            console.warn('KZ: No user ID found in token payload - proceeding as guest');
            req.user = null;
            return next();
        }
        const User = require('../models/User');
        const user = await User.findById(userId);
        console.log('KZ: User lookup result:', user ? 'Found' : 'Not Found');
        if (user && user.isActive) {
            req.user = {
                _id: user._id,
                id: user._id.toString(),
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
        console.warn('KZ: Invalid token in optional auth, proceeding as guest. Error:', err.message);
        req.user = null;
    }
    next();
};
router.post('/checkout', checkoutLimiter, optionalAuthenticate, orderController.submitOrder);
router.get('/my-orders', authenticate, orderController.getMyOrders);
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
//# sourceMappingURL=order.routes.js.map