"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const video_controller_1 = require("../controllers/video.controller");
const { authenticate } = require('../middleware/auth');
const { requireAdmin } = require('../config/role-access');
const router = (0, express_1.Router)();
const videoController = new video_controller_1.VideoController();
// Public routes
router.get('/', videoController.getVideos);
router.get('/:id', videoController.getVideoById);
// Admin-only: stats and mutations
router.get('/stats', authenticate, requireAdmin, videoController.getVideoStatistics);
router.post('/', authenticate, requireAdmin, videoController.addVideo);
router.put('/:id', authenticate, requireAdmin, videoController.updateVideo);
router.delete('/:id', authenticate, requireAdmin, videoController.deleteVideo);
exports.default = router;
