import { Router } from 'express';
import { VideoController } from '../controllers/video.controller';
const { authenticate, authorize } = require('../middleware/auth');

const router = Router();
const videoController = new VideoController();

// Public routes
router.get('/', videoController.getVideos);
router.get('/:id', videoController.getVideoById);

// Admin-only: stats and mutations
router.get('/stats', authenticate, authorize('admin'), videoController.getVideoStatistics);
router.post('/', authenticate, authorize('admin'), videoController.addVideo);
router.put('/:id', authenticate, authorize('admin'), videoController.updateVideo);
router.delete('/:id', authenticate, authorize('admin'), videoController.deleteVideo);

export default router;

