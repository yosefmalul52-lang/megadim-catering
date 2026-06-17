import { Request, Response } from 'express';
import mongoose from 'mongoose';
import InstitutionOrder from '../models/InstitutionOrder';
import InstitutionMenu from '../models/InstitutionMenu';
import {
  formatMenuDaySummary,
  isMenuWeekPublished,
  normalizeInstitutionMenuContent,
  emptyInstitutionMenuContent,
  normalizeShabbatOrder,
  type InstitutionMenuContent
} from '../utils/menu-structure';
import {
  DAY_LABELS_HE,
  MENU_DAY_FIELDS,
  PORTAL_WORK_DAYS,
  SHABBAT_ORDER_LABEL,
  computeIsLockedByDeadline,
  getWeekStartKey,
  hasMeaningfulOrder,
  legacyWeekDateRange,
  normalizeOrderDays,
  parseOrderDeadline,
  parseWeekStartKey,
  sumOrderPortions,
  validateOrderDaysPayload,
  validateShabbatOrderPayload
} from '../utils/portal-week';
import { ensureInstitutionMenuIndexes } from '../utils/ensure-institution-menu-indexes';

const User = require('../models/User');

function menuPayload(menu: unknown) {
  const content = normalizeInstitutionMenuContent(menu as Record<string, unknown> | null | undefined);
  const raw = menu as Record<string, unknown> | null | undefined;
  const orderDeadline =
    raw?.orderDeadline != null && raw.orderDeadline !== ''
      ? new Date(raw.orderDeadline as string | Date).toISOString()
      : null;
  return { ...content, orderDeadline };
}

function menuWeekOnly(payload: ReturnType<typeof menuPayload>): InstitutionMenuContent {
  const { orderDeadline: _d, ...content } = payload;
  return content;
}

function resolveWeekStartKey(req: Request, source: 'query' | 'body' = 'query'): string | null {
  const raw =
    source === 'body'
      ? (req.body?.weekStartDate as string | undefined)
      : (req.query.weekStartDate as string | undefined);
  return parseWeekStartKey(raw);
}

/** Remove conflicting menu documents for a single week only (never global purge). */
async function purgeAllMenuDocsForWeek(weekKey: string): Promise<void> {
  const { start, end } = legacyWeekDateRange(weekKey);
  await InstitutionMenu.collection.deleteMany({
    $or: [
      { weekStartDate: weekKey },
      { weekStartDate: { $type: 'date', $gte: start, $lt: end } }
    ]
  });
}

/** @deprecated Use purgeAllMenuDocsForWeek */
async function purgeLegacyMenuDocs(weekKey: string): Promise<void> {
  await purgeAllMenuDocsForWeek(weekKey);
}

interface MenuFieldUpdate extends InstitutionMenuContent {
  orderDeadline: Date;
}

function parseMenuFieldsFromBody(body: Record<string, unknown>): InstitutionMenuContent & { orderDeadline: Date | null } {
  const content = normalizeInstitutionMenuContent(body);
  return {
    ...content,
    orderDeadline: parseOrderDeadline(body.orderDeadline)
  };
}

/**
 * Bulletproof menu upsert: drop legacy indexes, purge conflicting docs, then findOneAndUpdate.
 */
async function upsertMenuForWeek(weekKey: string, fields: MenuFieldUpdate) {
  await ensureInstitutionMenuIndexes();

  const existing = await InstitutionMenu.findOne({ weekStartDate: weekKey }).lean();

  if (!existing) {
    await purgeAllMenuDocsForWeek(weekKey);
  }

  const update = {
    weekStartDate: weekKey,
    sunday: fields.sunday,
    monday: fields.monday,
    tuesday: fields.tuesday,
    wednesday: fields.wednesday,
    thursday: fields.thursday,
    shabbatPackage: fields.shabbatPackage,
    orderDeadline: fields.orderDeadline
  };

  try {
    return await InstitutionMenu.findOneAndUpdate(
      { weekStartDate: weekKey },
      { $set: update },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true, runValidators: true }
    ).lean();
  } catch (err: any) {
    if (err?.code !== 11000) {
      throw err;
    }
    console.warn('upsertMenuForWeek E11000 — purging conflicts and retrying for week', weekKey);
    await ensureInstitutionMenuIndexes();
    await purgeAllMenuDocsForWeek(weekKey);
    return InstitutionMenu.findOneAndUpdate(
      { weekStartDate: weekKey },
      { $set: update },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true, runValidators: true }
    ).lean();
  }
}

export async function findMenuForWeek(weekKey: string) {
  const byKey = await InstitutionMenu.findOne({ weekStartDate: weekKey }).lean();
  if (byKey) return byKey;

  const { start, end } = legacyWeekDateRange(weekKey);
  const legacy = await InstitutionMenu.collection.findOne({
    $or: [{ key: 'master' }, { weekStartDate: { $type: 'date', $gte: start, $lt: end } }]
  });

  if (!legacy) return null;

  const payload = {
    weekStartDate: weekKey,
    ...normalizeInstitutionMenuContent(legacy as Record<string, unknown>),
    orderDeadline: legacy.orderDeadline ? new Date(legacy.orderDeadline) : null
  };

  await InstitutionMenu.collection.deleteOne({ _id: legacy._id });
  return InstitutionMenu.findOneAndUpdate(
    { weekStartDate: weekKey },
    payload,
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  ).lean();
}

async function findOrdersForWeek(weekKey: string) {
  const stringOrders = await InstitutionOrder.find({ weekStartDate: weekKey }).lean();
  const results = [...stringOrders];

  const { start, end } = legacyWeekDateRange(weekKey);
  const legacyOrders = await InstitutionOrder.collection
    .find({ weekStartDate: { $type: 'date', $gte: start, $lt: end } })
    .toArray();

  for (const legacy of legacyOrders) {
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
    if (migrated) results.push(migrated);
  }

  return results;
}

async function findOrderForInstitutionWeek(institutionId: string, weekKey: string) {
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

function enrichOrderDays(menuContent: InstitutionMenuContent, days: ReturnType<typeof normalizeOrderDays>) {
  const emptyDay = emptyInstitutionMenuContent().sunday;
  return days.map((d) => {
    const dayKey = MENU_DAY_FIELDS[d.dayOfWeek];
    return {
      dayOfWeek: d.dayOfWeek,
      dayLabel: DAY_LABELS_HE[d.dayOfWeek] || `יום ${d.dayOfWeek}`,
      regularCount: d.regularCount,
      vegetarianCount: d.vegetarianCount,
      notes: d.notes || '',
      menuItems: dayKey ? menuContent[dayKey] : emptyDay
    };
  });
}

function mapPackingOrder(
  order: any,
  nameById: Map<string, string>,
  weekKey: string,
  menuContent: InstitutionMenuContent
) {
  const days = enrichOrderDays(menuContent, normalizeOrderDays(order.days));
  const shabbatOrder = normalizeShabbatOrder(order.shabbatOrder);
  const weeklyGrandTotal = sumOrderPortions(days, shabbatOrder);
  return {
    orderId: String(order._id),
    institutionId: String(order.institutionId),
    institutionName: nameById.get(String(order.institutionId)) || 'מוסד ללא שם',
    weekStartDate: weekKey,
    isLocked: !!order.isLocked,
    weeklyGrandTotal,
    hasOrder: hasMeaningfulOrder(days, shabbatOrder),
    days,
    shabbatOrder
  };
}

/** GET /api/admin/institutions/menu?weekStartDate=YYYY-MM-DD */
export async function getInstitutionWeekMenu(req: Request, res: Response): Promise<void> {
  try {
    const weekStartDate = resolveWeekStartKey(req, 'query');
    if (!weekStartDate) {
      res.status(400).json({ success: false, message: 'נדרש weekStartDate בפורמט YYYY-MM-DD' });
      return;
    }

    const menuDoc = await findMenuForWeek(weekStartDate);
    const menuFull = menuPayload(menuDoc);
    const menu = menuWeekOnly(menuFull);
    const menuPublished = isMenuWeekPublished(menu);
    res.json({
      success: true,
      data: {
        weekStartDate,
        weekStartDateLabel: weekStartDate,
        menuPublished,
        orderDeadline: menuFull.orderDeadline,
        menu
      }
    });
  } catch (err: any) {
    console.error('getInstitutionWeekMenu error:', err);
    res.status(500).json({ success: false, message: 'שגיאה בטעינת תפריט שבועי' });
  }
}

/** POST /api/admin/institutions/menu */
export async function upsertInstitutionWeekMenu(req: Request, res: Response): Promise<void> {
  try {
    const weekStartDate = resolveWeekStartKey(req, 'body');
    if (!weekStartDate) {
      res.status(400).json({
        success: false,
        message: 'נדרש weekStartDate תקין (YYYY-MM-DD) — יום ראשון של השבוע'
      });
      return;
    }

    const body = (req.body || {}) as Record<string, unknown>;
    const fields = parseMenuFieldsFromBody(body);

    if (!fields.orderDeadline) {
      res.status(400).json({
        success: false,
        message: 'נדרש תאריך ושעת סגירת הזמנות — לא ניתן לשמור תפריט ללא דדליין'
      });
      return;
    }

    const saved = await upsertMenuForWeek(weekStartDate, {
      ...fields,
      orderDeadline: fields.orderDeadline
    });

    if (!saved) {
      res.status(500).json({ success: false, message: 'שגיאה בשמירת תפריט שבועי' });
      return;
    }

    const savedMenu = menuPayload(saved);
    const savedWeek = menuWeekOnly(savedMenu);
    res.json({
      success: true,
      message: 'תפריט שבועי נשמר בהצלחה',
      data: {
        weekStartDate,
        weekStartDateLabel: weekStartDate,
        menuPublished: isMenuWeekPublished(savedWeek),
        orderDeadline: savedMenu.orderDeadline,
        menu: savedWeek
      }
    });
  } catch (err: any) {
    console.error('upsertInstitutionWeekMenu error:', err?.message || err, err?.stack);
    const message =
      err?.code === 11000
        ? 'קונפליקט במסד הנתונים — נסה לטעון מחדש ולשמור שוב'
        : err?.message || 'שגיאה בשמירת תפריט שבועי';
    res.status(500).json({ success: false, message });
  }
}

/** DELETE /api/admin/institutions/menu?weekStartDate= */
export async function deleteInstitutionWeekMenu(req: Request, res: Response): Promise<void> {
  try {
    const weekStartDate = resolveWeekStartKey(req, 'query');
    if (!weekStartDate) {
      res.status(400).json({ success: false, message: 'נדרש weekStartDate בפורמט YYYY-MM-DD' });
      return;
    }

    await ensureInstitutionMenuIndexes();
    await purgeAllMenuDocsForWeek(weekStartDate);

    res.json({ success: true, message: 'תפריט השבוע נמחק בהצלחה' });
  } catch (err: any) {
    console.error('deleteInstitutionWeekMenu error:', err);
    res.status(500).json({ success: false, message: 'שגיאה במחיקת תפריט שבועי' });
  }
}

/** DELETE /api/admin/institutions/order/:institutionId?weekStartDate= */
export async function adminDeleteInstitutionOrder(req: Request, res: Response): Promise<void> {
  try {
    const institutionId = req.params.institutionId;
    const weekStartDate = resolveWeekStartKey(req, 'query');
    if (!weekStartDate) {
      res.status(400).json({ success: false, message: 'נדרש weekStartDate בפורמט YYYY-MM-DD' });
      return;
    }

    const user = await User.findOne({ _id: institutionId, role: 'institution', deletedAt: null });
    if (!user) {
      res.status(404).json({ success: false, message: 'מוסד לא נמצא' });
      return;
    }

    const { start, end } = legacyWeekDateRange(weekStartDate);
    await InstitutionOrder.collection.deleteMany({
      institutionId: user._id,
      weekStartDate: { $type: 'date', $gte: start, $lt: end }
    });
    await InstitutionOrder.deleteMany({ institutionId: user._id, weekStartDate });

    res.json({ success: true, message: 'הזמנת המוסד לשבוע זה נמחקה בהצלחה' });
  } catch (err: any) {
    console.error('adminDeleteInstitutionOrder error:', err);
    res.status(500).json({ success: false, message: 'שגיאה במחיקת הזמנת מוסד' });
  }
}

/** GET /api/admin/institutions/order/:institutionId?weekStartDate= */
export async function getAdminInstitutionOrder(req: Request, res: Response): Promise<void> {
  try {
    const institutionId = req.params.institutionId;
    const weekStartDate = resolveWeekStartKey(req, 'query') || getWeekStartKey();

    const user = await User.findOne({ _id: institutionId, role: 'institution' }).select('fullName').lean();
    if (!user) {
      res.status(404).json({ success: false, message: 'מוסד לא נמצא' });
      return;
    }

    const order = await findOrderForInstitutionWeek(institutionId, weekStartDate);
    const menuDoc = await findMenuForWeek(weekStartDate);
    const menuContent = menuWeekOnly(menuPayload(menuDoc));
    const days = enrichOrderDays(menuContent, normalizeOrderDays(order?.days));
    const shabbatOrder = normalizeShabbatOrder(order?.shabbatOrder);

    res.json({
      success: true,
      data: {
        orderId: order?._id ? String(order._id) : null,
        institutionId: String(institutionId),
        institutionName: user.fullName,
        weekStartDate,
        days,
        shabbatOrder,
        weeklyGrandTotal: sumOrderPortions(days, shabbatOrder)
      }
    });
  } catch (err: any) {
    console.error('getAdminInstitutionOrder error:', err);
    res.status(500).json({ success: false, message: 'שגיאה בטעינת הזמנת מוסד' });
  }
}

/** PUT /api/admin/institutions/order/:institutionId — admin override, ignores portal lock */
export async function adminUpdateInstitutionOrder(req: Request, res: Response): Promise<void> {
  try {
    const institutionId = req.params.institutionId;
    const weekStartDate = resolveWeekStartKey(req, 'body');
    if (!weekStartDate) {
      res.status(400).json({ success: false, message: 'נדרש weekStartDate בפורמט YYYY-MM-DD' });
      return;
    }

    const user = await User.findOne({ _id: institutionId, role: 'institution' });
    if (!user) {
      res.status(404).json({ success: false, message: 'מוסד לא נמצא' });
      return;
    }

    const validation = validateOrderDaysPayload(req.body?.days);
    if (validation.ok === false) {
      res.status(400).json({ success: false, message: validation.message });
      return;
    }
    const days = validation.days;

    const shabbatValidation = validateShabbatOrderPayload(req.body?.shabbatOrder);
    if (shabbatValidation.ok === false) {
      res.status(400).json({ success: false, message: shabbatValidation.message });
      return;
    }
    const shabbatOrder = shabbatValidation.shabbatOrder;

    const { start, end } = legacyWeekDateRange(weekStartDate);
    await InstitutionOrder.collection.deleteMany({
      institutionId: user._id,
      weekStartDate: { $type: 'date', $gte: start, $lt: end }
    });

    const saved = await InstitutionOrder.findOneAndUpdate(
      { institutionId: user._id, weekStartDate },
      {
        institutionId: user._id,
        weekStartDate,
        days,
        shabbatOrder,
        isLocked: false
      },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true, runValidators: true }
    ).lean();

    const normalizedDays = normalizeOrderDays(saved?.days);
    const normalizedShabbat = normalizeShabbatOrder(saved?.shabbatOrder);
    const menuDoc = await findMenuForWeek(weekStartDate);
    const menuContent = menuWeekOnly(menuPayload(menuDoc));
    const enrichedDays = enrichOrderDays(menuContent, normalizedDays);
    res.json({
      success: true,
      message: 'הזמנת המוסד עודכנה בהצלחה (עדכון מנהל)',
      data: {
        orderId: saved?._id ? String(saved._id) : null,
        institutionId: String(institutionId),
        institutionName: user.fullName,
        weekStartDate,
        days: enrichedDays,
        shabbatOrder: normalizedShabbat,
        weeklyGrandTotal: sumOrderPortions(normalizedDays, normalizedShabbat)
      }
    });
  } catch (err: any) {
    console.error('adminUpdateInstitutionOrder error:', err);
    res.status(500).json({ success: false, message: err?.message || 'שגיאה בעדכון הזמנת מוסד' });
  }
}

/** GET /api/admin/institutions/reports?weekStartDate=YYYY-MM-DD */
export async function getInstitutionWeekReports(req: Request, res: Response): Promise<void> {
  try {
    const weekStartDate = resolveWeekStartKey(req, 'query');
    if (!weekStartDate) {
      res.status(400).json({ success: false, message: 'נדרש weekStartDate בפורמט YYYY-MM-DD' });
      return;
    }

    const [menuDoc, orders] = await Promise.all([
      findMenuForWeek(weekStartDate),
      findOrdersForWeek(weekStartDate)
    ]);

    const menuFull = menuPayload(menuDoc);
    const menu = menuWeekOnly(menuFull);
    const weekLocked = computeIsLockedByDeadline(menuFull.orderDeadline);
    const institutionIds = orders.map((o) => o.institutionId);
    const users = await User.find({ _id: { $in: institutionIds }, role: 'institution' })
      .select('fullName')
      .lean();
    const nameById = new Map<string, string>(
      users.map((u: any) => [String(u._id), String(u.fullName || 'מוסד ללא שם')])
    );

    const packingOrders = orders.map((order) => {
      const row = mapPackingOrder(order, nameById, weekStartDate, menu);
      return { ...row, isLocked: weekLocked || row.isLocked };
    });

    const kitchenReport = PORTAL_WORK_DAYS.map((dayOfWeek) => {
      let totalRegular = 0;
      let totalVegetarian = 0;
      for (const order of orders) {
        const day = (order.days || []).find((d) => d.dayOfWeek === dayOfWeek);
        if (day) {
          totalRegular += day.regularCount || 0;
          totalVegetarian += day.vegetarianCount || 0;
        }
      }
      const menuKey = MENU_DAY_FIELDS[dayOfWeek];
      const dayMenu = menu[menuKey];
      return {
        dayOfWeek,
        dayLabel: DAY_LABELS_HE[dayOfWeek],
        menuItem: formatMenuDaySummary(dayMenu),
        totalRegular,
        totalVegetarian,
        grandTotal: totalRegular + totalVegetarian
      };
    });

    let shabbatRegular = 0;
    let shabbatVegetarian = 0;
    for (const order of orders) {
      const shabbat = normalizeShabbatOrder(order.shabbatOrder);
      shabbatRegular += shabbat.regularCount;
      shabbatVegetarian += shabbat.vegetarianCount;
    }
    const shabbatKitchenRow = {
      dayLabel: SHABBAT_ORDER_LABEL,
      menuItem: menu.shabbatPackage?.hasShabbat ? 'חבילת שבת' : 'ללא שבת השבוע',
      totalRegular: shabbatRegular,
      totalVegetarian: shabbatVegetarian,
      grandTotal: shabbatRegular + shabbatVegetarian
    };

    const menuPublished = isMenuWeekPublished(menu);

    res.json({
      success: true,
      data: {
        weekStartDate,
        weekStartDateLabel: weekStartDate,
        menuPublished,
        orderDeadline: menuFull.orderDeadline,
        menu,
        orders: packingOrders,
        kitchenReport,
        shabbatKitchenRow
      }
    });
  } catch (err: any) {
    console.error('getInstitutionWeekReports error:', err);
    res.status(500).json({ success: false, message: 'שגיאה בטעינת דוחות' });
  }
}

export async function loadMenuForWeek(weekStartDate: string) {
  const menuDoc = await findMenuForWeek(weekStartDate);
  return menuPayload(menuDoc);
}

export async function getOrderSummariesForWeek(weekKey: string) {
  const orders = await findOrdersForWeek(weekKey);
  const map = new Map<string, { hasOrder: boolean; weeklyTotalPortions: number }>();
  for (const order of orders) {
    const shabbatOrder = normalizeShabbatOrder(order.shabbatOrder);
    const total = sumOrderPortions(order.days, shabbatOrder);
    map.set(String(order.institutionId), {
      hasOrder: hasMeaningfulOrder(order.days, shabbatOrder),
      weeklyTotalPortions: total
    });
  }
  return map;
}
