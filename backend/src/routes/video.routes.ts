import { Router } from 'express';
import { VideoController } from '../controllers/video.controller';
const { authenticate } = require('../middleware/auth');
const { requireAdmin } = require('../config/role-access');

const router = Router();
const videoController = new VideoController();

// Public routes
router.get('/', videoController.getVideos);

// Admin-only: stats MUST be before /:id
router.get('/stats', authenticate, requireAdmin, videoController.getVideoStatistics);

router.get('/:id', videoController.getVideoById);

// Admin mutations
router.post('/', authenticate, requireAdmin, videoController.addVideo);
router.put('/:id', authenticate, requireAdmin, videoController.updateVideo);
router.delete('/:id', authenticate, requireAdmin, videoController.deleteVideo);

export default router;
