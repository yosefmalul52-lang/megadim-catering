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
  cartItems: Array<{ name: string; price: number; quantity: number; category?: string }>;
  subtotal?: number;
  deliveryFee?: number;
  totalPrice: number;
  /** Human-readable order number (e.g. MG-123456) shown in email subject and body. */
  orderNumber?: string;
  /**
   * When set, switches customer email to the catering-specific template:
   * no prices, items grouped by category, "representative will call" notice.
   */
  cateringKind?: 'shabbat' | 'events';
  /** Extra labelled rows shown in catering email (e.g. meal type, guest count, event type). */
  cateringExtraInfo?: Array<{ label: string; value: string }>;
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

function toValidMoney(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

const SHABBAT_CATERING_CATEGORIES = ['סלטים', 'מנות ראשונות', 'מנות עיקריות', 'תוספות ערב', 'תוספות בוקר'];
const EVENTS_CATERING_CATEGORIES = [
  'תפריט בסיס',
  'שדרוגים',
  'בר קבלת פנים',
  'סלטים',
  'מנות ראשונות',
  'מנות עיקריות',
  'תוספות',
  'קינוחים'
];

function getCateringCategoryOrder(cateringKind?: 'shabbat' | 'events'): string[] {
  return cateringKind === 'events' ? EVENTS_CATERING_CATEGORIES : SHABBAT_CATERING_CATEGORIES;
}

function buildCateringGroupedItemsHtml(
  cartItems: OrderTemplateData['cartItems'],
  cateringKind?: 'shabbat' | 'events'
): string {
  const byCategory: Record<string, string[]> = {};
  const categoryOrder = getCateringCategoryOrder(cateringKind);

  cartItems.forEach((item) => {
    const cat = item.category || 'בחירות';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(cleanItemName(item.name));
  });

  const sortedCategories = [
    ...categoryOrder.filter((c) => byCategory[c]),
    ...Object.keys(byCategory).filter((c) => !categoryOrder.includes(c))
  ];

  if (sortedCategories.length === 0) return '';

  return (
    '<h3 style="color:' +
    DARK +
    ';border-bottom:2px solid ' +
    GOLD +
    ';padding-bottom:8px;font-size:18px;font-family:' +
    FONT +
    ';margin-top:24px;">פירוט התפריט</h3>' +
    sortedCategories
      .map(
        (cat) =>
          `<div style="margin-bottom:14px;">` +
          `<div style="font-size:14px;font-weight:700;color:${GOLD};background:${DARK};padding:5px 10px;display:inline-block;margin-bottom:6px;">${escapeHtml(cat)}</div>` +
          `<ul style="margin:0;padding:0 16px;list-style:none;">` +
          byCategory[cat]
            .map(
              (name) =>
                `<li style="padding:3px 0;font-size:15px;color:${DARK};font-family:${FONT};">` +
                `<span style="color:${GOLD};margin-left:6px;">✓</span> ${escapeHtml(name)}` +
                `</li>`
            )
            .join('') +
          `</ul></div>`
      )
      .join('')
  );
}

function buildCateringExtraInfoRows(orderData: OrderTemplateData): string {
  return (orderData.cateringExtraInfo || [])
    .filter((row) => row.value && row.value.trim())
    .map(
      (row) =>
        `<tr><td dir="rtl" style="padding:7px 0;width:140px;color:#666;font-family:${FONT};font-size:15px;">${escapeHtml(row.label)}:&rlm;</td>` +
        `<td dir="rtl" style="padding:7px 0;font-weight:bold;color:${DARK};font-family:${FONT};font-size:15px;"><bdi>${escapeHtml(row.value)}</bdi>&rlm;</td></tr>`
    )
    .join('');
}

/**
 * Admin/office template: clean, high-contrast, brand colors.
 */
export function generateAdminEmailHtml(orderData: OrderTemplateData): string {
  if (orderData.cateringKind) {
    return generateCateringAdminEmailHtml(orderData);
  }

  const orderTypeLabel = orderData.orderType === 'delivery' ? 'משלוח' : 'איסוף עצמי';
  const aggregatedItems = aggregateCartItems(orderData.cartItems);
  const subtotal = toValidMoney(orderData.subtotal);
  const deliveryFee = toValidMoney(orderData.deliveryFee);

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
    (orderData.orderNumber ? ` | ${escapeHtml(orderData.orderNumber)}` : '') +
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
    (subtotal !== null
      ? '<p dir="rtl" style="margin:0 0 8px;color:' +
        WHITE +
        ';font-size:16px;font-family:' +
        FONT +
        ';">סכום ביניים: <span style="color:' +
        GOLD +
        ';"><bdi>' +
        subtotal.toFixed(2) +
        ' ש"ח</bdi>&rlm;</span></p>'
      : '') +
    (orderData.orderType === 'delivery' && deliveryFee !== null
      ? '<p dir="rtl" style="margin:0 0 8px;color:' +
        WHITE +
        ';font-size:16px;font-family:' +
        FONT +
        ';">דמי משלוח: <span style="color:' +
        GOLD +
        ';"><bdi>' +
        deliveryFee.toFixed(2) +
        ' ש"ח</bdi>&rlm;</span></p>'
      : '') +
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
  const subtotal = toValidMoney(orderData.subtotal);
  const deliveryFee = toValidMoney(orderData.deliveryFee);

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
    ';">תודה על הזמנתך!' +
    (orderData.orderNumber ? `<br/><span style="font-size:16px;font-weight:normal;">הזמנה מס׳ ${escapeHtml(orderData.orderNumber)}</span>` : '') +
    '</h2>' +
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
    (subtotal !== null || (orderData.orderType === 'delivery' && deliveryFee !== null)
      ? '<div dir="rtl" style="margin:14px 0 0;padding:12px 14px;background:#f7f8f9;border:1px solid #e7e7e7;">' +
        (subtotal !== null
          ? '<p dir="rtl" style="margin:0 0 6px;font-size:15px;color:' +
            DARK +
            ';font-family:' +
            FONT +
            ';">סכום ביניים: <bdi>' +
            subtotal.toFixed(2) +
            ' ש"ח</bdi>&rlm;</p>'
          : '') +
        (orderData.orderType === 'delivery' && deliveryFee !== null
          ? '<p dir="rtl" style="margin:0;font-size:15px;color:' +
            DARK +
            ';font-family:' +
            FONT +
            ';">דמי משלוח: <bdi>' +
            deliveryFee.toFixed(2) +
            ' ש"ח</bdi>&rlm;</p>'
          : '') +
        '</div>'
      : '') +
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

/**
 * Admin catering template — grouped menu details for Shabbat/events forms.
 */
export function generateCateringAdminEmailHtml(orderData: OrderTemplateData): string {
  const isEvents = orderData.cateringKind === 'events';
  const orderTypeLabel = orderData.orderType === 'delivery' ? 'משלוח' : 'איסוף עצמי';
  const itemsSection = buildCateringGroupedItemsHtml(orderData.cartItems, orderData.cateringKind);
  const extraInfoRows = buildCateringExtraInfoRows(orderData);

  const dateRow = orderData.eventDate
    ? `<tr><td dir="rtl" style="padding:7px 0;width:140px;color:#666;font-family:${FONT};font-size:15px;">תאריך האירוע:&rlm;</td>` +
      `<td dir="rtl" style="padding:7px 0;font-weight:bold;color:${DARK};font-family:${FONT};font-size:15px;"><bdi>${escapeHtml(formatToIsraeliDate(orderData.eventDate))}</bdi>&rlm;</td></tr>`
    : '';

  const addressRow =
    orderData.address && orderData.address.trim()
      ? `<tr><td dir="rtl" style="padding:7px 0;color:#666;font-family:${FONT};font-size:15px;">${isEvents && orderData.orderType !== 'delivery' ? 'מיקום' : 'כתובת'}:&rlm;</td>` +
        `<td dir="rtl" style="padding:7px 0;font-weight:bold;color:${DARK};font-family:${FONT};font-size:15px;"><bdi>${escapeHtml(orderData.address)}</bdi>&rlm;</td></tr>`
      : '';

  const notesRow =
    orderData.notes && orderData.notes.trim()
      ? `<div dir="rtl" style="margin-top:16px;padding:12px 14px;background:#fcfaf5;border-right:4px solid ${GOLD};color:${DARK};font-family:${FONT};font-size:14px;"><strong>הערות:</strong> <bdi>${escapeHtml(orderData.notes)}</bdi></div>`
      : '';

  const pricePerPortion = toValidMoney(orderData.subtotal);
  const totalEstimate = toValidMoney(orderData.totalPrice);
  const priceSummary =
    isEvents && (pricePerPortion !== null || totalEstimate !== null)
      ? `<div dir="rtl" style="margin-top:20px;padding:14px 16px;background:${DARK};color:${WHITE};font-family:${FONT};">` +
        (pricePerPortion !== null
          ? `<p style="margin:0 0 6px;font-size:15px;">מחיר למנה (משוער): <span style="color:${GOLD};font-weight:bold;">₪${pricePerPortion.toFixed(0)}</span></p>`
          : '') +
        (totalEstimate !== null
          ? `<p style="margin:0;font-size:17px;font-weight:bold;">סה״כ לתשלום (משוער): <span style="color:${GOLD};">₪${totalEstimate.toFixed(0)}</span></p>`
          : '') +
        `</div>`
      : '';

  return (
    '<!DOCTYPE html><html dir="rtl" lang="he"><head><meta charset="utf-8"></head>' +
    '<body style="margin:0;padding:0;font-family:' +
    FONT +
    ';">' +
    '<div dir="rtl" style="font-family:' +
    FONT +
    ';background-color:#f7f8f9;padding:30px 10px;direction:rtl;text-align:right;">' +
    '<table width="100%" style="max-width:650px;margin:0 auto;background:' +
    WHITE +
    ';overflow:hidden;border:1px solid ' +
    GOLD +
    ';border-collapse:collapse;box-shadow:0 4px 15px rgba(0,0,0,0.05);">' +
    '<tr><td style="background-color:' +
    DARK +
    ';padding:30px;text-align:center;border-bottom:4px solid ' +
    GOLD +
    ';">' +
    '<h2 style="margin:0;color:' +
    GOLD +
    ';font-size:24px;font-weight:bold;font-family:' +
    FONT +
    ';">בקשת קייטרינג חדשה — ' +
    (isEvents ? 'אירועים' : 'שבת וחג') +
    '</h2>' +
    (orderData.orderNumber
      ? `<p style="margin:8px 0 0;color:${WHITE};font-size:14px;font-family:${FONT};">הזמנה מס׳ ${escapeHtml(orderData.orderNumber)} · ${orderTypeLabel}</p>`
      : `<p style="margin:8px 0 0;color:${WHITE};font-size:14px;font-family:${FONT};">${orderTypeLabel}</p>`) +
    '</td></tr>' +
    '<tr><td style="padding:30px;">' +
    '<h3 style="color:' +
    DARK +
    ';border-bottom:2px solid ' +
    GOLD +
    ';padding-bottom:8px;font-size:18px;font-family:' +
    FONT +
    ';margin-top:0;">פרטי הלקוח</h3>' +
    '<table width="100%" style="border-collapse:collapse;font-size:15px;">' +
    `<tr><td dir="rtl" style="padding:7px 0;width:140px;color:#666;font-family:${FONT};">שם:&rlm;</td><td dir="rtl" style="padding:7px 0;font-weight:bold;color:${DARK};font-family:${FONT};"><bdi>${escapeHtml(orderData.customerName)}</bdi>&rlm;</td></tr>` +
    `<tr><td dir="rtl" style="padding:7px 0;color:#666;font-family:${FONT};">טלפון:&rlm;</td><td dir="rtl" style="padding:7px 0;font-weight:bold;color:${DARK};font-family:${FONT};"><bdi>${escapeHtml(orderData.customerPhone)}</bdi>&rlm;</td></tr>` +
    dateRow +
    extraInfoRows +
    addressRow +
    '</table>' +
    notesRow +
    itemsSection +
    priceSummary +
    '</td></tr>' +
    '</table></div></body></html>'
  );
}

/**
 * Catering-specific customer email.
 * Shows items grouped by category without prices, plus a prominent
 * "a representative will contact you" notice.
 */
export function generateCateringCustomerEmailHtml(orderData: OrderTemplateData): string {
  const isEvents = orderData.cateringKind === 'events';
  const itemsSection = buildCateringGroupedItemsHtml(orderData.cartItems, orderData.cateringKind);
  const extraInfoRows = buildCateringExtraInfoRows(orderData);

  const dateRow = orderData.eventDate
    ? `<tr><td dir="rtl" style="padding:7px 0;width:140px;color:#666;font-family:${FONT};font-size:15px;">תאריך האירוע:&rlm;</td>` +
      `<td dir="rtl" style="padding:7px 0;font-weight:bold;color:${DARK};font-family:${FONT};font-size:15px;"><bdi>${escapeHtml(formatToIsraeliDate(orderData.eventDate))}</bdi>&rlm;</td></tr>`
    : '';

  const venueRow = orderData.address
    ? `<tr><td dir="rtl" style="padding:7px 0;color:#666;font-family:${FONT};font-size:15px;">${isEvents ? 'מיקום' : 'כתובת'}:&rlm;</td>` +
      `<td dir="rtl" style="padding:7px 0;font-weight:bold;color:${DARK};font-family:${FONT};font-size:15px;"><bdi>${escapeHtml(orderData.address)}</bdi>&rlm;</td></tr>`
    : '';

  const notesRow = orderData.notes && orderData.notes.trim()
    ? `<div dir="rtl" style="margin-top:16px;padding:12px 14px;background:#fcfaf5;border-right:4px solid ${GOLD};color:${DARK};font-family:${FONT};font-size:14px;"><strong>הערות:</strong> <bdi>${escapeHtml(orderData.notes)}</bdi></div>`
    : '';

  const headerTitle = isEvents
    ? 'קיבלנו את בקשתך לקייטרינג לאירוע!'
    : 'קיבלנו את בקשתך לקייטרינג שבת וחג!';

  const pricePerPortion = toValidMoney(orderData.subtotal);
  const totalEstimate = toValidMoney(orderData.totalPrice);
  const priceSummary =
    isEvents && (pricePerPortion !== null || totalEstimate !== null)
      ? `<div dir="rtl" style="margin-top:20px;padding:14px 16px;background:#f7f3ea;border:1px solid ${GOLD};font-family:${FONT};">` +
        (pricePerPortion !== null
          ? `<p style="margin:0 0 6px;font-size:15px;color:${DARK};">מחיר למנה (משוער): <strong>₪${pricePerPortion.toFixed(0)}</strong></p>`
          : '') +
        (totalEstimate !== null
          ? `<p style="margin:0;font-size:16px;color:${DARK};">סה״כ לתשלום (משוער): <strong style="color:${DARK};">₪${totalEstimate.toFixed(0)}</strong></p>`
          : '') +
        `<p style="margin:10px 0 0;font-size:13px;color:#666;">המחיר הסופי יאושר על ידי נציג מטעמנו.</p>` +
        `</div>`
      : '';

  return (
    '<!DOCTYPE html><html dir="rtl" lang="he"><head><meta charset="utf-8"></head>' +
    '<body style="margin:0;padding:0;font-family:' + FONT + ';">' +
    '<div dir="rtl" style="font-family:' + FONT + ';background-color:#f7f8f9;padding:30px 10px;direction:rtl;text-align:right;">' +
    '<table width="100%" style="max-width:650px;margin:0 auto;background:' + WHITE + ';overflow:hidden;border:1px solid ' + GOLD + ';border-collapse:collapse;box-shadow:0 4px 15px rgba(0,0,0,0.05);">' +

    // Header
    '<tr><td style="background-color:' + DARK + ';padding:30px;text-align:center;border-bottom:4px solid ' + GOLD + ';">' +
    '<h2 style="margin:0;color:' + GOLD + ';font-size:24px;font-weight:bold;font-family:' + FONT + ';">' + headerTitle + '</h2>' +
    (orderData.orderNumber ? `<p style="margin:8px 0 0;color:${WHITE};font-size:14px;font-family:${FONT};">הזמנה מס׳ ${escapeHtml(orderData.orderNumber)}</p>` : '') +
    '</td></tr>' +

    // Greeting + representative notice
    '<tr><td style="padding:30px 30px 0;">' +
    '<p dir="rtl" style="font-size:16px;line-height:1.6;margin:0 0 16px;color:' + DARK + ';font-family:' + FONT + ';">' +
    'שלום <bdi>' + escapeHtml(orderData.customerName) + '</bdi>&rlm;, קיבלנו את פרטי ההזמנה שלך.' +
    '</p>' +
    '<div dir="rtl" style="background:#f0f7f0;border-right:4px solid #2e7d32;padding:14px 16px;margin-bottom:20px;">' +
    '<p style="margin:0;font-size:16px;font-weight:bold;color:#1b5e20;font-family:' + FONT + ';">&#x23F0; נציג מטעמנו יחזור אליך בהקדם להשלמת ההזמנה ואישורה.</p>' +
    '</div>' +

    // Event details
    '<h3 style="color:' + DARK + ';border-bottom:2px solid ' + GOLD + ';padding-bottom:8px;font-size:18px;font-family:' + FONT + ';margin-top:4px;">פרטי האירוע</h3>' +
    '<table width="100%" style="border-collapse:collapse;font-size:15px;">' +
    dateRow +
    extraInfoRows +
    venueRow +
    '</table>' +
    notesRow +

    // Menu selections
    itemsSection +
    priceSummary +

    '</td></tr>' +

    // Footer
    '<tr><td style="padding:20px 30px;background-color:' + DARK + ';text-align:center;">' +
    '<p style="margin:0;font-size:14px;line-height:1.6;color:' + WHITE + ';font-family:' + FONT + ';">לכל שאלה, ניתן להשיב למייל זה.</p>' +
    '</td></tr>' +

    '</table></div></body></html>'
  );
}
