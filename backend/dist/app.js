"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const compression_1 = __importDefault(require("compression"));
const morgan_1 = __importDefault(require("morgan"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const menu_routes_1 = __importDefault(require("./routes/menu.routes"));
const contact_routes_1 = __importDefault(require("./routes/contact.routes"));
const order_routes_1 = __importDefault(require("./routes/order.routes"));
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const search_routes_1 = __importDefault(require("./routes/search.routes"));
const testimonials_routes_1 = __importDefault(require("./routes/testimonials.routes"));
const agent_routes_1 = __importDefault(require("./routes/agent.routes"));
const gallery_routes_1 = __importDefault(require("./routes/gallery.routes"));
const video_routes_1 = __importDefault(require("./routes/video.routes"));
const errorHandler_1 = require("./middleware/errorHandler");
const notFoundHandler_1 = require("./middleware/notFoundHandler");
const app = (0, express_1.default)();
app.set('trust proxy', 1);
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
const corsOptions = {
    origin: process.env.NODE_ENV === 'production'
        ? ['https://megadim-catering.com', 'https://www.megadim-catering.com']
        : 'http://localhost:4200',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true,
    optionsSuccessStatus: 200
};
app.use((0, cors_1.default)(corsOptions));
app.use((0, compression_1.default)());
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
if (process.env.NODE_ENV === 'development') {
    app.use((0, morgan_1.default)('dev'));
}
else {
    app.use((0, morgan_1.default)('combined'));
}
const limiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: {
        error: 'Too many requests from this IP, please try again later.',
        retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false
});
app.use('/api/', limiter);
const strictLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: {
        error: 'Too many form submissions from this IP, please try again later.',
        retryAfter: '15 minutes'
    }
});
app.use('/api/contact', strictLimiter);
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
app.use('/api/menu', menu_routes_1.default);
app.use('/api/contact', contact_routes_1.default);
app.use('/api/order', order_routes_1.default);
app.use('/api/auth', auth_routes_1.default);
app.use('/api/search', search_routes_1.default);
app.use('/api/testimonials', testimonials_routes_1.default);
app.use('/api/agent', agent_routes_1.default);
app.use('/api/gallery', gallery_routes_1.default);
app.use('/api/videos', video_routes_1.default);
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
            videos: '/api/videos'
        },
        documentation: 'Visit /api for more information'
    });
});
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
            videos: '/api/videos'
        },
        documentation: 'Contact info@megadim-catering.com for API documentation'
    });
});
app.use('*', notFoundHandler_1.notFoundHandler);
app.use((error, req, res, next) => {
    (0, errorHandler_1.errorHandler)(error, req, res, next);
});
exports.default = app;
//# sourceMappingURL=app.js.map