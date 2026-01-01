const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');

// JWT Secret - should match the one in auth routes
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

/**
 * Authentication middleware to verify JWT token
 * Expects token in Authorization header as: Bearer <token>
 */
const authenticate = async (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'אין הרשאה - נדרש token'
      });
    }

    // Extract token
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'אין הרשאה - token חסר'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Extract user ID from payload
    // The payload uses 'id' field (as set in auth.routes.ts: payload = { id: user._id, role: user.role })
    const userId = decoded.id || decoded.userId || decoded._id;

    if (!userId) {
      console.error('❌ No user ID found in token payload');
      return res.status(401).json({
        success: false,
        message: 'Token לא מכיל מזהה משתמש'
      });
    }

    // ================ EXTREME DEBUGGING ================
    console.log('================ AUTH DEBUG ================');
    console.log('1. Connection DB Name:', mongoose.connection.name); // Which DB are we in?
    console.log('2. Connection DB Host:', mongoose.connection.host);
    console.log('3. Connection DB Port:', mongoose.connection.port);
    console.log('4. Collection Name:', User.collection.name); // Which collection?
    console.log('5. Token ID to find:', decoded.id);
    console.log('6. Token ID type:', typeof decoded.id);
    console.log('7. Token ID stringified:', String(decoded.id));
    
    // Check if ANY user exists
    const count = await User.countDocuments();
    console.log('8. Total Users in this DB:', count);
    
    // Try to find any user to verify DB connection
    const sampleUser = await User.findOne();
    if (sampleUser) {
      console.log('9. Sample user found:', {
        id: sampleUser._id,
        idString: String(sampleUser._id),
        username: sampleUser.username
      });
    } else {
      console.log('9. Sample user: ❌ No users found in collection');
    }
    
    // Try to find the specific user
    console.log('10. Searching for user with ID:', userId);
    const user = await User.findById(userId);
    console.log('11. Search Result:', user ? '✅ Found' : '❌ Not Found');
    
    if (user) {
      console.log('12. Found user details:', {
        id: user._id,
        idString: String(user._id),
        username: user.username,
        role: user.role
      });
    } else {
      console.log('12. User not found - ID comparison:', {
        searchedId: String(userId),
        searchedIdType: typeof userId,
        sampleUserId: sampleUser ? String(sampleUser._id) : 'N/A',
        idsMatch: sampleUser ? String(userId) === String(sampleUser._id) : 'N/A'
      });
    }
    console.log('============================================');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'משתמש לא נמצא',
        debugDb: mongoose.connection.name,
        debugCollection: User.collection.name,
        debugTotalUsers: count,
        debugSearchedId: String(userId)
      });
    }

    console.log('✅ User found:', {
      userId: user._id,
      userIdString: String(user._id),
      username: user.username,
      role: user.role,
      fullName: user.fullName
    });

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'חשבון המשתמש מושבת'
      });
    }

    // Attach user info to request object
    req.user = {
      _id: user._id, // Keep ObjectId for MongoDB queries
      id: user._id.toString(),
      username: user.username,
      role: user.role,
      fullName: user.fullName,
      phone: user.phone
    };

    // Continue to next middleware
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Token לא תקין'
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token פג תוקף'
      });
    }

    console.error('Auth middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'שגיאה באימות'
    });
  }
};

/**
 * Optional: Role-based authorization middleware
 * Use after authenticate middleware
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'אין הרשאה'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'אין הרשאה גישה לפעולה זו'
      });
    }

    next();
  };
};

module.exports = {
  authenticate,
  authorize
};

