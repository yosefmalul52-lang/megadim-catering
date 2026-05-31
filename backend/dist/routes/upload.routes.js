"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const upload_1 = __importDefault(require("../middleware/upload"));
const upload_video_1 = __importDefault(require("../middleware/upload-video"));
const { authenticate } = require('../middleware/auth');
const { requireAdmin } = require('../config/role-access');
const router = (0, express_1.Router)();
function handleMulterError(err, res) {
    if (err instanceof multer_1.default.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            res.status(400).json({
                success: false,
                message: 'הקובץ גדול מדי. גודל מקסימלי: 100MB.'
            });
            return true;
        }
        res.status(400).json({
            success: false,
            message: err.message || 'שגיאה בהעלאת הקובץ'
        });
        return true;
    }
    if (err instanceof Error) {
        res.status(400).json({
            success: false,
            message: err.message
        });
        return true;
    }
    return false;
}
// Single image upload route (unchanged)
router.post('/', upload_1.default.single('image'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No file uploaded. Please provide an image file.'
            });
        }
        const file = req.file;
        res.status(200).json({
            success: true,
            message: 'Image uploaded successfully',
            imageUrl: file.path,
            publicId: file.public_id || file.filename,
            format: file.format,
            width: file.width,
            height: file.height,
            bytes: file.bytes
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to upload image.';
        console.error('Error uploading image to Cloudinary:', error);
        res.status(500).json({
            success: false,
            message
        });
    }
});
// Native video upload (admin only)
router.post('/video', authenticate, requireAdmin, (req, res, next) => {
    upload_video_1.default.single('video')(req, res, (err) => {
        if (err) {
            if (handleMulterError(err, res))
                return;
            return next(err);
        }
        next();
    });
}, (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No file uploaded. Please provide a video file (MP4, WebM, or MOV).'
            });
        }
        const file = req.file;
        const videoUrl = file.secure_url || file.path || '';
        if (!videoUrl) {
            return res.status(500).json({
                success: false,
                message: 'Upload succeeded but no video URL was returned from Cloudinary.'
            });
        }
        res.status(200).json({
            success: true,
            message: 'Video uploaded successfully',
            videoUrl,
            publicId: file.public_id || file.filename || '',
            format: file.format,
            bytes: file.bytes,
            duration: file.duration
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to upload video.';
        console.error('Error uploading video to Cloudinary:', error);
        res.status(500).json({
            success: false,
            message
        });
    }
});
exports.default = router;
