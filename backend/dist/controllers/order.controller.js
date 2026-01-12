"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderController = void 0;
const order_service_1 = require("../services/order.service");
const errorHandler_1 = require("../middleware/errorHandler");
class OrderController {
    orderService;
    constructor() {
        this.orderService = new order_service_1.OrderService();
    }
    submitOrder = (0, errorHandler_1.asyncHandler)(async (req, res) => {
        console.log('📥 Received order request:', JSON.stringify(req.body, null, 2));
        console.log('📥 Request headers:', req.headers);
        const orderData = req.body;
        const user = req.user;
        console.log('KZ Controller - FULL REQ.USER:', JSON.stringify(user, null, 2));
        console.log('KZ Controller - user?.id:', user?.id);
        console.log('KZ Controller - user?._id:', user?._id);
        console.log('KZ Controller - user object keys:', user ? Object.keys(user) : 'null');
        const userIdFromToken = user?.id || user?._id;
        console.log('KZ Controller Extracted ID:', userIdFromToken);
        if (!userIdFromToken) {
            console.warn('KZ Warning: User appears to be Guest (no ID found in req.user)');
            console.warn('KZ: This will cause "User ID is required" error if userId is required in Order model');
        }
        const userId = userIdFromToken;
        console.log('📝 Creating Order for User ID:', userId);
        console.log('📝 Extracted userId:', userId);
        console.log('📝 userId type:', typeof userId);
        if (!orderData.customerName || !orderData.phone || !orderData.items || orderData.items.length === 0) {
            console.error('❌ Validation failed - missing required fields:', {
                hasCustomerName: !!orderData.customerName,
                hasPhone: !!orderData.phone,
                hasItems: !!orderData.items,
                itemsLength: orderData.items?.length || 0,
                orderData: JSON.stringify(orderData, null, 2)
            });
            throw (0, errorHandler_1.createValidationError)('Customer name, phone, and items are required');
        }
        const phoneRegex = /^0\d{1,2}-?\d{7}$|^0\d{9}$/;
        if (!phoneRegex.test(orderData.phone.replace(/\s/g, ''))) {
            throw (0, errorHandler_1.createValidationError)('Please provide a valid Israeli phone number');
        }
        if (orderData.email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(orderData.email)) {
                throw (0, errorHandler_1.createValidationError)('Please provide a valid email address');
            }
        }
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
            item.quantity = quantity;
            item.price = price;
        }
        if (orderData.guestCount !== undefined && orderData.guestCount <= 0) {
            throw (0, errorHandler_1.createValidationError)('Guest count must be greater than 0');
        }
        const response = await this.orderService.submitOrder(orderData, userId);
        res.status(201).json({
            success: true,
            data: response,
            message: 'Order submitted successfully',
            timestamp: new Date().toISOString()
        });
    });
    getMyOrders = (0, errorHandler_1.asyncHandler)(async (req, res) => {
        const user = req.user;
        const userId = user?.id || user?._id;
        if (!userId) {
            console.error('❌ getMyOrders: No userId found in req.user');
            console.error('❌ req.user:', user);
            throw (0, errorHandler_1.createValidationError)('User authentication required');
        }
        console.log('🔍 Searching orders for User ID:', userId);
        console.log('🔍 User ID type:', typeof userId);
        console.log('🔍 User ID stringified:', String(userId));
        console.log('🔍 User object:', {
            _id: user?._id,
            id: user?.id,
            username: user?.username
        });
        console.log('🔍 Query being used:', { userId: userId });
        const orders = await this.orderService.getOrdersByUserId(userId);
        res.status(200).json({
            success: true,
            data: orders,
            count: orders.length,
            timestamp: new Date().toISOString()
        });
    });
    getAllOrders = (0, errorHandler_1.asyncHandler)(async (req, res) => {
        const { status, limit, offset, startDate, endDate } = req.query;
        const filters = {
            status: status,
            limit: limit ? parseInt(limit, 10) : 50,
            offset: offset ? parseInt(offset, 10) : 0,
            startDate: startDate ? new Date(startDate) : undefined,
            endDate: endDate ? new Date(endDate) : undefined
        };
        const { orders, total } = await this.orderService.getAllOrders(filters);
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
    });
    getOrderById = (0, errorHandler_1.asyncHandler)(async (req, res) => {
        const { id } = req.params;
        const userId = req.user?.id || req.user?._id;
        if (!id) {
            throw (0, errorHandler_1.createValidationError)('Order ID is required');
        }
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }
        const order = await this.orderService.getOrderById(id, userId);
        if (!order) {
            throw (0, errorHandler_1.createNotFoundError)('Order');
        }
        res.status(200).json({
            success: true,
            data: order,
            timestamp: new Date().toISOString()
        });
    });
    updateOrderStatus = (0, errorHandler_1.asyncHandler)(async (req, res) => {
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
        const updatedOrder = await this.orderService.updateOrderStatus(id, {
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
    });
    getOrderStatistics = (0, errorHandler_1.asyncHandler)(async (req, res) => {
        const { period } = req.query;
        const stats = await this.orderService.getOrderStatistics(period);
        res.status(200).json({
            success: true,
            data: stats,
            timestamp: new Date().toISOString()
        });
    });
    getRecentOrders = (0, errorHandler_1.asyncHandler)(async (req, res) => {
        const limit = parseInt(req.query.limit) || 10;
        const recentOrders = await this.orderService.getRecentOrders(limit);
        res.status(200).json({
            success: true,
            data: recentOrders,
            count: recentOrders.length,
            timestamp: new Date().toISOString()
        });
    });
    deleteOrder = (0, errorHandler_1.asyncHandler)(async (req, res) => {
        const { id } = req.params;
        if (!id) {
            throw (0, errorHandler_1.createValidationError)('Order ID is required');
        }
        const deleted = await this.orderService.deleteOrder(id);
        if (!deleted) {
            throw (0, errorHandler_1.createNotFoundError)('Order');
        }
        res.status(200).json({
            success: true,
            message: 'Order deleted successfully',
            timestamp: new Date().toISOString()
        });
    });
    searchOrders = (0, errorHandler_1.asyncHandler)(async (req, res) => {
        const { q } = req.query;
        if (!q || typeof q !== 'string') {
            throw (0, errorHandler_1.createValidationError)('Search query is required');
        }
        const orders = await this.orderService.searchOrders(q);
        res.status(200).json({
            success: true,
            data: orders,
            count: orders.length,
            query: q,
            timestamp: new Date().toISOString()
        });
    });
    getRevenueStats = (0, errorHandler_1.asyncHandler)(async (req, res) => {
        const stats = await this.orderService.getRevenueStats();
        res.status(200).json({
            success: true,
            data: stats
        });
    });
    getKitchenReport = (0, errorHandler_1.asyncHandler)(async (req, res) => {
        try {
            const OrderModel = require('../models/Order').default;
            const allOrders = await OrderModel.find({}, 'status items').lean();
            console.log('🔍 TOTAL ORDERS FOUND:', allOrders.length);
            console.log('🔍 SAMPLE STATUSES:', allOrders.map((o) => o.status));
            console.log('🔍 UNIQUE STATUSES:', [...new Set(allOrders.map((o) => o.status))]);
            console.log('🔍 ORDERS WITH ITEMS:', allOrders.filter((o) => o.items && o.items.length > 0).length);
            if (allOrders.length > 0) {
                console.log('🔍 SAMPLE ORDER:', JSON.stringify(allOrders[0], null, 2));
                if (allOrders[0].items && allOrders[0].items.length > 0) {
                    console.log('🔍 SAMPLE ORDER ITEM:', JSON.stringify(allOrders[0].items[0], null, 2));
                    console.log('🔍 SAMPLE ITEM PRODUCTID:', allOrders[0].items[0].productId);
                    console.log('🔍 SAMPLE ITEM PRODUCTID TYPE:', typeof allOrders[0].items[0].productId);
                }
            }
            const report = await this.orderService.getKitchenReport();
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
            res.status(500).json({
                success: false,
                message: error.message || 'Failed to generate kitchen report',
                error: process.env.NODE_ENV === 'development' ? error.stack : undefined
            });
        }
    });
    getDeliveryReport = (0, errorHandler_1.asyncHandler)(async (req, res) => {
        try {
            const report = await this.orderService.getDeliveryReport();
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
    });
}
exports.OrderController = OrderController;
//# sourceMappingURL=order.controller.js.map