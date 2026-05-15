import { Request, Response } from 'express';
import mongoose from 'mongoose';
import HolidayEvent, { IHolidayEventProduct } from '../models/holidayEvent.model';
import { migrateShavuotProductsToHoliday } from '../services/shavuot-migration.service';

/** Product is orderable on site when explicitly available (defaults true for legacy docs). */
export function isHolidayProductAvailable(p: { isAvailable?: boolean } | null | undefined): boolean {
  return p?.isAvailable !== false;
}

/** Visible when active, before deadline, and has at least one available product with title. */
export function isHolidayEventLive(
  doc: { isActive: boolean; orderDeadline: Date | string; products?: unknown[] } | null,
  now: Date = new Date()
): boolean {
  if (!doc?.isActive) return false;
  const deadline = new Date(doc.orderDeadline).getTime();
  if (Number.isNaN(deadline) || now.getTime() > deadline) return false;
  if (!Array.isArray(doc.products) || doc.products.length === 0) return false;
  return doc.products.some(
    (p: any) => String(p?.title ?? '').trim().length > 0 && isHolidayProductAvailable(p)
  );
}

function normalizeWeightUnit(raw: unknown): 'unit' | '100g' {
  const v = String(raw ?? '').trim().toLowerCase();
  if (v === '100g' || v === 'per100g' || v === 'גרם' || v.includes('100')) return '100g';
  return 'unit';
}

function normalizePricingType(raw: unknown): 'fixed' | 'variants' {
  const v = String(raw ?? '').trim().toLowerCase();
  if (v === 'variants' || v === 'options') return 'variants';
  // Legacy holiday docs: unit | weight
  if (v === 'weight' || v === 'unit' || v === 'fixed' || v === 'single') return 'fixed';
  return 'fixed';
}

function normalizePricingOptions(raw: unknown): IHolidayEventProduct['pricingOptions'] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((opt: any) => {
      const label = String(opt?.label ?? '').trim();
      if (!label) return null;
      const amountRaw = opt?.amount;
      const amount =
        amountRaw != null && amountRaw !== ''
          ? String(amountRaw).trim()
          : '';
      const price = Number(opt?.price);
      if (!Number.isFinite(price) || price < 0) return null;
      return { label, amount, price };
    })
    .filter((o): o is NonNullable<typeof o> => o != null);
}

function normalizeProducts(raw: unknown): Partial<IHolidayEventProduct>[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((p: any) => {
      const title = String(p?.title ?? p?.name ?? '').trim();
      if (!title) return null;

      let pricingType = normalizePricingType(p?.pricingType);
      let weightUnit = normalizeWeightUnit(p?.weightUnit);
      const legacyType = String(p?.pricingType ?? '').trim().toLowerCase();
      if (legacyType === 'weight') {
        pricingType = 'fixed';
        weightUnit = '100g';
      } else if (legacyType === 'unit') {
        pricingType = 'fixed';
        weightUnit = 'unit';
      }

      const pricingOptions =
        pricingType === 'variants' ? normalizePricingOptions(p?.pricingOptions) : [];

      const out: Partial<IHolidayEventProduct> = {
        title,
        price: Number(p?.price) || 0,
        description: String(p?.description ?? '').trim(),
        imageUrl: String(p?.imageUrl ?? '').trim(),
        isAvailable: p?.isAvailable !== false,
        pricingType,
        weightUnit,
        pricingOptions
      };
      const id = String(p?._id ?? '').trim();
      if (id && mongoose.Types.ObjectId.isValid(id)) {
        out._id = new mongoose.Types.ObjectId(id);
      }
      return out;
    })
    .filter((p): p is Partial<IHolidayEventProduct> => p != null);
}

async function deactivateOtherHolidayEvents(exceptId: mongoose.Types.ObjectId | string): Promise<void> {
  await HolidayEvent.updateMany({ _id: { $ne: exceptId } }, { $set: { isActive: false } });
}

function mapProduct(p: any, includeAvailability: boolean) {
  let pricingType = normalizePricingType(p?.pricingType);
  let weightUnit = normalizeWeightUnit(p?.weightUnit);
  const legacyType = String(p?.pricingType ?? '').trim().toLowerCase();
  if (legacyType === 'weight') {
    pricingType = 'fixed';
    weightUnit = '100g';
  } else if (legacyType === 'unit') {
    pricingType = 'fixed';
    weightUnit = 'unit';
  }

  const base = {
    _id: String(p._id),
    title: p.title,
    price: Number(p.price) || 0,
    description: p.description,
    imageUrl: p.imageUrl,
    pricingType,
    weightUnit,
    pricingOptions: Array.isArray(p.pricingOptions)
      ? p.pricingOptions.map((opt: any) => ({
          label: String(opt?.label ?? ''),
          amount: String(opt?.amount ?? ''),
          price: Number(opt?.price) || 0
        }))
      : []
  };
  if (includeAvailability) {
    return { ...base, isAvailable: isHolidayProductAvailable(p) };
  }
  return base;
}

function mapEventImageUrl(doc: any): string {
  return String(doc?.imageUrl ?? '').trim();
}

/** Admin responses — all products including hidden ones. */
function toAdminEvent(doc: any) {
  return {
    _id: String(doc._id),
    name: doc.name,
    isActive: doc.isActive,
    orderDeadline: doc.orderDeadline,
    imageUrl: mapEventImageUrl(doc),
    products: (doc.products || []).map((p: any) => mapProduct(p, true))
  };
}

/** Public responses — only products available for order. */
function toPublicEvent(doc: any) {
  return {
    _id: String(doc._id),
    name: doc.name,
    isActive: doc.isActive,
    orderDeadline: doc.orderDeadline,
    imageUrl: mapEventImageUrl(doc),
    products: (doc.products || [])
      .filter((p: any) => isHolidayProductAvailable(p))
      .map((p: any) => mapProduct(p, false))
  };
}

/** GET /api/holiday-events/public/active */
export const getActiveHolidayEvent = async (_req: Request, res: Response) => {
  const now = new Date();
  const candidates = await HolidayEvent.find({
    isActive: true,
    orderDeadline: { $gte: now }
  })
    .sort({ updatedAt: -1 })
    .lean();

  const live = candidates.find((e) => isHolidayEventLive(e, now));
  if (!live) {
    return res.json({ visible: false, event: null });
  }
  res.json({ visible: true, event: toPublicEvent(live) });
};

/** GET /api/holiday-events */
export const listHolidayEvents = async (_req: Request, res: Response) => {
  const events = await HolidayEvent.find({}).sort({ updatedAt: -1 }).lean();
  res.json(events.map(toAdminEvent));
};

/** GET /api/holiday-events/:id */
export const getHolidayEventById = async (req: Request, res: Response) => {
  const doc = await HolidayEvent.findById(req.params.id).lean();
  if (!doc) {
    return res.status(404).json({ success: false, message: 'Holiday event not found' });
  }
  res.json(toAdminEvent(doc));
};

/** POST /api/holiday-events */
export const createHolidayEvent = async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const name = String(body.name ?? '').trim();
    if (!name) {
      return res.status(400).json({ success: false, message: 'name is required' });
    }
    const orderDeadline = body.orderDeadline != null ? new Date(body.orderDeadline) : null;
    if (!orderDeadline || Number.isNaN(orderDeadline.getTime())) {
      return res.status(400).json({ success: false, message: 'orderDeadline is required' });
    }
    const products = normalizeProducts(body.products);
    const isActive = Boolean(body.isActive);

    const created = await HolidayEvent.create({
      name,
      isActive,
      orderDeadline,
      imageUrl: String(body.imageUrl ?? '').trim(),
      products
    });

    if (isActive) {
      await deactivateOtherHolidayEvents(created._id);
    }

    return res.status(201).json(toAdminEvent(created.toObject()));
  } catch (err: any) {
    console.error('createHolidayEvent failed:', err);
    return res.status(400).json({
      success: false,
      message: err?.message || 'Failed to create holiday event'
    });
  }
};

/** PUT /api/holiday-events/:id */
export const updateHolidayEvent = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id ?? '').trim();
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid holiday event id' });
    }

    const body = req.body || {};
    const updateSet: Record<string, unknown> = {};

    if (body.name != null) {
      const name = String(body.name).trim();
      if (!name) {
        return res.status(400).json({ success: false, message: 'name cannot be empty' });
      }
      updateSet.name = name;
    }
    if (body.isActive != null) updateSet.isActive = Boolean(body.isActive);
    if (body.orderDeadline != null) {
      const d = new Date(body.orderDeadline);
      if (Number.isNaN(d.getTime())) {
        return res.status(400).json({ success: false, message: 'Invalid orderDeadline' });
      }
      updateSet.orderDeadline = d;
    }
    // Allow clearing hero image with empty string
    if (body.imageUrl !== undefined) {
      updateSet.imageUrl = String(body.imageUrl ?? '').trim();
    }
    if (body.products !== undefined) {
      updateSet.products = normalizeProducts(body.products);
    }

    if (Object.keys(updateSet).length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }

    const doc = await HolidayEvent.findByIdAndUpdate(
      id,
      { $set: updateSet },
      { new: true, runValidators: true }
    );

    if (!doc) {
      return res.status(404).json({ success: false, message: 'Holiday event not found' });
    }

    if (doc.isActive) {
      await deactivateOtherHolidayEvents(doc._id);
    }

    return res.json(toAdminEvent(doc.toObject()));
  } catch (err: any) {
    console.error('updateHolidayEvent failed:', err);
    return res.status(400).json({
      success: false,
      message: err?.message || 'Failed to update holiday event'
    });
  }
};

/**
 * POST /api/holiday-events/migrate-shavuot
 * One-time admin migration: MenuItems → HolidayEvent "חג שבועות", then archive sources.
 * Query: ?dryRun=true to preview without writing.
 * Body (optional): { orderDeadline?: string, createAsActive?: boolean }
 */
export const migrateShavuotToHoliday = async (req: Request, res: Response) => {
  const dryRun = String(req.query.dryRun ?? '').toLowerCase() === 'true';
  const body = req.body || {};
  let orderDeadline: Date | undefined;
  if (body.orderDeadline) {
    const d = new Date(body.orderDeadline);
    if (!Number.isNaN(d.getTime())) orderDeadline = d;
  }

  const result = await migrateShavuotProductsToHoliday({
    dryRun,
    orderDeadline,
    createAsActive: body.createAsActive === true
  });

  res.json({
    message: dryRun
      ? 'Dry run complete — no database changes were saved'
      : 'Shavuot migration completed successfully',
    ...result
  });
};

/** DELETE /api/holiday-events/:id */
export const deleteHolidayEvent = async (req: Request, res: Response) => {
  const deleted = await HolidayEvent.findByIdAndDelete(req.params.id);
  if (!deleted) {
    return res.status(404).json({ success: false, message: 'Holiday event not found' });
  }
  res.json({ success: true, message: 'Deleted' });
};
