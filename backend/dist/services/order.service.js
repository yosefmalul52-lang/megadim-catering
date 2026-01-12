"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderService = void 0;
const Order_1 = __importDefault(require("../models/Order"));
const email_service_1 = require("./email.service");
class OrderService {
    UNIT_ONLY_CATEGORIES = ['דגים', 'מנות עיקריות', 'Fish', 'Main Courses'];
    emailService;
    constructor() {
        this.emailService = new email_service_1.EmailService();
    }
    async submitOrder(orderData, userId = null) {
        try {
            console.log('📝 OrderService: Creating order for user:', userId || 'Guest');
            console.log('📝 OrderService: Order data:', JSON.stringify(orderData, null, 2));
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
                    category: category
                };
            });
            const totalPrice = orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            const order = new Order_1.default({
                userId: userId || null,
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
            const savedOrder = await order.save();
            console.log('✅ OrderService: Order saved successfully:', savedOrder._id);
            console.log('✅ OrderService: Saved order userId:', savedOrder.userId);
            try {
                await this.emailService.sendOrderEmail(savedOrder);
                console.log('✅ OrderService: Order email sent successfully');
            }
            catch (emailError) {
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
    }
    async getOrdersByUserId(userId) {
        try {
            const orders = await Order_1.default.find({ userId: userId })
                .sort({ createdAt: -1 })
                .lean();
            return orders;
        }
        catch (error) {
            console.error('Error fetching user orders:', error);
            throw error;
        }
    }
    async getAllOrders(filters) {
        try {
            const query = {};
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
            const total = await Order_1.default.countDocuments(query);
            const orders = await Order_1.default.find(query)
                .sort({ createdAt: -1 })
                .limit(filters.limit || 50)
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
    }
    async getOrderById(orderId, userId) {
        try {
            const order = await Order_1.default.findOne({
                _id: orderId,
                userId: userId
            }).lean();
            return order;
        }
        catch (error) {
            console.error('Error fetching order by ID:', error);
            throw error;
        }
    }
    async updateOrderStatus(orderId, updates) {
        try {
            const updateData = {};
            if (updates.status)
                updateData.status = updates.status;
            if (updates.deliveryDate)
                updateData.deliveryDate = updates.deliveryDate;
            if (updates.notes !== undefined)
                updateData['customerDetails.notes'] = updates.notes;
            const order = await Order_1.default.findByIdAndUpdate(orderId, { $set: updateData }, { new: true }).lean();
            return order;
        }
        catch (error) {
            console.error('Error updating order status:', error);
            throw error;
        }
    }
    async getOrderStatistics(period = 'month') {
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
            const totalOrders = await Order_1.default.countDocuments({
                createdAt: { $gte: startDate }
            });
            const totalRevenue = await Order_1.default.aggregate([
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
            const ordersByStatus = await Order_1.default.aggregate([
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
                totalRevenue: totalRevenue[0]?.total || 0,
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
    }
    async getRecentOrders(limit = 10) {
        try {
            const orders = await Order_1.default.find()
                .sort({ createdAt: -1 })
                .limit(limit)
                .lean();
            return orders;
        }
        catch (error) {
            console.error('Error fetching recent orders:', error);
            throw error;
        }
    }
    async deleteOrder(orderId) {
        try {
            const result = await Order_1.default.findByIdAndDelete(orderId);
            return !!result;
        }
        catch (error) {
            console.error('Error deleting order:', error);
            throw error;
        }
    }
    async searchOrders(query) {
        try {
            const orders = await Order_1.default.find({
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
    }
    async getRevenueStats() {
        try {
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            const revenueStats = await Order_1.default.aggregate([
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
    }
    async getKitchenReport() {
        try {
            const activeStatuses = ['new', 'in-progress', 'ready', 'accepted', 'processing', 'בטיפול', 'חדש', 'New'];
            console.log('🔍 OrderService: Starting kitchen report with aggregation pipeline');
            console.log('🔍 OrderService: Filtering by statuses:', activeStatuses);
            const aggregationResult = await Order_1.default.aggregate([
                {
                    $match: {
                        status: { $in: activeStatuses }
                    }
                },
                {
                    $unwind: '$items'
                },
                {
                    $lookup: {
                        from: 'menuitems',
                        let: { productIdString: { $toString: { $ifNull: ['$items.productId', ''] } } },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
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
                {
                    $unwind: {
                        path: '$productDetails',
                        preserveNullAndEmptyArrays: true
                    }
                },
                {
                    $project: {
                        productName: {
                            $ifNull: ['$items.name', 'Unknown Product']
                        },
                        productId: '$items.productId',
                        quantity: { $ifNull: ['$items.quantity', 0] },
                        category: {
                            $ifNull: [
                                '$productDetails.category',
                                { $ifNull: ['$items.category', 'תוספות'] }
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
                {
                    $match: {
                        quantity: { $gt: 0 }
                    }
                },
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
                {
                    $sort: {
                        category: 1,
                        productName: 1
                    }
                }
            ]);
            console.log('🔍 OrderService: Aggregation result count:', aggregationResult.length);
            console.log('🔍 OrderService: Sample aggregation result:', JSON.stringify(aggregationResult.slice(0, 3), null, 2));
            const itemsWithoutProduct = aggregationResult.filter((item) => !item.hasProductDetails);
            if (itemsWithoutProduct.length > 0) {
                console.warn('⚠️ OrderService: Items without product details:', itemsWithoutProduct.length);
                console.warn('⚠️ OrderService: Sample items without product:', JSON.stringify(itemsWithoutProduct.slice(0, 2), null, 2));
            }
            if (aggregationResult.length === 0) {
                console.warn('⚠️ OrderService: No items found in active orders');
                return [];
            }
            const kitchenReportItems = [];
            for (const item of aggregationResult) {
                try {
                    if (!item || !item.productName) {
                        console.warn('⚠️ Skipping invalid item:', JSON.stringify(item, null, 2));
                        continue;
                    }
                    const productName = item.productName || 'Unknown Product';
                    const category = item.category || 'תוספות';
                    const totalPackages = item.totalPackages || 0;
                    if (isNaN(totalPackages) || totalPackages <= 0) {
                        console.warn('⚠️ Skipping item with invalid quantity:', productName, 'quantity:', totalPackages);
                        continue;
                    }
                    const isUnitOnlyCategory = this.UNIT_ONLY_CATEGORIES.some(cat => category.toLowerCase().includes(cat.toLowerCase()) ||
                        cat.toLowerCase().includes(category.toLowerCase()));
                    const weightInfo = isUnitOnlyCategory
                        ? { value: 0, unit: null }
                        : this.extractWeightFromName(productName);
                    const totalWeightRaw = isUnitOnlyCategory ? 0 : (weightInfo.value * totalPackages);
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
                }
            }
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
    }
    detectCategoryFromName(productName) {
        const name = productName.toLowerCase();
        if (name.includes('סלט') || name.includes('salad')) {
            return 'סלטים';
        }
        if (name.includes('דג') || name.includes('fish') || name.includes('salmon') || name.includes('tuna')) {
            return 'דגים';
        }
        if (name.includes('עיקרי') || name.includes('main') || name.includes('בשר') || name.includes('meat')) {
            return 'מנות עיקריות';
        }
        if (name.includes('קינוח') || name.includes('dessert') || name.includes('עוגה') || name.includes('cake')) {
            return 'קינוחים';
        }
        if (/\d+\s*(g|ml|גרם|מ"ל|ק"ג|ליטר)/i.test(name)) {
            return 'סלטים';
        }
        return 'תוספות';
    }
    extractWeightFromName(productName) {
        const weightRegex = /(\d+(?:\.\d+)?)\s*(g|ml|גרם|מ"ל|ק"ג|ליטר|kg|l|קילו|ליטר)/i;
        const match = productName.match(weightRegex);
        if (!match) {
            return { value: 0, unit: null };
        }
        const value = parseFloat(match[1]);
        const unitStr = match[2].toLowerCase();
        let normalizedValue = value;
        let unit = null;
        if (unitStr.includes('g') || unitStr.includes('גרם')) {
            unit = 'g';
            normalizedValue = value;
        }
        else if (unitStr.includes('kg') || unitStr.includes('ק"ג') || unitStr.includes('קילו')) {
            unit = 'kg';
            normalizedValue = value * 1000;
        }
        else if (unitStr.includes('ml') || unitStr.includes('מ"ל')) {
            unit = 'ml';
            normalizedValue = value;
        }
        else if (unitStr.includes('l') || unitStr.includes('ליטר')) {
            unit = 'l';
            normalizedValue = value * 1000;
        }
        return { value: normalizedValue, unit };
    }
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
    async getDeliveryReport() {
        try {
            console.log('🚚 Fetching Delivery Report...');
            const query = {
                status: { $ne: 'cancelled' }
            };
            console.log('🚚 OrderService: Starting delivery report generation');
            console.log('🚚 OrderService: Query filter:', JSON.stringify(query));
            const activeOrders = await Order_1.default.find(query).lean();
            console.log('Found orders:', activeOrders.length);
            if (activeOrders.length === 0) {
                console.log('⚠️ No orders found (excluding cancelled)');
                return [];
            }
            if (activeOrders.length > 0) {
                console.log('🚚 Sample order structure:', JSON.stringify(activeOrders[0], null, 2));
            }
            const cityMap = {};
            for (const order of activeOrders) {
                const customerDetails = order.customerDetails || {};
                const deliveryDetails = customerDetails.deliveryDetails || {};
                console.log('🚚 Processing order:', order._id);
                console.log('🚚 Order customerDetails:', JSON.stringify(customerDetails, null, 2));
                console.log('🚚 Order deliveryDetails:', JSON.stringify(deliveryDetails, null, 2));
                let city = deliveryDetails?.city ||
                    customerDetails.city ||
                    customerDetails.deliveryCity ||
                    null;
                if (!city && customerDetails.address) {
                    const addressParts = customerDetails.address.split(',').map((p) => p.trim());
                    city = addressParts[addressParts.length - 1] || null;
                    console.log('🚚 Extracted city from address:', city);
                }
                if (city) {
                    city = city.trim();
                }
                else {
                    city = 'כללי / איסוף עצמי';
                    console.log('🚚 No city found, using default:', city);
                }
                const orderSummary = {
                    _id: order._id.toString(),
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
                    isPaid: customerDetails.isPaid || deliveryDetails.isPaid || false
                };
                if (!cityMap[city]) {
                    cityMap[city] = [];
                }
                cityMap[city].push(orderSummary);
            }
            const report = Object.keys(cityMap).map(city => ({
                city: city,
                orders: cityMap[city]
            }));
            report.sort((a, b) => a.city.localeCompare(b.city));
            console.log('🚚 OrderService: Delivery report generated:', report.length, 'cities');
            console.log('🚚 OrderService: Sample report:', JSON.stringify(report.slice(0, 2), null, 2));
            return report;
        }
        catch (error) {
            console.error('❌ Error generating delivery report:', error);
            console.error('❌ Error stack:', error.stack);
            throw new Error(`Failed to generate delivery report: ${error.message}`);
        }
    }
}
exports.OrderService = OrderService;
//# sourceMappingURL=order.service.js.map