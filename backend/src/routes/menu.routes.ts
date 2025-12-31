import { Router } from 'express';
import { MenuController } from '../controllers/menu.controller';
const { authenticate } = require('../middleware/auth');

const router = Router();
const menuController = new MenuController();

// Public routes
router.get('/', menuController.getAllMenuItems);
router.get('/popular', menuController.getPopularMenuItems);
router.get('/categories', menuController.getMenuCategories);
router.get('/category/:category', menuController.getMenuItemsByCategory);
router.get('/stats', menuController.getMenuStatistics);
router.get('/:id', menuController.getMenuItemById);

// Admin routes (Protected with JWT authentication)
router.post('/', authenticate, menuController.createMenuItem);
router.put('/:id', authenticate, menuController.updateMenuItem);
router.delete('/:id', authenticate, menuController.deleteMenuItem);

export default router;
