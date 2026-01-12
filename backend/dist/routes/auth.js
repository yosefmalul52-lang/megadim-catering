var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { asyncHandler } = require('../middleware/errorHandler');
const router = express.Router();
// JWT Secret - should be in .env in production
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
// POST /api/auth/login
router.post('/login', asyncHandler((req, res) => __awaiter(this, void 0, void 0, function* () {
    const { username, password } = req.body;
    // Validate input
    if (!username || !password) {
        return res.status(400).json({
            success: false,
            message: 'שם משתמש וסיסמה נדרשים'
        });
    }
    // Find user by username
    const user = yield User.findOne({ username: username.toLowerCase() });
    if (!user) {
        return res.status(401).json({
            success: false,
            message: 'פרטי התחברות שגויים'
        });
    }
    // Check if user is active
    if (!user.isActive) {
        return res.status(403).json({
            success: false,
            message: 'חשבון המשתמש מושבת'
        });
    }
    // Compare password
    const isPasswordValid = yield user.comparePassword(password);
    if (!isPasswordValid) {
        return res.status(401).json({
            success: false,
            message: 'פרטי התחברות שגויים'
        });
    }
    // Generate JWT token
    const token = jwt.sign({
        userId: user._id,
        username: user.username,
        role: user.role
    }, JWT_SECRET, {
        expiresIn: JWT_EXPIRES_IN
    });
    // Return success response
    res.status(200).json({
        success: true,
        message: 'התחברות בוצעה בהצלחה',
        token: token,
        user: {
            id: user._id,
            username: user.username,
            role: user.role
        }
    });
})));
// POST /api/auth/validate - Validate token
router.post('/validate', asyncHandler((req, res) => __awaiter(this, void 0, void 0, function* () {
    const { token } = req.body;
    if (!token) {
        return res.status(400).json({
            success: false,
            valid: false,
            message: 'Token is required'
        });
    }
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        // Optionally check if user still exists and is active
        const user = yield User.findById(decoded.userId);
        if (!user || !user.isActive) {
            return res.status(401).json({
                success: false,
                valid: false,
                message: 'User not found or inactive'
            });
        }
        res.status(200).json({
            success: true,
            valid: true,
            user: {
                id: user._id,
                username: user.username,
                role: user.role
            }
        });
    }
    catch (error) {
        res.status(401).json({
            success: false,
            valid: false,
            message: 'Invalid or expired token'
        });
    }
})));
module.exports = router;
