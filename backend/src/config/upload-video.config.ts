import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import { cloudinary } from './cloudinary.config';

const videoStorage = new CloudinaryStorage({
  cloudinary,
  params: async () => ({
    folder: 'magadim-catering/videos',
    resource_type: 'video',
    allowed_formats: ['mp4', 'webm', 'mov']
  })
});

const uploadVideo = multer({
  storage: videoStorage,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB
  },
  fileFilter: (_req, file, cb) => {
    const allowedMimes = ['video/mp4', 'video/webm', 'video/quicktime'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only MP4, WebM, and MOV videos are allowed.'));
    }
  }
});

export default uploadVideo;
