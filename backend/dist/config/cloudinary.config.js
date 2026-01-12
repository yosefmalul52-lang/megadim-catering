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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cloudinary = void 0;
const cloudinary_1 = require("cloudinary");
Object.defineProperty(exports, "cloudinary", { enumerable: true, get: function () { return cloudinary_1.v2; } });
const multer_1 = __importDefault(require("multer"));
const multer_storage_cloudinary_1 = require("multer-storage-cloudinary");
// Configure Cloudinary with environment variables
cloudinary_1.v2.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});
// Log configuration status on startup
console.log('🔍 Cloudinary Config:', {
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'Missing',
    api_key: process.env.CLOUDINARY_API_KEY || 'Missing',
    api_secret: process.env.CLOUDINARY_API_SECRET ? 'Set (hidden)' : 'Missing'
});
if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    console.warn('⚠️  Cloudinary configuration is incomplete. Please check your .env file for:');
    console.warn('   - CLOUDINARY_CLOUD_NAME');
    console.warn('   - CLOUDINARY_API_KEY');
    console.warn('   - CLOUDINARY_API_SECRET');
}
else {
    console.log('✅ Cloudinary configured successfully');
}
// Configure CloudinaryStorage for multer
const storage = new multer_storage_cloudinary_1.CloudinaryStorage({
    cloudinary: cloudinary_1.v2,
    params: (req, file) => __awaiter(void 0, void 0, void 0, function* () {
        return {
            folder: 'magadim-catering',
            allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
            transformation: [
                {
                    width: 1200,
                    height: 1200,
                    crop: 'limit',
                    quality: 'auto:good'
                }
            ]
        };
    })
});
// Configure multer with CloudinaryStorage
const upload = (0, multer_1.default)({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        }
        else {
            cb(new Error('Invalid file type. Only JPEG, PNG, and WebP images are allowed.'));
        }
    }
});
// Export the configured upload middleware
exports.default = upload;
