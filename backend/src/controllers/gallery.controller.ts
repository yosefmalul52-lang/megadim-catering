import { Request, Response } from 'express';
import { asyncHandler, createNotFoundError, createValidationError } from '../middleware/errorHandler';
const GalleryItem = require('../models/GalleryItem');

// Helper function to extract YouTube video ID from URL
function extractYouTubeId(url: string): string | null {
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
function generateYouTubeThumbnail(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/0.jpg`;
}

export class GalleryController {

  // Get all gallery items
  getAllGalleryItems = asyncHandler(async (req: Request, res: Response) => {
    const { type, active } = req.query;
    
    const query: any = {};
    
    if (type) {
      query.type = type;
    }
    
    if (active !== undefined) {
      query.isActive = active === 'true';
    } else {
      // Default to showing only active items for public access
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

  // Get gallery item by ID
  getGalleryItemById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    if (!id) {
      throw createValidationError('Gallery item ID is required');
    }

    const galleryItem = await GalleryItem.findById(id);

    if (!galleryItem) {
      throw createNotFoundError('Gallery item not found');
    }

    res.status(200).json({
      success: true,
      data: galleryItem,
      timestamp: new Date().toISOString()
    });
  });

  // Create new gallery item
  createGalleryItem = asyncHandler(async (req: Request, res: Response) => {
    const { title, type, url, thumbnail, order, isActive } = req.body;

    // Validation
    if (!type || !['image', 'video'].includes(type)) {
      throw createValidationError('Type must be either "image" or "video"');
    }

    if (!url || url.trim() === '') {
      throw createValidationError('URL is required');
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

    const savedItem = await galleryItem.save();

    res.status(201).json({
      success: true,
      message: 'Gallery item created successfully',
      data: savedItem,
      timestamp: new Date().toISOString()
    });
  });

  // Update gallery item
  updateGalleryItem = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { title, type, url, thumbnail, order, isActive } = req.body;

    if (!id) {
      throw createValidationError('Gallery item ID is required');
    }

    const galleryItem = await GalleryItem.findById(id);

    if (!galleryItem) {
      throw createNotFoundError('Gallery item not found');
    }

    // Update fields
    if (title !== undefined) galleryItem.title = title;
    if (type !== undefined) {
      if (!['image', 'video'].includes(type)) {
        throw createValidationError('Type must be either "image" or "video"');
      }
      galleryItem.type = type;
    }
    if (url !== undefined) galleryItem.url = url.trim();
    if (thumbnail !== undefined) galleryItem.thumbnail = thumbnail;
    if (order !== undefined) galleryItem.order = order;
    if (isActive !== undefined) galleryItem.isActive = isActive;

    // If it's a video and no thumbnail provided, try to extract from YouTube URL
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

  // Delete gallery item
  deleteGalleryItem = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    if (!id) {
      throw createValidationError('Gallery item ID is required');
    }

    const galleryItem = await GalleryItem.findByIdAndDelete(id);

    if (!galleryItem) {
      throw createNotFoundError('Gallery item not found');
    }

    res.status(200).json({
      success: true,
      message: 'Gallery item deleted successfully',
      timestamp: new Date().toISOString()
    });
  });

  // Get gallery statistics (Admin only)
  getGalleryStatistics = asyncHandler(async (req: Request, res: Response) => {
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

