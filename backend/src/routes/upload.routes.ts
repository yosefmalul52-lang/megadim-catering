import { Router, Request, Response } from 'express';
import upload from '../middleware/upload';

const router = Router();

// Single image upload route
router.post('/', upload.single('image'), (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded. Please provide an image file.'
      });
    }

    // Cast to any to access Cloudinary properties without strict type checking
    const file = req.file as any;

    res.status(200).json({
      success: true,
      message: 'Image uploaded successfully',
      imageUrl: file.path, // Cloudinary stores the URL in .path
      publicId: file.public_id || file.filename, // Cloudinary stores the ID in .public_id or .filename
      format: file.format,
      width: file.width,
      height: file.height,
      bytes: file.bytes
    });
  } catch (error: any) {
    console.error('Error uploading image to Cloudinary:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to upload image.'
    });
  }
});

export default router;
