import { Router } from 'express';
import { MenuController } from '../controllers/menu.controller';
const { authenticate } = require('../middleware/auth');
const { requireAdmin } = require('../config/role-access');

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

// Admin-only routes
router.post('/', authenticate, requireAdmin, menuController.createMenuItem);
router.post('/migrate-cholent-desserts-category', authenticate, requireAdmin, menuController.migrateCholentDessertsCategory);
router.put('/reorder', authenticate, requireAdmin, menuController.reorderMenuItems);
router.put('/:id', authenticate, requireAdmin, menuController.updateMenuItem);
router.delete('/:id', authenticate, requireAdmin, menuController.deleteMenuItem);

export default router;
