/**
 * Kitchen Print Pack SSOT — P1 daily prep, P2 single-order sheet, P3 deltas.
 * Pure HTML builders (no DB). Used by export/PDF and can be mirrored by FE via API.
 */

import type { KitchenDishAgg, KitchenOrderNote, KitchenReportDTO } from './kitchen-report.util';
import {
  kitchenSizeSortValue,
  looksLikeSizeToken,
  stripSizeSuffixFromItemName
} from './order-item-options.util';

export type KitchenPrintPackKind = 'prep' | 'orders' | 'order' | 'deltas' | 'full';

export type KitchenPrintDelta = {
  orderId: string;
  orderNumber?: string;
  at: string;
  type: string;
  summary: string;
  previousValue?: string;
  newValue?: string;
};

const MISSING_LABEL = 'בחירה חסרה לבדיקה';

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function dishBaseName(name: string, optionLabel: string, sizeLabel: string): string {
  // Only strip a trailing size-like suffix — never nicknames such as (טירשי).
  let base = stripSizeSuffixFromItemName(name);
  // If the encoded size was already stripped, keep nickname intact.
  if (!base) base = String(name || '').trim();
  // Avoid leaving duplicate size text when name still embeds the option.
  if (optionLabel && looksLikeSizeToken(optionLabel)) {
    const re = new RegExp(
      `\\s*\\(${optionLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\s*-\\s*[^)]*)?\\)\\s*$`
    );
    base = base.replace(re, '').trim() || base;
  }
  if (sizeLabel && looksLikeSizeToken(sizeLabel) && base.endsWith(`(${sizeLabel})`)) {
    base = base.replace(/\s*\([^)]*\)\s*$/, '').trim() || base;
  }
  return base;
}

export function flattenPrepDishes(report: KitchenReportDTO): Array<
  KitchenDishAgg & { meal: string; preparationLabel: string; missingChoice: boolean }
> {
  const out: Array<KitchenDishAgg & { meal: string; preparationLabel: string; missingChoice: boolean }> =
    [];
  for (const pg of report.preparationGroups || []) {
    for (const mg of pg.meals || []) {
      for (const d of mg.dishes || []) {
        const missingChoice =
          d.optionLabel === MISSING_LABEL || (d as { missingChoice?: boolean }).missingChoice === true;
        out.push({
          ...d,
          meal: mg.meal,
          preparationLabel: pg.preparationLabel,
          missingChoice
        });
      }
    }
  }
  return out.sort((a, b) => {
    const cat = a.category.localeCompare(b.category, 'he');
    if (cat) return cat;
    const baseA = dishBaseName(a.name, a.optionLabel, a.sizeLabel);
    const baseB = dishBaseName(b.name, b.optionLabel, b.sizeLabel);
    const name = baseA.localeCompare(baseB, 'he');
    if (name) return name;
    const sa = kitchenSizeSortValue(a.sizeLabel, a.optionLabel);
    const sb = kitchenSizeSortValue(b.sizeLabel, b.optionLabel);
    if (sa !== sb) return sa - sb;
    return a.optionLabel.localeCompare(b.optionLabel, 'he');
  });
}

export function countMissingChoiceLines(report: KitchenReportDTO): number {
  let n = 0;
  for (const o of report.orderNotes || []) {
    for (const it of o.items || []) {
      if (it.missingChoice || it.optionLabel === MISSING_LABEL) n += 1;
    }
  }
  return n;
}

/** Stable hash of prep quantities for a day — used for print cut-off / deltas. */
export function buildKitchenQtySnapshot(report: KitchenReportDTO): string {
  const rows = flattenPrepDishes(report).map(
    (d) =>
      `${d.key}|${d.category}|${dishBaseName(d.name, d.optionLabel, d.sizeLabel)}|${d.optionLabel}|${d.sizeLabel}|${d.quantity}|${d.orderCount}`
  );
  rows.sort();
  // Simple non-crypto fingerprint (adequate for change detection).
  let h = 0;
  const s = rows.join('\n');
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return `v1:${rows.length}:${(h >>> 0).toString(16)}`;
}

export function collectPrintDeltas(
  orderNotes: KitchenOrderNote[],
  printedAtIso: string | null | undefined
): KitchenPrintDelta[] {
  if (!printedAtIso) {
    return (orderNotes || [])
      .filter((o) => o.isChanged && o.lastChange)
      .map((o) => ({
        orderId: o.orderId,
        orderNumber: o.orderNumber,
        at: o.lastChange!.at,
        type: o.lastChange!.type,
        summary: o.lastChange!.summary,
        previousValue: o.lastChange!.previousValue,
        newValue: o.lastChange!.newValue
      }));
  }
  const cut = new Date(printedAtIso).getTime();
  if (!Number.isFinite(cut)) return collectPrintDeltas(orderNotes, null);

  const deltas: KitchenPrintDelta[] = [];
  for (const o of orderNotes || []) {
    const lc = o.lastChange;
    if (!lc?.at) continue;
    const at = new Date(lc.at).getTime();
    if (!Number.isFinite(at) || at <= cut) continue;
    deltas.push({
      orderId: o.orderId,
      orderNumber: o.orderNumber,
      at: lc.at,
      type: lc.type,
      summary: lc.summary,
      previousValue: lc.previousValue,
      newValue: lc.newValue
    });
  }
  return deltas.sort((a, b) => String(b.at).localeCompare(String(a.at)));
}

const SHARED_CSS = `
  body{font-family:Arial,"Noto Sans Hebrew",Helvetica,sans-serif;color:#111;font-size:12px;margin:16px;direction:rtl;unicode-bidi:plaintext}
  h1{font-size:18px;margin:0 0 8px} h2{font-size:14px;margin:18px 0 8px;page-break-after:avoid}
  h3{font-size:13px;margin:14px 0 6px;page-break-after:avoid}
  .day-block{margin-top:8px}
  .day-block + .day-block{page-break-before:always;margin-top:0;padding-top:4px}
  .meal-block{margin-top:10px}
  .meta{color:#333;margin:0 0 12px;line-height:1.55}
  .banner{border:2px solid #111;padding:8px 10px;margin:10px 0 14px;font-weight:700}
  .banner.warn{border-color:#8a1f11;color:#8a1f11}
  .allergy-box{border:2px solid #8a1f11;padding:10px;margin:10px 0 14px;font-weight:700;font-size:14px}
  table{width:100%;border-collapse:collapse;margin:12px 0 16px}
  th,td{border:1px solid #222;padding:9px 8px;text-align:right;vertical-align:middle}
  th{background:#eee;font-weight:700}
  thead{display:table-header-group}
  tr{page-break-inside:avoid}
  tbody tr + tr td{border-top-width:1px}
  .qty{font-size:15px;font-weight:700;text-align:center;white-space:nowrap}
  .check{width:40px;text-align:center;font-size:16px;font-weight:700}
  .notes-write{min-width:140px;min-height:28px;height:28px}
  .cat{margin-top:16px;font-weight:700;border-bottom:1px solid #666;padding-bottom:4px}
  .order{page-break-after:always} .order:last-child{page-break-after:auto}
  .delta-old{text-decoration:line-through;color:#666}
  .delta-new{font-weight:700;color:#8a1f11}
  .sign{margin-top:22px;display:flex;gap:28px;flex-wrap:wrap}
  .sign div{flex:1;min-width:140px;border-top:1px solid #333;padding-top:8px;margin-top:32px}
  .hand{margin-top:18px;min-height:72px;border:1px dashed #555;padding:8px 10px}
  .hand-title{font-weight:700;margin-bottom:8px;font-size:12px}
  .hand-space{min-height:48px}
  .summary{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0 14px}
  .summary span{border:1px solid #333;padding:5px 8px}
  @page{size:A4;margin:12mm}
`;

function wrapHtml(title: string, body: string, opts?: { fontUrl?: string }): string {
  const fontUrl = opts?.fontUrl || '';
  const fontFace = fontUrl
    ? `@font-face{font-family:'NotoSansHebrew';src:url('${esc(fontUrl)}') format('truetype');font-weight:400;font-style:normal;font-display:swap;}`
    : '';
  return `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"/><title>${esc(
    title
  )}</title><style>${fontFace}${SHARED_CSS}</style></head><body>${body}</body></html>`;
}

/** P1 — prep totals split by day → meal → category, with checklists + notes. */
export function buildKitchenPrepPrintHtml(
  report: KitchenReportDTO,
  opts: { title?: string; allowMissingDraft?: boolean; fontUrl?: string } = {}
): string {
  const missing = countMissingChoiceLines(report);
  const groups = report.preparationGroups || [];
  const flatCount = flattenPrepDishes(report).length;

  let body = `<h1>${esc(opts.title || 'רשימת הכנות יומית — מגדים')}</h1>
<p class="meta">טווח: ${esc(report.range.startDate)} – ${esc(report.range.endDate)} · הופק: ${esc(
    new Date(report.generatedAt).toLocaleString('he-IL', { timeZone: report.timezone })
  )} · גרסת כמויות: ${esc(buildKitchenQtySnapshot(report))}</p>
<div class="summary">
  <span>הזמנות: <b>${report.summary.activeOrders}</b></span>
  <span>מנות: <b>${report.summary.totalPortions}</b></span>
  <span>סוגים: <b>${report.summary.distinctDishes}</b></span>
  <span>אלרגיות: <b>${report.summary.allergyAlerts}</b></span>
  <span>חסר גודל: <b>${missing}</b></span>
</div>`;

  if (missing > 0) {
    body += opts.allowMissingDraft
      ? `<div class="banner warn">טיוטה — יש ${missing} פריטים עם בחירה חסרה לבדיקה. אין להסתמך על הכמויות האלה לייצור.</div>`
      : `<div class="banner warn">לא להדפיס לייצור — ${missing} פריטים עם בחירה חסרה. תקנו במשרד ואז הדפיסו מחדש.</div>`;
  }

  if (!flatCount) {
    body += `<p>אין מנות להכנה בטווח שנבחר</p>`;
  } else {
    const multiDay = groups.length > 1;
    for (const pg of groups) {
      body += `<section class="day-block">`;
      body += `<h2>${esc(pg.preparationLabel || pg.preparationKey || 'יום הכנה')}</h2>`;
      if (multiDay) {
        body += `<p class="meta">יום הכנה: ${esc(pg.preparationKey)}</p>`;
      }

      for (const mg of pg.meals || []) {
        const dishes = mg.dishes || [];
        if (!dishes.length) continue;
        body += `<div class="meal-block"><h3>ארוחה: ${esc(mg.meal)}</h3>`;

        const byCat = new Map<string, typeof dishes>();
        for (const d of dishes) {
          const list = byCat.get(d.category) || [];
          list.push(d);
          byCat.set(d.category, list);
        }

        for (const [cat, rows] of byCat) {
          body += `<div class="cat">${esc(cat)}</div>
<table><thead><tr>
  <th class="check">הוכן</th>
  <th class="check">נארז</th>
  <th>מנה</th>
  <th>גודל / אפשרות</th>
  <th>כמות</th>
  <th>יחידה</th>
  <th>הזמנות</th>
  <th>הערות</th>
</tr></thead><tbody>`;
          for (const r of rows) {
            const missingChoice =
              r.optionLabel === MISSING_LABEL || (r as { missingChoice?: boolean }).missingChoice === true;
            const base = dishBaseName(r.name, r.optionLabel, r.sizeLabel);
            const sizeDisplay =
              r.optionLabel && /\d/.test(r.optionLabel)
                ? r.optionLabel
                : [r.optionLabel, r.sizeLabel && r.sizeLabel !== r.optionLabel ? r.sizeLabel : '']
                    .filter(Boolean)
                    .join(' · ') || '—';
            body += `<tr class="${missingChoice ? 'banner warn' : ''}">
  <td class="check">☐</td>
  <td class="check">☐</td>
  <td>${esc(base)}</td>
  <td>${esc(sizeDisplay)}${missingChoice ? ' ⚠' : ''}</td>
  <td class="qty">${esc(r.quantity)}</td>
  <td>${esc(r.unit)}</td>
  <td>${esc(r.orderCount)}</td>
  <td class="notes-write"></td>
</tr>`;
          }
          body += `</tbody></table>`;
        }
        body += `</div>`;
      }

      body += `<div class="hand"><div class="hand-title">הערות כלליות / חוסרים / תקלות — ${esc(
        pg.preparationLabel || pg.preparationKey || ''
      )}</div><div class="hand-space"></div></div>
<div class="sign"><div>אחראי הכנה</div><div>אחראי אריזה</div><div>יצא</div></div>`;
      body += `</section>`;
    }
  }

  return wrapHtml(opts.title || 'רשימת הכנות יומית', body, opts);
}

/** P2 — single order packing / station sheet. */
export function buildKitchenOrderSheetHtml(
  order: KitchenOrderNote,
  opts: { fontUrl?: string } = {}
): string {
  const missing = (order.items || []).filter(
    (it) => it.missingChoice || it.optionLabel === MISSING_LABEL
  ).length;
  let body = `<section class="order">
<h1>הזמנה ${esc(order.orderNumber || order.orderId)}</h1>
<p class="meta">
  <b>סוג:</b> ${esc(order.orderKindLabel || '—')} ·
  <b>אספקה:</b> ${esc(order.deliveryDate || '—')} ·
  <b>הכנה:</b> ${esc(order.preparationDate || order.preparationLabel || '—')}<br/>
  <b>לקוח:</b> ${esc(order.customerName || '—')} ·
  <b>טלפון:</b> ${esc(order.phone || '—')}<br/>
  <b>משלוח/איסוף:</b> ${esc(order.fulfillment || '—')} ·
  <b>שעה:</b> ${esc(order.deliveryTime || '—')}<br/>
  <b>כתובת:</b> ${esc(order.address || order.city || '—')}
</p>`;

  if (order.allergies) {
    body += `<div class="allergy-box">אלרגיות: ${esc(order.allergies)}</div>`;
  }
  if (missing) {
    body += `<div class="banner warn">יש ${missing} פריטים עם בחירה חסרה — בדקו לפני הכנה</div>`;
  }

  const notes = [order.specialRequests, order.customerNotes, order.adminNotes]
    .filter(Boolean)
    .join(' · ');
  if (notes) body += `<p class="meta"><b>הערות מהמערכת (לקריאה):</b> ${esc(notes)}</p>`;

  body += `<table><thead><tr>
  <th class="check">הוכן</th>
  <th class="check">נארז</th>
  <th>מנה</th>
  <th>גודל / אפשרות</th>
  <th>כמות</th>
  <th>הערות מטבח</th>
</tr></thead><tbody>`;

  for (const it of order.items || []) {
    const base = dishBaseName(it.name, it.optionLabel || '', it.sizeLabel || '');
    const sizeBits = [it.optionLabel, it.sizeLabel && it.sizeLabel !== it.optionLabel ? it.sizeLabel : '']
      .filter(Boolean)
      .join(' · ');
    // Prefer a single clear size label (e.g. "250 מ\"ל") over "250 מ\"ל · 250".
    const sizeDisplay =
      it.optionLabel && /\d/.test(it.optionLabel)
        ? it.optionLabel
        : sizeBits || '—';
    // Notes column stays blank for handwritten kitchen notes (never auto-fill descriptions).
    body += `<tr>
  <td class="check">☐</td>
  <td class="check">☐</td>
  <td>${esc(base)}</td>
  <td>${esc(sizeDisplay)}${it.missingChoice ? ' ⚠' : ''}</td>
  <td class="qty">${esc(it.quantity)} ${esc(it.unit || '')}</td>
  <td class="notes-write"></td>
</tr>`;
  }
  if (!(order.items || []).length) {
    body += `<tr><td colspan="6">אין מנות</td></tr>`;
  }
  body += `</tbody></table>
<div class="hand"><div class="hand-title">הערות כלליות להזמנה</div><div class="hand-space"></div></div>
<div class="sign"><div>הוכן</div><div>נארז</div><div>יצא</div></div>
</section>`;

  return wrapHtml(`הזמנה ${order.orderNumber || order.orderId}`, body, opts);
}

export function buildKitchenOrdersPrintHtml(
  report: KitchenReportDTO,
  opts: { fontUrl?: string } = {}
): string {
  const sheets = (report.orderNotes || [])
    .map((o) => {
      const html = buildKitchenOrderSheetHtml(o, opts);
      const m = html.match(/<body>([\s\S]*)<\/body>/i);
      return m ? m[1] : '';
    })
    .join('');
  const body = `<h1>הזמנות למטבח — מגדים</h1>
<p class="meta">טווח: ${esc(report.range.startDate)} – ${esc(report.range.endDate)} · ${esc(
    report.orderNotes.length
  )} הזמנות</p>${sheets || '<p>אין הזמנות</p>'}`;
  return wrapHtml('הזמנות למטבח', body, opts);
}

/** P3 — changes since last print. */
export function buildKitchenDeltasPrintHtml(
  deltas: KitchenPrintDelta[],
  opts: { dayLabel?: string; printedAt?: string | null; fontUrl?: string } = {}
): string {
  let body = `<h1>שינויים מאז הדפסה — מגדים</h1>
<p class="meta">יום: ${esc(opts.dayLabel || '—')} · חתך הדפסה: ${esc(
    opts.printedAt
      ? new Date(opts.printedAt).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' })
      : 'טרם נשמר חתך'
  )}</p>`;

  if (!deltas.length) {
    body += `<p>אין שינויים מאז החתך האחרון</p>`;
  } else {
    body += `<table><thead><tr><th>הזמנה</th><th>זמן</th><th>סוג</th><th>סיכום</th><th>לפני ← אחרי</th></tr></thead><tbody>`;
    for (const d of deltas) {
      body += `<tr>
  <td>${esc(d.orderNumber || d.orderId)}</td>
  <td>${esc(new Date(d.at).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' }))}</td>
  <td>${esc(d.type)}</td>
  <td>${esc(d.summary)}</td>
  <td><span class="delta-old">${esc(d.previousValue || '—')}</span> → <span class="delta-new">${esc(
        d.newValue || '—'
      )}</span></td>
</tr>`;
    }
    body += `</tbody></table>`;
  }
  return wrapHtml('שינויים מאז הדפסה', body, opts);
}

/** Full classic export: P1 + alerts + notes (replaces legacy print layout). */
export function buildKitchenFullPrintHtml(
  report: KitchenReportDTO,
  opts: { fontUrl?: string; allowMissingDraft?: boolean } = {}
): string {
  const prep = buildKitchenPrepPrintHtml(report, opts);
  const prepBody = prep.match(/<body>([\s\S]*)<\/body>/i)?.[1] || '';

  const alerts = (report.alerts || [])
    .map(
      (a) =>
        `<li class="${esc(a.kind)}"><strong>${esc(a.title)}</strong> — ${esc(a.detail)}</li>`
    )
    .join('');

  const notes = (report.orderNotes || [])
    .map((o) => {
      const bits = [
        o.allergies ? `אלרגיה: ${esc(o.allergies)}` : '',
        o.specialRequests ? `בקשות: ${esc(o.specialRequests)}` : '',
        o.customerNotes ? `הערת לקוח: ${esc(o.customerNotes)}` : ''
      ].filter(Boolean);
      return bits.length
        ? `<li><strong>${esc(o.orderNumber || o.orderId)}</strong> — ${bits.join(' · ')}</li>`
        : '';
    })
    .filter(Boolean)
    .join('');

  const cancelled = (report.cancelledAndChanged || [])
    .map(
      (o) =>
        `<li>${esc(o.orderNumber || o.orderId)} — ${o.isCancelled ? 'בוטל' : 'עודכן'}${
          o.lastChange ? `: ${esc(o.lastChange.summary)}` : ''
        }</li>`
    )
    .join('');

  const extra = `${alerts ? `<h2>התראות</h2><ul>${alerts}</ul>` : ''}
${notes ? `<h2>הערות הזמנות</h2><ul>${notes}</ul>` : ''}
${cancelled ? `<h2>ביטולים ושינויים</h2><ul>${cancelled}</ul>` : ''}`;

  return wrapHtml('דוח מטבח', `${prepBody}${extra}`, opts);
}
