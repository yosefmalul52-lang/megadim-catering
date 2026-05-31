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
exports.generateCloudinaryThumbnail = generateCloudinaryThumbnail;
const errorHandler_1 = require("../middleware/errorHandler");
const Video = require('../models/Video');
function resolveSource(value, doc) {
    var _j;
    if (value === 'cloudinary' || value === 'youtube') {
        return value;
    }
    if ((doc === null || doc === void 0 ? void 0 : doc.source) === 'cloudinary' || (doc === null || doc === void 0 ? void 0 : doc.source) === 'youtube') {
        return doc.source;
    }
    if ((_j = doc === null || doc === void 0 ? void 0 : doc.videoUrl) === null || _j === void 0 ? void 0 : _j.trim()) {
        return 'cloudinary';
    }
    return 'youtube';
}
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
/** Derive a poster/thumbnail URL from a Cloudinary video delivery URL. */
function generateCloudinaryThumbnail(videoUrl) {
    if (!videoUrl || typeof videoUrl !== 'string') {
        return '';
    }
    return videoUrl.replace(/\.(mp4|webm|mov|quicktime)(\?.*)?$/i, '.jpg$2');
}
class VideoController {
    constructor() {
        this.getVideos = (0, errorHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const { active } = req.query;
            const query = {};
            const includeAll = req.query.includeAll === 'true';
            if (active === 'true') {
                query.isActive = true;
            }
            else if (active === 'false') {
                query.isActive = false;
            }
            else if (includeAll) {
                // Admin: all videos
            }
            else {
                // Public default: active only
                query.isActive = true;
            }
            const videos = yield Video.find(query).sort({ order: 1, createdAt: -1 });
            res.status(200).json({
                success: true,
                data: videos,
                count: videos.length,
                timestamp: new Date().toISOString()
            });
        }));
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
        this.addVideo = (0, errorHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const { title, source: sourceRaw, youtubeUrl, videoUrl, publicId, thumbnailUrl } = req.body;
            if (!title || typeof title !== 'string' || title.trim() === '') {
                throw (0, errorHandler_1.createValidationError)('Title is required');
            }
            const source = resolveSource(sourceRaw);
            if (source === 'youtube') {
                if (!youtubeUrl || typeof youtubeUrl !== 'string' || youtubeUrl.trim() === '') {
                    throw (0, errorHandler_1.createValidationError)('YouTube URL is required when source is youtube');
                }
                const ytVideoId = extractYouTubeId(youtubeUrl);
                if (!ytVideoId) {
                    throw (0, errorHandler_1.createValidationError)('Invalid YouTube URL. Please provide a valid YouTube video URL.');
                }
                const existingVideo = yield Video.findOne({ videoId: ytVideoId });
                if (existingVideo) {
                    throw (0, errorHandler_1.createValidationError)('Video with this URL already exists');
                }
                const video = new Video({
                    title: title.trim(),
                    source: 'youtube',
                    youtubeUrl: youtubeUrl.trim(),
                    videoId: ytVideoId,
                    thumbnailUrl: generateYouTubeThumbnail(ytVideoId),
                    order: 0,
                    isActive: true
                });
                const savedVideo = yield video.save();
                return res.status(201).json({
                    success: true,
                    message: 'Video added successfully',
                    data: savedVideo,
                    timestamp: new Date().toISOString()
                });
            }
            // cloudinary
            if (!videoUrl || typeof videoUrl !== 'string' || videoUrl.trim() === '') {
                throw (0, errorHandler_1.createValidationError)('videoUrl is required when source is cloudinary');
            }
            const trimmedVideoUrl = videoUrl.trim();
            const trimmedPublicId = typeof publicId === 'string' ? publicId.trim() : '';
            if (trimmedPublicId) {
                const existingByPublicId = yield Video.findOne({ publicId: trimmedPublicId });
                if (existingByPublicId) {
                    throw (0, errorHandler_1.createValidationError)('Video with this Cloudinary public ID already exists');
                }
            }
            const finalThumbnail = typeof thumbnailUrl === 'string' && thumbnailUrl.trim() !== ''
                ? thumbnailUrl.trim()
                : generateCloudinaryThumbnail(trimmedVideoUrl);
            if (!finalThumbnail) {
                throw (0, errorHandler_1.createValidationError)('thumbnailUrl could not be generated from videoUrl');
            }
            const videoPayload = {
                title: title.trim(),
                source: 'cloudinary',
                videoUrl: trimmedVideoUrl,
                thumbnailUrl: finalThumbnail,
                order: 0,
                isActive: true
            };
            if (trimmedPublicId) {
                videoPayload.publicId = trimmedPublicId;
            }
            const video = new Video(videoPayload);
            const savedVideo = yield video.save();
            res.status(201).json({
                success: true,
                message: 'Video added successfully',
                data: savedVideo,
                timestamp: new Date().toISOString()
            });
        }));
        this.updateVideo = (0, errorHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params;
            const { title, source: sourceRaw, youtubeUrl, videoUrl, publicId, thumbnailUrl, order, isActive } = req.body;
            if (!id) {
                throw (0, errorHandler_1.createValidationError)('Video ID is required');
            }
            const video = yield Video.findById(id);
            if (!video) {
                throw (0, errorHandler_1.createNotFoundError)('Video not found');
            }
            if (title !== undefined) {
                if (typeof title !== 'string' || title.trim() === '') {
                    throw (0, errorHandler_1.createValidationError)('Title must be a non-empty string');
                }
                video.title = title.trim();
            }
            const nextSource = sourceRaw !== undefined ? resolveSource(sourceRaw, video) : resolveSource(undefined, video);
            if (sourceRaw !== undefined) {
                video.source = nextSource;
            }
            if (nextSource === 'youtube') {
                if (youtubeUrl !== undefined) {
                    if (typeof youtubeUrl !== 'string' || youtubeUrl.trim() === '') {
                        throw (0, errorHandler_1.createValidationError)('YouTube URL is required when source is youtube');
                    }
                    const ytVideoId = extractYouTubeId(youtubeUrl);
                    if (!ytVideoId) {
                        throw (0, errorHandler_1.createValidationError)('Invalid YouTube URL');
                    }
                    const existingVideo = yield Video.findOne({ videoId: ytVideoId, _id: { $ne: id } });
                    if (existingVideo) {
                        throw (0, errorHandler_1.createValidationError)('Video with this URL already exists');
                    }
                    video.youtubeUrl = youtubeUrl.trim();
                    video.videoId = ytVideoId;
                    video.thumbnailUrl = generateYouTubeThumbnail(ytVideoId);
                    video.videoUrl = '';
                    video.set('publicId', undefined);
                }
            }
            else if (nextSource === 'cloudinary') {
                if (videoUrl !== undefined) {
                    if (typeof videoUrl !== 'string' || videoUrl.trim() === '') {
                        throw (0, errorHandler_1.createValidationError)('videoUrl is required when source is cloudinary');
                    }
                    const trimmedVideoUrl = videoUrl.trim();
                    video.videoUrl = trimmedVideoUrl;
                    video.thumbnailUrl =
                        typeof thumbnailUrl === 'string' && thumbnailUrl.trim() !== ''
                            ? thumbnailUrl.trim()
                            : generateCloudinaryThumbnail(trimmedVideoUrl);
                    video.youtubeUrl = '';
                    video.set('videoId', undefined);
                }
                else if (thumbnailUrl !== undefined && typeof thumbnailUrl === 'string') {
                    video.thumbnailUrl = thumbnailUrl.trim();
                }
                if (publicId !== undefined) {
                    const trimmedPublicId = typeof publicId === 'string' ? publicId.trim() : '';
                    if (trimmedPublicId) {
                        const existingVideo = yield Video.findOne({ publicId: trimmedPublicId, _id: { $ne: id } });
                        if (existingVideo) {
                            throw (0, errorHandler_1.createValidationError)('Video with this Cloudinary public ID already exists');
                        }
                        video.publicId = trimmedPublicId;
                    }
                    else {
                        video.set('publicId', undefined);
                    }
                }
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
