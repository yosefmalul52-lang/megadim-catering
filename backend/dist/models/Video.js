const mongoose = require('mongoose');
const VideoSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    youtubeUrl: {
        type: String,
        required: true,
        trim: true
    },
    videoId: {
        type: String,
        required: true,
        trim: true,
        unique: true
    },
    thumbnailUrl: {
        type: String,
        required: true,
        trim: true
    },
    order: {
        type: Number,
        default: 0
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true,
    collection: 'videos'
});
// Index for faster queries
VideoSchema.index({ videoId: 1 });
VideoSchema.index({ isActive: 1, order: 1 });
const Video = mongoose.models.Video || mongoose.model('Video', VideoSchema);
module.exports = Video;
