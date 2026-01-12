"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShoppingService = void 0;
const Order_1 = __importDefault(require("../models/Order"));
const menuItem_1 = __importDefault(require("../models/menuItem"));
class ShoppingService {
    async getShoppingList(safetyMargin = 0) {
        try {
            console.log('🛒 ShoppingService: Generating Shopping List...');
            console.log('🛒 Safety margin:', safetyMargin);
            const activeOrders = await Order_1.default.find({
                status: { $ne: 'cancelled' }
            }).lean();
            console.log('🛒 Found Active Orders:', activeOrders.length);
            if (activeOrders.length === 0) {
                console.log('⚠️ No active orders found');
                return {};
            }
            const ingredientMap = {};
            for (const order of activeOrders) {
                console.log('🛒 Processing Order:', order._id, 'Status:', order.status);
                for (const item of order.items || []) {
                    const orderQuantity = item.quantity || 1;
                    const itemName = item.name || 'Unknown Item';
                    const productId = item.productId || item.product;
                    if (!productId) {
                        console.warn('⚠️ Order item missing productId:', item);
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
                    const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(String(productId));
                    let product;
                    if (isValidObjectId) {
                        product = await menuItem_1.default.findById(productId).lean();
                    }
                    else {
                        console.log(`🛒 Invalid ObjectId format: "${productId}", trying to find by name: "${itemName}"`);
                        product = await menuItem_1.default.findOne({ name: itemName }).lean();
                    }
                    if (!product) {
                        console.warn('⚠️ Product not found for item:', { itemName, productId: item.productId || item.product });
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
                    let ingredientsToProcess = [];
                    if (!hasRecipe) {
                        console.log(`ℹ️ Product "${productName}" has no recipe - using fallback: treating product as ingredient`);
                        ingredientsToProcess = [{
                                name: productName,
                                quantity: 1,
                                unit: 'יחידות',
                                category: 'כללי / מוצרים ללא מתכון'
                            }];
                    }
                    else {
                        ingredientsToProcess = productRecipe;
                    }
                    for (const ingredient of ingredientsToProcess) {
                        if (!ingredient.name || !ingredient.unit || !ingredient.category) {
                            console.warn('⚠️ Invalid ingredient format:', ingredient);
                            continue;
                        }
                        const totalQuantity = orderQuantity * (ingredient.quantity || 1);
                        const key = `${ingredient.name}_${ingredient.unit}_${ingredient.category}`;
                        if (ingredientMap[key]) {
                            ingredientMap[key].total += totalQuantity;
                            console.log(`  ➕ Added ${totalQuantity} ${ingredient.unit} of ${ingredient.name} (Total: ${ingredientMap[key].total})`);
                        }
                        else {
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
            if (safetyMargin > 0) {
                Object.keys(ingredientMap).forEach(key => {
                    ingredientMap[key].total = ingredientMap[key].total * (1 + safetyMargin / 100);
                });
            }
            const groupedByCategory = {};
            Object.values(ingredientMap).forEach(item => {
                if (!groupedByCategory[item.category]) {
                    groupedByCategory[item.category] = [];
                }
                groupedByCategory[item.category].push(item);
            });
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
    }
}
exports.ShoppingService = ShoppingService;
//# sourceMappingURL=shopping.service.js.map