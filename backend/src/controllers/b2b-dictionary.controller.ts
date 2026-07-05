import { Request, Response } from 'express';
import B2BMenuItem, { B2B_DICTIONARY_CATEGORIES, type B2BDictionaryCategory } from '../models/B2BMenuItem';
import { parseCalculationSettings, serializeCalculationSettings } from '../utils/b2b-calculation-settings';

const DEFAULT_GRAMS_PER_PORTION = 200;
const DEFAULT_PORTIONS_PER_GN = 40;

function serializeItem(doc: {
  _id: unknown;
  name: string;
  category: string;
  gramsPerPortion: number;
  portionsPerGastronorm: number;
  calculationSettings?: ReturnType<typeof serializeCalculationSettings>;
  isActive?: boolean;
}) {
  const calculationSettings = serializeCalculationSettings(doc.calculationSettings);
  return {
    id: String(doc._id),
    name: doc.name,
    category: doc.category,
    gramsPerPortion: doc.gramsPerPortion ?? DEFAULT_GRAMS_PER_PORTION,
    portionsPerGastronorm: doc.portionsPerGastronorm ?? DEFAULT_PORTIONS_PER_GN,
    ...(calculationSettings ? { calculationSettings } : {}),
    isActive: doc.isActive !== false
  };
}

function parseCategory(value: unknown): B2BDictionaryCategory | null {
  const raw = String(value ?? '').trim();
  return (B2B_DICTIONARY_CATEGORIES as readonly string[]).includes(raw)
    ? (raw as B2BDictionaryCategory)
    : null;
}

function parseGramsPerPortion(value: unknown): number {
  return Math.max(1, Number(value) || DEFAULT_GRAMS_PER_PORTION);
}

function parsePortionsPerGastronorm(value: unknown): number {
  return Math.max(1, Number(value) || DEFAULT_PORTIONS_PER_GN);
}

function parseCalculationSettingsFromBody(body: Record<string, unknown>) {
  try {
    return parseCalculationSettings(body.calculationSettings);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'הגדרות חישוב לא תקינות';
    throw new Error(message);
  }
}

function buildItemFields(name: string, category: B2BDictionaryCategory, body: Record<string, unknown>) {
  let base: Record<string, unknown>;

  if (category === 'mainMeat') {
    base = {
      name,
      category,
      gramsPerPortion: parseGramsPerPortion(body.gramsPerPortion),
      portionsPerGastronorm: DEFAULT_PORTIONS_PER_GN,
      isActive: true
    };
  } else if (category === 'fish' || category === 'vegetarianMain') {
    base = {
      name,
      category,
      gramsPerPortion: DEFAULT_GRAMS_PER_PORTION,
      portionsPerGastronorm: DEFAULT_PORTIONS_PER_GN,
      isActive: true
    };
  } else {
    base = {
      name,
      category,
      gramsPerPortion: DEFAULT_GRAMS_PER_PORTION,
      portionsPerGastronorm: parsePortionsPerGastronorm(body.portionsPerGastronorm),
      isActive: true
    };
  }

  const parsed = parseCalculationSettingsFromBody(body);
  const calculationSettings = parsed?.enabled ? serializeCalculationSettings(parsed) : undefined;
  if (calculationSettings) {
    base.calculationSettings = calculationSettings;
  }

  return { fields: base, unsetCalculationSettings: !calculationSettings };
}

/** GET /api/admin/b2b-dictionary?includeInactive=true */
export async function listB2BMenuItems(req: Request, res: Response): Promise<void> {
  try {
    const category = parseCategory(req.query.category);
    const includeInactive = String(req.query.includeInactive ?? '').toLowerCase() === 'true';
    const filter: Record<string, unknown> = {};
    if (category) filter.category = category;
    if (!includeInactive) filter.isActive = true;

    const items = await B2BMenuItem.find(filter).sort({ category: 1, name: 1 }).lean();
    res.json({ success: true, data: items.map(serializeItem) });
  } catch (err: any) {
    console.error('listB2BMenuItems error:', err);
    res.status(500).json({ success: false, message: err?.message || 'שגיאה בטעינת מאגר מנות' });
  }
}

/** POST /api/admin/b2b-dictionary */
export async function createB2BMenuItem(req: Request, res: Response): Promise<void> {
  try {
    const name = String(req.body?.name ?? '').trim();
    const category = parseCategory(req.body?.category);
    if (!name) {
      res.status(400).json({ success: false, message: 'נדרש שם מנה' });
      return;
    }
    if (!category) {
      res.status(400).json({ success: false, message: 'קטגוריה לא תקינה' });
      return;
    }

    const { fields } = buildItemFields(name, category, (req.body || {}) as Record<string, unknown>);
    const created = await B2BMenuItem.create(fields);
    res.status(201).json({ success: true, data: serializeItem(created), message: 'מנה נוספה למאגר' });
  } catch (err: any) {
    if (err?.message && !err?.code) {
      res.status(400).json({ success: false, message: err.message });
      return;
    }
    if (err?.code === 11000) {
      res.status(409).json({ success: false, message: 'מנה בשם זה כבר קיימת בקטגוריה' });
      return;
    }
    console.error('createB2BMenuItem error:', err);
    res.status(500).json({ success: false, message: err?.message || 'שגיאה ביצירת מנה' });
  }
}

/** PUT /api/admin/b2b-dictionary/:id */
export async function updateB2BMenuItem(req: Request, res: Response): Promise<void> {
  try {
    const name = String(req.body?.name ?? '').trim();
    const category = parseCategory(req.body?.category);
    if (!name) {
      res.status(400).json({ success: false, message: 'נדרש שם מנה' });
      return;
    }
    if (!category) {
      res.status(400).json({ success: false, message: 'קטגוריה לא תקינה' });
      return;
    }

    const { fields, unsetCalculationSettings } = buildItemFields(
      name,
      category,
      (req.body || {}) as Record<string, unknown>
    );
    const update: Record<string, unknown> = { $set: fields };
    if (unsetCalculationSettings) {
      update.$unset = { calculationSettings: '' };
    }
    const updated = await B2BMenuItem.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true
    }).lean();

    if (!updated) {
      res.status(404).json({ success: false, message: 'מנה לא נמצאה' });
      return;
    }

    res.json({ success: true, data: serializeItem(updated), message: 'מנה עודכנה בהצלחה' });
  } catch (err: any) {
    if (err?.message && !err?.code) {
      res.status(400).json({ success: false, message: err.message });
      return;
    }
    if (err?.code === 11000) {
      res.status(409).json({ success: false, message: 'מנה בשם זה כבר קיימת בקטגוריה' });
      return;
    }
    console.error('updateB2BMenuItem error:', err);
    res.status(500).json({ success: false, message: err?.message || 'שגיאה בעדכון מנה' });
  }
}

/** DELETE /api/admin/b2b-dictionary/:id — soft delete */
export async function deleteB2BMenuItem(req: Request, res: Response): Promise<void> {
  try {
    const updated = await B2BMenuItem.findByIdAndUpdate(
      req.params.id,
      { $set: { isActive: false } },
      { new: true }
    ).lean();

    if (!updated) {
      res.status(404).json({ success: false, message: 'מנה לא נמצאה' });
      return;
    }

    res.json({ success: true, message: 'מנה הוסרה מהמאגר (נשמרה להיסטוריית דוחות)' });
  } catch (err: any) {
    console.error('deleteB2BMenuItem error:', err);
    res.status(500).json({ success: false, message: err?.message || 'שגיאה בהסרת מנה' });
  }
}
