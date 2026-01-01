import express, { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'mysecretkey123';

// Import User model
const User = require('../models/User');

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

    // Create Token
    const payload = { id: user._id, role: user.role };
    console.log('🔍 Creating JWT token with payload:', {
      id: payload.id,
      idString: String(payload.id),
      role: payload.role
    });
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
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
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
});

// Register Route
router.post('/register', async (req: Request, res: Response) => {
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
    let user = await User.findOne({ username: username.toLowerCase() });
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

    await user.save();

    // Create Token
    const payload = { id: user._id, role: user.role };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });

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
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
});

export default router;
