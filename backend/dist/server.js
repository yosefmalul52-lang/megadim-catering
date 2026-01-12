"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const database_1 = require("./config/database");
const menu_routes_1 = __importDefault(require("./routes/menu.routes"));
const contact_routes_1 = __importDefault(require("./routes/contact.routes"));
const order_routes_1 = __importDefault(require("./routes/order.routes"));
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
const notFoundHandler_1 = require("./middleware/notFoundHandler");
console.log('🔍 Environment Variables Status:');
console.log('   PORT:', process.env.PORT || 'Not set (using default: 4000)');
console.log('   MONGO_URI:', process.env.MONGO_URI ? 'Found' : 'Missing');
console.log('   CLOUDINARY_CLOUD_NAME:', process.env.CLOUDINARY_CLOUD_NAME ? 'Found' : 'Missing');
console.log('   CLOUDINARY_API_KEY:', process.env.CLOUDINARY_API_KEY ? 'Found' : 'Missing');
console.log('   CLOUDINARY_API_SECRET:', process.env.CLOUDINARY_API_SECRET ? 'Found' : 'Missing');
console.log('☁️ Cloudinary Config:', {
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'Missing',
    api_key: process.env.CLOUDINARY_API_KEY || 'Missing',
    has_secret: !!process.env.CLOUDINARY_API_SECRET
});
const app = (0, express_1.default)();
const PORT = process.env.PORT || 4000;
app.use((0, cors_1.default)({ origin: 'http://localhost:4200', credentials: true }));
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
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
app.get('/', (req, res) => {
    res.send('✅ API is running on Port ' + PORT);
});
(0, database_1.connectDatabase)().catch((err) => {
    console.error('❌ Failed to connect to MongoDB:', err);
    process.exit(1);
});
app.use('/api/menu', menu_routes_1.default);
app.use('/api/contact', contact_routes_1.default);
app.use('/api/order', order_routes_1.default);
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
app.use('*', notFoundHandler_1.notFoundHandler);
app.use((err, req, res, next) => {
    console.error('🔥 Server Error:', err.stack || err.message || err);
    res.status(err.statusCode || 500).json({
        success: false,
        message: err.message || 'Internal Server Error',
        ...(process.env.NODE_ENV === 'development' && {
            stack: err.stack
        })
    });
});
app.listen(PORT, () => {
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
});
//# sourceMappingURL=server.js.map