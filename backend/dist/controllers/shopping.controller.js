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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShoppingController = void 0;
const shopping_service_1 = require("../services/shopping.service");
const errorHandler_1 = require("../middleware/errorHandler");
class ShoppingController {
    constructor() {
        // Get shopping list based on active orders
        this.getShoppingList = (0, errorHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                // Get safety margin from query params (default: 0)
                const safetyMargin = parseInt(req.query.safetyMargin) || 0;
                console.log('🛒 ShoppingController: Generating shopping list');
                console.log('🛒 Safety margin:', safetyMargin);
                const shoppingList = yield this.shoppingService.getShoppingList(safetyMargin);
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
        }));
        this.shoppingService = new shopping_service_1.ShoppingService();
    }
}
exports.ShoppingController = ShoppingController;
