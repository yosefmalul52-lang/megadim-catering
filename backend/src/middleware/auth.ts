import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

// Import models - using require for CommonJS compatibility
const User = require('../models/User');
const Employee = require('../models/Employee');

// JWT Secret - must be set in environment; server throws on startup if missing
const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Authentication middleware to verify JWT token
 * Expects token in Authorization header as: Bearer <token>
 */
export const authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Token: HttpOnly cookie first, then Authorization header (fallback)
    const cookieToken = (req as any).cookies?.token;
    const authHeader = req.headers.authorization;
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7).trim() : null;
    const token = cookieToken || bearerToken;

    if (!token) {
      res.status(401).json({
        success: false,
        message: 'אין הרשאה - נדרש token'
      });
      return;
    }

    if (!JWT_SECRET) {
      res.status(500).json({
        success: false,
        message: 'Server misconfiguration'
      });
      return;
    }

    // Verify token
    const decoded: any = jwt.verify(token, JWT_SECRET);
    
    // Check if this is an employee token
    if (decoded.type === 'employee' || decoded.role === 'employee') {
      // Employee authentication
      const employeeId = decoded.id || decoded.userId || decoded._id;
      
      if (!employeeId) {
        res.status(401).json({
          success: false,
          message: 'Token לא מכיל מזהה עובד'
        });
        return;
      }

      const employee = await Employee.findById(employeeId);
      
      if (!employee || !employee.isActive) {
        res.status(404).json({
          success: false,
          message: 'עובד לא נמצא או לא פעיל'
        });
        return;
      }

      // Attach employee info to request object
      (req as any).user = {
        _id: employee._id,
        id: employee._id.toString(),
        firstName: employee.firstName,
        lastName: employee.lastName,
        fullName: `${employee.firstName} ${employee.lastName}`,
        role: 'employee',
        type: 'employee',
        phone: employee.phone
      };

      next();
      return;
    }
    
    // Regular user authentication
    // Extract user ID from payload
    // The payload uses 'id' field (as set in auth.routes.ts: payload = { id: user._id, role: user.role })
    const userId = decoded.id || decoded.userId || decoded._id;

    if (!userId) {
      console.error('❌ No user ID found in token payload');
      res.status(401).json({
        success: false,
        message: 'Token לא מכיל מזהה משתמש'
      });
      return;
    }

    const user = await User.findById(userId);

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'משתמש לא נמצא'
      });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({
        success: false,
        message: 'חשבון המשתמש מושבת'
      });
      return;
    }

    // Attach user info to request object
    (req as any).user = {
      _id: user._id, // Keep ObjectId for MongoDB queries
      id: user._id.toString(),
      username: user.username,
      role: user.role,
      fullName: user.fullName,
      phone: user.phone
    };

    // Continue to next middleware
    next();
  } catch (error: any) {
    if (error.name === 'JsonWebTokenError') {
      res.status(401).json({
        success: false,
        message: 'Token לא תקין'
      });
      return;
    }

    if (error.name === 'TokenExpiredError') {
      res.status(401).json({
        success: false,
        message: 'Token פג תוקף'
      });
      return;
    }

    console.error('Auth middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'שגיאה באימות'
    });
  }
};

/**
 * Role-based authorization middleware. Use after authenticate middleware.
 * Returns 403 with serverSeesRole for debugging production role mismatch.
 */
export const authorize = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as any).user;

    if (!user || !roles.includes(user.role)) {
      res.status(403).json({
        success: false,
        message: 'Forbidden: Admin access required',
        serverSeesRole: user ? user.role : 'User object missing'
      });
      return;
    }

    next();
  };
};

// Also export as CommonJS for backward compatibility
module.exports = {
  authenticate,
  authorize
};

