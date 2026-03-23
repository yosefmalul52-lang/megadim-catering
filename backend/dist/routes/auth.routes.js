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
const express_1 = __importDefault(require("express"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const router = express_1.default.Router();
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    throw new Error('JWT_SECRET must be set in environment (e.g. backend/.env)');
}
// Strict rate limit for login endpoints (brute-force protection)
const loginLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per window per IP
    message: { success: false, message: 'Too many login attempts from this IP, please try again after 15 minutes.' },
    standardHeaders: true,
    legacyHeaders: false
});
const COOKIE_NAME = 'token';
const COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
/** Cookie options: production uses sameSite: 'none' + secure so cookies work across Vercel (frontend) and Render (backend). */
const cookieOptions = () => {
    const isProduction = process.env.NODE_ENV === 'production';
    return {
        httpOnly: true,
        secure: isProduction, // required for HTTPS on Render; required when sameSite is 'none'
        sameSite: isProduction ? 'none' : 'lax', // 'none' required for cross-domain (e.g. .vercel.app → .onrender.com)
        maxAge: COOKIE_MAX_AGE_MS,
        path: '/'
        // Do not set domain: let the browser use the response origin (Render) so the cookie is sent on same-site requests to the API
    };
};
// Import User model
const User = require('../models/User');
// Import Employee model
const Employee = require('../models/Employee');
const { authenticate } = require('../middleware/auth');
// Login Route (with strict rate limiting)
router.post('/login', loginLimiter, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { username, password } = req.body;
        // Validate input
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: 'שם משתמש וסיסמה נדרשים'
            });
        }
        // Check if user exists (username is used as email in this system)
        console.log('🔍 Login attempt for username:', username.toLowerCase());
        const user = yield User.findOne({ username: username.toLowerCase() });
        if (!user) {
            console.log('❌ Login failed: User not found for username:', username.toLowerCase());
            return res.status(400).json({
                success: false,
                message: 'פרטי התחברות שגויים'
            });
        }
        console.log('✅ User found for login:', {
            userId: user._id,
            userIdString: String(user._id),
            username: user.username,
            role: user.role
        });
        // Check if user is active
        if (!user.isActive) {
            console.log('❌ Login failed: User account is inactive');
            return res.status(403).json({
                success: false,
                message: 'חשבון המשתמש מושבת'
            });
        }
        // Check password
        const isMatch = yield user.comparePassword(password);
        if (!isMatch) {
            console.log('❌ Login failed: Password mismatch');
            return res.status(400).json({
                success: false,
                message: 'פרטי התחברות שגויים'
            });
        }
        // Create Token (7 days – balance of security and e‑commerce UX). Role must be in payload for authorize().
        const role = user.role != null ? String(user.role) : 'customer';
        const payload = { id: user._id, role };
        console.log('🔍 Creating JWT token with payload:', {
            id: payload.id,
            idString: String(payload.id),
            role: payload.role
        });
        const token = jsonwebtoken_1.default.sign(payload, JWT_SECRET, { expiresIn: '7d' });
        console.log('✅ JWT token created successfully');
        // Return user without password (sanitized)
        const userResponse = yield User.findById(user._id).select('-password').lean();
        const safeUser = userResponse
            ? { id: userResponse._id, fullName: userResponse.fullName, username: userResponse.username, role: userResponse.role }
            : { id: user._id, fullName: user.fullName, username: user.username, role: user.role };
        res.cookie(COOKIE_NAME, token, cookieOptions());
        return res.json({
            success: true,
            user: safeUser
        });
    }
    catch (err) {
        console.error(err);
        return res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
}));
// Register Route – requires only fullName, email (username), password; phone/address optional
router.post('/register', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { fullName, username, password, phone } = req.body;
        if (!fullName || !username || !password) {
            return res.status(400).json({
                success: false,
                message: 'שם מלא, אימייל וסיסמה נדרשים'
            });
        }
        let user = yield User.findOne({ username: username.toLowerCase() });
        if (user) {
            return res.status(400).json({
                success: false,
                message: 'משתמש עם אימייל זה כבר קיים'
            });
        }
        const userData = {
            fullName: fullName.trim(),
            username: username.toLowerCase(),
            password,
            role: 'user'
        };
        if (phone != null && String(phone).trim() !== '')
            userData.phone = String(phone).trim();
        user = new User(userData);
        yield user.save();
        // Create Token (7 days)
        const payload = { id: user._id, role: user.role };
        const token = jsonwebtoken_1.default.sign(payload, JWT_SECRET, { expiresIn: '7d' });
        // Return user without password (sanitized)
        const userResponse = yield User.findById(user._id).select('-password').lean();
        const safeUser = userResponse
            ? { id: userResponse._id, fullName: userResponse.fullName, username: userResponse.username, role: userResponse.role }
            : { id: user._id, fullName, username: user.username, role: 'user' };
        res.cookie(COOKIE_NAME, token, cookieOptions());
        return res.json({
            success: true,
            user: safeUser
        });
    }
    catch (err) {
        console.error(err);
        return res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
}));
// Employee Login Route (with strict rate limiting)
router.post('/employee-login', loginLimiter, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { phone, pinCode } = req.body;
        // Validate input
        if (!phone || !pinCode) {
            return res.status(400).json({
                success: false,
                message: 'מספר טלפון וקוד PIN נדרשים'
            });
        }
        // Find employee by phone and PIN
        console.log('🔍 Employee login attempt for phone:', phone);
        const employee = yield Employee.findOne({
            phone: phone.trim(),
            pinCode: pinCode.trim(),
            isActive: true
        });
        if (!employee) {
            console.log('❌ Employee login failed: Employee not found or invalid PIN');
            return res.status(400).json({
                success: false,
                message: 'פרטי התחברות שגויים'
            });
        }
        console.log('✅ Employee found for login:', {
            employeeId: employee._id,
            name: `${employee.firstName} ${employee.lastName}`
        });
        // Create Token (with role: 'employee')
        const payload = {
            id: employee._id,
            role: 'employee',
            type: 'employee' // To distinguish from regular users
        };
        const token = jsonwebtoken_1.default.sign(payload, JWT_SECRET, { expiresIn: '7d' });
        console.log('✅ Employee JWT token created successfully');
        res.cookie(COOKIE_NAME, token, cookieOptions());
        return res.json({
            success: true,
            employee: {
                id: employee._id,
                firstName: employee.firstName,
                lastName: employee.lastName,
                fullName: `${employee.firstName} ${employee.lastName}`,
                phone: employee.phone,
                role: employee.role
            }
        });
    }
    catch (err) {
        console.error('❌ Employee login error:', err);
        return res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
}));
// Session: return current user from cookie (no token in response)
router.get('/me', authenticate, (req, res) => {
    var _j, _k, _q;
    const user = req.user;
    const safe = user ? {
        id: (_q = (_k = (_j = user._id) === null || _j === void 0 ? void 0 : _j.toString) === null || _k === void 0 ? void 0 : _k.call(_j)) !== null && _q !== void 0 ? _q : user.id,
        username: user.username,
        role: user.role,
        fullName: user.fullName,
        phone: user.phone,
        firstName: user.firstName,
        lastName: user.lastName
    } : null;
    return res.json({ success: true, user: safe });
});
// Logout: clear cookie with the SAME options it was set with (required for browser to clear it)
router.post('/logout', (_req, res) => {
    const isProduction = process.env.NODE_ENV === 'production';
    res.clearCookie(COOKIE_NAME, {
        path: '/',
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'none' : 'lax'
    });
    return res.status(200).json({ success: true, message: 'Logged out successfully' });
});
exports.default = router;
