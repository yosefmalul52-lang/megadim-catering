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
exports.MenuService = void 0;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const uuid_1 = require("uuid");
class MenuService {
    constructor() {
        this.menuItems = [];
        // Use absolute path to ensure we find the file
        this.menuItemsPath = path_1.default.join(process.cwd(), 'src', 'data', 'menuItems.json');
        this.loadMenuItems().catch(error => {
            console.error('Failed to load menu items in constructor:', error);
        });
    }
    // Load menu items from JSON file
    loadMenuItems() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const data = yield promises_1.default.readFile(this.menuItemsPath, 'utf-8');
                this.menuItems = JSON.parse(data);
                console.log(`✅ Loaded ${this.menuItems.length} menu items`);
            }
            catch (error) {
                console.error('❌ Error loading menu items:', error);
                this.menuItems = [];
            }
        });
    }
    // Save menu items to JSON file
    saveMenuItems() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield promises_1.default.writeFile(this.menuItemsPath, JSON.stringify(this.menuItems, null, 2));
                console.log('✅ Menu items saved successfully');
            }
            catch (error) {
                console.error('❌ Error saving menu items:', error);
                throw error;
            }
        });
    }
    // Get all menu items with optional filters
    getAllMenuItems() {
        return __awaiter(this, arguments, void 0, function* (filters = {}) {
            // Always reload from file to get latest data
            yield this.loadMenuItems();
            let filteredItems = [...this.menuItems];
            if (filters.category) {
                filteredItems = filteredItems.filter(item => item.category.toLowerCase().includes(filters.category.toLowerCase()));
            }
            if (filters.tag) {
                filteredItems = filteredItems.filter(item => item.tags.some(tag => tag.toLowerCase().includes(filters.tag.toLowerCase())));
            }
            if (filters.available !== undefined) {
                filteredItems = filteredItems.filter(item => item.isAvailable === filters.available);
            }
            if (filters.popular !== undefined) {
                filteredItems = filteredItems.filter(item => item.isPopular === filters.popular);
            }
            return filteredItems;
        });
    }
    // Get menu item by ID
    getMenuItemById(id) {
        return __awaiter(this, void 0, void 0, function* () {
            // Always reload from file to get latest data
            yield this.loadMenuItems();
            const menuItem = this.menuItems.find(item => item.id === id);
            return menuItem || null;
        });
    }
    // Get menu items by category
    getMenuItemsByCategory(category) {
        return __awaiter(this, void 0, void 0, function* () {
            // Always reload from file to get latest data
            yield this.loadMenuItems();
            return this.menuItems.filter(item => item.category.toLowerCase() === category.toLowerCase() &&
                item.isAvailable !== false);
        });
    }
    // Get popular menu items
    getPopularMenuItems() {
        return __awaiter(this, arguments, void 0, function* (limit = 6) {
            // Always reload from file to get latest data
            yield this.loadMenuItems();
            return this.menuItems
                .filter(item => item.isPopular && item.isAvailable !== false)
                .slice(0, limit);
        });
    }
    // Get menu categories
    getMenuCategories() {
        return __awaiter(this, void 0, void 0, function* () {
            // Always reload from file to get latest data
            yield this.loadMenuItems();
            const categoriesMap = new Map();
            this.menuItems.forEach(item => {
                if (!categoriesMap.has(item.category)) {
                    categoriesMap.set(item.category, {
                        id: item.category.toLowerCase().replace(/\s+/g, '-'),
                        name: item.category,
                        description: `מנות ${item.category} טעימות ומגוונות`,
                        isActive: true,
                        createdAt: new Date(),
                        sortOrder: categoriesMap.size + 1
                    });
                }
            });
            return Array.from(categoriesMap.values());
        });
    }
    // Create new menu item
    createMenuItem(menuItemData) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            // Always reload from file to get latest data before creating
            yield this.loadMenuItems();
            const newMenuItem = Object.assign(Object.assign({ id: (0, uuid_1.v4)() }, menuItemData), { createdAt: new Date(), updatedAt: new Date(), isAvailable: (_a = menuItemData.isAvailable) !== null && _a !== void 0 ? _a : true, isPopular: (_b = menuItemData.isPopular) !== null && _b !== void 0 ? _b : false });
            this.menuItems.push(newMenuItem);
            yield this.saveMenuItems();
            return newMenuItem;
        });
    }
    // Update menu item
    updateMenuItem(id, updateData) {
        return __awaiter(this, void 0, void 0, function* () {
            // Always reload from file to get latest data before updating
            yield this.loadMenuItems();
            const menuItemIndex = this.menuItems.findIndex(item => item.id === id);
            if (menuItemIndex === -1) {
                return null;
            }
            // Handle pricing logic: if pricingVariants are provided, remove price (or vice versa)
            const updatedData = Object.assign({}, updateData);
            // If pricingVariants are being set, ensure price is removed (or set to undefined)
            if (updatedData.pricingVariants !== undefined) {
                if (updatedData.pricingVariants.length > 0) {
                    // Using variants, remove single price
                    updatedData.price = undefined;
                }
                else {
                    // Empty variants array, keep existing price or require price
                    if (updatedData.price === undefined) {
                        // Keep existing price if not being updated
                        updatedData.price = this.menuItems[menuItemIndex].price;
                    }
                    updatedData.pricingVariants = undefined;
                }
            }
            // If price is being set and pricingVariants exist, remove variants
            if (updatedData.price !== undefined && this.menuItems[menuItemIndex].pricingVariants) {
                updatedData.pricingVariants = undefined;
            }
            this.menuItems[menuItemIndex] = Object.assign(Object.assign(Object.assign({}, this.menuItems[menuItemIndex]), updatedData), { updatedAt: new Date().toISOString() });
            yield this.saveMenuItems();
            // Reload to return fresh data
            yield this.loadMenuItems();
            return this.menuItems.find(item => item.id === id) || null;
        });
    }
    // Delete menu item
    deleteMenuItem(id) {
        return __awaiter(this, void 0, void 0, function* () {
            // Always reload from file to get latest data before deleting
            yield this.loadMenuItems();
            const initialLength = this.menuItems.length;
            this.menuItems = this.menuItems.filter(item => item.id !== id);
            if (this.menuItems.length < initialLength) {
                yield this.saveMenuItems();
                return true;
            }
            return false;
        });
    }
    // Get menu statistics
    getMenuStatistics() {
        return __awaiter(this, void 0, void 0, function* () {
            // Always reload from file to get latest data
            yield this.loadMenuItems();
            const totalItems = this.menuItems.length;
            const availableItems = this.menuItems.filter(item => item.isAvailable !== false).length;
            const popularItems = this.menuItems.filter(item => item.isPopular).length;
            const categories = new Set(this.menuItems.map(item => item.category));
            const categoriesCount = categories.size;
            // Handle both single price and pricing variants
            const prices = [];
            this.menuItems.forEach(item => {
                if (item.price !== undefined && item.price !== null) {
                    prices.push(item.price);
                }
                else if (item.pricingVariants && item.pricingVariants.length > 0) {
                    // Use first variant price for statistics
                    prices.push(item.pricingVariants[0].price);
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
            this.menuItems.forEach(item => {
                itemsByCategory[item.category] = (itemsByCategory[item.category] || 0) + 1;
            });
            return {
                totalItems,
                availableItems,
                popularItems,
                categoriesCount,
                averagePrice: Math.round(averagePrice * 100) / 100,
                priceRange,
                itemsByCategory
            };
        });
    }
    // Search menu items
    searchMenuItems(query) {
        return __awaiter(this, void 0, void 0, function* () {
            // Always reload from file to get latest data
            yield this.loadMenuItems();
            const searchTerm = query.toLowerCase();
            return this.menuItems.filter(item => item.isAvailable !== false && (item.name.toLowerCase().includes(searchTerm) ||
                item.description.toLowerCase().includes(searchTerm) ||
                item.category.toLowerCase().includes(searchTerm) ||
                item.tags.some(tag => tag.toLowerCase().includes(searchTerm)) ||
                (item.ingredients && item.ingredients.some(ingredient => ingredient.toLowerCase().includes(searchTerm)))));
        });
    }
}
exports.MenuService = MenuService;
