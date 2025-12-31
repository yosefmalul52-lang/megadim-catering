import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { MenuItem, MenuCategory, CreateMenuItemRequest, UpdateMenuItemRequest } from '../models/menuItem.model';

interface MenuFilters {
  category?: string;
  tag?: string;
  available?: boolean;
  popular?: boolean;
}

export class MenuService {
  private menuItemsPath: string;
  private menuItems: MenuItem[] = [];

  constructor() {
    // Use absolute path to ensure we find the file
    this.menuItemsPath = path.join(process.cwd(), 'src', 'data', 'menuItems.json');
    this.loadMenuItems().catch(error => {
      console.error('Failed to load menu items in constructor:', error);
    });
  }

  // Load menu items from JSON file
  private async loadMenuItems(): Promise<void> {
    try {
      const data = await fs.readFile(this.menuItemsPath, 'utf-8');
      this.menuItems = JSON.parse(data);
      console.log(`✅ Loaded ${this.menuItems.length} menu items`);
    } catch (error) {
      console.error('❌ Error loading menu items:', error);
      this.menuItems = [];
    }
  }

  // Save menu items to JSON file
  private async saveMenuItems(): Promise<void> {
    try {
      await fs.writeFile(this.menuItemsPath, JSON.stringify(this.menuItems, null, 2));
      console.log('✅ Menu items saved successfully');
    } catch (error) {
      console.error('❌ Error saving menu items:', error);
      throw error;
    }
  }

  // Get all menu items with optional filters
  async getAllMenuItems(filters: MenuFilters = {}): Promise<MenuItem[]> {
    // Always reload from file to get latest data
    await this.loadMenuItems();
    
    let filteredItems = [...this.menuItems];

    if (filters.category) {
      filteredItems = filteredItems.filter(item => 
        item.category.toLowerCase().includes(filters.category!.toLowerCase())
      );
    }

    if (filters.tag) {
      filteredItems = filteredItems.filter(item =>
        item.tags.some(tag => tag.toLowerCase().includes(filters.tag!.toLowerCase()))
      );
    }

    if (filters.available !== undefined) {
      filteredItems = filteredItems.filter(item => item.isAvailable === filters.available);
    }

    if (filters.popular !== undefined) {
      filteredItems = filteredItems.filter(item => item.isPopular === filters.popular);
    }

    return filteredItems;
  }

  // Get menu item by ID
  async getMenuItemById(id: string): Promise<MenuItem | null> {
    // Always reload from file to get latest data
    await this.loadMenuItems();
    const menuItem = this.menuItems.find(item => item.id === id);
    return menuItem || null;
  }

  // Get menu items by category
  async getMenuItemsByCategory(category: string): Promise<MenuItem[]> {
    // Always reload from file to get latest data
    await this.loadMenuItems();
    return this.menuItems.filter(item => 
      item.category.toLowerCase() === category.toLowerCase() && 
      item.isAvailable !== false
    );
  }

  // Get popular menu items
  async getPopularMenuItems(limit: number = 6): Promise<MenuItem[]> {
    // Always reload from file to get latest data
    await this.loadMenuItems();
    return this.menuItems
      .filter(item => item.isPopular && item.isAvailable !== false)
      .slice(0, limit);
  }

  // Get menu categories
  async getMenuCategories(): Promise<MenuCategory[]> {
    // Always reload from file to get latest data
    await this.loadMenuItems();
    const categoriesMap = new Map<string, MenuCategory>();
    
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

  // Create new menu item
  async createMenuItem(menuItemData: CreateMenuItemRequest): Promise<MenuItem> {
    // Always reload from file to get latest data before creating
    await this.loadMenuItems();
    const newMenuItem: MenuItem = {
      id: uuidv4(),
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

  // Update menu item
  async updateMenuItem(id: string, updateData: UpdateMenuItemRequest): Promise<MenuItem | null> {
    // Always reload from file to get latest data before updating
    await this.loadMenuItems();
    const menuItemIndex = this.menuItems.findIndex(item => item.id === id);
    
    if (menuItemIndex === -1) {
      return null;
    }

    // Handle pricing logic: if pricingVariants are provided, remove price (or vice versa)
    const updatedData: any = { ...updateData };
    
    // If pricingVariants are being set, ensure price is removed (or set to undefined)
    if (updatedData.pricingVariants !== undefined) {
      if (updatedData.pricingVariants.length > 0) {
        // Using variants, remove single price
        updatedData.price = undefined;
      } else {
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

    this.menuItems[menuItemIndex] = {
      ...this.menuItems[menuItemIndex],
      ...updatedData,
      updatedAt: new Date().toISOString()
    };

    await this.saveMenuItems();
    
    // Reload to return fresh data
    await this.loadMenuItems();
    return this.menuItems.find(item => item.id === id) || null;
  }

  // Delete menu item
  async deleteMenuItem(id: string): Promise<boolean> {
    // Always reload from file to get latest data before deleting
    await this.loadMenuItems();
    const initialLength = this.menuItems.length;
    this.menuItems = this.menuItems.filter(item => item.id !== id);
    
    if (this.menuItems.length < initialLength) {
      await this.saveMenuItems();
      return true;
    }
    
    return false;
  }

  // Get menu statistics
  async getMenuStatistics(): Promise<{
    totalItems: number;
    availableItems: number;
    popularItems: number;
    categoriesCount: number;
    averagePrice: number;
    priceRange: { min: number; max: number };
    itemsByCategory: { [category: string]: number };
  }> {
    // Always reload from file to get latest data
    await this.loadMenuItems();
    const totalItems = this.menuItems.length;
    const availableItems = this.menuItems.filter(item => item.isAvailable !== false).length;
    const popularItems = this.menuItems.filter(item => item.isPopular).length;
    
    const categories = new Set(this.menuItems.map(item => item.category));
    const categoriesCount = categories.size;
    
    // Handle both single price and pricing variants
    const prices: number[] = [];
    this.menuItems.forEach(item => {
      if (item.price !== undefined && item.price !== null) {
        prices.push(item.price);
      } else if (item.pricingVariants && item.pricingVariants.length > 0) {
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
    
    const itemsByCategory: { [category: string]: number } = {};
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

  // Search menu items
  async searchMenuItems(query: string): Promise<MenuItem[]> {
    // Always reload from file to get latest data
    await this.loadMenuItems();
    const searchTerm = query.toLowerCase();
    
    return this.menuItems.filter(item => 
      item.isAvailable !== false && (
        item.name.toLowerCase().includes(searchTerm) ||
        item.description.toLowerCase().includes(searchTerm) ||
        item.category.toLowerCase().includes(searchTerm) ||
        item.tags.some(tag => tag.toLowerCase().includes(searchTerm)) ||
        (item.ingredients && item.ingredients.some(ingredient => 
          ingredient.toLowerCase().includes(searchTerm)
        ))
      )
    );
  }
}