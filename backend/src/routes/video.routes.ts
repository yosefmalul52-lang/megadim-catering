import { Router } from 'express';
import { VideoController } from '../controllers/video.controller';
const { authenticate } = require('../middleware/auth');

const router = Router();
const videoController = new VideoController();

// Public routes
router.get('/', videoController.getVideos);
router.get('/stats', authenticate, videoController.getVideoStatistics);
router.get('/:id', videoController.getVideoById);

// Admin routes (Protected with JWT authentication)
router.post('/', authenticate, videoController.addVideo);
router.put('/:id', authenticate, videoController.updateVideo);
router.delete('/:id', authenticate, videoController.deleteVideo);

export default router;

