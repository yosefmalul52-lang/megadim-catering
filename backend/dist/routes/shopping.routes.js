"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const shopping_controller_1 = require("../controllers/shopping.controller");
const router = express_1.default.Router();
const shoppingController = new shopping_controller_1.ShoppingController();
// Import authenticate middleware
const { authenticate } = require('../middleware/auth');
// Get shopping list (Protected - Admin only)
router.get('/', authenticate, shoppingController.getShoppingList);
exports.default = router;
