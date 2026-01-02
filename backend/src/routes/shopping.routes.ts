import express, { Request, Response } from 'express';
import { ShoppingController } from '../controllers/shopping.controller';

const router = express.Router();
const shoppingController = new ShoppingController();

// Import authenticate middleware
const { authenticate } = require('../middleware/auth');

// Get shopping list (Protected - Admin only)
router.get('/', authenticate, shoppingController.getShoppingList);

export default router;

