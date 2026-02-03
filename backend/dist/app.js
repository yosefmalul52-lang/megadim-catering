"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const compression_1 = __importDefault(require("compression"));
const morgan_1 = __importDefault(require("morgan"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
// Import routes
const menu_routes_1 = __importDefault(require("./routes/menu.routes"));
const contact_routes_1 = __importDefault(require("./routes/contact.routes"));
const order_routes_1 = __importDefault(require("./routes/order.routes"));
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const search_routes_1 = __importDefault(require("./routes/search.routes"));
const testimonials_routes_1 = __importDefault(require("./routes/testimonials.routes"));
const agent_routes_1 = __importDefault(require("./routes/agent.routes"));
const gallery_routes_1 = __importDefault(require("./routes/gallery.routes"));
const video_routes_1 = __importDefault(require("./routes/video.routes"));
const settings_routes_1 = __importDefault(require("./routes/settings.routes"));
// Import middleware
const errorHandler_1 = require("./middleware/errorHandler");
const notFoundHandler_1 = require("./middleware/notFoundHandler");
const app = (0, express_1.default)();
// Force CORS Headers - MUST be first, before any other middleware
app.use((req, res, next) => {
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
    }
    else {
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
app.use((0, helmet_1.default)({
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
app.use((0, compression_1.default)());
// Request parsing middleware
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
// Logging middleware
if (process.env.NODE_ENV === 'development') {
    app.use((0, morgan_1.default)('dev'));
}
else {
    app.use((0, morgan_1.default)('combined'));
}
// Rate limiting
const limiter = (0, express_rate_limit_1.default)({
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
const strictLimiter = (0, express_rate_limit_1.default)({
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
// API routes
app.use('/api/menu', menu_routes_1.default);
app.use('/api/contact', contact_routes_1.default);
app.use('/api/order', order_routes_1.default);
// Use auth routes (TypeScript - will be updated to use JWT later)
app.use('/api/auth', auth_routes_1.default);
app.use('/api/search', search_routes_1.default);
app.use('/api/testimonials', testimonials_routes_1.default);
app.use('/api/agent', agent_routes_1.default);
app.use('/api/gallery', gallery_routes_1.default);
app.use('/api/videos', video_routes_1.default);
app.use('/api/settings', settings_routes_1.default);
// Root endpoint
app.get('/', (req, res) => {
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
app.get('/api', (req, res) => {
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
app.use('*', notFoundHandler_1.notFoundHandler);
// Global error handler (must be last)
app.use((error, req, res, next) => {
    (0, errorHandler_1.errorHandler)(error, req, res, next);
});
exports.default = app;
