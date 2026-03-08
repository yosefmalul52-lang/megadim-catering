// CRITICAL: Load environment variables FIRST, before any other imports
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load .env: try cwd, then backend root, then project root (so backend/.env wins)
const cwdEnv = path.join(process.cwd(), '.env');
const backendEnv = path.join(__dirname, '..', '.env');
const rootEnv = path.join(__dirname, '..', '..', '.env');

dotenv.config(); // cwd
for (const p of [backendEnv, rootEnv]) {
  if (fs.existsSync(p)) {
    const r = dotenv.config({ path: p });
    if (!r.error) console.log('[env] Loaded:', p);
    else console.warn('[env] Failed to load', p, r.error?.message);
  }
}

// Normalize: trim so "KEY=  value  " or empty value is handled
const raw = process.env.GOOGLE_MAPS_API_KEY;
if (raw !== undefined) process.env.GOOGLE_MAPS_API_KEY = raw.trim();
const hasMapsKey = !!process.env.GOOGLE_MAPS_API_KEY;

if (hasMapsKey) {
  console.log('[env] GOOGLE_MAPS_API_KEY is set (delivery fee API ready)');
} else {
  console.warn('[env] GOOGLE_MAPS_API_KEY is missing or empty.');
  console.warn('[env] In backend/.env use exactly: GOOGLE_MAPS_API_KEY=your_key (no spaces around =)');
}

console.log('🚀 Server starting with Vercel CORS fix applied!');

// Now import everything else after env is loaded
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import { connectDatabase } from './config/database';

// Import routes
import menuRoutes from './routes/menu.routes';
import contactRoutes from './routes/contact.routes';
import orderRoutes from './routes/order.routes';
import ordersRoutes from './routes/orders.routes';
import authRoutes from './routes/auth.routes';
import searchRoutes from './routes/search.routes';
import testimonialsRoutes from './routes/testimonials.routes';
import agentRoutes from './routes/agent.routes';
import uploadRoutes from './routes/upload.routes';
import shoppingRoutes from './routes/shopping.routes';
import employeeRoutes from './routes/employee.routes';
import attendanceRoutes from './routes/attendance.routes';
import galleryRoutes from './routes/gallery.routes';
import videoRoutes from './routes/video.routes';
import settingsRoutes from './routes/settings.routes';
import deliveryRoutes from './routes/delivery.routes';
import couponRoutes from './routes/coupon.routes';
import userRoutes from './routes/user.routes';

// Import 404 handler
import { notFoundHandler } from './middleware/notFoundHandler';
import { emailService } from './services/email.service';

// Debugging: Check loaded environment variables
console.log('🔍 Environment Variables Status:');
console.log('   PORT:', process.env.PORT || 'Not set (using default: 4000)');
console.log('   MONGO_URI:', process.env.MONGO_URI ? 'Found' : 'Missing');
console.log('   CLOUDINARY_CLOUD_NAME:', process.env.CLOUDINARY_CLOUD_NAME ? 'Found' : 'Missing');
console.log('   CLOUDINARY_API_KEY:', process.env.CLOUDINARY_API_KEY ? 'Found' : 'Missing');
console.log('   CLOUDINARY_API_SECRET:', process.env.CLOUDINARY_API_SECRET ? 'Found' : 'Missing');

// Cloudinary debug log
console.log('☁️ Cloudinary Config:', {
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'Missing',
  api_key: process.env.CLOUDINARY_API_KEY || 'Missing',
  has_secret: !!process.env.CLOUDINARY_API_SECRET
});

const app = express();
const PORT = process.env.PORT || 4000;

// CORS middleware - MUST be first, before any other middleware or routes
// Allow Vercel and Localhost to access the server
app.use(cors({
  origin: [
    'http://localhost:4200', // Local development
    'https://magadim-backend.onrender.com', // Render backend (if needed)
    /\.vercel\.app$/ // All Vercel preview and production deployments (matches *.vercel.app)
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'X-Requested-With', 'Accept']
}));

// Security headers (XSS, clickjacking, etc.)
app.use(helmet());

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // For handling form data, including multipart

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0',
    service: 'Megadim Catering API'
  });
});

// Test Route
app.get('/', (req, res) => {
  res.send('✅ API is running on Port ' + PORT);
});

// MongoDB Connection - Use centralized database config
connectDatabase().catch((err) => {
  console.error('❌ Failed to connect to MongoDB:', err);
  process.exit(1);
});

// API routes
app.use('/api/menu', menuRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/order', orderRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/testimonials', testimonialsRoutes);
app.use('/api/agent', agentRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/shopping', shoppingRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/gallery', galleryRoutes);
app.use('/api/videos', videoRoutes);
app.use('/api/settings', settingsRoutes); // Must be before wildcard/404 handler
app.use('/api/delivery', deliveryRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/users', userRoutes);

// 404 handler for undefined routes (must be after all API routes above)
app.use('*', notFoundHandler);

// Global Error Handler (must be last)
// Express recognizes error handlers by having exactly 4 parameters (err, req, res, next)
app.use((err: any, req: any, res: any, next: any) => {
  console.error('🔥 Server Error:', err.stack || err.message || err);
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && {
      stack: err.stack
    })
  });
});

// Start Server
app.listen(PORT, async () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);

  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    try {
      await emailService.verifyConnection();
    } catch (err: any) {
      console.error('❌ SMTP connection failed on startup:', err?.message || err);
    }
  } else {
    console.log('⚠️ EMAIL_USER/EMAIL_PASS not set – order email endpoint will return 503 until configured');
  }
});
