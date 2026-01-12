"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const menu_controller_1 = require("../controllers/menu.controller");
const { authenticate } = require('../middleware/auth');
const router = (0, express_1.Router)();
const menuController = new menu_controller_1.MenuController();
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
exports.default = router;
