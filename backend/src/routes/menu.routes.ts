import { Router } from 'express';
import { MenuController } from '../controllers/menu.controller';
const { authenticate } = require('../middleware/auth');

const router = Router();
const menuController = new MenuController();

/**
 * Menu API (mounted at /api/menu):
 * - GET    /           → getAllMenuItems (public)
 * - GET    /:id         → getMenuItemById (public)
 * - GET    /category/:category, /popular, /categories, /stats (public)
 * - POST   /            → createMenuItem (admin only)
 * - PUT    /:id         → updateMenuItem (admin only)
 * - DELETE /:id         → deleteMenuItem (admin only)
 */
// Public routes
router.get('/', menuController.getAllMenuItems);
router.get('/popular', menuController.getPopularMenuItems);
router.get('/categories', menuController.getMenuCategories);
router.get('/category/:category', menuController.getMenuItemsByCategory);
router.get('/stats', menuController.getMenuStatistics);
router.get('/:id', menuController.getMenuItemById);

// Admin routes (protected with JWT authenticate middleware)
router.post('/', authenticate, menuController.createMenuItem);
router.post('/migrate-cholent-desserts-category', authenticate, menuController.migrateCholentDessertsCategory);
router.put('/reorder', authenticate, menuController.reorderMenuItems);
router.put('/:id', authenticate, menuController.updateMenuItem);
router.delete('/:id', authenticate, menuController.deleteMenuItem);

export default router;
