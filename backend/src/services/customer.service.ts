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

/**
 * Upserts a single Customer document from an order payload/document.
 * This function is fail-open by design and should not break order flow.
 */
export async function upsertCustomerFromOrder(orderData: OrderLike): Promise<void> {
  try {
    if (!isOrderCountableForCustomerStats(orderData)) return;

    const customer = (orderData?.customerDetails ?? {}) as Record<string, unknown>;
    const normalizedPhone = normalizePhone(customer.phone);
    const phoneForWrite = normalizePhone(normalizedPhone);
    if (!phoneForWrite) return;

    const fullName = String(customer.fullName ?? '').trim();
    const rawEmail = String(customer.email ?? '').trim().toLowerCase();
    const email = isBusinessEmail(rawEmail) ? '' : rawEmail;
    const city = extractCityFromAddress(customer.address);

    const totalPriceNum = Number(orderData?.totalPrice);
    const totalSpentDelta = Number.isFinite(totalPriceNum) ? Math.max(0, totalPriceNum) : 0;

    const createdAtDate = orderData?.createdAt ? new Date(orderData.createdAt as any) : new Date();
    const lastOrderDate = Number.isNaN(createdAtDate.getTime()) ? new Date() : createdAtDate;

    const set: Record<string, unknown> = {};
    if (fullName) set.fullName = fullName;
    if (email) set.email = email;
    if (city) set.city = city;

    const rawOrderId = String(orderData?._id || '').trim();
    const orderId = rawOrderId && /^[a-f0-9]{24}$/i.test(rawOrderId) ? rawOrderId : '';

    const updateDoc: Record<string, unknown> = {
      $setOnInsert: {
        normalizedPhone: phoneForWrite,
        manualStatus: 'NONE',
        customerCategory: 'all',
        tags: [],
        adminNotes: '',
        dietaryInfo: '',
        city: city || '',
        orderHistory: []
      },
      $max: {
        lastOrderDate
      }
    };

    if (orderId) {
      updateDoc.$addToSet = { orderHistory: orderId };
      updateDoc.$inc = {
        totalSpent: totalSpentDelta,
        orderCount: 1
      };
    } else {
      updateDoc.$inc = {
        totalSpent: totalSpentDelta,
        orderCount: 1
      };
    }

    if (Object.keys(set).length > 0) {
      updateDoc.$set = set;
    }

    if (orderId) {
      await Customer.findOneAndUpdate(
        { normalizedPhone: phoneForWrite, orderHistory: { $ne: orderId } },
        updateDoc,
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
          runValidators: true
        }
      );
      // Always keep profile fields fresh even if this order was already counted.
      if (Object.keys(set).length > 0) {
        await Customer.updateOne({ normalizedPhone: phoneForWrite }, { $set: set }, { runValidators: true });
      }
      return;
    }

    await Customer.findOneAndUpdate({ normalizedPhone: phoneForWrite }, updateDoc, {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
      runValidators: true
    });
  } catch (err) {
    if (!isDuplicateNormalizedPhoneError(err)) {
      console.error('Upsert Error:', err);
      return;
    }

    try {
      const customer = (orderData?.customerDetails ?? {}) as Record<string, unknown>;
      const fallbackPhone = normalizePhone(customer.phone);
      const phoneForMerge = normalizePhone(fallbackPhone);
      if (!phoneForMerge) return;

      const fullName = String(customer.fullName ?? '').trim();
      const rawEmail = String(customer.email ?? '').trim().toLowerCase();
      const email = isBusinessEmail(rawEmail) ? '' : rawEmail;
      const city = extractCityFromAddress(customer.address);

      const totalPriceNum = Number(orderData?.totalPrice);
      const totalSpentDelta = Number.isFinite(totalPriceNum) ? Math.max(0, totalPriceNum) : 0;
      const createdAtDate = orderData?.createdAt ? new Date(orderData.createdAt as any) : new Date();
      const lastOrderDate = Number.isNaN(createdAtDate.getTime()) ? new Date() : createdAtDate;

      const mergeSet: Record<string, unknown> = {};
      if (fullName) mergeSet.fullName = fullName;
      if (email) mergeSet.email = email;
      if (city) mergeSet.city = city;
      const rawOrderId = String(orderData?._id || '').trim();
      const orderId = rawOrderId && /^[a-f0-9]{24}$/i.test(rawOrderId) ? rawOrderId : '';

      const mergeUpdate: Record<string, unknown> = {
        $max: {
          lastOrderDate
        }
      };
      if (orderId) {
        mergeUpdate.$addToSet = { orderHistory: orderId };
      }
      mergeUpdate.$inc = {
        totalSpent: totalSpentDelta,
        orderCount: 1
      };
      if (Object.keys(mergeSet).length > 0) {
        mergeUpdate.$set = mergeSet;
      }

      if (orderId) {
        await Customer.updateOne(
          { normalizedPhone: phoneForMerge, orderHistory: { $ne: orderId } },
          mergeUpdate,
          { runValidators: true }
        );
        if (Object.keys(mergeSet).length > 0) {
          await Customer.updateOne({ normalizedPhone: phoneForMerge }, { $set: mergeSet }, { runValidators: true });
        }
      } else {
        await Customer.updateOne({ normalizedPhone: phoneForMerge }, mergeUpdate, { runValidators: true });
      }
    } catch (mergeErr) {
      // Fail-open: checkout/order creation must not crash due to CRM sync races.
      console.error('Upsert duplicate-merge fallback error:', mergeErr);
    }
  }
}
