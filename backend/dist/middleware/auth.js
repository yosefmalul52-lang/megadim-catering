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
Object.defineProperty(exports, "__esModule", { value: true });
exports.authorize = exports.authenticate = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
// Import models - using require for CommonJS compatibility
const User = require('../models/User');
const Employee = require('../models/Employee');
// JWT Secret - must be set in environment; server throws on startup if missing
const JWT_SECRET = process.env.JWT_SECRET;
/**
 * Authentication middleware to verify JWT token
 * Expects token in Authorization header as: Bearer <token>
 */
const authenticate = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _j;
    try {
        // Token: HttpOnly cookie first, then Authorization header (fallback)
        const cookieToken = (_j = req.cookies) === null || _j === void 0 ? void 0 : _j.token;
        const authHeader = req.headers.authorization;
        const bearerToken = (authHeader === null || authHeader === void 0 ? void 0 : authHeader.startsWith('Bearer ')) ? authHeader.substring(7).trim() : null;
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
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
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
            const employee = yield Employee.findById(employeeId);
            if (!employee || !employee.isActive) {
                res.status(404).json({
                    success: false,
                    message: 'עובד לא נמצא או לא פעיל'
                });
                return;
            }
            // Attach employee info to request object
            req.user = {
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
        const user = yield User.findById(userId);
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
    }
    catch (error) {
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
});
exports.authenticate = authenticate;
/**
 * Role-based authorization middleware. Use after authenticate middleware.
 * Returns 403 with serverSeesRole for debugging production role mismatch.
 */
const authorize = (...roles) => {
    return (req, res, next) => {
        const user = req.user;
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
exports.authorize = authorize;
// Also export as CommonJS for backward compatibility
module.exports = {
    authenticate: exports.authenticate,
    authorize: exports.authorize
};
