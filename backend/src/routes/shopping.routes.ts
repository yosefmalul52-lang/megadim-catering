import express, { Request, Response } from 'express';
import { ShoppingController } from '../controllers/shopping.controller';

const router = express.Router();
const shoppingController = new ShoppingController();

// Import authenticate middleware
const { authenticate, authorize } = require('../middleware/auth');

// Admin-only: shopping list
router.get('/', authenticate, authorize('admin'), shoppingController.getShoppingList);

export default router;

