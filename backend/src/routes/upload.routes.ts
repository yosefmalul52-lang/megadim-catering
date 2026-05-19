import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import upload from '../middleware/upload';
import uploadVideo from '../middleware/upload-video';
const { authenticate } = require('../middleware/auth');
const { requireAdmin } = require('../config/role-access');

const router = Router();

function handleMulterError(err: unknown, res: Response): boolean {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({
        success: false,
        message: 'הקובץ גדול מדי. גודל מקסימלי: 100MB.'
      });
      return true;
    }
    res.status(400).json({
      success: false,
      message: err.message || 'שגיאה בהעלאת הקובץ'
    });
    return true;
  }
  if (err instanceof Error) {
    res.status(400).json({
      success: false,
      message: err.message
    });
    return true;
  }
  return false;
}

// Single image upload route (unchanged)
router.post('/', upload.single('image'), (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded. Please provide an image file.'
      });
    }

    const file = req.file as Express.Multer.File & {
      path?: string;
      public_id?: string;
      filename?: string;
      format?: string;
      width?: number;
      height?: number;
      bytes?: number;
    };

    res.status(200).json({
      success: true,
      message: 'Image uploaded successfully',
      imageUrl: file.path,
      publicId: file.public_id || file.filename,
      format: file.format,
      width: file.width,
      height: file.height,
      bytes: file.bytes
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to upload image.';
    console.error('Error uploading image to Cloudinary:', error);
    res.status(500).json({
      success: false,
      message
    });
  }
});

// Native video upload (admin only)
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
          message: 'No file uploaded. Please provide a video file (MP4, WebM, or MOV).'
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
          message: 'Upload succeeded but no video URL was returned from Cloudinary.'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Video uploaded successfully',
        videoUrl,
        publicId: file.public_id || file.filename || '',
        format: file.format,
        bytes: file.bytes,
        duration: file.duration
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to upload video.';
      console.error('Error uploading video to Cloudinary:', error);
      res.status(500).json({
        success: false,
        message
      });
    }
  }
);

export default router;
