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
const mongoose_1 = __importDefault(require("mongoose"));
// Import models - using require for CommonJS compatibility
const User = require('../models/User');
const Employee = require('../models/Employee');
// JWT Secret - should match the one in auth routes
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
/**
 * Authentication middleware to verify JWT token
 * Expects token in Authorization header as: Bearer <token>
 */
const authenticate = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Get token from Authorization header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).json({
                success: false,
                message: 'אין הרשאה - נדרש token'
            });
            return;
        }
        // Extract token
        const token = authHeader.substring(7); // Remove 'Bearer ' prefix
        if (!token) {
            res.status(401).json({
                success: false,
                message: 'אין הרשאה - token חסר'
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
        // ================ EXTREME DEBUGGING ================
        console.log('================ AUTH DEBUG ================');
        console.log('1. Connection DB Name:', mongoose_1.default.connection.name); // Which DB are we in?
        console.log('2. Connection DB Host:', mongoose_1.default.connection.host);
        console.log('3. Connection DB Port:', mongoose_1.default.connection.port);
        console.log('4. Collection Name:', User.collection.name); // Which collection?
        console.log('5. Token ID to find:', decoded.id);
        console.log('6. Token ID type:', typeof decoded.id);
        console.log('7. Token ID stringified:', String(decoded.id));
        // Check if ANY user exists
        const count = yield User.countDocuments();
        console.log('8. Total Users in this DB:', count);
        // Try to find any user to verify DB connection
        const sampleUser = yield User.findOne();
        if (sampleUser) {
            console.log('9. Sample user found:', {
                id: sampleUser._id,
                idString: String(sampleUser._id),
                username: sampleUser.username
            });
        }
        else {
            console.log('9. Sample user: ❌ No users found in collection');
        }
        // Try to find the specific user
        console.log('10. Searching for user with ID:', userId);
        const user = yield User.findById(userId);
        console.log('11. Search Result:', user ? '✅ Found' : '❌ Not Found');
        if (user) {
            console.log('12. Found user details:', {
                id: user._id,
                idString: String(user._id),
                username: user.username,
                role: user.role
            });
        }
        else {
            console.log('12. User not found - ID comparison:', {
                searchedId: String(userId),
                searchedIdType: typeof userId,
                sampleUserId: sampleUser ? String(sampleUser._id) : 'N/A',
                idsMatch: sampleUser ? String(userId) === String(sampleUser._id) : 'N/A'
            });
        }
        console.log('============================================');
        if (!user) {
            res.status(404).json({
                success: false,
                message: 'משתמש לא נמצא',
                debugDb: mongoose_1.default.connection.name,
                debugCollection: User.collection.name,
                debugTotalUsers: count,
                debugSearchedId: String(userId)
            });
            return;
        }
        console.log('✅ User found:', {
            userId: user._id,
            userIdString: String(user._id),
            username: user.username,
            role: user.role,
            fullName: user.fullName
        });
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
 * Optional: Role-based authorization middleware
 * Use after authenticate middleware
 */
const authorize = (...roles) => {
    return (req, res, next) => {
        const user = req.user;
        if (!user) {
            res.status(401).json({
                success: false,
                message: 'אין הרשאה'
            });
            return;
        }
        if (!roles.includes(user.role)) {
            res.status(403).json({
                success: false,
                message: 'אין הרשאה גישה לפעולה זו'
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
