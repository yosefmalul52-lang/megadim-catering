import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
dotenv.config();

// Import routes
import menuRoutes from './routes/menu.routes';
import contactRoutes from './routes/contact.routes';
import orderRoutes from './routes/order.routes';
import authRoutes from './routes/auth.routes';
import searchRoutes from './routes/search.routes';
import testimonialsRoutes from './routes/testimonials.routes';
import agentRoutes from './routes/agent.routes';

// Debugging: Check loaded environment variables
console.log('🔍 Loaded Env Variables - PORT:', process.env.PORT);
console.log('🔍 Loaded Env Variables - DB:', process.env.MONGODB_URI ? 'Found' : 'Missing');

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors({ origin: 'http://localhost:4200', credentials: true }));
app.use(express.json());

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

// MongoDB Connection
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || '';

if (!MONGO_URI) {
  console.error('❌ MONGO_URI is missing in .env file');
} else {
  mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ MongoDB Connected Successfully!'))
    .catch(err => console.error('❌ MongoDB Connection Error:', err));
}

// API routes
app.use('/api/menu', menuRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/order', orderRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/testimonials', testimonialsRoutes);
app.use('/api/agent', agentRoutes);

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
});
