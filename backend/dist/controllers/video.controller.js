"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VideoController = void 0;
const errorHandler_1 = require("../middleware/errorHandler");
const Video = require('../models/Video');
function extractYouTubeId(url) {
    if (!url || typeof url !== 'string') {
        return null;
    }
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
        /youtube\.com\/shorts\/([^&\n?#]+)/,
        /youtube\.com\/.*[?&]v=([^&\n?#]+)/
    ];
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) {
            return match[1];
        }
    }
    return null;
}
function generateYouTubeThumbnail(videoId) {
    return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}
class VideoController {
    getVideos = (0, errorHandler_1.asyncHandler)(async (req, res) => {
        const { active } = req.query;
        const query = {};
        if (active !== undefined) {
            query.isActive = active === 'true';
        }
        else {
            query.isActive = true;
        }
        const videos = await Video.find(query)
            .sort({ order: 1, createdAt: -1 });
        res.status(200).json({
            success: true,
            data: videos,
            count: videos.length,
            timestamp: new Date().toISOString()
        });
    });
    getVideoById = (0, errorHandler_1.asyncHandler)(async (req, res) => {
        const { id } = req.params;
        if (!id) {
            throw (0, errorHandler_1.createValidationError)('Video ID is required');
        }
        const video = await Video.findById(id);
        if (!video) {
            throw (0, errorHandler_1.createNotFoundError)('Video not found');
        }
        res.status(200).json({
            success: true,
            data: video,
            timestamp: new Date().toISOString()
        });
    });
    addVideo = (0, errorHandler_1.asyncHandler)(async (req, res) => {
        const { title, youtubeUrl } = req.body;
        if (!title || title.trim() === '') {
            throw (0, errorHandler_1.createValidationError)('Title is required');
        }
        if (!youtubeUrl || youtubeUrl.trim() === '') {
            throw (0, errorHandler_1.createValidationError)('YouTube URL is required');
        }
        const videoId = extractYouTubeId(youtubeUrl);
        if (!videoId) {
            throw (0, errorHandler_1.createValidationError)('Invalid YouTube URL. Please provide a valid YouTube video URL.');
        }
        const existingVideo = await Video.findOne({ videoId });
        if (existingVideo) {
            throw (0, errorHandler_1.createValidationError)('Video with this URL already exists');
        }
        const thumbnailUrl = generateYouTubeThumbnail(videoId);
        const video = new Video({
            title: title.trim(),
            youtubeUrl: youtubeUrl.trim(),
            videoId,
            thumbnailUrl,
            order: 0,
            isActive: true
        });
        const savedVideo = await video.save();
        res.status(201).json({
            success: true,
            message: 'Video added successfully',
            data: savedVideo,
            timestamp: new Date().toISOString()
        });
    });
    updateVideo = (0, errorHandler_1.asyncHandler)(async (req, res) => {
        const { id } = req.params;
        const { title, youtubeUrl, order, isActive } = req.body;
        if (!id) {
            throw (0, errorHandler_1.createValidationError)('Video ID is required');
        }
        const video = await Video.findById(id);
        if (!video) {
            throw (0, errorHandler_1.createNotFoundError)('Video not found');
        }
        if (title !== undefined)
            video.title = title.trim();
        if (youtubeUrl !== undefined) {
            const videoId = extractYouTubeId(youtubeUrl);
            if (!videoId) {
                throw (0, errorHandler_1.createValidationError)('Invalid YouTube URL');
            }
            const existingVideo = await Video.findOne({ videoId, _id: { $ne: id } });
            if (existingVideo) {
                throw (0, errorHandler_1.createValidationError)('Video with this URL already exists');
            }
            video.youtubeUrl = youtubeUrl.trim();
            video.videoId = videoId;
            video.thumbnailUrl = generateYouTubeThumbnail(videoId);
        }
        if (order !== undefined)
            video.order = order;
        if (isActive !== undefined)
            video.isActive = isActive;
        const updatedVideo = await video.save();
        res.status(200).json({
            success: true,
            message: 'Video updated successfully',
            data: updatedVideo,
            timestamp: new Date().toISOString()
        });
    });
    deleteVideo = (0, errorHandler_1.asyncHandler)(async (req, res) => {
        const { id } = req.params;
        if (!id) {
            throw (0, errorHandler_1.createValidationError)('Video ID is required');
        }
        const video = await Video.findByIdAndDelete(id);
        if (!video) {
            throw (0, errorHandler_1.createNotFoundError)('Video not found');
        }
        res.status(200).json({
            success: true,
            message: 'Video deleted successfully',
            timestamp: new Date().toISOString()
        });
    });
    getVideoStatistics = (0, errorHandler_1.asyncHandler)(async (req, res) => {
        const totalVideos = await Video.countDocuments();
        const activeVideos = await Video.countDocuments({ isActive: true });
        res.status(200).json({
            success: true,
            data: {
                total: totalVideos,
                active: activeVideos,
                inactive: totalVideos - activeVideos
            },
            timestamp: new Date().toISOString()
        });
    });
}
exports.VideoController = VideoController;
//# sourceMappingURL=video.controller.js.map