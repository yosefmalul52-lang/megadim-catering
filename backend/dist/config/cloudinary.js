"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const cloudinary_1 = require("cloudinary");
// Configure Cloudinary with environment variables
// NOTE: dotenv.config() is already called in server.ts, so we don't need it here
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
exports.default = cloudinary_1.v2;
