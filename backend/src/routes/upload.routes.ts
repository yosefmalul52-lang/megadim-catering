import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import uploadR2 from '../middleware/upload-r2';
import uploadVideo from '../middleware/upload-video';
import {
  deleteByPublicUrl,
  isR2Configured,
  uploadImageBuffer,
} from '../services/r2-storage.service';
const { authenticate } = require('../middleware/auth');
const { requireAdmin } = require('../config/role-access');

const router = Router();

function handleMulterError(err: unknown, res: Response): boolean {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({
        success: false,
        message: 'הקובץ גדול מדי. גודל מקסימלי: 100MB.',
      });
      return true;
    }
    res.status(400).json({
      success: false,
      message: err.message || 'שגיאה בהעלאת הקובץ',
    });
    return true;
  }
  if (err instanceof Error) {
    res.status(400).json({
      success: false,
      message: err.message,
    });
    return true;
  }
  return false;
}

/**
 * Image upload: R2 only when configured.
 * Refuses Cloudinary fallback so new image uploads never go to Cloudinary.
 * Video upload remains on Cloudinary until a separate video migration.
 * API contract unchanged: { success, imageUrl, publicId?, format?, width?, height?, bytes? }
 */
router.post(
  '/',
  authenticate,
  requireAdmin,
  (req: Request, res: Response, next: NextFunction) => {
    if (!isR2Configured()) {
      return res.status(503).json({
        success: false,
        message: 'R2 storage is not configured. Image uploads require R2.',
      });
    }
    uploadR2.single('image')(req, res, (err: unknown) => {
      if (err) {
        if (handleMulterError(err, res)) return;
        return next(err);
      }
      next();
    });
  },
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No file uploaded. Please provide an image file.',
        });
      }

      if (!req.file.buffer) {
        return res.status(500).json({
          success: false,
          message: 'Upload buffer missing',
        });
      }

      const entityType = typeof req.body?.entityType === 'string' ? req.body.entityType : 'menuItem';
      const entityId = typeof req.body?.entityId === 'string' ? req.body.entityId : undefined;
      const replaceUrl = typeof req.body?.replaceUrl === 'string' ? req.body.replaceUrl : '';

      const result = await uploadImageBuffer(req.file.buffer, {
        originalName: req.file.originalname,
        entityType,
        entityId,
      });

      // Optional replace: delete previous R2 object only (never Cloudinary)
      if (replaceUrl) {
        try {
          await deleteByPublicUrl(replaceUrl);
        } catch (e) {
          console.warn('R2 replace cleanup failed (non-fatal):', e instanceof Error ? e.message : e);
        }
      }

      return res.status(200).json({
        success: true,
        message: 'Image uploaded successfully',
        imageUrl: result.publicUrl,
        publicId: result.key,
        format: result.contentType.split('/')[1],
        width: result.width,
        height: result.height,
        bytes: result.bytes,
        storage: 'r2',
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to upload image.';
      console.error('Error uploading image:', message);
      res.status(500).json({
        success: false,
        message,
      });
    }
  }
);

/** Delete image from R2 only when URL belongs to our public base. Never touches Cloudinary. */
router.delete(
  '/',
  authenticate,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const imageUrl = String(req.body?.imageUrl || req.query?.imageUrl || '').trim();
      if (!imageUrl) {
        return res.status(400).json({ success: false, message: 'imageUrl is required' });
      }
      if (!isR2Configured()) {
        return res.status(400).json({
          success: false,
          message: 'R2 is not configured; refusing to delete (Cloudinary assets are never deleted by this API).',
        });
      }
      const deleted = await deleteByPublicUrl(imageUrl);
      if (!deleted) {
        return res.status(400).json({
          success: false,
          message: 'URL is not an R2 object for this project. Cloudinary URLs are left untouched.',
        });
      }
      return res.status(200).json({ success: true, message: 'R2 object deleted' });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to delete image.';
      res.status(500).json({ success: false, message });
    }
  }
);

// Native video upload (admin only) — still Cloudinary until a separate migration
router.post(
  '/video',
  authenticate,
  requireAdmin,
  (req: Request, res: Response, next: NextFunction) => {
    uploadVideo.single('video')(req, res, (err: unknown) => {
      if (err) {
        if (handleMulterError(err, res)) return;
        return next(err);
      }
      next();
    });
  },
  (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No file uploaded. Please provide a video file (MP4, WebM, or MOV).',
        });
      }

      const file = req.file as Express.Multer.File & {
        path?: string;
        secure_url?: string;
        public_id?: string;
        filename?: string;
        format?: string;
        bytes?: number;
        duration?: number;
      };

      const videoUrl = file.secure_url || file.path || '';
      if (!videoUrl) {
        return res.status(500).json({
          success: false,
          message: 'Upload succeeded but no video URL was returned from Cloudinary.',
        });
      }

      res.status(200).json({
        success: true,
        message: 'Video uploaded successfully',
        videoUrl,
        publicId: file.public_id || file.filename || '',
        format: file.format,
        bytes: file.bytes,
        duration: file.duration,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to upload video.';
      console.error('Error uploading video to Cloudinary:', error);
      res.status(500).json({
        success: false,
        message,
      });
    }
  }
);

export default router;
