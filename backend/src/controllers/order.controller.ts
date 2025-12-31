import { Request, Response } from 'express';
import { OrderService } from '../services/order.service';
import { asyncHandler, createValidationError, createNotFoundError } from '../middleware/errorHandler';
import { CreateOrderRequest } from '../models/order.model';

export class OrderController {
  private orderService: OrderService;

  constructor() {
    this.orderService = new OrderService();
  }

  // Submit new order (checkout)
  submitOrder = asyncHandler(async (req: Request, res: Response) => {
    const orderData: CreateOrderRequest = req.body;

    // Extract userId from token if authenticated (optional - allows guest orders)
    const userId = (req as any).user ? (req as any).user._id : null;

    // Basic validation
    if (!orderData.customerName || !orderData.phone || !orderData.items || orderData.items.length === 0) {
      throw createValidationError('Customer name, phone, and items are required');
    }

    // Validate phone number format
    const phoneRegex = /^0\d{1,2}-?\d{7}$|^0\d{9}$/;
    if (!phoneRegex.test(orderData.phone.replace(/\s/g, ''))) {
      throw createValidationError('Please provide a valid Israeli phone number');
    }

    // Validate email if provided
    if (orderData.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(orderData.email)) {
        throw createValidationError('Please provide a valid email address');
      }
    }

    // Validate items
    for (const item of orderData.items) {
      if (!item.id || !item.name || !item.quantity || !item.price) {
        throw createValidationError('Each item must have id, name, quantity, and price');
      }
      
      if (item.quantity <= 0) {
        throw createValidationError('Item quantity must be greater than 0');
      }
      
      if (item.price <= 0) {
        throw createValidationError('Item price must be greater than 0');
      }
    }

    // Validate guest count if provided
    if (orderData.guestCount !== undefined && orderData.guestCount <= 0) {
      throw createValidationError('Guest count must be greater than 0');
    }

    // Pass userId to service (null for guest orders)
    const response = await this.orderService.submitOrder(orderData, userId);

    res.status(201).json({
      success: true,
      data: response,
      message: 'Order submitted successfully',
      timestamp: new Date().toISOString()
    });
  });

  // Get user's own orders (Customer)
  getMyOrders = asyncHandler(async (req: Request, res: Response) => {
    // This route requires authentication (userId will be in req.user)
    const userId = (req as any).user?._id;
    
    if (!userId) {
      throw createValidationError('User authentication required');
    }

    const orders = await this.orderService.getOrdersByUserId(userId.toString());

    res.status(200).json({
      success: true,
      data: orders,
      count: orders.length,
      timestamp: new Date().toISOString()
    });
  });

  // Get all orders (Admin only)
  getAllOrders = asyncHandler(async (req: Request, res: Response) => {
    const { status, limit, offset, startDate, endDate } = req.query;
    
    const filters = {
      status: status as any,
      limit: limit ? parseInt(limit as string, 10) : 50,
      offset: offset ? parseInt(offset as string, 10) : 0,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined
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

  // Get order by ID
  getOrderById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    if (!id) {
      throw createValidationError('Order ID is required');
    }

    const order = await this.orderService.getOrderById(id);

    if (!order) {
      throw createNotFoundError('Order');
    }

    res.status(200).json({
      success: true,
      data: order,
      timestamp: new Date().toISOString()
    });
  });

  // Update order status (Admin only)
  updateOrderStatus = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status, deliveryDate, notes } = req.body;

    if (!id) {
      throw createValidationError('Order ID is required');
    }

    if (!status) {
      throw createValidationError('Status is required');
    }

    const validStatuses = ['new', 'in-progress', 'ready', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      throw createValidationError('Invalid status value');
    }

    const updatedOrder = await this.orderService.updateOrderStatus(id, {
      status,
      deliveryDate: deliveryDate ? new Date(deliveryDate) : undefined,
      notes
    });

    if (!updatedOrder) {
      throw createNotFoundError('Order');
    }

    res.status(200).json({
      success: true,
      data: updatedOrder,
      message: 'Order status updated successfully',
      timestamp: new Date().toISOString()
    });
  });

  // Get order statistics (Admin only)
  getOrderStatistics = asyncHandler(async (req: Request, res: Response) => {
    const { period } = req.query; // 'week', 'month', 'year'
    const stats = await this.orderService.getOrderStatistics(period as string);

    res.status(200).json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });
  });

  // Get recent orders (Admin only)
  getRecentOrders = asyncHandler(async (req: Request, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 10;
    const recentOrders = await this.orderService.getRecentOrders(limit);

    res.status(200).json({
      success: true,
      data: recentOrders,
      count: recentOrders.length,
      timestamp: new Date().toISOString()
    });
  });

  // Delete order (Admin only)
  deleteOrder = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    if (!id) {
      throw createValidationError('Order ID is required');
    }

    const deleted = await this.orderService.deleteOrder(id);

    if (!deleted) {
      throw createNotFoundError('Order');
    }

    res.status(200).json({
      success: true,
      message: 'Order deleted successfully',
      timestamp: new Date().toISOString()
    });
  });

  // Search orders (Admin only)
  searchOrders = asyncHandler(async (req: Request, res: Response) => {
    const { q } = req.query;

    if (!q || typeof q !== 'string') {
      throw createValidationError('Search query is required');
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
}
