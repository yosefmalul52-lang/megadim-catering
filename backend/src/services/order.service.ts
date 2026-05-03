import Order, { IOrder } from '../models/Order';
import MenuItem from '../models/menuItem';
import mongoose from 'mongoose';
import { CreateOrderRequest, CreateCheckoutOrderRequest, OrderResponse } from '../models/order.model';
import { sanitizeMarketingData } from '../utils/webhook.util';
import { emailService } from './email.service';
import { upsertCustomerFromOrder } from './customer.service';

export class OrderService {
  // Categories that should only show units, not calculated weight
  private readonly UNIT_ONLY_CATEGORIES = ['דגים', 'מנות עיקריות', 'Fish', 'Main Courses'];

  private generateOrderNumber(): string {
    return 'MG-' + Math.floor(100000 + Math.random() * 900000).toString();
  }

  // Submit a new order
  async submitOrder(orderData: CreateOrderRequest, userId: string | null = null): Promise<OrderResponse> {
    try {
      console.log('📝 OrderService: Creating order for user:', userId || 'Guest');
      console.log('📝 OrderService: Order data:', JSON.stringify(orderData, null, 2));

      // Map items to include category and imageUrl if missing
      const orderItems = orderData.items.map(item => {
        let category = (item as any).category;
        if (!category || category.trim() === '') {
          category = this.detectCategoryFromName(item.name);
        }
        return {
          productId: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          category,
          imageUrl: (item as any).imageUrl || (item as any).image || undefined
        };
      });

      // Calculate total price
      const totalPrice = orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

      // Create order document
      const order = new Order({
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
      const savedOrder = await order.save();
      console.log('✅ OrderService: Order saved successfully:', savedOrder._id);
      console.log('✅ OrderService: Saved order userId:', savedOrder.userId);

      // Sync Single Source of Truth customer profile (fail-open).
      try {
        await upsertCustomerFromOrder(savedOrder as any);
      } catch (err: any) {
        console.error('⚠️ Customer upsert failed after order save');
        console.error('Upsert Error:', err);
      }

      // Send order email to owner immediately after save
      try {
        await emailService.sendOrderEmail(savedOrder);
        console.log('✅ OrderService: Order email sent successfully');
      } catch (emailError: any) {
        // Log email error but don't fail the order creation
        console.error('⚠️ OrderService: Failed to send order email (order still saved):', emailError);
      }

      return {
        success: true,
        orderId: savedOrder._id.toString(),
        message: 'Order submitted successfully',
        totalAmount: totalPrice
      };
    } catch (error: any) {
      console.error('❌ OrderService: Error submitting order:', error);
      if (error.name === 'ValidationError') {
        console.error('❌ Validation errors:', error.errors);
      }
      throw error;
    }
  }

  /** Create order from checkout payload (POST /api/orders). Saves to DB, sends admin email, returns saved order. */
  async createOrderFromCheckout(payload: CreateCheckoutOrderRequest): Promise<IOrder> {
    const addressStr =
      typeof payload.address === 'string'
        ? payload.address
        : payload.address && typeof payload.address === 'object'
          ? [payload.address.city, payload.address.street, payload.address.apartment].filter(Boolean).join(', ')
          : '';

    const orderItems = payload.items.map(item => ({
      productId: item.id,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      category: (item as any).category || this.detectCategoryFromName(item.name),
      imageUrl: (item as any).imageUrl || (item as any).image || undefined
    }));

    const isManual = payload.manualOrder === true;
    const status = isManual ? 'processing' : 'pending';
    const customerDetails: Record<string, unknown> = {
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
    const marketingData = sanitizeMarketingData((payload as { marketingData?: unknown }).marketingData);

    const order = new Order({
      userId: (payload as any).userId ?? null,
      orderNumber: this.generateOrderNumber(),
      customerDetails,
      items: orderItems,
      totalPrice: payload.totalAmount,
      status,
      ...(marketingData ? { marketingData } : {})
    });

    const savedOrder = await order.save();
    console.log('✅ OrderService: Checkout order saved:', savedOrder._id);
    try {
      await upsertCustomerFromOrder(savedOrder as any);
    } catch (err: any) {
      console.error('⚠️ Customer upsert failed for checkout order');
      console.error('Upsert Error:', err);
    }
    // Admin email is sent from order.controller createOrder (nodemailer) so failures don't affect response
    return savedOrder;
  }

  // Get orders by user ID
  async getOrdersByUserId(userId: string): Promise<IOrder[]> {
    try {
      const orders = await Order.find({ userId: userId })
        .sort({ createdAt: -1 })
        .lean();
      
      return orders as IOrder[];
    } catch (error: any) {
      console.error('Error fetching user orders:', error);
      throw error;
    }
  }

  // Get all orders with filters (Admin). archive=true => isDeleted or cancelled; otherwise active only (isDeleted false).
  async getAllOrders(filters: {
    status?: string;
    limit?: number;
    offset?: number;
    startDate?: Date;
    endDate?: Date;
    archive?: boolean;
  }): Promise<{ orders: IOrder[]; total: number }> {
    try {
      const query: any = {};

      if (filters.archive === true) {
        query.$or = [{ isDeleted: true }, { status: 'cancelled' }];
      } else {
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

      const total = await Order.countDocuments(query);
      const orders = await Order.find(query)
        .sort({ 'customerDetails.eventDate': 1, createdAt: -1 })
        .limit(filters.limit || 100)
        .skip(filters.offset || 0)
        .lean();

      return {
        orders: orders as IOrder[],
        total
      };
    } catch (error: any) {
      console.error('Error fetching all orders:', error);
      throw error;
    }
  }

  // Get order by ID (with user verification). Enriches items with imageUrl from menu when missing.
  async getOrderById(orderId: string, userId: string): Promise<IOrder | null> {
    try {
      const order = await Order.findOne({
        _id: orderId,
        userId: userId
      }).lean();

      if (!order || !order.items?.length) return order as IOrder | null;

      await this.enrichOrderItemsImageUrlPublic(order.items);

      return order as IOrder | null;
    } catch (error: any) {
      console.error('Error fetching order by ID:', error);
      throw error;
    }
  }

  /** Get order by ID without user filter (admin only). */
  async getOrderByIdForAdmin(orderId: string): Promise<IOrder | null> {
    try {
      const order = await Order.findOne({ _id: orderId }).lean();
      if (!order || !order.items?.length) return order as IOrder | null;
      await this.enrichOrderItemsImageUrlPublic(order.items);
      return order as IOrder | null;
    } catch (error: any) {
      console.error('Error fetching order by ID (admin):', error);
      throw error;
    }
  }

  async getOrderByIdForDriver(orderId: string, driverUserId: string): Promise<IOrder | null> {
    try {
      const order = await Order.findOne({
        _id: orderId,
        assignedDriverId: driverUserId,
        isDeleted: { $ne: true }
      }).lean();
      if (!order || !order.items?.length) return order as IOrder | null;
      await this.enrichOrderItemsImageUrlPublic(order.items);
      return order as IOrder | null;
    } catch (error: any) {
      console.error('Error fetching order by ID (driver):', error);
      throw error;
    }
  }

  /** Fills imageUrl on each item from MenuItem when missing. Accepts productId as string or ObjectId. */
  async enrichOrderItemsImageUrlPublic(items: any[]): Promise<void> {
    if (!items?.length) return;
    for (const item of items) {
      if (item.imageUrl && String(item.imageUrl).trim()) continue;
      const productId = item.productId;
      if (!productId) continue;
      try {
        let product = await MenuItem.findById(productId).select('imageUrl').lean();
        if (!product?.imageUrl && typeof productId === 'string') {
          product = await MenuItem.findOne({ _id: productId }).select('imageUrl').lean();
        }
        if (product?.imageUrl) (item as any).imageUrl = String(product.imageUrl).trim();
      } catch {
        // ignore single lookup failure
      }
    }
  }

  // Update order status
  async updateOrderStatus(orderId: string, updates: {
    status?: string;
    deliveryDate?: Date;
    notes?: string;
  }): Promise<IOrder | null> {
    try {
      const updateData: any = {};
      if (updates.status) updateData.status = updates.status;
      if (updates.deliveryDate) updateData.deliveryDate = updates.deliveryDate;
      if (updates.notes !== undefined) updateData['customerDetails.notes'] = updates.notes;

      const order = await Order.findByIdAndUpdate(
        orderId,
        { $set: updateData },
        { new: true }
      ).lean();

      return order as IOrder | null;
    } catch (error: any) {
      console.error('Error updating order status:', error);
      throw error;
    }
  }

  async updateOrderStatusForDriver(
    orderId: string,
    driverUserId: string,
    status: string
  ): Promise<IOrder | null> {
    const allowed = new Set(['out_for_delivery', 'delivered', 'delivery_failed']);
    if (!allowed.has(String(status || '').trim().toLowerCase())) {
      throw new Error('Driver status is not allowed');
    }
    const updated = await Order.findOneAndUpdate(
      {
        _id: orderId,
        assignedDriverId: driverUserId,
        isDeleted: { $ne: true }
      },
      { $set: { status } },
      { new: true }
    ).lean();
    return updated as IOrder | null;
  }

  async getDriverAssignedOrders(
    driverUserId: string,
    opts?: { limit?: number; fromDate?: string; toDate?: string }
  ): Promise<IOrder[]> {
    const query: Record<string, any> = {
      assignedDriverId: driverUserId,
      isDeleted: { $ne: true }
    };
    if (opts?.fromDate || opts?.toDate) {
      query['customerDetails.eventDate'] = {};
      if (opts.fromDate) query['customerDetails.eventDate'].$gte = opts.fromDate;
      if (opts.toDate) query['customerDetails.eventDate'].$lte = opts.toDate;
    }
    const rows = await Order.find(query)
      .sort({ 'customerDetails.eventDate': 1, createdAt: -1 })
      .limit(Math.max(1, Math.min(Number(opts?.limit || 300), 1000)))
      .lean();
    return rows as IOrder[];
  }

  async assignOrderToDriver(
    orderId: string,
    driver: { _id: string; fullName?: string; username?: string } | null
  ): Promise<IOrder | null> {
    const set: Record<string, any> = {};
    if (!driver) {
      set.assignedDriverId = null;
      set.assignedDriverName = '';
      set.assignedAt = null;
    } else {
      set.assignedDriverId = driver._id;
      set.assignedDriverName = String(driver.fullName || driver.username || '').trim();
      set.assignedAt = new Date();
    }
    const updated = await Order.findByIdAndUpdate(orderId, { $set: set }, { new: true }).lean();
    return updated as IOrder | null;
  }

  /**
   * Update order items securely (Admin):
   * - Uses MenuItem as the single source of truth for price/name/category.
   * - Recalculates totalPrice on the server from authenticated product prices.
   */
  async updateOrderItems(orderId: string, newItems: any[]): Promise<IOrder | null> {
    if (!Array.isArray(newItems) || newItems.length === 0) {
      throw new Error('items array is required and must not be empty');
    }

    const normalizedItems = await Promise.all(
      newItems.map(async (rawItem: any, index: number) => {
        const item = rawItem || {};
        const productId = String(item.productId || item.id || '').trim();
        const productName = String(item.name || '').trim();
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
        let product: any = null;

        const escapedRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const normalizedBaseName = productName
          ? productName
              // Remove variant suffix in parentheses: "סלט חומוס (500 מ"ל - 500)" -> "סלט חומוס"
              .replace(/\s*\([^)]*\)\s*$/, '')
              // Remove variant suffix in dash format: "סלט חומוס - קטן" -> "סלט חומוס"
              .replace(/\s*-\s*[^-]+$/, '')
              .trim()
          : '';

        const findByNameFallback = async () => {
          if (!productName && !normalizedBaseName) return null;
          const nameCandidates = [productName, normalizedBaseName].filter(Boolean);
          // Try exact match first (fast + deterministic)
          for (const candidate of nameCandidates) {
            const exact = await MenuItem.findOne({ name: candidate }).lean();
            if (exact) return exact;
          }
          // Then prefix match on normalized base name (handles extra suffixes/formatting)
          if (normalizedBaseName) {
            return MenuItem.findOne({
              name: { $regex: `^${escapedRegex(normalizedBaseName)}(?:\\s|\\(|$)`, $options: 'i' }
            }).lean();
          }
          return null;
        };

        if (!mongoose.Types.ObjectId.isValid(lookupProductId)) {
          const objectIdPrefix = lookupProductId.match(/^[a-fA-F0-9]{24}/)?.[0];
          if (objectIdPrefix && mongoose.Types.ObjectId.isValid(objectIdPrefix)) {
            lookupProductId = objectIdPrefix;
            product = await MenuItem.findById(lookupProductId).lean();
          } else {
            // Legacy compatibility: non-ObjectId ids (e.g. "6")
            product = await findByNameFallback();
            if (!product) {
              throw new Error(`Invalid product id format at items[${index}] (${productId})`);
            }
          }
        } else {
          // Security: fetch authentic product data (especially price) from DB.
          product = await MenuItem.findById(lookupProductId).lean();
        }

        // If id looked valid but no DB row found (deleted/legacy mismatch), fallback by name.
        if (!product) {
          product = await findByNameFallback();
        }

        if (!product) {
          throw new Error(
            `Product not found for items[${index}] (id=${lookupProductId}${productName ? `, name=${productName}` : ''})`
          );
        }

        const requestedVariantLabel = String(
          item?.selectedOption?.label || item?.variant || item?.size || ''
        ).trim();
        const requestedVariantAmount = String(item?.selectedOption?.amount || '').trim();

        let selectedOptionToSave:
          | { label: string; amount?: string; price: number }
          | undefined;
        let authenticPrice = Number((product as any).price);

        if (requestedVariantLabel) {
          const pricingOptions = Array.isArray((product as any).pricingOptions)
            ? (product as any).pricingOptions
            : [];
          const pricingVariants = Array.isArray((product as any).pricingVariants)
            ? (product as any).pricingVariants
            : [];

          const normalizedRequestedLabel = requestedVariantLabel.toLowerCase();
          const normalizedRequestedAmount = requestedVariantAmount.toLowerCase();

          const matchedOption = pricingOptions.find((opt: any) => {
            const label = String(opt?.label || '').trim().toLowerCase();
            const amount = String(opt?.amount || '').trim().toLowerCase();
            if (!label) return false;
            const byLabel = label === normalizedRequestedLabel;
            const byAmount = normalizedRequestedAmount ? amount === normalizedRequestedAmount : false;
            return byLabel || byAmount;
          });

          if (matchedOption) {
            authenticPrice = Number(matchedOption.price);
            selectedOptionToSave = {
              label: String(matchedOption.label || requestedVariantLabel).trim(),
              amount: String(matchedOption.amount || requestedVariantAmount).trim() || undefined,
              price: authenticPrice
            };
          } else {
            const matchedVariant = pricingVariants.find((variant: any) => {
              const label = String(variant?.label || '').trim().toLowerCase();
              const size = String(variant?.size || '').trim().toLowerCase();
              if (!label && !size) return false;
              return label === normalizedRequestedLabel || size === normalizedRequestedLabel;
            });

            if (matchedVariant) {
              authenticPrice = Number(matchedVariant.price);
              selectedOptionToSave = {
                label: String(
                  matchedVariant.label || matchedVariant.size || requestedVariantLabel
                ).trim(),
                amount: String(matchedVariant.size || requestedVariantAmount).trim() || undefined,
                price: authenticPrice
              };
            } else {
              throw new Error(
                `Variant "${requestedVariantLabel}" not found in DB for items[${index}] (product=${String(
                  (product as any).name || lookupProductId
                )})`
              );
            }
          }
        } else if (item?.selectedOption?.label) {
          // Preserve legacy payload shape if it already includes selectedOption details.
          selectedOptionToSave = {
            label: String(item.selectedOption.label).trim(),
            amount: String(item.selectedOption.amount || '').trim() || undefined,
            price: Number(item.selectedOption.price ?? authenticPrice)
          };
        }

        if (!Number.isFinite(authenticPrice) || authenticPrice < 0) {
          throw new Error(`Invalid product price in DB for product ${lookupProductId}`);
        }

        const canonicalProductName = String((product as any).name || item.name || '').trim();
        const canonicalItemName = selectedOptionToSave?.label
          ? `${canonicalProductName} - ${selectedOptionToSave.label}`
          : canonicalProductName;

        return {
          productId: String((product as any)._id || lookupProductId),
          name: canonicalItemName,
          price: authenticPrice,
          quantity,
          category: (product as any).category,
          selectedOption: selectedOptionToSave,
          imageUrl: (product as any).imageUrl,
          description: (product as any).description
        };
      })
    );

    const recalculatedTotalPrice = normalizedItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    const updated = await Order.findByIdAndUpdate(
      orderId,
      {
        $set: {
          items: normalizedItems,
          totalPrice: Math.round(recalculatedTotalPrice * 100) / 100
        }
      },
      { new: true }
    ).lean();

    return updated as IOrder | null;
  }

  /** Update order event/delivery date (Admin). Sets customerDetails.eventDate (stored as YYYY-MM-DD). */
  async updateOrderEventDate(orderId: string, eventDate: string | Date): Promise<IOrder | null> {
    try {
      const dateValue = typeof eventDate === 'string' ? new Date(eventDate + 'T12:00:00.000Z') : eventDate;
      if (isNaN(dateValue.getTime())) {
        throw new Error('Invalid date');
      }
      const dateStr = dateValue.toISOString().slice(0, 10);

      const updateResult = await Order.updateOne(
        { _id: orderId },
        { $set: { 'customerDetails.eventDate': dateStr } }
      );
      if (updateResult.matchedCount === 0) return null;

      const updated = await Order.findById(orderId).lean();
      return updated as IOrder | null;
    } catch (error: any) {
      console.error('Error updating order event date:', error);
      throw error;
    }
  }

  /** Dashboard stats: pending count, events today count, monthly revenue. */
  async getDashboardStats(): Promise<{ pendingCount: number; eventsTodayCount: number; monthlyRevenue: number }> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    const todayStr = now.toISOString().slice(0, 10); // YYYY-MM-DD

    const activeQuery = { isDeleted: { $ne: true } };
    const [pendingCount, eventsTodayCount, monthlyRevenueResult] = await Promise.all([
      Order.countDocuments({ ...activeQuery, status: { $in: ['pending', 'new'] } }),
      Order.countDocuments({ ...activeQuery, 'customerDetails.eventDate': todayStr }),
      Order.aggregate([
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

    const monthlyRevenue = monthlyRevenueResult[0]?.total ?? 0;
    return { pendingCount, eventsTodayCount, monthlyRevenue };
  }

  // Get order statistics
  async getOrderStatistics(period: string = 'month'): Promise<any> {
    try {
      const now = new Date();
      let startDate: Date;

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

      const totalOrders = await Order.countDocuments({
        createdAt: { $gte: startDate }
      });

      const totalRevenue = await Order.aggregate([
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

      const ordersByStatus = await Order.aggregate([
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
        ordersByStatus: ordersByStatus.reduce((acc: any, item: any) => {
          acc[item._id] = item.count;
          return acc;
        }, {})
      };
    } catch (error: any) {
      console.error('Error fetching order statistics:', error);
      throw error;
    }
  }

  // Get recent orders
  async getRecentOrders(limit: number = 10): Promise<IOrder[]> {
    try {
      const orders = await Order.find()
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();

      return orders as IOrder[];
    } catch (error: any) {
      console.error('Error fetching recent orders:', error);
      throw error;
    }
  }

  // Delete order
  // Soft delete: set isDeleted = true
  async deleteOrder(orderId: string): Promise<IOrder | null> {
    try {
      const order = await Order.findByIdAndUpdate(
        orderId,
        { $set: { isDeleted: true } },
        { new: true }
      ).lean();
      return order as IOrder | null;
    } catch (error: any) {
      console.error('Error deleting order:', error);
      throw error;
    }
  }

  // Restore order: set isDeleted = false and status = 'pending'
  async restoreOrder(orderId: string): Promise<IOrder | null> {
    try {
      const order = await Order.findByIdAndUpdate(
        orderId,
        { $set: { isDeleted: false, status: 'pending' } },
        { new: true }
      ).lean();
      return order as IOrder | null;
    } catch (error: any) {
      console.error('Error restoring order:', error);
      throw error;
    }
  }

  // Permanent delete: remove document from DB (irreversible)
  async permanentDeleteOrder(orderId: string): Promise<boolean> {
    try {
      const result = await Order.findByIdAndDelete(orderId);
      return result != null;
    } catch (error: any) {
      console.error('Error permanently deleting order:', error);
      throw error;
    }
  }

  async bulkApplyAction(input: {
    orderIds: string[];
    action: 'status' | 'archive' | 'restore' | 'permanent_delete';
    status?: string;
  }): Promise<{ matchedCount: number; modifiedCount: number; deletedCount: number }> {
    const uniqueIds = Array.from(
      new Set(
        (input.orderIds || [])
          .map((id) => String(id || '').trim())
          .filter((id) => mongoose.Types.ObjectId.isValid(id))
      )
    );

    if (!uniqueIds.length) {
      return { matchedCount: 0, modifiedCount: 0, deletedCount: 0 };
    }

    const objectIds = uniqueIds.map((id) => new mongoose.Types.ObjectId(id));
    const baseFilter = { _id: { $in: objectIds } };

    switch (input.action) {
      case 'status': {
        const status = String(input.status || '').trim();
        const validStatuses = new Set([
          'pending',
          'processing',
          'ready',
          'cancelled',
          'new',
          'in-progress',
          'out_for_delivery',
          'delivery_failed',
          'delivered'
        ]);
        if (!validStatuses.has(status)) {
          throw new Error('Invalid status value');
        }
        const result = await Order.updateMany(baseFilter, { $set: { status } });
        return {
          matchedCount: Number(result.matchedCount || 0),
          modifiedCount: Number(result.modifiedCount || 0),
          deletedCount: 0
        };
      }
      case 'archive': {
        const result = await Order.updateMany(baseFilter, { $set: { isDeleted: true } });
        return {
          matchedCount: Number(result.matchedCount || 0),
          modifiedCount: Number(result.modifiedCount || 0),
          deletedCount: 0
        };
      }
      case 'restore': {
        const result = await Order.updateMany(baseFilter, {
          $set: { isDeleted: false, status: 'pending' }
        });
        return {
          matchedCount: Number(result.matchedCount || 0),
          modifiedCount: Number(result.modifiedCount || 0),
          deletedCount: 0
        };
      }
      case 'permanent_delete': {
        const result = await Order.deleteMany(baseFilter);
        return {
          matchedCount: Number(result.deletedCount || 0),
          modifiedCount: 0,
          deletedCount: Number(result.deletedCount || 0)
        };
      }
      default:
        throw new Error('Invalid bulk action');
    }
  }

  // Search orders
  async searchOrders(query: string): Promise<IOrder[]> {
    try {
      const orders = await Order.find({
        $or: [
          { 'customerDetails.fullName': { $regex: query, $options: 'i' } },
          { 'customerDetails.phone': { $regex: query, $options: 'i' } },
          { 'customerDetails.email': { $regex: query, $options: 'i' } }
        ]
      })
        .sort({ createdAt: -1 })
        .lean();

      return orders as IOrder[];
    } catch (error: any) {
      console.error('Error searching orders:', error);
      throw error;
    }
  }

  // Get revenue statistics for chart
  async getRevenueStats(): Promise<{ date: string; total: number }[]> {
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const revenueStats = await Order.aggregate([
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
    } catch (error: any) {
      console.error('Error fetching revenue stats:', error);
      throw error;
    }
  }

  /**
   * Aggregate revenue by marketing source (utm_source).
   * Missing/empty sources are bucketed as "direct".
   */
  async getRevenueBySource(filters?: {
    startDate?: Date;
    endDate?: Date;
    includeArchived?: boolean;
  }): Promise<Array<{ source: string; totalRevenue: number; ordersCount: number }>> {
    try {
      const match: Record<string, any> = {
        status: { $ne: 'cancelled' }
      };
      if (!filters?.includeArchived) {
        match.isDeleted = { $ne: true };
      }
      if (filters?.startDate || filters?.endDate) {
        match.createdAt = {};
        if (filters.startDate) match.createdAt.$gte = filters.startDate;
        if (filters.endDate) match.createdAt.$lte = filters.endDate;
      }

      const rows = await Order.aggregate([
        { $match: match },
        {
          $project: {
            totalPrice: 1,
            source: {
              $let: {
                vars: { src: { $ifNull: ['$marketingData.utm_source', ''] } },
                in: {
                  $cond: [
                    { $gt: [{ $strLenCP: { $trim: { input: '$$src' } } }, 0] },
                    { $toLower: { $trim: { input: '$$src' } } },
                    'direct'
                  ]
                }
              }
            }
          }
        },
        {
          $group: {
            _id: '$source',
            totalRevenue: { $sum: '$totalPrice' },
            ordersCount: { $sum: 1 }
          }
        },
        { $sort: { totalRevenue: -1 } },
        {
          $project: {
            _id: 0,
            source: '$_id',
            totalRevenue: 1,
            ordersCount: 1
          }
        }
      ]);

      return rows as Array<{ source: string; totalRevenue: number; ordersCount: number }>;
    } catch (error: any) {
      console.error('Error fetching revenue by source:', error);
      throw error;
    }
  }

  /**
   * Aggregate monthly revenue growth (YYYY-MM buckets).
   */
  async getMonthlyRevenue(filters?: {
    startDate?: Date;
    endDate?: Date;
    includeArchived?: boolean;
  }): Promise<Array<{ month: string; totalRevenue: number; ordersCount: number }>> {
    try {
      const match: Record<string, any> = {
        status: { $ne: 'cancelled' }
      };
      if (!filters?.includeArchived) {
        match.isDeleted = { $ne: true };
      }
      if (filters?.startDate || filters?.endDate) {
        match.createdAt = {};
        if (filters.startDate) match.createdAt.$gte = filters.startDate;
        if (filters.endDate) match.createdAt.$lte = filters.endDate;
      }

      const rows = await Order.aggregate([
        { $match: match },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m', date: '$createdAt' }
            },
            totalRevenue: { $sum: '$totalPrice' },
            ordersCount: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } },
        {
          $project: {
            _id: 0,
            month: '$_id',
            totalRevenue: 1,
            ordersCount: 1
          }
        }
      ]);

      return rows as Array<{ month: string; totalRevenue: number; ordersCount: number }>;
    } catch (error: any) {
      console.error('Error fetching monthly revenue:', error);
      throw error;
    }
  }

  // Get kitchen preparation report - using aggregation pipeline with $lookup (like Order Management dashboard)
  // Uses Mongoose aggregation to populate product details, ensuring exact same data structure
  async getKitchenReport(targetDate?: string): Promise<{
    items: Array<{
      productName: string;
      category: string;
      totalPackages: number;
      totalWeightRaw: number;
      displayWeight: string;
      unit?: string;
      isUnitOnly?: boolean;
      prepWindow?: 'now' | 'soon' | 'later';
      prepWindowLabel?: string;
      prepSortOrder?: number;
    }>;
    meta: {
      generatedAt: string;
      activeOrdersCount: number;
      appliedDate?: string;
    };
  }> {
    try {
      // Kitchen report should include only pending/in-progress kitchen work.
      const activeStatuses = ['pending', 'new', 'processing', 'in-progress'];

      const normalizedTargetDate =
        typeof targetDate === 'string' && targetDate.trim()
          ? (targetDate.includes('T') ? targetDate.slice(0, 10) : targetDate.trim())
          : '';

      const matchStage: Record<string, any> = {
        status: { $in: activeStatuses },
        isDeleted: { $ne: true }
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
      const activeOrdersCount = await Order.countDocuments(matchStage);

      // Use aggregation pipeline with $lookup to populate product details
      const aggregationResult: any[] = await Order.aggregate([
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
            },
            eventDateRaw: { $ifNull: ['$customerDetails.eventDate', ''] }
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
            hasProductDetails: { $first: '$hasProductDetails' },
            eventDateMin: { $min: '$eventDateRaw' }
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
            hasProductDetails: 1,
            eventDateMin: 1
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

      if (aggregationResult.length === 0) {
        return {
          items: [],
          meta: {
            generatedAt: new Date().toISOString(),
            activeOrdersCount,
            ...(normalizedTargetDate ? { appliedDate: normalizedTargetDate } : {})
          }
        };
      }

      const kitchenReportItems: Array<{
        productName: string;
        category: string;
        totalPackages: number;
        totalWeightRaw: number;
        displayWeight: string;
        unit?: string;
        isUnitOnly: boolean;
        prepWindow: 'now' | 'soon' | 'later';
        prepWindowLabel: string;
        prepSortOrder: number;
      }> = [];

      const parsePrepAt = (eventDateRaw: unknown): Date | null => {
        const datePart = String(eventDateRaw || '').trim().slice(0, 10);
        if (!datePart || !/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return null;
        const parsed = new Date(`${datePart}T12:00:00`);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
      };

      const derivePrepWindow = (eventDateRaw: unknown): { key: 'now' | 'soon' | 'later'; label: string; sortOrder: number } => {
        const now = Date.now();
        const prepAt = parsePrepAt(eventDateRaw);
        if (!prepAt) {
          return { key: 'later', label: 'לתכנון מאוחר יותר', sortOrder: 2 };
        }
        const earliestTs = prepAt.getTime();
        const diffHours = (earliestTs - now) / (1000 * 60 * 60);
        if (diffHours <= 12) return { key: 'now', label: 'עכשיו להכנה', sortOrder: 0 };
        if (diffHours <= 30) return { key: 'soon', label: 'להכין בקרוב', sortOrder: 1 };
        return { key: 'later', label: 'לתכנון מאוחר יותר', sortOrder: 2 };
      };

      for (const item of aggregationResult) {
        try {
          if (!item || !item.productName) {
            continue;
          }

          const productName = item.productName || 'Unknown Product';
          const category = item.category || 'תוספות';
          const totalPackages = item.totalPackages || 0;
          
          // Validate totalPackages is a valid number
          if (isNaN(totalPackages) || totalPackages <= 0) {
            continue;
          }
          
          // Check if this category should be calculated by units only
          const isUnitOnlyCategory = this.UNIT_ONLY_CATEGORIES.some(cat => 
            category.toLowerCase().includes(cat.toLowerCase()) || 
            cat.toLowerCase().includes(category.toLowerCase())
          );

          // Extract weight/volume from product name (only if not unit-only category)
          const weightInfo = isUnitOnlyCategory 
            ? { value: 0, unit: null as 'g' | 'ml' | 'kg' | 'l' | null }
            : this.extractWeightFromName(productName);
          
          // Calculate total weight: weight per unit × total packages
          const totalWeightRaw = isUnitOnlyCategory ? 0 : (weightInfo.value * totalPackages);
          
          // Format weight for display
          const displayWeight = isUnitOnlyCategory 
            ? '-' 
            : this.formatWeight(totalWeightRaw, weightInfo.unit);
          const prepWindow = derivePrepWindow(item.eventDateMin);
          
          kitchenReportItems.push({
            productName: productName,
            category: category,
            totalPackages: totalPackages,
            totalWeightRaw: totalWeightRaw,
            displayWeight: displayWeight,
            unit: weightInfo.unit || undefined,
            isUnitOnly: isUnitOnlyCategory,
            prepWindow: prepWindow.key,
            prepWindowLabel: prepWindow.label,
            prepSortOrder: prepWindow.sortOrder
          });
        } catch (itemError: any) {
          console.error('Error processing kitchen item:', itemError?.message || itemError);
        }
      }

      // Merge near-duplicate rows from legacy naming/casing differences.
      const merged = new Map<
        string,
        {
          productName: string;
          category: string;
          totalPackages: number;
          totalWeightRaw: number;
          displayWeight: string;
          unit?: string;
          isUnitOnly: boolean;
          prepWindow: 'now' | 'soon' | 'later';
          prepWindowLabel: string;
          prepSortOrder: number;
        }
      >();

      for (const row of kitchenReportItems) {
        const category = String(row.category || 'תוספות').trim();
        const productName = String(row.productName || '').trim();
        if (!productName) continue;
        const key = `${category.toLowerCase()}::${productName.toLowerCase()}`;
        const prev = merged.get(key);
        if (!prev) {
          merged.set(key, { ...row, category, productName });
          continue;
        }
        const nextTotalPackages = Number(prev.totalPackages || 0) + Number(row.totalPackages || 0);
        const nextTotalWeightRaw = Number(prev.totalWeightRaw || 0) + Number(row.totalWeightRaw || 0);
        merged.set(key, {
          ...prev,
          totalPackages: nextTotalPackages,
          totalWeightRaw: nextTotalWeightRaw,
          displayWeight: prev.isUnitOnly
            ? '-'
            : this.formatWeight(nextTotalWeightRaw, (prev.unit as any) || null)
        });
      }

      const finalItems = Array.from(merged.values());

      // Final sort by category order
      const categoryOrder = ['מנות עיקריות', 'סלטים', 'דגים', 'קינוחים'];
      finalItems.sort((a, b) => {
        if (a.prepSortOrder !== b.prepSortOrder) {
          return a.prepSortOrder - b.prepSortOrder;
        }
        const categoryAIndex = categoryOrder.indexOf(a.category);
        const categoryBIndex = categoryOrder.indexOf(b.category);

        if (categoryAIndex !== categoryBIndex) {
          if (categoryAIndex === -1 && categoryBIndex === -1) {
            return a.category.localeCompare(b.category);
          }
          if (categoryAIndex === -1) return 1;
          if (categoryBIndex === -1) return -1;
          return categoryAIndex - categoryBIndex;
        }
        return a.productName.localeCompare(b.productName);
      });
      return {
        items: finalItems,
        meta: {
          generatedAt: new Date().toISOString(),
          activeOrdersCount,
          ...(normalizedTargetDate ? { appliedDate: normalizedTargetDate } : {})
        }
      };
    } catch (error: any) {
      console.error('Error generating kitchen report:', error);
      throw new Error(`Failed to generate kitchen report: ${error.message}`);
    }
  }

  // Helper: Detect category from product name
  private detectCategoryFromName(productName: string): string {
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
  private extractWeightFromName(productName: string): { value: number; unit: 'g' | 'ml' | 'kg' | 'l' | null } {
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
    let unit: 'g' | 'ml' | 'kg' | 'l' | null = null;
    
    if (unitStr.includes('g') || unitStr.includes('גרם')) {
      unit = 'g';
      normalizedValue = value;
    } else if (unitStr.includes('kg') || unitStr.includes('ק"ג') || unitStr.includes('קילו')) {
      unit = 'kg';
      normalizedValue = value * 1000; // Convert to grams
    } else if (unitStr.includes('ml') || unitStr.includes('מ"ל')) {
      unit = 'ml';
      normalizedValue = value;
    } else if (unitStr.includes('l') || unitStr.includes('ליטר')) {
      unit = 'l';
      normalizedValue = value * 1000; // Convert to ml
    }
    
    return { value: normalizedValue, unit };
  }

  // Helper: Format weight for display
  private formatWeight(totalWeightRaw: number, unit: 'g' | 'ml' | 'kg' | 'l' | null): string {
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
  private async getDeliveryReportForOneDay(
    dateStr: string,
    assignedDriverId?: string
  ): Promise<{
    deliveryByCity: { city: string; orders: any[] }[];
    pickupByTime: { time: string; orders: any[] }[];
  }> {
    const query: Record<string, unknown> = {
      status: { $ne: 'cancelled' },
      isDeleted: { $ne: true },
      'customerDetails.eventDate': dateStr
    };
    if (assignedDriverId) {
      query.assignedDriverId = assignedDriverId;
    }
    const activeOrders = await Order.find(query).lean();
    const cityMap: { [key: string]: any[] } = {};
    const pickupTimeMap: { [key: string]: any[] } = {};

    for (const order of activeOrders) {
      const customerDetails = (order as any).customerDetails || {};
      const deliveryDetails = customerDetails.deliveryDetails || {};
      const deliveryMethod = customerDetails.deliveryMethod === 'pickup' ? 'pickup' : 'delivery';

      let city = deliveryDetails?.city || customerDetails.city || customerDetails.deliveryCity || null;
      if (!city && customerDetails.address) {
        const addressParts = customerDetails.address.split(',').map((p: string) => p.trim());
        city = addressParts[addressParts.length - 1] || null;
      }
      if (city) city = city.trim();
      else city = 'כתובת לא צוינה';

      const orderSummary = {
        _id: (order as any)._id.toString(),
        status: (order as any).status || 'pending',
        assignedDriverId: (order as any).assignedDriverId ? String((order as any).assignedDriverId) : null,
        assignedDriverName: (order as any).assignedDriverName || '',
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
        items: (order as any).items || [],
        notes: customerDetails.notes || deliveryDetails.comments || null,
        deliveryMethod,
        eventDate: customerDetails.eventDate || null,
        preferredDeliveryTime: customerDetails.preferredDeliveryTime || null
      };

      if (deliveryMethod === 'pickup') {
        const timeSlot = orderSummary.preferredDeliveryTime || 'לא צוין';
        if (!pickupTimeMap[timeSlot]) pickupTimeMap[timeSlot] = [];
        pickupTimeMap[timeSlot].push(orderSummary);
      } else {
        if (!cityMap[city]) cityMap[city] = [];
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
  }

  /** Get delivery report for a single day or a date range. Returns days keyed by YYYY-MM-DD. */
  async getDeliveryReport(fromDate?: string, toDate?: string, assignedDriverId?: string): Promise<{
    days: Record<string, { deliveryByCity: { city: string; orders: any[] }[]; pickupByTime: { time: string; orders: any[] }[] }>;
  }> {
    try {
      const norm = (d: string) => (d && d.indexOf('T') >= 0 ? d.slice(0, 10) : d) || '';
      const from = norm(fromDate || '');
      const to = norm(toDate || '');

      const dateStrings: string[] = [];
      if (from && to) {
        const start = new Date(from);
        const end = new Date(to);
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          dateStrings.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'));
        }
      } else if (from) {
        dateStrings.push(from);
      }

      const days: Record<string, { deliveryByCity: { city: string; orders: any[] }[]; pickupByTime: { time: string; orders: any[] }[] }> = {};
      for (const dateStr of dateStrings) {
        days[dateStr] = await this.getDeliveryReportForOneDay(dateStr, assignedDriverId);
      }
      console.log('🚚 Delivery report: days', Object.keys(days).length);
      return { days };
    } catch (error: any) {
      console.error('❌ Error generating delivery report:', error);
      throw new Error(`Failed to generate delivery report: ${error.message}`);
    }
  }
}
