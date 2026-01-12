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
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderController = void 0;
const order_service_1 = require("../services/order.service");
const errorHandler_1 = require("../middleware/errorHandler");
class OrderController {
    constructor() {
        // Submit new order (checkout)
        this.submitOrder = (0, errorHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            // Log the incoming request for debugging
            console.log('📥 Received order request:', JSON.stringify(req.body, null, 2));
            console.log('📥 Request headers:', req.headers);
            const orderData = req.body;
            // Extract userId from token if authenticated (optional - allows guest orders)
            // KZ: Handle both 'id' and '_id' to be safe - token payload uses 'id'
            const user = req.user;
            // KZ: Log ENTIRE req.user object
            console.log('KZ Controller - FULL REQ.USER:', JSON.stringify(user, null, 2));
            console.log('KZ Controller - user?.id:', user === null || user === void 0 ? void 0 : user.id);
            console.log('KZ Controller - user?._id:', user === null || user === void 0 ? void 0 : user._id);
            console.log('KZ Controller - user object keys:', user ? Object.keys(user) : 'null');
            // KZ: Handle both 'id' and '_id' to be safe
            const userIdFromToken = (user === null || user === void 0 ? void 0 : user.id) || (user === null || user === void 0 ? void 0 : user._id);
            console.log('KZ Controller Extracted ID:', userIdFromToken);
            if (!userIdFromToken) {
                // If we want to allow guests, pass null. If we enforce users, throw error here with clear message.
                console.warn('KZ Warning: User appears to be Guest (no ID found in req.user)');
                console.warn('KZ: This will cause "User ID is required" error if userId is required in Order model');
            }
            const userId = userIdFromToken;
            // DEBUG: Log extracted userId
            console.log('📝 Creating Order for User ID:', userId);
            console.log('📝 Extracted userId:', userId);
            console.log('📝 userId type:', typeof userId);
            // Basic validation with detailed error messages
            if (!orderData.customerName || !orderData.phone || !orderData.items || orderData.items.length === 0) {
                console.error('❌ Validation failed - missing required fields:', {
                    hasCustomerName: !!orderData.customerName,
                    hasPhone: !!orderData.phone,
                    hasItems: !!orderData.items,
                    itemsLength: ((_a = orderData.items) === null || _a === void 0 ? void 0 : _a.length) || 0,
                    orderData: JSON.stringify(orderData, null, 2)
                });
                throw (0, errorHandler_1.createValidationError)('Customer name, phone, and items are required');
            }
            // Validate phone number format
            const phoneRegex = /^0\d{1,2}-?\d{7}$|^0\d{9}$/;
            if (!phoneRegex.test(orderData.phone.replace(/\s/g, ''))) {
                throw (0, errorHandler_1.createValidationError)('Please provide a valid Israeli phone number');
            }
            // Validate email if provided
            if (orderData.email) {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(orderData.email)) {
                    throw (0, errorHandler_1.createValidationError)('Please provide a valid email address');
                }
            }
            // Validate items with detailed error messages
            for (let i = 0; i < orderData.items.length; i++) {
                const item = orderData.items[i];
                console.log(`🔍 Validating item ${i + 1}:`, JSON.stringify(item, null, 2));
                if (!item.id || !item.name || item.quantity === undefined || item.quantity === null || item.price === undefined || item.price === null) {
                    console.error(`❌ Item ${i + 1} validation failed:`, {
                        hasId: !!item.id,
                        hasName: !!item.name,
                        hasQuantity: item.quantity !== undefined && item.quantity !== null,
                        hasPrice: item.price !== undefined && item.price !== null,
                        item: JSON.stringify(item, null, 2)
                    });
                    throw (0, errorHandler_1.createValidationError)(`Item ${i + 1} (${item.name || 'unnamed'}) is missing required fields: id, name, quantity, or price`);
                }
                // Ensure quantity and price are numbers
                const quantity = typeof item.quantity === 'number' ? item.quantity : parseFloat(item.quantity);
                const price = typeof item.price === 'number' ? item.price : parseFloat(item.price);
                if (isNaN(quantity) || quantity <= 0) {
                    console.error(`❌ Item ${i + 1} invalid quantity:`, item.quantity, 'parsed as:', quantity);
                    throw (0, errorHandler_1.createValidationError)(`Item ${i + 1} (${item.name}) has invalid quantity: ${item.quantity}`);
                }
                if (isNaN(price) || price <= 0) {
                    console.error(`❌ Item ${i + 1} invalid price:`, item.price, 'parsed as:', price);
                    throw (0, errorHandler_1.createValidationError)(`Item ${i + 1} (${item.name}) has invalid price: ${item.price}`);
                }
                // Update item with parsed values
                item.quantity = quantity;
                item.price = price;
            }
            // Validate guest count if provided
            if (orderData.guestCount !== undefined && orderData.guestCount <= 0) {
                throw (0, errorHandler_1.createValidationError)('Guest count must be greater than 0');
            }
            // Pass userId to service (null for guest orders)
            const response = yield this.orderService.submitOrder(orderData, userId);
            res.status(201).json({
                success: true,
                data: response,
                message: 'Order submitted successfully',
                timestamp: new Date().toISOString()
            });
        }));
        // Get user's own orders (Customer)
        this.getMyOrders = (0, errorHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            // This route requires authentication (userId will be in req.user)
            // KZ: Handle both 'id' and '_id' to be safe
            const user = req.user;
            const userId = (user === null || user === void 0 ? void 0 : user.id) || (user === null || user === void 0 ? void 0 : user._id);
            if (!userId) {
                console.error('❌ getMyOrders: No userId found in req.user');
                console.error('❌ req.user:', user);
                throw (0, errorHandler_1.createValidationError)('User authentication required');
            }
            // DEBUG: Log search details
            console.log('🔍 Searching orders for User ID:', userId);
            console.log('🔍 User ID type:', typeof userId);
            console.log('🔍 User ID stringified:', String(userId));
            console.log('🔍 User object:', {
                _id: user === null || user === void 0 ? void 0 : user._id,
                id: user === null || user === void 0 ? void 0 : user.id,
                username: user === null || user === void 0 ? void 0 : user.username
            });
            console.log('🔍 Query being used:', { userId: userId });
            const orders = yield this.orderService.getOrdersByUserId(userId);
            res.status(200).json({
                success: true,
                data: orders,
                count: orders.length,
                timestamp: new Date().toISOString()
            });
        }));
        // Get all orders (Admin only)
        this.getAllOrders = (0, errorHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const { status, limit, offset, startDate, endDate } = req.query;
            const filters = {
                status: status,
                limit: limit ? parseInt(limit, 10) : 50,
                offset: offset ? parseInt(offset, 10) : 0,
                startDate: startDate ? new Date(startDate) : undefined,
                endDate: endDate ? new Date(endDate) : undefined
            };
            const { orders, total } = yield this.orderService.getAllOrders(filters);
            res.status(200).json({
                success: true,
                data: orders,
                pagination: {
                    total,
                    limit: filters.limit,
                    offset: filters.offset,
                    hasMore: filters.offset + orders.length < total
                },
                timestamp: new Date().toISOString()
            });
        }));
        // Get order by ID (protected - user can only access their own orders)
        this.getOrderById = (0, errorHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const { id } = req.params;
            const userId = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.id) || ((_b = req.user) === null || _b === void 0 ? void 0 : _b._id);
            if (!id) {
                throw (0, errorHandler_1.createValidationError)('Order ID is required');
            }
            if (!userId) {
                return res.status(401).json({
                    success: false,
                    message: 'Authentication required'
                });
            }
            // Get order and verify it belongs to the user
            const order = yield this.orderService.getOrderById(id, userId);
            if (!order) {
                throw (0, errorHandler_1.createNotFoundError)('Order');
            }
            res.status(200).json({
                success: true,
                data: order,
                timestamp: new Date().toISOString()
            });
        }));
        // Update order status (Admin only)
        this.updateOrderStatus = (0, errorHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params;
            const { status, deliveryDate, notes } = req.body;
            if (!id) {
                throw (0, errorHandler_1.createValidationError)('Order ID is required');
            }
            if (!status) {
                throw (0, errorHandler_1.createValidationError)('Status is required');
            }
            const validStatuses = ['new', 'in-progress', 'ready', 'delivered', 'cancelled'];
            if (!validStatuses.includes(status)) {
                throw (0, errorHandler_1.createValidationError)('Invalid status value');
            }
            const updatedOrder = yield this.orderService.updateOrderStatus(id, {
                status,
                deliveryDate: deliveryDate ? new Date(deliveryDate) : undefined,
                notes
            });
            if (!updatedOrder) {
                throw (0, errorHandler_1.createNotFoundError)('Order');
            }
            res.status(200).json({
                success: true,
                data: updatedOrder,
                message: 'Order status updated successfully',
                timestamp: new Date().toISOString()
            });
        }));
        // Get order statistics (Admin only)
        this.getOrderStatistics = (0, errorHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const { period } = req.query; // 'week', 'month', 'year'
            const stats = yield this.orderService.getOrderStatistics(period);
            res.status(200).json({
                success: true,
                data: stats,
                timestamp: new Date().toISOString()
            });
        }));
        // Get recent orders (Admin only)
        this.getRecentOrders = (0, errorHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const limit = parseInt(req.query.limit) || 10;
            const recentOrders = yield this.orderService.getRecentOrders(limit);
            res.status(200).json({
                success: true,
                data: recentOrders,
                count: recentOrders.length,
                timestamp: new Date().toISOString()
            });
        }));
        // Delete order (Admin only)
        this.deleteOrder = (0, errorHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params;
            if (!id) {
                throw (0, errorHandler_1.createValidationError)('Order ID is required');
            }
            const deleted = yield this.orderService.deleteOrder(id);
            if (!deleted) {
                throw (0, errorHandler_1.createNotFoundError)('Order');
            }
            res.status(200).json({
                success: true,
                message: 'Order deleted successfully',
                timestamp: new Date().toISOString()
            });
        }));
        // Search orders (Admin only)
        this.searchOrders = (0, errorHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const { q } = req.query;
            if (!q || typeof q !== 'string') {
                throw (0, errorHandler_1.createValidationError)('Search query is required');
            }
            const orders = yield this.orderService.searchOrders(q);
            res.status(200).json({
                success: true,
                data: orders,
                count: orders.length,
                query: q,
                timestamp: new Date().toISOString()
            });
        }));
        // Get revenue statistics
        this.getRevenueStats = (0, errorHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const stats = yield this.orderService.getRevenueStats();
            res.status(200).json({
                success: true,
                data: stats
            });
        }));
        // Get kitchen preparation report
        this.getKitchenReport = (0, errorHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                // DIAGNOSTIC LOG: Check what orders exist in DB
                const OrderModel = require('../models/Order').default;
                const allOrders = yield OrderModel.find({}, 'status items').lean();
                console.log('🔍 TOTAL ORDERS FOUND:', allOrders.length);
                console.log('🔍 SAMPLE STATUSES:', allOrders.map((o) => o.status));
                console.log('🔍 UNIQUE STATUSES:', [...new Set(allOrders.map((o) => o.status))]);
                console.log('🔍 ORDERS WITH ITEMS:', allOrders.filter((o) => o.items && o.items.length > 0).length);
                // Log sample order structure
                if (allOrders.length > 0) {
                    console.log('🔍 SAMPLE ORDER:', JSON.stringify(allOrders[0], null, 2));
                    if (allOrders[0].items && allOrders[0].items.length > 0) {
                        console.log('🔍 SAMPLE ORDER ITEM:', JSON.stringify(allOrders[0].items[0], null, 2));
                        console.log('🔍 SAMPLE ITEM PRODUCTID:', allOrders[0].items[0].productId);
                        console.log('🔍 SAMPLE ITEM PRODUCTID TYPE:', typeof allOrders[0].items[0].productId);
                    }
                }
                const report = yield this.orderService.getKitchenReport();
                // Log the final result
                console.log('🥗 KITCHEN REPORT RESULT:', report);
                console.log('🥗 KITCHEN REPORT RESULT COUNT:', report.length);
                res.status(200).json({
                    success: true,
                    data: report
                });
            }
            catch (error) {
                console.error('❌ Controller Error in getKitchenReport:', error);
                console.error('❌ Error message:', error.message);
                console.error('❌ Error stack:', error.stack);
                // Return detailed error to frontend
                res.status(500).json({
                    success: false,
                    message: error.message || 'Failed to generate kitchen report',
                    error: process.env.NODE_ENV === 'development' ? error.stack : undefined
                });
            }
        }));
        // Get delivery/dispatch report - group active orders by city
        this.getDeliveryReport = (0, errorHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const report = yield this.orderService.getDeliveryReport();
                res.status(200).json({
                    success: true,
                    data: report
                });
            }
            catch (error) {
                console.error('❌ Controller Error in getDeliveryReport:', error);
                console.error('❌ Error message:', error.message);
                console.error('❌ Error stack:', error.stack);
                res.status(500).json({
                    success: false,
                    message: error.message || 'Failed to generate delivery report',
                    error: process.env.NODE_ENV === 'development' ? error.stack : undefined
                });
            }
        }));
        this.orderService = new order_service_1.OrderService();
    }
}
exports.OrderController = OrderController;
