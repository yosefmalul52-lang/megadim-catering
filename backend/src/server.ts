// CRITICAL: Load environment variables FIRST, before any other imports
// Since we run npm start from backend/, dotenv will automatically find backend/.env
import dotenv from 'dotenv';
dotenv.config();

// Now import everything else after env is loaded
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import { connectDatabase } from './config/database';

// Import routes
import menuRoutes from './routes/menu.routes';
import contactRoutes from './routes/contact.routes';
import orderRoutes from './routes/order.routes';
import authRoutes from './routes/auth.routes';
import searchRoutes from './routes/search.routes';
import testimonialsRoutes from './routes/testimonials.routes';
import agentRoutes from './routes/agent.routes';
import uploadRoutes from './routes/upload.routes';
import shoppingRoutes from './routes/shopping.routes';

// Import 404 handler
import { notFoundHandler } from './middleware/notFoundHandler';

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

// Middleware
app.use(cors({ origin: 'http://localhost:4200', credentials: true }));
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
app.use('/api/auth', authRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/testimonials', testimonialsRoutes);
app.use('/api/agent', agentRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/shopping', shoppingRoutes);

// 404 handler for undefined routes (must be after all routes)
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
app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
});
