import express, { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'mysecretkey123';

// Import User model
const User = require('../models/User');
// Import Employee model
const Employee = require('../models/Employee');

// Login Route
router.post('/login', async (req: Request, res: Response) => {
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

    // Check if user is active
    if (!user.isActive) {
      console.log('❌ Login failed: User account is inactive');
      return res.status(403).json({ 
        success: false,
        message: 'חשבון המשתמש מושבת' 
      });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
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
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '2h' });
    console.log('✅ JWT token created successfully');

    // Return user without password (sanitized)
    const userResponse = await User.findById(user._id).select('-password').lean();
    const safeUser = userResponse
      ? { id: (userResponse as any)._id, fullName: (userResponse as any).fullName, username: (userResponse as any).username, role: (userResponse as any).role }
      : { id: user._id, fullName: user.fullName, username: user.username, role: user.role };

    return res.json({
      success: true,
      token,
      user: safeUser
    });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
});

// Register Route – requires only fullName, email (username), password; phone/address optional
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { fullName, username, password, phone } = req.body;

    if (!fullName || !username || !password) {
      return res.status(400).json({
        success: false,
        message: 'שם מלא, אימייל וסיסמה נדרשים'
      });
    }

    let user = await User.findOne({ username: username.toLowerCase() });
    if (user) {
      return res.status(400).json({
        success: false,
        message: 'משתמש עם אימייל זה כבר קיים'
      });
    }

    const userData: Record<string, unknown> = {
      fullName: (fullName as string).trim(),
      username: (username as string).toLowerCase(),
      password,
      role: 'user'
    };
    if (phone != null && String(phone).trim() !== '') userData.phone = String(phone).trim();

    user = new User(userData);

    await user.save();

    // Create Token (7 days)
    const payload = { id: user._id, role: user.role };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '2h' });

    // Return user without password (sanitized)
    const userResponse = await User.findById(user._id).select('-password').lean();
    const safeUser = userResponse
      ? { id: (userResponse as any)._id, fullName: (userResponse as any).fullName, username: (userResponse as any).username, role: (userResponse as any).role }
      : { id: user._id, fullName, username: user.username, role: 'user' };

    return res.json({
      success: true,
      token,
      user: safeUser
    });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
});

// Employee Login Route
router.post('/employee-login', async (req: Request, res: Response) => {
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

    // Create Token (with role: 'employee')
    const payload = { 
      id: employee._id, 
      role: 'employee',
      type: 'employee' // To distinguish from regular users
    };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' }); // Longer expiry for employees
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
  } catch (err: any) {
    console.error('❌ Employee login error:', err);
    return res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
});

export default router;
