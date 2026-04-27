import { Request, Response } from 'express';

const User = require('../models/User');
function normalizePhone(raw: unknown): string {
  let digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('00972')) digits = digits.slice(5);
  else if (digits.startsWith('972')) digits = digits.slice(3);
  if (!digits.startsWith('0')) digits = `0${digits}`;
  return digits;
}

function buildPhoneCandidates(raw: unknown): string[] {
  const phone = normalizePhone(raw);
  if (!phone) return [];
  const noZero = phone.replace(/^0/, '');
  return [phone, `972${noZero}`, `+972${noZero}`];
}

/**
 * GET /api/users - List all users (admin only).
 * Excludes password. Optionally includes orderCount and totalSpent per user.
 */
export async function getUsers(req: Request, res: Response): Promise<void> {
  try {
    const users = await User.aggregate([
      {
        $lookup: {
          from: 'orders',
          let: { uid: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$userId', '$$uid'] },
                isDeleted: { $ne: true }
              }
            }
          ],
          as: 'userOrders'
        }
      },
      {
        $addFields: {
          orderCount: { $size: '$userOrders' },
          totalSpent: { $sum: '$userOrders.totalPrice' },
          lastOrderDate: {
            $cond: {
              if: { $gt: [{ $size: '$userOrders' }, 0] },
              then: { $max: { $map: { input: '$userOrders', as: 'o', in: '$$o.createdAt' } } },
              else: null
            }
          }
        }
      },
      {
        $project: {
          password: 0,
          userOrders: 0
        }
      },
      { $sort: { createdAt: -1 } }
    ]);

    res.json(users);
  } catch (err: any) {
    console.error('getUsers error:', err);
    res.status(500).json({
      success: false,
      message: 'שגיאה בטעינת רשימת המשתמשים'
    });
  }
}

/**
 * PUT /api/users/:id/crm - Update CRM fields (tags, adminNotes, dietaryInfo). Admin only.
 */
export async function updateUserCrm(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const body = req.body || {};
    const update: Record<string, unknown> = {};
    if (body.tags !== undefined) {
      update.tags = Array.isArray(body.tags) ? body.tags.filter((t: unknown) => typeof t === 'string') : [];
    }
    if (body.adminNotes !== undefined) {
      update.adminNotes = typeof body.adminNotes === 'string' ? body.adminNotes : '';
    }
    if (body.dietaryInfo !== undefined) {
      update.dietaryInfo = typeof body.dietaryInfo === 'string' ? body.dietaryInfo : '';
    }
    const user = await User.findByIdAndUpdate(id, { $set: update }, { new: true })
      .select('-password')
      .lean();
    if (!user) {
      res.status(404).json({ success: false, message: 'משתמש לא נמצא' });
      return;
    }
    res.json(user);
  } catch (err: any) {
    console.error('updateUserCrm error:', err);
    res.status(500).json({
      success: false,
      message: 'שגיאה בעדכון פרטי הלקוח'
    });
  }
}

const SITE_ROLES = ['admin', 'user', 'driver'] as const;

/**
 * GET /api/users/resolve?username= — find site user by login email (admin only).
 */
export async function resolveUserByUsername(req: Request, res: Response): Promise<void> {
  try {
    const username = String(req.query.username || '')
      .trim()
      .toLowerCase();
    const phone = String(req.query.phone || '').trim();
    const phoneCandidates = buildPhoneCandidates(phone);
    if (!username && phoneCandidates.length === 0) {
      res.status(400).json({ success: false, message: 'username או phone נדרש' });
      return;
    }

    let user: any = null;
    let matchedBy: 'username' | 'phone' | null = null;

    if (username) {
      user = await User.findOne({ username })
        .select('_id username role fullName phone isActive createdAt')
        .lean();
      if (user) matchedBy = 'username';
    }

    // Fallback only when no email match found.
    if (!user && phoneCandidates.length > 0) {
      const byPhone = await User.find({ phone: { $in: phoneCandidates } })
        .select('_id username role fullName phone isActive createdAt')
        .limit(2)
        .lean();
      if (byPhone.length > 1) {
        res.status(409).json({
          success: false,
          message: 'זוהו כמה משתמשים עם אותו טלפון. יש להזין אימייל מדויק.'
        });
        return;
      }
      if (byPhone.length === 1) {
        user = byPhone[0];
        matchedBy = 'phone';
      }
    }

    if (!user) {
      res.status(404).json({ success: false, message: 'משתמש לא נמצא' });
      return;
    }
    res.json({
      success: true,
      matchedBy,
      user: {
        _id: String(user._id),
        username: user.username,
        role: user.role,
        fullName: user.fullName,
        phone: user.phone,
        isActive: user.isActive,
        createdAt: user.createdAt
      }
    });
  } catch (err: any) {
    console.error('resolveUserByUsername error:', err);
    res.status(500).json({ success: false, message: 'שגיאה בחיפוש משתמש' });
  }
}

/**
 * PATCH /api/users/:id/role — change site role (admin only). Protects last active admin.
 */
export async function updateUserRole(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const newRole = String(req.body?.role || '')
      .trim()
      .toLowerCase();
    if (!(SITE_ROLES as readonly string[]).includes(newRole)) {
      res.status(400).json({
        success: false,
        message: 'role חייב להיות admin, user או driver'
      });
      return;
    }

    const actor = (req as any).user;
    const actorId = actor?.id || actor?._id?.toString?.();

    const target = await User.findById(id);
    if (!target) {
      res.status(404).json({ success: false, message: 'משתמש לא נמצא' });
      return;
    }

    const wasAdmin = target.role === 'admin';
    const removingAdmin = wasAdmin && newRole !== 'admin';

    if (removingAdmin) {
      const adminCount = await User.countDocuments({ role: 'admin', isActive: true });
      if (adminCount <= 1) {
        res.status(400).json({
          success: false,
          message: 'לא ניתן להסיר את מנהל המערכת האחרון'
        });
        return;
      }
    }

    if (String(target._id) === String(actorId) && wasAdmin && newRole !== 'admin') {
      const adminCount = await User.countDocuments({ role: 'admin', isActive: true });
      if (adminCount <= 1) {
        res.status(400).json({
          success: false,
          message: 'לא ניתן להוריד את עצמך ממנהל כשאתה המנהל היחיד'
        });
        return;
      }
    }

    target.role = newRole;
    await target.save();

    const out = await User.findById(id).select('-password').lean();
    res.json(out);
  } catch (err: any) {
    console.error('updateUserRole error:', err);
    res.status(500).json({
      success: false,
      message: 'שגיאה בעדכון תפקיד'
    });
  }
}

/** GET /api/users/drivers — active site users with role=driver (admin only). */
export async function getDriverUsers(_req: Request, res: Response): Promise<void> {
  try {
    const drivers = await User.find({ role: 'driver', isActive: true })
      .select('_id fullName username phone')
      .sort({ fullName: 1, username: 1 })
      .lean();
    res.json({
      success: true,
      data: drivers.map((d: any) => ({
        _id: String(d._id),
        fullName: d.fullName || '',
        username: d.username || '',
        phone: d.phone || ''
      }))
    });
  } catch (err: any) {
    console.error('getDriverUsers error:', err);
    res.status(500).json({ success: false, message: 'שגיאה בטעינת רשימת נהגים' });
  }
}
