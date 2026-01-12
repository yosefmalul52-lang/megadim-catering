"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const video_controller_1 = require("../controllers/video.controller");
const { authenticate } = require('../middleware/auth');
const router = (0, express_1.Router)();
const videoController = new video_controller_1.VideoController();
router.get('/', videoController.getVideos);
router.get('/stats', authenticate, videoController.getVideoStatistics);
router.get('/:id', videoController.getVideoById);
router.post('/', authenticate, videoController.addVideo);
router.put('/:id', authenticate, videoController.updateVideo);
router.delete('/:id', authenticate, videoController.deleteVideo);
exports.default = router;
//# sourceMappingURL=video.routes.js.map