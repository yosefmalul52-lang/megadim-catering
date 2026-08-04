/**
 * Admin order pricing helpers.
 * totalPrice remains the stored charge amount; adminPriceOverride (when set)
 * is preferred for alerts/reports via getEffectiveOrderAmount.
 */
function roundMoney(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export type AdminPriceSource =
  | 'admin_override'
  | 'portion_rate'
  | 'items_plus_delivery'
  | 'unchanged';

export function isGatewayLockedPaymentStatus(status: unknown): boolean {
  const s = String(status || '').trim();
  return s === 'authorized' || s === 'captured';
}

export function hasAdminPriceOverride(doc: Record<string, unknown> | null | undefined): boolean {
  if (!doc) return false;
  const v = doc.adminPriceOverride;
  return v !== null && v !== undefined && Number.isFinite(Number(v));
}

/** Prefer explicit admin override for alerts / reports; else totalPrice. */
export function getEffectiveOrderAmount(doc: Record<string, unknown> | null | undefined): number {
  if (!doc) return 0;
  if (hasAdminPriceOverride(doc)) {
    return roundMoney(Number(doc.adminPriceOverride));
  }
  const n = Number(doc.totalPrice);
  return Number.isFinite(n) ? roundMoney(n) : 0;
}

/** Mongo expression: adminPriceOverride when numeric, else totalPrice. */
export function effectiveAmountMongoSumExpr(): Record<string, unknown> {
  return {
    $sum: {
      $cond: [
        {
          $and: [
            { $ne: [{ $type: '$adminPriceOverride' }, 'missing'] },
            { $ne: ['$adminPriceOverride', null] },
            { $isNumber: '$adminPriceOverride' }
          ]
        },
        '$adminPriceOverride',
        { $ifNull: ['$totalPrice', 0] }
      ]
    }
  };
}

export function computeItemsSubtotal(
  items: Array<{ price?: unknown; quantity?: unknown }> | null | undefined
): number {
  if (!Array.isArray(items) || !items.length) return 0;
  const sum = items.reduce((s, it) => {
    const price = Number(it?.price) || 0;
    const qty = Number(it?.quantity) || 0;
    return s + price * qty;
  }, 0);
  return roundMoney(sum);
}

export function resolvePortionCount(order: Record<string, unknown>): number {
  const evening = Number(order.portionsEvening);
  const morning = Number(order.portionsMorning);
  if (Number.isFinite(evening) || Number.isFinite(morning)) {
    return Math.max(0, (Number.isFinite(evening) ? evening : 0) + (Number.isFinite(morning) ? morning : 0));
  }
  const n = Number(order.numberOfPortions);
  if (Number.isFinite(n) && n > 0) return Math.trunc(n);
  const guest = Number(order.guestCount);
  if (Number.isFinite(guest) && guest > 0) return Math.trunc(guest);
  return 0;
}

export function resolvePricePerPortion(order: Record<string, unknown>): number | null {
  const cd =
    order.customerDetails && typeof order.customerDetails === 'object'
      ? (order.customerDetails as Record<string, unknown>)
      : {};
  const fromCd = Number(cd.pricePerPortion);
  if (Number.isFinite(fromCd) && fromCd > 0) return fromCd;
  // Legacy events: subtotal was sometimes used as price-per-portion when items were 0.
  const cateringKind = String(order.cateringKind || '');
  const itemsSum = computeItemsSubtotal(order.items as any);
  if (cateringKind === 'events' && itemsSum <= 0) {
    const sub = Number(order.subtotal);
    if (Number.isFinite(sub) && sub > 0 && sub < 500) {
      // Heuristic: per-portion rates are typically tens–low hundreds, not full event totals.
      return sub;
    }
  }
  return null;
}

export function computePortionBasedTotal(order: Record<string, unknown>): number | null {
  const rate = resolvePricePerPortion(order);
  const portions = resolvePortionCount(order);
  if (rate == null || portions <= 0) return null;
  return roundMoney(rate * portions);
}

/**
 * Recalculate subtotal + totalPrice for admin edits.
 * Priority: admin override → items+delivery when item prices exist → portion×rate
 * (events/shabbat with ₪0 dish rows) → keep previous catering quote → items+delivery − discount.
 * When payment is authorized/captured, totals are left unchanged (caller must not $set them).
 */
export function computeAdminRecalculatedTotals(
  order: Record<string, unknown>,
  patch: {
    items?: Array<{ name?: unknown; price?: unknown; quantity?: unknown }>;
    deliveryFee?: number | null;
    portionsEvening?: number;
    portionsMorning?: number;
    numberOfPortions?: number;
    pricePerPortion?: number | null;
  } = {}
): {
  subtotal: number;
  totalPrice: number;
  deliveryFee: number;
  source: AdminPriceSource;
  locked: boolean;
} {
  const locked = isGatewayLockedPaymentStatus(order.paymentStatus);
  const deliveryFee =
    patch.deliveryFee !== undefined && patch.deliveryFee !== null
      ? Math.max(0, roundMoney(Number(patch.deliveryFee) || 0))
      : Math.max(0, Number(order.deliveryFee) || 0);

  const items = patch.items !== undefined ? patch.items : ((order.items as any[]) || []);
  const itemsSubtotal = computeItemsSubtotal(items);

  const merged: Record<string, unknown> = {
    ...order,
    items,
    deliveryFee,
    customerDetails:
      order.customerDetails && typeof order.customerDetails === 'object'
        ? { ...(order.customerDetails as object) }
        : {}
  };
  if (patch.portionsEvening !== undefined) merged.portionsEvening = patch.portionsEvening;
  if (patch.portionsMorning !== undefined) merged.portionsMorning = patch.portionsMorning;
  if (patch.numberOfPortions !== undefined) merged.numberOfPortions = patch.numberOfPortions;
  if (patch.pricePerPortion !== undefined && patch.pricePerPortion !== null) {
    merged.customerDetails = {
      ...(merged.customerDetails as object),
      pricePerPortion: patch.pricePerPortion
    };
  }

  if (locked) {
    return {
      subtotal: Number.isFinite(Number(order.subtotal)) ? Number(order.subtotal) : itemsSubtotal,
      totalPrice: Number(order.totalPrice) || 0,
      deliveryFee: Number(order.deliveryFee) || 0,
      source: 'unchanged',
      locked: true
    };
  }

  if (hasAdminPriceOverride(order)) {
    const override = roundMoney(Number(order.adminPriceOverride));
    return {
      subtotal: itemsSubtotal > 0 ? itemsSubtotal : override,
      totalPrice: override,
      deliveryFee,
      source: 'admin_override',
      locked: false
    };
  }

  const portionTotal = computePortionBasedTotal(merged);
  const isCatering =
    String(order.orderType || '') === 'catering' ||
    String(order.cateringKind || '') === 'events' ||
    String(order.cateringKind || '') === 'shabbat';

  // Portion×rate is the quote only when dish rows are ₪0 (typical events/shabbat menus).
  // When admin edits priced items (itemsSubtotal > 0), those prices must win — otherwise
  // "סה״כ ביניים לעריכה" updates in the UI but Save silently keeps the old portion quote.
  if (isCatering && portionTotal != null && itemsSubtotal <= 0) {
    return {
      subtotal: portionTotal,
      totalPrice: portionTotal,
      deliveryFee,
      source: 'portion_rate',
      locked: false
    };
  }

  // Catering menus often store dish rows at price 0. Do not wipe an existing quote
  // when there is no portion rate and no item prices.
  if (isCatering && itemsSubtotal <= 0) {
    const prevKeep = Number(order.totalPrice) || 0;
    if (prevKeep > 0) {
      return {
        subtotal: Number(order.subtotal) > 0 ? Number(order.subtotal) : prevKeep,
        totalPrice: prevKeep,
        deliveryFee,
        source: 'unchanged',
        locked: false
      };
    }
  }

  const prevSub = Number(order.subtotal) || 0;
  const prevDel = Number(order.deliveryFee) || 0;
  const prevTotal = Number(order.totalPrice) || 0;
  const existingDiscount = Math.max(0, roundMoney(prevSub + prevDel - prevTotal));

  const totalPrice = Math.max(0, roundMoney(itemsSubtotal + deliveryFee - existingDiscount));
  return {
    subtotal: itemsSubtotal,
    totalPrice,
    deliveryFee,
    source: 'items_plus_delivery',
    locked: false
  };
}
