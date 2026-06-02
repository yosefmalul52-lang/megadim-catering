import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';

const documentStorage = new CloudinaryStorage({
  cloudinary,
  params: async (_req, _file) => ({
    folder:        'magadim-catering/invoices',
    resource_type: 'auto',   // required for PDF uploads
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'pdf']
  })
});

const uploadDocument = multer({
  storage: documentStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
      'application/pdf'
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, WebP, and PDF are allowed.'));
    }
  }
});

export default uploadDocument;
