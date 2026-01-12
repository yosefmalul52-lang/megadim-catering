"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GalleryController = void 0;
const errorHandler_1 = require("../middleware/errorHandler");
const GalleryItem = require('../models/GalleryItem');
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
function generateYouTubeThumbnail(videoId) {
    return `https://img.youtube.com/vi/${videoId}/0.jpg`;
}
class GalleryController {
    getAllGalleryItems = (0, errorHandler_1.asyncHandler)(async (req, res) => {
        const { type, active } = req.query;
        const query = {};
        if (type) {
            query.type = type;
        }
        if (active !== undefined) {
            query.isActive = active === 'true';
        }
        else {
            query.isActive = true;
        }
        const galleryItems = await GalleryItem.find(query)
            .sort({ order: 1, createdAt: -1 });
        res.status(200).json({
            success: true,
            data: galleryItems,
            count: galleryItems.length,
            timestamp: new Date().toISOString()
        });
    });
    getGalleryItemById = (0, errorHandler_1.asyncHandler)(async (req, res) => {
        const { id } = req.params;
        if (!id) {
            throw (0, errorHandler_1.createValidationError)('Gallery item ID is required');
        }
        const galleryItem = await GalleryItem.findById(id);
        if (!galleryItem) {
            throw (0, errorHandler_1.createNotFoundError)('Gallery item not found');
        }
        res.status(200).json({
            success: true,
            data: galleryItem,
            timestamp: new Date().toISOString()
        });
    });
    createGalleryItem = (0, errorHandler_1.asyncHandler)(async (req, res) => {
        const { title, type, url, thumbnail, order, isActive } = req.body;
        if (!type || !['image', 'video'].includes(type)) {
            throw (0, errorHandler_1.createValidationError)('Type must be either "image" or "video"');
        }
        if (!url || url.trim() === '') {
            throw (0, errorHandler_1.createValidationError)('URL is required');
        }
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
        const savedItem = await galleryItem.save();
        res.status(201).json({
            success: true,
            message: 'Gallery item created successfully',
            data: savedItem,
            timestamp: new Date().toISOString()
        });
    });
    updateGalleryItem = (0, errorHandler_1.asyncHandler)(async (req, res) => {
        const { id } = req.params;
        const { title, type, url, thumbnail, order, isActive } = req.body;
        if (!id) {
            throw (0, errorHandler_1.createValidationError)('Gallery item ID is required');
        }
        const galleryItem = await GalleryItem.findById(id);
        if (!galleryItem) {
            throw (0, errorHandler_1.createNotFoundError)('Gallery item not found');
        }
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
        if (galleryItem.type === 'video' && !galleryItem.thumbnail && galleryItem.url) {
            const videoId = extractYouTubeId(galleryItem.url);
            if (videoId) {
                galleryItem.thumbnail = generateYouTubeThumbnail(videoId);
            }
        }
        const updatedItem = await galleryItem.save();
        res.status(200).json({
            success: true,
            message: 'Gallery item updated successfully',
            data: updatedItem,
            timestamp: new Date().toISOString()
        });
    });
    deleteGalleryItem = (0, errorHandler_1.asyncHandler)(async (req, res) => {
        const { id } = req.params;
        if (!id) {
            throw (0, errorHandler_1.createValidationError)('Gallery item ID is required');
        }
        const galleryItem = await GalleryItem.findByIdAndDelete(id);
        if (!galleryItem) {
            throw (0, errorHandler_1.createNotFoundError)('Gallery item not found');
        }
        res.status(200).json({
            success: true,
            message: 'Gallery item deleted successfully',
            timestamp: new Date().toISOString()
        });
    });
    getGalleryStatistics = (0, errorHandler_1.asyncHandler)(async (req, res) => {
        const totalItems = await GalleryItem.countDocuments();
        const imageCount = await GalleryItem.countDocuments({ type: 'image' });
        const videoCount = await GalleryItem.countDocuments({ type: 'video' });
        const activeCount = await GalleryItem.countDocuments({ isActive: true });
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
    });
}
exports.GalleryController = GalleryController;
//# sourceMappingURL=gallery.controller.js.map