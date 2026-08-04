import Order from '../models/Order';
import MenuItem from '../models/menuItem';
import mongoose from 'mongoose';
import {
  buildKitchenChangeEntry,
  buildKitchenReportDto,
  buildOpenKitchenEventsAlert,
  KitchenChangeType,
  KitchenReportDTO,
  kitchenReportToCsv,
  MenuKitchenMeta,
  OPEN_EVENTS_LOOKAHEAD_DAYS,
  OPEN_EVENTS_LOOKBACK_DAYS,
  addKitchenCalendarDays,
  toJerusalemDateKey,
  validateKitchenReportQuery,
  withBom
} from '../utils/kitchen-report.util';
import {
  buildKitchenDeltasPrintHtml,
  buildKitchenFullPrintHtml,
  buildKitchenOrdersPrintHtml,
  buildKitchenOrderSheetHtml,
  buildKitchenPrepPrintHtml,
  buildKitchenQtySnapshot,
  collectPrintDeltas,
  countMissingChoiceLines,
  type KitchenPrintPackKind
} from '../utils/kitchen-print-pack.util';

const KITCHEN_SAFE_SELECT = [
  '_id',
  'orderNumber',
  'orderType',
  'cateringKind',
  'eventType',
  'status',
  'isDeleted',
  'items',
  'customerDetails',
  'mealTime',
  'mealTypes',
  'numberOfPortions',
  'portionsEvening',
  'portionsMorning',
  'adminNotes',
  'allergies',
  'specialRequests',
  'kitchenPreparationAt',
  'kitchenChangeLog',
  'lastKitchenPrintAt',
  'lastKitchenPrintSnapshot',
  'createdAt',
  'updatedAt'
].join(' ');

export async function loadMenuCategoryMap(productIds: string[]): Promise<Map<string, string>> {
  const meta = await loadMenuKitchenMetaMap(productIds);
  const map = new Map<string, string>();
  for (const [id, m] of meta) map.set(id, m.category);
  return map;
}

export async function loadMenuKitchenMetaMap(
  productIds: string[]
): Promise<Map<string, MenuKitchenMeta>> {
  const ids = [...new Set(productIds.filter(Boolean).map((id) => String(id).replace(/-size-\d+$/i, '').slice(0, 24)).filter((id) => /^[a-f\d]{24}$/i.test(id)))];
  const map = new Map<string, MenuKitchenMeta>();
  if (!ids.length) return map;
  const rows = await MenuItem.find({ _id: { $in: ids } })
    .select('_id category pricingOptions pricingVariants')
    .lean();
  for (const r of rows as any[]) {
    const pricingOptions = Array.isArray(r.pricingOptions)
      ? r.pricingOptions.map((o: any) => ({
          label: o?.label,
          amount: o?.amount,
          size: o?.size,
          price: o?.price
        }))
      : Array.isArray(r.pricingVariants)
        ? r.pricingVariants.map((v: any) => ({
            label: v?.label,
            amount: v?.size ?? v?.amount,
            size: v?.size,
            price: v?.price
          }))
        : [];
    map.set(String(r._id), {
      category: String(r.category || '').trim(),
      pricingOptions
    });
  }
  return map;
}

export async function getAdvancedKitchenReport(
  query: Record<string, unknown>
): Promise<KitchenReportDTO> {
  const filters = validateKitchenReportQuery(query);

  const statusFilter = filters.includeCancelled
    ? {
        $or: [
          {
            status: {
              $in: ['pending', 'new', 'processing', 'in-progress', 'ready', 'out_for_delivery', 'cancelled']
            }
          },
          { isDeleted: true }
        ]
      }
    : {
        // Archive (isDeleted) with an active kitchen status still needs prep sheets.
        status: { $in: ['pending', 'new', 'processing', 'in-progress', 'ready', 'out_for_delivery'] }
      };

  // Broad fetch by eventDate string range; precise filter in builder (Jerusalem).
  const orders = await Order.find({
    ...statusFilter,
    'customerDetails.eventDate': {
      $gte: filters.startDate,
      $lte: `${filters.endDate}\uffff`
    }
  })
    .select(KITCHEN_SAFE_SELECT)
    .lean();

  // Also include orders whose kitchenPreparationAt falls in range but eventDate outside
  const prepExtra = await Order.find({
    ...statusFilter,
    kitchenPreparationAt: {
      $gte: new Date(`${filters.startDate}T00:00:00.000Z`),
      $lte: new Date(`${filters.endDate}T23:59:59.999Z`)
    },
    _id: { $nin: orders.map((o: any) => o._id) }
  })
    .select(KITCHEN_SAFE_SELECT)
    .lean();

  let all: any[] = [...orders, ...prepExtra];

  // Institutions are a separate collection — include when filter allows.
  if (filters.orderKind === 'all' || filters.orderKind === 'institutions') {
    const { loadInstitutionOrdersForKitchenRange } = await import('./kitchen-prep-day.service');
    const institutions = await loadInstitutionOrdersForKitchenRange(filters.startDate, filters.endDate);
    all = [...all, ...institutions];
  }

  const productIds: string[] = [];
  for (const o of all as any[]) {
    for (const item of o.items || []) {
      if (item?.productId) productIds.push(String(item.productId));
    }
  }
  const menuMap = await loadMenuKitchenMetaMap(productIds);
  const report = buildKitchenReportDto(all, filters, menuMap);

  // Always attach open-orders horizon so the kitchen page warns about dates outside the selected range.
  const today = toJerusalemDateKey();
  const openFrom = addKitchenCalendarDays(today, -OPEN_EVENTS_LOOKBACK_DAYS);
  const openTo = addKitchenCalendarDays(today, OPEN_EVENTS_LOOKAHEAD_DAYS);
  const openOrders = await Order.find({
    status: { $in: ['pending', 'new', 'processing', 'in-progress', 'ready', 'out_for_delivery'] },
    isDeleted: { $ne: true },
    'customerDetails.eventDate': {
      $gte: openFrom,
      $lte: `${openTo}\uffff`
    }
  })
    .select('_id orderNumber status orderType cateringKind customerDetails isDeleted')
    .lean();

  report.openEventsAlert = buildOpenKitchenEventsAlert(openOrders, today);
  return report;
}

export async function appendKitchenChange(
  orderId: string,
  type: KitchenChangeType,
  summary: string,
  by?: string,
  meta?: { previousValue?: string; newValue?: string }
): Promise<void> {
  const entry = buildKitchenChangeEntry(type, summary, by, new Date(), meta);
  const doc: Record<string, unknown> = {
    at: new Date(entry.at),
    type: entry.type,
    summary: entry.summary
  };
  if (entry.by) doc.by = entry.by;
  if (entry.previousValue != null) doc.previousValue = entry.previousValue;
  if (entry.newValue != null) doc.newValue = entry.newValue;
  await Order.updateOne(
    { _id: orderId },
    {
      $push: {
        kitchenChangeLog: {
          $each: [doc],
          $slice: -40
        }
      }
    }
  );
}

export async function setKitchenPreparationAt(
  orderId: string,
  kitchenPreparationAt: string | Date | null,
  by?: string
): Promise<any> {
  let value: Date | null = null;
  if (kitchenPreparationAt != null && kitchenPreparationAt !== '') {
    value = new Date(kitchenPreparationAt);
    if (Number.isNaN(value.getTime())) {
      const err: any = new Error('Invalid kitchenPreparationAt');
      err.statusCode = 400;
      throw err;
    }
  }
  const existing = await Order.findById(orderId).select('kitchenPreparationAt customerDetails').lean();
  if (!existing) return null;
  const previousRaw = (existing as any).kitchenPreparationAt;
  const previousValue = previousRaw ? new Date(previousRaw).toISOString() : '';

  // Only touch kitchenPreparationAt — never mutate delivery/event date fields.
  const updated = await Order.findByIdAndUpdate(
    orderId,
    { $set: { kitchenPreparationAt: value } },
    { new: true }
  )
    .select(KITCHEN_SAFE_SELECT)
    .lean();
  if (!updated) return null;
  await appendKitchenChange(
    orderId,
    'preparation',
    value ? `זמן הכנה עודכן ל-${value.toISOString()}` : 'זמן הכנה הייעודי הוסר',
    by,
    {
      previousValue,
      newValue: value ? value.toISOString() : ''
    }
  );
  return updated;
}

export async function setKitchenAllergyFields(
  orderId: string,
  input: { allergies?: string; specialRequests?: string },
  by?: string
): Promise<any> {
  const existing = await Order.findById(orderId).select('allergies specialRequests').lean();
  if (!existing) return null;
  const $set: Record<string, string> = {};
  if (input.allergies !== undefined) $set.allergies = String(input.allergies || '').trim().slice(0, 500);
  if (input.specialRequests !== undefined) {
    $set.specialRequests = String(input.specialRequests || '').trim().slice(0, 1000);
  }
  if (!Object.keys($set).length) {
    const err: any = new Error('No kitchen fields to update');
    err.statusCode = 400;
    throw err;
  }
  const updated = await Order.findByIdAndUpdate(orderId, { $set }, { new: true })
    .select(KITCHEN_SAFE_SELECT)
    .lean();
  if (!updated) return null;
  if ($set.allergies !== undefined) {
    await appendKitchenChange(orderId, 'allergies', 'עודכנו פרטי אלרגיה', by, {
      previousValue: String((existing as any).allergies || ''),
      newValue: $set.allergies
    });
  }
  if ($set.specialRequests !== undefined) {
    await appendKitchenChange(orderId, 'special_requests', 'עודכנו בקשות מיוחדות', by, {
      previousValue: String((existing as any).specialRequests || ''),
      newValue: $set.specialRequests
    });
  }
  try {
    const { onOrderKitchenRelevantChange } = await import('./kitchen-ops.service');
    const allergyChanged =
      $set.allergies !== undefined &&
      String((existing as any).allergies || '') !== String($set.allergies || '');
    await onOrderKitchenRelevantChange(
      orderId,
      {
        type: allergyChanged ? 'allergies' : 'special_requests',
        summary: allergyChanged ? 'עודכנו פרטי אלרגיה' : 'עודכנו בקשות מיוחדות',
        previousValue: allergyChanged
          ? String((existing as any).allergies || '')
          : String((existing as any).specialRequests || ''),
        newValue: allergyChanged ? $set.allergies : $set.specialRequests,
        criticalAllergy: allergyChanged && !!String($set.allergies || '').trim()
      },
      by
    );
  } catch {
    /* non-blocking */
  }
  return updated;
}

export function buildKitchenCsvBuffer(report: KitchenReportDTO): Buffer {
  return withBom(kitchenReportToCsv(report));
}

export async function buildKitchenXlsxBuffer(report: KitchenReportDTO): Promise<Buffer> {
  // Lazy require so unit tests that don't export xlsx still load.
  const ExcelJS = require('exceljs');
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Megadim Kitchen Report';
  wb.created = new Date(report.generatedAt);

  const summary = wb.addWorksheet('סיכום', { views: [{ rightToLeft: true }] });
  summary.addRow(['שדה', 'ערך']);
  summary.getRow(1).font = { bold: true };
  summary.addRows([
    ['נוצר ב', report.generatedAt],
    ['מתאריך', report.range.startDate],
    ['עד תאריך', report.range.endDate],
    ['הזמנות פעילות', report.summary.activeOrders],
    ['מנות כולל', report.summary.totalPortions],
    ['סוגי מנות', report.summary.distinctDishes],
    ['משלוחים', report.summary.deliveries],
    ['איסופים', report.summary.pickups],
    ['התראות אלרגיה', report.summary.allergyAlerts],
    ['הזמנות ששונו', report.summary.changedOrders],
    ['הזמנות שבוטלו', report.summary.cancelledOrders]
  ]);
  summary.autoFilter = { from: 'A1', to: 'B1' };
  summary.views = [{ state: 'frozen', ySplit: 1, rightToLeft: true }];
  summary.columns = [{ width: 28 }, { width: 40 }];

  const dishes = wb.addWorksheet('כמויות לפי מנה', { views: [{ rightToLeft: true }] });
  dishes.addRow(['תאריך הכנה', 'ארוחה', 'קטגוריה', 'מנה', 'אפשרות', 'גודל', 'כמות', 'יחידה', 'הזמנות']);
  dishes.getRow(1).font = { bold: true };
  for (const pg of report.preparationGroups) {
    for (const mg of pg.meals) {
      for (const d of mg.dishes) {
        dishes.addRow([
          pg.preparationLabel,
          mg.meal,
          d.category,
          d.name,
          d.optionLabel,
          d.sizeLabel,
          d.quantity,
          d.unit,
          d.orderCount
        ]);
      }
    }
  }
  dishes.views = [{ state: 'frozen', ySplit: 1, rightToLeft: true }];
  dishes.autoFilter = { from: 'A1', to: 'I1' };
  dishes.columns = [22, 14, 16, 28, 16, 14, 10, 10, 10].map((width) => ({ width }));

  const details = wb.addWorksheet('פירוט הזמנות', { views: [{ rightToLeft: true }] });
  details.addRow([
    'מספר הזמנה',
    'לקוח',
    'ארוחה',
    'אספקה',
    'הכנה',
    'עיר',
    'שעת אספקה',
    'הערות לקוח',
    'הערות מנהל',
    'אלרגיות',
    'בקשות מיוחדות'
  ]);
  details.getRow(1).font = { bold: true };
  for (const o of report.orderNotes) {
    details.addRow([
      o.orderNumber || o.orderId,
      o.customerName || '',
      o.meal,
      o.fulfillment,
      o.preparationLabel,
      o.city || '',
      o.deliveryTime || '',
      o.customerNotes || '',
      o.adminNotes || '',
      o.allergies || '',
      o.specialRequests || ''
    ]);
  }
  details.views = [{ state: 'frozen', ySplit: 1, rightToLeft: true }];
  details.autoFilter = { from: 'A1', to: 'K1' };

  const changes = wb.addWorksheet('ביטולים ושינויים', { views: [{ rightToLeft: true }] });
  changes.addRow(['מספר הזמנה', 'לקוח', 'סטטוס', 'בוטל', 'שונה', 'שינוי אחרון', 'זמן שינוי']);
  changes.getRow(1).font = { bold: true };
  for (const o of report.cancelledAndChanged) {
    changes.addRow([
      o.orderNumber || o.orderId,
      o.customerName || '',
      o.status,
      o.isCancelled ? 'כן' : 'לא',
      o.isChanged ? 'כן' : 'לא',
      o.lastChange?.summary || '',
      o.lastChange?.at || ''
    ]);
  }
  changes.views = [{ state: 'frozen', ySplit: 1, rightToLeft: true }];
  changes.autoFilter = { from: 'A1', to: 'G1' };

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

function resolveChromeExecutable(): string | null {
  const candidates = [
    process.env.CHROME_PATH,
    process.env.PUPPETEER_EXECUTABLE_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser'
  ].filter(Boolean) as string[];
  const fs = require('fs') as typeof import('fs');
  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) return c;
    } catch {
      /* continue */
    }
  }
  return null;
}

/**
 * HTML→PDF via headless Chromium. Real RTL + embedded Hebrew font; no manual string reverse.
 */
let kitchenPdfLock: Promise<void> = Promise.resolve();

export async function buildKitchenPdfBuffer(report: KitchenReportDTO): Promise<Buffer> {
  const fs = require('fs') as typeof import('fs');
  const path = require('path') as typeof import('path');
  const { spawn } = require('child_process') as typeof import('child_process');

  // Serialize Chrome launches (parallel tests / concurrent exports).
  let release!: () => void;
  const prev = kitchenPdfLock;
  kitchenPdfLock = new Promise<void>((r) => {
    release = r;
  });
  await prev;

  try {
    if (!resolveChromeExecutable()) {
      const err: any = new Error(
        'Hebrew PDF requires Chrome/Chromium. Set CHROME_PATH or install Google Chrome.'
      );
      err.statusCode = 503;
      throw err;
    }

    // Prefer workspace-local temp; ship font beside HTML (file://) — avoid huge base64 hangs.
    const baseTmp = path.join(process.cwd(), '.tmp-kitchen-pdf');
    fs.mkdirSync(baseTmp, { recursive: true });
    const tmpDir = fs.mkdtempSync(path.join(baseTmp, 'run-'));
    const htmlPath = path.join(tmpDir, 'report.html');
    const pdfPath = path.join(tmpDir, 'report.pdf');
    const fontSrc = path.join(process.cwd(), 'assets/fonts/NotoSansHebrew-Regular.ttf');
    const fontDst = path.join(tmpDir, 'NotoSansHebrew-Regular.ttf');
    if (fs.existsSync(fontSrc)) fs.copyFileSync(fontSrc, fontDst);
    const html = buildKitchenPrintHtml(report, {
      fontUrl: fs.existsSync(fontDst) ? './NotoSansHebrew-Regular.ttf' : undefined
    });
    fs.writeFileSync(htmlPath, html, 'utf8');

    const helper = path.join(process.cwd(), 'scripts/html-to-pdf.py');
    const runOnce = (): Promise<void> =>
      new Promise<void>((resolve, reject) => {
        const child = spawn('python3', [helper, htmlPath, pdfPath], {
          stdio: ['ignore', 'ignore', 'pipe'],
          env: process.env
        });
        let stderr = '';
        const timer = setTimeout(() => {
          try {
            child.kill('SIGKILL');
          } catch {
            /* ignore */
          }
          reject(new Error('Chrome PDF timed out after 25s'));
        }, 25000);
        child.stderr.on('data', (d: Buffer) => {
          stderr += d.toString();
        });
        child.on('error', (err) => {
          clearTimeout(timer);
          reject(err);
        });
        child.on('close', (code: number | null) => {
          clearTimeout(timer);
          if (code === 0 && fs.existsSync(pdfPath)) resolve();
          else reject(new Error(`Chrome PDF failed (code ${code}): ${stderr.slice(0, 400)}`));
        });
      });

    let lastErr: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);
        await runOnce();
        lastErr = null;
        break;
      } catch (err) {
        lastErr = err;
        await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
      }
    }
    if (lastErr) {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
      throw lastErr;
    }

    try {
      return fs.readFileSync(pdfPath);
    } finally {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch {
        /* ignore cleanup */
      }
    }
  } finally {
    release();
  }
}

/** Printable HTML (also source for PDF). fontUrl points at Noto Sans Hebrew for Chrome print. */
export function buildKitchenPrintHtml(
  report: KitchenReportDTO,
  opts: { embedFont?: boolean; fontUrl?: string; allowMissingDraft?: boolean } = {}
): string {
  return buildKitchenFullPrintHtml(report, {
    fontUrl: opts.fontUrl,
    allowMissingDraft: opts.allowMissingDraft === true
  });
}

export function buildKitchenPrintPack(
  report: KitchenReportDTO,
  pack: KitchenPrintPackKind,
  opts: {
    fontUrl?: string;
    allowMissingDraft?: boolean;
    orderId?: string;
    printedAt?: string | null;
  } = {}
): { html: string; missingChoiceLines: number; blocked: boolean; snapshot: string } {
  const missingChoiceLines = countMissingChoiceLines(report);
  const snapshot = buildKitchenQtySnapshot(report);
  const allowMissingDraft = opts.allowMissingDraft === true;
  const blocked =
    (pack === 'prep' || pack === 'full') && missingChoiceLines > 0 && !allowMissingDraft;

  if (blocked) {
    const html = buildKitchenPrepPrintHtml(report, {
      fontUrl: opts.fontUrl,
      allowMissingDraft: false
    });
    return { html, missingChoiceLines, blocked: true, snapshot };
  }

  let html: string;
  switch (pack) {
    case 'prep':
      html = buildKitchenPrepPrintHtml(report, {
        fontUrl: opts.fontUrl,
        allowMissingDraft
      });
      break;
    case 'orders':
      html = buildKitchenOrdersPrintHtml(report, { fontUrl: opts.fontUrl });
      break;
    case 'order': {
      const order =
        (report.orderNotes || []).find((o) => o.orderId === opts.orderId) ||
        (report.orderNotes || [])[0];
      html = order
        ? buildKitchenOrderSheetHtml(order, { fontUrl: opts.fontUrl })
        : buildKitchenOrdersPrintHtml(report, { fontUrl: opts.fontUrl });
      break;
    }
    case 'deltas': {
      const deltas = collectPrintDeltas(report.orderNotes || [], opts.printedAt);
      html = buildKitchenDeltasPrintHtml(deltas, {
        dayLabel: `${report.range.startDate}`,
        printedAt: opts.printedAt,
        fontUrl: opts.fontUrl
      });
      break;
    }
    case 'full':
    default:
      html = buildKitchenFullPrintHtml(report, {
        fontUrl: opts.fontUrl,
        allowMissingDraft
      });
      break;
  }
  return { html, missingChoiceLines, blocked: false, snapshot };
}

/** Record kitchen print cut on included orders (no customer email). */
export async function markKitchenReportPrinted(
  orderIds: string[],
  snapshot: string
): Promise<{ updated: number; printedAt: string }> {
  const ids = [...new Set((orderIds || []).map((id) => String(id || '').trim()).filter(Boolean))]
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));
  const printedAt = new Date();
  if (!ids.length) return { updated: 0, printedAt: printedAt.toISOString() };
  const result = await Order.updateMany(
    { _id: { $in: ids } },
    {
      $set: {
        lastKitchenPrintAt: printedAt,
        lastKitchenPrintSnapshot: String(snapshot || '').slice(0, 120)
      }
    }
  );
  return { updated: result.modifiedCount || 0, printedAt: printedAt.toISOString() };
}
