import express, { Application, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

// Import routes
import menuRoutes from './routes/menu.routes';
import contactRoutes from './routes/contact.routes';
import orderRoutes from './routes/order.routes';
import authRoutes from './routes/auth.routes';
import searchRoutes from './routes/search.routes';
import testimonialsRoutes from './routes/testimonials.routes';
import agentRoutes from './routes/agent.routes';
import galleryRoutes from './routes/gallery.routes';
import videoRoutes from './routes/video.routes';
import settingsRoutes from './routes/settings.routes';

// Import middleware
import { errorHandler } from './middleware/errorHandler';
import { notFoundHandler } from './middleware/notFoundHandler';

const app: Application = express();

// Force CORS Headers - MUST be first, before any other middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  // Allow both local development and production origins
  const allowedOrigins = [
    'http://localhost:4200', // Local frontend development
    'https://magadim-backend.onrender.com', // Production backend (if needed)
    'https://megadim-catering.com', // Production frontend (if exists)
    'https://www.megadim-catering.com' // Production frontend with www (if exists)
  ];
  
  const origin = req.headers.origin;
  
  // Set CORS headers
  if (origin && allowedOrigins.includes(origin)) {
    res.header("Access-Control-Allow-Origin", origin);
  } else {
    // Fallback: allow all origins in development, restrict in production
    if (process.env.NODE_ENV !== 'production') {
      res.header("Access-Control-Allow-Origin", "*");
    }
  }
  
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  res.header("Access-Control-Allow-Credentials", "true");
  
  // Handle preflight requests immediately
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return; // Stop execution here
  }
  
  next();
});

// Trust proxy for rate limiting (if behind reverse proxy)
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
      imgSrc: ["'self'", "data:", "https:", "http:"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", "https://api.megadim-catering.com"]
    }
  }
}));


// Compression middleware
app.use(compression());

// Request parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/api/', limiter);

// More restrictive rate limiting for contact and order checkout endpoints
const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 requests per windowMs
  message: {
    error: 'Too many form submissions from this IP, please try again later.',
    retryAfter: '15 minutes'
  }
});

app.use('/api/contact', strictLimiter);
// Only checkout endpoint is rate-limited, admin routes are not limited

// Health check endpoint
app.get('/api/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0',
    service: 'Megadim Catering API'
  });
});

// API routes
app.use('/api/menu', menuRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/order', orderRoutes);
// Use auth routes (TypeScript - will be updated to use JWT later)
app.use('/api/auth', authRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/testimonials', testimonialsRoutes);
app.use('/api/agent', agentRoutes);
app.use('/api/gallery', galleryRoutes);
app.use('/api/videos', videoRoutes);
app.use('/api/settings', settingsRoutes);

// Root endpoint
app.get('/', (req: Request, res: Response) => {
  res.json({
    name: 'Megadim Catering API',
    version: '1.0.0',
    description: 'Premium kosher catering services API',
    status: 'running',
    message: 'Welcome to Megadim Catering API',
    endpoints: {
      health: '/api/health',
      api: '/api',
      menu: '/api/menu',
      contact: '/api/contact',
      order: '/api/order',
      auth: '/api/auth',
      search: '/api/search',
      testimonials: '/api/testimonials',
      agent: '/api/agent',
      gallery: '/api/gallery',
      videos: '/api/videos',
      settings: '/api/settings'
    },
    documentation: 'Visit /api for more information'
  });
});

// API info endpoint
app.get('/api', (req: Request, res: Response) => {
  res.json({
    name: 'Megadim Catering API',
    version: '1.0.0',
    description: 'Premium kosher catering services API',
    endpoints: {
      health: '/api/health',
      menu: '/api/menu',
      contact: '/api/contact',
      order: '/api/order',
      auth: '/api/auth',
      search: '/api/search',
      testimonials: '/api/testimonials',
      agent: '/api/agent',
      gallery: '/api/gallery',
      videos: '/api/videos',
      settings: '/api/settings'
    },
    documentation: 'Contact info@megadim-catering.com for API documentation'
  });
});

// 404 handler for undefined routes (must be after all routes)
app.use('*', notFoundHandler);

// Global error handler (must be last)
app.use((error: any, req: Request, res: Response, next: NextFunction) => {
  errorHandler(error, req, res, next);
});

export default app;
