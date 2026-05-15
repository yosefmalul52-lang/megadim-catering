// CRITICAL: Load environment variables FIRST, before any other imports
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load environment variables from backend/.env only (single authoritative source).
// IMPORTANT: Do NOT override env vars already provided by the hosting platform (Render/Vercel).
const backendEnvPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(backendEnvPath)) {
  const result = dotenv.config({ path: backendEnvPath, override: false });
  if (result.error) {
    console.warn('[env] Failed to load backend .env:', result.error.message);
  } else {
    console.log('[env] Loaded backend .env:', backendEnvPath);
  }
} else {
  // Fallback to default dotenv behavior if backend/.env is missing
  const result = dotenv.config({ override: false });
  if (result.error) {
    console.warn('[env] No backend .env file found and default dotenv load failed:', result.error.message);
  } else {
    console.log('[env] Loaded default .env from CWD');
  }
}

// Aggressively normalize GOOGLE_MAPS_API_KEY to avoid hidden characters / quotes / spaces
if (typeof process.env.GOOGLE_MAPS_API_KEY === 'string') {
  process.env.GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY.replace(/['" ]/g, '').trim();
}

const hasMapsKey = !!process.env.GOOGLE_MAPS_API_KEY;

if (hasMapsKey) {
  console.log('[env] GOOGLE_MAPS_API_KEY is set (delivery fee API ready)');
} else {
  console.warn('[env] GOOGLE_MAPS_API_KEY is missing or empty after cleaning.');
  console.warn('[env] In backend/.env use exactly: GOOGLE_MAPS_API_KEY=your_key (no quotes, no spaces).');
}

console.log('🚀 Server starting with Vercel CORS fix applied!');

// Now import everything else after env is loaded
import express from 'express';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { connectDatabase } from './config/database';

// Import routes
import menuRoutes from './routes/menu.routes';
import contactRoutes from './routes/contact.routes';
import cateringRoutes from './routes/catering.routes';
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
import campaignRoutes from './routes/campaign.routes';
import holidayEventRoutes from './routes/holiday-event.routes';
import customerRoutes from './routes/customer.routes';

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

if (!process.env.JWT_SECRET || !String(process.env.JWT_SECRET).trim()) {
  console.error('❌ JWT_SECRET must be set in environment (e.g. backend/.env). Refusing to start.');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 4000;

// Trust proxy so X-Forwarded-For is used (Render / reverse proxy)
app.set('trust proxy', 1);

// Allowed origins: production domains + optional list from env (ALLOWED_ORIGINS)
const envOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()).filter(Boolean)
  : [];

const allowedOrigins: string[] = [
  'https://megadim-catering.vercel.app',
  'https://www.megadim-catering.com',
  'https://megadim-catering.com',
  ...envOrigins
];

if (process.env.NODE_ENV !== 'production') {
  allowedOrigins.push('http://localhost:4200');
}

// CORS – strict: only allowed origins, credentials enabled
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // same-origin or non-browser (e.g. Postman)
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(null, false); // disallow: no Access-Control-Allow-Origin sent
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'X-Requested-With', 'Accept']
}));

// Security headers: Helmet – explicit X-Frame-Options, X-Content-Type-Options, Referrer-Policy, CSP
app.use(helmet({
  frameguard: { action: 'deny' },
  noSniff: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https://res.cloudinary.com'],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://cdnjs.cloudflare.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'https://cdnjs.cloudflare.com'],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false
}));

// General API rate limit: 100 requests per 15 minutes per IP (DDoS / abuse protection)
const generalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, message: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api', generalApiLimiter);

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // For handling form data, including multipart
app.use(cookieParser());

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

// robots.txt for crawlers
app.get('/robots.txt', (req, res) => {
  res.type('text/plain').send('User-agent: *\nAllow: /');
});

// MongoDB Connection - Use centralized database config
connectDatabase().catch((err) => {
  console.error('❌ Failed to connect to MongoDB:', err);
  process.exit(1);
});

// API routes – ALL must be registered BEFORE the wildcard 404 handler below.
// CRITICAL: /api/settings and /api/delivery are registered FIRST so checkout never gets 404.
app.use('/api/settings', settingsRoutes);
app.use('/api/delivery', deliveryRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/catering', cateringRoutes);
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
app.use('/api/coupons', couponRoutes);
app.use('/api/users', userRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/campaign', campaignRoutes);
app.use('/api/holiday-events', holidayEventRoutes);

// 404 handler – MUST come AFTER all app.use('/api/...') above. If placed before, /api/settings and /api/delivery would always 404.
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
  console.log('📡 API routes registered: /api/health, /api/settings, /api/menu, /api/order, ...');

  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    try {
      await emailService.verifyConnection();
    } catch (err: any) {
      console.error('❌ SMTP connection failed on startup:', err?.message || err);
      console.error('❌ Full SMTP startup error:', {
        message: err?.message,
        code: err?.code,
        response: err?.response
      });
    }
  } else {
    console.log('⚠️ EMAIL_USER/EMAIL_PASS not set – order email endpoint will return 503 until configured');
  }
});
