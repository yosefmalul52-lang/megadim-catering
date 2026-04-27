"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const gallery_controller_1 = require("../controllers/gallery.controller");
const { authenticate } = require('../middleware/auth');
const { requireAdmin } = require('../config/role-access');
const router = (0, express_1.Router)();
const galleryController = new gallery_controller_1.GalleryController();
// Public routes
router.get('/', galleryController.getAllGalleryItems);
router.get('/:id', galleryController.getGalleryItemById);
// Admin-only: stats and mutations
router.get('/stats', authenticate, requireAdmin, galleryController.getGalleryStatistics);
router.post('/', authenticate, requireAdmin, galleryController.createGalleryItem);
router.put('/:id', authenticate, requireAdmin, galleryController.updateGalleryItem);
router.delete('/:id', authenticate, requireAdmin, galleryController.deleteGalleryItem);
exports.default = router;
