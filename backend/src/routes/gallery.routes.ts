import { Router } from 'express';
import { GalleryController } from '../controllers/gallery.controller';
const { authenticate } = require('../middleware/auth');
const { requireAdmin } = require('../config/role-access');

const router = Router();
const galleryController = new GalleryController();

// Public routes
router.get('/', galleryController.getAllGalleryItems);
router.get('/:id', galleryController.getGalleryItemById);

// Admin-only: stats and mutations
router.get('/stats', authenticate, requireAdmin, galleryController.getGalleryStatistics);
router.post('/', authenticate, requireAdmin, galleryController.createGalleryItem);
router.put('/:id', authenticate, requireAdmin, galleryController.updateGalleryItem);
router.delete('/:id', authenticate, requireAdmin, galleryController.deleteGalleryItem);

export default router;

