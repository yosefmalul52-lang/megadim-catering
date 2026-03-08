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
const router = express_1.default.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'mysecretkey123';
// Import User model
const User = require('../models/User');
// Import Employee model
const Employee = require('../models/Employee');
// Login Route
router.post('/login', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
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
        // Create Token (7 days – balance of security and e‑commerce UX)
        const payload = { id: user._id, role: user.role };
        console.log('🔍 Creating JWT token with payload:', {
            id: payload.id,
            idString: String(payload.id),
            role: payload.role
        });
        const token = jsonwebtoken_1.default.sign(payload, JWT_SECRET, { expiresIn: '2h' });
        console.log('✅ JWT token created successfully');
        // Return user without password (sanitized)
        const userResponse = yield User.findById(user._id).select('-password').lean();
        const safeUser = userResponse
            ? { id: userResponse._id, fullName: userResponse.fullName, username: userResponse.username, role: userResponse.role }
            : { id: user._id, fullName: user.fullName, username: user.username, role: user.role };
        return res.json({
            success: true,
            token,
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
// Register Route
router.post('/register', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { fullName, username, password, phone } = req.body;
        // Validate input
        if (!fullName || !username || !password || !phone) {
            return res.status(400).json({
                success: false,
                message: 'שם מלא, שם משתמש (אימייל), סיסמה וטלפון נדרשים'
            });
        }
        // Check if user exists (username is used as email in this system)
        let user = yield User.findOne({ username: username.toLowerCase() });
        if (user) {
            return res.status(400).json({
                success: false,
                message: 'משתמש עם שם משתמש זה כבר קיים'
            });
        }
        // Create user (password will be hashed by pre-save hook in User model)
        user = new User({
            fullName,
            username: username.toLowerCase(),
            password,
            phone,
            role: 'user' // Default role
        });
        yield user.save();
        // Create Token (7 days)
        const payload = { id: user._id, role: user.role };
        const token = jsonwebtoken_1.default.sign(payload, JWT_SECRET, { expiresIn: '2h' });
        // Return user without password (sanitized)
        const userResponse = yield User.findById(user._id).select('-password').lean();
        const safeUser = userResponse
            ? { id: userResponse._id, fullName: userResponse.fullName, username: userResponse.username, role: userResponse.role }
            : { id: user._id, fullName, username: user.username, role: 'user' };
        return res.json({
            success: true,
            token,
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
// Employee Login Route
router.post('/employee-login', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
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
        const token = jsonwebtoken_1.default.sign(payload, JWT_SECRET, { expiresIn: '7d' }); // Longer expiry for employees
        console.log('✅ Employee JWT token created successfully');
        return res.json({
            success: true,
            token,
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
exports.default = router;
