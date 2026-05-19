import { Request, Response } from 'express';
import { asyncHandler, createNotFoundError, createValidationError } from '../middleware/errorHandler';
const Video = require('../models/Video');

type VideoSource = 'youtube' | 'cloudinary';

function resolveSource(value: unknown, doc?: { source?: string; videoUrl?: string }): VideoSource {
  if (value === 'cloudinary' || value === 'youtube') {
    return value;
  }
  if (doc?.source === 'cloudinary' || doc?.source === 'youtube') {
    return doc.source;
  }
  if (doc?.videoUrl?.trim()) {
    return 'cloudinary';
  }
  return 'youtube';
}

function extractYouTubeId(url: string): string | null {
  if (!url || typeof url !== 'string') {
    return null;
  }

  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/shorts\/([^&\n?#]+)/,
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

function generateYouTubeThumbnail(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

/** Derive a poster/thumbnail URL from a Cloudinary video delivery URL. */
export function generateCloudinaryThumbnail(videoUrl: string): string {
  if (!videoUrl || typeof videoUrl !== 'string') {
    return '';
  }
  return videoUrl.replace(/\.(mp4|webm|mov|quicktime)(\?.*)?$/i, '.jpg$2');
}

export class VideoController {
  getVideos = asyncHandler(async (req: Request, res: Response) => {
    const { active } = req.query;

    const query: Record<string, unknown> = {};

    const includeAll = req.query.includeAll === 'true';

    if (active === 'true') {
      query.isActive = true;
    } else if (active === 'false') {
      query.isActive = false;
    } else if (includeAll) {
      // Admin: all videos
    } else {
      // Public default: active only
      query.isActive = true;
    }

    const videos = await Video.find(query).sort({ order: 1, createdAt: -1 });

    res.status(200).json({
      success: true,
      data: videos,
      count: videos.length,
      timestamp: new Date().toISOString()
    });
  });

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

  addVideo = asyncHandler(async (req: Request, res: Response) => {
    const {
      title,
      source: sourceRaw,
      youtubeUrl,
      videoUrl,
      publicId,
      thumbnailUrl
    } = req.body;

    if (!title || typeof title !== 'string' || title.trim() === '') {
      throw createValidationError('Title is required');
    }

    const source = resolveSource(sourceRaw);

    if (source === 'youtube') {
      if (!youtubeUrl || typeof youtubeUrl !== 'string' || youtubeUrl.trim() === '') {
        throw createValidationError('YouTube URL is required when source is youtube');
      }

      const ytVideoId = extractYouTubeId(youtubeUrl);
      if (!ytVideoId) {
        throw createValidationError('Invalid YouTube URL. Please provide a valid YouTube video URL.');
      }

      const existingVideo = await Video.findOne({ videoId: ytVideoId });
      if (existingVideo) {
        throw createValidationError('Video with this URL already exists');
      }

      const video = new Video({
        title: title.trim(),
        source: 'youtube',
        youtubeUrl: youtubeUrl.trim(),
        videoId: ytVideoId,
        thumbnailUrl: generateYouTubeThumbnail(ytVideoId),
        order: 0,
        isActive: true
      });

      const savedVideo = await video.save();

      return res.status(201).json({
        success: true,
        message: 'Video added successfully',
        data: savedVideo,
        timestamp: new Date().toISOString()
      });
    }

    // cloudinary
    if (!videoUrl || typeof videoUrl !== 'string' || videoUrl.trim() === '') {
      throw createValidationError('videoUrl is required when source is cloudinary');
    }

    const trimmedVideoUrl = videoUrl.trim();
    const trimmedPublicId = typeof publicId === 'string' ? publicId.trim() : '';

    if (trimmedPublicId) {
      const existingByPublicId = await Video.findOne({ publicId: trimmedPublicId });
      if (existingByPublicId) {
        throw createValidationError('Video with this Cloudinary public ID already exists');
      }
    }

    const finalThumbnail =
      typeof thumbnailUrl === 'string' && thumbnailUrl.trim() !== ''
        ? thumbnailUrl.trim()
        : generateCloudinaryThumbnail(trimmedVideoUrl);

    if (!finalThumbnail) {
      throw createValidationError('thumbnailUrl could not be generated from videoUrl');
    }

    const videoPayload: Record<string, unknown> = {
      title: title.trim(),
      source: 'cloudinary',
      videoUrl: trimmedVideoUrl,
      thumbnailUrl: finalThumbnail,
      order: 0,
      isActive: true
    };
    if (trimmedPublicId) {
      videoPayload.publicId = trimmedPublicId;
    }

    const video = new Video(videoPayload);

    const savedVideo = await video.save();

    res.status(201).json({
      success: true,
      message: 'Video added successfully',
      data: savedVideo,
      timestamp: new Date().toISOString()
    });
  });

  updateVideo = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { title, source: sourceRaw, youtubeUrl, videoUrl, publicId, thumbnailUrl, order, isActive } =
      req.body;

    if (!id) {
      throw createValidationError('Video ID is required');
    }

    const video = await Video.findById(id);

    if (!video) {
      throw createNotFoundError('Video not found');
    }

    if (title !== undefined) {
      if (typeof title !== 'string' || title.trim() === '') {
        throw createValidationError('Title must be a non-empty string');
      }
      video.title = title.trim();
    }

    const nextSource = sourceRaw !== undefined ? resolveSource(sourceRaw, video) : resolveSource(undefined, video);

    if (sourceRaw !== undefined) {
      video.source = nextSource;
    }

    if (nextSource === 'youtube') {
      if (youtubeUrl !== undefined) {
        if (typeof youtubeUrl !== 'string' || youtubeUrl.trim() === '') {
          throw createValidationError('YouTube URL is required when source is youtube');
        }
        const ytVideoId = extractYouTubeId(youtubeUrl);
        if (!ytVideoId) {
          throw createValidationError('Invalid YouTube URL');
        }
        const existingVideo = await Video.findOne({ videoId: ytVideoId, _id: { $ne: id } });
        if (existingVideo) {
          throw createValidationError('Video with this URL already exists');
        }
        video.youtubeUrl = youtubeUrl.trim();
        video.videoId = ytVideoId;
        video.thumbnailUrl = generateYouTubeThumbnail(ytVideoId);
        video.videoUrl = '';
        video.set('publicId', undefined);
      }
    } else if (nextSource === 'cloudinary') {
      if (videoUrl !== undefined) {
        if (typeof videoUrl !== 'string' || videoUrl.trim() === '') {
          throw createValidationError('videoUrl is required when source is cloudinary');
        }
        const trimmedVideoUrl = videoUrl.trim();
        video.videoUrl = trimmedVideoUrl;
        video.thumbnailUrl =
          typeof thumbnailUrl === 'string' && thumbnailUrl.trim() !== ''
            ? thumbnailUrl.trim()
            : generateCloudinaryThumbnail(trimmedVideoUrl);
        video.youtubeUrl = '';
        video.set('videoId', undefined);
      } else if (thumbnailUrl !== undefined && typeof thumbnailUrl === 'string') {
        video.thumbnailUrl = thumbnailUrl.trim();
      }

      if (publicId !== undefined) {
        const trimmedPublicId = typeof publicId === 'string' ? publicId.trim() : '';
        if (trimmedPublicId) {
          const existingVideo = await Video.findOne({ publicId: trimmedPublicId, _id: { $ne: id } });
          if (existingVideo) {
            throw createValidationError('Video with this Cloudinary public ID already exists');
          }
          video.publicId = trimmedPublicId;
        } else {
          video.set('publicId', undefined);
        }
      }
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
