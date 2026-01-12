"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VideoController = void 0;
const errorHandler_1 = require("../middleware/errorHandler");
const Video = require('../models/Video');
// Helper function to extract YouTube video ID from URL
// Supports both standard format (v=...) and Shorts format (/shorts/...)
function extractYouTubeId(url) {
    if (!url || typeof url !== 'string') {
        return null;
    }
    // Patterns for different YouTube URL formats
    const patterns = [
        // Standard: https://www.youtube.com/watch?v=VIDEO_ID
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
        // Shorts: https://www.youtube.com/shorts/VIDEO_ID
        /youtube\.com\/shorts\/([^&\n?#]+)/,
        // Alternative: youtube.com/watch?v=VIDEO_ID&...
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
// Helper function to generate YouTube thumbnail URL
function generateYouTubeThumbnail(videoId) {
    return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}
class VideoController {
    constructor() {
        // Get all videos
        this.getVideos = (0, errorHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const { active } = req.query;
            const query = {};
            if (active !== undefined) {
                query.isActive = active === 'true';
            }
            else {
                // Default to showing only active videos for public access
                query.isActive = true;
            }
            const videos = yield Video.find(query)
                .sort({ order: 1, createdAt: -1 });
            res.status(200).json({
                success: true,
                data: videos,
                count: videos.length,
                timestamp: new Date().toISOString()
            });
        }));
        // Get video by ID
        this.getVideoById = (0, errorHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params;
            if (!id) {
                throw (0, errorHandler_1.createValidationError)('Video ID is required');
            }
            const video = yield Video.findById(id);
            if (!video) {
                throw (0, errorHandler_1.createNotFoundError)('Video not found');
            }
            res.status(200).json({
                success: true,
                data: video,
                timestamp: new Date().toISOString()
            });
        }));
        // Add new video
        this.addVideo = (0, errorHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const { title, youtubeUrl } = req.body;
            // Validation
            if (!title || title.trim() === '') {
                throw (0, errorHandler_1.createValidationError)('Title is required');
            }
            if (!youtubeUrl || youtubeUrl.trim() === '') {
                throw (0, errorHandler_1.createValidationError)('YouTube URL is required');
            }
            // Extract video ID from URL
            const videoId = extractYouTubeId(youtubeUrl);
            if (!videoId) {
                throw (0, errorHandler_1.createValidationError)('Invalid YouTube URL. Please provide a valid YouTube video URL.');
            }
            // Check if video with this ID already exists
            const existingVideo = yield Video.findOne({ videoId });
            if (existingVideo) {
                throw (0, errorHandler_1.createValidationError)('Video with this URL already exists');
            }
            // Generate thumbnail URL
            const thumbnailUrl = generateYouTubeThumbnail(videoId);
            // Create video
            const video = new Video({
                title: title.trim(),
                youtubeUrl: youtubeUrl.trim(),
                videoId,
                thumbnailUrl,
                order: 0,
                isActive: true
            });
            const savedVideo = yield video.save();
            res.status(201).json({
                success: true,
                message: 'Video added successfully',
                data: savedVideo,
                timestamp: new Date().toISOString()
            });
        }));
        // Update video
        this.updateVideo = (0, errorHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params;
            const { title, youtubeUrl, order, isActive } = req.body;
            if (!id) {
                throw (0, errorHandler_1.createValidationError)('Video ID is required');
            }
            const video = yield Video.findById(id);
            if (!video) {
                throw (0, errorHandler_1.createNotFoundError)('Video not found');
            }
            // Update fields
            if (title !== undefined)
                video.title = title.trim();
            if (youtubeUrl !== undefined) {
                const videoId = extractYouTubeId(youtubeUrl);
                if (!videoId) {
                    throw (0, errorHandler_1.createValidationError)('Invalid YouTube URL');
                }
                // Check if another video with this ID exists
                const existingVideo = yield Video.findOne({ videoId, _id: { $ne: id } });
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
            const updatedVideo = yield video.save();
            res.status(200).json({
                success: true,
                message: 'Video updated successfully',
                data: updatedVideo,
                timestamp: new Date().toISOString()
            });
        }));
        // Delete video
        this.deleteVideo = (0, errorHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params;
            if (!id) {
                throw (0, errorHandler_1.createValidationError)('Video ID is required');
            }
            const video = yield Video.findByIdAndDelete(id);
            if (!video) {
                throw (0, errorHandler_1.createNotFoundError)('Video not found');
            }
            res.status(200).json({
                success: true,
                message: 'Video deleted successfully',
                timestamp: new Date().toISOString()
            });
        }));
        // Get video statistics (Admin only)
        this.getVideoStatistics = (0, errorHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const totalVideos = yield Video.countDocuments();
            const activeVideos = yield Video.countDocuments({ isActive: true });
            res.status(200).json({
                success: true,
                data: {
                    total: totalVideos,
                    active: activeVideos,
                    inactive: totalVideos - activeVideos
                },
                timestamp: new Date().toISOString()
            });
        }));
    }
}
exports.VideoController = VideoController;
