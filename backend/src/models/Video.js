const mongoose = require('mongoose');

const VideoSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  source: {
    type: String,
    enum: ['youtube', 'cloudinary'],
    default: 'youtube'
  },
  youtubeUrl: {
    type: String,
    trim: true,
    default: ''
  },
  /** YouTube video ID — omit field entirely for native Cloudinary videos (never store null). */
  videoId: {
    type: String,
    trim: true
  },
  videoUrl: {
    type: String,
    trim: true,
    default: ''
  },
  /** Cloudinary public_id — omit when not applicable (never store null). */
  publicId: {
    type: String,
    trim: true
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

// Sparse unique: only documents with the field present are indexed (multiple docs without field OK)
VideoSchema.index({ videoId: 1 }, { unique: true, sparse: true });
VideoSchema.index({ publicId: 1 }, { unique: true, sparse: true });
VideoSchema.index({ isActive: 1, order: 1 });
VideoSchema.index({ source: 1 });

const Video = mongoose.models.Video || mongoose.model('Video', VideoSchema);

module.exports = Video;
