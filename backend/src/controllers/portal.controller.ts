import { Request, Response } from 'express';
import mongoose from 'mongoose';
import InstitutionOrder from '../models/InstitutionOrder';
import { isMenuWeekPublished, normalizeShabbatOrder } from '../utils/menu-structure';
import {
  computeIsFullyLocked,
  computeIsShabbatLocked,
  computeIsWeekdayLocked,
  defaultOrderDays,
  getNextWeekStartKey,
  getWeekStartKey,
  hasMeaningfulOrder,
  legacyWeekDateRange,
  normalizeOrderDays,
  orderDaysEqual,
  parseWeekStartKey,
  resolveLatestOrderDeadline,
  resolvePortalWeekStartKey,
  shabbatOrdersEqual,
  validateGeneralNotesPayload,
  validateOrderDaysPayload,
  validateShabbatOrderPayload,
  type WeekStartKey
} from '../utils/portal-week';
import { findMenuForWeek, loadMenuForWeek } from '../controllers/institution-admin.controller';

const User = require('../models/User');

async function findInstitutionOrder(institutionId: unknown, weekKey: string) {
  const direct = await InstitutionOrder.findOne({ institutionId, weekStartDate: weekKey }).lean();
  if (direct) return direct;

  const { start, end } = legacyWeekDateRange(weekKey);
  const legacy = await InstitutionOrder.collection.findOne({
    institutionId: new mongoose.Types.ObjectId(String(institutionId)),
    weekStartDate: { $type: 'date', $gte: start, $lt: end }
  });

  if (!legacy) return null;

  const migrated = await InstitutionOrder.findOneAndUpdate(
    { institutionId: legacy.institutionId, weekStartDate: weekKey },
    {
      institutionId: legacy.institutionId,
      weekStartDate: weekKey,
      isLocked: !!legacy.isLocked,
      days: normalizeOrderDays(legacy.days),
      shabbatOrder: normalizeShabbatOrder(legacy.shabbatOrder)
    },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  ).lean();

  await InstitutionOrder.collection.deleteOne({ _id: legacy._id });
  return migrated;
}

async function loadWeekDeadline(weekKey: WeekStartKey): Promise<Date | string | null | undefined> {
  const menuData = await loadMenuForWeek(weekKey);
  return resolveLatestOrderDeadline(menuData);
}

async function buildPortalWeekPayload(institutionId: unknown, weekStartDate: WeekStartKey, now = new Date()) {
  const menuDoc = await findMenuForWeek(weekStartDate);
  const menuData = await loadMenuForWeek(weekStartDate);
  const { orderDeadline, weekdayOrderDeadline, shabbatOrderDeadline, ...menu } = menuData;
  const menuPublished = isMenuWeekPublished(menu);
  const noMenuPublished = !menuDoc || !menuPublished;
  const isWeekdayLocked = computeIsWeekdayLocked(menuData, now);
  const isShabbatLocked = computeIsShabbatLocked(menuData, now);
  const isLocked = computeIsFullyLocked(menuData, now);

  const order = await findInstitutionOrder(institutionId, weekStartDate);
  let orderDays: ReturnType<typeof normalizeOrderDays> = defaultOrderDays();
  let shabbatOrder = normalizeShabbatOrder(null);

  if (order) {
    orderDays = normalizeOrderDays(order.days);
    shabbatOrder = normalizeShabbatOrder(order.shabbatOrder);
    if (order.isLocked !== isLocked) {
      await InstitutionOrder.updateOne({ _id: order._id }, { $set: { isLocked } });
    }
  }

  return {
    weekStartDate,
    isLocked,
    isWeekdayLocked,
    isShabbatLocked,
    menuPublished,
    noMenuPublished,
    orderDeadline,
    weekdayOrderDeadline,
    shabbatOrderDeadline,
    menu,
    order: {
      weekStartDate,
      isLocked,
      isWeekdayLocked,
      isShabbatLocked,
      days: orderDays,
      shabbatOrder,
      generalNotes: String(order?.generalNotes || '').trim()
    }
  };
}

/** GET /api/portal/status?weekStartDate=YYYY-MM-DD */
export async function getPortalStatus(req: Request, res: Response): Promise<void> {
  try {
    const authUser = (req as any).user;
    const user = await User.findById(authUser.id || authUser._id).select('-password').lean();
    if (!user || user.role !== 'institution') {
      res.status(403).json({ success: false, message: 'גישה למוסדות בלבד' });
      return;
    }
    if (user.isActive === false || user.deletedAt) {
      res.status(403).json({ success: false, message: 'חשבון המוסד אינו פעיל' });
      return;
    }

    const portalSettings = {
      customMessage: user.portalSettings?.customMessage ?? ''
    };

    const now = new Date();
    const requestedWeek = typeof req.query.weekStartDate === 'string' ? req.query.weekStartDate : undefined;
    const weekStartDate = await resolvePortalWeekStartKey(requestedWeek, loadWeekDeadline, now);
    const weekPayload = await buildPortalWeekPayload(user._id, weekStartDate, now);

    res.json({
      success: true,
      data: {
        institutionName: user.fullName,
        currentWeekStartDate: getWeekStartKey(now),
        nextWeekStartDate: getNextWeekStartKey(now),
        ...weekPayload,
        portalSettings
      }
    });
  } catch (err: any) {
    console.error('getPortalStatus error:', err);
    res.status(500).json({ success: false, message: 'שגיאה בטעינת פורטל המוסד' });
  }
}

/** POST /api/portal/submit — body: { weekStartDate, days } */
export async function submitPortalOrder(req: Request, res: Response): Promise<void> {
  try {
    const authUser = (req as any).user;
    const user = await User.findById(authUser.id || authUser._id).select('-password');
    if (!user || user.role !== 'institution') {
      res.status(403).json({ success: false, message: 'גישה למוסדות בלבד' });
      return;
    }
    if (user.isActive === false || user.deletedAt) {
      res.status(403).json({ success: false, message: 'חשבון המוסד אינו פעיל' });
      return;
    }

    const weekStartDate = parseWeekStartKey(req.body?.weekStartDate);
    if (!weekStartDate) {
      res.status(400).json({ success: false, message: 'נדרש weekStartDate בפורמט YYYY-MM-DD' });
      return;
    }

    const menuDoc = await findMenuForWeek(weekStartDate);
    const menuData = await loadMenuForWeek(weekStartDate);
    const { orderDeadline, weekdayOrderDeadline, shabbatOrderDeadline, ...menu } = menuData;
    const menuPublished = isMenuWeekPublished(menu);
    const noMenuPublished = !menuDoc || !menuPublished;

    if (noMenuPublished) {
      res.status(403).json({
        success: false,
        message: 'התפריט לשבוע זה טרם פורסם. לא ניתן לשלוח הזמנה.'
      });
      return;
    }

    const isWeekdayLocked = computeIsWeekdayLocked(menuData);
    const isShabbatLocked = computeIsShabbatLocked(menuData);
    const isFullyLocked = computeIsFullyLocked(menuData);

    if (isFullyLocked) {
      res.status(403).json({
        success: false,
        message: 'מועד ההזמנה הסתיים – לא ניתן לעדכן כמויות'
      });
      return;
    }

    const validation = validateOrderDaysPayload(req.body?.days);
    if (validation.ok === false) {
      res.status(400).json({ success: false, message: validation.message });
      return;
    }
    const incomingDays = validation.days;

    const shabbatValidation = validateShabbatOrderPayload(req.body?.shabbatOrder);
    if (shabbatValidation.ok === false) {
      res.status(400).json({ success: false, message: shabbatValidation.message });
      return;
    }
    const incomingShabbat = shabbatValidation.shabbatOrder;

    const generalNotesValidation = validateGeneralNotesPayload(req.body?.generalNotes);
    if (generalNotesValidation.ok === false) {
      res.status(400).json({ success: false, message: generalNotesValidation.message });
      return;
    }

    const existing = await findInstitutionOrder(user._id, weekStartDate);
    if (existing && String(existing.weekStartDate) !== weekStartDate) {
      await InstitutionOrder.deleteOne({ _id: existing._id });
    }

    const existingDays = normalizeOrderDays(existing?.days);
    const existingShabbat = normalizeShabbatOrder(existing?.shabbatOrder);

    if (isWeekdayLocked && !orderDaysEqual(incomingDays, existingDays)) {
      res.status(403).json({
        success: false,
        message: 'הזמנות לימי חול נסגרו'
      });
      return;
    }

    if (isShabbatLocked && !shabbatOrdersEqual(incomingShabbat, existingShabbat)) {
      res.status(403).json({
        success: false,
        message: 'הזמנות שבת נסגרו'
      });
      return;
    }

    const days = isWeekdayLocked ? existingDays : incomingDays;
    const shabbatOrder = isShabbatLocked ? existingShabbat : incomingShabbat;
    const generalNotes = isFullyLocked
      ? String(existing?.generalNotes || '').trim()
      : generalNotesValidation.generalNotes;

    if (!hasMeaningfulOrder(days, shabbatOrder)) {
      res.status(400).json({ success: false, message: 'יש להזין לפחות מנה אחת בהזמנה' });
      return;
    }

    const saved = await InstitutionOrder.findOneAndUpdate(
      { institutionId: user._id, weekStartDate },
      {
        institutionId: user._id,
        weekStartDate,
        isLocked: isFullyLocked,
        days,
        shabbatOrder,
        generalNotes
      },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true, runValidators: true }
    ).lean();

    res.json({
      success: true,
      message: 'ההזמנה נשמרה בהצלחה',
      data: {
        weekStartDate,
        isLocked: isFullyLocked,
        isWeekdayLocked,
        isShabbatLocked,
        days: normalizeOrderDays(saved?.days),
        shabbatOrder: normalizeShabbatOrder(saved?.shabbatOrder),
        generalNotes: String(saved?.generalNotes || '').trim()
      }
    });
  } catch (err: any) {
    console.error('submitPortalOrder error:', err);
    res.status(500).json({ success: false, message: 'שגיאה בשמירת ההזמנה' });
  }
}
