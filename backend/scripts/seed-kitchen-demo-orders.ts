/**
 * Local-only kitchen report demo seed: KDEMO-001..004 + prep tasks.
 *
 * Safety:
 *   - refuses NODE_ENV=production
 *   - requires ALLOW_DEMO_SEED=true
 *   - refuses Atlas / production-like Mongo unless --allow-production (never used here)
 *   - upsert by orderNumber + demoBatchId
 *   - reset deletes only isDemo:true + same demoBatchId
 *
 * Usage:
 *   ALLOW_DEMO_SEED=true MONGO_URI=mongodb://127.0.0.1:PORT/db \
 *     npx ts-node --transpile-only scripts/seed-kitchen-demo-orders.ts
 *   ... --reset
 */
import dotenv from 'dotenv';
dotenv.config();

import path from 'path';
import mongoose from 'mongoose';
import Order from '../src/models/Order';
import KitchenPreparationTask from '../src/models/KitchenPreparationTask';
import KitchenStation from '../src/models/KitchenStation';
import MenuItem from '../src/models/menuItem';
import { buildOrderItemKey } from '../src/utils/kitchen-ops.util';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { assertSafeMongoUri } = require(path.join(
  __dirname,
  '../../scripts/lib/assert-not-production-mongo.cjs'
));

const DEMO_BATCH = 'kitchen-report-local-v1';
const JERUSALEM = 'Asia/Jerusalem';

function jerusalemDateKey(d = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: JERUSALEM,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(d);
}

function addDaysKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d + days, 12, 0, 0));
  return jerusalemDateKey(utc);
}

function atJerusalem(dateKey: string, hour: number, minute = 0): Date {
  // Store as UTC instant that displays as HH:mm in Asia/Jerusalem
  const provisional = new Date(`${dateKey}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+03:00`);
  return provisional;
}

async function resetDemo() {
  const orderRes = await Order.deleteMany({ isDemo: true, demoBatchId: DEMO_BATCH });
  const taskRes = await KitchenPreparationTask.deleteMany({ isDemo: true, demoBatchId: DEMO_BATCH });
  const stationRes = await KitchenStation.deleteMany({ name: { $regex: /^DEMO-/ } } as any);
  console.log(
    JSON.stringify(
      {
        ok: true,
        reset: true,
        demoBatchId: DEMO_BATCH,
        deletedOrders: orderRes.deletedCount,
        deletedTasks: taskRes.deletedCount,
        deletedStations: stationRes.deletedCount
      },
      null,
      2
    )
  );
}

async function pickMenuNames(): Promise<string[]> {
  const items = await MenuItem.find({}).select('name category').limit(20).lean();
  const names = (items as any[]).map((i) => String(i.name || '').trim()).filter(Boolean);
  return names.length
    ? names
    : ['חומוס דמו', 'סלט קצוץ דמו', 'עוף בתנור דמו', 'חלות דמו'];
}

async function upsertOrder(doc: Record<string, any>) {
  const existing = await Order.findOne({
    orderNumber: doc.orderNumber,
    isDemo: true,
    demoBatchId: DEMO_BATCH
  });
  if (existing) {
    Object.assign(existing, doc);
    await existing.save();
    return existing;
  }
  return Order.create(doc);
}

/**
 * Create tasks one-by-one so `dependsOnTempKeys` can resolve to real ObjectIds.
 * Each task may include `tempKey` and `dependsOnTempKeys: string[]` (seed-only helpers).
 */
async function replaceTasksForOrder(
  orderId: mongoose.Types.ObjectId,
  orderNumber: string,
  tasks: Record<string, any>[]
) {
  await KitchenPreparationTask.deleteMany({
    orderId,
    isDemo: true,
    demoBatchId: DEMO_BATCH
  });
  if (!tasks.length) return [];
  const byTemp = new Map<string, mongoose.Types.ObjectId>();
  const created: any[] = [];
  for (let idx = 0; idx < tasks.length; idx++) {
    const t = tasks[idx];
    const { tempKey, dependsOnTempKeys, ...rest } = t;
    const dependsOn = (dependsOnTempKeys || [])
      .map((k: string) => byTemp.get(k))
      .filter(Boolean);
    const doc = await KitchenPreparationTask.create({
      ...rest,
      orderId,
      dependsOn,
      isDemo: true,
      demoBatchId: DEMO_BATCH,
      backfillKey: `demo:${orderNumber}:${idx + 1}`,
      createdBy: 'seed:kitchen-demo',
      updatedBy: 'seed:kitchen-demo',
      version: 1,
      auditLog: [
        {
          at: new Date(),
          action: 'demo_seed',
          by: 'seed:kitchen-demo',
          detail: 'נתוני תצוגה בלבד — לא תהליך מקצועי אמיתי'
        }
      ]
    });
    if (tempKey) byTemp.set(String(tempKey), doc._id);
    created.push(doc);
  }
  return created;
}

async function seed() {
  const reportDate = process.env.DEMO_REPORT_DATE || addDaysKey(jerusalemDateKey(), 1);
  const dayMinus1 = addDaysKey(reportDate, -1);
  const dayPlus0 = reportDate;
  const names = await pickMenuNames();
  const n1 = names[0] || 'מנה דמו 1';
  const n2 = names[1] || 'מנה דמו 2';
  const n3 = names[2] || 'מנה דמו 3';
  const n4 = names[3] || 'מנה דמו 4';

  let station = await KitchenStation.findOne({ name: 'DEMO-קו חם' });
  if (!station) {
    station = await KitchenStation.create({
      name: 'DEMO-קו חם',
      maxPortionsPerDay: 80,
      availableHours: 8,
      workerCount: 2,
      equipmentNotes: 'תחנת דמו בלבד',
      active: true
    });
  }
  let stationPack = await KitchenStation.findOne({ name: 'DEMO-אריזה' });
  if (!stationPack) {
    stationPack = await KitchenStation.create({
      name: 'DEMO-אריזה',
      maxPortionsPerDay: 40,
      availableHours: 6,
      workerCount: 1,
      equipmentNotes: 'תחנת אריזה דמו — קיבולת נמוכה להדגמת עומס',
      active: true
    });
  }
  const dayMinus2 = addDaysKey(reportDate, -2);

  const o1Items = [
    {
      name: n1,
      quantity: 2,
      category: 'סלטים ערב',
      selectedOption: { label: 'רגיל', amount: '250' },
      notes: 'בלי בצל — דמו'
    },
    {
      name: n2,
      quantity: 1,
      category: 'עיקריות ערב',
      selectedOption: { label: 'משפחתי', amount: '1 ק"ג' }
    }
  ];
  const o1 = await upsertOrder({
    orderNumber: 'KDEMO-001',
    orderType: 'shabbat',
    cateringKind: 'shabbat',
    status: 'processing',
    isDeleted: false,
    isDemo: true,
    isTestOrder: true,
    demoBatchId: DEMO_BATCH,
    totalPrice: 1,
    numberOfPortions: 14,
    portionsEvening: 8,
    portionsMorning: 6,
    mealTime: 'both',
    kitchenPreparationAt: atJerusalem(dayPlus0, 8, 0),
    allergies: '',
    specialRequests: 'יציאה מוקדמת למשלוח 13:30 — דמו',
    items: o1Items,
    customerDetails: {
      fullName: 'לקוח דמו א',
      phone: '0500000001',
      email: 'kdemo001@example.invalid',
      eventDate: dayPlus0,
      deliveryMethod: 'delivery',
      address: 'רחוב דמו 1, עיר דמו',
      notes: 'הערה להזמנה — דמו'
    },
    kitchenChangeLog: []
  });

  const o2Items = [
    {
      name: n1,
      quantity: 1,
      category: 'סלטים ערב',
      selectedOption: { label: 'רגיל', amount: '500' }
    },
    {
      name: n3,
      quantity: 1,
      category: 'סלטים בוקר',
      selectedOption: { label: 'רגיל', amount: '500' }
    }
  ];
  const o2 = await upsertOrder({
    orderNumber: 'KDEMO-002',
    orderType: 'shabbat',
    cateringKind: 'shabbat',
    status: 'processing',
    isDeleted: false,
    isDemo: true,
    isTestOrder: true,
    demoBatchId: DEMO_BATCH,
    totalPrice: 1,
    numberOfPortions: 12,
    portionsEvening: 6,
    portionsMorning: 6,
    mealTime: 'both',
    kitchenPreparationAt: atJerusalem(dayPlus0, 9, 30),
    allergies: '',
    specialRequests: '',
    items: o2Items,
    customerDetails: {
      fullName: 'לקוח דמו ב',
      phone: '0500000002',
      email: 'kdemo002@example.invalid',
      eventDate: dayPlus0,
      deliveryMethod: 'pickup',
      notes: ''
    }
  });

  const o3Items = [
    {
      name: n4,
      quantity: 40,
      category: 'עיקריות',
      selectedOption: { label: 'מגש', amount: 'מגש' }
    },
    {
      name: n2,
      quantity: 20,
      category: 'עיקריות',
      selectedOption: { label: 'מגש', amount: 'מגש' }
    }
  ];
  const o3 = await upsertOrder({
    orderNumber: 'KDEMO-003',
    orderType: 'catering',
    cateringKind: 'events',
    eventType: 'אירוע דמו',
    status: 'processing',
    isDeleted: false,
    isDemo: true,
    isTestOrder: true,
    demoBatchId: DEMO_BATCH,
    totalPrice: 1,
    numberOfPortions: 60,
    guestCount: 60,
    mealTime: 'evening',
    kitchenPreparationAt: atJerusalem(dayMinus1, 10, 0),
    allergies: 'בוטנים — דמו',
    specialRequests: 'הגשה חמה בשעה 19:00 — דמו',
    items: o3Items,
    customerDetails: {
      fullName: 'לקוח דמו ג',
      phone: '0500000003',
      email: 'kdemo003@example.invalid',
      eventDate: dayPlus0,
      deliveryMethod: 'delivery',
      address: 'אולם דמו 3',
      notes: 'קייטרינג אירוע — דמו'
    }
  });

  const o4Items = [
    {
      name: n1,
      quantity: 3,
      category: 'סלטים ערב',
      selectedOption: { label: 'רגיל', amount: '250' }
    }
  ];
  const o4 = await upsertOrder({
    orderNumber: 'KDEMO-004',
    orderType: 'shabbat',
    cateringKind: 'shabbat',
    status: 'cancelled',
    isDeleted: false,
    isDemo: true,
    isTestOrder: true,
    demoBatchId: DEMO_BATCH,
    totalPrice: 1,
    numberOfPortions: 10,
    portionsEvening: 10,
    mealTime: 'evening',
    kitchenPreparationAt: atJerusalem(dayPlus0, 7, 0),
    allergies: '',
    specialRequests: '',
    items: o4Items,
    customerDetails: {
      fullName: 'לקוח דמו ד',
      phone: '0500000004',
      email: 'kdemo004@example.invalid',
      eventDate: dayPlus0,
      deliveryMethod: 'delivery',
      address: 'רחוב דמו 4',
      notes: ''
    },
    kitchenChangeLog: [
      {
        at: atJerusalem(dayMinus1, 12, 0),
        type: 'quantity',
        summary: 'כמות עודכנה 8→10 — דמו',
        by: 'seed:kitchen-demo',
        previousValue: '8',
        newValue: '10'
      },
      {
        at: atJerusalem(dayMinus1, 16, 0),
        type: 'cancelled',
        summary: 'הזמנה בוטלה — דמו',
        by: 'seed:kitchen-demo',
        previousValue: 'processing',
        newValue: 'cancelled'
      }
    ]
  });

  const snap = (order: any, extras: Record<string, string> = {}) => ({
    orderNumber: order.orderNumber,
    eventDate: order.customerDetails?.eventDate,
    meal: order.mealTime,
    fulfillment:
      order.customerDetails?.deliveryMethod === 'pickup' ? 'איסוף' : 'משלוח',
    customerName: order.customerDetails?.fullName,
    allergies: order.allergies || '',
    specialRequests: order.specialRequests || '',
    ...extras
  });

  const t1 = await replaceTasksForOrder(o1._id, 'KDEMO-001', [
    {
      tempKey: 'thaw',
      title: `הפשרה — ${n2}`,
      stage: 'thaw',
      plannedStartAt: atJerusalem(dayPlus0, 7, 0),
      plannedEndAt: atJerusalem(dayPlus0, 8, 0),
      plannedQuantity: 8,
      unit: "יח'",
      status: 'not_started',
      urgency: 'normal',
      source: 'manual',
      stationId: station._id,
      stationName: station.name,
      assigneeName: 'עובד דמו א',
      orderItemKey: buildOrderItemKey(o1Items[1]),
      itemSnapshot: {
        name: n2,
        optionLabel: 'משפחתי',
        sizeLabel: '1 ק"ג',
        unit: "יח'",
        mealTime: 'evening',
        orderItemKey: buildOrderItemKey(o1Items[1])
      },
      orderSnapshot: snap(o1),
      checklist: [
        { id: 'c1', label: 'בדוק כמות', done: false },
        { id: 'c2', label: 'סמן זמן יציאה', done: false }
      ]
    },
    {
      tempKey: 'cook',
      title: `בישול — ${n2}`,
      stage: 'cook',
      plannedStartAt: atJerusalem(dayPlus0, 9, 0),
      plannedQuantity: 8,
      unit: "יח'",
      status: 'not_started',
      urgency: 'high',
      source: 'manual',
      stationId: station._id,
      stationName: station.name,
      dependsOnTempKeys: ['thaw'],
      orderItemKey: buildOrderItemKey(o1Items[1]),
      itemSnapshot: {
        name: n2,
        optionLabel: 'משפחתי',
        sizeLabel: '1 ק"ג',
        mealTime: 'evening',
        orderItemKey: buildOrderItemKey(o1Items[1])
      },
      orderSnapshot: snap(o1)
    },
    {
      tempKey: 'pack',
      title: `אריזה ערב+בוקר — ${n1}`,
      stage: 'pack',
      plannedStartAt: atJerusalem(dayPlus0, 11, 0),
      plannedQuantity: 20,
      actualQuantity: 14,
      unit: "יח'",
      status: 'partially_completed',
      urgency: 'high',
      source: 'manual',
      stationId: stationPack._id,
      stationName: stationPack.name,
      assigneeName: 'עובד דמו ב',
      dependsOnTempKeys: ['cook'],
      orderItemKey: buildOrderItemKey(o1Items[0]),
      itemSnapshot: {
        name: n1,
        optionLabel: 'רגיל',
        sizeLabel: '250',
        mealTime: 'both',
        orderItemKey: buildOrderItemKey(o1Items[0])
      },
      orderSnapshot: snap(o1),
      notes: `חוסר דמו: חסרים 6 יח' לאריזה · ${o1Items[0].notes}`
    }
  ]);

  const t2 = await replaceTasksForOrder(o2._id, 'KDEMO-002', [
    {
      tempKey: 'eve',
      title: 'הכנה ערב — פיצול מנות',
      stage: 'prep',
      plannedStartAt: atJerusalem(dayPlus0, 8, 30),
      plannedQuantity: 6,
      unit: "יח'",
      actualQuantity: 3,
      status: 'partially_completed',
      urgency: 'normal',
      source: 'manual',
      stationName: station.name,
      orderSnapshot: snap(o2),
      notes: 'עודף דמו: הוכנו 3 מתוך 6 — נותר להשלים',
      checklist: [{ id: 'c1', label: 'הפרד ערב/בוקר', done: true, doneAt: new Date(), doneBy: 'seed' }]
    },
    {
      tempKey: 'morn',
      title: 'הכנה בוקר — פיצול מנות',
      stage: 'prep',
      plannedStartAt: atJerusalem(dayPlus0, 10, 0),
      plannedQuantity: 6,
      unit: "יח'",
      status: 'blocked',
      urgency: 'normal',
      source: 'manual',
      dependsOnTempKeys: ['eve'],
      blockReason: 'תקלה דמו: ממתין לאישור כמויות',
      orderSnapshot: snap(o2)
    },
    {
      title: 'משימה ידנית — סידור איסוף',
      stage: 'general',
      plannedStartAt: atJerusalem(dayPlus0, 12, 0),
      plannedQuantity: null,
      status: 'not_started',
      urgency: 'low',
      source: 'manual',
      stationName: stationPack.name,
      orderSnapshot: snap(o2),
      notes: 'משימה ידנית ללא שיוך מנה'
    }
  ]);

  const t3 = await replaceTasksForOrder(o3._id, 'KDEMO-003', [
    {
      tempKey: 'thaw2',
      title: `הפשרה יום −2 — ${n4}`,
      stage: 'thaw',
      plannedStartAt: atJerusalem(dayMinus2, 10, 0),
      plannedQuantity: 40,
      unit: 'מגש',
      status: 'completed',
      urgency: 'high',
      source: 'template',
      actualQuantity: 40,
      completedAt: atJerusalem(dayMinus2, 14, 0),
      completedBy: 'seed:kitchen-demo',
      stationId: station._id,
      stationName: station.name,
      orderItemKey: buildOrderItemKey(o3Items[0]),
      itemSnapshot: {
        name: n4,
        optionLabel: 'מגש',
        sizeLabel: 'מגש',
        unit: 'מגש',
        mealTime: 'evening',
        orderItemKey: buildOrderItemKey(o3Items[0])
      },
      orderSnapshot: snap(o3),
      checklist: [
        { id: 'a1', label: 'אישור אלרגיית בוטנים', done: true, doneAt: new Date(), doneBy: 'seed' }
      ]
    },
    {
      tempKey: 'prep1',
      title: `הכנה מוקדמת יום −1 — ${n4}`,
      stage: 'prep',
      plannedStartAt: atJerusalem(dayMinus1, 9, 0),
      plannedQuantity: 40,
      unit: 'מגש',
      status: 'completed',
      urgency: 'critical',
      source: 'template',
      actualQuantity: 40,
      completedAt: atJerusalem(dayMinus1, 12, 0),
      dependsOnTempKeys: ['thaw2'],
      stationId: station._id,
      stationName: station.name,
      orderSnapshot: snap(o3),
      syncStatus: 'needs_review',
      syncDetail: 'אלרגיה קריטית נוספה לאחר תחילת עבודה — דמו',
      syncPreviousValue: '',
      syncNewValue: 'בוטנים — דמו'
    },
    {
      tempKey: 'cook3',
      title: `בישול — ${n4}`,
      stage: 'cook',
      plannedStartAt: atJerusalem(dayPlus0, 8, 0),
      plannedQuantity: 40,
      unit: 'מגש',
      status: 'in_progress',
      urgency: 'critical',
      source: 'template',
      dependsOnTempKeys: ['prep1'],
      stationId: station._id,
      stationName: station.name,
      orderItemKey: buildOrderItemKey(o3Items[0]),
      itemSnapshot: {
        name: n4,
        optionLabel: 'מגש',
        unit: 'מגש',
        mealTime: 'evening',
        orderItemKey: buildOrderItemKey(o3Items[0])
      },
      orderSnapshot: snap(o3),
      notes: 'אלרגיה: בוטנים — חובה הפרדה'
    },
    {
      title: 'אריזה והעמסה לאירוע',
      stage: 'pack',
      plannedStartAt: atJerusalem(dayPlus0, 14, 0),
      plannedQuantity: 60,
      unit: "יח'",
      status: 'not_started',
      urgency: 'high',
      source: 'manual',
      dependsOnTempKeys: ['cook3'],
      stationId: stationPack._id,
      stationName: stationPack.name,
      orderSnapshot: snap(o3)
    }
  ]);

  const t4 = await replaceTasksForOrder(o4._id, 'KDEMO-004', [
    {
      title: `הכנה שבוצעה לפני ביטול — ${n1}`,
      stage: 'prep',
      plannedStartAt: atJerusalem(dayMinus1, 10, 0),
      plannedQuantity: 8,
      unit: "יח'",
      actualQuantity: 10,
      status: 'completed',
      urgency: 'normal',
      source: 'manual',
      completedAt: atJerusalem(dayMinus1, 12, 0),
      syncStatus: 'needs_review',
      syncDetail: 'הזמנה בוטלה לאחר השלמה — עודף 2 יח׳ דמו',
      syncPreviousValue: '8',
      syncNewValue: '10→cancelled',
      changeContext: { previousValue: '8', newValue: '10', reason: 'שינוי כמות ואז ביטול' },
      orderSnapshot: snap(o4),
      notes: 'עודף דמו: הוכנו 10 אחרי שינוי כמות, ההזמנה בוטלה'
    },
    {
      title: 'משימה עתידית שבוטלה',
      stage: 'pack',
      plannedStartAt: atJerusalem(dayPlus0, 12, 0),
      plannedQuantity: 10,
      unit: "יח'",
      status: 'cancelled',
      urgency: 'normal',
      source: 'manual',
      cancelReason: 'הזמנה בוטלה — דמו',
      syncStatus: 'needs_review',
      orderSnapshot: snap(o4)
    }
  ]);

  const orderCount = await Order.countDocuments({ isDemo: true, demoBatchId: DEMO_BATCH });
  const taskCount = await KitchenPreparationTask.countDocuments({
    isDemo: true,
    demoBatchId: DEMO_BATCH
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        demoBatchId: DEMO_BATCH,
        reportDate,
        hint: `בחר בדוח המטבח את התאריך ${reportDate} (יום עבודה / טווח)`,
        orders: ['KDEMO-001', 'KDEMO-002', 'KDEMO-003', 'KDEMO-004'],
        orderCount,
        taskCount,
        tasksCreated: {
          'KDEMO-001': t1.length,
          'KDEMO-002': t2.length,
          'KDEMO-003': t3.length,
          'KDEMO-004': t4.length
        },
        station: station.name,
        loginNote: 'התחבר עם admin מקומי של ה-DB המבודד, או admin מה-.env אם השרת מחובר לאותו DB'
      },
      null,
      2
    )
  );
}

async function main() {
  if (process.env.NODE_ENV === 'production') {
    console.error('[safety] Refusing demo seed when NODE_ENV=production');
    process.exit(1);
  }
  if (process.env.ALLOW_DEMO_SEED !== 'true') {
    console.error('[safety] Set ALLOW_DEMO_SEED=true to run this script');
    process.exit(1);
  }
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  assertSafeMongoUri(uri, {
    allowProduction: process.argv.includes('--allow-production'),
    label: 'kitchen demo seed'
  });
  await mongoose.connect(uri!);
  if (process.argv.includes('--reset')) {
    await resetDemo();
  } else {
    await seed();
  }
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  try {
    await mongoose.disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
