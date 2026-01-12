"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const upload_1 = __importDefault(require("../middleware/upload"));
const router = (0, express_1.Router)();
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
        console.error('Error uploading image to Cloudinary:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to upload image.'
        });
    }
});
exports.default = router;
//# sourceMappingURL=upload.routes.js.map