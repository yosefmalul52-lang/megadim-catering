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
exports.ShoppingService = void 0;
const Order_1 = __importDefault(require("../models/Order"));
const menuItem_1 = __importDefault(require("../models/menuItem"));
class ShoppingService {
    /**
     * Get shopping list based on active orders
     * Calculates total quantities of raw materials needed
     */
    getShoppingList() {
        return __awaiter(this, arguments, void 0, function* (safetyMargin = 0) {
            try {
                console.log('🛒 ShoppingService: Generating Shopping List...');
                console.log('🛒 Safety margin:', safetyMargin);
                // Fetch all orders except cancelled (relaxed query)
                const activeOrders = yield Order_1.default.find({
                    status: { $ne: 'cancelled' }
                }).lean();
                console.log('🛒 Found Active Orders:', activeOrders.length);
                if (activeOrders.length === 0) {
                    console.log('⚠️ No active orders found');
                    return {};
                }
                // Aggregate ingredients from all orders
                const ingredientMap = {};
                for (const order of activeOrders) {
                    console.log('🛒 Processing Order:', order._id, 'Status:', order.status);
                    for (const item of order.items || []) {
                        const orderQuantity = item.quantity || 1;
                        const itemName = item.name || 'Unknown Item';
                        const productId = item.productId || item.product;
                        if (!productId) {
                            console.warn('⚠️ Order item missing productId:', item);
                            // Fallback: treat the item itself as an ingredient
                            const key = `${itemName}_piece_General`;
                            if (ingredientMap[key]) {
                                ingredientMap[key].total += orderQuantity;
                            }
                            else {
                                ingredientMap[key] = {
                                    name: itemName,
                                    total: orderQuantity,
                                    unit: 'piece',
                                    category: 'General'
                                };
                            }
                            continue;
                        }
                        // Check if productId is a valid ObjectId format
                        const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(String(productId));
                        let product;
                        if (isValidObjectId) {
                            product = yield menuItem_1.default.findById(productId).lean();
                        }
                        else {
                            // Try to find by name
                            console.log(`🛒 Invalid ObjectId format: "${productId}", trying to find by name: "${itemName}"`);
                            product = yield menuItem_1.default.findOne({ name: itemName }).lean();
                        }
                        if (!product) {
                            console.warn('⚠️ Product not found for item:', { itemName, productId: item.productId || item.product });
                            // Fallback: treat the item itself as an ingredient
                            const key = `${itemName}_piece_General`;
                            if (ingredientMap[key]) {
                                ingredientMap[key].total += orderQuantity;
                            }
                            else {
                                ingredientMap[key] = {
                                    name: itemName,
                                    total: orderQuantity,
                                    unit: 'piece',
                                    category: 'General'
                                };
                            }
                            continue;
                        }
                        const productName = product.name || itemName;
                        const productRecipe = product.recipe;
                        const hasRecipe = productRecipe && Array.isArray(productRecipe) && productRecipe.length > 0;
                        console.log(`🛒 Processing Item: ${productName}, Order Qty: ${orderQuantity}, Has Recipe: ${hasRecipe ? productRecipe.length : 0} items`);
                        // Determine ingredients to process - use fallback if no recipe
                        let ingredientsToProcess = [];
                        if (!hasRecipe) {
                            console.log(`ℹ️ Product "${productName}" has no recipe - using fallback: treating product as ingredient`);
                            // Fallback: Create a temporary ingredient representing the product itself
                            ingredientsToProcess = [{
                                    name: productName,
                                    quantity: 1,
                                    unit: 'יחידות',
                                    category: 'כללי / מוצרים ללא מתכון'
                                }];
                        }
                        else {
                            // Use the actual recipe
                            ingredientsToProcess = productRecipe;
                        }
                        // Process all ingredients (either from recipe or fallback)
                        for (const ingredient of ingredientsToProcess) {
                            if (!ingredient.name || !ingredient.unit || !ingredient.category) {
                                console.warn('⚠️ Invalid ingredient format:', ingredient);
                                continue;
                            }
                            const totalQuantity = orderQuantity * (ingredient.quantity || 1);
                            // Create unique key: name + unit + category
                            const key = `${ingredient.name}_${ingredient.unit}_${ingredient.category}`;
                            if (ingredientMap[key]) {
                                // Add to existing ingredient
                                ingredientMap[key].total += totalQuantity;
                                console.log(`  ➕ Added ${totalQuantity} ${ingredient.unit} of ${ingredient.name} (Total: ${ingredientMap[key].total})`);
                            }
                            else {
                                // Create new ingredient entry
                                ingredientMap[key] = {
                                    name: ingredient.name,
                                    total: totalQuantity,
                                    unit: ingredient.unit,
                                    category: ingredient.category
                                };
                                console.log(`  ✨ New ingredient: ${ingredient.name} (${totalQuantity} ${ingredient.unit})`);
                            }
                        }
                    }
                }
                // Apply safety margin if provided
                if (safetyMargin > 0) {
                    Object.keys(ingredientMap).forEach(key => {
                        ingredientMap[key].total = ingredientMap[key].total * (1 + safetyMargin / 100);
                    });
                }
                // Group by category
                const groupedByCategory = {};
                Object.values(ingredientMap).forEach(item => {
                    if (!groupedByCategory[item.category]) {
                        groupedByCategory[item.category] = [];
                    }
                    groupedByCategory[item.category].push(item);
                });
                // Sort items within each category by name
                Object.keys(groupedByCategory).forEach(category => {
                    groupedByCategory[category].sort((a, b) => a.name.localeCompare(b.name));
                });
                console.log('🛒 Shopping list generated:', Object.keys(groupedByCategory).length, 'categories');
                console.log('🛒 Total unique ingredients:', Object.keys(ingredientMap).length);
                return groupedByCategory;
            }
            catch (error) {
                console.error('❌ ShoppingService: Error generating shopping list:', error);
                throw new Error(`Failed to generate shopping list: ${error.message}`);
            }
        });
    }
}
exports.ShoppingService = ShoppingService;
