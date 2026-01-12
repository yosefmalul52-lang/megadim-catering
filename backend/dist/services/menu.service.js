"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MenuService = void 0;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const uuid_1 = require("uuid");
class MenuService {
    menuItemsPath;
    menuItems = [];
    constructor() {
        this.menuItemsPath = path_1.default.join(process.cwd(), 'src', 'data', 'menuItems.json');
        this.loadMenuItems().catch(error => {
            console.error('Failed to load menu items in constructor:', error);
        });
    }
    async loadMenuItems() {
        try {
            const data = await promises_1.default.readFile(this.menuItemsPath, 'utf-8');
            this.menuItems = JSON.parse(data);
            console.log(`✅ Loaded ${this.menuItems.length} menu items`);
        }
        catch (error) {
            console.error('❌ Error loading menu items:', error);
            this.menuItems = [];
        }
    }
    async saveMenuItems() {
        try {
            await promises_1.default.writeFile(this.menuItemsPath, JSON.stringify(this.menuItems, null, 2));
            console.log('✅ Menu items saved successfully');
        }
        catch (error) {
            console.error('❌ Error saving menu items:', error);
            throw error;
        }
    }
    async getAllMenuItems(filters = {}) {
        await this.loadMenuItems();
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
    }
    async getMenuItemById(id) {
        await this.loadMenuItems();
        const menuItem = this.menuItems.find(item => item.id === id);
        return menuItem || null;
    }
    async getMenuItemsByCategory(category) {
        await this.loadMenuItems();
        return this.menuItems.filter(item => item.category.toLowerCase() === category.toLowerCase() &&
            item.isAvailable !== false);
    }
    async getPopularMenuItems(limit = 6) {
        await this.loadMenuItems();
        return this.menuItems
            .filter(item => item.isPopular && item.isAvailable !== false)
            .slice(0, limit);
    }
    async getMenuCategories() {
        await this.loadMenuItems();
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
    }
    async createMenuItem(menuItemData) {
        await this.loadMenuItems();
        const newMenuItem = {
            id: (0, uuid_1.v4)(),
            ...menuItemData,
            createdAt: new Date(),
            updatedAt: new Date(),
            isAvailable: menuItemData.isAvailable ?? true,
            isPopular: menuItemData.isPopular ?? false
        };
        this.menuItems.push(newMenuItem);
        await this.saveMenuItems();
        return newMenuItem;
    }
    async updateMenuItem(id, updateData) {
        await this.loadMenuItems();
        const menuItemIndex = this.menuItems.findIndex(item => item.id === id);
        if (menuItemIndex === -1) {
            return null;
        }
        const updatedData = { ...updateData };
        if (updatedData.pricingVariants !== undefined) {
            if (updatedData.pricingVariants.length > 0) {
                updatedData.price = undefined;
            }
            else {
                if (updatedData.price === undefined) {
                    updatedData.price = this.menuItems[menuItemIndex].price;
                }
                updatedData.pricingVariants = undefined;
            }
        }
        if (updatedData.price !== undefined && this.menuItems[menuItemIndex].pricingVariants) {
            updatedData.pricingVariants = undefined;
        }
        this.menuItems[menuItemIndex] = {
            ...this.menuItems[menuItemIndex],
            ...updatedData,
            updatedAt: new Date().toISOString()
        };
        await this.saveMenuItems();
        await this.loadMenuItems();
        return this.menuItems.find(item => item.id === id) || null;
    }
    async deleteMenuItem(id) {
        await this.loadMenuItems();
        const initialLength = this.menuItems.length;
        this.menuItems = this.menuItems.filter(item => item.id !== id);
        if (this.menuItems.length < initialLength) {
            await this.saveMenuItems();
            return true;
        }
        return false;
    }
    async getMenuStatistics() {
        await this.loadMenuItems();
        const totalItems = this.menuItems.length;
        const availableItems = this.menuItems.filter(item => item.isAvailable !== false).length;
        const popularItems = this.menuItems.filter(item => item.isPopular).length;
        const categories = new Set(this.menuItems.map(item => item.category));
        const categoriesCount = categories.size;
        const prices = [];
        this.menuItems.forEach(item => {
            if (item.price !== undefined && item.price !== null) {
                prices.push(item.price);
            }
            else if (item.pricingVariants && item.pricingVariants.length > 0) {
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
    }
    async searchMenuItems(query) {
        await this.loadMenuItems();
        const searchTerm = query.toLowerCase();
        return this.menuItems.filter(item => item.isAvailable !== false && (item.name.toLowerCase().includes(searchTerm) ||
            item.description.toLowerCase().includes(searchTerm) ||
            item.category.toLowerCase().includes(searchTerm) ||
            item.tags.some(tag => tag.toLowerCase().includes(searchTerm)) ||
            (item.ingredients && item.ingredients.some(ingredient => ingredient.toLowerCase().includes(searchTerm)))));
    }
}
exports.MenuService = MenuService;
//# sourceMappingURL=menu.service.js.map