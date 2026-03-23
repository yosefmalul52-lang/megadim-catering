"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const gallery_controller_1 = require("../controllers/gallery.controller");
const { authenticate, authorize } = require('../middleware/auth');
const router = (0, express_1.Router)();
const galleryController = new gallery_controller_1.GalleryController();
// Public routes
router.get('/', galleryController.getAllGalleryItems);
router.get('/:id', galleryController.getGalleryItemById);
// Admin-only: stats and mutations
router.get('/stats', authenticate, authorize('admin'), galleryController.getGalleryStatistics);
router.post('/', authenticate, authorize('admin'), galleryController.createGalleryItem);
router.put('/:id', authenticate, authorize('admin'), galleryController.updateGalleryItem);
router.delete('/:id', authenticate, authorize('admin'), galleryController.deleteGalleryItem);
exports.default = router;
