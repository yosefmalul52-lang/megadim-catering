import { IQuote } from '../models/Quote';
import { formatBankLine } from './quote-defaults.util';

function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function money(n: number): string {
  return (Number(n) || 0).toLocaleString('he-IL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatDateHe(d: Date | string | null | undefined): string {
  if (!d) return '';
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return '';
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function formatTimeHe(d: Date | string | null | undefined): string {
  if (!d) return '';
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return '';
  const hh = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mi}`;
}

/** Rivhit-style Hebrew quote HTML (RTL), suitable for print + Chrome PDF. */
export function buildQuotePrintHtml(
  quote: IQuote | Record<string, any>,
  opts?: { fontUrl?: string; issuedAt?: Date }
): string {
  const company = quote.companySnapshot || {};
  const bank = quote.bankSnapshot || {};
  const client = quote.client || {};
  const lines = Array.isArray(quote.lines) ? quote.lines : [];
  const issuedAt = opts?.issuedAt || quote.issuedAt || quote.updatedAt || quote.createdAt || new Date();
  const fontFace = opts?.fontUrl
    ? `@font-face{font-family:'NotoSansHebrew';src:url('${opts.fontUrl}') format('truetype');font-weight:400;font-style:normal;}`
    : '';

  const rowsHtml = lines
    .map((line: any, i: number) => {
      return `<tr>
        <td>${i + 1}</td>
        <td>${esc(line.sku || '0')}</td>
        <td class="desc">${esc(line.description)}</td>
        <td>${money(line.quantity)}</td>
        <td>${money(line.unitPriceInclVat)}</td>
        <td>${money(line.lineTotalInclVat)}</td>
      </tr>`;
    })
    .join('');

  const recipientName = client.company || client.name || '';

  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8"/>
<title>הצעת מחיר ${esc(quote.quoteNumber)}</title>
<style>
${fontFace}
*{box-sizing:border-box}
body{margin:0;padding:24px;font-family:${opts?.fontUrl ? "'NotoSansHebrew'," : ''}'Heebo','Assistant',Arial,sans-serif;color:#111;background:#fff;font-size:12px;line-height:1.45}
.header{display:flex;justify-content:space-between;gap:16px;border-bottom:2px solid #1e3a5f;padding-bottom:12px;margin-bottom:16px}
.company h1{margin:0 0 6px;font-size:18px;color:#1e3a5f}
.company p{margin:2px 0;color:#333}
.meta{text-align:left;min-width:180px}
.meta .doc-title{font-size:16px;font-weight:700;color:#1e3a5f;margin-bottom:8px}
.meta div{margin:2px 0}
.client{margin-bottom:16px}
.client h2{margin:0 0 6px;font-size:13px;color:#1e3a5f}
table{width:100%;border-collapse:collapse;margin:12px 0 16px}
th,td{border:1px solid #cfd6de;padding:6px 8px;text-align:right;vertical-align:top}
th{background:#f3f6f9;color:#1e3a5f;font-weight:600}
td.desc{width:42%}
.totals{width:320px;margin-right:auto;margin-left:0}
.totals .row{display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #e8ecf0}
.totals .row.strong{font-weight:700;border-bottom:2px solid #1e3a5f;margin-top:4px;padding-top:8px}
.payment{margin-top:18px;border-top:1px solid #cfd6de;padding-top:12px}
.sign{margin-top:28px;display:flex;justify-content:space-between;gap:24px}
.sign .box{flex:1;border-top:1px solid #999;padding-top:6px;min-height:48px}
.footer{margin-top:24px;font-size:10px;color:#777;text-align:center}
@media print{body{padding:12px}}
</style>
</head>
<body>
  <div class="header">
    <div class="company">
      <h1>${esc(company.name)}</h1>
      <p>${esc(company.address)}</p>
      <p>טלפון: ${esc(company.phone)}</p>
      <p>עוסק מורשה ${esc(company.businessId)}</p>
    </div>
    <div class="meta">
      <div class="doc-title">הצעת מחיר</div>
      <div>מספר: ${esc(quote.quoteNumber)}</div>
      <div>תאריך: ${esc(formatDateHe(issuedAt))}</div>
      <div>שעה: ${esc(formatTimeHe(issuedAt))}</div>
      <div>דף 1 מתוך 1</div>
    </div>
  </div>

  <div class="client">
    <h2>לכבוד:</h2>
    <div>${esc(recipientName)}</div>
    ${client.address ? `<div>${esc(client.address)}</div>` : ''}
    ${client.idNumber ? `<div>מ/ת.ז/ע: ${esc(client.idNumber)}</div>` : ''}
    ${client.theirRef ? `<div>מספרכם: ${esc(client.theirRef)}</div>` : ''}
    ${client.phone ? `<div>טלפון: ${esc(client.phone)}</div>` : ''}
    ${quote.eventDate ? `<div>תאריך אירוע: ${esc(formatDateHe(quote.eventDate))}</div>` : ''}
    ${quote.eventLocation ? `<div>מיקום: ${esc(quote.eventLocation)}</div>` : ''}
  </div>

  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>מס' פריט</th>
        <th>תיאור פריט</th>
        <th>כמות</th>
        <th>ש״ח כולל מע״מ</th>
        <th>סה״כ כולל מע״מ</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml || '<tr><td colspan="6">אין שורות</td></tr>'}
    </tbody>
  </table>

  <div class="totals">
    <div class="row"><span>סה״כ כולל מע״מ:</span><span>${money(quote.subtotalInclVat)}</span></div>
    <div class="row"><span>הנחה % ${money(quote.discountPercent)}:</span><span>${money(quote.discountAmount)}</span></div>
    <div class="row strong"><span>סה״כ לתשלום:</span><span>${money(quote.totalInclVat)}</span></div>
  </div>

  <div class="payment">
    <h2 style="margin:0 0 8px;font-size:13px;color:#1e3a5f">פרוט התשלום</h2>
    <div>סה״כ ללא מע״מ: ${money(quote.totalExVat)}</div>
    <div>הנחה: ${money(quote.discountAmount)}</div>
    <div>${money(quote.vatRate)}% מע״מ: ${money(quote.vatAmount)}</div>
    <div style="margin-top:8px">פרטי חשבון בנק להעברה: ${esc(formatBankLine(bank))}</div>
    <div style="margin-top:8px">מפיק המסמך: ${esc(company.producerName || quote.issuedBy || '')}</div>
    ${quote.notes ? `<div style="margin-top:8px">הערות: ${esc(quote.notes)}</div>` : ''}
  </div>

  <div class="sign">
    <div class="box">שם המקבל _____________ חתימה _________ תאריך _________</div>
    <div class="box">${esc(company.name)} _____________</div>
  </div>

  <div class="footer">מסמך זה הופק ממערכת ניהול מגדים</div>
</body>
</html>`;
}
