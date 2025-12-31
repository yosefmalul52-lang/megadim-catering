import { v4 as uuidv4 } from 'uuid';
import { CreateOrderRequest, OrderResponse, UpdateOrderRequest } from '../models/order.model';
const Order = require('../models/Order');

interface OrderFilters {
  status?: string;
  limit?: number;
  offset?: number;
  startDate?: Date;
  endDate?: Date;
}

export class OrderService {
  constructor() {
    // Service now uses MongoDB via Mongoose
  }


  // Submit new order
  async submitOrder(orderData: CreateOrderRequest, userId?: string | null): Promise<OrderResponse> {
    // Calculate total amount
    const totalAmount = orderData.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    // Transform items to match OrderItemSchema (snapshot format)
    const orderItems = orderData.items.map(item => ({
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      selectedOption: (item as any).selectedOption || undefined,
      imageUrl: (item as any).imageUrl || undefined,
      description: (item as any).description || undefined
    }));

    // Create order document
    const newOrder = new Order({
      userId: userId || undefined, // Link to user if authenticated, null for guests
      customerDetails: {
        fullName: orderData.customerName,
        phone: orderData.phone,
        email: orderData.email || undefined,
        address: orderData.deliveryAddress || undefined,
        notes: orderData.notes || undefined
      },
      items: orderItems,
      totalPrice: totalAmount,
      status: 'new'
    });

    const savedOrder = await newOrder.save();

    console.log(`📦 New order submitted by ${savedOrder.customerDetails.fullName} (${savedOrder.customerDetails.phone})`);
    console.log(`Order ID: ${savedOrder._id}, Total: ₪${savedOrder.totalPrice}`);
    console.log(`Items: ${savedOrder.items.map((item: any) => `${item.name} x${item.quantity}`).join(', ')}`);

    return {
      success: true,
      orderId: savedOrder._id.toString(),
      message: 'הזמנתך התקבלה בהצלחה! נחזור אליך בהקדם לאישור הפרטים.',
      estimatedDelivery: 'תיאום טלפוני',
      totalAmount: savedOrder.totalPrice
    };
  }

  // Get all orders with filtering and pagination
  async getAllOrders(filters: OrderFilters = {}): Promise<{
    orders: any[];
    total: number;
  }> {
    // Build query
    const query: any = {};

    // Filter by status
    if (filters.status) {
      query.status = filters.status;
    }

    // Filter by date range
    if (filters.startDate || filters.endDate) {
      query.createdAt = {};
      if (filters.startDate) {
        query.createdAt.$gte = filters.startDate;
      }
      if (filters.endDate) {
        query.createdAt.$lte = filters.endDate;
      }
    }

    // Get total count
    const total = await Order.countDocuments(query);

    // Apply pagination and sorting
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;

    const orders = await Order.find(query)
      .sort({ createdAt: -1 }) // Newest first
      .limit(limit)
      .skip(offset)
      .lean(); // Return plain JavaScript objects

    return {
      orders,
      total
    };
  }

  // Get order by ID
  async getOrderById(id: string): Promise<any | null> {
    const order = await Order.findById(id).lean();
    return order || null;
  }

  // Update order status
  async updateOrderStatus(id: string, updateData: UpdateOrderRequest): Promise<any | null> {
    // Map status from old format to new format if needed
    const statusMap: { [key: string]: string } = {
      'pending': 'new',
      'confirmed': 'in-progress',
      'preparing': 'in-progress',
      'ready': 'ready',
      'delivered': 'delivered',
      'cancelled': 'cancelled'
    };

    const updateFields: any = {};
    if (updateData.status) {
      updateFields.status = statusMap[updateData.status] || updateData.status;
    }

    const updatedOrder = await Order.findByIdAndUpdate(
      id,
      { $set: updateFields },
      { new: true, runValidators: true }
    ).lean();

    if (updatedOrder) {
      console.log(`📝 Order ${id} status updated to ${updateFields.status || updateData.status}`);
    }

    return updatedOrder || null;
  }

  // Delete order
  async deleteOrder(id: string): Promise<boolean> {
    const result = await Order.findByIdAndDelete(id);
    
    if (result) {
      console.log(`🗑️ Order ${id} deleted`);
      return true;
    }
    
    return false;
  }

  // Get order statistics
  async getOrderStatistics(period?: string): Promise<{
    totalOrders: number;
    totalRevenue: number;
    averageOrderValue: number;
    ordersByStatus: { [status: string]: number };
    revenueByStatus: { [status: string]: number };
    popularItems: Array<{ name: string; quantity: number; revenue: number }>;
    periodData?: Array<{ date: string; orders: number; revenue: number }>;
  }> {
    // Build date filter if period specified
    const dateFilter: any = {};
    if (period) {
      const now = new Date();
      let startDate: Date;

      switch (period) {
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case 'year':
          startDate = new Date(now.getFullYear(), 0, 1);
          break;
        default:
          startDate = new Date(0); // All time
      }
      dateFilter.createdAt = { $gte: startDate };
    }

    const filteredOrders = await Order.find(dateFilter).lean();

    const totalOrders = filteredOrders.length;
    const totalRevenue = filteredOrders.reduce((sum: number, order: any) => sum + (order.totalPrice || 0), 0);
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Count orders by status
    const ordersByStatus: { [status: string]: number } = {};
    const revenueByStatus: { [status: string]: number } = {};
    
    filteredOrders.forEach((order: any) => {
      const status = order.status || 'new';
      ordersByStatus[status] = (ordersByStatus[status] || 0) + 1;
      revenueByStatus[status] = (revenueByStatus[status] || 0) + (order.totalPrice || 0);
    });

    // Calculate popular items
    const itemStats: { [itemName: string]: { quantity: number; revenue: number } } = {};
    
    filteredOrders.forEach((order: any) => {
      if (order.items && Array.isArray(order.items)) {
        order.items.forEach((item: any) => {
          const itemName = item.name || 'Unknown';
          if (!itemStats[itemName]) {
            itemStats[itemName] = { quantity: 0, revenue: 0 };
          }
          itemStats[itemName].quantity += item.quantity || 0;
          itemStats[itemName].revenue += (item.price || 0) * (item.quantity || 0);
        });
      }
    });

    const popularItems = Object.entries(itemStats)
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);

    return {
      totalOrders,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      averageOrderValue: Math.round(averageOrderValue * 100) / 100,
      ordersByStatus,
      revenueByStatus,
      popularItems
    };
  }

  // Get recent orders
  async getRecentOrders(limit: number = 10): Promise<any[]> {
    return await Order.find({})
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
  }

  // Search orders
  async searchOrders(query: string): Promise<any[]> {
    const searchTerm = query.toLowerCase();
    const regex = new RegExp(searchTerm, 'i');
    
    return await Order.find({
      $or: [
        { 'customerDetails.fullName': regex },
        { 'customerDetails.phone': regex },
        { 'customerDetails.email': regex },
        { 'customerDetails.address': regex },
        { 'customerDetails.notes': regex },
        { 'items.name': regex }
      ]
    })
      .sort({ createdAt: -1 })
      .lean();
  }

  // Get orders by user ID (for customer order history)
  async getOrdersByUserId(userId: string): Promise<any[]> {
    return await Order.find({ userId: userId })
      .sort({ createdAt: -1 }) // Newest first
      .lean();
  }
}
