import { Request, Response } from 'express';

const User = require('../models/User');

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
