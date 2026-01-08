import Order, { IOrder } from '../models/Order';
import { CreateOrderRequest, OrderResponse } from '../models/order.model';
import { EmailService } from './email.service';

export class OrderService {
  // Categories that should only show units, not calculated weight
  private readonly UNIT_ONLY_CATEGORIES = ['דגים', 'מנות עיקריות', 'Fish', 'Main Courses'];
  private emailService: EmailService;

  constructor() {
    this.emailService = new EmailService();
  }

  // Submit a new order
  async submitOrder(orderData: CreateOrderRequest, userId: string | null = null): Promise<OrderResponse> {
    try {
      console.log('📝 OrderService: Creating order for user:', userId || 'Guest');
      console.log('📝 OrderService: Order data:', JSON.stringify(orderData, null, 2));

      // Map items to include category if missing
      const orderItems = orderData.items.map(item => {
        // If category is missing, try to detect it from the item name
        let category = (item as any).category;
        if (!category || category.trim() === '') {
          category = this.detectCategoryFromName(item.name);
        }

        return {
          productId: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          category: category // Include category for kitchen report
        };
      });

      // Calculate total price
      const totalPrice = orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

      // Create order document
      const order = new Order({
        userId: userId || null, // null for guest orders
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

      // Send order email to owner immediately after save
      try {
        await this.emailService.sendOrderEmail(savedOrder);
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

  // Get all orders with filters (Admin)
  async getAllOrders(filters: {
    status?: string;
    limit?: number;
    offset?: number;
    startDate?: Date;
    endDate?: Date;
  }): Promise<{ orders: IOrder[]; total: number }> {
    try {
      const query: any = {};

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
        .sort({ createdAt: -1 })
        .limit(filters.limit || 50)
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

  // Get order by ID (with user verification)
  async getOrderById(orderId: string, userId: string): Promise<IOrder | null> {
    try {
      const order = await Order.findOne({
        _id: orderId,
        userId: userId
      }).lean();

      return order as IOrder | null;
    } catch (error: any) {
      console.error('Error fetching order by ID:', error);
      throw error;
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
  async deleteOrder(orderId: string): Promise<boolean> {
    try {
      const result = await Order.findByIdAndDelete(orderId);
      return !!result;
    } catch (error: any) {
      console.error('Error deleting order:', error);
      throw error;
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

  // Get kitchen preparation report - using aggregation pipeline with $lookup (like Order Management dashboard)
  // Uses Mongoose aggregation to populate product details, ensuring exact same data structure
  async getKitchenReport(): Promise<{ 
    productName: string;
    category: string;
    totalPackages: number; 
    totalWeightRaw: number; 
    displayWeight: string;
    unit?: string;
    isUnitOnly?: boolean; // Flag to indicate if this category should show units only
  }[]> {
    try {
      // Active order statuses - include all variations
      const activeStatuses = ['new', 'in-progress', 'ready', 'accepted', 'processing', 'בטיפול', 'חדש', 'New'];
      
      console.log('🔍 OrderService: Starting kitchen report with aggregation pipeline');
      console.log('🔍 OrderService: Filtering by statuses:', activeStatuses);

      // Use aggregation pipeline with $lookup to populate product details
      const aggregationResult: any[] = await Order.aggregate([
        // Step 1: Match active orders
        {
          $match: {
            status: { $in: activeStatuses }
          }
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
      const itemsWithoutProduct = aggregationResult.filter((item: any) => !item.hasProductDetails);
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
      const kitchenReportItems: Array<{
        productName: string;
        category: string;
        totalPackages: number;
        totalWeightRaw: number;
        displayWeight: string;
        unit?: string;
        isUnitOnly: boolean;
      }> = [];

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
        } catch (itemError: any) {
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
          if (categoryAIndex === -1) return 1;
          if (categoryBIndex === -1) return -1;
          return categoryAIndex - categoryBIndex;
        }
        return a.productName.localeCompare(b.productName);
      });

      const kitchenReport = kitchenReportItems;

      console.log('🍳 OrderService: Kitchen report generated:', JSON.stringify(kitchenReport, null, 2));
      console.log('🍳 OrderService: Report items count:', kitchenReport.length);

      return kitchenReport;
    } catch (error: any) {
      console.error('❌ Error generating kitchen report:', error);
      console.error('❌ Error stack:', error.stack);
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

  // Get delivery/dispatch report - group active orders by city
  async getDeliveryReport(): Promise<{ city: string; orders: any[] }[]> {
    try {
      console.log('🚚 Fetching Delivery Report...');
      
      // Relax the Status Filter: Include ALL statuses except 'Cancelled'
      // Query: { status: { $ne: 'cancelled' } } (Show everything active/completed)
      const query = {
        status: { $ne: 'cancelled' }
      };
      
      console.log('🚚 OrderService: Starting delivery report generation');
      console.log('🚚 OrderService: Query filter:', JSON.stringify(query));

      // Find all orders except cancelled
      const activeOrders = await Order.find(query).lean();

      console.log('Found orders:', activeOrders.length);
      
      if (activeOrders.length === 0) {
        console.log('⚠️ No orders found (excluding cancelled)');
        return [];
      }
      
      // Log sample order structure for debugging
      if (activeOrders.length > 0) {
        console.log('🚚 Sample order structure:', JSON.stringify(activeOrders[0], null, 2));
      }

      // Group orders by city
      const cityMap: { [key: string]: any[] } = {};

      for (const order of activeOrders) {
        // Extract city from customerDetails or deliveryDetails
        // Try multiple possible locations for city
        // Ensure the code doesn't crash if deliveryDetails is undefined
        const customerDetails = (order as any).customerDetails || {};
        const deliveryDetails = customerDetails.deliveryDetails || {};
        
        console.log('🚚 Processing order:', (order as any)._id);
        console.log('🚚 Order customerDetails:', JSON.stringify(customerDetails, null, 2));
        console.log('🚚 Order deliveryDetails:', JSON.stringify(deliveryDetails, null, 2));
        
        // Get city from various possible locations
        let city = deliveryDetails?.city || 
                   customerDetails.city || 
                   customerDetails.deliveryCity ||
                   null;

        // If city is not found, try to extract from address
        if (!city && customerDetails.address) {
          // Simple extraction: try to get city from address string
          // This is a fallback - ideally city should be stored separately
          const addressParts = customerDetails.address.split(',').map((p: string) => p.trim());
          // Assume last part might be city, or look for common city patterns
          city = addressParts[addressParts.length - 1] || null;
          console.log('🚚 Extracted city from address:', city);
        }

        // Normalize city name (trim whitespace, handle case variations)
        if (city) {
          city = city.trim();
          // Optional: normalize common variations (e.g., "Haifa" vs "חיפה")
          // For now, just use as-is
        } else {
          // Handle missing cities: If order.deliveryDetails.city is missing/null, 
          // group it under 'כללי / איסוף עצמי' (General/Pickup)
          city = 'כללי / איסוף עצמי';
          console.log('🚚 No city found, using default:', city);
        }

        // Create order summary with only necessary info
        const orderSummary = {
          _id: (order as any)._id.toString(),
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

        // Add to city group
        if (!cityMap[city]) {
          cityMap[city] = [];
        }
        cityMap[city].push(orderSummary);
      }

      // Convert map to array format
      const report = Object.keys(cityMap).map(city => ({
        city: city,
        orders: cityMap[city]
      }));

      // Sort by city name
      report.sort((a, b) => a.city.localeCompare(b.city));

      console.log('🚚 OrderService: Delivery report generated:', report.length, 'cities');
      console.log('🚚 OrderService: Sample report:', JSON.stringify(report.slice(0, 2), null, 2));

      return report;
    } catch (error: any) {
      console.error('❌ Error generating delivery report:', error);
      console.error('❌ Error stack:', error.stack);
      throw new Error(`Failed to generate delivery report: ${error.message}`);
    }
  }
}
