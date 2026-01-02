import { Request, Response } from 'express';
import { ShoppingService } from '../services/shopping.service';
import { asyncHandler } from '../middleware/errorHandler';

export class ShoppingController {
  private shoppingService: ShoppingService;

  constructor() {
    this.shoppingService = new ShoppingService();
  }

  // Get shopping list based on active orders
  getShoppingList = asyncHandler(async (req: Request, res: Response) => {
    try {
      // Get safety margin from query params (default: 0)
      const safetyMargin = parseInt(req.query.safetyMargin as string) || 0;
      
      console.log('🛒 ShoppingController: Generating shopping list');
      console.log('🛒 Safety margin:', safetyMargin);

      const shoppingList = await this.shoppingService.getShoppingList(safetyMargin);

      res.status(200).json({
        success: true,
        data: shoppingList,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('❌ ShoppingController: Error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to generate shopping list',
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  });
}

