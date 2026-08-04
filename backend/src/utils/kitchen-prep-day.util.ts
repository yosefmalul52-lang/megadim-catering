/**
 * Pure helpers for daily kitchen prep assignments (merge / move / split).
 * No DB access — unit-testable.
 */
import {
  classifyKitchenOrderKind,
  dishIdentityKey,
  kitchenOrderKindLabel,
  parseDateKey,
  toJerusalemDateKey,
  type KitchenOrderKind
} from './kitchen-report.util';

export type PrepAssignmentInput = {
  id?: string;
  orderId: string;
  orderNumber?: string;
  orderItemKey: string;
  dishName: string;
  optionLabel?: string;
  sizeLabel?: string;
  category?: string;
  unit?: string;
  quantity: number;
  prepDate: string;
  deliveryDate?: string | null;
  orderKind?: KitchenOrderKind;
  notes?: string;
  allergies?: string;
  stage?: string;
};

export type PrepDaySource = {
  assignmentId?: string;
  orderId: string;
  orderNumber?: string;
  orderItemKey: string;
  quantity: number;
  deliveryDate?: string | null;
  prepDate: string;
  orderKind: KitchenOrderKind;
  orderKindLabel: string;
  notes?: string;
  allergies?: string;
  stage?: string;
};

export type PrepDayMergedLine = {
  key: string;
  name: string;
  optionLabel: string;
  sizeLabel: string;
  category: string;
  unit: string;
  quantity: number;
  orderCount: number;
  sources: PrepDaySource[];
};

/** Jerusalem noon ISO for a YYYY-MM-DD prep day (stable calendar key). */
export function prepDateToPlannedStart(prepDate: string): Date {
  const key = parseDateKey(prepDate);
  if (!key) {
    const err: any = new Error('prepDate לא תקין');
    err.statusCode = 400;
    throw err;
  }
  return new Date(`${key}T12:00:00.000+03:00`);
}

export function plannedStartToPrepDate(plannedStartAt: Date | string): string {
  return toJerusalemDateKey(new Date(plannedStartAt));
}

export function buildOrderItemKey(item: {
  name?: unknown;
  selectedOption?: { label?: unknown; amount?: unknown };
  category?: unknown;
  productId?: unknown;
}): string {
  const base = dishIdentityKey(item);
  const productId = String(item?.productId || '').trim();
  return productId ? `${base}::${productId}` : base;
}

/**
 * Merge prep assignment rows for one day.
 * Identical dishes (name/option/size/category) are summed; sources stay expandable.
 */
export function mergePrepDayAssignments(rows: PrepAssignmentInput[]): PrepDayMergedLine[] {
  const map = new Map<string, PrepDayMergedLine>();
  for (const row of rows) {
    if (!row || Number(row.quantity) <= 0) continue;
    const prepDate = parseDateKey(row.prepDate);
    if (!prepDate) continue;
    const name = String(row.dishName || '').trim();
    if (!name) continue;
    const optionLabel = String(row.optionLabel || '').trim();
    const sizeLabel = String(row.sizeLabel || '').trim();
    const category = String(row.category || 'כללי').trim() || 'כללי';
    const unit = String(row.unit || "יח'").trim() || "יח'";
    const key = dishIdentityKey({
      productId: (row as any).productId,
      name,
      selectedOption: { label: optionLabel, amount: sizeLabel },
      category
    });
    const orderKind: KitchenOrderKind = row.orderKind || 'shabbat_ready';
    const source: PrepDaySource = {
      assignmentId: row.id,
      orderId: String(row.orderId),
      orderNumber: row.orderNumber,
      orderItemKey: String(row.orderItemKey || key),
      quantity: Number(row.quantity),
      deliveryDate: row.deliveryDate || null,
      prepDate,
      orderKind,
      orderKindLabel: kitchenOrderKindLabel(orderKind),
      notes: row.notes || undefined,
      allergies: row.allergies || undefined,
      stage: row.stage || undefined
    };
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        key,
        name,
        optionLabel,
        sizeLabel,
        category,
        unit,
        quantity: source.quantity,
        orderCount: 1,
        sources: [source]
      });
      continue;
    }
    existing.quantity += source.quantity;
    if (!existing.sources.some((s) => s.orderId === source.orderId && s.orderItemKey === source.orderItemKey && s.prepDate === source.prepDate && s.assignmentId === source.assignmentId)) {
      existing.sources.push(source);
    } else {
      // Same assignment id — replace quantity (move/update), no duplicate source row.
      const idx = existing.sources.findIndex((s) => s.assignmentId && s.assignmentId === source.assignmentId);
      if (idx >= 0) {
        existing.quantity -= existing.sources[idx].quantity;
        existing.quantity += source.quantity;
        existing.sources[idx] = source;
      } else {
        existing.sources.push(source);
      }
    }
    existing.orderCount = new Set(existing.sources.map((s) => s.orderId)).size;
  }
  return [...map.values()].sort((a, b) =>
    a.category === b.category ? a.name.localeCompare(b.name, 'he') : a.category.localeCompare(b.category, 'he')
  );
}

/**
 * After moving an assignment to a new prep day, ensure it is absent from the old day
 * and present once on the new day (no duplicate ids).
 */
export function applyPrepDateMove(
  assignments: PrepAssignmentInput[],
  assignmentId: string,
  newPrepDate: string
): PrepAssignmentInput[] {
  const key = parseDateKey(newPrepDate);
  if (!key) {
    const err: any = new Error('prepDate לא תקין');
    err.statusCode = 400;
    throw err;
  }
  const seen = new Set<string>();
  const out: PrepAssignmentInput[] = [];
  for (const row of assignments) {
    const id = String(row.id || '');
    const next = id === assignmentId ? { ...row, prepDate: key } : { ...row };
    const dedupeKey = next.id || `${next.orderId}|${next.orderItemKey}|${next.prepDate}|${next.stage || 'general'}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    out.push(next);
  }
  return out;
}

/**
 * Split one dish quantity across several prep days without changing the source order qty.
 * Returns assignment drafts; caller persists. Total of splits must be > 0 and ideally ≤ orderedQty.
 */
export function buildPrepSplits(
  base: Omit<PrepAssignmentInput, 'prepDate' | 'quantity' | 'id'>,
  splits: Array<{ prepDate: string; quantity: number; stage?: string; notes?: string }>,
  orderedQuantity: number
): PrepAssignmentInput[] {
  if (!Array.isArray(splits) || !splits.length) {
    const err: any = new Error('נדרשת לפחות חלוקה אחת');
    err.statusCode = 400;
    throw err;
  }
  const out: PrepAssignmentInput[] = [];
  let total = 0;
  for (const s of splits) {
    const qty = Number(s.quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      const err: any = new Error('כמות חלוקה חייבת להיות חיובית');
      err.statusCode = 400;
      throw err;
    }
    const prepDate = parseDateKey(s.prepDate);
    if (!prepDate) {
      const err: any = new Error('תאריך הכנה לא תקין בחלוקה');
      err.statusCode = 400;
      throw err;
    }
    total += qty;
    out.push({
      ...base,
      prepDate,
      quantity: qty,
      stage: s.stage || base.stage || 'prep',
      notes: s.notes != null ? s.notes : base.notes
    });
  }
  if (orderedQuantity > 0 && total > orderedQuantity + 1e-9) {
    const err: any = new Error('סכום החלוקות גדול מכמות ההזמנה המקורית');
    err.statusCode = 400;
    throw err;
  }
  return out;
}

export function orderKindFromOrderDoc(order: any): KitchenOrderKind {
  if (order?.__kitchenOrderKind === 'institutions') return 'institutions';
  return classifyKitchenOrderKind(order);
}

export function filterMergedByOrderKind(
  lines: PrepDayMergedLine[],
  orderKind: KitchenOrderKind | 'all'
): PrepDayMergedLine[] {
  if (orderKind === 'all') return lines;
  return lines
    .map((line) => {
      const sources = line.sources.filter((s) => s.orderKind === orderKind);
      if (!sources.length) return null;
      return {
        ...line,
        sources,
        quantity: sources.reduce((sum, s) => sum + s.quantity, 0),
        orderCount: new Set(sources.map((s) => s.orderId)).size
      };
    })
    .filter((x): x is PrepDayMergedLine => !!x);
}
