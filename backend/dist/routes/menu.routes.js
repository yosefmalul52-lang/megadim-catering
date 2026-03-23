"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const menu_controller_1 = require("../controllers/menu.controller");
const { authenticate, authorize } = require('../middleware/auth');
const router = (0, express_1.Router)();
const menuController = new menu_controller_1.MenuController();
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
router.post('/', authenticate, authorize('admin'), menuController.createMenuItem);
router.post('/migrate-cholent-desserts-category', authenticate, authorize('admin'), menuController.migrateCholentDessertsCategory);
router.put('/reorder', authenticate, authorize('admin'), menuController.reorderMenuItems);
router.put('/:id', authenticate, authorize('admin'), menuController.updateMenuItem);
router.delete('/:id', authenticate, authorize('admin'), menuController.deleteMenuItem);
exports.default = router;
