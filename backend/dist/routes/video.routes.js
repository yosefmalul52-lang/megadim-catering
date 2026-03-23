"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const video_controller_1 = require("../controllers/video.controller");
const { authenticate, authorize } = require('../middleware/auth');
const router = (0, express_1.Router)();
const videoController = new video_controller_1.VideoController();
// Public routes
router.get('/', videoController.getVideos);
router.get('/:id', videoController.getVideoById);
// Admin-only: stats and mutations
router.get('/stats', authenticate, authorize('admin'), videoController.getVideoStatistics);
router.post('/', authenticate, authorize('admin'), videoController.addVideo);
router.put('/:id', authenticate, authorize('admin'), videoController.updateVideo);
router.delete('/:id', authenticate, authorize('admin'), videoController.deleteVideo);
exports.default = router;
