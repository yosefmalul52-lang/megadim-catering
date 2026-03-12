import { Router } from 'express';
import { GalleryController } from '../controllers/gallery.controller';
const { authenticate, authorize } = require('../middleware/auth');

const router = Router();
const galleryController = new GalleryController();

// Public routes
router.get('/', galleryController.getAllGalleryItems);
router.get('/:id', galleryController.getGalleryItemById);

// Admin-only: stats and mutations
router.get('/stats', authenticate, authorize('admin'), galleryController.getGalleryStatistics);
router.post('/', authenticate, authorize('admin'), galleryController.createGalleryItem);
router.put('/:id', authenticate, authorize('admin'), galleryController.updateGalleryItem);
router.delete('/:id', authenticate, authorize('admin'), galleryController.deleteGalleryItem);

export default router;

