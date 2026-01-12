"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const cloudinary_1 = require("cloudinary");
cloudinary_1.v2.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});
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
//# sourceMappingURL=cloudinary.js.map