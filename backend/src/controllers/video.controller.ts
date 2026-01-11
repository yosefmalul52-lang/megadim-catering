import { Request, Response } from 'express';
import { asyncHandler, createNotFoundError, createValidationError } from '../middleware/errorHandler';
const Video = require('../models/Video');

// Helper function to extract YouTube video ID from URL
// Supports both standard format (v=...) and Shorts format (/shorts/...)
function extractYouTubeId(url: string): string | null {
  if (!url || typeof url !== 'string') {
    return null;
  }

  // Patterns for different YouTube URL formats
  const patterns = [
    // Standard: https://www.youtube.com/watch?v=VIDEO_ID
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    // Shorts: https://www.youtube.com/shorts/VIDEO_ID
    /youtube\.com\/shorts\/([^&\n?#]+)/,
    // Alternative: youtube.com/watch?v=VIDEO_ID&...
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
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

export class VideoController {

  // Get all videos
  getVideos = asyncHandler(async (req: Request, res: Response) => {
    const { active } = req.query;
    
    const query: any = {};
    
    if (active !== undefined) {
      query.isActive = active === 'true';
    } else {
      // Default to showing only active videos for public access
      query.isActive = true;
    }
    
    const videos = await Video.find(query)
      .sort({ order: 1, createdAt: -1 });

    res.status(200).json({
      success: true,
      data: videos,
      count: videos.length,
      timestamp: new Date().toISOString()
    });
  });

  // Get video by ID
  getVideoById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    if (!id) {
      throw createValidationError('Video ID is required');
    }

    const video = await Video.findById(id);

    if (!video) {
      throw createNotFoundError('Video not found');
    }

    res.status(200).json({
      success: true,
      data: video,
      timestamp: new Date().toISOString()
    });
  });

  // Add new video
  addVideo = asyncHandler(async (req: Request, res: Response) => {
    const { title, youtubeUrl } = req.body;

    // Validation
    if (!title || title.trim() === '') {
      throw createValidationError('Title is required');
    }

    if (!youtubeUrl || youtubeUrl.trim() === '') {
      throw createValidationError('YouTube URL is required');
    }

    // Extract video ID from URL
    const videoId = extractYouTubeId(youtubeUrl);
    
    if (!videoId) {
      throw createValidationError('Invalid YouTube URL. Please provide a valid YouTube video URL.');
    }

    // Check if video with this ID already exists
    const existingVideo = await Video.findOne({ videoId });
    if (existingVideo) {
      throw createValidationError('Video with this URL already exists');
    }

    // Generate thumbnail URL
    const thumbnailUrl = generateYouTubeThumbnail(videoId);

    // Create video
    const video = new Video({
      title: title.trim(),
      youtubeUrl: youtubeUrl.trim(),
      videoId,
      thumbnailUrl,
      order: 0,
      isActive: true
    });

    const savedVideo = await video.save();

    res.status(201).json({
      success: true,
      message: 'Video added successfully',
      data: savedVideo,
      timestamp: new Date().toISOString()
    });
  });

  // Update video
  updateVideo = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { title, youtubeUrl, order, isActive } = req.body;

    if (!id) {
      throw createValidationError('Video ID is required');
    }

    const video = await Video.findById(id);

    if (!video) {
      throw createNotFoundError('Video not found');
    }

    // Update fields
    if (title !== undefined) video.title = title.trim();
    if (youtubeUrl !== undefined) {
      const videoId = extractYouTubeId(youtubeUrl);
      if (!videoId) {
        throw createValidationError('Invalid YouTube URL');
      }
      
      // Check if another video with this ID exists
      const existingVideo = await Video.findOne({ videoId, _id: { $ne: id } });
      if (existingVideo) {
        throw createValidationError('Video with this URL already exists');
      }
      
      video.youtubeUrl = youtubeUrl.trim();
      video.videoId = videoId;
      video.thumbnailUrl = generateYouTubeThumbnail(videoId);
    }
    if (order !== undefined) video.order = order;
    if (isActive !== undefined) video.isActive = isActive;

    const updatedVideo = await video.save();

    res.status(200).json({
      success: true,
      message: 'Video updated successfully',
      data: updatedVideo,
      timestamp: new Date().toISOString()
    });
  });

  // Delete video
  deleteVideo = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    if (!id) {
      throw createValidationError('Video ID is required');
    }

    const video = await Video.findByIdAndDelete(id);

    if (!video) {
      throw createNotFoundError('Video not found');
    }

    res.status(200).json({
      success: true,
      message: 'Video deleted successfully',
      timestamp: new Date().toISOString()
    });
  });

  // Get video statistics (Admin only)
  getVideoStatistics = asyncHandler(async (req: Request, res: Response) => {
    const totalVideos = await Video.countDocuments();
    const activeVideos = await Video.countDocuments({ isActive: true });

    res.status(200).json({
      success: true,
      data: {
        total: totalVideos,
        active: activeVideos,
        inactive: totalVideos - activeVideos
      },
      timestamp: new Date().toISOString()
    });
  });
}

