import { Router } from 'express';
import { GalleryController } from '../controllers/gallery.controller';
const { authenticate } = require('../middleware/auth');

const router = Router();
const galleryController = new GalleryController();

// Public routes
router.get('/', galleryController.getAllGalleryItems);
router.get('/stats', authenticate, galleryController.getGalleryStatistics);
router.get('/:id', galleryController.getGalleryItemById);

// Admin routes (Protected with JWT authentication)
router.post('/', authenticate, galleryController.createGalleryItem);
router.put('/:id', authenticate, galleryController.updateGalleryItem);
router.delete('/:id', authenticate, galleryController.deleteGalleryItem);

export default router;

