"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShoppingController = void 0;
const shopping_service_1 = require("../services/shopping.service");
const errorHandler_1 = require("../middleware/errorHandler");
class ShoppingController {
    shoppingService;
    constructor() {
        this.shoppingService = new shopping_service_1.ShoppingService();
    }
    getShoppingList = (0, errorHandler_1.asyncHandler)(async (req, res) => {
        try {
            const safetyMargin = parseInt(req.query.safetyMargin) || 0;
            console.log('🛒 ShoppingController: Generating shopping list');
            console.log('🛒 Safety margin:', safetyMargin);
            const shoppingList = await this.shoppingService.getShoppingList(safetyMargin);
            res.status(200).json({
                success: true,
                data: shoppingList,
                timestamp: new Date().toISOString()
            });
        }
        catch (error) {
            console.error('❌ ShoppingController: Error:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Failed to generate shopping list',
                error: process.env.NODE_ENV === 'development' ? error.stack : undefined
            });
        }
    });
}
exports.ShoppingController = ShoppingController;
//# sourceMappingURL=shopping.controller.js.map