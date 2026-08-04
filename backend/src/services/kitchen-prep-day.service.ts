import mongoose from 'mongoose';
import Order from '../models/Order';
import InstitutionOrder from '../models/InstitutionOrder';
import KitchenPreparationTask, {
  type KitchenStage
} from '../models/KitchenPreparationTask';
import User from '../models/User';
import {
  buildPrepSplits,
  buildOrderItemKey,
  filterMergedByOrderKind,
  mergePrepDayAssignments,
  orderKindFromOrderDoc,
  plannedStartToPrepDate,
  prepDateToPlannedStart,
  type PrepAssignmentInput
} from '../utils/kitchen-prep-day.util';
import {
  classifyKitchenOrderKind,
  dishIdentityKey,
  effectiveLineQuantity,
  extractAllergies,
  extractSpecialRequests,
  kitchenOrderKindLabel,
  parseDateKey,
  parseKitchenOrderKindFilter,
  resolvePreparation,
  type KitchenOrderKindFilter
} from '../utils/kitchen-report.util';
import InstitutionMenu from '../models/InstitutionMenu';
import { formatWeekStartKey } from '../utils/portal-week';
import { normalizeInstitutionMenuContent } from '../utils/menu-structure';
import {
  buildInstitutionGenericKitchenItems,
  buildInstitutionShabbatKitchenItems,
  buildInstitutionWeekdayKitchenItems,
  menuDayFieldForDow
} from '../utils/institution-kitchen-items.util';

function httpError(message: string, statusCode = 400): Error {
  const err: any = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function actorName(by?: string): string {
  return String(by || 'admin').slice(0, 120);
}

function jerusalemDayBounds(day: string): { start: Date; end: Date } {
  const key = parseDateKey(day);
  if (!key) throw httpError('יום לא תקין');
  return {
    start: new Date(`${key}T00:00:00.000+03:00`),
    end: new Date(`${key}T23:59:59.999+03:00`)
  };
}

function sundayKeyForDate(day: string): string {
  const key = parseDateKey(day)!;
  const [y, m, d] = key.split('-').map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  return formatWeekStartKey(utc);
}

function dayOfWeekForDate(day: string): number {
  const key = parseDateKey(day)!;
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

async function loadInstitutionNotesForDay(day: string): Promise<any[]> {
  const weekStart = sundayKeyForDate(day);
  const dow = dayOfWeekForDate(day);
  const orders = await InstitutionOrder.find({ weekStartDate: weekStart }).lean();
  if (!orders.length) return [];
  const users = await User.find({
    _id: { $in: orders.map((o) => o.institutionId) },
    role: 'institution'
  })
    .select('fullName phone')
    .lean();
  const nameById = new Map(users.map((u: any) => [String(u._id), String(u.fullName || 'מוסד')]));
  const phoneById = new Map(users.map((u: any) => [String(u._id), String(u.phone || '')]));

  const menuDoc = await InstitutionMenu.findOne({ weekStartDate: weekStart }).lean();
  const menu = normalizeInstitutionMenuContent(menuDoc ?? null);
  const dayField = menuDayFieldForDow(dow);
  const dayMenu = dayField ? (menu as any)[dayField] : null;

  const notes: any[] = [];
  for (const order of orders as any[]) {
    const institutionId = String(order.institutionId);
    const name = nameById.get(institutionId) || 'מוסד';
    let items: any[] = [];
    let notesText = '';

    if (dow >= 0 && dow <= 4) {
      const dayRow = (order.days || []).find((x: any) => Number(x.dayOfWeek) === dow);
      if (!dayRow) continue;
      const regular = Number(dayRow.regularCount) || 0;
      const vegetarian = Number(dayRow.vegetarianCount) || 0;
      if (regular <= 0 && vegetarian <= 0) continue;
      items = buildInstitutionWeekdayKitchenItems(dayMenu, regular, vegetarian);
      if (!items.length) {
        items = buildInstitutionGenericKitchenItems(regular, vegetarian, 'weekday');
      }
      notesText = String(dayRow.notes || order.generalNotes || '').trim();
    } else {
      const shabbat = order.shabbatOrder || {};
      const regular = Number(shabbat.regularCount) || 0;
      const vegetarian = Number(shabbat.vegetarianCount) || 0;
      if (regular <= 0 && vegetarian <= 0) continue;
      items = buildInstitutionShabbatKitchenItems(menu.shabbatPackage, shabbat);
      if (!items.length) {
        items = buildInstitutionGenericKitchenItems(regular, vegetarian, 'shabbat');
      }
      notesText = String(shabbat.notes || order.generalNotes || '').trim();
    }

    notes.push({
      _id: `inst-${institutionId}-${day}`,
      id: `inst-${institutionId}-${day}`,
      orderNumber: `מוסד-${name}`,
      status: 'processing',
      __kitchenOrderKind: 'institutions',
      orderKind: 'institutions',
      items,
      customerDetails: {
        eventDate: day,
        fullName: name,
        phone: phoneById.get(institutionId) || '',
        deliveryMethod: 'delivery'
      },
      adminNotes: String(order.adminNotes || '').trim(),
      specialRequests: notesText,
      allergies: ''
    });
  }
  return notes;
}

function implicitAssignmentsFromOrder(
  order: any,
  day: string,
  assignedKeys: Set<string>
): PrepAssignmentInput[] {
  const prep = resolvePreparation(order);
  const delivery = prep.eventDateKey;
  if (delivery !== day) return [];
  const orderKind = orderKindFromOrderDoc(order);
  const out: PrepAssignmentInput[] = [];
  for (const item of order.items || []) {
    const name = String(item?.name || '').trim();
    if (!name) continue;
    const qty = effectiveLineQuantity(order, item);
    if (qty <= 0) continue;
    const orderItemKey = buildOrderItemKey(item);
    const assignKey = `${String(order._id)}|${orderItemKey}`;
    if (assignedKeys.has(assignKey)) continue;
    out.push({
      orderId: String(order._id),
      orderNumber: order.orderNumber ? String(order.orderNumber) : undefined,
      orderItemKey,
      dishName: name,
      optionLabel: String(item?.selectedOption?.label || ''),
      sizeLabel: String(item?.selectedOption?.amount || ''),
      category: String(item?.category || 'כללי'),
      unit: "יח'",
      quantity: qty,
      prepDate: day,
      deliveryDate: delivery,
      orderKind,
      notes: extractSpecialRequests(order) || undefined,
      allergies: extractAllergies(order) || undefined,
      stage: 'prep'
    });
  }
  return out;
}

function leanAssignment(task: any) {
  const o = task.toObject ? task.toObject() : task;
  return {
    id: String(o._id),
    orderId: String(o.orderId),
    orderItemKey: o.orderItemKey,
    title: o.title,
    stage: o.stage,
    plannedStartAt: o.plannedStartAt,
    prepDate: plannedStartToPrepDate(o.plannedStartAt),
    plannedQuantity: o.plannedQuantity,
    unit: o.unit,
    notes: o.notes,
    version: o.version,
    status: o.status,
    itemSnapshot: o.itemSnapshot,
    orderSnapshot: o.orderSnapshot
  };
}

export async function getPrepDayReport(query: Record<string, unknown>) {
  const day = parseDateKey(query.day || query.startDate || query.date);
  if (!day) throw httpError('day חובה');
  const orderKind = parseKitchenOrderKindFilter(query.orderKind);
  const { start, end } = jerusalemDayBounds(day);

  const tasks = await KitchenPreparationTask.find({
    plannedStartAt: { $gte: start, $lte: end },
    status: { $nin: ['cancelled'] }
  })
    .limit(5000)
    .lean();

  const orderIds = [
    ...new Set(
      tasks.map((t: any) => String(t.orderId)).filter((id) => mongoose.Types.ObjectId.isValid(id))
    )
  ];
  const orders = orderIds.length
    ? await Order.find({ _id: { $in: orderIds } })
        .select(
          'orderNumber orderType cateringKind status isDeleted items customerDetails allergies specialRequests kitchenPreparationAt'
        )
        .lean()
    : [];
  const orderById = new Map(orders.map((o: any) => [String(o._id), o]));

  const explicit: PrepAssignmentInput[] = [];
  for (const t of tasks as any[]) {
    const order = orderById.get(String(t.orderId));
    if (order && order.status === 'cancelled') continue;
    const snap = t.itemSnapshot || {};
    const dishName = String(snap.name || t.title || '').trim();
    if (!dishName) continue;
    const orderItemKey = String(
      t.orderItemKey ||
        snap.orderItemKey ||
        dishIdentityKey({
          name: dishName,
          selectedOption: { label: snap.optionLabel, amount: snap.sizeLabel },
          category: snap.category
        })
    );
    const prep = order ? resolvePreparation(order) : { eventDateKey: null };
    explicit.push({
      id: String(t._id),
      orderId: String(t.orderId),
      orderNumber: order?.orderNumber || t.orderSnapshot?.orderNumber,
      orderItemKey,
      dishName,
      optionLabel: String(snap.optionLabel || ''),
      sizeLabel: String(snap.sizeLabel || ''),
      category: String(snap.category || 'כללי'),
      unit: String(t.unit || snap.unit || "יח'"),
      quantity: Number(t.plannedQuantity) > 0 ? Number(t.plannedQuantity) : 0,
      prepDate: plannedStartToPrepDate(t.plannedStartAt),
      deliveryDate: prep.eventDateKey || t.orderSnapshot?.eventDate || null,
      orderKind: order ? orderKindFromOrderDoc(order) : 'shabbat_ready',
      notes: String(t.notes || order?.specialRequests || '').trim() || undefined,
      allergies: String(order?.allergies || t.orderSnapshot?.allergies || '').trim() || undefined,
      stage: String(t.stage || 'prep')
    });
  }

  let implicit: PrepAssignmentInput[] = [];
  if (orderKind !== 'institutions') {
    const deliveryOrders = await Order.find({
      status: { $in: ['pending', 'new', 'processing', 'in-progress', 'ready', 'out_for_delivery'] },
      'customerDetails.eventDate': { $gte: day, $lte: `${day}\uffff` }
    })
      .select(
        'orderNumber orderType cateringKind status items customerDetails allergies specialRequests kitchenPreparationAt numberOfPortions portionsEvening portionsMorning mealTime'
      )
      .lean();

    const anyAssigned = await KitchenPreparationTask.find({
      orderId: { $in: deliveryOrders.map((o: any) => o._id) },
      status: { $nin: ['cancelled'] }
    })
      .select('orderId orderItemKey')
      .lean();
    const anyKeys = new Set(
      (anyAssigned as any[]).map((t) => `${String(t.orderId)}|${String(t.orderItemKey || '')}`)
    );

    for (const order of deliveryOrders as any[]) {
      if (orderKind !== 'all' && classifyKitchenOrderKind(order) !== orderKind) continue;
      implicit.push(...implicitAssignmentsFromOrder(order, day, anyKeys));
    }
  }

  if (orderKind === 'all' || orderKind === 'institutions') {
    const inst = await loadInstitutionNotesForDay(day);
    for (const order of inst) {
      implicit.push(...implicitAssignmentsFromOrder(order, day, new Set()));
    }
  }

  const merged = filterMergedByOrderKind(
    mergePrepDayAssignments([...explicit.filter((e) => e.quantity > 0), ...implicit]),
    orderKind === 'all' ? 'all' : orderKind
  );

  return {
    generatedAt: new Date().toISOString(),
    day,
    orderKind,
    orderKindLabel:
      orderKind === 'all'
        ? 'הכול'
        : kitchenOrderKindLabel(orderKind as Exclude<KitchenOrderKindFilter, 'all'>),
    lines: merged,
    assignments: [...explicit, ...implicit],
    summary: {
      dishCount: merged.length,
      totalQuantity: merged.reduce((s, l) => s + l.quantity, 0),
      assignmentCount: explicit.length,
      implicitCount: implicit.length
    }
  };
}

export async function upsertPrepAssignment(
  input: {
    assignmentId?: string;
    orderId: string;
    orderItemKey: string;
    dishName: string;
    optionLabel?: string;
    sizeLabel?: string;
    category?: string;
    unit?: string;
    quantity: number;
    prepDate: string;
    notes?: string;
    stage?: string;
    version?: number;
  },
  by?: string
) {
  if (!mongoose.Types.ObjectId.isValid(String(input.orderId))) throw httpError('orderId לא תקין');
  const order = await Order.findById(input.orderId).lean();
  if (!order) throw httpError('הזמנה לא נמצאה', 404);
  if ((order as any).status === 'cancelled') {
    throw httpError('לא ניתן להקצות הכנה להזמנה מבוטלת');
  }
  const prepDate = parseDateKey(input.prepDate);
  if (!prepDate) throw httpError('תאריך הכנה לא תקין');
  const qty = Number(input.quantity);
  if (!Number.isFinite(qty) || qty < 0) throw httpError('כמות לא תקינה');
  const plannedStartAt = prepDateToPlannedStart(prepDate);
  const title = String(input.dishName || '').trim();
  if (!title) throw httpError('שם מנה חובה');
  const orderItemKey = String(input.orderItemKey || '').trim();
  if (!orderItemKey) throw httpError('orderItemKey חובה');
  const stage = (String(input.stage || 'prep').trim() || 'prep') as KitchenStage;
  const prep = resolvePreparation(order);

  if (input.assignmentId) {
    if (!mongoose.Types.ObjectId.isValid(input.assignmentId)) throw httpError('מזהה הקצאה לא תקין');
    const task = await KitchenPreparationTask.findById(input.assignmentId);
    if (!task) throw httpError('הקצאה לא נמצאה', 404);
    if (input.version != null && task.version !== Number(input.version)) {
      throw httpError('ההקצאה עודכנה במסך אחר — רענן ונסה שוב', 409);
    }
    const previousDay = plannedStartToPrepDate(task.plannedStartAt);
    task.plannedStartAt = plannedStartAt;
    task.plannedQuantity = qty;
    task.title = title.slice(0, 200);
    task.stage = stage;
    task.unit = String(input.unit || task.unit || "יח'").slice(0, 40);
    task.notes = String(input.notes ?? task.notes ?? '').slice(0, 2000);
    task.orderItemKey = orderItemKey;
    task.itemSnapshot = {
      name: title,
      optionLabel: String(input.optionLabel || ''),
      sizeLabel: String(input.sizeLabel || ''),
      unit: String(input.unit || "יח'"),
      orderItemKey
    } as any;
    task.updatedBy = actorName(by);
    task.version = (task.version || 1) + 1;
    task.auditLog = [
      ...(task.auditLog || []).slice(-39),
      {
        at: new Date(),
        action: 'prep_day_move',
        by: actorName(by),
        previousValue: previousDay,
        newValue: prepDate,
        detail: 'הקצאת יום הכנה עודכנה'
      }
    ] as any;
    await task.save();
    return {
      assignment: leanAssignment(task),
      previousPrepDate: previousDay,
      prepDate
    };
  }

  const existing = await KitchenPreparationTask.findOne({
    orderId: input.orderId,
    orderItemKey,
    stage,
    plannedStartAt: {
      $gte: jerusalemDayBounds(prepDate).start,
      $lte: jerusalemDayBounds(prepDate).end
    },
    status: { $nin: ['cancelled'] }
  } as any);
  if (existing) {
    existing.plannedQuantity = qty;
    existing.title = title.slice(0, 200);
    existing.notes = String(input.notes ?? existing.notes ?? '').slice(0, 2000);
    existing.updatedBy = actorName(by);
    existing.version = (existing.version || 1) + 1;
    await existing.save();
    return { assignment: leanAssignment(existing), previousPrepDate: prepDate, prepDate };
  }

  const created = await KitchenPreparationTask.create({
    orderId: input.orderId,
    orderItemKey,
    title: title.slice(0, 200),
    stage,
    plannedStartAt,
    plannedQuantity: qty,
    unit: String(input.unit || "יח'").slice(0, 40),
    status: 'not_started',
    urgency: 'normal',
    notes: String(input.notes || '').slice(0, 2000),
    source: 'manual',
    itemSnapshot: {
      name: title,
      optionLabel: String(input.optionLabel || ''),
      sizeLabel: String(input.sizeLabel || ''),
      unit: String(input.unit || "יח'"),
      orderItemKey
    },
    createdBy: actorName(by),
    updatedBy: actorName(by),
    version: 1,
    syncStatus: 'synced',
    orderSnapshot: {
      orderNumber: (order as any).orderNumber,
      eventDate: prep.eventDateKey || undefined,
      customerName: (order as any).customerDetails?.fullName,
      allergies: (order as any).allergies,
      specialRequests: (order as any).specialRequests
    },
    auditLog: [{ at: new Date(), action: 'prep_day_assign', by: actorName(by), newValue: prepDate }]
  } as any);
  return { assignment: leanAssignment(created), previousPrepDate: null, prepDate };
}

export async function splitPrepAssignment(
  input: {
    orderId: string;
    orderItemKey: string;
    dishName: string;
    optionLabel?: string;
    sizeLabel?: string;
    category?: string;
    unit?: string;
    orderedQuantity: number;
    notes?: string;
    splits: Array<{ prepDate: string; quantity: number; stage?: string; notes?: string }>;
    replaceExisting?: boolean;
  },
  by?: string
) {
  const drafts = buildPrepSplits(
    {
      orderId: input.orderId,
      orderItemKey: input.orderItemKey,
      dishName: input.dishName,
      optionLabel: input.optionLabel,
      sizeLabel: input.sizeLabel,
      category: input.category,
      unit: input.unit,
      notes: input.notes,
      stage: 'prep'
    },
    input.splits,
    Number(input.orderedQuantity) || 0
  );

  if (input.replaceExisting !== false) {
    await KitchenPreparationTask.updateMany(
      {
        orderId: input.orderId,
        orderItemKey: input.orderItemKey,
        status: { $nin: ['cancelled'] }
      },
      {
        $set: {
          status: 'cancelled',
          cancelReason: 'הוחלף בחלוקת ימי הכנה',
          updatedBy: actorName(by)
        },
        $inc: { version: 1 }
      }
    );
  }

  const created = [];
  for (const d of drafts) {
    const res = await upsertPrepAssignment(
      {
        orderId: d.orderId,
        orderItemKey: d.orderItemKey,
        dishName: d.dishName,
        optionLabel: d.optionLabel,
        sizeLabel: d.sizeLabel,
        category: d.category,
        unit: d.unit,
        quantity: d.quantity,
        prepDate: d.prepDate,
        notes: d.notes,
        stage: d.stage
      },
      by
    );
    created.push(res.assignment);
  }
  return { assignments: created, orderedQuantity: input.orderedQuantity };
}

export async function listOrderPrepAssignments(orderId: string) {
  if (!mongoose.Types.ObjectId.isValid(orderId)) throw httpError('orderId לא תקין');
  const tasks = await KitchenPreparationTask.find({
    orderId,
    status: { $nin: ['cancelled'] }
  })
    .sort({ plannedStartAt: 1 })
    .lean();
  return (tasks as any[]).map((t) => leanAssignment(t));
}

export async function loadInstitutionOrdersForKitchenRange(
  startDate: string,
  endDate: string
): Promise<any[]> {
  const days: string[] = [];
  let cur = parseDateKey(startDate)!;
  const end = parseDateKey(endDate)!;
  while (cur <= end) {
    days.push(cur);
    const [y, m, d] = cur.split('-').map(Number);
    const next = new Date(Date.UTC(y, m - 1, d + 1));
    cur = formatWeekStartKey(next);
  }
  const all: any[] = [];
  for (const day of days) {
    all.push(...(await loadInstitutionNotesForDay(day)));
  }
  return all;
}
