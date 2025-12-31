const jwt = require('jsonwebtoken');
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

    // Optionally verify user still exists and is active
    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'משתמש לא נמצא'
      });
    }

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

