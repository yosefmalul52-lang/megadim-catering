import Order from '../models/Order';
import MenuItem from '../models/MenuItem';
import {
  buildKitchenChangeEntry,
  buildKitchenReportDto,
  KitchenChangeType,
  KitchenReportDTO,
  kitchenReportToCsv,
  validateKitchenReportQuery,
  withBom
} from '../utils/kitchen-report.util';

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
  'createdAt',
  'updatedAt'
].join(' ');

export async function loadMenuCategoryMap(productIds: string[]): Promise<Map<string, string>> {
  const ids = [...new Set(productIds.filter(Boolean))];
  const map = new Map<string, string>();
  if (!ids.length) return map;
  const rows = await MenuItem.find({ _id: { $in: ids.filter((id) => /^[a-f\d]{24}$/i.test(id)) } })
    .select('_id category')
    .lean();
  for (const r of rows as any[]) {
    map.set(String(r._id), String(r.category || '').trim());
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
          { status: { $in: ['pending', 'new', 'processing', 'in-progress', 'ready', 'out_for_delivery', 'cancelled'] } },
          { isDeleted: true }
        ]
      }
    : {
        status: { $in: ['pending', 'new', 'processing', 'in-progress', 'ready', 'out_for_delivery'] },
        isDeleted: { $ne: true }
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

  const all = [...orders, ...prepExtra];
  const productIds: string[] = [];
  for (const o of all as any[]) {
    for (const item of o.items || []) {
      if (item?.productId) productIds.push(String(item.productId));
    }
  }
  const menuMap = await loadMenuCategoryMap(productIds);
  return buildKitchenReportDto(all, filters, menuMap);
}

export async function appendKitchenChange(
  orderId: string,
  type: KitchenChangeType,
  summary: string,
  by?: string
): Promise<void> {
  const entry = buildKitchenChangeEntry(type, summary, by);
  await Order.updateOne(
    { _id: orderId },
    {
      $push: {
        kitchenChangeLog: {
          $each: [{ at: new Date(entry.at), type: entry.type, summary: entry.summary, by: entry.by }],
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
    by
  );
  return updated;
}

export async function setKitchenAllergyFields(
  orderId: string,
  input: { allergies?: string; specialRequests?: string },
  by?: string
): Promise<any> {
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
    await appendKitchenChange(orderId, 'allergies', 'עודכנו פרטי אלרגיה', by);
  }
  if ($set.specialRequests !== undefined) {
    await appendKitchenChange(orderId, 'special_requests', 'עודכנו בקשות מיוחדות', by);
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

function rtlVisual(text: string): string {
  const s = String(text ?? '');
  if (!/[\u0590-\u05FF]/.test(s)) return s;
  return [...s].reverse().join('');
}

export async function buildKitchenPdfBuffer(report: KitchenReportDTO): Promise<Buffer> {
  const PDFDocument = require('pdfkit');
  const path = require('path');
  const fontPath = path.join(process.cwd(), 'assets/fonts/NotoSansHebrew-Regular.ttf');

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margin: 36,
      info: { Title: 'דוח מטבח', Author: 'Megadim' }
    });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    try {
      doc.registerFont('hebrew', fontPath);
      doc.font('hebrew');
    } catch {
      doc.font('Helvetica');
    }

    const line = (text: string, opts: any = {}) => {
      doc.text(rtlVisual(text), { align: 'right', ...opts });
    };

    line('דוח מטבח', { fontSize: 18 });
    doc.moveDown(0.3);
    line(
      `טווח: ${report.range.startDate} – ${report.range.endDate} | הופק: ${new Date(
        report.generatedAt
      ).toLocaleString('he-IL', { timeZone: report.timezone })}`,
      { fontSize: 10 }
    );
    doc.moveDown(0.4);
    line(
      `הזמנות פעילות: ${report.summary.activeOrders} | מנות: ${report.summary.totalPortions} | סוגי מנות: ${report.summary.distinctDishes} | משלוחים: ${report.summary.deliveries} | איסופים: ${report.summary.pickups} | אלרגיות: ${report.summary.allergyAlerts}`,
      { fontSize: 10 }
    );

    if (report.alerts.length) {
      doc.moveDown(0.5);
      line('התראות', { fontSize: 13 });
      for (const a of report.alerts.slice(0, 20)) {
        line(`• [${a.title}] ${a.detail}`, { fontSize: 9 });
      }
    }

    for (const pg of report.preparationGroups) {
      doc.moveDown(0.6);
      line(pg.preparationLabel + (pg.isManualPreparation ? '' : ' (לפי אספקה)'), { fontSize: 12 });
      line(`משלוחים: ${pg.deliveries} | איסופים: ${pg.pickups}`, { fontSize: 9 });
      for (const mg of pg.meals) {
        doc.moveDown(0.25);
        line(mg.meal, { fontSize: 11 });
        for (const d of mg.dishes) {
          const label = [d.name, d.optionLabel, d.sizeLabel].filter(Boolean).join(' · ');
          line(`${label}  |  ${d.quantity} ${d.unit}  |  הזמנות: ${d.orderCount}`, { fontSize: 9 });
        }
      }
    }

    if (report.cancelledAndChanged.length) {
      doc.moveDown(0.6);
      line('ביטולים ושינויים', { fontSize: 12 });
      for (const o of report.cancelledAndChanged.slice(0, 40)) {
        line(
          `${o.orderNumber || o.orderId} — ${o.isCancelled ? 'בוטל' : 'עודכן'}${
            o.lastChange ? `: ${o.lastChange.summary}` : ''
          }`,
          { fontSize: 9 }
        );
      }
    }

    if (!report.preparationGroups.length && !report.cancelledAndChanged.length) {
      doc.moveDown();
      line('אין הזמנות בטווח שנבחר', { fontSize: 12 });
    }

    doc.end();
  });
}

/** Lightweight printable HTML used for PDF generation (Hebrew RTL). */
export function buildKitchenPrintHtml(report: KitchenReportDTO): string {
  const esc = (s: unknown) =>
    String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const dishRows = report.preparationGroups
    .map((pg) => {
      const meals = pg.meals
        .map((mg) => {
          const rows = mg.dishes
            .map(
              (d) =>
                `<tr><td>${esc(d.name)}${d.optionLabel ? ` · ${esc(d.optionLabel)}` : ''}${
                  d.sizeLabel ? ` (${esc(d.sizeLabel)})` : ''
                }</td><td>${esc(d.category)}</td><td class="qty">${esc(d.quantity)} ${esc(
                  d.unit
                )}</td><td>${esc(d.orderCount)}</td></tr>`
            )
            .join('');
          return `<h3>${esc(mg.meal)}</h3><table><thead><tr><th>מנה</th><th>קטגוריה</th><th>כמות</th><th>הזמנות</th></tr></thead><tbody>${rows}</tbody></table>`;
        })
        .join('');
      return `<section class="slot"><h2>${esc(pg.preparationLabel)}${
        pg.isManualPreparation ? '' : ' <small>(לפי אספקה)</small>'
      }</h2><p>משלוחים: ${pg.deliveries} · איסופים: ${pg.pickups}</p>${meals}</section>`;
    })
    .join('');

  const alerts = report.alerts
    .map((a) => `<li class="${esc(a.kind)}"><strong>${esc(a.title)}</strong> — ${esc(a.detail)}</li>`)
    .join('');

  return `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"/><title>דוח מטבח</title>
<style>
  body{font-family:Arial,Helvetica,sans-serif;color:#111;font-size:12px;margin:16px}
  h1{font-size:20px;margin:0 0 6px} h2{font-size:15px;margin:18px 0 6px;page-break-after:avoid}
  h3{font-size:13px;margin:12px 0 4px;page-break-after:avoid}
  table{width:100%;border-collapse:collapse;margin-bottom:10px}
  th,td{border:1px solid #333;padding:5px 7px;text-align:right}
  th{background:#eee;font-weight:700}
  thead{display:table-header-group}
  tr{page-break-inside:avoid}
  .qty{font-size:16px;font-weight:700}
  .summary{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0}
  .summary span{border:1px solid #333;padding:6px 10px}
  .allergy{font-weight:700}
  @page{size:A4 landscape;margin:12mm}
</style></head><body>
<h1>דוח מטבח</h1>
<p>טווח: ${esc(report.range.startDate)} – ${esc(report.range.endDate)} · הופק: ${esc(
    new Date(report.generatedAt).toLocaleString('he-IL', { timeZone: report.timezone })
  )}</p>
<div class="summary">
  <span>הזמנות פעילות: <b>${report.summary.activeOrders}</b></span>
  <span>מנות: <b>${report.summary.totalPortions}</b></span>
  <span>סוגי מנות: <b>${report.summary.distinctDishes}</b></span>
  <span>משלוחים: <b>${report.summary.deliveries}</b></span>
  <span>איסופים: <b>${report.summary.pickups}</b></span>
  <span>אלרגיות: <b>${report.summary.allergyAlerts}</b></span>
</div>
${alerts ? `<h2>התראות</h2><ul>${alerts}</ul>` : ''}
${dishRows || '<p>אין הזמנות פעילות בטווח שנבחר</p>'}
${
  report.cancelledAndChanged.length
    ? `<h2>ביטולים ושינויים</h2><ul>${report.cancelledAndChanged
        .map(
          (o) =>
            `<li>${esc(o.orderNumber || o.orderId)} — ${o.isCancelled ? 'בוטל' : 'עודכן'}${
              o.lastChange ? `: ${esc(o.lastChange.summary)}` : ''
            }</li>`
        )
        .join('')}</ul>`
    : ''
}
</body></html>`;
}
