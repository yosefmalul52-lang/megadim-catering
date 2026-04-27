import express, { Request, Response } from 'express';
import { ShoppingController } from '../controllers/shopping.controller';

const router = express.Router();
const shoppingController = new ShoppingController();

// Import authenticate middleware
const { authenticate } = require('../middleware/auth');
const { requireCapability, CAP } = require('../config/role-access');

// Admin-only: shopping list
router.get('/', authenticate, requireCapability(CAP.SHOPPING_LIST), shoppingController.getShoppingList);

export default router;

