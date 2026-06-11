import mongoose from 'mongoose';
import Customer from '../models/Customer';

type OrderLike = {
  _id?: unknown;
  customerDetails?: {
    fullName?: unknown;
    email?: unknown;
    phone?: unknown;
    address?: unknown;
  };
  totalPrice?: unknown;
  createdAt?: unknown;
  status?: unknown;
  isDeleted?: unknown;
};

const ADMIN_EMAILS = [
  'yosefmalul52@gmail.com',
  'jtsolutions.officee@gmail.com',
  'tirtzma@gmail.com',
  'benny@megadim-catering.com',
  'office@megadim-catering.com'
];

export function normalizePhone(raw: unknown): string {
  let digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('00972')) digits = digits.slice(5);
  else if (digits.startsWith('972')) digits = digits.slice(3);
  if (!digits.startsWith('0')) digits = `0${digits}`;
  return digits;
}

function isOrderCountableForCustomerStats(orderData: OrderLike): boolean {
  if (orderData?.isDeleted === true) return false;
  const status = String(orderData?.status || '')
    .trim()
    .toLowerCase();
  if (!status) return true;
  // Exclude ghost/superseded order variants from customer aggregates.
  if (['cancelled', 'canceled', 'archived', 'superseded', 'replaced', 'deleted'].includes(status)) {
    return false;
  }
  return true;
}

function isBusinessEmail(raw: unknown): boolean {
  const email = String(raw || '')
    .trim()
    .toLowerCase();
  if (!email) return false;
  if (ADMIN_EMAILS.includes(email)) return true;
  if (email.includes('jtsolutions.officee')) return true;
  if (email.endsWith('@megadim-catering.com')) return true;
  return false;
}

function isDuplicateNormalizedPhoneError(err: unknown): boolean {
  const mongoErr = err as { code?: number; keyPattern?: Record<string, unknown>; message?: string };
  if (mongoErr?.code !== 11000) return false;
  if (mongoErr?.keyPattern && mongoErr.keyPattern.normalizedPhone) return true;
  const msg = String(mongoErr?.message || '').toLowerCase();
  return msg.includes('normalizedphone');
}

function extractCityFromAddress(rawAddress: unknown): string {
  const text = String(rawAddress || '').trim();
  if (!text) return '';
  const firstChunk = text.split(',')[0]?.trim() || '';
  if (!firstChunk) return '';
  // If address starts with street and then city, prefer the second chunk.
  if (/\d/.test(firstChunk) && text.includes(',')) {
    const secondChunk = text.split(',')[1]?.trim() || '';
    return secondChunk || firstChunk;
  }
  return firstChunk;
}

function crmLogContext(orderData: OrderLike): Record<string, unknown> {
  const customer = (orderData?.customerDetails ?? {}) as Record<string, unknown>;
  return {
    orderId: orderData?._id ?? null,
    rawPhone: customer.phone ?? null,
    customerName: customer.fullName ?? null,
    status: orderData?.status ?? null
  };
}

function parseOrderObjectId(orderData: OrderLike): mongoose.Types.ObjectId | null {
  const raw = String(orderData?._id || '').trim();
  if (!raw || !/^[a-f0-9]{24}$/i.test(raw)) return null;
  try {
    return new mongoose.Types.ObjectId(raw);
  } catch {
    return null;
  }
}

function buildProfileSet(customer: Record<string, unknown>): Record<string, unknown> {
  const fullName = String(customer.fullName ?? '').trim();
  const rawEmail = String(customer.email ?? '').trim().toLowerCase();
  const email = isBusinessEmail(rawEmail) ? '' : rawEmail;
  const city = extractCityFromAddress(customer.address);

  const set: Record<string, unknown> = {};
  if (fullName) set.fullName = fullName;
  if (email) set.email = email;
  if (city) set.city = city;
  return set;
}

async function applyCustomerUpsert(
  phoneForWrite: string,
  orderOid: mongoose.Types.ObjectId | null,
  set: Record<string, unknown>,
  totalSpentDelta: number,
  lastOrderDate: Date,
  city: string
): Promise<void> {
  const updateDoc: Record<string, unknown> = {
    $setOnInsert: {
      normalizedPhone: phoneForWrite,
      manualStatus: 'NONE',
      customerCategory: 'all',
      tags: [],
      adminNotes: '',
      dietaryInfo: '',
      city: city || ''
    },
    $max: {
      lastOrderDate
    }
  };

  if (Object.keys(set).length > 0) {
    updateDoc.$set = set;
  }

  if (orderOid) {
    // Idempotent: filter excludes docs that already contain this order in orderHistory.
    updateDoc.$addToSet = { orderHistory: orderOid };
    updateDoc.$inc = {
      totalSpent: totalSpentDelta,
      orderCount: 1
    };

    await Customer.updateOne(
      { normalizedPhone: phoneForWrite, orderHistory: { $ne: orderOid } },
      updateDoc,
      {
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true
      }
    );

    // Refresh profile fields even when this order was already counted.
    if (Object.keys(set).length > 0) {
      await Customer.updateOne(
        { normalizedPhone: phoneForWrite },
        { $set: set, $max: { lastOrderDate } },
        { runValidators: true }
      );
    }
    return;
  }

  updateDoc.$inc = {
    totalSpent: totalSpentDelta,
    orderCount: 1
  };

  await Customer.updateOne(
    { normalizedPhone: phoneForWrite },
    updateDoc,
    {
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true
    }
  );
}

async function applyDuplicateMergeFallback(
  phoneForMerge: string,
  set: Record<string, unknown>,
  totalSpentDelta: number,
  lastOrderDate: Date,
  orderOid: mongoose.Types.ObjectId | null
): Promise<void> {
  const mergeUpdate: Record<string, unknown> = {
    $max: {
      lastOrderDate
    }
  };

  if (orderOid) {
    mergeUpdate.$addToSet = { orderHistory: orderOid };
    mergeUpdate.$inc = {
      totalSpent: totalSpentDelta,
      orderCount: 1
    };
    if (Object.keys(set).length > 0) {
      mergeUpdate.$set = set;
    }

    await Customer.updateOne(
      { normalizedPhone: phoneForMerge, orderHistory: { $ne: orderOid } },
      mergeUpdate,
      { runValidators: true }
    );

    if (Object.keys(set).length > 0) {
      await Customer.updateOne(
        { normalizedPhone: phoneForMerge },
        { $set: set, $max: { lastOrderDate } },
        { runValidators: true }
      );
    }
    return;
  }

  mergeUpdate.$inc = {
    totalSpent: totalSpentDelta,
    orderCount: 1
  };
  if (Object.keys(set).length > 0) {
    mergeUpdate.$set = set;
  }

  await Customer.updateOne({ normalizedPhone: phoneForMerge }, mergeUpdate, { runValidators: true });
}

/**
 * Upserts a single Customer document from an order payload/document.
 * This function is fail-open by design and should not break order flow.
 * Idempotent per order: calling twice for the same order will not double-count stats.
 */
export async function upsertCustomerFromOrder(orderData: OrderLike): Promise<void> {
  const logCtx = crmLogContext(orderData);

  try {
    if (!isOrderCountableForCustomerStats(orderData)) {
      console.error('[crm] upsert skipped: order not countable for customer stats', logCtx);
      return;
    }

    const customer = (orderData?.customerDetails ?? {}) as Record<string, unknown>;
    const phoneForWrite = normalizePhone(customer.phone);
    if (!phoneForWrite) {
      console.error('[crm] upsert skipped: missing phone', logCtx);
      return;
    }

    const set = buildProfileSet(customer);
    const city = extractCityFromAddress(customer.address);

    const totalPriceNum = Number(orderData?.totalPrice);
    const totalSpentDelta = Number.isFinite(totalPriceNum) ? Math.max(0, totalPriceNum) : 0;

    const createdAtDate = orderData?.createdAt ? new Date(orderData.createdAt as any) : new Date();
    const lastOrderDate = Number.isNaN(createdAtDate.getTime()) ? new Date() : createdAtDate;

    const orderOid = parseOrderObjectId(orderData);
    if (!orderOid) {
      console.error('[crm] upsert warning: invalid or missing order ObjectId — stats may not be idempotent', logCtx);
    }

    await applyCustomerUpsert(phoneForWrite, orderOid, set, totalSpentDelta, lastOrderDate, city);
  } catch (err) {
    if (!isDuplicateNormalizedPhoneError(err)) {
      console.error('[crm] upsert failed:', logCtx, err);
      return;
    }

    try {
      const customer = (orderData?.customerDetails ?? {}) as Record<string, unknown>;
      const phoneForMerge = normalizePhone(customer.phone);
      if (!phoneForMerge) {
        console.error('[crm] upsert failed: duplicate-key fallback missing phone', logCtx);
        return;
      }

      const set = buildProfileSet(customer);
      const totalPriceNum = Number(orderData?.totalPrice);
      const totalSpentDelta = Number.isFinite(totalPriceNum) ? Math.max(0, totalPriceNum) : 0;
      const createdAtDate = orderData?.createdAt ? new Date(orderData.createdAt as any) : new Date();
      const lastOrderDate = Number.isNaN(createdAtDate.getTime()) ? new Date() : createdAtDate;
      const orderOid = parseOrderObjectId(orderData);

      await applyDuplicateMergeFallback(phoneForMerge, set, totalSpentDelta, lastOrderDate, orderOid);
    } catch (mergeErr) {
      console.error('[crm] upsert failed: duplicate-merge fallback error', logCtx, mergeErr);
    }
  }
}
