"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const router = express_1.default.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'mysecretkey123';
const User = require('../models/User');
const Employee = require('../models/Employee');
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: 'שם משתמש וסיסמה נדרשים'
            });
        }
        console.log('🔍 Login attempt for username:', username.toLowerCase());
        const user = await User.findOne({ username: username.toLowerCase() });
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
        if (!user.isActive) {
            console.log('❌ Login failed: User account is inactive');
            return res.status(403).json({
                success: false,
                message: 'חשבון המשתמש מושבת'
            });
        }
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            console.log('❌ Login failed: Password mismatch');
            return res.status(400).json({
                success: false,
                message: 'פרטי התחברות שגויים'
            });
        }
        const payload = { id: user._id, role: user.role };
        console.log('🔍 Creating JWT token with payload:', {
            id: payload.id,
            idString: String(payload.id),
            role: payload.role
        });
        const token = jsonwebtoken_1.default.sign(payload, JWT_SECRET, { expiresIn: '1h' });
        console.log('✅ JWT token created successfully');
        return res.json({
            success: true,
            token,
            user: {
                id: user._id,
                fullName: user.fullName,
                username: user.username,
                role: user.role
            }
        });
    }
    catch (err) {
        console.error(err);
        return res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});
router.post('/register', async (req, res) => {
    try {
        const { fullName, username, password, phone } = req.body;
        if (!fullName || !username || !password || !phone) {
            return res.status(400).json({
                success: false,
                message: 'שם מלא, שם משתמש (אימייל), סיסמה וטלפון נדרשים'
            });
        }
        let user = await User.findOne({ username: username.toLowerCase() });
        if (user) {
            return res.status(400).json({
                success: false,
                message: 'משתמש עם שם משתמש זה כבר קיים'
            });
        }
        user = new User({
            fullName,
            username: username.toLowerCase(),
            password,
            phone,
            role: 'user'
        });
        await user.save();
        const payload = { id: user._id, role: user.role };
        const token = jsonwebtoken_1.default.sign(payload, JWT_SECRET, { expiresIn: '1h' });
        return res.json({
            success: true,
            token,
            user: {
                id: user._id,
                fullName,
                username: user.username,
                role: 'user'
            }
        });
    }
    catch (err) {
        console.error(err);
        return res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});
router.post('/employee-login', async (req, res) => {
    try {
        const { phone, pinCode } = req.body;
        if (!phone || !pinCode) {
            return res.status(400).json({
                success: false,
                message: 'מספר טלפון וקוד PIN נדרשים'
            });
        }
        console.log('🔍 Employee login attempt for phone:', phone);
        const employee = await Employee.findOne({
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
        const payload = {
            id: employee._id,
            role: 'employee',
            type: 'employee'
        };
        const token = jsonwebtoken_1.default.sign(payload, JWT_SECRET, { expiresIn: '7d' });
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
});
exports.default = router;
//# sourceMappingURL=auth.routes.js.map