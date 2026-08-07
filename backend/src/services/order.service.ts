import Order, { IOrder } from '../models/Order';
import MenuItem from '../models/menuItem';
import mongoose from 'mongoose';
import {
  isHolidayOrderProductId,
  resolveHolidayOrderProduct
} from '../utils/holiday-order.utils';
import { CreateOrderRequest, CreateCheckoutOrderRequest, OrderResponse } from '../models/order.model';
import { sanitizeMarketingData } from '../utils/webhook.util';
import { emailService } from './email.service';
import { upsertCustomerFromOrder } from './customer.service';
import { ORDER_ADMIN_LIST_SELECT, ORDER_API_DETAIL_SELECT } from '../utils/order-projection.util';
import { validateAdminNotesPayload } from '../utils/portal-week';
import StoreSettings from '../models/store-settings.model';
import { assertEventDateOpen, normalizeOpenDateRules, normalizeOpenDates } from '../utils/open-date-rules';
import {
  computeAdminRecalculatedTotals,
  isGatewayLockedPaymentStatus
} from '../utils/order-admin-pricing.util';
import {
  buildAdminArchiveTabFilter,
  buildAdminFailedTabFilter,
  buildAdminStatusChangeUpdate,
  buildAdminStatusTabFilter,
  hasOpenPaymentException,
  isOpsStatusRequiringExceptionResolution,
  normalizePaymentExceptionResolution,
  resolveAdminStatusTab,
  RESOLUTIONS_THAT_CLOSE_EXCEPTION,
  RESOLUTIONS_TO_PROCESSING,
  type AdminStatusTab
} from '../utils/order-admin-status.util';
import {
  applyOpsStatusTimestamps,
  canArchiveOrderByStatus,
  parseServiceDateFromEventDate
} from '../utils/order-lifecycle-timestamps.util';
import OrderNotificationClaim from '../models/OrderNotificationClaim';
import {
  extractBaseProductId,
  findMatchingPricingOption,
  findMatchingPricingVariant,
  formatItemDisplayName,
  itemVariantFingerprint,
  amountsEquivalent,
  looksLikeSizeToken,
  normalizeSelectedOption,
  parseCompositeSizeIndex,
  parseOptionFromItemName,
  resolveSelectedOptionForUpdate,
  SelectedOptionSnapshot
} from '../utils/order-item-options.util';

export interface AdminSourceTabCounts {
  total: number;
  pending: number;
  processing: number;
  ready: number;
  failed: number;
  cancelled: number;
  completed: number;
  archive: number;
}

export type AdminOrderSource = 'shabbat' | 'catering' | 'events';
export type AdminOrderStatusTab =
  | 'pending'
  | 'processing'
  | 'ready'
  | 'failed'
  | 'cancelled'
  | 'completed'
  | 'archive';
export type AdminOrdersSortBy =
  | 'createdAt'
  | 'eventDate'
  | 'customerName'
  | 'totalPrice'
  | 'status'
  | 'orderNumber';

export interface AdminOrdersPageFilters {
  page?: number;
  limit?: number;
  source?: AdminOrderSource;
  statusTab?: AdminOrderStatusTab;
  /** @deprecated Legacy combined search — use orderNumberSearch / customerSearch */
  search?: string;
  /** @deprecated Legacy combined date — use createdFrom/createdTo or eventFrom/eventTo */
  dateFrom?: string;
  /** @deprecated Legacy combined date — use createdFrom/createdTo or eventFrom/eventTo */
  dateTo?: string;
  orderNumberSearch?: string;
  customerSearch?: string;
  createdFrom?: string;
  createdTo?: string;
  eventFrom?: string;
  eventTo?: string;
  sortBy?: AdminOrdersSortBy;
  sortDir?: 'asc' | 'desc';
  hasCustomerNotes?: boolean;
  hasAdminNotes?: boolean;
}

export interface CheckoutCreationOptions {
  isManual?: boolean;
  paymentStatus?: 'paid' | 'unpaid';
  paymentInitTokenHash?: string;
  paymentInitTokenExpiresAt?: Date;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export class OrderService {
  // Categories that should only show units, not calculated weight
  private readonly UNIT_ONLY_CATEGORIES = ['דגים', 'מנות עיקריות', 'Fish', 'Main Courses'];

  /** Validate customer event date against store openDates / openDateRules (Israel cutoff). */
  async validateEventDateOpen(eventDate: unknown): Promise<void> {
    if (eventDate == null || eventDate === '') return;
    const doc = await StoreSettings.findOne().lean();
    const settings = {
      openDates: normalizeOpenDates((doc as any)?.openDates),
      openDateRules: normalizeOpenDateRules((doc as any)?.openDateRules)
    };
    assertEventDateOpen(eventDate, settings);
  }

  private generateOrderNumber(): string {
    return 'MG-' + Math.floor(100000 + Math.random() * 900000).toString();
  }

  // Submit a new order
  async submitOrder(orderData: CreateOrderRequest, userId: string | null = null): Promise<OrderResponse> {
    try {
      console.log('📝 OrderService: Creating order for user:', userId || 'Guest', '| items:', orderData.items?.length ?? 0);

      // Map items to include category and imageUrl if missing
      const orderItems = orderData.items.map(item => {
        let category = (item as any).category;
        if (!category || category.trim() === '') {
          category = this.detectCategoryFromName(item.name);
        }
        const selectedOption = normalizeSelectedOption((item as any).selectedOption, {
          name: item.name,
          price: item.price
        });
        return {
          productId: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          category,
          imageUrl: (item as any).imageUrl || (item as any).image || undefined,
          description: (item as any).description
            ? String((item as any).description).trim()
            : undefined,
          selectedOption: selectedOption
            ? {
                label: selectedOption.label,
                amount: selectedOption.amount,
                price: selectedOption.price,
                optionId: selectedOption.optionId,
                optionName: selectedOption.optionName,
                valueId: selectedOption.valueId,
                valueName: selectedOption.valueName,
                quantity: selectedOption.quantity,
                priceAdjustment: selectedOption.priceAdjustment
              }
            : undefined
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
        status: 'new',
        isTestOrder: false
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
  async createOrderFromCheckout(
    payload: CreateCheckoutOrderRequest,
    options: CheckoutCreationOptions = {}
  ): Promise<IOrder> {
    const addressStr =
      typeof payload.address === 'string'
        ? payload.address
        : payload.address && typeof payload.address === 'object'
          ? [payload.address.city, payload.address.street, payload.address.apartment].filter(Boolean).join(', ')
          : '';

    const orderItems = payload.items.map(item => {
      const selectedOption = normalizeSelectedOption((item as any).selectedOption, {
        name: item.name,
        price: item.price
      });
      return {
        productId: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        category: (item as any).category || this.detectCategoryFromName(item.name),
        imageUrl: (item as any).imageUrl || (item as any).image || undefined,
        description: (item as any).description ? String((item as any).description).trim() : undefined,
        selectedOption: selectedOption
          ? {
              label: selectedOption.label,
              amount: selectedOption.amount,
              price: selectedOption.price,
              optionId: selectedOption.optionId,
              optionName: selectedOption.optionName,
              valueId: selectedOption.valueId,
              valueName: selectedOption.valueName,
              quantity: selectedOption.quantity,
              priceAdjustment: selectedOption.priceAdjustment
            }
          : undefined
      };
    });

    const isManual = options.isManual === true;
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
    if (isManual && options.paymentStatus) {
      customerDetails.isPaid = options.paymentStatus === 'paid';
    }
    const marketingData = sanitizeMarketingData((payload as { marketingData?: unknown }).marketingData);
    const serviceDate = parseServiceDateFromEventDate(payload.eventDate);
    const now = new Date();
    const paidAt =
      isManual && options.paymentStatus === 'paid' ? now : undefined;

    const order = new Order({
      userId: (payload as any).userId ?? null,
      orderNumber: this.generateOrderNumber(),
      customerDetails,
      items: orderItems,
      totalPrice: payload.totalAmount,
      subtotal: payload.subtotal ?? null,
      deliveryFee: payload.deliveryFee ?? null,
      status,
      isTestOrder: false,
      ...(serviceDate ? { serviceDate } : {}),
      ...(paidAt ? { paidAt } : {}),
      ...(!isManual && options.paymentInitTokenHash && options.paymentInitTokenExpiresAt
        ? {
            paymentInitTokenHash: options.paymentInitTokenHash,
            paymentInitTokenExpiresAt: options.paymentInitTokenExpiresAt
          }
        : {}),
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
        .select(ORDER_API_DETAIL_SELECT)
        .sort({ createdAt: -1 })
        .lean();
      
      return orders as IOrder[];
    } catch (error: any) {
      console.error('Error fetching user orders:', error);
      throw error;
    }
  }

  // Get all orders with filters (Admin). archive=true => isDeleted or cancelled; otherwise active only (isDeleted false).
  // paymentFilter=failed => unresolved failed/awaiting_payment exceptions tab.
  async getAllOrders(filters: {
    status?: string;
    limit?: number;
    offset?: number;
    startDate?: Date;
    endDate?: Date;
    archive?: boolean;
    paymentFilter?: 'valid' | 'failed';
  }): Promise<{ orders: IOrder[]; total: number }> {
    try {
      const query: any = {};

      if (filters.archive === true) {
        query.$or = [{ isDeleted: true }, { status: 'cancelled' }];
      } else if (filters.paymentFilter === 'failed') {
        Object.assign(query, buildAdminFailedTabFilter());
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
        .select(ORDER_ADMIN_LIST_SELECT)
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

  /** Mirrors admin-orders source tabs: shabbat cart vs shabbat catering vs events catering. */
  private buildAdminOrderSourceFilter(source: 'shabbat' | 'catering' | 'events'): Record<string, unknown> {
    if (source === 'events') {
      return { cateringKind: 'events' };
    }
    const cateringSignals = {
      $or: [
        { orderType: 'catering' },
        { numberOfPortions: { $exists: true, $nin: [null, ''] } },
        { mealTime: { $exists: true, $nin: [null, ''] } }
      ]
    };
    if (source === 'catering') {
      return {
        cateringKind: { $ne: 'events' },
        ...cateringSignals
      };
    }
    return {
      cateringKind: { $ne: 'events' },
      $nor: [
        { orderType: 'catering' },
        { numberOfPortions: { $exists: true, $nin: [null, ''] } },
        { mealTime: { $exists: true, $nin: [null, ''] } }
      ]
    };
  }

  private buildAdminActiveOrdersFilter(): Record<string, unknown> {
    // Active (non-archive) base — tab exclusivity is applied per statusTab filter.
    return {
      isDeleted: { $ne: true },
      status: { $ne: 'cancelled' }
    };
  }

  private buildAdminFailedOrdersFilter(now: Date = new Date()): Record<string, unknown> {
    return buildAdminFailedTabFilter(now);
  }

  private buildAdminArchiveOrdersFilter(): Record<string, unknown> {
    return buildAdminArchiveTabFilter();
  }

  private buildAdminStatusTabFilter(
    statusTab: AdminOrderStatusTab,
    now: Date = new Date()
  ): Record<string, unknown> {
    return buildAdminStatusTabFilter(statusTab as AdminStatusTab, now);
  }

  private mergeMongoQueryParts(...parts: Record<string, unknown>[]): Record<string, unknown> {
    const nonEmpty = parts.filter((p) => p && Object.keys(p).length > 0);
    if (nonEmpty.length === 0) return {};
    if (nonEmpty.length === 1) return nonEmpty[0];
    return { $and: nonEmpty };
  }

  private buildAdminOrdersSort(
    sortBy?: AdminOrdersSortBy,
    sortDir?: 'asc' | 'desc'
  ): Record<string, 1 | -1> {
    if (!sortBy) {
      return { 'customerDetails.eventDate': 1, createdAt: -1 };
    }
    const dir: 1 | -1 = sortDir === 'desc' ? -1 : 1;
    switch (sortBy) {
      case 'createdAt':
        return { createdAt: dir };
      case 'eventDate':
        return { 'customerDetails.eventDate': dir, createdAt: -1 };
      case 'customerName':
        return { 'customerDetails.fullName': dir, createdAt: -1 };
      case 'totalPrice':
        return { totalPrice: dir, createdAt: -1 };
      case 'status':
        return { status: dir, createdAt: -1 };
      case 'orderNumber':
        return { orderNumber: dir, createdAt: -1 };
      default:
        return { 'customerDetails.eventDate': 1, createdAt: -1 };
    }
  }

  private buildAdminOrdersLegacyDateFilter(dateFrom?: string, dateTo?: string): Record<string, unknown> | null {
    if (!dateFrom && !dateTo) return null;
    const eventRange: Record<string, string> = {};
    if (dateFrom) eventRange.$gte = dateFrom;
    if (dateTo) eventRange.$lte = dateTo;

    const createdRange: Record<string, Date> = {};
    if (dateFrom) createdRange.$gte = new Date(`${dateFrom}T00:00:00.000Z`);
    if (dateTo) createdRange.$lte = new Date(`${dateTo}T23:59:59.999Z`);

    return {
      $or: [
        { 'customerDetails.eventDate': eventRange },
        {
          $and: [
            {
              $or: [
                { 'customerDetails.eventDate': { $exists: false } },
                { 'customerDetails.eventDate': null },
                { 'customerDetails.eventDate': '' }
              ]
            },
            { createdAt: createdRange }
          ]
        }
      ]
    };
  }

  private buildAdminOrdersCreatedDateFilter(
    createdFrom?: string,
    createdTo?: string
  ): Record<string, unknown> | null {
    if (!createdFrom && !createdTo) return null;
    const createdRange: Record<string, Date> = {};
    if (createdFrom) createdRange.$gte = new Date(`${createdFrom}T00:00:00.000Z`);
    if (createdTo) createdRange.$lte = new Date(`${createdTo}T23:59:59.999Z`);
    return { createdAt: createdRange };
  }

  private buildAdminOrdersEventDateFilter(
    eventFrom?: string,
    eventTo?: string
  ): Record<string, unknown> | null {
    if (!eventFrom && !eventTo) return null;
    const eventRange: Record<string, string> = {};
    if (eventFrom) eventRange.$gte = eventFrom;
    if (eventTo) eventRange.$lte = eventTo;
    return { 'customerDetails.eventDate': eventRange };
  }

  private buildAdminOrdersLegacySearchFilter(search: string): Record<string, unknown> {
    const regex = new RegExp(escapeRegex(search), 'i');
    return {
      $or: [
        { orderNumber: regex },
        { 'customerDetails.fullName': regex },
        { 'customerDetails.phone': regex },
        { 'customerDetails.email': regex },
        { 'customerDetails.address': regex }
      ]
    };
  }

  private buildAdminOrdersOrderNumberSearchFilter(search: string): Record<string, unknown> {
    const regex = new RegExp(escapeRegex(search), 'i');
    return { orderNumber: regex };
  }

  private buildAdminOrdersCustomerSearchFilter(search: string): Record<string, unknown> {
    const regex = new RegExp(escapeRegex(search), 'i');
    return {
      $or: [
        { 'customerDetails.fullName': regex },
        { 'customerDetails.phone': regex },
        { 'customerDetails.email': regex },
        { 'customerDetails.address': regex }
      ]
    };
  }

  /**
   * Paginated admin orders list — full DB query with source/status/search/sort filters.
   */
  async getAdminOrdersPage(filters: AdminOrdersPageFilters): Promise<{
    orders: IOrder[];
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  }> {
    const page = Math.max(1, Math.floor(Number(filters.page)) || 1);
    const limit = Math.min(100, Math.max(1, Math.floor(Number(filters.limit)) || 25));
    const skip = (page - 1) * limit;

    const parts: Record<string, unknown>[] = [];
    if (filters.source) {
      parts.push(this.buildAdminOrderSourceFilter(filters.source));
    }
    if (filters.statusTab) {
      parts.push(this.buildAdminStatusTabFilter(filters.statusTab));
    }

    const orderNumberSearch = String(filters.orderNumberSearch || '').trim();
    const customerSearch = String(filters.customerSearch || '').trim();
    const legacySearch = String(filters.search || '').trim();

    if (orderNumberSearch) {
      parts.push(this.buildAdminOrdersOrderNumberSearchFilter(orderNumberSearch));
    }
    if (customerSearch) {
      parts.push(this.buildAdminOrdersCustomerSearchFilter(customerSearch));
    }
    if (legacySearch && !orderNumberSearch && !customerSearch) {
      parts.push(this.buildAdminOrdersLegacySearchFilter(legacySearch));
    }

    const createdDateFilter = this.buildAdminOrdersCreatedDateFilter(
      filters.createdFrom,
      filters.createdTo
    );
    if (createdDateFilter) parts.push(createdDateFilter);

    const eventDateFilter = this.buildAdminOrdersEventDateFilter(filters.eventFrom, filters.eventTo);
    if (eventDateFilter) parts.push(eventDateFilter);

    const hasNewDateParams = !!(
      filters.createdFrom ||
      filters.createdTo ||
      filters.eventFrom ||
      filters.eventTo
    );
    if (!hasNewDateParams) {
      const legacyDateFilter = this.buildAdminOrdersLegacyDateFilter(
        filters.dateFrom,
        filters.dateTo
      );
      if (legacyDateFilter) parts.push(legacyDateFilter);
    }

    if (filters.hasCustomerNotes) {
      parts.push({
        'customerDetails.notes': { $exists: true, $nin: [null, ''] }
      });
    }
    if (filters.hasAdminNotes) {
      parts.push({
        adminNotes: { $exists: true, $nin: [null, ''] }
      });
    }

    const query = this.mergeMongoQueryParts(...parts);
    const sort = this.buildAdminOrdersSort(filters.sortBy, filters.sortDir);

    const total = await Order.countDocuments(query);
    const orders = await Order.find(query)
      .select(ORDER_ADMIN_LIST_SELECT)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();

    const totalPages = Math.max(1, Math.ceil(total / limit) || 1);

    return {
      orders: orders as IOrder[],
      page,
      limit,
      total,
      totalPages
    };
  }

  /**
   * Admin dashboard tab counts — full DB counts, no list limit.
   * Status buckets match admin-orders.component filteredOrders logic.
   */
  async getAdminTabCounts(): Promise<{
    shabbat: AdminSourceTabCounts;
    catering: AdminSourceTabCounts;
    events: AdminSourceTabCounts;
  }> {
    const now = new Date();
    const sources = ['shabbat', 'catering', 'events'] as const;
    const entries = await Promise.all(
      sources.map(async (source) => {
        const sourceFilter = this.buildAdminOrderSourceFilter(source);
        const [pending, processing, ready, failed, cancelled, completed, archive] =
          await Promise.all([
            Order.countDocuments(
              this.mergeMongoQueryParts(sourceFilter, this.buildAdminStatusTabFilter('pending', now))
            ),
            Order.countDocuments(
              this.mergeMongoQueryParts(
                sourceFilter,
                this.buildAdminStatusTabFilter('processing', now)
              )
            ),
            Order.countDocuments(
              this.mergeMongoQueryParts(sourceFilter, this.buildAdminStatusTabFilter('ready', now))
            ),
            Order.countDocuments(
              this.mergeMongoQueryParts(sourceFilter, this.buildAdminStatusTabFilter('failed', now))
            ),
            Order.countDocuments(
              this.mergeMongoQueryParts(
                sourceFilter,
                this.buildAdminStatusTabFilter('cancelled', now)
              )
            ),
            Order.countDocuments(
              this.mergeMongoQueryParts(
                sourceFilter,
                this.buildAdminStatusTabFilter('completed', now)
              )
            ),
            Order.countDocuments(
              this.mergeMongoQueryParts(sourceFilter, this.buildAdminStatusTabFilter('archive', now))
            )
          ]);
        const total = pending + processing + ready + failed + cancelled + completed;
        return [
          source,
          { total, pending, processing, ready, failed, cancelled, completed, archive }
        ] as const;
      })
    );
    return Object.fromEntries(entries) as {
      shabbat: AdminSourceTabCounts;
      catering: AdminSourceTabCounts;
      events: AdminSourceTabCounts;
    };
  }

  // Get order by ID (with user verification). Enriches items with imageUrl from menu when missing.
  async getOrderById(orderId: string, userId: string): Promise<IOrder | null> {
    try {
      const order = await Order.findOne({
        _id: orderId,
        userId: userId
      })
        .select(ORDER_API_DETAIL_SELECT)
        .lean();

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
      const order = await Order.findOne({ _id: orderId }).select(ORDER_API_DETAIL_SELECT).lean();
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
      })
        .select(ORDER_API_DETAIL_SELECT)
        .lean();
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
        if (isHolidayOrderProductId(String(productId))) {
          const holiday = await resolveHolidayOrderProduct(String(productId), {
            name: item.name,
            imageUrl: item.imageUrl
          });
          if (holiday?.imageUrl) {
            (item as any).imageUrl = String(holiday.imageUrl).trim();
          }
          continue;
        }
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
  async updateOrderStatus(
    orderId: string,
    updates: {
      status?: string;
      deliveryDate?: Date;
      notes?: string;
      paymentExceptionResolution?: unknown;
      manualPaymentMethod?: string;
      manualPaymentNote?: string;
      exceptionNote?: string;
    },
    meta?: { changedBy?: string; notificationSent?: boolean; now?: Date }
  ): Promise<{
    order: IOrder | null;
    previousStatus: string | null;
    adminStatusTab: AdminStatusTab | null;
    idempotent: boolean;
    shouldSendApprovalEmail: boolean;
  }> {
    try {
      const now = meta?.now || new Date();
      const prior = await Order.findById(orderId)
        .select(
          'status paymentStatus paymentExceptionResolvedAt paymentExceptionResolution paymentAwaitingStartedAt paymentFailedAt readyAt completedAt cancelledAt paidAt capturedAt serviceDate createdAt updatedAt transactionId paymentInitTokenHash isManual isDeleted'
        )
        .lean();
      if (!prior) {
        return {
          order: null,
          previousStatus: null,
          adminStatusTab: null,
          idempotent: false,
          shouldSendApprovalEmail: false
        };
      }

      const previousStatus = String((prior as any).status || '') || null;
      const previousPaymentStatus = String((prior as any).paymentStatus || '') || null;
      let nextStatus = String(updates.status || '').trim();
      const changedBy = String(meta?.changedBy || 'system').trim() || 'system';
      const notificationSent = Boolean(meta?.notificationSent);
      const resolution = normalizePaymentExceptionResolution(updates.paymentExceptionResolution);

      // Map explicit business resolutions onto status when status omitted.
      if (resolution && RESOLUTIONS_TO_PROCESSING.has(resolution) && !nextStatus) {
        nextStatus = 'processing';
      }
      if (resolution === 'cancel_order') {
        nextStatus = 'cancelled';
      }

      // Idempotent: already at target with exception already closed (when required).
      if (
        nextStatus &&
        previousStatus === nextStatus &&
        (!hasOpenPaymentException(prior as any) ||
          (resolution &&
            String((prior as any).paymentExceptionResolution || '') === resolution &&
            (prior as any).paymentExceptionResolvedAt != null))
      ) {
        const full = await Order.findById(orderId).select(ORDER_API_DETAIL_SELECT).lean();
        return {
          order: full as IOrder | null,
          previousStatus,
          adminStatusTab: full ? resolveAdminStatusTab(full as any, now) : null,
          idempotent: true,
          shouldSendApprovalEmail: false
        };
      }

      // IMPORTANT: never rewrite paymentStatus here — ops status and payment are independent.
      let updateOps: Record<string, unknown> = { $set: {} as Record<string, unknown> };
      let shouldSendApprovalEmail = false;
      let filterNeedsOpenException = false;

      if (nextStatus) {
        const built = buildAdminStatusChangeUpdate({
          previousStatus,
          nextStatus,
          previousPaymentStatus,
          changedBy,
          notificationSent,
          paymentExceptionResolution: updates.paymentExceptionResolution,
          orderHasOpenPaymentException: hasOpenPaymentException(prior as any),
          manualPaymentMethod: updates.manualPaymentMethod,
          manualPaymentNote: updates.manualPaymentNote,
          exceptionNote: updates.exceptionNote,
          now,
          priorTimestamps: {
            readyAt: (prior as any).readyAt,
            completedAt: (prior as any).completedAt,
            cancelledAt: (prior as any).cancelledAt,
            paidAt: (prior as any).paidAt,
            capturedAt: (prior as any).capturedAt,
            serviceDate: (prior as any).serviceDate
          }
        });
        updateOps = { $set: { ...built.$set } };
        if (built.$push) updateOps.$push = built.$push;
        if (built.$unset) updateOps.$unset = built.$unset;
        shouldSendApprovalEmail = built.shouldSendApprovalEmail;

        // Closing exception (explicit or implied by move to processing) — race-safe filter.
        const closingResolution =
          built.resolution && RESOLUTIONS_THAT_CLOSE_EXCEPTION.has(built.resolution)
            ? built.resolution
            : null;
        if (closingResolution && hasOpenPaymentException(prior as any)) {
          filterNeedsOpenException = true;
        }
      }

      const $set = updateOps.$set as Record<string, unknown>;
      if (updates.deliveryDate) $set.deliveryDate = updates.deliveryDate;
      if (updates.notes !== undefined) $set['customerDetails.notes'] = updates.notes;

      // Conditional write: if closing exception, require it still open (race / double-tab safe).
      const filter: Record<string, unknown> = { _id: orderId };
      if (
        filterNeedsOpenException ||
        (resolution &&
          RESOLUTIONS_THAT_CLOSE_EXCEPTION.has(resolution) &&
          hasOpenPaymentException(prior as any))
      ) {
        filter.$or = [
          { paymentExceptionResolvedAt: null },
          { paymentExceptionResolvedAt: { $exists: false } }
        ];
      }

      const order = await Order.findOneAndUpdate(filter, updateOps, { returnDocument: 'after' })
        .select(ORDER_API_DETAIL_SELECT)
        .lean();

      if (!order && nextStatus) {
        // Lost the race — return current state idempotently.
        const current = await Order.findById(orderId).select(ORDER_API_DETAIL_SELECT).lean();
        return {
          order: current as IOrder | null,
          previousStatus,
          adminStatusTab: current ? resolveAdminStatusTab(current as any, now) : null,
          idempotent: true,
          shouldSendApprovalEmail: false
        };
      }

      if (order && String((order as any).status) === 'cancelled') {
        try {
          const { appendKitchenChange } = await import('./kitchen-report.service');
          await appendKitchenChange(orderId, 'cancelled', 'ההזמנה בוטלה', undefined);
          const kitchenOpsPath = './kitchen-ops' + '.service';
          const { onOrderKitchenRelevantChange } = await import(kitchenOpsPath);
          await onOrderKitchenRelevantChange(orderId, {
            type: 'cancelled',
            summary: 'ההזמנה בוטלה',
            previousValue: String(previousStatus || ''),
            newValue: 'cancelled'
          });
        } catch {
          /* non-blocking */
        }
      }

      return {
        order: order as IOrder | null,
        previousStatus,
        adminStatusTab: order ? resolveAdminStatusTab(order as any, now) : null,
        idempotent: false,
        shouldSendApprovalEmail
      };
    } catch (error: any) {
      if (error?.statusCode === 422 || error?.code === 'PAYMENT_EXCEPTION_RESOLUTION_REQUIRED') {
        throw error;
      }
      if (error?.code === 'PAYMENT_LINK_DOES_NOT_CHANGE_STATUS') {
        throw error;
      }
      console.error('Error updating order status:', error);
      throw error;
    }
  }

  /** Mark the latest statusChangeHistory entry's notificationSent flag. */
  async markLatestStatusChangeNotification(
    orderId: string,
    notificationSent: boolean
  ): Promise<void> {
    const order = await Order.findById(orderId).select('statusChangeHistory').lean();
    if (!order) return;
    const history = Array.isArray((order as any).statusChangeHistory)
      ? ((order as any).statusChangeHistory as any[])
      : [];
    if (!history.length) return;
    const lastIdx = history.length - 1;
    await Order.updateOne(
      { _id: orderId },
      { $set: { [`statusChangeHistory.${lastIdx}.notificationSent`]: Boolean(notificationSent) } }
    );
  }

  /**
   * Explicit payment-exception decision. Closing resolutions update status atomically
   * via updateOrderStatus. send_new_payment_link does not close or change status.
   */
  async resolvePaymentException(
    orderId: string,
    payload: {
      resolution: unknown;
      adminUserId?: unknown;
      manualPaymentMethod?: string;
      manualPaymentNote?: string;
      exceptionNote?: string;
    }
  ): Promise<{ order: IOrder | null; adminStatusTab: AdminStatusTab | null }> {
    const resolution = normalizePaymentExceptionResolution(payload.resolution);
    if (!resolution) {
      throw Object.assign(new Error('סוג טיפול בחריגת תשלום לא תקין'), {
        statusCode: 422,
        code: 'INVALID_PAYMENT_EXCEPTION_RESOLUTION'
      });
    }

    if (resolution === 'send_new_payment_link') {
      const order = await Order.findById(orderId).select(ORDER_API_DETAIL_SELECT).lean();
      if (!order) return { order: null, adminStatusTab: null };
      const pay = String((order as any).paymentStatus || '');
      if (pay !== 'failed' && pay !== 'awaiting_payment') {
        throw Object.assign(new Error('ניתן לטפל רק בהזמנות עם תשלום נכשל או נטוש'), {
          statusCode: 422
        });
      }
      // Does not close exception and does not change ops status.
      return {
        order: order as IOrder,
        adminStatusTab: resolveAdminStatusTab(order as any)
      };
    }

    const nextStatus = resolution === 'cancel_order' ? 'cancelled' : 'processing';
    const result = await this.updateOrderStatus(
      orderId,
      {
        status: nextStatus,
        paymentExceptionResolution: resolution,
        manualPaymentMethod: payload.manualPaymentMethod,
        manualPaymentNote: payload.manualPaymentNote,
        exceptionNote: payload.exceptionNote
      },
      { changedBy: payload.adminUserId != null ? String(payload.adminUserId) : 'admin' }
    );
    return { order: result.order, adminStatusTab: result.adminStatusTab };
  }

  /**
   * @deprecated Prefer acquireEmailSendClaim with recipient. Kept for transitional callers.
   */
  async claimOrderNotification(
    orderId: string,
    notificationType: string,
    recipient = 'system'
  ): Promise<boolean> {
    if (!mongoose.Types.ObjectId.isValid(orderId)) return false;
    try {
      await OrderNotificationClaim.create({
        orderId: new mongoose.Types.ObjectId(orderId),
        emailEventType: String(notificationType || '').trim(),
        recipient: String(recipient || 'system').trim().toLowerCase(),
        status: 'pending',
        attemptCount: 0
      });
      return true;
    } catch (err: any) {
      if (err?.code === 11000) return false;
      throw err;
    }
  }

  async updateOrderStatusForDriver(
    orderId: string,
    driverUserId: string,
    status: string
  ): Promise<IOrder | null> {
    const nextStatus = String(status || '').trim().toLowerCase();
    const allowed = new Set(['out_for_delivery', 'delivered', 'delivery_failed']);
    if (!allowed.has(nextStatus)) {
      throw new Error('Driver status is not allowed');
    }

    const prior = await Order.findOne({
      _id: orderId,
      assignedDriverId: driverUserId,
      isDeleted: { $ne: true }
    })
      .select('status paymentStatus readyAt completedAt cancelledAt paidAt capturedAt')
      .lean();
    if (!prior) return null;

    const previousStatus = String((prior as any).status || '') || null;
    const now = new Date();
    const $set: Record<string, unknown> = { status: nextStatus };
    applyOpsStatusTimestamps({
      $set,
      previousStatus,
      nextStatus,
      prior: {
        readyAt: (prior as any).readyAt,
        completedAt: (prior as any).completedAt,
        cancelledAt: (prior as any).cancelledAt,
        paidAt: (prior as any).paidAt,
        capturedAt: (prior as any).capturedAt
      },
      now
    });

    const updateOps: Record<string, unknown> = { $set };
    if (previousStatus !== nextStatus) {
      updateOps.$push = {
        statusChangeHistory: {
          previousStatus: previousStatus || '',
          newStatus: nextStatus,
          previousPaymentStatus: String((prior as any).paymentStatus || '') || null,
          paymentExceptionResolution: null,
          changedBy: `driver:${driverUserId}`,
          changedAt: now,
          notificationSent: false
        }
      };
    }

    const updated = await Order.findOneAndUpdate(
      {
        _id: orderId,
        assignedDriverId: driverUserId,
        isDeleted: { $ne: true }
      },
      updateOps,
      { returnDocument: 'after' }
    )
      .select(ORDER_API_DETAIL_SELECT)
      .lean();
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
      .select(ORDER_API_DETAIL_SELECT)
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
    const updated = await Order.findByIdAndUpdate(orderId, { $set: set }, { returnDocument: 'after' })
      .select(ORDER_API_DETAIL_SELECT)
      .lean();
    return updated as IOrder | null;
  }

  /**
   * Update order items securely (Admin):
   * - Round-trips selectedOption / size / kitchen notes.
   * - Omitting selectedOption preserves the existing snapshot (does not wipe).
   * - Recalculates subtotal/totalPrice when payment is not gateway-locked
   *   (authorized/captured stay frozen; adminPriceOverride / catering rules apply).
   * - Never mutates paymentStatus or Tranzila fields.
   */
  async updateOrderItems(orderId: string, newItems: any[]): Promise<IOrder | null> {
    if (!Array.isArray(newItems) || newItems.length === 0) {
      throw new Error('items array is required and must not be empty');
    }

    const order = await Order.findById(orderId).lean();
    if (!order) return null;
    const existingItems = Array.isArray((order as any).items) ? ((order as any).items as any[]) : [];

    const findExistingForIncoming = (incoming: any, index: number) => {
      const pid = extractBaseProductId(incoming?.productId || incoming?.id);
      const inName = String(incoming?.name || '').trim();
      const atIndex = existingItems[index];
      if (atIndex) {
        const atPid = extractBaseProductId(atIndex?.productId);
        if (!pid || !atPid || atPid === pid) return atIndex;
      }
      if (pid) {
        const incomingFp = itemVariantFingerprint({
          productId: incoming?.productId || incoming?.id,
          name: incoming?.name,
          category: incoming?.category,
          selectedOption: incoming?.selectedOption
        });
        const byFingerprint = existingItems.find(
          (ex) =>
            extractBaseProductId(ex?.productId) === pid && itemVariantFingerprint(ex) === incomingFp
        );
        if (byFingerprint) return byFingerprint;

        const byIdAndName = existingItems.find(
          (ex) => extractBaseProductId(ex?.productId) === pid && String(ex?.name || '').trim() === inName
        );
        if (byIdAndName) return byIdAndName;

        const samePid = existingItems.filter((ex) => extractBaseProductId(ex?.productId) === pid);
        // Only safe when a single line shares the product — never collapse 250/500 twins.
        if (samePid.length === 1) return samePid[0];
        return null;
      }
      return existingItems.find((ex) => String(ex?.name || '').trim() === inName) || null;
    };

    const toStoredOption = (opt?: SelectedOptionSnapshot) => {
      if (!opt?.label && !opt?.amount) return undefined;
      return {
        label: opt.label,
        amount: opt.amount,
        price: opt.price,
        optionId: opt.optionId,
        optionName: opt.optionName,
        valueId: opt.valueId,
        valueName: opt.valueName,
        quantity: opt.quantity,
        priceAdjustment: opt.priceAdjustment,
        missingForReview: opt.missingForReview === true ? true : undefined
      };
    };

    const normalizedItems = await Promise.all(
      newItems.map(async (rawItem: any, index: number) => {
        const item = rawItem || {};
        const productIdRaw = String(item.productId || item.id || '').trim();
        const productName = String(item.name || '').trim();
        const quantity = Number(item.quantity);
        if (!Number.isFinite(quantity) || quantity <= 0) {
          throw new Error(`items[${index}].quantity must be a positive number`);
        }

        const existing = findExistingForIncoming(item, index);
        const hasSelectedOptionKey = Object.prototype.hasOwnProperty.call(item, 'selectedOption');
        let selectedOption = resolveSelectedOptionForUpdate({
          incoming: item,
          existing,
          hasSelectedOptionKey
        });

        // Recover option from composite cart id `…-size-N` when still missing.
        const sizeIdx = parseCompositeSizeIndex(productIdRaw);

        // Qty / kitchen-notes only: preserve name, price, and option snapshot exactly.
        if (existing && !hasSelectedOptionKey) {
          const description =
            item.description !== undefined
              ? String(item.description || '').trim()
              : String(existing?.description || '').trim();
          // Prefer existing structured option; else keep recovered snapshot from name/id.
          if (!selectedOption && sizeIdx != null) {
            // leave selectedOption for catalog path below when we have size index but no existing
          }
          if (selectedOption || existing.selectedOption || parseOptionFromItemName(existing.name).label) {
            const preservedOption =
              selectedOption ||
              normalizeSelectedOption(existing.selectedOption, {
                name: existing.name,
                price: existing.price
              });
            return {
              productId: String(existing.productId || productIdRaw || ''),
              name: String(existing.name || productName),
              price: Number(existing.price) || 0,
              quantity,
              category: String(existing.category || item.category || '').trim(),
              imageUrl: String(existing.imageUrl || item.imageUrl || '').trim(),
              description,
              selectedOption: toStoredOption(preservedOption)
            };
          }
        }

        if (!productIdRaw) {
          if (!productName) {
            throw new Error(`items[${index}] must have either productId or name`);
          }
          const freePrice = Number(item.price);
          const price =
            Number.isFinite(freePrice) && freePrice >= 0
              ? freePrice
              : Number(existing?.price) || 0;
          const description =
            item.description !== undefined
              ? String(item.description || '').trim()
              : String(existing?.description || '').trim();
          return {
            productId: '',
            name: productName,
            price,
            quantity,
            category: String(item.category || existing?.category || '').trim(),
            imageUrl: String(item.imageUrl || existing?.imageUrl || '').trim(),
            description,
            selectedOption: toStoredOption(selectedOption)
          };
        }

        if (isHolidayOrderProductId(productIdRaw)) {
          const holidayProduct = await resolveHolidayOrderProduct(productIdRaw, {
            name: productName,
            price: item.price,
            description: item.description,
            imageUrl: item.imageUrl,
            category: item.category
          });
          if (!holidayProduct) {
            throw new Error(`Holiday product not found for items[${index}] (id=${productIdRaw})`);
          }
          const authenticPrice = Number(holidayProduct.price);
          if (!Number.isFinite(authenticPrice) || authenticPrice < 0) {
            throw new Error(`Invalid holiday product price for items[${index}]`);
          }
          if (!selectedOption && item?.selectedOption?.label) {
            selectedOption = normalizeSelectedOption(item.selectedOption, {
              name: productName,
              price: authenticPrice
            });
          }
          const description =
            item.description !== undefined
              ? String(item.description || '').trim()
              : String(existing?.description || holidayProduct.description || '').trim();
          return {
            productId: productIdRaw,
            name: formatItemDisplayName(holidayProduct.name, selectedOption) || holidayProduct.name,
            price: authenticPrice,
            quantity,
            category: holidayProduct.category,
            selectedOption: toStoredOption(selectedOption),
            imageUrl: holidayProduct.imageUrl,
            description
          };
        }

        let lookupProductId = extractBaseProductId(productIdRaw) || productIdRaw;
        let product: any = null;

        const escapedRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const parsedName = parseOptionFromItemName(productName);
        const normalizedBaseName = parsedName.baseName || productName;

        const findByNameFallback = async () => {
          if (!productName && !normalizedBaseName) return null;
          const nameCandidates = [productName, normalizedBaseName].filter(Boolean);
          for (const candidate of nameCandidates) {
            const exact = await MenuItem.findOne({ name: candidate }).lean();
            if (exact) return exact;
          }
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
            product = await findByNameFallback();
            if (!product) {
              throw new Error(`Invalid product id format at items[${index}] (${productIdRaw})`);
            }
          }
        } else {
          product = await MenuItem.findById(lookupProductId).lean();
        }

        if (!product) {
          product = await findByNameFallback();
        }
        if (!product) {
          throw new Error(
            `Product not found for items[${index}] (id=${lookupProductId}${productName ? `, name=${productName}` : ''})`
          );
        }

        const pricingOptions = Array.isArray((product as any).pricingOptions)
          ? (product as any).pricingOptions
          : [];
        const pricingVariants = Array.isArray((product as any).pricingVariants)
          ? (product as any).pricingVariants
          : [];

        // From composite id size index
        if (!selectedOption && sizeIdx != null && pricingOptions[sizeIdx]) {
          const matchedOption = pricingOptions[sizeIdx];
          selectedOption = {
            label: String(matchedOption.label || '').trim(),
            amount: String(matchedOption.amount || '').trim() || undefined,
            price: Number(matchedOption.price),
            optionId: String(sizeIdx),
            optionName: String(matchedOption.label || '').trim() || undefined,
            valueName: String(matchedOption.amount || matchedOption.label || '').trim() || undefined
          };
        }

        let authenticPrice = Number((product as any).price);
        const requestedVariantLabel = String(
          selectedOption?.label || item?.selectedOption?.label || item?.variant || item?.size || ''
        ).trim();
        const requestedVariantAmount = String(
          selectedOption?.amount || item?.selectedOption?.amount || ''
        ).trim();

        if (requestedVariantLabel || requestedVariantAmount) {
          const matched = findMatchingPricingOption(pricingOptions, {
            label: requestedVariantLabel,
            amount: requestedVariantAmount
          });

          if (matched) {
            const matchedOption = matched.option;
            authenticPrice = Number(matchedOption.price);
            selectedOption = {
              label: String(matchedOption.label || requestedVariantLabel).trim(),
              amount:
                String(matchedOption.amount || requestedVariantAmount).trim() || undefined,
              price: authenticPrice,
              optionId: String(matched.index),
              optionName: String(matchedOption.label || requestedVariantLabel).trim(),
              valueName:
                String(matchedOption.amount || matchedOption.label || '').trim() || undefined
            };
          } else {
            const matchedVariant = findMatchingPricingVariant(pricingVariants, {
              label: requestedVariantLabel,
              amount: requestedVariantAmount
            });

            if (matchedVariant) {
              const variant = matchedVariant.option;
              authenticPrice = Number(variant.price);
              selectedOption = {
                label: String(variant.label || variant.size || requestedVariantLabel).trim(),
                amount: String(variant.size || requestedVariantAmount).trim() || undefined,
                price: authenticPrice,
                optionId: String(matchedVariant.index),
                optionName: String(variant.label || variant.size || '').trim() || undefined,
                valueName: String(variant.size || variant.label || '').trim() || undefined
              };
            } else if (selectedOption?.label || selectedOption?.amount) {
              // Menu changed / ambiguous catalog labels — keep the historical snapshot;
              // never invent the catalog minimum.
              selectedOption = {
                ...selectedOption,
                missingForReview: selectedOption.missingForReview ?? true
              };
              if (Number.isFinite(Number(selectedOption.price))) {
                authenticPrice = Number(selectedOption.price);
              } else if (Number.isFinite(Number(existing?.price))) {
                authenticPrice = Number(existing.price);
              }
            } else {
              throw new Error(
                `Variant "${requestedVariantLabel || requestedVariantAmount}" not found in DB for items[${index}] (product=${String(
                  (product as any).name || lookupProductId
                )})`
              );
            }
          }
        } else if (selectedOption?.label) {
          if (Number.isFinite(Number(selectedOption.price))) {
            authenticPrice = Number(selectedOption.price);
          }
        }

        if (!Number.isFinite(authenticPrice) || authenticPrice < 0) {
          throw new Error(`Invalid product price in DB for product ${lookupProductId}`);
        }

        const canonicalProductName = String((product as any).name || parsedName.baseName || item.name || '').trim();
        // Prefer the admin/customer display name when it already encodes a REAL size choice.
        // Product nicknames like (טירשי) must not count as size encoding.
        const incomingName = productName;
        const parsedIncoming = parseOptionFromItemName(incomingName);
        const nameAlreadyEncoded =
          !!selectedOption &&
          !!parsedIncoming.label &&
          looksLikeSizeToken(parsedIncoming.label) &&
          (!!selectedOption.label || !!selectedOption.amount) &&
          (amountsEquivalent(parsedIncoming.label, selectedOption.label) ||
            amountsEquivalent(parsedIncoming.amount, selectedOption.amount) ||
            amountsEquivalent(parsedIncoming.label, selectedOption.amount) ||
            (!!selectedOption.label && incomingName.includes(String(selectedOption.label))));
        const nameToSave = nameAlreadyEncoded
          ? incomingName
          : formatItemDisplayName(canonicalProductName, selectedOption) || canonicalProductName;

        const description =
          item.description !== undefined
            ? String(item.description || '').trim()
            : String(existing?.description || '').trim();

        const baseProductId = String((product as any)._id || lookupProductId);
        // Preserve composite `…-size-N` when stable; rewrite only when matched size disagrees.
        let productIdToSave = baseProductId;
        const existingPid = String(existing?.productId || '');
        const matchedSizeIdx =
          selectedOption?.optionId != null && /^\d+$/.test(String(selectedOption.optionId))
            ? Number(selectedOption.optionId)
            : sizeIdx;
        if (existingPid && extractBaseProductId(existingPid) === baseProductId) {
          const existingSize = parseCompositeSizeIndex(existingPid);
          if (
            matchedSizeIdx != null &&
            Number.isInteger(matchedSizeIdx) &&
            matchedSizeIdx >= 0 &&
            existingSize != null &&
            existingSize !== matchedSizeIdx
          ) {
            productIdToSave = `${baseProductId}-size-${matchedSizeIdx}`;
          } else {
            productIdToSave = existingPid;
          }
        } else if (
          matchedSizeIdx != null &&
          Number.isInteger(matchedSizeIdx) &&
          matchedSizeIdx >= 0 &&
          pricingOptions.length > 0
        ) {
          productIdToSave = `${baseProductId}-size-${matchedSizeIdx}`;
        }

        return {
          productId: productIdToSave,
          name: nameToSave,
          price: authenticPrice,
          quantity,
          category: String(item.category || (product as any).category || existing?.category || '').trim(),
          selectedOption: toStoredOption(selectedOption),
          imageUrl: String(item.imageUrl || (product as any).imageUrl || existing?.imageUrl || '').trim(),
          description
        };
      })
    );

    // Never mutate paymentStatus / Tranzila fields here.
    // Recalculate money fields when unlocked so admin item edits match the displayed total.
    const totals = computeAdminRecalculatedTotals(order as unknown as Record<string, unknown>, {
      items: normalizedItems
    });
    const $set: Record<string, unknown> = {
      items: normalizedItems
    };
    if (!totals.locked) {
      $set.subtotal = totals.subtotal;
      $set.totalPrice = totals.totalPrice;
      if (totals.deliveryFee !== undefined) {
        $set.deliveryFee = totals.deliveryFee;
      }
    }

    const updateResult = await Order.updateOne({ _id: orderId }, { $set });
    if (updateResult.matchedCount === 0) return null;

    try {
      const { appendKitchenChange } = await import('./kitchen-report.service');
      const summarizeItems = (rows: any[]) =>
        (rows || [])
          .map((it) => {
            const opt = it?.selectedOption?.label || it?.selectedOption?.amount || '';
            return `${it?.name || '?'}${opt ? `/${opt}` : ''}×${it?.quantity ?? 0}`;
          })
          .join('; ')
          .slice(0, 500);
      const moneyNote = totals.locked
        ? ' (סכום נעול — captured)'
        : ` (סה״כ → ₪${Number(totals.totalPrice).toFixed(2)}, מקור=${totals.source})`;
      await appendKitchenChange(
        orderId,
        'items',
        `עודכנו פריטים, כמויות או וריאציות בהזמנה${moneyNote}`,
        undefined,
        {
          previousValue: summarizeItems((order as any).items || []),
          newValue: summarizeItems(normalizedItems)
        }
      );
      const { onOrderKitchenRelevantChange } = await import('./kitchen-ops.service');
      await onOrderKitchenRelevantChange(orderId, {
        type: 'items',
        summary: `עודכנו פריטים, כמויות או וריאציות בהזמנה${moneyNote}`,
        previousValue: summarizeItems((order as any).items || []),
        newValue: summarizeItems(normalizedItems)
      });
    } catch {
      /* non-blocking */
    }

    const updated = await Order.findById(orderId).select(ORDER_API_DETAIL_SELECT).lean();
    return updated as IOrder | null;
  }

  /**
   * Admin: update retail order shipping (deliveryFee) and recalculate totalPrice.
   * totalPrice = itemsSubtotal + shippingCost - implicitDiscount (coupon / prior adjustment).
   */
  async updateOrderShippingCost(orderId: string, shippingCost: number): Promise<IOrder | null> {
    const order = await Order.findById(orderId).lean();
    if (!order) return null;

    if (
      (order as any).orderType === 'catering' ||
      (order as any).numberOfPortions ||
      (order as any).mealTime
    ) {
      throw new Error('Shipping cost cannot be updated for catering orders');
    }

    if (isGatewayLockedPaymentStatus((order as any).paymentStatus)) {
      throw new Error(
        'לא ניתן לשנות סכום הזמנה שחויבה סופית (captured) ללא מנגנון פיננסי מתאים'
      );
    }

    const newShipping = Math.round(Number(shippingCost) * 100) / 100;
    if (!Number.isFinite(newShipping) || newShipping < 0) {
      throw new Error('shippingCost must be a non-negative number');
    }

    const totals = computeAdminRecalculatedTotals(order as unknown as Record<string, unknown>, {
      deliveryFee: newShipping
    });

    const cd = (order.customerDetails || {}) as Record<string, unknown>;
    const customerDetails = {
      ...cd,
      deliveryFee: totals.deliveryFee,
      subtotal: totals.subtotal
    };

    const updateResult = await Order.updateOne(
      { _id: orderId },
      {
        $set: {
          deliveryFee: totals.deliveryFee,
          subtotal: totals.subtotal,
          totalPrice: totals.totalPrice,
          customerDetails
        }
      }
    );
    if (updateResult.matchedCount === 0) return null;

    const updated = await Order.findById(orderId).select(ORDER_API_DETAIL_SELECT).lean();
    return updated as IOrder | null;
  }

  /** Re-fetch order from DB for customer-facing emails (avoids stale embedded items). */
  async getOrderByIdForEmail(orderId: string): Promise<IOrder | null> {
    const order = await Order.findById(orderId).select(ORDER_API_DETAIL_SELECT).lean();
    return order as IOrder | null;
  }

  /** Admin: update Shabbat/holiday catering portion counts. */
  async updateOrderPortions(
    orderId: string,
    payload: { portionsEvening?: unknown; portionsMorning?: unknown }
  ): Promise<IOrder | null> {
    const order = await Order.findById(orderId).lean();
    if (!order) return null;

    const row = order as any;
    if (row.orderType !== 'catering' || row.cateringKind === 'events') {
      throw new Error('ניתן לעדכן כמויות רק להזמנות קייטרינג שבת/חג');
    }

    const parseNonNegativeInteger = (value: unknown, label: string): number => {
      if (value === undefined || value === null || value === '') {
        throw new Error(`${label} חייב להיות מספר שלם`);
      }
      const n = typeof value === 'number' ? value : parseInt(String(value).trim(), 10);
      if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
        throw new Error(`${label} חייב להיות מספר שלם שאינו שלילי`);
      }
      return n;
    };

    const mealTime = (row.mealTime as string) || 'both';
    let portionsEvening = parseNonNegativeInteger(payload.portionsEvening, 'כמות ערב');
    let portionsMorning = parseNonNegativeInteger(payload.portionsMorning, 'כמות בוקר');

    if (mealTime === 'evening') {
      portionsMorning = 0;
    } else if (mealTime === 'morning') {
      portionsEvening = 0;
    }

    const numberOfPortions = portionsEvening + portionsMorning;
    if (numberOfPortions <= 0) {
      throw new Error('יש להזין לפחות מנה אחת');
    }

    const prev = {
      evening: Number(row.portionsEvening) || 0,
      morning: Number(row.portionsMorning) || 0,
      total: Number(row.numberOfPortions) || 0
    };

    const totals = computeAdminRecalculatedTotals(order as unknown as Record<string, unknown>, {
      portionsEvening,
      portionsMorning,
      numberOfPortions
    });

    const $set: Record<string, unknown> = {
      portionsEvening,
      portionsMorning,
      numberOfPortions
    };
    if (!totals.locked) {
      $set.subtotal = totals.subtotal;
      $set.totalPrice = totals.totalPrice;
    }

    const updateResult = await Order.updateOne({ _id: orderId }, { $set });
    if (updateResult.matchedCount === 0) return null;

    try {
      const { appendKitchenChange } = await import('./kitchen-report.service');
      await appendKitchenChange(orderId, 'quantity', 'עודכנו כמויות מנות (portions)', undefined, {
        previousValue: `ערב=${prev.evening},בוקר=${prev.morning},סה״כ=${prev.total}`,
        newValue: `ערב=${portionsEvening},בוקר=${portionsMorning},סה״כ=${numberOfPortions}`
      });
      const { onOrderKitchenRelevantChange } = await import('./kitchen-ops.service');
      await onOrderKitchenRelevantChange(orderId, {
        type: 'quantity',
        summary: 'עודכנו כמויות מנות (portions)',
        previousValue: `ערב=${prev.evening},בוקר=${prev.morning},סה״כ=${prev.total}`,
        newValue: `ערב=${portionsEvening},בוקר=${portionsMorning},סה״כ=${numberOfPortions}`
      });
    } catch {
      /* non-blocking */
    }

    const updated = await Order.findById(orderId).select(ORDER_API_DETAIL_SELECT).lean();
    return updated as IOrder | null;
  }

  /**
   * Admin: set an explicit special price (adminPriceOverride*).
   * - pending/awaiting/failed/voided: also writes totalPrice (= override) as source of truth.
   * - authorized/captured: stores override for alerts/reports only — does NOT change totalPrice.
   */
  async setAdminPriceOverride(
    orderId: string,
    payload: { amount: unknown; reason?: unknown; adminUserId?: unknown }
  ): Promise<IOrder | null> {
    const order = await Order.findById(orderId).lean();
    if (!order) return null;

    const amount = Number(payload.amount);
    if (!Number.isFinite(amount) || amount < 0) {
      throw new Error('סכום המנהל חייב להיות מספר שאינו שלילי');
    }
    const reason = String(payload.reason ?? '').trim();
    if (!reason) {
      throw new Error('חובה לציין סיבה למחיר מיוחד');
    }
    if (reason.length > 500) {
      throw new Error('סיבת מחיר מיוחד ארוכה מדי');
    }

    const rounded = Math.round(amount * 100) / 100;
    const locked = isGatewayLockedPaymentStatus((order as any).paymentStatus);
    const $set: Record<string, unknown> = {
      adminPriceOverride: rounded,
      adminPriceOverrideReason: reason,
      priceOverriddenAt: new Date(),
      priceOverriddenBy: payload.adminUserId != null ? String(payload.adminUserId) : null
    };
    if (!locked) {
      $set.totalPrice = rounded;
      if (!(Number((order as any).subtotal) > 0)) {
        $set.subtotal = rounded;
      }
    }

    const updateResult = await Order.updateOne({ _id: orderId }, { $set });
    if (updateResult.matchedCount === 0) return null;

    const updated = await Order.findById(orderId).select(ORDER_API_DETAIL_SELECT).lean();
    return updated as IOrder | null;
  }

  /** Admin: clear admin price override (does not invent a new total — recalculates when unlocked). */
  async clearAdminPriceOverride(orderId: string): Promise<IOrder | null> {
    const order = await Order.findById(orderId).lean();
    if (!order) return null;

    const locked = isGatewayLockedPaymentStatus((order as any).paymentStatus);
    const cleared = {
      ...((order as unknown) as Record<string, unknown>),
      adminPriceOverride: null
    };
    const totals = computeAdminRecalculatedTotals(cleared);

    const $set: Record<string, unknown> = {
      adminPriceOverride: null,
      adminPriceOverrideReason: null,
      priceOverriddenAt: null,
      priceOverriddenBy: null
    };
    if (!locked) {
      $set.subtotal = totals.subtotal;
      $set.totalPrice = totals.totalPrice;
    }

    const updateResult = await Order.updateOne({ _id: orderId }, { $set });
    if (updateResult.matchedCount === 0) return null;
    const updated = await Order.findById(orderId).select(ORDER_API_DETAIL_SELECT).lean();
    return updated as IOrder | null;
  }

  /** Admin: update internal order notes without touching customerDetails.notes. */
  async updateOrderAdminNotes(orderId: string, adminNotes: unknown): Promise<IOrder | null> {
    const validation = validateAdminNotesPayload(adminNotes);
    if (validation.ok === false) {
      throw new Error(validation.message);
    }

    const updateResult = await Order.updateOne({ _id: orderId }, { $set: { adminNotes: validation.adminNotes } });
    if (updateResult.matchedCount === 0) return null;

    const updated = await Order.findById(orderId).select(ORDER_API_DETAIL_SELECT).lean();
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
      const prior = await Order.findById(orderId).select('customerDetails.eventDate serviceDate').lean();
      if (!prior) return null;
      const previousDate = String((prior as any)?.customerDetails?.eventDate || '').slice(0, 10);
      const serviceDate = parseServiceDateFromEventDate(dateStr);

      const updateResult = await Order.updateOne(
        { _id: orderId },
        {
          $set: {
            'customerDetails.eventDate': dateStr,
            ...(serviceDate ? { serviceDate } : {})
          }
        }
      );
      if (updateResult.matchedCount === 0) return null;

      try {
        const { appendKitchenChange } = await import('./kitchen-report.service');
        await appendKitchenChange(orderId, 'delivery', `עודכן מועד אספקה ל-${dateStr}`, undefined, {
          previousValue: previousDate,
          newValue: dateStr
        });
        const { onOrderKitchenRelevantChange } = await import('./kitchen-ops.service');
        await onOrderKitchenRelevantChange(orderId, {
          type: 'delivery',
          summary: `עודכן מועד אספקה ל-${dateStr}`,
          previousValue: previousDate,
          newValue: dateStr
        });
      } catch {
        /* non-blocking */
      }

      const updated = await Order.findById(orderId).select(ORDER_API_DETAIL_SELECT).lean();
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

    const activeQuery = {
      isDeleted: { $ne: true },
      paymentStatus: { $nin: ['failed', 'awaiting_payment'] as const }
    };
    const { sumActualRevenueInRange } = await import('./business-metrics.service');
    const [pendingCount, eventsTodayCount, monthly] = await Promise.all([
      Order.countDocuments({ ...activeQuery, status: { $in: ['pending', 'new'] } }),
      Order.countDocuments({ ...activeQuery, 'customerDetails.eventDate': todayStr }),
      sumActualRevenueInRange(startOfMonth, endOfMonth)
    ]);

    return {
      pendingCount,
      eventsTodayCount,
      monthlyRevenue: monthly.revenue
    };
  }

  // Get order statistics
  async getOrderStatistics(period: string = 'month'): Promise<any> {
    try {
      const { resolveBusinessMetricsRange, buildActualRevenueMatch, createdAtRangeMatch } =
        await import('../utils/business-metrics.util');
      const preset =
        period === 'week' ? 'week' : period === 'year' ? 'year' : period === 'month' ? 'last30' : 'last30';
      const range = resolveBusinessMetricsRange({ preset });

      const totalOrders = await Order.countDocuments({
        isTestOrder: { $ne: true },
        ...createdAtRangeMatch(range.from, range.to)
      });

      const { sumActualRevenueInRange } = await import('./business-metrics.service');
      const revenue = await sumActualRevenueInRange(range.from, range.to);

      const ordersByStatus = await Order.aggregate([
        {
          $match: {
            isTestOrder: { $ne: true },
            ...createdAtRangeMatch(range.from, range.to)
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
        totalRevenue: revenue.revenue,
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
        .select(ORDER_ADMIN_LIST_SELECT)
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
  // Soft delete: set isDeleted = true (only delivered or cancelled)
  async deleteOrder(orderId: string): Promise<IOrder | null> {
    try {
      const prior = await Order.findById(orderId).select('status isDeleted').lean();
      if (!prior) return null;
      if (!canArchiveOrderByStatus((prior as any).status)) {
        const err = new Error(
          'ניתן לארכב רק הזמנות שנמסרו (delivered) או שבוטלו (cancelled)'
        ) as Error & { statusCode: number; code: string };
        err.statusCode = 422;
        err.code = 'ARCHIVE_STATUS_NOT_ALLOWED';
        throw err;
      }

      const order = await Order.findByIdAndUpdate(
        orderId,
        { $set: { isDeleted: true } },
        { returnDocument: 'after' }
      )
        .select(ORDER_API_DETAIL_SELECT)
        .lean();
      if (order) {
        try {
          const { appendKitchenChange } = await import('./kitchen-report.service');
          await appendKitchenChange(orderId, 'cancelled', 'הזמנה נמחקה (soft delete)', undefined, {
            previousValue: 'active',
            newValue: 'isDeleted'
          });
          const { onOrderKitchenRelevantChange } = await import('./kitchen-ops.service');
          await onOrderKitchenRelevantChange(orderId, {
            type: 'soft_delete',
            summary: 'הזמנה נמחקה (soft delete)',
            previousValue: 'active',
            newValue: 'isDeleted'
          });
        } catch {
          /* non-blocking */
        }
      }
      return order as IOrder | null;
    } catch (error: any) {
      if (error?.statusCode === 422 || error?.code === 'ARCHIVE_STATUS_NOT_ALLOWED') {
        throw error;
      }
      console.error('Error deleting order:', error);
      throw error;
    }
  }

  // Restore order: set isDeleted = false only (preserve status, payment, timestamps)
  async restoreOrder(orderId: string): Promise<IOrder | null> {
    try {
      const prior = await Order.findById(orderId).select('status').lean();
      const order = await Order.findByIdAndUpdate(
        orderId,
        { $set: { isDeleted: false } },
        { returnDocument: 'after' }
      )
        .select(ORDER_API_DETAIL_SELECT)
        .lean();
      if (order) {
        try {
          const { appendKitchenChange } = await import('./kitchen-report.service');
          await appendKitchenChange(orderId, 'other', 'הזמנה שוחזרה מארכיון', undefined, {
            previousValue: 'isDeleted',
            newValue: String((prior as any)?.status || (order as any).status || '')
          });
          const { onOrderKitchenRelevantChange } = await import('./kitchen-ops.service');
          await onOrderKitchenRelevantChange(orderId, {
            type: 'restored',
            summary: 'הזמנה שוחזרה מארכיון — הסטטוס נשמר',
            previousValue: 'isDeleted',
            newValue: String((order as any).status || '')
          });
        } catch {
          /* non-blocking */
        }
      }
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
    paymentExceptionResolution?: unknown;
    manualPaymentMethod?: string;
    manualPaymentNote?: string;
    changedBy?: string;
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

        // Block bulk move into ops statuses when any selected order has an open payment exception
        // without an explicit resolution (same rule as single-order API).
        if (isOpsStatusRequiringExceptionResolution(status)) {
          const openExceptions = await Order.countDocuments({
            _id: { $in: objectIds },
            paymentStatus: { $in: ['failed', 'awaiting_payment'] },
            $or: [
              { paymentExceptionResolvedAt: null },
              { paymentExceptionResolvedAt: { $exists: false } }
            ]
          });
          if (openExceptions > 0 && !normalizePaymentExceptionResolution((input as any).paymentExceptionResolution)) {
            const err = new Error(
              'נדרשת בחירת אופן טיפול בחריגת התשלום לפני העברה קבוצתית לסטטוס תפעולי'
            ) as Error & { statusCode: number; code: string };
            err.statusCode = 422;
            err.code = 'PAYMENT_EXCEPTION_RESOLUTION_REQUIRED';
            throw err;
          }
        }

        // Apply per-order so status + resolution stay atomic (no partial split state).
        let modifiedCount = 0;
        const changedBy = String((input as any).changedBy || 'admin').trim() || 'admin';
        for (const id of uniqueIds) {
          const result = await this.updateOrderStatus(
            id,
            {
              status,
              paymentExceptionResolution: (input as any).paymentExceptionResolution,
              manualPaymentMethod: (input as any).manualPaymentMethod,
              manualPaymentNote: (input as any).manualPaymentNote
            },
            { changedBy, notificationSent: false }
          );
          if (result.order) modifiedCount += 1;
        }
        return {
          matchedCount: uniqueIds.length,
          modifiedCount,
          deletedCount: 0
        };
      }
      case 'archive': {
        const notAllowed = await Order.countDocuments({
          _id: { $in: objectIds },
          status: { $nin: ['delivered', 'cancelled'] }
        });
        if (notAllowed > 0) {
          const err = new Error(
            'ניתן לארכב רק הזמנות שנמסרו (delivered) או שבוטלו (cancelled)'
          ) as Error & { statusCode: number; code: string };
          err.statusCode = 422;
          err.code = 'ARCHIVE_STATUS_NOT_ALLOWED';
          throw err;
        }
        const result = await Order.updateMany(baseFilter, { $set: { isDeleted: true } });
        return {
          matchedCount: Number(result.matchedCount || 0),
          modifiedCount: Number(result.modifiedCount || 0),
          deletedCount: 0
        };
      }
      case 'restore': {
        const result = await Order.updateMany(baseFilter, {
          $set: { isDeleted: false }
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
        .select(ORDER_ADMIN_LIST_SELECT)
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
      const {
        buildActualRevenueInRangeMatch,
        effectivePaidAtMongoExpr,
        revenueAmountMongoExpr
      } = await import('../utils/order-actual-revenue.util');
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const now = new Date();

      const revenueStats = await Order.aggregate([
        {
          $match: buildActualRevenueInRangeMatch(sevenDaysAgo, now)
        },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: effectivePaidAtMongoExpr() }
            },
            total: { $sum: revenueAmountMongoExpr() }
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
      const {
        buildActualRevenueMatch,
        buildActualRevenueInRangeMatch,
        revenueAmountMongoExpr
      } = await import('../utils/order-actual-revenue.util');
      // includeArchived ignored — isDeleted does not affect actual revenue (SSOT).
      void filters?.includeArchived;
      let match: Record<string, any>;
      if (filters?.startDate && filters?.endDate) {
        match = buildActualRevenueInRangeMatch(filters.startDate, filters.endDate);
      } else if (filters?.startDate || filters?.endDate) {
        const { effectivePaidAtMongoExpr } = await import('../utils/order-actual-revenue.util');
        match = {
          $and: [
            buildActualRevenueMatch(),
            {
              $expr: {
                $and: [
                  ...(filters.startDate
                    ? [{ $gte: [effectivePaidAtMongoExpr(), filters.startDate] }]
                    : []),
                  ...(filters.endDate
                    ? [{ $lte: [effectivePaidAtMongoExpr(), filters.endDate] }]
                    : [])
                ]
              }
            }
          ]
        };
      } else {
        match = buildActualRevenueMatch();
      }

      const rows = await Order.aggregate([
        { $match: match },
        {
          $project: {
            amount: revenueAmountMongoExpr(),
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
            totalRevenue: { $sum: '$amount' },
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
      const {
        buildActualRevenueMatch,
        buildActualRevenueInRangeMatch,
        effectivePaidAtMongoExpr,
        revenueAmountMongoExpr
      } = await import('../utils/order-actual-revenue.util');
      void filters?.includeArchived;
      let match: Record<string, any>;
      if (filters?.startDate && filters?.endDate) {
        match = buildActualRevenueInRangeMatch(filters.startDate, filters.endDate);
      } else if (filters?.startDate || filters?.endDate) {
        match = {
          $and: [
            buildActualRevenueMatch(),
            {
              $expr: {
                $and: [
                  ...(filters.startDate
                    ? [{ $gte: [effectivePaidAtMongoExpr(), filters.startDate] }]
                    : []),
                  ...(filters.endDate
                    ? [{ $lte: [effectivePaidAtMongoExpr(), filters.endDate] }]
                    : [])
                ]
              }
            }
          ]
        };
      } else {
        match = buildActualRevenueMatch();
      }

      const rows = await Order.aggregate([
        { $match: match },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m', date: effectivePaidAtMongoExpr() }
            },
            totalRevenue: { $sum: revenueAmountMongoExpr() },
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
        orderNumber: (order as any).orderNumber || null,
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
