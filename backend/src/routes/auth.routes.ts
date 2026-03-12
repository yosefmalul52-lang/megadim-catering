import express, { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'mysecretkey123';

// Strict rate limit for login endpoints (brute-force protection)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window per IP
  message: { success: false, message: 'Too many login attempts from this IP, please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false
});

const COOKIE_NAME = 'token';
const COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/** Cookie options: production uses sameSite: 'none' + secure so cookies work across Vercel (frontend) and Render (backend). */
const cookieOptions = (): { httpOnly: boolean; secure: boolean; sameSite: 'strict' | 'lax' | 'none'; maxAge: number; path: string } => {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProduction, // required for HTTPS on Render; required when sameSite is 'none'
    sameSite: isProduction ? ('none' as const) : ('lax' as const), // 'none' required for cross-domain (e.g. .vercel.app → .onrender.com)
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
router.post('/login', loginLimiter, async (req: Request, res: Response) => {
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
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
    console.log('✅ JWT token created successfully');

    // Return user without password (sanitized)
    const userResponse = await User.findById(user._id).select('-password').lean();
    const safeUser = userResponse
      ? { id: (userResponse as any)._id, fullName: (userResponse as any).fullName, username: (userResponse as any).username, role: (userResponse as any).role }
      : { id: user._id, fullName: user.fullName, username: user.username, role: user.role };

    res.cookie(COOKIE_NAME, token, cookieOptions());
    return res.json({
      success: true,
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
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });

    // Return user without password (sanitized)
    const userResponse = await User.findById(user._id).select('-password').lean();
    const safeUser = userResponse
      ? { id: (userResponse as any)._id, fullName: (userResponse as any).fullName, username: (userResponse as any).username, role: (userResponse as any).role }
      : { id: user._id, fullName, username: user.username, role: 'user' };

    res.cookie(COOKIE_NAME, token, cookieOptions());
    return res.json({
      success: true,
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

// Employee Login Route (with strict rate limiting)
router.post('/employee-login', loginLimiter, async (req: Request, res: Response) => {
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
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
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
  } catch (err: any) {
    console.error('❌ Employee login error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Session: return current user from cookie (no token in response)
router.get('/me', authenticate, (req: Request, res: Response) => {
  const user = (req as any).user;
  const safe = user ? {
    id: user._id?.toString?.() ?? user.id,
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
router.post('/logout', (_req: Request, res: Response) => {
  const isProduction = process.env.NODE_ENV === 'production';
  res.clearCookie(COOKIE_NAME, {
    path: '/',
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? ('none' as const) : ('lax' as const)
  });
  return res.status(200).json({ success: true, message: 'Logged out successfully' });
});

export default router;
