"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const gallery_controller_1 = require("../controllers/gallery.controller");
const { authenticate } = require('../middleware/auth');
const router = (0, express_1.Router)();
const galleryController = new gallery_controller_1.GalleryController();
router.get('/', galleryController.getAllGalleryItems);
router.get('/stats', authenticate, galleryController.getGalleryStatistics);
router.get('/:id', galleryController.getGalleryItemById);
router.post('/', authenticate, galleryController.createGalleryItem);
router.put('/:id', authenticate, galleryController.updateGalleryItem);
router.delete('/:id', authenticate, galleryController.deleteGalleryItem);
exports.default = router;
//# sourceMappingURL=gallery.routes.js.map