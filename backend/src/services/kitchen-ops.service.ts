import mongoose from 'mongoose';
import crypto from 'crypto';
import Order from '../models/Order';
import MenuItem from '../models/menuItem';
import KitchenPreparationTask, {
  IKitchenPreparationTask,
  KitchenStage
} from '../models/KitchenPreparationTask';
import KitchenStation from '../models/KitchenStation';
import KitchenPrepTemplate, { KitchenTemplateTaskDef } from '../models/KitchenPrepTemplate';
import {
  getAdvancedKitchenReport,
  buildKitchenCsvBuffer,
  buildKitchenXlsxBuffer,
  buildKitchenPdfBuffer,
  buildKitchenPrintHtml
} from './kitchen-report.service';
import {
  assertNonNegativeQuantity,
  buildOrderItemKey,
  buildOrderSnapshot,
  hasCircularDependency,
  isKitchenStage,
  isKitchenTaskStatus,
  isOpenTaskStatus,
  jerusalemDayBounds,
  orderedQuantitiesFromOrder,
  resolveBackfillPlanTime,
  isCompletedTaskStatus,
  normalizeKitchenStage,
  stageLabelHe,
  statusLabelHe
} from '../utils/kitchen-ops.util';
import { toJerusalemDateKey, validateKitchenDateRange } from '../utils/kitchen-report.util';

function actorName(by?: string): string {
  return String(by || 'admin').trim().slice(0, 120);
}

function httpError(message: string, statusCode = 400): Error {
  const err: any = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function pushAudit(
  task: IKitchenPreparationTask,
  action: string,
  by?: string,
  meta?: { previousValue?: string; newValue?: string; detail?: string }
) {
  task.auditLog = task.auditLog || [];
  task.auditLog.push({
    at: new Date(),
    action,
    by: actorName(by),
    previousValue: meta?.previousValue,
    newValue: meta?.newValue,
    detail: meta?.detail
  });
  if (task.auditLog.length > 80) task.auditLog = task.auditLog.slice(-80);
}

function leanTask(doc: any) {
  return doc?.toObject ? doc.toObject() : doc;
}

export async function listKitchenTasks(query: Record<string, unknown>) {
  const filter: Record<string, unknown> = {};
  if (query.orderId && mongoose.Types.ObjectId.isValid(String(query.orderId))) {
    filter.orderId = query.orderId;
  }
  if (query.status && isKitchenTaskStatus(query.status)) filter.status = query.status;
  if (query.stage && isKitchenStage(query.stage)) filter.stage = query.stage;
  if (query.syncStatus) filter.syncStatus = query.syncStatus;
  if (query.day) {
    const key = String(query.day).slice(0, 10);
    const { start, end } = jerusalemDayBounds(key);
    filter.plannedStartAt = { $gte: start, $lte: end };
  }
  const rows = await KitchenPreparationTask.find(filter).sort({ plannedStartAt: 1 }).limit(2000).lean();
  return rows;
}

export async function createKitchenTask(input: any, by?: string) {
  if (!input?.orderId || !mongoose.Types.ObjectId.isValid(String(input.orderId))) {
    throw httpError('orderId לא תקין');
  }
  const order = await Order.findById(input.orderId).lean();
  if (!order) throw httpError('הזמנה לא נמצאה', 404);
  const title = String(input.title || '').trim();
  if (!title) throw httpError('שם משימה חובה');
  const stage = normalizeKitchenStage(input.stage);
  const plannedStartAt = new Date(input.plannedStartAt);
  if (Number.isNaN(plannedStartAt.getTime())) throw httpError('plannedStartAt לא תקין');
  let plannedEndAt: Date | null = null;
  if (input.plannedEndAt) {
    plannedEndAt = new Date(input.plannedEndAt);
    if (Number.isNaN(plannedEndAt.getTime())) throw httpError('plannedEndAt לא תקין');
  }
  const plannedQuantity = assertNonNegativeQuantity(input.plannedQuantity, 'כמות מתוכננת');
  const dependsOn = Array.isArray(input.dependsOn)
    ? input.dependsOn.filter((id: string) => mongoose.Types.ObjectId.isValid(id))
    : [];

  const task = await KitchenPreparationTask.create({
    orderId: input.orderId,
    orderItemKey: input.orderItemKey ? String(input.orderItemKey) : undefined,
    title,
    stage,
    plannedStartAt,
    plannedEndAt,
    plannedQuantity,
    unit: String(input.unit || "יח'").slice(0, 40),
    actualQuantity: null,
    status: 'not_started',
    urgency: ['low', 'normal', 'high', 'critical'].includes(input.urgency) ? input.urgency : 'normal',
    stationId: input.stationId || null,
    stationName: input.stationName ? String(input.stationName).slice(0, 120) : '',
    assigneeEmployeeId: input.assigneeEmployeeId || null,
    assigneeName: input.assigneeName ? String(input.assigneeName).slice(0, 120) : '',
    notes: String(input.notes || '').slice(0, 2000),
    dependsOn,
    checklist: Array.isArray(input.checklist)
      ? input.checklist.map((c: any) => ({
          id: String(c.id || crypto.randomBytes(4).toString('hex')),
          label: String(c.label || '').slice(0, 200),
          done: !!c.done
        }))
      : [],
    source:
      input.source === 'template' ||
      input.source === 'auto' ||
      input.source === 'automatic_legacy'
        ? input.source === 'auto'
          ? 'automatic_legacy'
          : input.source
        : 'manual',
    itemSnapshot: input.itemSnapshot || undefined,
    isDemo: input.isDemo === true,
    demoBatchId: input.demoBatchId || undefined,
    createdBy: actorName(by),
    updatedBy: actorName(by),
    version: 1,
    syncStatus: 'synced',
    orderSnapshot: buildOrderSnapshot(order),
    auditLog: [
      {
        at: new Date(),
        action: 'created',
        by: actorName(by),
        detail: 'יצירת משימה'
      }
    ]
  });
  return leanTask(task);
}

export async function updateKitchenTask(
  id: string,
  input: any,
  by?: string
): Promise<any> {
  if (!mongoose.Types.ObjectId.isValid(id)) throw httpError('מזהה משימה לא תקין');
  const version = Number(input?.version);
  if (!Number.isInteger(version) || version < 1) throw httpError('version חובה לעדכון');
  const task = await KitchenPreparationTask.findById(id);
  if (!task) throw httpError('משימה לא נמצאה', 404);
  if (task.version !== version) throw httpError('המשימה עודכנה על ידי משתמש אחר — רענן ונסה שוב', 409);

  if (input.title !== undefined) task.title = String(input.title).trim().slice(0, 200) || task.title;
  if (input.stage !== undefined) {
    if (!isKitchenStage(input.stage)) throw httpError('שלב לא תקין');
    task.stage = input.stage;
  }
  if (input.plannedStartAt !== undefined) {
    const d = new Date(input.plannedStartAt);
    if (Number.isNaN(d.getTime())) throw httpError('plannedStartAt לא תקין');
    task.plannedStartAt = d;
  }
  if (input.plannedEndAt !== undefined) {
    if (input.plannedEndAt === null || input.plannedEndAt === '') task.plannedEndAt = null;
    else {
      const d = new Date(input.plannedEndAt);
      if (Number.isNaN(d.getTime())) throw httpError('plannedEndAt לא תקין');
      task.plannedEndAt = d;
    }
  }
  if (input.plannedQuantity !== undefined) {
    task.plannedQuantity = assertNonNegativeQuantity(input.plannedQuantity, 'כמות מתוכננת');
  }
  if (input.actualQuantity !== undefined) {
    task.actualQuantity = assertNonNegativeQuantity(input.actualQuantity, 'כמות בפועל');
  }
  if (input.unit !== undefined) task.unit = String(input.unit).slice(0, 40);
  if (input.urgency !== undefined && ['low', 'normal', 'high', 'critical'].includes(input.urgency)) {
    task.urgency = input.urgency;
  }
  if (input.stationName !== undefined) task.stationName = String(input.stationName).slice(0, 120);
  if (input.stationId !== undefined) task.stationId = input.stationId || null;
  if (input.assigneeName !== undefined) task.assigneeName = String(input.assigneeName).slice(0, 120);
  if (input.assigneeEmployeeId !== undefined) task.assigneeEmployeeId = input.assigneeEmployeeId || null;
  if (input.notes !== undefined) task.notes = String(input.notes).slice(0, 2000);
  if (Array.isArray(input.checklist)) {
    task.checklist = input.checklist.map((c: any) => ({
      id: String(c.id || crypto.randomBytes(4).toString('hex')),
      label: String(c.label || '').slice(0, 200),
      done: !!c.done,
      doneAt: c.done ? c.doneAt || new Date() : null,
      doneBy: c.done ? c.doneBy || actorName(by) : undefined
    }));
  }
  if (Array.isArray(input.dependsOn)) {
    const deps = input.dependsOn.filter((x: string) => mongoose.Types.ObjectId.isValid(x) && x !== id);
    const siblings = await KitchenPreparationTask.find({ orderId: task.orderId }).select('_id dependsOn').lean();
    const edges = new Map<string, string[]>();
    for (const s of siblings as any[]) {
      edges.set(String(s._id), (s.dependsOn || []).map(String));
    }
    if (hasCircularDependency(edges, id, deps.map(String))) {
      throw httpError('תלות מעגלית בין משימות אינה מותרת');
    }
    task.dependsOn = deps;
  }
  if (
    input.syncStatus === 'manual_override' ||
    input.syncStatus === 'accepted_difference' ||
    input.syncStatus === 'synced'
  ) {
    task.syncStatus = input.syncStatus;
  }
  task.updatedBy = actorName(by);
  task.version += 1;
  pushAudit(task, 'updated', by);
  await task.save();
  return leanTask(task);
}

type TaskAction =
  | 'start'
  | 'partial'
  | 'partially_completed'
  | 'complete'
  | 'completed'
  | 'block'
  | 'reopen'
  | 'cancel'
  | 'checklist'
  | 'note'
  | 'assign';

export async function applyTaskAction(
  id: string,
  body: { action: TaskAction; version: number; payload?: any; idempotencyKey?: string },
  by?: string
) {
  if (!mongoose.Types.ObjectId.isValid(id)) throw httpError('מזהה משימה לא תקין');
  const version = Number(body?.version);
  if (!Number.isInteger(version) || version < 1) throw httpError('version חובה');
  const action = body?.action as TaskAction;
  if (!action) throw httpError('action חובה');

  const task = await KitchenPreparationTask.findById(id);
  if (!task) throw httpError('משימה לא נמצאה', 404);

  if (body.idempotencyKey && task.lastIdempotencyKey === body.idempotencyKey) {
    return leanTask(task);
  }
  if (task.version !== version) throw httpError('המשימה עודכנה על ידי משתמש אחר — רענן ונסה שוב', 409);

  const prevStatus = task.status;
  switch (action) {
    case 'start':
      if (task.status === 'cancelled') throw httpError('לא ניתן להתחיל משימה שבוטלה');
      task.status = 'in_progress';
      break;
    case 'partial':
    case 'partially_completed': {
      const qty = assertNonNegativeQuantity(body.payload?.actualQuantity, 'כמות בפועל');
      if (qty == null) throw httpError('יש להזין כמות בפועל');
      task.actualQuantity = qty;
      task.status = 'partially_completed';
      break;
    }
    case 'complete':
    case 'completed': {
      if (body.payload?.actualQuantity !== undefined) {
        task.actualQuantity = assertNonNegativeQuantity(body.payload.actualQuantity, 'כמות בפועל');
      } else if (task.actualQuantity == null && task.plannedQuantity != null) {
        task.actualQuantity = task.plannedQuantity;
      }
      task.status = 'completed';
      task.completedAt = new Date();
      task.completedBy = actorName(by);
      break;
    }
    case 'block':
      task.status = 'blocked';
      task.blockReason = String(body.payload?.reason || '').trim().slice(0, 500);
      if (!task.blockReason) throw httpError('יש לציין סיבת חסימה');
      break;
    case 'reopen':
      task.status = 'in_progress';
      task.completedAt = null;
      task.cancelReason = undefined;
      task.blockReason = undefined;
      break;
    case 'cancel':
      task.status = 'cancelled';
      task.cancelReason = String(body.payload?.reason || 'בוטל').trim().slice(0, 500);
      break;
    case 'checklist': {
      const itemId = String(body.payload?.id || '');
      const done = !!body.payload?.done;
      const item = (task.checklist || []).find((c) => c.id === itemId);
      if (!item) throw httpError('פריט checklist לא נמצא');
      item.done = done;
      item.doneAt = done ? new Date() : null;
      item.doneBy = done ? actorName(by) : undefined;
      break;
    }
    case 'note':
      task.notes = String(body.payload?.notes ?? task.notes ?? '').slice(0, 2000);
      break;
    case 'assign':
      if (body.payload?.assigneeName !== undefined) {
        task.assigneeName = String(body.payload.assigneeName).slice(0, 120);
      }
      if (body.payload?.stationName !== undefined) {
        task.stationName = String(body.payload.stationName).slice(0, 120);
      }
      if (body.payload?.assigneeEmployeeId !== undefined) {
        task.assigneeEmployeeId = body.payload.assigneeEmployeeId || null;
      }
      break;
    default:
      throw httpError('פעולה לא נתמכת');
  }

  task.updatedBy = actorName(by);
  task.version += 1;
  if (body.idempotencyKey) task.lastIdempotencyKey = String(body.idempotencyKey).slice(0, 120);
  pushAudit(task, `action:${action}`, by, {
    previousValue: prevStatus,
    newValue: task.status
  });
  await task.save();
  return leanTask(task);
}

export async function bulkTaskActions(
  body: { taskIds: string[]; action: TaskAction; payload?: any },
  by?: string
) {
  const ids = (body.taskIds || []).filter((id) => mongoose.Types.ObjectId.isValid(id)).slice(0, 100);
  const results: any[] = [];
  for (const id of ids) {
    const task = await KitchenPreparationTask.findById(id).select('version').lean();
    if (!task) continue;
    try {
      results.push(
        await applyTaskAction(
          id,
          { action: body.action, version: (task as any).version, payload: body.payload },
          by
        )
      );
    } catch (err: any) {
      results.push({ id, error: err.message, statusCode: err.statusCode || 400 });
    }
  }
  return results;
}

/** Preview / commit multi-day plan for an order. */
export async function buildKitchenPlan(
  input: {
    orderId: string;
    commit?: boolean;
    saveAsTemplateName?: string;
    days?: Array<{ date: string; tasks: any[] }>;
    templateId?: string;
    splitByItems?: boolean;
  },
  by?: string
) {
  if (!mongoose.Types.ObjectId.isValid(input.orderId)) throw httpError('orderId לא תקין');
  const order = await Order.findById(input.orderId).lean();
  if (!order) throw httpError('הזמנה לא נמצאה', 404);
  const snapshot = buildOrderSnapshot(order);
  const eventDate = snapshot.eventDate;
  const warnings: string[] = [];
  if (!eventDate) warnings.push('להזמנה אין תאריך אספקה/אירוע');

  let dayDefs = input.days || [];
  if (input.templateId && mongoose.Types.ObjectId.isValid(input.templateId)) {
    const tpl = await KitchenPrepTemplate.findById(input.templateId).lean();
    if (!tpl) throw httpError('תבנית לא נמצאה', 404);
    dayDefs = expandTemplateToDays(tpl.tasks as KitchenTemplateTaskDef[], order, eventDate, warnings);
  }

  if (!dayDefs.length) {
    const { at, usedDeliveryFallback } = resolveBackfillPlanTime(order);
    if (usedDeliveryFallback) warnings.push('אין kitchenPreparationAt — משתמשים בתאריך אספקה כ-fallback');
    dayDefs = [
      {
        date: toJerusalemDateKey(at),
        tasks: [
          {
            title: `הכנה בסיסית — ${snapshot.orderNumber || input.orderId}`,
            stage: 'general',
            plannedStartAt: at.toISOString(),
            plannedQuantity: null,
            source: 'automatic_legacy',
            usedDeliveryFallback
          }
        ]
      }
    ];
    warnings.push('ההזמנה עדיין לא קיבלה תוכנית מפורטת');
  }

  const previewTasks: any[] = [];
  for (const day of dayDefs) {
    for (const t of day.tasks || []) {
      const start = new Date(t.plannedStartAt || `${day.date}T08:00:00.000+03:00`);
      if (Number.isNaN(start.getTime())) {
        warnings.push(`משימה ללא תאריך תקין: ${t.title || '?'}`);
        continue;
      }
      if (eventDate && toJerusalemDateKey(start) > eventDate) {
        warnings.push(`משימה "${t.title}" מתוכננת אחרי מועד האספקה`);
      }
      if (t.plannedQuantity == null && t.stage !== 'station_clean' && t.stage !== 'general') {
        warnings.push(`משימה "${t.title}" ללא כמות`);
      }
      previewTasks.push({
        ...t,
        orderId: input.orderId,
        plannedStartAt: start.toISOString(),
        orderSnapshot: snapshot
      });
    }
  }

  if (!input.commit) {
    return { preview: true, warnings, tasks: previewTasks, orderSnapshot: snapshot };
  }

  const created = [];
  for (const t of previewTasks) {
    created.push(
      await createKitchenTask(
        {
          ...t,
          source: t.source || 'manual'
        },
        by
      )
    );
  }

  if (input.saveAsTemplateName) {
    await KitchenPrepTemplate.create({
      name: String(input.saveAsTemplateName).slice(0, 160),
      createdBy: actorName(by),
      tasks: previewTasks.map((t) => ({
        title: t.title,
        stage: t.stage || 'general',
        daysBeforeEvent: eventDate
          ? Math.max(0, Math.round((Date.parse(eventDate) - Date.parse(toJerusalemDateKey(t.plannedStartAt))) / 86400000))
          : 0,
        plannedQuantityMode: t.plannedQuantity == null ? 'none' : 'fixed',
        fixedQuantity: t.plannedQuantity,
        unit: t.unit,
        urgency: t.urgency,
        stationName: t.stationName,
        notes: t.notes
      }))
    });
  }

  return { preview: false, warnings, tasks: created, orderSnapshot: snapshot };
}

function expandTemplateToDays(
  defs: KitchenTemplateTaskDef[],
  order: any,
  eventDate: string,
  warnings: string[]
) {
  if (!eventDate) {
    warnings.push('לא ניתן להחיל תבנית בלי תאריך אירוע');
    return [];
  }
  const items = orderedQuantitiesFromOrder(order);
  const byDate = new Map<string, any[]>();
  for (const def of defs || []) {
    const d = new Date(`${eventDate}T12:00:00.000Z`);
    d.setUTCDate(d.getUTCDate() - (def.daysBeforeEvent || 0));
    const dateKey = d.toISOString().slice(0, 10);
    const hour = def.startHour ?? 8;
    const minute = def.startMinute ?? 0;
    const start = new Date(`${dateKey}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00.000+03:00`);
    const end = new Date(start.getTime() + (def.durationHours || 2) * 3600000);
    const base = {
      title: def.title,
      stage: def.stage,
      plannedStartAt: start.toISOString(),
      plannedEndAt: end.toISOString(),
      unit: def.unit || "יח'",
      urgency: def.urgency || 'normal',
      stationName: def.stationName,
      notes: def.notes,
      source: 'template',
      checklist: (def.checklistLabels || []).map((label) => ({
        id: crypto.randomBytes(4).toString('hex'),
        label,
        done: false
      }))
    };
    if (def.plannedQuantityMode === 'order_item' && items.length) {
      for (const item of items) {
        const list = byDate.get(dateKey) || [];
        list.push({
          ...base,
          title: `${def.title} — ${item.name}`,
          orderItemKey: item.orderItemKey,
          plannedQuantity: item.orderedQuantity
        });
        byDate.set(dateKey, list);
      }
    } else {
      const list = byDate.get(dateKey) || [];
      list.push({
        ...base,
        plannedQuantity: def.plannedQuantityMode === 'fixed' ? def.fixedQuantity : null
      });
      byDate.set(dateKey, list);
    }
  }
  return [...byDate.entries()].map(([date, tasks]) => ({ date, tasks }));
}

export async function syncReviewOrderTasks(
  orderId: string,
  body: { taskIds: string[]; decision: 'accept' | 'keep' | 'override'; note?: string },
  by?: string
) {
  const ids = (body.taskIds || []).filter((id) => mongoose.Types.ObjectId.isValid(id));
  const updated = [];
  for (const id of ids) {
    const task = await KitchenPreparationTask.findOne({ _id: id, orderId });
    if (!task || task.syncStatus !== 'needs_review') continue;
    if (body.decision === 'accept') {
      task.syncStatus = 'accepted_difference';
      task.syncDetail = String(body.note || 'השינוי התקבל').slice(0, 500);
      task.changeContext = {
        previousValue: task.syncPreviousValue,
        newValue: task.syncNewValue,
        reason: task.syncDetail
      };
    } else if (body.decision === 'override') {
      task.syncStatus = 'manual_override';
      task.syncDetail = String(body.note || 'נשמר ידנית').slice(0, 500);
    } else {
      task.syncDetail = String(body.note || 'הושאר לבדיקה').slice(0, 500);
    }
    task.updatedBy = actorName(by);
    task.version += 1;
    pushAudit(task, `sync:${body.decision}`, by);
    await task.save();
    updated.push(leanTask(task));
  }
  return updated;
}

/** Mark open tasks for order changes — never auto-overwrite done/manual. */
export async function onOrderKitchenRelevantChange(
  orderId: string,
  change: {
    type: string;
    summary: string;
    previousValue?: string;
    newValue?: string;
    criticalAllergy?: boolean;
  },
  by?: string
) {
  if (!mongoose.Types.ObjectId.isValid(orderId)) return;
  const tasks = await KitchenPreparationTask.find({ orderId });
  for (const task of tasks) {
    if (task.syncStatus === 'manual_override' || task.syncStatus === 'accepted_difference') continue;
    if (change.type === 'cancelled' || change.type === 'soft_delete') {
      if (isOpenTaskStatus(task.status)) {
        const prev = task.status;
        task.status = 'cancelled';
        task.cancelReason = change.summary;
        task.syncStatus = 'needs_review';
        task.syncDetail = change.summary;
        task.syncPreviousValue = change.previousValue;
        task.syncNewValue = change.newValue;
        task.version += 1;
        pushAudit(task, 'order:cancelled', by, {
          previousValue: prev,
          newValue: 'cancelled',
          detail: change.summary
        });
        await task.save();
      } else if (isCompletedTaskStatus(task.status)) {
        task.syncStatus = 'needs_review';
        task.syncDetail = 'הזמנה בוטלה לאחר שהמשימה הושלמה — יש לטפל בעודף/מלאי';
        task.version += 1;
        pushAudit(task, 'order:cancelled_after_done', by, { detail: change.summary });
        await task.save();
      }
      continue;
    }
    if (change.type === 'restored') {
      task.syncStatus = 'needs_review';
      task.syncDetail = 'הזמנה שוחזרה — אין שחזור אוטומטי של משימות; יש לבדוק ידנית';
      task.version += 1;
      pushAudit(task, 'order:restored', by);
      await task.save();
      continue;
    }
    if (isCompletedTaskStatus(task.status)) {
      task.syncStatus = 'needs_review';
      task.syncDetail = change.summary;
      task.syncPreviousValue = change.previousValue;
      task.syncNewValue = change.newValue;
      task.version += 1;
      pushAudit(task, `order:${change.type}`, by, {
        previousValue: change.previousValue,
        newValue: change.newValue,
        detail: change.summary
      });
      await task.save();
      continue;
    }
    if (task.source === 'manual' && task.syncStatus !== 'synced') {
      task.syncStatus = 'needs_review';
      task.syncDetail = change.summary;
      task.version += 1;
      pushAudit(task, `order:${change.type}`, by, { detail: change.summary });
      await task.save();
      continue;
    }
    task.syncStatus = 'needs_review';
    task.syncDetail = change.summary;
    task.syncPreviousValue = change.previousValue;
    task.syncNewValue = change.newValue;
    if (change.criticalAllergy) task.urgency = 'critical';
    task.version += 1;
    pushAudit(task, `order:${change.type}`, by, {
      previousValue: change.previousValue,
      newValue: change.newValue,
      detail: change.summary
    });
    await task.save();
  }
}

export async function backfillKitchenTasks(opts: {
  startDate?: string;
  endDate?: string;
  dryRun?: boolean;
}): Promise<{ created: number; skipped: number; dryRun: boolean }> {
  const today = toJerusalemDateKey();
  const start = opts.startDate || today;
  const end = opts.endDate || start;
  validateKitchenDateRange(start, end);
  const orders = await Order.find({
    status: { $in: ['pending', 'new', 'processing', 'in-progress', 'ready', 'out_for_delivery'] },
    isDeleted: { $ne: true },
    'customerDetails.eventDate': { $gte: start, $lte: `${end}\uffff` }
  })
    .select('_id orderNumber items customerDetails kitchenPreparationAt mealTime mealTypes orderType cateringKind eventType allergies specialRequests portionsEvening portionsMorning numberOfPortions status')
    .lean();

  let created = 0;
  let skipped = 0;
  for (const order of orders as any[]) {
    const backfillKey = `auto:${String(order._id)}`;
    const existing = await KitchenPreparationTask.findOne({ orderId: order._id, backfillKey }).lean();
    if (existing) {
      skipped += 1;
      continue;
    }
    if (opts.dryRun) {
      created += 1;
      continue;
    }
    const { at, usedDeliveryFallback } = resolveBackfillPlanTime(order);
    const snapshot = buildOrderSnapshot(order);
    await KitchenPreparationTask.create({
      orderId: order._id,
      title: `הכנה בסיסית — ${snapshot.orderNumber || String(order._id).slice(-6)}`,
      stage: 'general',
      plannedStartAt: at,
      plannedQuantity: null,
      unit: "יח'",
      status: 'not_started',
      urgency: 'normal',
      source: 'automatic_legacy',
      backfillKey,
      usedDeliveryFallback,
      syncStatus: usedDeliveryFallback ? 'needs_review' : 'synced',
      orderSnapshot: snapshot,
      createdBy: 'system:backfill',
      updatedBy: 'system:backfill',
      version: 1,
      auditLog: [
        {
          at: new Date(),
          action: 'backfill',
          by: 'system:backfill',
          detail: usedDeliveryFallback ? 'fallback למועד אספקה' : 'לפי kitchenPreparationAt'
        }
      ]
    });
    created += 1;
  }
  return { created, skipped, dryRun: !!opts.dryRun };
}

// ── Stations / templates CRUD ───────────────────────────────────────────

export async function listStations() {
  return KitchenStation.find().sort({ name: 1 }).lean();
}

export async function upsertStation(input: any, id?: string) {
  const name = String(input?.name || '').trim();
  if (!name) throw httpError('שם תחנה חובה');
  const payload = {
    name,
    active: input.active !== false,
    maxPortionsPerDay:
      input.maxPortionsPerDay === '' || input.maxPortionsPerDay == null
        ? null
        : assertNonNegativeQuantity(input.maxPortionsPerDay, 'קיבולת מנות'),
    availableHours:
      input.availableHours === '' || input.availableHours == null
        ? null
        : assertNonNegativeQuantity(input.availableHours, 'שעות'),
    workerCount:
      input.workerCount === '' || input.workerCount == null
        ? null
        : assertNonNegativeQuantity(input.workerCount, 'עובדים'),
    equipmentNotes: String(input.equipmentNotes || '').slice(0, 1000)
  };
  if (id) {
    const updated = await KitchenStation.findByIdAndUpdate(id, { $set: payload }, { new: true }).lean();
    if (!updated) throw httpError('תחנה לא נמצאה', 404);
    return updated;
  }
  return KitchenStation.create(payload);
}

export async function deleteStation(id: string) {
  const res = await KitchenStation.findByIdAndDelete(id);
  if (!res) throw httpError('תחנה לא נמצאה', 404);
  return { deleted: true };
}

export async function listTemplates() {
  return KitchenPrepTemplate.find({ active: { $ne: false } }).sort({ name: 1 }).lean();
}

export async function saveTemplate(input: any, by?: string, id?: string) {
  const name = String(input?.name || '').trim();
  if (!name) throw httpError('שם תבנית חובה');
  const payload = {
    name,
    description: String(input.description || '').slice(0, 1000),
    active: input.active !== false,
    tasks: Array.isArray(input.tasks) ? input.tasks : [],
    updatedBy: actorName(by)
  };
  if (id) {
    const updated = await KitchenPrepTemplate.findByIdAndUpdate(id, { $set: payload }, { new: true }).lean();
    if (!updated) throw httpError('תבנית לא נמצאה', 404);
    return updated;
  }
  return KitchenPrepTemplate.create({ ...payload, createdBy: actorName(by) });
}

export async function deleteTemplate(id: string) {
  const res = await KitchenPrepTemplate.findByIdAndDelete(id);
  if (!res) throw httpError('תבנית לא נמצאה', 404);
  return { deleted: true };
}

// ── Ops report ──────────────────────────────────────────────────────────

export async function getKitchenOpsReport(query: Record<string, unknown>) {
  const view = String(query.view || 'today');
  const day = String(query.day || toJerusalemDateKey()).slice(0, 10);
  const startDate = String(query.startDate || day).slice(0, 10);
  const endDate = String(query.endDate || startDate).slice(0, 10);
  validateKitchenDateRange(startDate, endDate);

  const taskFilter: Record<string, unknown> = {};
  if (query.stage && isKitchenStage(query.stage)) taskFilter.stage = query.stage;
  if (query.status && isKitchenTaskStatus(query.status)) taskFilter.status = query.status;
  if (query.stationName) taskFilter.stationName = String(query.stationName);
  if (query.orderId && mongoose.Types.ObjectId.isValid(String(query.orderId))) {
    taskFilter.orderId = query.orderId;
  }
  if (query.overdue === 'true' || query.overdue === true) {
    taskFilter.status = {
      $in: ['not_started', 'in_progress', 'partial', 'partially_completed', 'blocked']
    };
    taskFilter.plannedEndAt = { $lt: new Date() };
  }
  if (query.blocked === 'true' || query.blocked === true) taskFilter.status = 'blocked';
  if (query.changed === 'true' || query.changed === true) {
    taskFilter.syncStatus = { $in: ['needs_review', 'orphaned'] };
  }
  if (query.allergiesOnly === 'true' || query.allergiesOnly === true) {
    taskFilter['orderSnapshot.allergies'] = { $exists: true, $nin: [null, ''] };
  }

  if (view === 'today') {
    const { start, end } = jerusalemDayBounds(day);
    taskFilter.plannedStartAt = { $gte: start, $lte: end };
  } else if (view === 'event' && query.orderId) {
    // all tasks for order
  } else {
    const { start } = jerusalemDayBounds(startDate);
    const { end } = jerusalemDayBounds(endDate);
    taskFilter.plannedStartAt = { $gte: start, $lte: end };
  }

  const tasks = await KitchenPreparationTask.find(taskFilter).sort({ plannedStartAt: 1 }).limit(5000).lean();
  const stations = await KitchenStation.find({ active: { $ne: false } }).lean();

  const kitchenReport = await getAdvancedKitchenReport({
    startDate,
    endDate,
    meal: query.meal,
    fulfillmentType: query.fulfillmentType,
    includeCancelled: query.includeCancelled ?? true,
    changedOnly: query.changedOnly,
    search: query.search,
    includeCatering: query.includeCatering,
    orderKind: query.orderKind
  });

  const now = new Date();
  const overdue = tasks.filter(
    (t: any) =>
      isOpenTaskStatus(t.status) &&
      t.plannedEndAt &&
      new Date(t.plannedEndAt).getTime() < now.getTime()
  );
  const blocked = tasks.filter((t: any) => t.status === 'blocked');
  const byStage: Record<string, { planned: number; actual: number; count: number }> = {};
  for (const t of tasks as any[]) {
    const key = t.stage || 'general';
    if (!byStage[key]) byStage[key] = { planned: 0, actual: 0, count: 0 };
    byStage[key].count += 1;
    byStage[key].planned += Number(t.plannedQuantity) || 0;
    byStage[key].actual += Number(t.actualQuantity) || 0;
  }

  // Capacity: only when station has maxPortionsPerDay
  const capacity = stations.map((s: any) => {
    const stationTasks = (tasks as any[]).filter(
      (t) => t.stationId?.toString() === String(s._id) || t.stationName === s.name
    );
    const load = stationTasks.reduce((sum, t) => sum + (Number(t.plannedQuantity) || 0), 0);
    const configured = s.maxPortionsPerDay != null;
    return {
      stationId: String(s._id),
      name: s.name,
      configured,
      maxPortionsPerDay: s.maxPortionsPerDay,
      plannedLoad: load,
      utilizationPercent: configured && s.maxPortionsPerDay > 0 ? Math.round((load / s.maxPortionsPerDay) * 100) : null,
      overCapacity: configured && s.maxPortionsPerDay != null ? load > s.maxPortionsPerDay : false,
      workerCount: s.workerCount,
      availableHours: s.availableHours
    };
  });

  const ingredients = await buildIngredientSummary(kitchenReport, query);

  const fulfillmentLines = buildFulfillmentLines(kitchenReport, tasks as any[]);

  const eventTimeline =
    view === 'event' || query.orderId
      ? buildEventTimeline(tasks as any[], kitchenReport)
      : null;

  const criticalAllergyAcksNeeded = (tasks as any[]).filter(
    (t) => t.urgency === 'critical' && t.syncStatus === 'needs_review' && t.orderSnapshot?.allergies
  );

  const reportVersion = `KR-${day.replace(/-/g, '')}-${Date.now().toString(36)}`;

  return {
    generatedAt: now.toISOString(),
    timezone: 'Asia/Jerusalem',
    view,
    day,
    range: { startDate, endDate },
    reportVersion,
    filters: query,
    warnings: [
      ...(kitchenReport.summary.activeOrders === 0 && tasks.length === 0
        ? ['אין משימות או הזמנות בטווח']
        : []),
      ...((tasks as any[]).some((t) => t.usedDeliveryFallback)
        ? ['חלק מהמשימות מבוססות על תאריך אספקה (אין kitchenPreparationAt)']
        : [])
    ],
    summary: {
      tasksTotal: tasks.length,
      tasksOpen: (tasks as any[]).filter((t) => isOpenTaskStatus(t.status)).length,
      tasksDone: (tasks as any[]).filter((t) => isCompletedTaskStatus(t.status)).length,
      tasksOverdue: overdue.length,
      tasksBlocked: blocked.length,
      tasksNeedsReview: (tasks as any[]).filter((t) => t.syncStatus === 'needs_review').length,
      orderedPortions: kitchenReport.summary.totalPortions,
      activeOrders: kitchenReport.summary.activeOrders,
      allergyAlerts: kitchenReport.summary.allergyAlerts
    },
    byStage: Object.entries(byStage).map(([stage, v]) => ({
      stage,
      stageLabel: stageLabelHe(stage as KitchenStage),
      ...v
    })),
    tasks: (tasks as any[]).map(serializeTask),
    overdue: overdue.map(serializeTask),
    blocked: blocked.map(serializeTask),
    capacity,
    ingredients,
    fulfillmentLines,
    eventTimeline,
    changes: {
      orderNotes: kitchenReport.cancelledAndChanged,
      alerts: kitchenReport.alerts,
      tasksNeedsReview: (tasks as any[]).filter((t) => t.syncStatus === 'needs_review').map(serializeTask),
      criticalAllergyAcksNeeded: criticalAllergyAcksNeeded.map(serializeTask)
    },
    kitchenQuantitiesReport: kitchenReport
  };
}

function serializeTask(t: any) {
  return {
    ...t,
    id: String(t._id),
    stageLabel: stageLabelHe(t.stage),
    statusLabel: statusLabelHe(t.status),
    plannedDay: toJerusalemDateKey(t.plannedStartAt),
    isOverdue:
      isOpenTaskStatus(t.status) &&
      t.plannedEndAt &&
      new Date(t.plannedEndAt).getTime() < Date.now()
  };
}

function buildFulfillmentLines(kitchenReport: any, tasks: any[]) {
  const packDoneByItem = new Map<string, number>();
  for (const t of tasks) {
    if (
      (t.stage === 'pack' || t.stage === 'load' || t.stage === 'qa') &&
      isCompletedTaskStatus(t.status)
    ) {
      const key = t.orderItemKey || `${t.orderId}:${t.title}`;
      packDoneByItem.set(key, (packDoneByItem.get(key) || 0) + (Number(t.actualQuantity) || 0));
    }
  }
  const lines: any[] = [];
  for (const note of kitchenReport.orderNotes || []) {
    for (const pg of kitchenReport.preparationGroups || []) {
      for (const mg of pg.meals || []) {
        for (const d of mg.dishes || []) {
          const sources = (d.sources || []).filter((s: any) => s.orderId === note.orderId);
          if (!sources.length) continue;
          const ordered = sources.reduce((s: number, x: any) => s + x.quantity, 0);
          const packed = packDoneByItem.get(d.key) || 0;
          lines.push({
            orderId: note.orderId,
            orderNumber: note.orderNumber,
            customerName: note.customerName,
            meal: note.meal,
            fulfillment: note.fulfillment,
            deliveryTime: note.deliveryTime,
            preparationLabel: note.preparationLabel,
            dishName: d.name,
            optionLabel: d.optionLabel,
            sizeLabel: d.sizeLabel,
            orderedQuantity: ordered,
            packedQuantity: packed,
            variance: packed - ordered,
            allergies: note.allergies,
            specialRequests: note.specialRequests
          });
        }
      }
    }
  }
  return lines;
}

function buildEventTimeline(tasks: any[], kitchenReport: any) {
  const byDay = new Map<string, any[]>();
  for (const t of tasks) {
    const day = toJerusalemDateKey(t.plannedStartAt);
    const list = byDay.get(day) || [];
    list.push(serializeTask(t));
    byDay.set(day, list);
  }
  const days = [...byDay.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, dayTasks]) => {
      const done = dayTasks.filter((t) => isCompletedTaskStatus(t.status)).length;
      return {
        date,
        tasks: dayTasks,
        completionPercent: dayTasks.length ? Math.round((done / dayTasks.length) * 100) : 0,
        blockedCount: dayTasks.filter((t) => t.status === 'blocked').length,
        needsReviewCount: dayTasks.filter((t) => t.syncStatus === 'needs_review').length
      };
    });
  return {
    days,
    deliveryRange: kitchenReport.range,
    overallCompletionPercent: tasks.length
      ? Math.round((tasks.filter((t) => isCompletedTaskStatus(t.status)).length / tasks.length) * 100)
      : 0
  };
}

async function buildIngredientSummary(kitchenReport: any, _query: Record<string, unknown>) {
  // Load recipes for dishes by name match (best-effort); never invent.
  const menuItems = await MenuItem.find({ recipe: { $exists: true, $ne: [] } })
    .select('name recipe')
    .lean();
  const byName = new Map<string, any>();
  for (const m of menuItems as any[]) {
    byName.set(String(m.name || '').trim().toLowerCase(), m);
  }

  const ingredients = new Map<string, { name: string; unit: string; category: string; required: number; dishes: string[] }>();
  let dishesWithRecipe = 0;
  let dishesWithoutRecipe = 0;
  const missingRecipes: string[] = [];

  for (const pg of kitchenReport.preparationGroups || []) {
    for (const mg of pg.meals || []) {
      for (const d of mg.dishes || []) {
        const recipe = byName.get(String(d.name || '').trim().toLowerCase());
        if (!recipe?.recipe?.length) {
          dishesWithoutRecipe += 1;
          missingRecipes.push(d.name);
          continue;
        }
        dishesWithRecipe += 1;
        const scale = Number(d.quantity) || 0;
        for (const ing of recipe.recipe) {
          const key = `${ing.name}||${ing.unit}`.toLowerCase();
          const prev = ingredients.get(key);
          const add = (Number(ing.quantity) || 0) * scale;
          if (prev) {
            prev.required += add;
            if (!prev.dishes.includes(d.name)) prev.dishes.push(d.name);
          } else {
            ingredients.set(key, {
              name: ing.name,
              unit: ing.unit,
              category: ing.category || '',
              required: add,
              dishes: [d.name]
            });
          }
        }
      }
    }
  }

  return {
    completeness: dishesWithoutRecipe === 0 && dishesWithRecipe > 0 ? 'full' : dishesWithRecipe > 0 ? 'partial' : 'none',
    dishesWithRecipe,
    dishesWithoutRecipe,
    missingRecipes: [...new Set(missingRecipes)].slice(0, 50),
    items: [...ingredients.values()].sort((a, b) => a.name.localeCompare(b.name, 'he')),
    inventoryAvailable: false,
    note: 'אין מודול מלאי — מוצגת רק דרישה ממתכונים מוגדרים'
  };
}

export function buildOpsPrintHtml(report: any): string {
  const esc = (s: unknown) =>
    String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  const tasks = report.tasks || [];
  const rows = tasks
    .map(
      (t: any) => `<tr class="task-row">
      <td>☐ התחיל</td><td>☐ הוכן</td><td>☐ נבדק</td><td>☐ נארז</td>
      <td>${esc(t.title)}</td>
      <td>${esc(t.stageLabel)}</td>
      <td>${esc(t.plannedQuantity ?? '')} ${esc(t.unit || '')}</td>
      <td class="blank">______</td>
      <td>${esc(t.plannedStartAt ? new Date(t.plannedStartAt).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit' }) : '')}</td>
      <td class="blank">____</td><td class="blank">____</td>
      <td>${esc(t.assigneeName || '')} / ______</td>
      <td>${esc(t.orderSnapshot?.orderNumber || '')}</td>
      <td>${esc(t.orderSnapshot?.eventDate || '')}</td>
      <td class="allergy">${esc(t.orderSnapshot?.allergies || '')}</td>
      <td>${esc(t.orderSnapshot?.specialRequests || '')}</td>
      <td class="blank notes">______________</td>
    </tr>`
    )
    .join('');

  const allergies = (report.changes?.alerts || [])
    .filter((a: any) => a.kind === 'allergy')
    .map((a: any) => `<li><strong>⚠ אלרגיה:</strong> ${esc(a.detail)}</li>`)
    .join('');

  return `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"/><title>דוח מטבח תפעולי</title>
<style>
  body{font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#000;margin:12px}
  h1{font-size:18px;margin:0 0 4px}
  .meta,.alerts{margin:6px 0 10px}
  .warn{border:2px solid #000;padding:6px;font-weight:700;margin:8px 0}
  table{width:100%;border-collapse:collapse}
  th,td{border:1px solid #000;padding:4px;text-align:right;vertical-align:top}
  th{background:#eee}
  thead{display:table-header-group}
  tr.task-row{page-break-inside:avoid}
  .blank{min-width:48px}
  .notes{min-width:90px}
  .allergy{font-weight:700}
  .footer-block{margin-top:16px;page-break-inside:avoid}
  .sign{margin-top:10px;display:flex;gap:24px}
  .sign div{flex:1;border-top:1px solid #000;padding-top:4px;margin-top:28px}
  @page{size:A4 landscape;margin:10mm}
  .page-foot{position:fixed;bottom:0;left:0;right:0;font-size:10px;display:flex;justify-content:space-between}
</style></head><body>
<h1>דוח מטבח — ${esc(report.view === 'today' ? 'היום במטבח' : report.view)}</h1>
<div class="meta">
  <div>תאריך עבודה: <b>${esc(report.day)}</b> · הופק: ${esc(new Date(report.generatedAt).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' }))}</div>
  <div>גרסת דוח: <b>${esc(report.reportVersion)}</b> · משימות: ${report.summary?.tasksTotal || 0}</div>
  <div class="warn">יש לבדוק שינויים שהתקבלו לאחר שעת ההדפסה</div>
</div>
${allergies ? `<div class="alerts"><h2>אלרגיות קריטיות</h2><ul>${allergies}</ul></div>` : ''}
<table>
<thead><tr>
<th>התחיל</th><th>הוכן</th><th>נבדק</th><th>נארז</th>
<th>משימה</th><th>שלב</th><th>כמות מתוכננת</th><th>בפועל</th>
<th>שעת התחלה</th><th>התחלה בפועל</th><th>סיום</th>
<th>עובד</th><th>הזמנה</th><th>אספקה</th><th>אלרגיות</th><th>בקשות</th><th>הערה</th>
</tr></thead>
<tbody>${rows || '<tr><td colspan="17">אין משימות</td></tr>'}</tbody>
</table>
<div class="footer-block">
  <h3>סיכום קבוצה / משמרת</h3>
  <p>הערות: _______________________________________________________________</p>
  <p>חוסרים: ______________________ תקלות: ______________________ עודפים: ______________________</p>
  <p>משימות שנדחו: _______________________________________________________</p>
  <h3>Checklist כללי</h3>
  <p>☐ כמויות נבדקו · ☐ אלרגיות נבדקו · ☐ הזמנות נארזו · ☐ משלוחים סודרו · ☐ איסופים מוכנים</p>
  <p>☐ חוסרים דווחו · ☐ שינויים מאוחרים טופלו · ☐ קירור/אחסון · ☐ בקרת איכות · ☐ הדוח אושר</p>
  <div class="sign"><div>שם אחראי</div><div>חתימה</div><div>שעת אישור</div></div>
</div>
<div class="page-foot"><span>${esc(report.reportVersion)}</span><span>עמוד</span></div>
</body></html>`;
}

export async function exportKitchenOpsReport(format: string, query: Record<string, unknown>) {
  const report = await getKitchenOpsReport(query);
  if (format === 'print' || format === 'html') {
    return { type: 'html', body: buildOpsPrintHtml(report), report };
  }
  if (format === 'pdf') {
    // Reuse Chromium HTML→PDF path via kitchen-report helper by wrapping ops HTML
    const html = buildOpsPrintHtml(report);
    const { buildKitchenPdfBuffer: _ignore } = await import('./kitchen-report.service');
    // Build a minimal KitchenReportDTO-like print via temporary write through existing PDF pipeline:
    // Fall back: generate PDF from ops HTML using the same chrome helper internals.
    const fs = require('fs');
    const path = require('path');
    const { spawnSync } = require('child_process');
    const base = path.join(process.cwd(), '.tmp-kitchen-pdf');
    fs.mkdirSync(base, { recursive: true });
    const dir = fs.mkdtempSync(path.join(base, 'ops-'));
    const htmlPath = path.join(dir, 'ops.html');
    const pdfPath = path.join(dir, 'ops.pdf');
    const fontSrc = path.join(process.cwd(), 'assets/fonts/NotoSansHebrew-Regular.ttf');
    if (fs.existsSync(fontSrc)) fs.copyFileSync(fontSrc, path.join(dir, 'NotoSansHebrew-Regular.ttf'));
    fs.writeFileSync(htmlPath, html.replace('Arial,Helvetica', "'NotoSansHebrew',Arial,Helvetica"), 'utf8');
    const helper = path.join(process.cwd(), 'scripts/html-to-pdf.py');
    const r = spawnSync('python3', [helper, htmlPath, pdfPath], { encoding: 'utf8', timeout: 25000 });
    if (r.status !== 0 || !fs.existsSync(pdfPath)) {
      // Fallback to classic kitchen PDF from quantities report
      const buf = await buildKitchenPdfBuffer(report.kitchenQuantitiesReport);
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
      return { type: 'pdf', body: buf, report };
    }
    const buf = fs.readFileSync(pdfPath);
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
    return { type: 'pdf', body: buf, report };
  }
  if (format === 'csv') {
    const lines = [['יום', 'משימה', 'שלב', 'סטטוס', 'כמות מתוכננת', 'בפועל', 'הזמנה', 'אלרגיות']];
    for (const t of report.tasks) {
      lines.push([
        t.plannedDay,
        t.title,
        t.stageLabel,
        t.statusLabel,
        String(t.plannedQuantity ?? ''),
        String(t.actualQuantity ?? ''),
        t.orderSnapshot?.orderNumber || '',
        t.orderSnapshot?.allergies || ''
      ]);
    }
    const csv = lines.map((r) => r.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(',')).join('\r\n');
    return { type: 'csv', body: Buffer.from(`\uFEFF${csv}`, 'utf8'), report };
  }
  if (format === 'xlsx' || format === 'excel') {
    // Delegate dish quantities sheet from existing builder + tasks sheet via exceljs
    const ExcelJS = require('exceljs');
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('משימות', { views: [{ rightToLeft: true, state: 'frozen', ySplit: 1 }] });
    ws.addRow(['יום', 'משימה', 'שלב', 'סטטוס', 'מתוכנן', 'בפועל', 'הזמנה', 'תחנה', 'עובד', 'אלרגיות']);
    ws.getRow(1).font = { bold: true };
    for (const t of report.tasks) {
      ws.addRow([
        t.plannedDay,
        t.title,
        t.stageLabel,
        t.statusLabel,
        t.plannedQuantity,
        t.actualQuantity,
        t.orderSnapshot?.orderNumber,
        t.stationName,
        t.assigneeName,
        t.orderSnapshot?.allergies
      ]);
    }
    const qtyBuf = await buildKitchenXlsxBuffer(report.kitchenQuantitiesReport);
    const buf = Buffer.from(await wb.xlsx.writeBuffer());
    // Return tasks workbook (quantities still available via classic export)
    void qtyBuf;
    return { type: 'xlsx', body: buf, report };
  }
  throw httpError('פורמט לא נתמך');
}

export { buildOrderItemKey, buildKitchenPrintHtml, buildKitchenCsvBuffer };
