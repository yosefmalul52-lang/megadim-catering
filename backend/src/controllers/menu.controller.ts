import { Request, Response } from 'express';
import { asyncHandler, createNotFoundError, createValidationError } from '../middleware/errorHandler';
import MenuItem from '../models/menuItem';
export class MenuController {

  // Get all menu items
  getAllMenuItems = asyncHandler(async (req: Request, res: Response) => {
    const { category, tag, available, popular } = req.query;
    
    // Build MongoDB query
    const query: any = {};
    
    if (category) {
      query.category = category;
    }
    
    if (tag) {
      query.tags = { $in: [tag] };
    }
    
    if (available !== undefined) {
      query.isAvailable = available === 'true';
    }
    
    if (popular !== undefined) {
      query.isPopular = popular === 'true';
    }
    
    const menuItems = await MenuItem.find(query);

    res.status(200).json({
      success: true,
      data: menuItems,
      count: menuItems.length,
      timestamp: new Date().toISOString()
    });
  });

  // Get menu item by ID
  getMenuItemById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    if (!id) {
      throw createValidationError('Menu item ID is required');
    }

    const menuItem = await MenuItem.findById(id);

    if (!menuItem) {
      throw createNotFoundError('Menu item');
    }

    res.status(200).json({
      success: true,
      data: menuItem,
      timestamp: new Date().toISOString()
    });
  });

  // Get menu items by category
  getMenuItemsByCategory = asyncHandler(async (req: Request, res: Response) => {
    const { category } = req.params;

    if (!category) {
      throw createValidationError('Category is required');
    }

    const menuItems = await MenuItem.find({ 
      category: category,
      isAvailable: true 
    });

    res.status(200).json({
      success: true,
      data: menuItems,
      category: category,
      count: menuItems.length,
      timestamp: new Date().toISOString()
    });
  });

  // Get popular menu items
  getPopularMenuItems = asyncHandler(async (req: Request, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 6;
    const popularItems = await MenuItem.find({ 
      isPopular: true, 
      isAvailable: true 
    }).limit(limit);

    res.status(200).json({
      success: true,
      data: popularItems,
      count: popularItems.length,
      timestamp: new Date().toISOString()
    });
  });

  // Get menu categories
  getMenuCategories = asyncHandler(async (req: Request, res: Response) => {
    // Get distinct categories from MongoDB
    const categoryNames = await MenuItem.distinct('category');
    
    // Build category objects
    const categories = categoryNames.map((categoryName: string, index: number) => ({
      id: categoryName.toLowerCase().replace(/\s+/g, '-'),
      name: categoryName,
      description: `מנות ${categoryName} טעימות ומגוונות`,
      isActive: true,
      sortOrder: index + 1
    }));

    res.status(200).json({
      success: true,
      data: categories,
      count: categories.length,
      timestamp: new Date().toISOString()
    });
  });

  // Admin: Create new menu item
  createMenuItem = asyncHandler(async (req: Request, res: Response) => {
    const menuItemData = req.body;

    // Basic validation
    if (!menuItemData.name || !menuItemData.category) {
      throw createValidationError('Name and category are required');
    }

    // Validate pricing: must have either price, pricingVariants, or pricingOptions
    const hasPrice = menuItemData.price !== undefined && menuItemData.price !== null;
    const hasVariants = menuItemData.pricingVariants && Array.isArray(menuItemData.pricingVariants) && menuItemData.pricingVariants.length > 0;
    const hasOptions = menuItemData.pricingOptions && Array.isArray(menuItemData.pricingOptions) && menuItemData.pricingOptions.length > 0;

    if (!hasPrice && !hasVariants && !hasOptions) {
      throw createValidationError('Either price, pricingVariants, or pricingOptions must be provided');
    }

    if (hasPrice && menuItemData.price <= 0) {
      throw createValidationError('Price must be greater than 0');
    }

    if (hasVariants) {
      // Validate each variant has required fields
      for (const variant of menuItemData.pricingVariants) {
        if (!variant.label || variant.price === undefined || variant.price === null || variant.price <= 0) {
          throw createValidationError('Each pricing variant must have a label and a price greater than 0');
        }
      }
    }

    if (hasOptions) {
      // Validate each option has required fields
      for (const option of menuItemData.pricingOptions) {
        if (!option.label || !option.amount || option.price === undefined || option.price === null || option.price <= 0) {
          throw createValidationError('Each pricing option must have a label, amount, and a price greater than 0');
        }
      }
    }

    // Create new MenuItem instance and save to MongoDB
    const newMenuItem = new MenuItem(menuItemData);
    const savedMenuItem = await newMenuItem.save();

    res.status(201).json({
      success: true,
      data: savedMenuItem,
      message: 'Menu item created successfully',
      timestamp: new Date().toISOString()
    });
  });

  // Admin: Update menu item
  updateMenuItem = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const updateData = req.body;

    if (!id) {
      throw createValidationError('Menu item ID is required');
    }

    // Validate pricing if provided
    if (updateData.price !== undefined && updateData.price !== null && updateData.price <= 0) {
      throw createValidationError('Price must be greater than 0');
    }

    if (updateData.pricingVariants !== undefined) {
      if (!Array.isArray(updateData.pricingVariants)) {
        throw createValidationError('pricingVariants must be an array');
      }
      
      if (updateData.pricingVariants.length > 0) {
        // Validate each variant has required fields
        for (const variant of updateData.pricingVariants) {
          if (!variant.label || variant.price === undefined || variant.price === null || variant.price <= 0) {
            throw createValidationError('Each pricing variant must have a label and a price greater than 0');
          }
        }
      }
    }

    if (updateData.pricingOptions !== undefined) {
      if (!Array.isArray(updateData.pricingOptions)) {
        throw createValidationError('pricingOptions must be an array');
      }
      
      if (updateData.pricingOptions.length > 0) {
        // Validate each option has required fields
        for (const option of updateData.pricingOptions) {
          if (!option.label || !option.amount || option.price === undefined || option.price === null || option.price <= 0) {
            throw createValidationError('Each pricing option must have a label, amount, and a price greater than 0');
          }
        }
      }
    }

    // Handle pricing logic: prioritize pricingOptions > pricingVariants > price
    const updatedData: any = { ...updateData };
    
    // Priority 1: If pricingOptions are being set, remove price and variants
    if (updatedData.pricingOptions !== undefined) {
      if (updatedData.pricingOptions.length > 0) {
        // Using options, remove single price and variants
        updatedData.price = undefined;
        updatedData.pricingVariants = undefined;
      } else {
        // Empty options array, remove options
        updatedData.pricingOptions = undefined;
      }
    }
    
    // Priority 2: If pricingVariants are being set (and no options), remove price
    if (updatedData.pricingVariants !== undefined && !updatedData.pricingOptions) {
      if (updatedData.pricingVariants.length > 0) {
        // Using variants, remove single price
        updatedData.price = undefined;
      } else {
        // Empty variants array, remove variants
        updatedData.pricingVariants = undefined;
      }
    }
    
    // Priority 3: If price is being set, remove variants and options
    if (updatedData.price !== undefined) {
      if (updatedData.pricingVariants) {
        updatedData.pricingVariants = undefined;
      }
      if (updatedData.pricingOptions) {
        updatedData.pricingOptions = undefined;
      }
    }

    // Update menu item in MongoDB
    // Use $set to ensure partial updates don't overwrite other fields
    const updatedMenuItem = await MenuItem.findByIdAndUpdate(
      id,
      { $set: updatedData },
      { new: true, runValidators: true }
    );

    if (!updatedMenuItem) {
      throw createNotFoundError('Menu item');
    }

    res.status(200).json({
      success: true,
      data: updatedMenuItem,
      message: 'Menu item updated successfully',
      timestamp: new Date().toISOString()
    });
  });

  // Admin: Delete menu item
  deleteMenuItem = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    if (!id) {
      throw createValidationError('Menu item ID is required');
    }

    const deletedMenuItem = await MenuItem.findByIdAndDelete(id);

    if (!deletedMenuItem) {
      throw createNotFoundError('Menu item');
    }

    res.status(200).json({
      success: true,
      message: 'Menu item deleted successfully',
      timestamp: new Date().toISOString()
    });
  });

  // Get menu statistics (for admin dashboard)
  getMenuStatistics = asyncHandler(async (req: Request, res: Response) => {
    const totalItems = await MenuItem.countDocuments();
    const availableItems = await MenuItem.countDocuments({ isAvailable: true });
    const popularItems = await MenuItem.countDocuments({ isPopular: true });
    
    // Get unique categories
    const categories = await MenuItem.distinct('category');
    const categoriesCount = categories.length;
    
    // Calculate price statistics
    const allMenuItems = await MenuItem.find({});
    const prices: number[] = [];
    
    allMenuItems.forEach((item: any) => {
      if (item.price !== undefined && item.price !== null) {
        prices.push(item.price);
      }
    });
    
    const averagePrice = prices.length > 0 
      ? prices.reduce((sum, price) => sum + price, 0) / prices.length 
      : 0;
    const priceRange = prices.length > 0 ? {
      min: Math.min(...prices),
      max: Math.max(...prices)
    } : { min: 0, max: 0 };
    
    // Count items by category
    const itemsByCategory: { [category: string]: number } = {};
    for (const category of categories) {
      itemsByCategory[category] = await MenuItem.countDocuments({ category });
    }

    const stats = {
      totalItems,
      availableItems,
      popularItems,
      categoriesCount,
      averagePrice: Math.round(averagePrice * 100) / 100,
      priceRange,
      itemsByCategory
    };

    res.status(200).json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });
  });
}
