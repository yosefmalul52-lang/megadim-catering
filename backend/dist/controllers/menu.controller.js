"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MenuController = void 0;
const errorHandler_1 = require("../middleware/errorHandler");
const menuItem_1 = __importDefault(require("../models/menuItem"));
class MenuController {
    getAllMenuItems = (0, errorHandler_1.asyncHandler)(async (req, res) => {
        const { category, tag, available, popular } = req.query;
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
        const menuItems = await menuItem_1.default.find(query);
        res.status(200).json({
            success: true,
            data: menuItems,
            count: menuItems.length,
            timestamp: new Date().toISOString()
        });
    });
    getMenuItemById = (0, errorHandler_1.asyncHandler)(async (req, res) => {
        const { id } = req.params;
        if (!id) {
            throw (0, errorHandler_1.createValidationError)('Menu item ID is required');
        }
        const menuItem = await menuItem_1.default.findById(id);
        if (!menuItem) {
            throw (0, errorHandler_1.createNotFoundError)('Menu item');
        }
        res.status(200).json({
            success: true,
            data: menuItem,
            timestamp: new Date().toISOString()
        });
    });
    getMenuItemsByCategory = (0, errorHandler_1.asyncHandler)(async (req, res) => {
        const { category } = req.params;
        if (!category) {
            throw (0, errorHandler_1.createValidationError)('Category is required');
        }
        const menuItems = await menuItem_1.default.find({
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
    getPopularMenuItems = (0, errorHandler_1.asyncHandler)(async (req, res) => {
        const limit = parseInt(req.query.limit) || 6;
        const popularItems = await menuItem_1.default.find({
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
    getMenuCategories = (0, errorHandler_1.asyncHandler)(async (req, res) => {
        const categoryNames = await menuItem_1.default.distinct('category');
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
    });
    createMenuItem = (0, errorHandler_1.asyncHandler)(async (req, res) => {
        const menuItemData = req.body;
        if (!menuItemData.name || !menuItemData.category) {
            throw (0, errorHandler_1.createValidationError)('Name and category are required');
        }
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
            for (const variant of menuItemData.pricingVariants) {
                if (!variant.label || variant.price === undefined || variant.price === null || variant.price <= 0) {
                    throw (0, errorHandler_1.createValidationError)('Each pricing variant must have a label and a price greater than 0');
                }
            }
        }
        if (hasOptions) {
            for (const option of menuItemData.pricingOptions) {
                if (!option.label || !option.amount || option.price === undefined || option.price === null || option.price <= 0) {
                    throw (0, errorHandler_1.createValidationError)('Each pricing option must have a label, amount, and a price greater than 0');
                }
            }
        }
        const newMenuItem = new menuItem_1.default(menuItemData);
        const savedMenuItem = await newMenuItem.save();
        res.status(201).json({
            success: true,
            data: savedMenuItem,
            message: 'Menu item created successfully',
            timestamp: new Date().toISOString()
        });
    });
    updateMenuItem = (0, errorHandler_1.asyncHandler)(async (req, res) => {
        const { id } = req.params;
        const updateData = req.body;
        if (!id) {
            throw (0, errorHandler_1.createValidationError)('Menu item ID is required');
        }
        if (updateData.price !== undefined && updateData.price !== null && updateData.price <= 0) {
            throw (0, errorHandler_1.createValidationError)('Price must be greater than 0');
        }
        if (updateData.pricingVariants !== undefined) {
            if (!Array.isArray(updateData.pricingVariants)) {
                throw (0, errorHandler_1.createValidationError)('pricingVariants must be an array');
            }
            if (updateData.pricingVariants.length > 0) {
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
                for (const option of updateData.pricingOptions) {
                    if (!option.label || !option.amount || option.price === undefined || option.price === null || option.price <= 0) {
                        throw (0, errorHandler_1.createValidationError)('Each pricing option must have a label, amount, and a price greater than 0');
                    }
                }
            }
        }
        const updatedData = { ...updateData };
        if (updatedData.pricingOptions !== undefined) {
            if (updatedData.pricingOptions.length > 0) {
                updatedData.price = undefined;
                updatedData.pricingVariants = undefined;
            }
            else {
                updatedData.pricingOptions = undefined;
            }
        }
        if (updatedData.pricingVariants !== undefined && !updatedData.pricingOptions) {
            if (updatedData.pricingVariants.length > 0) {
                updatedData.price = undefined;
            }
            else {
                updatedData.pricingVariants = undefined;
            }
        }
        if (updatedData.price !== undefined) {
            if (updatedData.pricingVariants) {
                updatedData.pricingVariants = undefined;
            }
            if (updatedData.pricingOptions) {
                updatedData.pricingOptions = undefined;
            }
        }
        const updatedMenuItem = await menuItem_1.default.findByIdAndUpdate(id, { $set: updatedData }, { new: true, runValidators: true });
        if (!updatedMenuItem) {
            throw (0, errorHandler_1.createNotFoundError)('Menu item');
        }
        res.status(200).json({
            success: true,
            data: updatedMenuItem,
            message: 'Menu item updated successfully',
            timestamp: new Date().toISOString()
        });
    });
    deleteMenuItem = (0, errorHandler_1.asyncHandler)(async (req, res) => {
        const { id } = req.params;
        if (!id) {
            throw (0, errorHandler_1.createValidationError)('Menu item ID is required');
        }
        const deletedMenuItem = await menuItem_1.default.findByIdAndDelete(id);
        if (!deletedMenuItem) {
            throw (0, errorHandler_1.createNotFoundError)('Menu item');
        }
        res.status(200).json({
            success: true,
            message: 'Menu item deleted successfully',
            timestamp: new Date().toISOString()
        });
    });
    getMenuStatistics = (0, errorHandler_1.asyncHandler)(async (req, res) => {
        const totalItems = await menuItem_1.default.countDocuments();
        const availableItems = await menuItem_1.default.countDocuments({ isAvailable: true });
        const popularItems = await menuItem_1.default.countDocuments({ isPopular: true });
        const categories = await menuItem_1.default.distinct('category');
        const categoriesCount = categories.length;
        const allMenuItems = await menuItem_1.default.find({});
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
        const itemsByCategory = {};
        for (const category of categories) {
            itemsByCategory[category] = await menuItem_1.default.countDocuments({ category });
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
exports.MenuController = MenuController;
//# sourceMappingURL=menu.controller.js.map