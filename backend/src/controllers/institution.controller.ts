import { Request, Response } from 'express';
import { getWeekStartKey, parseWeekStartKey } from '../utils/portal-week';
import { getOrderSummariesForWeek } from './institution-admin.controller';

const User = require('../models/User');

export interface PortalSettingsInput {
  customMessage?: string;
}

function sanitizePortalSettings(raw: unknown): PortalSettingsInput {
  const body = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const out: PortalSettingsInput = {};
  if (body.customMessage !== undefined) {
    out.customMessage = String(body.customMessage || '').trim();
  }
  return out;
}

function toPublicUser(doc: any) {
  if (!doc) return null;
  const obj = typeof doc.toObject === 'function' ? doc.toObject() : doc;
  delete obj.password;
  return {
    id: String(obj._id || obj.id),
    _id: obj._id,
    username: obj.username,
    fullName: obj.fullName,
    role: obj.role,
    phone: obj.phone || '',
    isActive: obj.isActive !== false,
    portalSettings: {
      customMessage: obj.portalSettings?.customMessage ?? ''
    },
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt
  };
}

/** GET /api/admin/institutions?weekStartDate=YYYY-MM-DD */
export async function listInstitutions(req: Request, res: Response): Promise<void> {
  try {
    const weekKey = parseWeekStartKey(req.query.weekStartDate as string) || getWeekStartKey();
    const orderSummaries = await getOrderSummariesForWeek(weekKey);

    const rows = await User.find({ role: 'institution', deletedAt: null })
      .select('-password')
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      data: rows.map((row: any) => {
        const pub = toPublicUser(row);
        const summary = orderSummaries.get(String(row._id));
        return {
          ...pub,
          weekOrder: {
            weekStartDate: weekKey,
            hasOrder: summary?.hasOrder ?? false,
            weeklyTotalPortions: summary?.weeklyTotalPortions ?? 0
          }
        };
      })
    });
  } catch (err: any) {
    console.error('listInstitutions error:', err);
    res.status(500).json({ success: false, message: 'שגיאה בטעינת מוסדות' });
  }
}

/** GET /api/admin/institutions/:id */
export async function getInstitution(req: Request, res: Response): Promise<void> {
  try {
    const user = await User.findOne({ _id: req.params.id, role: 'institution' })
      .select('-password')
      .lean();
    if (!user) {
      res.status(404).json({ success: false, message: 'מוסד לא נמצא' });
      return;
    }
    res.json({ success: true, data: toPublicUser(user) });
  } catch (err: any) {
    console.error('getInstitution error:', err);
    res.status(500).json({ success: false, message: 'שגיאה בטעינת המוסד' });
  }
}

/** POST /api/admin/institutions */
export async function createInstitution(req: Request, res: Response): Promise<void> {
  try {
    const { fullName, username, password, phone, portalSettings } = req.body || {};
    const name = String(fullName || '').trim();
    const email = String(username || '').trim().toLowerCase();
    const pass = String(password || '');

    if (!name || !email || !pass) {
      res.status(400).json({ success: false, message: 'שם, אימייל וסיסמה נדרשים' });
      return;
    }
    if (pass.length < 6) {
      res.status(400).json({ success: false, message: 'סיסמה חייבת להכיל לפחות 6 תווים' });
      return;
    }

    const existing = await User.findOne({ username: email });
    if (existing) {
      res.status(409).json({ success: false, message: 'אימייל כבר קיים במערכת' });
      return;
    }

    const settings = sanitizePortalSettings(portalSettings);
    const user = new User({
      fullName: name,
      username: email,
      password: pass,
      role: 'institution',
      phone: phone ? String(phone).trim() : '',
      isActive: true,
      portalSettings: {
        customMessage: settings.customMessage ?? ''
      }
    });

    await user.save();
    const saved = await User.findById(user._id).select('-password').lean();
    res.status(201).json({ success: true, data: toPublicUser(saved), message: 'מוסד נוצר בהצלחה' });
  } catch (err: any) {
    console.error('createInstitution error:', err);
    res.status(500).json({ success: false, message: err?.message || 'שגיאה ביצירת מוסד' });
  }
}

/** PUT /api/admin/institutions/:id */
export async function updateInstitution(req: Request, res: Response): Promise<void> {
  try {
    const user = await User.findOne({ _id: req.params.id, role: 'institution' });
    if (!user) {
      res.status(404).json({ success: false, message: 'מוסד לא נמצא' });
      return;
    }

    const { fullName, username, password, phone, isActive, portalSettings } = req.body || {};

    if (fullName !== undefined) {
      user.fullName = String(fullName).trim();
    }
    if (username !== undefined) {
      const email = String(username).trim().toLowerCase();
      if (email !== user.username) {
        const clash = await User.findOne({ username: email, _id: { $ne: user._id } });
        if (clash) {
          res.status(409).json({ success: false, message: 'אימייל כבר בשימוש' });
          return;
        }
        user.username = email;
      }
    }
    if (phone !== undefined) {
      user.phone = String(phone || '').trim();
    }
    if (typeof isActive === 'boolean') {
      user.isActive = isActive;
    }
    if (password !== undefined && String(password).trim()) {
      const pass = String(password).trim();
      if (pass.length < 6) {
        res.status(400).json({ success: false, message: 'סיסמה חייבת להכיל לפחות 6 תווים' });
        return;
      }
      user.password = pass;
    }
    if (portalSettings !== undefined) {
      const settings = sanitizePortalSettings(portalSettings);
      user.portalSettings = {
        ...(user.portalSettings?.toObject?.() || user.portalSettings || {}),
        ...settings
      };
    }

    await user.save();
    const saved = await User.findById(user._id).select('-password').lean();
    res.json({ success: true, data: toPublicUser(saved), message: 'מוסד עודכן בהצלחה' });
  } catch (err: any) {
    console.error('updateInstitution error:', err);
    res.status(500).json({ success: false, message: err?.message || 'שגיאה בעדכון מוסד' });
  }
}

/** DELETE /api/admin/institutions/:id — soft delete (preserves order history) */
export async function deleteInstitution(req: Request, res: Response): Promise<void> {
  try {
    const user = await User.findOneAndUpdate(
      { _id: req.params.id, role: 'institution', deletedAt: null },
      { $set: { isActive: false, deletedAt: new Date() } },
      { returnDocument: 'after' }
    ).select('-password');
    if (!user) {
      res.status(404).json({ success: false, message: 'מוסד לא נמצא' });
      return;
    }
    res.json({ success: true, message: 'מוסד הוסר מהמערכת (מחיקה רכה — היסטוריית הזמנות נשמרת)' });
  } catch (err: any) {
    console.error('deleteInstitution error:', err);
    res.status(500).json({ success: false, message: 'שגיאה במחיקת מוסד' });
  }
}
