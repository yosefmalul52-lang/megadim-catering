/**
 * RTL HTML email templates for order system.
 * All styles are inline for email-client compatibility.
 * Brand: Dark Slate #1f3540, Gold #e0c075, White #ffffff.
 */

export interface OrderTemplateData {
  customerName: string;
  customerPhone: string;
  orderType: 'pickup' | 'delivery';
  eventDate?: string;
  address?: string;
  notes?: string;
  cartItems: Array<{ name: string; price: number; quantity: number }>;
  totalPrice: number;
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Format a date string as DD-MM-YYYY (e.g. 25-02-2026). Returns 'לא צוין' if missing/invalid.
 */
function formatToIsraeliDate(dateString: string | undefined): string {
  if (!dateString) return 'לא צוין';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return dateString;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

/**
 * Removes trailing " - N)" from item names (e.g. "סלט טחינה (250 מ"ל - 250)" → "סלט טחינה (250 מ"ל)").
 */
function cleanItemName(name: string): string {
  if (!name) return '';
  return name.replace(/\s*-\s*\d+\s*\)/g, ')');
}

/**
 * Aggregates cart items by cleaned name: sums quantities, keeps unit price, one row per unique item.
 */
function aggregateCartItems(
  items: Array<{ name: string; price: number; quantity: number }>
): Array<{ name: string; price: number; quantity: number }> {
  if (!items || !Array.isArray(items)) return [];

  const grouped: Record<string, { name: string; price: number; quantity: number }> = {};
  items.forEach((item) => {
    const cleanName = cleanItemName(item.name);

    if (grouped[cleanName]) {
      grouped[cleanName].quantity += item.quantity;
    } else {
      grouped[cleanName] = { ...item, name: cleanName };
    }
  });

  return Object.values(grouped);
}

const FONT = 'Arial, Helvetica, sans-serif';
const DARK = '#1f3540';
const GOLD = '#e0c075';
const WHITE = '#ffffff';

/**
 * Admin/office template: clean, high-contrast, brand colors.
 */
export function generateAdminEmailHtml(orderData: OrderTemplateData): string {
  const orderTypeLabel = orderData.orderType === 'delivery' ? 'משלוח' : 'איסוף עצמי';
  const aggregatedItems = aggregateCartItems(orderData.cartItems);

  const cartRows = aggregatedItems
    .map(
      (item) =>
        '<tr>' +
        `<td dir="rtl" style="padding:15px 12px;border-bottom:1px solid #eee;color:#1f3540;font-weight:bold;font-family:${FONT};font-size:16px;text-align:right;"><bdi>${escapeHtml(item.name)}</bdi>&rlm;</td>` +
        `<td dir="rtl" style="padding:15px 12px;text-align:center;border-bottom:1px solid #eee;color:#1f3540;font-family:${FONT};font-size:16px;">${item.quantity}</td>` +
        `<td dir="rtl" style="padding:15px 12px;text-align:center;border-bottom:1px solid #eee;color:#1f3540;font-family:${FONT};font-size:16px;"><bdi>${item.price.toFixed(2)} ש"ח</bdi>&rlm;</td>` +
        `<td dir="rtl" style="padding:15px 12px;text-align:left;border-bottom:1px solid #eee;color:#1f3540;font-family:${FONT};font-size:16px;"><bdi>${(item.price * item.quantity).toFixed(2)} ש"ח</bdi>&rlm;</td>` +
        '</tr>'
    )
    .join('');

  const notesBlock =
    orderData.notes && orderData.notes.trim() !== ''
      ? `<div dir="rtl" style="margin-top:20px;padding:15px;background-color:#fcfaf5;border-right:4px solid ${GOLD};color:${DARK};border-radius:4px;font-family:${FONT};font-size:16px;text-align:right;"><strong style="color:${DARK};">הערות:&rlm;</strong> <bdi>${escapeHtml(orderData.notes)}</bdi>&rlm;</div>`
      : '';

  const addressRow =
    orderData.address && orderData.orderType === 'delivery'
      ? `<tr><td dir="rtl" style="padding:8px 0;width:130px;color:#666;font-family:${FONT};font-size:16px;">כתובת:&rlm;</td><td dir="rtl" style="padding:8px 0;font-weight:bold;color:${DARK};font-family:${FONT};font-size:16px;"><bdi>${escapeHtml(orderData.address)}</bdi>&rlm;</td></tr>`
      : '';

  return (
    '<!DOCTYPE html>' +
    '<html dir="rtl" lang="he">' +
    '<head><meta charset="utf-8"></head>' +
    '<body style="margin:0;padding:0;font-family:' +
    FONT +
    ';">' +
    '<div dir="rtl" style="font-family:' +
    FONT +
    ';background-color:#f7f8f9;padding:30px 10px;direction:rtl;text-align:right;">' +
    '<table width="100%" style="max-width:650px;margin:0 auto;background:' +
    WHITE +
    ';border-radius:12px;overflow:hidden;border:1px solid ' +
    GOLD +
    ';border-collapse:collapse;box-shadow:0 4px 15px rgba(0,0,0,0.05);">' +
    '<tr>' +
    '<td style="background-color:' +
    DARK +
    ';padding:30px;text-align:center;border-bottom:4px solid ' +
    GOLD +
    ';">' +
    '<h2 style="margin:0;color:' +
    GOLD +
    ';font-size:26px;font-weight:bold;font-family:' +
    FONT +
    ';">הזמנה חדשה - ' +
    orderTypeLabel +
    '</h2>' +
    '</td>' +
    '</tr>' +
    '<tr>' +
    '<td style="padding:30px;">' +
    '<h3 style="color:' +
    DARK +
    ';border-bottom:2px solid ' +
    GOLD +
    ';padding-bottom:8px;margin-top:0;font-size:20px;font-family:' +
    FONT +
    ';">פרטי הלקוח</h3>' +
    '<table width="100%" style="border-collapse:collapse;font-size:16px;margin-top:15px;">' +
    `<tr><td dir="rtl" style="padding:8px 0;width:130px;color:#666;font-family:${FONT};">שם:&rlm;</td><td dir="rtl" style="padding:8px 0;font-weight:bold;color:${DARK};font-family:${FONT};"><bdi>${escapeHtml(orderData.customerName)}</bdi>&rlm;</td></tr>` +
    `<tr><td dir="rtl" style="padding:8px 0;color:#666;font-family:${FONT};">טלפון:&rlm;</td><td dir="rtl" style="padding:8px 0;font-weight:bold;color:${DARK};font-family:${FONT};"><bdi>${escapeHtml(orderData.customerPhone)}</bdi>&rlm;</td></tr>` +
    `<tr><td dir="rtl" style="padding:8px 0;color:#666;font-family:${FONT};">תאריך הספקה:&rlm;</td><td dir="rtl" style="padding:8px 0;font-weight:bold;color:${DARK};font-family:${FONT};"><bdi>${escapeHtml(formatToIsraeliDate(orderData.eventDate))}</bdi>&rlm;</td></tr>` +
    addressRow +
    '</table>' +
    notesBlock +
    '</td>' +
    '</tr>' +
    '<tr>' +
    '<td style="padding:0 30px 30px 30px;">' +
    '<h3 style="color:' +
    DARK +
    ';border-bottom:2px solid ' +
    GOLD +
    ';padding-bottom:8px;font-size:20px;font-family:' +
    FONT +
    ';">פירוט ההזמנה</h3>' +
    '<table width="100%" style="border-collapse:collapse;font-size:16px;margin-top:15px;">' +
    '<tr style="background-color:#1f3540;color:#ffffff;">' +
    '<th style="padding:12px;text-align:right;border-radius:0 4px 0 0;font-family:' +
    FONT +
    ';">תיאור</th>' +
    '<th style="padding:12px;text-align:center;font-family:' +
    FONT +
    ';">כמות</th>' +
    '<th style="padding:12px;text-align:center;font-family:' +
    FONT +
    ';">מחיר (ליחי\')</th>' +
    '<th style="padding:12px;text-align:left;border-radius:4px 0 0 0;font-family:' +
    FONT +
    ';">סה"כ</th>' +
    '</tr>' +
    cartRows +
    '</table>' +
    '</td>' +
    '</tr>' +
    '<tr>' +
    '<td dir="rtl" style="padding:25px 30px;background-color:' +
    DARK +
    ';text-align:left;border-radius:0 0 10px 10px;">' +
    '<h2 dir="rtl" style="margin:0;color:' +
    WHITE +
    ';font-size:24px;font-family:' +
    FONT +
    ';">סה"כ לתשלום: <span style="color:' +
    GOLD +
    ';"><bdi>' +
    orderData.totalPrice.toFixed(2) +
    ' ש"ח</bdi>&rlm;</span></h2>' +
    '</td>' +
    '</tr>' +
    '</table>' +
    '</div>' +
    '</body></html>'
  );
}

/**
 * Customer template: same brand styling, polite receipt.
 */
export function generateCustomerEmailHtml(orderData: OrderTemplateData): string {
  const orderTypeLabel = orderData.orderType === 'delivery' ? 'משלוח' : 'איסוף עצמי';
  const aggregatedItems = aggregateCartItems(orderData.cartItems);

  const cartRows = aggregatedItems
    .map(
      (item) =>
        '<tr>' +
        `<td dir="rtl" style="padding:15px 12px;border-bottom:1px solid #eee;color:#1f3540;font-weight:bold;font-family:${FONT};font-size:16px;text-align:right;"><bdi>${escapeHtml(item.name)}</bdi>&rlm;</td>` +
        `<td dir="rtl" style="padding:15px 12px;text-align:center;border-bottom:1px solid #eee;color:#1f3540;font-family:${FONT};font-size:16px;">${item.quantity}</td>` +
        `<td dir="rtl" style="padding:15px 12px;text-align:center;border-bottom:1px solid #eee;color:#1f3540;font-family:${FONT};font-size:16px;"><bdi>${item.price.toFixed(2)} ש"ח</bdi>&rlm;</td>` +
        `<td dir="rtl" style="padding:15px 12px;text-align:left;border-bottom:1px solid #eee;color:#1f3540;font-family:${FONT};font-size:16px;"><bdi>${(item.price * item.quantity).toFixed(2)} ש"ח</bdi>&rlm;</td>` +
        '</tr>'
    )
    .join('');

  const deliveryBlock =
    orderData.orderType === 'delivery' && orderData.address
      ? `<p dir="rtl" style="margin:8px 0;font-size:16px;color:${DARK};font-family:${FONT};"><strong>כתובת משלוח:&rlm;</strong> <bdi>${escapeHtml(orderData.address)}</bdi>&rlm;</p>`
      : '';
  const dateBlock = orderData.eventDate
    ? `<p dir="rtl" style="margin:8px 0;font-size:16px;color:${DARK};font-family:${FONT};"><strong>תאריך הספקה:&rlm;</strong> <bdi>${escapeHtml(formatToIsraeliDate(orderData.eventDate))}</bdi>&rlm;</p>`
    : '';

  return (
    '<!DOCTYPE html>' +
    '<html dir="rtl" lang="he">' +
    '<head><meta charset="utf-8"></head>' +
    '<body style="margin:0;padding:0;font-family:' +
    FONT +
    ';">' +
    '<div dir="rtl" style="font-family:' +
    FONT +
    ';background-color:#f7f8f9;padding:30px 10px;direction:rtl;text-align:right;">' +
    '<table width="100%" style="max-width:650px;margin:0 auto;background:' +
    WHITE +
    ';border-radius:12px;overflow:hidden;border:1px solid ' +
    GOLD +
    ';border-collapse:collapse;box-shadow:0 4px 15px rgba(0,0,0,0.05);">' +
    '<tr>' +
    '<td style="background-color:' +
    DARK +
    ';padding:30px;text-align:center;border-bottom:4px solid ' +
    GOLD +
    ';">' +
    '<h2 style="margin:0;color:' +
    GOLD +
    ';font-size:26px;font-weight:bold;font-family:' +
    FONT +
    ';">תודה על הזמנתך!</h2>' +
    '</td>' +
    '</tr>' +
    '<tr>' +
    '<td style="padding:30px;">' +
    '<p dir="rtl" style="font-size:16px;line-height:1.6;margin:0 0 20px;color:' +
    DARK +
    ';font-family:' +
    FONT +
    ';">שלום <bdi>' +
    escapeHtml(orderData.customerName) +
    '</bdi>&rlm;, קיבלנו את הזמנתך בהצלחה. להלן פרטי ההזמנה:</p>' +
    '<h3 style="color:' +
    DARK +
    ';border-bottom:2px solid ' +
    GOLD +
    ';padding-bottom:8px;font-size:20px;font-family:' +
    FONT +
    ';">פירוט ההזמנה</h3>' +
    '<table width="100%" style="border-collapse:collapse;font-size:16px;margin-top:15px;">' +
    '<tr style="background-color:#1f3540;color:#ffffff;">' +
    '<th style="padding:12px;text-align:right;border-radius:0 4px 0 0;font-family:' +
    FONT +
    ';">תיאור</th>' +
    '<th style="padding:12px;text-align:center;font-family:' +
    FONT +
    ';">כמות</th>' +
    '<th style="padding:12px;text-align:center;font-family:' +
    FONT +
    ';">מחיר (ליחי\')</th>' +
    '<th style="padding:12px;text-align:left;border-radius:4px 0 0 0;font-family:' +
    FONT +
    ';">סה"כ</th>' +
    '</tr>' +
    cartRows +
    '</table>' +
    '<p dir="rtl" style="margin:16px 0 0;font-size:18px;font-weight:bold;color:' +
    DARK +
    ';text-align:right;font-family:' +
    FONT +
    ';">סה"כ לתשלום: <span style="color:' +
    GOLD +
    ';"><bdi>' +
    orderData.totalPrice.toFixed(2) +
    ' ש"ח</bdi>&rlm;</span></p>' +
    '</td>' +
    '</tr>' +
    '<tr>' +
    '<td dir="rtl" style="padding:20px 30px;border-top:1px solid #eee;">' +
    '<h3 style="color:' +
    DARK +
    ';border-bottom:2px solid ' +
    GOLD +
    ';padding-bottom:8px;font-size:18px;font-family:' +
    FONT +
    ';">פרטי מסירה</h3>' +
    '<p dir="rtl" style="margin:8px 0;font-size:16px;color:' +
    DARK +
    ';font-family:' +
    FONT +
    ';"><strong>סוג:&rlm;</strong> ' +
    orderTypeLabel +
    '</p>' +
    deliveryBlock +
    dateBlock +
    '</td>' +
    '</tr>' +
    '<tr>' +
    '<td style="padding:25px 30px;background-color:' +
    DARK +
    ';text-align:center;border-radius:0 0 10px 10px;">' +
    '<p style="margin:0;font-size:15px;line-height:1.6;color:' +
    WHITE +
    ';font-family:' +
    FONT +
    ';">לכל שאלה, ניתן להשיב למייל זה. בתיאבון!</p>' +
    '</td>' +
    '</tr>' +
    '</table>' +
    '</div>' +
    '</body></html>'
  );
}
