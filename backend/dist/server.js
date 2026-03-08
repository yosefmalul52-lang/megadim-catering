"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _j;
Object.defineProperty(exports, "__esModule", { value: true });
// CRITICAL: Load environment variables FIRST, before any other imports
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
// Load .env: try cwd, then backend root, then project root (so backend/.env wins)
const cwdEnv = path_1.default.join(process.cwd(), '.env');
const backendEnv = path_1.default.join(__dirname, '..', '.env');
const rootEnv = path_1.default.join(__dirname, '..', '..', '.env');
dotenv_1.default.config(); // cwd
for (const p of [backendEnv, rootEnv]) {
    if (fs_1.default.existsSync(p)) {
        const r = dotenv_1.default.config({ path: p });
        if (!r.error)
            console.log('[env] Loaded:', p);
        else
            console.warn('[env] Failed to load', p, (_j = r.error) === null || _j === void 0 ? void 0 : _j.message);
    }
}
// Normalize: trim so "KEY=  value  " or empty value is handled
const raw = process.env.GOOGLE_MAPS_API_KEY;
if (raw !== undefined)
    process.env.GOOGLE_MAPS_API_KEY = raw.trim();
const hasMapsKey = !!process.env.GOOGLE_MAPS_API_KEY;
if (hasMapsKey) {
    console.log('[env] GOOGLE_MAPS_API_KEY is set (delivery fee API ready)');
}
else {
    console.warn('[env] GOOGLE_MAPS_API_KEY is missing or empty.');
    console.warn('[env] In backend/.env use exactly: GOOGLE_MAPS_API_KEY=your_key (no spaces around =)');
}
console.log('🚀 Server starting with Vercel CORS fix applied!');
// Now import everything else after env is loaded
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const database_1 = require("./config/database");
// Import routes
const menu_routes_1 = __importDefault(require("./routes/menu.routes"));
const contact_routes_1 = __importDefault(require("./routes/contact.routes"));
const order_routes_1 = __importDefault(require("./routes/order.routes"));
const orders_routes_1 = __importDefault(require("./routes/orders.routes"));
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const search_routes_1 = __importDefault(require("./routes/search.routes"));
const testimonials_routes_1 = __importDefault(require("./routes/testimonials.routes"));
const agent_routes_1 = __importDefault(require("./routes/agent.routes"));
const upload_routes_1 = __importDefault(require("./routes/upload.routes"));
const shopping_routes_1 = __importDefault(require("./routes/shopping.routes"));
const employee_routes_1 = __importDefault(require("./routes/employee.routes"));
const attendance_routes_1 = __importDefault(require("./routes/attendance.routes"));
const gallery_routes_1 = __importDefault(require("./routes/gallery.routes"));
const video_routes_1 = __importDefault(require("./routes/video.routes"));
const settings_routes_1 = __importDefault(require("./routes/settings.routes"));
const delivery_routes_1 = __importDefault(require("./routes/delivery.routes"));
const coupon_routes_1 = __importDefault(require("./routes/coupon.routes"));
const user_routes_1 = __importDefault(require("./routes/user.routes"));
// Import 404 handler
const notFoundHandler_1 = require("./middleware/notFoundHandler");
const email_service_1 = require("./services/email.service");
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
const app = (0, express_1.default)();
const PORT = process.env.PORT || 4000;
// CORS middleware - MUST be first, before any other middleware or routes
// Allow Vercel and Localhost to access the server
app.use((0, cors_1.default)({
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
app.use((0, helmet_1.default)());
// Middleware
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true })); // For handling form data, including multipart
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
(0, database_1.connectDatabase)().catch((err) => {
    console.error('❌ Failed to connect to MongoDB:', err);
    process.exit(1);
});
// API routes – ALL must be registered BEFORE the wildcard 404 handler below.
// CRITICAL: /api/settings and /api/delivery are registered FIRST so checkout never gets 404.
app.use('/api/settings', settings_routes_1.default);
app.use('/api/delivery', delivery_routes_1.default);
app.use('/api/menu', menu_routes_1.default);
app.use('/api/contact', contact_routes_1.default);
app.use('/api/order', order_routes_1.default);
app.use('/api/orders', orders_routes_1.default);
app.use('/api/auth', auth_routes_1.default);
app.use('/api/search', search_routes_1.default);
app.use('/api/testimonials', testimonials_routes_1.default);
app.use('/api/agent', agent_routes_1.default);
app.use('/api/upload', upload_routes_1.default);
app.use('/api/shopping', shopping_routes_1.default);
app.use('/api/employees', employee_routes_1.default);
app.use('/api/attendance', attendance_routes_1.default);
app.use('/api/gallery', gallery_routes_1.default);
app.use('/api/videos', video_routes_1.default);
app.use('/api/coupons', coupon_routes_1.default);
app.use('/api/users', user_routes_1.default);
// 404 handler – MUST come AFTER all app.use('/api/...') above. If placed before, /api/settings and /api/delivery would always 404.
app.use('*', notFoundHandler_1.notFoundHandler);
// Global Error Handler (must be last)
// Express recognizes error handlers by having exactly 4 parameters (err, req, res, next)
app.use((err, req, res, next) => {
    console.error('🔥 Server Error:', err.stack || err.message || err);
    res.status(err.statusCode || 500).json(Object.assign({ success: false, message: err.message || 'Internal Server Error' }, (process.env.NODE_ENV === 'development' && {
        stack: err.stack
    })));
});
// Start Server
app.listen(PORT, () => __awaiter(void 0, void 0, void 0, function* () {
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
    console.log('📡 API routes registered: /api/health, /api/settings, /api/menu, /api/order, ...');
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        try {
            yield email_service_1.emailService.verifyConnection();
        }
        catch (err) {
            console.error('❌ SMTP connection failed on startup:', (err === null || err === void 0 ? void 0 : err.message) || err);
        }
    }
    else {
        console.log('⚠️ EMAIL_USER/EMAIL_PASS not set – order email endpoint will return 503 until configured');
    }
}));
