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
const email_service_1 = require("../services/email.service");
const coupon_service_1 = require("../services/coupon.service");
const errorHandler_1 = require("../middleware/errorHandler");
const COUPON_VAGUE_ERROR = 'Invalid or expired coupon';
function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
class OrderController {
    constructor() {
        /** POST /send – send order summary to business email (and optionally open WhatsApp from client). */
        this.sendOrder = (0, errorHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            var _j;
            const body = req.body;
            if (!body.customerName || typeof body.customerName !== 'string' || !body.customerName.trim()) {
                throw (0, errorHandler_1.createValidationError)('customerName is required');
            }
            if (!body.phone || typeof body.phone !== 'string' || !body.phone.trim()) {
                throw (0, errorHandler_1.createValidationError)('phone is required');
            }
            if (!body.deliveryType || !['pickup', 'delivery'].includes(body.deliveryType)) {
                throw (0, errorHandler_1.createValidationError)('deliveryType must be "pickup" or "delivery"');
            }
            if (body.deliveryType === 'delivery' && (!body.address || typeof body.address !== 'string' || !body.address.trim())) {
                throw (0, errorHandler_1.createValidationError)('address is required when deliveryType is "delivery"');
            }
            if (!Array.isArray(body.items) || body.items.length === 0) {
                throw (0, errorHandler_1.createValidationError)('items array is required and must not be empty');
            }
            for (let i = 0; i < body.items.length; i++) {
                const item = body.items[i];
                if (!item.name || item.quantity == null || item.price == null) {
                    throw (0, errorHandler_1.createValidationError)(`items[${i}] must have name, quantity, and price`);
                }
            }
            if (typeof body.total !== 'number' || body.total < 0) {
                throw (0, errorHandler_1.createValidationError)('total must be a non-negative number');
            }
            if (body.customerEmail !== undefined && body.customerEmail !== null && typeof body.customerEmail === 'string' && body.customerEmail.trim() !== '' && !isValidEmail(body.customerEmail.trim())) {
                throw (0, errorHandler_1.createValidationError)('customerEmail must be a valid email address');
            }
            const emailUser = (process.env.EMAIL_USER || '').trim();
            const emailPass = process.env.EMAIL_PASS;
            const ownerEmail = (process.env.OWNER_EMAIL || '').trim();
            if (!emailUser || !emailPass) {
                console.error('EMAIL_USER or EMAIL_PASS not set – cannot send order email');
                return res.status(503).json({
                    success: false,
                    message: 'Email service is not configured',
                    timestamp: new Date().toISOString()
                });
            }
            if (!ownerEmail) {
                console.error('OWNER_EMAIL not set – cannot send order email');
                return res.status(503).json({
                    success: false,
                    message: 'Owner email is not configured (OWNER_EMAIL)',
                    timestamp: new Date().toISOString()
                });
            }
            try {
                // Pass customerEmail from frontend req.body so receipt is sent when provided
                const customerEmailFromBody = typeof body.customerEmail === 'string' ? body.customerEmail.trim() : undefined;
                yield email_service_1.emailService.sendOrderEmails(body, ownerEmail, customerEmailFromBody || undefined);
                res.status(200).json({
                    success: true,
                    message: 'Order sent to owner and customer (if email provided)',
                    timestamp: new Date().toISOString()
                });
            }
            catch (sendErr) {
                console.error('Error sending order email:', (sendErr === null || sendErr === void 0 ? void 0 : sendErr.message) || sendErr);
                const isConfigError = (_j = sendErr === null || sendErr === void 0 ? void 0 : sendErr.message) === null || _j === void 0 ? void 0 : _j.includes('not configured');
                res.status(isConfigError ? 503 : 500).json({
                    success: false,
                    message: isConfigError ? 'Email service is not configured' : 'Error sending email',
                    error: (sendErr === null || sendErr === void 0 ? void 0 : sendErr.message) || String(sendErr),
                    timestamp: new Date().toISOString()
                });
            }
        }));
        /** POST /api/orders – create order from checkout (place order). Saves to DB, sends admin email, returns created order. */
        this.createOrder = (0, errorHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            var _j, _k;
            const body = req.body;
            if (!body.customerName || typeof body.customerName !== 'string' || !body.customerName.trim()) {
                throw (0, errorHandler_1.createValidationError)('customerName is required');
            }
            if (!body.phone || typeof body.phone !== 'string' || !body.phone.trim()) {
                throw (0, errorHandler_1.createValidationError)('phone is required');
            }
            if (!body.deliveryMethod || !['delivery', 'pickup'].includes(body.deliveryMethod)) {
                throw (0, errorHandler_1.createValidationError)('deliveryMethod must be "delivery" or "pickup"');
            }
            if (body.deliveryMethod === 'delivery') {
                const addr = body.address;
                const hasAddress = typeof addr === 'string' ? !!(addr === null || addr === void 0 ? void 0 : addr.trim()) : (addr && (!!((_j = addr.city) === null || _j === void 0 ? void 0 : _j.trim()) || !!((_k = addr.street) === null || _k === void 0 ? void 0 : _k.trim())));
                if (!hasAddress) {
                    throw (0, errorHandler_1.createValidationError)('address (city and/or street) is required when deliveryMethod is "delivery"');
                }
            }
            if (!Array.isArray(body.items) || body.items.length === 0) {
                throw (0, errorHandler_1.createValidationError)('items array is required and must not be empty');
            }
            if (typeof body.subtotal !== 'number' || body.subtotal < 0) {
                throw (0, errorHandler_1.createValidationError)('subtotal must be a non-negative number');
            }
            if (typeof body.deliveryFee !== 'number' || body.deliveryFee < 0) {
                throw (0, errorHandler_1.createValidationError)('deliveryFee must be a non-negative number');
            }
            if (typeof body.totalAmount !== 'number' || body.totalAmount < 0) {
                throw (0, errorHandler_1.createValidationError)('totalAmount must be a non-negative number');
            }
            if (body.email && !isValidEmail(body.email)) {
                throw (0, errorHandler_1.createValidationError)('email must be a valid email address');
            }
            let couponIdToIncrement = null;
            if (body.couponCode && typeof body.couponCode === 'string' && body.couponCode.trim()) {
                const cartTotal = (Number(body.subtotal) || 0) + (Number(body.deliveryFee) || 0);
                const couponResult = yield (0, coupon_service_1.validateAndApplyCoupon)(body.couponCode.trim(), cartTotal);
                if (!couponResult.valid) {
                    throw (0, errorHandler_1.createValidationError)(COUPON_VAGUE_ERROR);
                }
                body.totalAmount = couponResult.newTotal;
                couponIdToIncrement = couponResult.couponId;
            }
            const user = req.user;
            const userId = user ? (user._id || user.id) : null;
            body.userId = userId;
            const savedOrder = yield this.orderService.createOrderFromCheckout(body);
            if (couponIdToIncrement) {
                yield (0, coupon_service_1.incrementCouponUsage)(couponIdToIncrement);
            }
            // Send to admin (you) + receipt to customer – like before; don't fail the request if email fails
            try {
                const ownerEmail = (process.env.OWNER_EMAIL || '').trim();
                if (ownerEmail) {
                    const addressStr = typeof body.address === 'string'
                        ? body.address
                        : body.address && typeof body.address === 'object'
                            ? [body.address.city, body.address.street, body.address.apartment].filter(Boolean).join(', ')
                            : undefined;
                    const orderDataForEmail = {
                        customerName: body.customerName,
                        phone: body.phone,
                        customerEmail: body.email,
                        eventDate: body.eventDate,
                        deliveryType: body.deliveryMethod,
                        address: addressStr,
                        notes: body.notes,
                        items: body.items.map((i) => ({ id: i.id, name: i.name, quantity: i.quantity, price: i.price })),
                        total: body.totalAmount
                    };
                    yield email_service_1.emailService.sendOrderEmails(orderDataForEmail, ownerEmail, body.email);
                    console.log('Order emails sent: admin + customer receipt');
                }
                else {
                    console.warn('OWNER_EMAIL not set – skipping order emails');
                }
            }
            catch (emailErr) {
                console.error('Email failed to send, but order was saved:', (emailErr === null || emailErr === void 0 ? void 0 : emailErr.message) || emailErr);
            }
            const plainOrder = savedOrder.toObject ? savedOrder.toObject() : savedOrder;
            res.status(201).json({
                success: true,
                orderId: savedOrder._id.toString(),
                orderNumber: plainOrder.orderNumber,
                order: plainOrder,
                message: 'Order created successfully'
            });
        }));
        // Submit new order (checkout)
        this.submitOrder = (0, errorHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            var _j;
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
                    itemsLength: ((_j = orderData.items) === null || _j === void 0 ? void 0 : _j.length) || 0,
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
        // Get all orders (Admin only). ?archive=1 returns archived/cancelled orders.
        this.getAllOrders = (0, errorHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const { status, limit, offset, startDate, endDate, archive } = req.query;
            const filters = {
                status: status,
                limit: limit ? parseInt(limit, 10) : 100,
                offset: offset ? parseInt(offset, 10) : 0,
                startDate: startDate ? new Date(startDate) : undefined,
                endDate: endDate ? new Date(endDate) : undefined,
                archive: archive === '1' || archive === 'true'
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
        // Get order by ID (customer: own orders only; admin: any order)
        this.getOrderById = (0, errorHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params;
            const user = req.user;
            const userId = (user === null || user === void 0 ? void 0 : user.id) || (user === null || user === void 0 ? void 0 : user._id);
            const isAdmin = (user === null || user === void 0 ? void 0 : user.role) === 'admin';
            if (!id) {
                throw (0, errorHandler_1.createValidationError)('Order ID is required');
            }
            if (!user || !userId) {
                return res.status(401).json({
                    success: false,
                    message: 'Authentication required'
                });
            }
            const order = isAdmin
                ? yield this.orderService.getOrderByIdForAdmin(id)
                : yield this.orderService.getOrderById(id, userId);
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
            const validStatuses = ['pending', 'processing', 'ready', 'cancelled', 'new', 'in-progress', 'delivered'];
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
            if (status === 'processing') {
                try {
                    yield email_service_1.emailService.sendOrderApprovedToCustomer(updatedOrder);
                }
                catch (emailErr) {
                    console.error('Order status updated to processing but approval email failed:', (emailErr === null || emailErr === void 0 ? void 0 : emailErr.message) || emailErr);
                }
            }
            res.status(200).json({
                success: true,
                data: updatedOrder,
                message: status === 'processing' ? 'Order approved and customer notified' : 'Order status updated successfully',
                timestamp: new Date().toISOString()
            });
        }));
        /** PATCH/PUT /api/order/:id/date – update order event/delivery date (Admin). */
        this.updateOrderDate = (0, errorHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            var _j, _k, _q;
            try {
                const { id } = req.params;
                const newDate = (_k = (_j = req.body) === null || _j === void 0 ? void 0 : _j.eventDate) !== null && _k !== void 0 ? _k : (_q = req.body) === null || _q === void 0 ? void 0 : _q.newDate;
                if (!id) {
                    throw (0, errorHandler_1.createValidationError)('Order ID is required');
                }
                if (newDate === undefined || newDate === null || String(newDate).trim() === '') {
                    throw (0, errorHandler_1.createValidationError)('eventDate or newDate is required');
                }
                const dateStr = String(newDate).trim();
                const updatedOrder = yield this.orderService.updateOrderEventDate(id, dateStr);
                if (!updatedOrder) {
                    throw (0, errorHandler_1.createNotFoundError)('Order');
                }
                res.status(200).json({
                    success: true,
                    data: updatedOrder,
                    message: 'Order event date updated successfully',
                    timestamp: new Date().toISOString()
                });
            }
            catch (err) {
                console.error('Error updating order date:', err);
                throw err;
            }
        }));
        /** PUT /api/order/admin/:id/items – replace order items and recalculate total from DB prices (Admin). */
        this.updateOrderItems = (0, errorHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            var _j;
            const { id } = req.params;
            const items = (_j = req.body) === null || _j === void 0 ? void 0 : _j.items;
            if (!id) {
                throw (0, errorHandler_1.createValidationError)('Order ID is required');
            }
            if (!Array.isArray(items) || items.length === 0) {
                throw (0, errorHandler_1.createValidationError)('items array is required and must not be empty');
            }
            const updatedOrder = yield this.orderService.updateOrderItems(id, items);
            if (!updatedOrder) {
                throw (0, errorHandler_1.createNotFoundError)('Order');
            }
            res.status(200).json({
                success: true,
                data: updatedOrder,
                message: 'Order items updated and total recalculated successfully',
                timestamp: new Date().toISOString()
            });
        }));
        /** GET /api/order/dashboard-stats – pending count, events today, monthly revenue. */
        this.getDashboardStats = (0, errorHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const stats = yield this.orderService.getDashboardStats();
            res.status(200).json({
                success: true,
                data: stats,
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
        // Delete order (Admin only) – soft delete
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
        // Restore order (Admin only) – set isDeleted: false, status: 'pending'
        this.restoreOrder = (0, errorHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params;
            if (!id) {
                throw (0, errorHandler_1.createValidationError)('Order ID is required');
            }
            const order = yield this.orderService.restoreOrder(id);
            if (!order) {
                throw (0, errorHandler_1.createNotFoundError)('Order');
            }
            res.status(200).json({
                success: true,
                data: order,
                message: 'Order restored successfully',
                timestamp: new Date().toISOString()
            });
        }));
        // Permanent delete (Admin only) – remove document from DB, irreversible
        this.permanentDeleteOrder = (0, errorHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params;
            if (!id) {
                throw (0, errorHandler_1.createValidationError)('Order ID is required');
            }
            const deleted = yield this.orderService.permanentDeleteOrder(id);
            if (!deleted) {
                throw (0, errorHandler_1.createNotFoundError)('Order');
            }
            res.status(200).json({
                success: true,
                message: 'Order permanently deleted',
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
                const targetDate = typeof req.query.date === 'string' ? req.query.date : undefined;
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
                const report = yield this.orderService.getKitchenReport(targetDate);
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
        // Get delivery/dispatch report - ?fromDate=YYYY-MM-DD&toDate=YYYY-MM-DD (range) or ?date=YYYY-MM-DD (single)
        this.getDeliveryReport = (0, errorHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const from = typeof req.query.fromDate === 'string' ? req.query.fromDate : undefined;
                const to = typeof req.query.toDate === 'string' ? req.query.toDate : undefined;
                const single = typeof req.query.date === 'string' ? req.query.date : undefined;
                const fromDate = from || (single && !to ? single : undefined);
                const toDate = to || (single && !from ? single : undefined);
                const report = yield this.orderService.getDeliveryReport(fromDate, toDate);
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
