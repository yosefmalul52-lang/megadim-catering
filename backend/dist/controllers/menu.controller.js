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
exports.MenuController = void 0;
const errorHandler_1 = require("../middleware/errorHandler");
const menuItem_1 = __importDefault(require("../models/menuItem"));
class MenuController {
    constructor() {
        // Get all menu items
        this.getAllMenuItems = (0, errorHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const { category, tag, available, popular } = req.query;
            // Build MongoDB query
            const query = {};
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
            const menuItems = yield menuItem_1.default.find(query);
            res.status(200).json({
                success: true,
                data: menuItems,
                count: menuItems.length,
                timestamp: new Date().toISOString()
            });
        }));
        // Get menu item by ID
        this.getMenuItemById = (0, errorHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params;
            if (!id) {
                throw (0, errorHandler_1.createValidationError)('Menu item ID is required');
            }
            const menuItem = yield menuItem_1.default.findById(id);
            if (!menuItem) {
                throw (0, errorHandler_1.createNotFoundError)('Menu item');
            }
            res.status(200).json({
                success: true,
                data: menuItem,
                timestamp: new Date().toISOString()
            });
        }));
        // Get menu items by category
        this.getMenuItemsByCategory = (0, errorHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const { category } = req.params;
            if (!category) {
                throw (0, errorHandler_1.createValidationError)('Category is required');
            }
            const menuItems = yield menuItem_1.default.find({
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
        }));
        // Get popular menu items
        this.getPopularMenuItems = (0, errorHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const limit = parseInt(req.query.limit) || 6;
            const popularItems = yield menuItem_1.default.find({
                isPopular: true,
                isAvailable: true
            }).limit(limit);
            res.status(200).json({
                success: true,
                data: popularItems,
                count: popularItems.length,
                timestamp: new Date().toISOString()
            });
        }));
        // Get menu categories
        this.getMenuCategories = (0, errorHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            // Get distinct categories from MongoDB
            const categoryNames = yield menuItem_1.default.distinct('category');
            // Build category objects
            const categories = categoryNames.map((categoryName, index) => ({
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
        }));
        // Admin: Create new menu item
        this.createMenuItem = (0, errorHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const menuItemData = req.body;
            // Basic validation
            if (!menuItemData.name || !menuItemData.category) {
                throw (0, errorHandler_1.createValidationError)('Name and category are required');
            }
            // Validate pricing: must have either price, pricingVariants, or pricingOptions
            const hasPrice = menuItemData.price !== undefined && menuItemData.price !== null;
            const hasVariants = menuItemData.pricingVariants && Array.isArray(menuItemData.pricingVariants) && menuItemData.pricingVariants.length > 0;
            const hasOptions = menuItemData.pricingOptions && Array.isArray(menuItemData.pricingOptions) && menuItemData.pricingOptions.length > 0;
            if (!hasPrice && !hasVariants && !hasOptions) {
                throw (0, errorHandler_1.createValidationError)('Either price, pricingVariants, or pricingOptions must be provided');
            }
            if (hasPrice && menuItemData.price <= 0) {
                throw (0, errorHandler_1.createValidationError)('Price must be greater than 0');
            }
            if (hasVariants) {
                // Validate each variant has required fields
                for (const variant of menuItemData.pricingVariants) {
                    if (!variant.label || variant.price === undefined || variant.price === null || variant.price <= 0) {
                        throw (0, errorHandler_1.createValidationError)('Each pricing variant must have a label and a price greater than 0');
                    }
                }
            }
            if (hasOptions) {
                // Validate each option has required fields
                for (const option of menuItemData.pricingOptions) {
                    if (!option.label || !option.amount || option.price === undefined || option.price === null || option.price <= 0) {
                        throw (0, errorHandler_1.createValidationError)('Each pricing option must have a label, amount, and a price greater than 0');
                    }
                }
            }
            // Create new MenuItem instance and save to MongoDB
            const newMenuItem = new menuItem_1.default(menuItemData);
            const savedMenuItem = yield newMenuItem.save();
            res.status(201).json({
                success: true,
                data: savedMenuItem,
                message: 'Menu item created successfully',
                timestamp: new Date().toISOString()
            });
        }));
        // Admin: Update menu item
        this.updateMenuItem = (0, errorHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params;
            const updateData = req.body;
            if (!id) {
                throw (0, errorHandler_1.createValidationError)('Menu item ID is required');
            }
            // Validate pricing if provided
            if (updateData.price !== undefined && updateData.price !== null && updateData.price <= 0) {
                throw (0, errorHandler_1.createValidationError)('Price must be greater than 0');
            }
            if (updateData.pricingVariants !== undefined) {
                if (!Array.isArray(updateData.pricingVariants)) {
                    throw (0, errorHandler_1.createValidationError)('pricingVariants must be an array');
                }
                if (updateData.pricingVariants.length > 0) {
                    // Validate each variant has required fields
                    for (const variant of updateData.pricingVariants) {
                        if (!variant.label || variant.price === undefined || variant.price === null || variant.price <= 0) {
                            throw (0, errorHandler_1.createValidationError)('Each pricing variant must have a label and a price greater than 0');
                        }
                    }
                }
            }
            if (updateData.pricingOptions !== undefined) {
                if (!Array.isArray(updateData.pricingOptions)) {
                    throw (0, errorHandler_1.createValidationError)('pricingOptions must be an array');
                }
                if (updateData.pricingOptions.length > 0) {
                    // Validate each option has required fields
                    for (const option of updateData.pricingOptions) {
                        if (!option.label || !option.amount || option.price === undefined || option.price === null || option.price <= 0) {
                            throw (0, errorHandler_1.createValidationError)('Each pricing option must have a label, amount, and a price greater than 0');
                        }
                    }
                }
            }
            // Handle pricing logic: prioritize pricingOptions > pricingVariants > price
            const updatedData = Object.assign({}, updateData);
            // Priority 1: If pricingOptions are being set, remove price and variants
            if (updatedData.pricingOptions !== undefined) {
                if (updatedData.pricingOptions.length > 0) {
                    // Using options, remove single price and variants
                    updatedData.price = undefined;
                    updatedData.pricingVariants = undefined;
                }
                else {
                    // Empty options array, remove options
                    updatedData.pricingOptions = undefined;
                }
            }
            // Priority 2: If pricingVariants are being set (and no options), remove price
            if (updatedData.pricingVariants !== undefined && !updatedData.pricingOptions) {
                if (updatedData.pricingVariants.length > 0) {
                    // Using variants, remove single price
                    updatedData.price = undefined;
                }
                else {
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
            const updatedMenuItem = yield menuItem_1.default.findByIdAndUpdate(id, { $set: updatedData }, { new: true, runValidators: true });
            if (!updatedMenuItem) {
                throw (0, errorHandler_1.createNotFoundError)('Menu item');
            }
            res.status(200).json({
                success: true,
                data: updatedMenuItem,
                message: 'Menu item updated successfully',
                timestamp: new Date().toISOString()
            });
        }));
        // Admin: Delete menu item
        this.deleteMenuItem = (0, errorHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params;
            if (!id) {
                throw (0, errorHandler_1.createValidationError)('Menu item ID is required');
            }
            const deletedMenuItem = yield menuItem_1.default.findByIdAndDelete(id);
            if (!deletedMenuItem) {
                throw (0, errorHandler_1.createNotFoundError)('Menu item');
            }
            res.status(200).json({
                success: true,
                message: 'Menu item deleted successfully',
                timestamp: new Date().toISOString()
            });
        }));
        // Get menu statistics (for admin dashboard)
        this.getMenuStatistics = (0, errorHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const totalItems = yield menuItem_1.default.countDocuments();
            const availableItems = yield menuItem_1.default.countDocuments({ isAvailable: true });
            const popularItems = yield menuItem_1.default.countDocuments({ isPopular: true });
            // Get unique categories
            const categories = yield menuItem_1.default.distinct('category');
            const categoriesCount = categories.length;
            // Calculate price statistics
            const allMenuItems = yield menuItem_1.default.find({});
            const prices = [];
            allMenuItems.forEach((item) => {
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
            const itemsByCategory = {};
            for (const category of categories) {
                itemsByCategory[category] = yield menuItem_1.default.countDocuments({ category });
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
        }));
    }
}
exports.MenuController = MenuController;
