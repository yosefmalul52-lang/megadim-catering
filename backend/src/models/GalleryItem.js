const mongoose = require('mongoose');

const GalleryItemSchema = new mongoose.Schema({
  title: {
    type: String,
    trim: true,
    default: ''
  },
  type: {
    type: String,
    enum: ['image', 'video'],
    required: true
  },
  url: {
    type: String,
    required: true,
    trim: true
  },
  thumbnail: {
    type: String,
    trim: true,
    default: ''
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
  collection: 'galleryitems'
});

// Index for faster queries
GalleryItemSchema.index({ type: 1, isActive: 1 });
GalleryItemSchema.index({ order: 1 });

const GalleryItem = mongoose.models.GalleryItem || mongoose.model('GalleryItem', GalleryItemSchema);

module.exports = GalleryItem;

