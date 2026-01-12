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
exports.GalleryController = void 0;
const errorHandler_1 = require("../middleware/errorHandler");
const GalleryItem = require('../models/GalleryItem');
// Helper function to extract YouTube video ID from URL
function extractYouTubeId(url) {
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
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
    return `https://img.youtube.com/vi/${videoId}/0.jpg`;
}
class GalleryController {
    constructor() {
        // Get all gallery items
        this.getAllGalleryItems = (0, errorHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const { type, active } = req.query;
            const query = {};
            if (type) {
                query.type = type;
            }
            if (active !== undefined) {
                query.isActive = active === 'true';
            }
            else {
                // Default to showing only active items for public access
                query.isActive = true;
            }
            const galleryItems = yield GalleryItem.find(query)
                .sort({ order: 1, createdAt: -1 });
            res.status(200).json({
                success: true,
                data: galleryItems,
                count: galleryItems.length,
                timestamp: new Date().toISOString()
            });
        }));
        // Get gallery item by ID
        this.getGalleryItemById = (0, errorHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params;
            if (!id) {
                throw (0, errorHandler_1.createValidationError)('Gallery item ID is required');
            }
            const galleryItem = yield GalleryItem.findById(id);
            if (!galleryItem) {
                throw (0, errorHandler_1.createNotFoundError)('Gallery item not found');
            }
            res.status(200).json({
                success: true,
                data: galleryItem,
                timestamp: new Date().toISOString()
            });
        }));
        // Create new gallery item
        this.createGalleryItem = (0, errorHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const { title, type, url, thumbnail, order, isActive } = req.body;
            // Validation
            if (!type || !['image', 'video'].includes(type)) {
                throw (0, errorHandler_1.createValidationError)('Type must be either "image" or "video"');
            }
            if (!url || url.trim() === '') {
                throw (0, errorHandler_1.createValidationError)('URL is required');
            }
            // If it's a video and no thumbnail provided, try to extract from YouTube URL
            let finalThumbnail = thumbnail;
            if (type === 'video' && !finalThumbnail) {
                const videoId = extractYouTubeId(url);
                if (videoId) {
                    finalThumbnail = generateYouTubeThumbnail(videoId);
                }
            }
            const galleryItem = new GalleryItem({
                title: title || '',
                type,
                url: url.trim(),
                thumbnail: finalThumbnail || '',
                order: order || 0,
                isActive: isActive !== undefined ? isActive : true
            });
            const savedItem = yield galleryItem.save();
            res.status(201).json({
                success: true,
                message: 'Gallery item created successfully',
                data: savedItem,
                timestamp: new Date().toISOString()
            });
        }));
        // Update gallery item
        this.updateGalleryItem = (0, errorHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params;
            const { title, type, url, thumbnail, order, isActive } = req.body;
            if (!id) {
                throw (0, errorHandler_1.createValidationError)('Gallery item ID is required');
            }
            const galleryItem = yield GalleryItem.findById(id);
            if (!galleryItem) {
                throw (0, errorHandler_1.createNotFoundError)('Gallery item not found');
            }
            // Update fields
            if (title !== undefined)
                galleryItem.title = title;
            if (type !== undefined) {
                if (!['image', 'video'].includes(type)) {
                    throw (0, errorHandler_1.createValidationError)('Type must be either "image" or "video"');
                }
                galleryItem.type = type;
            }
            if (url !== undefined)
                galleryItem.url = url.trim();
            if (thumbnail !== undefined)
                galleryItem.thumbnail = thumbnail;
            if (order !== undefined)
                galleryItem.order = order;
            if (isActive !== undefined)
                galleryItem.isActive = isActive;
            // If it's a video and no thumbnail provided, try to extract from YouTube URL
            if (galleryItem.type === 'video' && !galleryItem.thumbnail && galleryItem.url) {
                const videoId = extractYouTubeId(galleryItem.url);
                if (videoId) {
                    galleryItem.thumbnail = generateYouTubeThumbnail(videoId);
                }
            }
            const updatedItem = yield galleryItem.save();
            res.status(200).json({
                success: true,
                message: 'Gallery item updated successfully',
                data: updatedItem,
                timestamp: new Date().toISOString()
            });
        }));
        // Delete gallery item
        this.deleteGalleryItem = (0, errorHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params;
            if (!id) {
                throw (0, errorHandler_1.createValidationError)('Gallery item ID is required');
            }
            const galleryItem = yield GalleryItem.findByIdAndDelete(id);
            if (!galleryItem) {
                throw (0, errorHandler_1.createNotFoundError)('Gallery item not found');
            }
            res.status(200).json({
                success: true,
                message: 'Gallery item deleted successfully',
                timestamp: new Date().toISOString()
            });
        }));
        // Get gallery statistics (Admin only)
        this.getGalleryStatistics = (0, errorHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const totalItems = yield GalleryItem.countDocuments();
            const imageCount = yield GalleryItem.countDocuments({ type: 'image' });
            const videoCount = yield GalleryItem.countDocuments({ type: 'video' });
            const activeCount = yield GalleryItem.countDocuments({ isActive: true });
            res.status(200).json({
                success: true,
                data: {
                    total: totalItems,
                    images: imageCount,
                    videos: videoCount,
                    active: activeCount,
                    inactive: totalItems - activeCount
                },
                timestamp: new Date().toISOString()
            });
        }));
    }
}
exports.GalleryController = GalleryController;
