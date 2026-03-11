import { Request, Response } from 'express';
import { asyncHandler, createNotFoundError, createValidationError } from '../middleware/errorHandler';
import MenuItem from '../models/menuItem';
export class MenuController {

  // Get all menu items
  getAllMenuItems = asyncHandler(async (req: Request, res: Response) => {
    const { category, tag, available, popular } = req.query;
    
    // Check if database is empty or has partial data (less than 5 items)
    const itemCount = await MenuItem.countDocuments();
    
    if (itemCount < 5) {
      console.log(`📦 Database has only ${itemCount} items. Restoring full menu...`);
      
      // Clear partial data to be safe
      await MenuItem.deleteMany({});
      console.log('🗑️ Cleared existing menu data');
      
      // Master Menu Data - Full menu with ALL categories
      const masterMenu = [
        // --- SALADS (סלטים) ---
        {
          name: 'חומוס ביתי',
          category: 'סלטים',
          description: 'עם שמן זית וגרגירים',
          price: 25,
          imageUrl: 'assets/images/salads/hummus.jpg',
          tags: ['טבעוני', 'ללא גלוטן'],
          isAvailable: true,
          isPopular: true,
          isFeatured: false
        },
        {
          name: 'מטבוחה מרוקאית',
          category: 'סלטים',
          description: 'פיקנטית אש',
          price: 30,
          imageUrl: 'assets/images/salads/matbucha.jpg',
          tags: ['טבעוני', 'ללא גלוטן', 'חריף'],
          isAvailable: true,
          isPopular: true,
          isFeatured: false
        },
        {
          name: 'חציל במיונז',
          category: 'סלטים',
          description: 'טעם ביתי',
          price: 28,
          imageUrl: 'assets/images/salads/eggplant.jpg',
          tags: ['טבעוני'],
          isAvailable: true,
          isPopular: false,
          isFeatured: false
        },
        {
          name: 'כרוב שמיר',
          category: 'סלטים',
          description: 'סלט מרענן',
          price: 25,
          imageUrl: 'assets/images/salads/cabbage.jpg',
          tags: ['טבעוני', 'ללא גלוטן'],
          isAvailable: true,
          isPopular: false,
          isFeatured: false
        },
        
        // --- FISH (דגים) ---
        {
          name: 'פילה סלמון',
          category: 'דגים',
          description: 'בעשבי תיבול ולימון',
          price: 85,
          imageUrl: 'assets/images/fish/salmon.jpg',
          tags: ['דג', 'בריא'],
          isAvailable: true,
          isPopular: true,
          isFeatured: true
        },
        {
          name: 'נסיכת הנילוס',
          category: 'דגים',
          description: 'ברוטב מרוקאי חריף (חריימה)',
          price: 70,
          imageUrl: 'assets/images/fish/nilus.jpg',
          tags: ['דג', 'חריף', 'מסורתי'],
          isAvailable: true,
          isPopular: true,
          isFeatured: false
        },
        {
          name: 'דג דניס שלם',
          category: 'דגים',
          description: 'אפוי בתנור',
          price: 95,
          imageUrl: 'assets/images/fish/denis.jpg',
          tags: ['דג', 'מסורתי'],
          isAvailable: true,
          isPopular: false,
          isFeatured: false
        },
        {
          name: 'גפילטע פיש',
          category: 'דגים',
          description: 'מסורתי עם גזר',
          price: 22,
          imageUrl: 'assets/images/fish/gefilte.jpg',
          tags: ['דג', 'מסורתי'],
          isAvailable: true,
          isPopular: false,
          isFeatured: false
        },
        
        // --- MAIN DISHES (מנות עיקריות) ---
        {
          name: 'עוף בזיתים',
          category: 'מנות עיקריות',
          description: 'ברוטב עשיר',
          price: 65,
          imageUrl: 'assets/images/main/chicken.jpg',
          tags: ['עוף', 'מסורתי'],
          isAvailable: true,
          isPopular: true,
          isFeatured: true
        },
        {
          name: 'אסאדו בבישול ארוך',
          category: 'מנות עיקריות',
          description: 'ביין וירקות שורש',
          price: 110,
          imageUrl: 'assets/images/main/asado.jpg',
          tags: ['בשרי', 'מיוחד'],
          isAvailable: true,
          isPopular: true,
          isFeatured: true
        },
        {
          name: 'שניצל ביתי',
          category: 'מנות עיקריות',
          description: 'פריך וזהוב',
          price: 55,
          imageUrl: 'assets/images/main/schnitzel.jpg',
          tags: ['בשרי', 'קלאסי'],
          isAvailable: true,
          isPopular: true,
          isFeatured: false
        },
        {
          name: 'לשון ברוטב פטריות',
          category: 'מנות עיקריות',
          description: 'רך במיוחד',
          price: 120,
          imageUrl: 'assets/images/main/tongue.jpg',
          tags: ['בשרי', 'מיוחד'],
          isAvailable: true,
          isPopular: false,
          isFeatured: false
        },
        
        // --- CHOLENT BAR (צ'ולנט) ---
        {
          name: 'צ\'ולנט בשרי',
          category: 'צ\'ולנט',
          description: 'צלחת עשירה + לחמניה',
          price: 45,
          imageUrl: 'assets/images/cholent/meat.jpg',
          tags: ['בשרי', 'מסורתי'],
          isAvailable: true,
          isPopular: true,
          isFeatured: false
        },
        {
          name: 'צ\'ולנט פרווה',
          category: 'צ\'ולנט',
          description: 'צלחת מסורתית + לחמניה',
          price: 35,
          imageUrl: 'assets/images/cholent/parve.jpg',
          tags: ['פרווה', 'מסורתי'],
          isAvailable: true,
          isPopular: true,
          isFeatured: false
        },
        {
          name: 'ארוחת המבורגר',
          category: 'צ\'ולנט',
          description: 'קציצה, צ\'יפס ושתייה',
          price: 54,
          imageUrl: 'assets/images/cholent/burger.jpg',
          tags: ['בשרי', 'ארוחה מלאה'],
          isAvailable: true,
          isPopular: true,
          isFeatured: false
        },
        {
          name: 'המבורגר בלחמניה',
          category: 'צ\'ולנט',
          description: 'מוגש עם ירקות טריים ורטבים',
          price: 42,
          imageUrl: 'assets/images/cholent/burger-single.jpg',
          tags: ['בשרי'],
          isAvailable: true,
          isPopular: false,
          isFeatured: false
        },
        {
          name: 'חלה שניצל',
          category: 'צ\'ולנט',
          description: 'מבחר סלטים לבחירה וצ\'יפס בצד',
          price: 38,
          imageUrl: 'assets/images/cholent/schnitzel-challah.jpg',
          tags: ['בשרי', 'ארוחה מלאה'],
          isAvailable: true,
          isPopular: true,
          isFeatured: false
        },
        {
          name: 'נשנושי שניצלונים וצ\'יפס',
          category: 'צ\'ולנט',
          description: 'מנה כיפית ופריכה',
          price: 32,
          imageUrl: 'assets/images/cholent/nuggets.jpg',
          tags: ['בשרי'],
          isAvailable: true,
          isPopular: false,
          isFeatured: false
        },
        {
          name: 'קוגל ירושלמי',
          category: 'צ\'ולנט',
          description: 'חריף ומתוק במידה הנכונה',
          price: 8,
          imageUrl: 'assets/images/cholent/kugel-jerusalem.jpg',
          tags: ['פרווה', 'מסורתי'],
          isAvailable: true,
          isPopular: false,
          isFeatured: false
        },
        {
          name: 'קוגל תפוחי אדמה',
          category: 'צ\'ולנט',
          description: 'בטעם של בית',
          price: 8,
          imageUrl: 'assets/images/cholent/kugel-potato.jpg',
          tags: ['פרווה', 'מסורתי'],
          isAvailable: true,
          isPopular: false,
          isFeatured: false
        },
        {
          name: 'כבד קצוץ',
          category: 'צ\'ולנט',
          description: 'עם בצל מטוגן וקרקרים',
          price: 30,
          imageUrl: 'assets/images/cholent/liver.jpg',
          tags: ['בשרי', 'מסורתי'],
          isAvailable: true,
          isPopular: false,
          isFeatured: false
        },
        {
          name: 'צ\'יפס',
          category: 'צ\'ולנט',
          description: 'פריך ולוהט. קטן: 10 ₪ / גדול: 20 ₪',
          price: 10,
          imageUrl: 'assets/images/cholent/fries.jpg',
          tags: ['פרווה'],
          isAvailable: true,
          isPopular: false,
          isFeatured: false
        },
        {
          name: 'סופלה שוקולד',
          category: 'צ\'ולנט',
          description: 'מוגש חם עם גלידה וניל',
          price: 22,
          imageUrl: 'assets/images/cholent/souffle.jpg',
          tags: ['קינוח', 'שוקולד'],
          isAvailable: true,
          isPopular: false,
          isFeatured: false
        },
        {
          name: 'פלטת קינוחים זוגית',
          category: 'צ\'ולנט',
          description: 'מבחר מתוקים מפנק',
          price: 40,
          imageUrl: 'assets/images/cholent/dessert-platter.jpg',
          tags: ['קינוח'],
          isAvailable: true,
          isPopular: false,
          isFeatured: false
        },
        {
          name: 'שתייה קלה',
          category: 'צ\'ולנט',
          description: 'קולה, פנטה, זירו, XL',
          price: 8,
          imageUrl: 'assets/images/cholent/drinks.jpg',
          tags: ['שתייה'],
          isAvailable: true,
          isPopular: false,
          isFeatured: false
        },
        {
          name: 'מים',
          category: 'צ\'ולנט',
          description: 'מים מינרליים',
          price: 5,
          imageUrl: 'assets/images/cholent/water.jpg',
          tags: ['שתייה'],
          isAvailable: true,
          isPopular: false,
          isFeatured: false
        },
        {
          name: 'בירה קרה',
          category: 'צ\'ולנט',
          description: 'בקבוק בירה צונן',
          price: 15,
          imageUrl: 'assets/images/cholent/beer.jpg',
          tags: ['שתייה', 'אלכוהול'],
          isAvailable: true,
          isPopular: false,
          isFeatured: false
        }
      ];
      
      // Insert all items at once
      const seededItems = await MenuItem.insertMany(masterMenu);
      console.log(`♻️ Database restored with full menu. Seeded ${seededItems.length} menu items across all categories.`);
    }
    
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
    
    const menuItems = await MenuItem.find(query).sort({ order: 1 });

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
    }).sort({ order: 1 });

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

  /** PUT /api/menu/reorder — bulk update order field. Body: [{ id: string, order: number }] */
  reorderMenuItems = asyncHandler(async (req: Request, res: Response) => {
    const items = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      throw createValidationError('Body must be a non-empty array of { id, order }');
    }
    const ops = items.map((entry: { id: string; order: number }) => ({
      updateOne: {
        filter: { _id: entry.id },
        update: { $set: { order: entry.order } }
      }
    }));
    await MenuItem.bulkWrite(ops);
    res.status(200).json({
      success: true,
      message: 'Order updated successfully',
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

  /**
   * POST /api/menu/migrate-cholent-desserts-category
   * One-time migration: set category to "קינוחים צ'ולנט" for items that have
   * category "קינוחים" and are intended for the Cholent menu only (menuTypes is ['cholent']).
   */
  migrateCholentDessertsCategory = asyncHandler(async (req: Request, res: Response) => {
    const result = await MenuItem.updateMany(
      { category: 'קינוחים', menuTypes: ['cholent'] },
      { $set: { category: "קינוחים צ'ולנט" } }
    );
    const updated = result.modifiedCount ?? 0;
    console.log(`[Menu Migration] Set category to קינוחים צ'ולנט for ${updated} cholent-only dessert item(s)`);
    res.status(200).json({
      success: true,
      message: `Updated ${updated} item(s) to category "קינוחים צ'ולנט".`,
      modifiedCount: updated,
      timestamp: new Date().toISOString()
    });
  });
}
