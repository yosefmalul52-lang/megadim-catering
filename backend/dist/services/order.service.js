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
exports.OrderService = void 0;
const Order_1 = __importDefault(require("../models/Order"));
const menuItem_1 = __importDefault(require("../models/menuItem"));
const mongoose_1 = __importDefault(require("mongoose"));
const email_service_1 = require("./email.service");
class OrderService {
    constructor() {
        // Categories that should only show units, not calculated weight
        this.UNIT_ONLY_CATEGORIES = ['דגים', 'מנות עיקריות', 'Fish', 'Main Courses'];
    }
    generateOrderNumber() {
        return 'MG-' + Math.floor(100000 + Math.random() * 900000).toString();
    }
    // Submit a new order
    submitOrder(orderData_1) {
        return __awaiter(this, arguments, void 0, function* (orderData, userId = null) {
            try {
                console.log('📝 OrderService: Creating order for user:', userId || 'Guest');
                console.log('📝 OrderService: Order data:', JSON.stringify(orderData, null, 2));
                // Map items to include category and imageUrl if missing
                const orderItems = orderData.items.map(item => {
                    let category = item.category;
                    if (!category || category.trim() === '') {
                        category = this.detectCategoryFromName(item.name);
                    }
                    return {
                        productId: item.id,
                        name: item.name,
                        price: item.price,
                        quantity: item.quantity,
                        category,
                        imageUrl: item.imageUrl || item.image || undefined
                    };
                });
                // Calculate total price
                const totalPrice = orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
                // Create order document
                const order = new Order_1.default({
                    userId: userId || null, // null for guest orders
                    orderNumber: this.generateOrderNumber(),
                    customerDetails: {
                        fullName: orderData.customerName,
                        phone: orderData.phone,
                        email: orderData.email,
                        address: orderData.deliveryAddress,
                        notes: orderData.notes,
                        preferredDeliveryTime: orderData.preferredDeliveryTime,
                        eventDate: orderData.eventDate,
                        eventType: orderData.eventType,
                        guestCount: orderData.guestCount
                    },
                    items: orderItems,
                    totalPrice: totalPrice,
                    status: 'new'
                });
                // Save order
                const savedOrder = yield order.save();
                console.log('✅ OrderService: Order saved successfully:', savedOrder._id);
                console.log('✅ OrderService: Saved order userId:', savedOrder.userId);
                // Send order email to owner immediately after save
                try {
                    yield email_service_1.emailService.sendOrderEmail(savedOrder);
                    console.log('✅ OrderService: Order email sent successfully');
                }
                catch (emailError) {
                    // Log email error but don't fail the order creation
                    console.error('⚠️ OrderService: Failed to send order email (order still saved):', emailError);
                }
                return {
                    success: true,
                    orderId: savedOrder._id.toString(),
                    message: 'Order submitted successfully',
                    totalAmount: totalPrice
                };
            }
            catch (error) {
                console.error('❌ OrderService: Error submitting order:', error);
                if (error.name === 'ValidationError') {
                    console.error('❌ Validation errors:', error.errors);
                }
                throw error;
            }
        });
    }
    /** Create order from checkout payload (POST /api/orders). Saves to DB, sends admin email, returns saved order. */
    createOrderFromCheckout(payload) {
        return __awaiter(this, void 0, void 0, function* () {
            var _j;
            const addressStr = typeof payload.address === 'string'
                ? payload.address
                : payload.address && typeof payload.address === 'object'
                    ? [payload.address.city, payload.address.street, payload.address.apartment].filter(Boolean).join(', ')
                    : '';
            const orderItems = payload.items.map(item => ({
                productId: item.id,
                name: item.name,
                price: item.price,
                quantity: item.quantity,
                category: item.category || this.detectCategoryFromName(item.name),
                imageUrl: item.imageUrl || item.image || undefined
            }));
            const isManual = payload.manualOrder === true;
            const status = isManual ? 'processing' : 'pending';
            const customerDetails = {
                fullName: payload.customerName,
                phone: payload.phone,
                email: payload.email,
                address: addressStr,
                deliveryMethod: payload.deliveryMethod,
                eventDate: payload.eventDate,
                deliveryFee: payload.deliveryFee,
                subtotal: payload.subtotal,
                notes: payload.notes
            };
            if (isManual && payload.paymentStatus) {
                customerDetails.isPaid = payload.paymentStatus === 'paid';
            }
            const order = new Order_1.default({
                userId: (_j = payload.userId) !== null && _j !== void 0 ? _j : null,
                orderNumber: this.generateOrderNumber(),
                customerDetails,
                items: orderItems,
                totalPrice: payload.totalAmount,
                status
            });
            const savedOrder = yield order.save();
            console.log('✅ OrderService: Checkout order saved:', savedOrder._id);
            // Admin email is sent from order.controller createOrder (nodemailer) so failures don't affect response
            return savedOrder;
        });
    }
    // Get orders by user ID
    getOrdersByUserId(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const orders = yield Order_1.default.find({ userId: userId })
                    .sort({ createdAt: -1 })
                    .lean();
                return orders;
            }
            catch (error) {
                console.error('Error fetching user orders:', error);
                throw error;
            }
        });
    }
    // Get all orders with filters (Admin). archive=true => isDeleted or cancelled; otherwise active only (isDeleted false).
    getAllOrders(filters) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const query = {};
                if (filters.archive === true) {
                    query.$or = [{ isDeleted: true }, { status: 'cancelled' }];
                }
                else {
                    query.isDeleted = { $ne: true };
                }
                if (filters.status) {
                    query.status = filters.status;
                }
                if (filters.startDate || filters.endDate) {
                    query.createdAt = {};
                    if (filters.startDate) {
                        query.createdAt.$gte = filters.startDate;
                    }
                    if (filters.endDate) {
                        query.createdAt.$lte = filters.endDate;
                    }
                }
                const total = yield Order_1.default.countDocuments(query);
                const orders = yield Order_1.default.find(query)
                    .sort({ 'customerDetails.eventDate': 1, createdAt: -1 })
                    .limit(filters.limit || 100)
                    .skip(filters.offset || 0)
                    .lean();
                return {
                    orders: orders,
                    total
                };
            }
            catch (error) {
                console.error('Error fetching all orders:', error);
                throw error;
            }
        });
    }
    // Get order by ID (with user verification). Enriches items with imageUrl from menu when missing.
    getOrderById(orderId, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _j;
            try {
                const order = yield Order_1.default.findOne({
                    _id: orderId,
                    userId: userId
                }).lean();
                if (!order || !((_j = order.items) === null || _j === void 0 ? void 0 : _j.length))
                    return order;
                yield this.enrichOrderItemsImageUrlPublic(order.items);
                return order;
            }
            catch (error) {
                console.error('Error fetching order by ID:', error);
                throw error;
            }
        });
    }
    /** Get order by ID without user filter (admin only). */
    getOrderByIdForAdmin(orderId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _j;
            try {
                const order = yield Order_1.default.findOne({ _id: orderId }).lean();
                if (!order || !((_j = order.items) === null || _j === void 0 ? void 0 : _j.length))
                    return order;
                yield this.enrichOrderItemsImageUrlPublic(order.items);
                return order;
            }
            catch (error) {
                console.error('Error fetching order by ID (admin):', error);
                throw error;
            }
        });
    }
    /** Fills imageUrl on each item from MenuItem when missing. Accepts productId as string or ObjectId. */
    enrichOrderItemsImageUrlPublic(items) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!(items === null || items === void 0 ? void 0 : items.length))
                return;
            for (const item of items) {
                if (item.imageUrl && String(item.imageUrl).trim())
                    continue;
                const productId = item.productId;
                if (!productId)
                    continue;
                try {
                    let product = yield menuItem_1.default.findById(productId).select('imageUrl').lean();
                    if (!(product === null || product === void 0 ? void 0 : product.imageUrl) && typeof productId === 'string') {
                        product = yield menuItem_1.default.findOne({ _id: productId }).select('imageUrl').lean();
                    }
                    if (product === null || product === void 0 ? void 0 : product.imageUrl)
                        item.imageUrl = String(product.imageUrl).trim();
                }
                catch (_j) {
                    // ignore single lookup failure
                }
            }
        });
    }
    // Update order status
    updateOrderStatus(orderId, updates) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const updateData = {};
                if (updates.status)
                    updateData.status = updates.status;
                if (updates.deliveryDate)
                    updateData.deliveryDate = updates.deliveryDate;
                if (updates.notes !== undefined)
                    updateData['customerDetails.notes'] = updates.notes;
                const order = yield Order_1.default.findByIdAndUpdate(orderId, { $set: updateData }, { new: true }).lean();
                return order;
            }
            catch (error) {
                console.error('Error updating order status:', error);
                throw error;
            }
        });
    }
    /**
     * Update order items securely (Admin):
     * - Uses MenuItem as the single source of truth for price/name/category.
     * - Recalculates totalPrice on the server from authenticated product prices.
     */
    updateOrderItems(orderId, newItems) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!Array.isArray(newItems) || newItems.length === 0) {
                throw new Error('items array is required and must not be empty');
            }
            const normalizedItems = yield Promise.all(newItems.map((rawItem, index) => __awaiter(this, void 0, void 0, function* () {
                var _j;
                const item = rawItem || {};
                const productId = String(item.productId || item.id || '').trim();
                const quantity = Number(item.quantity);
                if (!productId) {
                    throw new Error(`items[${index}].productId (or id) is required`);
                }
                if (!Number.isFinite(quantity) || quantity <= 0) {
                    throw new Error(`items[${index}].quantity must be a positive number`);
                }
                // Prevent CastError crash on invalid ObjectId values.
                // Some legacy/cart flows send composite ids like "<objectId>-<timestamp>".
                // In that case, safely extract the ObjectId prefix.
                let lookupProductId = productId;
                if (!mongoose_1.default.Types.ObjectId.isValid(lookupProductId)) {
                    const objectIdPrefix = (_j = lookupProductId.match(/^[a-fA-F0-9]{24}/)) === null || _j === void 0 ? void 0 : _j[0];
                    if (objectIdPrefix && mongoose_1.default.Types.ObjectId.isValid(objectIdPrefix)) {
                        lookupProductId = objectIdPrefix;
                    }
                    else {
                        throw new Error(`Invalid product id format at items[${index}] (${productId})`);
                    }
                }
                // Security: fetch authentic product data (especially price) from DB.
                const product = yield menuItem_1.default.findById(lookupProductId).lean();
                if (!product) {
                    throw new Error(`Product not found for items[${index}] (id=${lookupProductId})`);
                }
                const authenticPrice = Number(product.price);
                if (!Number.isFinite(authenticPrice) || authenticPrice < 0) {
                    throw new Error(`Invalid product price in DB for product ${lookupProductId}`);
                }
                return {
                    productId: String(product._id || lookupProductId),
                    name: String(product.name || item.name || ''),
                    price: authenticPrice,
                    quantity,
                    category: product.category,
                    imageUrl: product.imageUrl,
                    description: product.description
                };
            })));
            const recalculatedTotalPrice = normalizedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
            const updated = yield Order_1.default.findByIdAndUpdate(orderId, {
                $set: {
                    items: normalizedItems,
                    totalPrice: Math.round(recalculatedTotalPrice * 100) / 100
                }
            }, { new: true }).lean();
            return updated;
        });
    }
    /** Update order event/delivery date (Admin). Sets customerDetails.eventDate (stored as YYYY-MM-DD). */
    updateOrderEventDate(orderId, eventDate) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const dateValue = typeof eventDate === 'string' ? new Date(eventDate + 'T12:00:00.000Z') : eventDate;
                if (isNaN(dateValue.getTime())) {
                    throw new Error('Invalid date');
                }
                const dateStr = dateValue.toISOString().slice(0, 10);
                const updateResult = yield Order_1.default.updateOne({ _id: orderId }, { $set: { 'customerDetails.eventDate': dateStr } });
                if (updateResult.matchedCount === 0)
                    return null;
                const updated = yield Order_1.default.findById(orderId).lean();
                return updated;
            }
            catch (error) {
                console.error('Error updating order event date:', error);
                throw error;
            }
        });
    }
    /** Dashboard stats: pending count, events today count, monthly revenue. */
    getDashboardStats() {
        return __awaiter(this, void 0, void 0, function* () {
            var _j, _k;
            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
            const todayStr = now.toISOString().slice(0, 10); // YYYY-MM-DD
            const activeQuery = { isDeleted: { $ne: true } };
            const [pendingCount, eventsTodayCount, monthlyRevenueResult] = yield Promise.all([
                Order_1.default.countDocuments(Object.assign(Object.assign({}, activeQuery), { status: { $in: ['pending', 'new'] } })),
                Order_1.default.countDocuments(Object.assign(Object.assign({}, activeQuery), { 'customerDetails.eventDate': todayStr })),
                Order_1.default.aggregate([
                    {
                        $match: {
                            isDeleted: { $ne: true },
                            createdAt: { $gte: startOfMonth, $lte: endOfMonth },
                            status: { $ne: 'cancelled' }
                        }
                    },
                    { $group: { _id: null, total: { $sum: '$totalPrice' } } }
                ])
            ]);
            const monthlyRevenue = (_k = (_j = monthlyRevenueResult[0]) === null || _j === void 0 ? void 0 : _j.total) !== null && _k !== void 0 ? _k : 0;
            return { pendingCount, eventsTodayCount, monthlyRevenue };
        });
    }
    // Get order statistics
    getOrderStatistics() {
        return __awaiter(this, arguments, void 0, function* (period = 'month') {
            var _j;
            try {
                const now = new Date();
                let startDate;
                switch (period) {
                    case 'week':
                        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                        break;
                    case 'month':
                        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                        break;
                    case 'year':
                        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
                        break;
                    default:
                        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                }
                const totalOrders = yield Order_1.default.countDocuments({
                    createdAt: { $gte: startDate }
                });
                const totalRevenue = yield Order_1.default.aggregate([
                    {
                        $match: {
                            createdAt: { $gte: startDate },
                            status: { $ne: 'cancelled' }
                        }
                    },
                    {
                        $group: {
                            _id: null,
                            total: { $sum: '$totalPrice' }
                        }
                    }
                ]);
                const ordersByStatus = yield Order_1.default.aggregate([
                    {
                        $match: {
                            createdAt: { $gte: startDate }
                        }
                    },
                    {
                        $group: {
                            _id: '$status',
                            count: { $sum: 1 }
                        }
                    }
                ]);
                return {
                    period,
                    totalOrders,
                    totalRevenue: ((_j = totalRevenue[0]) === null || _j === void 0 ? void 0 : _j.total) || 0,
                    ordersByStatus: ordersByStatus.reduce((acc, item) => {
                        acc[item._id] = item.count;
                        return acc;
                    }, {})
                };
            }
            catch (error) {
                console.error('Error fetching order statistics:', error);
                throw error;
            }
        });
    }
    // Get recent orders
    getRecentOrders() {
        return __awaiter(this, arguments, void 0, function* (limit = 10) {
            try {
                const orders = yield Order_1.default.find()
                    .sort({ createdAt: -1 })
                    .limit(limit)
                    .lean();
                return orders;
            }
            catch (error) {
                console.error('Error fetching recent orders:', error);
                throw error;
            }
        });
    }
    // Delete order
    // Soft delete: set isDeleted = true
    deleteOrder(orderId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const order = yield Order_1.default.findByIdAndUpdate(orderId, { $set: { isDeleted: true } }, { new: true }).lean();
                return order;
            }
            catch (error) {
                console.error('Error deleting order:', error);
                throw error;
            }
        });
    }
    // Restore order: set isDeleted = false and status = 'pending'
    restoreOrder(orderId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const order = yield Order_1.default.findByIdAndUpdate(orderId, { $set: { isDeleted: false, status: 'pending' } }, { new: true }).lean();
                return order;
            }
            catch (error) {
                console.error('Error restoring order:', error);
                throw error;
            }
        });
    }
    // Permanent delete: remove document from DB (irreversible)
    permanentDeleteOrder(orderId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const result = yield Order_1.default.findByIdAndDelete(orderId);
                return result != null;
            }
            catch (error) {
                console.error('Error permanently deleting order:', error);
                throw error;
            }
        });
    }
    // Search orders
    searchOrders(query) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const orders = yield Order_1.default.find({
                    $or: [
                        { 'customerDetails.fullName': { $regex: query, $options: 'i' } },
                        { 'customerDetails.phone': { $regex: query, $options: 'i' } },
                        { 'customerDetails.email': { $regex: query, $options: 'i' } }
                    ]
                })
                    .sort({ createdAt: -1 })
                    .lean();
                return orders;
            }
            catch (error) {
                console.error('Error searching orders:', error);
                throw error;
            }
        });
    }
    // Get revenue statistics for chart
    getRevenueStats() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const sevenDaysAgo = new Date();
                sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
                const revenueStats = yield Order_1.default.aggregate([
                    {
                        $match: {
                            createdAt: { $gte: sevenDaysAgo },
                            status: { $ne: 'cancelled' }
                        }
                    },
                    {
                        $group: {
                            _id: {
                                $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
                            },
                            total: { $sum: '$totalPrice' }
                        }
                    },
                    {
                        $sort: { _id: 1 }
                    },
                    {
                        $project: {
                            _id: 0,
                            date: '$_id',
                            total: 1
                        }
                    }
                ]);
                return revenueStats;
            }
            catch (error) {
                console.error('Error fetching revenue stats:', error);
                throw error;
            }
        });
    }
    // Get kitchen preparation report - using aggregation pipeline with $lookup (like Order Management dashboard)
    // Uses Mongoose aggregation to populate product details, ensuring exact same data structure
    getKitchenReport(targetDate) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Active order statuses - include all variations
                const activeStatuses = ['new', 'in-progress', 'ready', 'accepted', 'processing', 'בטיפול', 'חדש', 'New'];
                const normalizedTargetDate = typeof targetDate === 'string' && targetDate.trim()
                    ? (targetDate.includes('T') ? targetDate.slice(0, 10) : targetDate.trim())
                    : '';
                const matchStage = {
                    status: { $in: activeStatuses }
                };
                // Kitchen prep should use the intended delivery/pickup date (customerDetails.eventDate).
                // Match exact YYYY-MM-DD and also tolerate values that include a time suffix.
                if (normalizedTargetDate) {
                    const escapedDate = normalizedTargetDate.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const dateRegex = new RegExp(`^${escapedDate}`);
                    matchStage.$or = [
                        { 'customerDetails.eventDate': normalizedTargetDate },
                        { 'customerDetails.eventDate': dateRegex }
                    ];
                }
                console.log('🔍 OrderService: Starting kitchen report with aggregation pipeline');
                console.log('🔍 OrderService: Filtering by statuses:', activeStatuses);
                if (normalizedTargetDate) {
                    console.log('🔍 OrderService: Filtering kitchen report by event date:', normalizedTargetDate);
                }
                // Use aggregation pipeline with $lookup to populate product details
                const aggregationResult = yield Order_1.default.aggregate([
                    // Step 1: Match active orders
                    {
                        $match: matchStage
                    },
                    // Step 2: Unwind items array
                    {
                        $unwind: '$items'
                    },
                    // Step 3: Lookup product details from menuitems collection
                    // Handle both ObjectId and string productId formats safely
                    // Use string comparison only to avoid ObjectId conversion errors
                    {
                        $lookup: {
                            from: 'menuitems',
                            let: { productIdString: { $toString: { $ifNull: ['$items.productId', ''] } } },
                            pipeline: [
                                {
                                    $match: {
                                        $expr: {
                                            // Match if productId matches _id as string (works for both ObjectId and non-ObjectId)
                                            $eq: [
                                                { $toString: '$_id' },
                                                '$$productIdString'
                                            ]
                                        }
                                    }
                                }
                            ],
                            as: 'productDetails'
                        }
                    },
                    // Step 4: Unwind productDetails (returns array, we want object)
                    {
                        $unwind: {
                            path: '$productDetails',
                            preserveNullAndEmptyArrays: true // Keep items even if product not found
                        }
                    },
                    // Step 5: Project fields we need
                    {
                        $project: {
                            productName: {
                                $ifNull: ['$items.name', 'Unknown Product']
                            },
                            productId: '$items.productId',
                            quantity: { $ifNull: ['$items.quantity', 0] },
                            // CRITICAL: Use category from populated productDetails, NOT from order item
                            category: {
                                $ifNull: [
                                    '$productDetails.category', // First priority: from DB lookup
                                    { $ifNull: ['$items.category', 'תוספות'] } // Fallback: from order item or default
                                ]
                            },
                            productNameForWeight: {
                                $ifNull: ['$items.name', 'Unknown Product']
                            },
                            hasProductDetails: {
                                $cond: {
                                    if: { $ne: ['$productDetails', null] },
                                    then: true,
                                    else: false
                                }
                            }
                        }
                    },
                    // Step 6: Filter out items with zero or negative quantity
                    {
                        $match: {
                            quantity: { $gt: 0 }
                        }
                    },
                    // Step 7: Group by category and product name
                    {
                        $group: {
                            _id: {
                                category: '$category',
                                productName: '$productName'
                            },
                            totalPackages: { $sum: '$quantity' },
                            productName: { $first: '$productName' },
                            category: { $first: '$category' },
                            weightString: { $first: '$productNameForWeight' },
                            hasProductDetails: { $first: '$hasProductDetails' }
                        }
                    },
                    // Step 8: Project final output
                    {
                        $project: {
                            _id: 0,
                            productName: 1,
                            category: 1,
                            totalPackages: 1,
                            weightString: 1,
                            hasProductDetails: 1
                        }
                    },
                    // Step 9: Sort by category and product name
                    {
                        $sort: {
                            category: 1,
                            productName: 1
                        }
                    }
                ]);
                console.log('🔍 OrderService: Aggregation result count:', aggregationResult.length);
                console.log('🔍 OrderService: Sample aggregation result:', JSON.stringify(aggregationResult.slice(0, 3), null, 2));
                // Debug: Log items that failed lookup
                const itemsWithoutProduct = aggregationResult.filter((item) => !item.hasProductDetails);
                if (itemsWithoutProduct.length > 0) {
                    console.warn('⚠️ OrderService: Items without product details:', itemsWithoutProduct.length);
                    console.warn('⚠️ OrderService: Sample items without product:', JSON.stringify(itemsWithoutProduct.slice(0, 2), null, 2));
                }
                if (aggregationResult.length === 0) {
                    console.warn('⚠️ OrderService: No items found in active orders');
                    return [];
                }
                // Process results: Calculate weights and format output
                // Add safety checks to prevent crashes
                const kitchenReportItems = [];
                for (const item of aggregationResult) {
                    try {
                        // SAFETY CHECK: Ensure item has required fields
                        if (!item || !item.productName) {
                            console.warn('⚠️ Skipping invalid item:', JSON.stringify(item, null, 2));
                            continue;
                        }
                        const productName = item.productName || 'Unknown Product';
                        const category = item.category || 'תוספות';
                        const totalPackages = item.totalPackages || 0;
                        // Validate totalPackages is a valid number
                        if (isNaN(totalPackages) || totalPackages <= 0) {
                            console.warn('⚠️ Skipping item with invalid quantity:', productName, 'quantity:', totalPackages);
                            continue;
                        }
                        // Check if this category should be calculated by units only
                        const isUnitOnlyCategory = this.UNIT_ONLY_CATEGORIES.some(cat => category.toLowerCase().includes(cat.toLowerCase()) ||
                            cat.toLowerCase().includes(category.toLowerCase()));
                        // Extract weight/volume from product name (only if not unit-only category)
                        const weightInfo = isUnitOnlyCategory
                            ? { value: 0, unit: null }
                            : this.extractWeightFromName(productName);
                        // Calculate total weight: weight per unit × total packages
                        const totalWeightRaw = isUnitOnlyCategory ? 0 : (weightInfo.value * totalPackages);
                        // Format weight for display
                        const displayWeight = isUnitOnlyCategory
                            ? '-'
                            : this.formatWeight(totalWeightRaw, weightInfo.unit);
                        console.log(`📊 Processing: "${productName}" (${category}) -> ${totalPackages} packages, ${displayWeight} total weight`);
                        kitchenReportItems.push({
                            productName: productName,
                            category: category,
                            totalPackages: totalPackages,
                            totalWeightRaw: totalWeightRaw,
                            displayWeight: displayWeight,
                            unit: weightInfo.unit || undefined,
                            isUnitOnly: isUnitOnlyCategory
                        });
                    }
                    catch (itemError) {
                        console.error('❌ Error processing item:', itemError);
                        console.error('❌ Item data:', JSON.stringify(item, null, 2));
                        // Continue to next item
                    }
                }
                // Final sort by category order
                const categoryOrder = ['מנות עיקריות', 'סלטים', 'דגים', 'קינוחים'];
                kitchenReportItems.sort((a, b) => {
                    const categoryAIndex = categoryOrder.indexOf(a.category);
                    const categoryBIndex = categoryOrder.indexOf(b.category);
                    if (categoryAIndex !== categoryBIndex) {
                        if (categoryAIndex === -1 && categoryBIndex === -1) {
                            return a.category.localeCompare(b.category);
                        }
                        if (categoryAIndex === -1)
                            return 1;
                        if (categoryBIndex === -1)
                            return -1;
                        return categoryAIndex - categoryBIndex;
                    }
                    return a.productName.localeCompare(b.productName);
                });
                const kitchenReport = kitchenReportItems;
                console.log('🍳 OrderService: Kitchen report generated:', JSON.stringify(kitchenReport, null, 2));
                console.log('🍳 OrderService: Report items count:', kitchenReport.length);
                return kitchenReport;
            }
            catch (error) {
                console.error('❌ Error generating kitchen report:', error);
                console.error('❌ Error stack:', error.stack);
                throw new Error(`Failed to generate kitchen report: ${error.message}`);
            }
        });
    }
    // Helper: Detect category from product name
    detectCategoryFromName(productName) {
        const name = productName.toLowerCase();
        // Check for salad keywords
        if (name.includes('סלט') || name.includes('salad')) {
            return 'סלטים';
        }
        // Check for fish keywords
        if (name.includes('דג') || name.includes('fish') || name.includes('salmon') || name.includes('tuna')) {
            return 'דגים';
        }
        // Check for main course keywords
        if (name.includes('עיקרי') || name.includes('main') || name.includes('בשר') || name.includes('meat')) {
            return 'מנות עיקריות';
        }
        // Check for dessert keywords
        if (name.includes('קינוח') || name.includes('dessert') || name.includes('עוגה') || name.includes('cake')) {
            return 'קינוחים';
        }
        // If weight/volume units are detected, likely a salad
        if (/\d+\s*(g|ml|גרם|מ"ל|ק"ג|ליטר)/i.test(name)) {
            return 'סלטים';
        }
        // Default fallback
        return 'תוספות';
    }
    // Helper: Extract weight/volume from product name
    extractWeightFromName(productName) {
        // Regex to match: number + unit (English & Hebrew)
        // Examples: "250g", "250 גרם", "1kg", "1 ק"ג", "500ml", "500 מ"ל"
        const weightRegex = /(\d+(?:\.\d+)?)\s*(g|ml|גרם|מ"ל|ק"ג|ליטר|kg|l|קילו|ליטר)/i;
        const match = productName.match(weightRegex);
        if (!match) {
            return { value: 0, unit: null };
        }
        const value = parseFloat(match[1]);
        const unitStr = match[2].toLowerCase();
        // Normalize units to grams/ml
        let normalizedValue = value;
        let unit = null;
        if (unitStr.includes('g') || unitStr.includes('גרם')) {
            unit = 'g';
            normalizedValue = value;
        }
        else if (unitStr.includes('kg') || unitStr.includes('ק"ג') || unitStr.includes('קילו')) {
            unit = 'kg';
            normalizedValue = value * 1000; // Convert to grams
        }
        else if (unitStr.includes('ml') || unitStr.includes('מ"ל')) {
            unit = 'ml';
            normalizedValue = value;
        }
        else if (unitStr.includes('l') || unitStr.includes('ליטר')) {
            unit = 'l';
            normalizedValue = value * 1000; // Convert to ml
        }
        return { value: normalizedValue, unit };
    }
    // Helper: Format weight for display
    formatWeight(totalWeightRaw, unit) {
        if (totalWeightRaw === 0 || !unit) {
            return '-';
        }
        if (unit === 'g' || unit === 'ml') {
            if (totalWeightRaw >= 1000) {
                const kg = (totalWeightRaw / 1000).toFixed(2);
                return `${kg} ${unit === 'g' ? 'kg' : 'l'}`;
            }
            return `${totalWeightRaw.toFixed(0)} ${unit}`;
        }
        if (unit === 'kg' || unit === 'l') {
            return `${totalWeightRaw.toFixed(2)} ${unit}`;
        }
        return '-';
    }
    /** Build delivery+pickup groups for a single day's orders. */
    getDeliveryReportForOneDay(dateStr) {
        return __awaiter(this, void 0, void 0, function* () {
            const query = {
                status: { $ne: 'cancelled' },
                isDeleted: { $ne: true },
                'customerDetails.eventDate': dateStr
            };
            const activeOrders = yield Order_1.default.find(query).lean();
            const cityMap = {};
            const pickupTimeMap = {};
            for (const order of activeOrders) {
                const customerDetails = order.customerDetails || {};
                const deliveryDetails = customerDetails.deliveryDetails || {};
                const deliveryMethod = customerDetails.deliveryMethod === 'pickup' ? 'pickup' : 'delivery';
                let city = (deliveryDetails === null || deliveryDetails === void 0 ? void 0 : deliveryDetails.city) || customerDetails.city || customerDetails.deliveryCity || null;
                if (!city && customerDetails.address) {
                    const addressParts = customerDetails.address.split(',').map((p) => p.trim());
                    city = addressParts[addressParts.length - 1] || null;
                }
                if (city)
                    city = city.trim();
                else
                    city = 'כתובת לא צוינה';
                const orderSummary = {
                    _id: order._id.toString(),
                    status: order.status || 'pending',
                    customerDetails: {
                        name: customerDetails.fullName || 'לא צוין',
                        phone: customerDetails.phone || 'לא צוין'
                    },
                    deliveryDetails: {
                        address: customerDetails.address || deliveryDetails.address || 'לא צוין',
                        city: city,
                        floor: deliveryDetails.floor || customerDetails.floor || null,
                        comments: customerDetails.notes || deliveryDetails.comments || null
                    },
                    totalPrice: order.totalPrice || 0,
                    isPaid: customerDetails.isPaid || deliveryDetails.isPaid || false,
                    items: order.items || [],
                    notes: customerDetails.notes || deliveryDetails.comments || null,
                    deliveryMethod,
                    eventDate: customerDetails.eventDate || null,
                    preferredDeliveryTime: customerDetails.preferredDeliveryTime || null
                };
                if (deliveryMethod === 'pickup') {
                    const timeSlot = orderSummary.preferredDeliveryTime || 'לא צוין';
                    if (!pickupTimeMap[timeSlot])
                        pickupTimeMap[timeSlot] = [];
                    pickupTimeMap[timeSlot].push(orderSummary);
                }
                else {
                    if (!cityMap[city])
                        cityMap[city] = [];
                    cityMap[city].push(orderSummary);
                }
            }
            const deliveryByCity = Object.keys(cityMap)
                .map(city => ({ city, orders: cityMap[city] }))
                .sort((a, b) => a.city.localeCompare(b.city));
            const pickupByTime = Object.keys(pickupTimeMap)
                .map(time => ({ time, orders: pickupTimeMap[time] }))
                .sort((a, b) => a.time.localeCompare(b.time));
            return { deliveryByCity, pickupByTime };
        });
    }
    /** Get delivery report for a single day or a date range. Returns days keyed by YYYY-MM-DD. */
    getDeliveryReport(fromDate, toDate) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const norm = (d) => (d && d.indexOf('T') >= 0 ? d.slice(0, 10) : d) || '';
                const from = norm(fromDate || '');
                const to = norm(toDate || '');
                const dateStrings = [];
                if (from && to) {
                    const start = new Date(from);
                    const end = new Date(to);
                    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                        dateStrings.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'));
                    }
                }
                else if (from) {
                    dateStrings.push(from);
                }
                const days = {};
                for (const dateStr of dateStrings) {
                    days[dateStr] = yield this.getDeliveryReportForOneDay(dateStr);
                }
                console.log('🚚 Delivery report: days', Object.keys(days).length);
                return { days };
            }
            catch (error) {
                console.error('❌ Error generating delivery report:', error);
                throw new Error(`Failed to generate delivery report: ${error.message}`);
            }
        });
    }
}
exports.OrderService = OrderService;
