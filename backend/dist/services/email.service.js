"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.emailService = exports.EmailService = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
const email_templates_1 = require("./email-templates");
/** Single source of truth: EMAIL_HOST, EMAIL_PORT (default 587), EMAIL_USER, EMAIL_PASS */
const EMAIL_USER = (process.env.EMAIL_USER || '').trim();
const EMAIL_PASS = process.env.EMAIL_PASS;
function createTransporter() {
    return nodemailer_1.default.createTransport({
        host: process.env.EMAIL_HOST || 'smtp.gmail.com',
        port: Number(process.env.EMAIL_PORT) || 587,
        secure: false, // Must be false for port 587
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });
}
function escapeHtml(s) {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
class EmailService {
    constructor() {
        this.transporter = createTransporter();
    }
    /**
     * Verify SMTP connection. Logs result to console.
     * @throws Error if connection fails
     */
    verifyConnection() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.transporter.verify();
            console.log('✅ SMTP connection ready – server can send order emails');
        });
    }
    /**
     * Send two separate emails: (1) order details to business owner, (2) receipt to customer if provided.
     * Uses EMAIL_USER to authenticate; from/replyTo use BUSINESS_NAME and OWNER_EMAIL.
     */
    sendOrderEmails(orderData, _adminEmail, customerEmail) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!EMAIL_USER || !EMAIL_PASS) {
                throw new Error('Email service is not configured (EMAIL_USER or EMAIL_PASS missing)');
            }
            const senderEmail = process.env.EMAIL_USER;
            const ownerEmail = (process.env.OWNER_EMAIL || '').trim();
            const businessName = process.env.BUSINESS_NAME || 'קייטרינג מגדים';
            if (!ownerEmail) {
                throw new Error('OWNER_EMAIL is not configured');
            }
            const templateData = {
                customerName: orderData.customerName,
                customerPhone: orderData.phone,
                orderType: orderData.deliveryType,
                eventDate: orderData.eventDate,
                address: orderData.address,
                notes: orderData.notes,
                cartItems: orderData.items.map((item) => ({
                    name: item.name,
                    price: item.price,
                    quantity: item.quantity
                })),
                totalPrice: orderData.total
            };
            const ownerHtml = (0, email_templates_1.generateAdminEmailHtml)(templateData);
            const customerHtml = (0, email_templates_1.generateCustomerEmailHtml)(templateData);
            // 1. Send Order Details to the Business Owner (Office)
            try {
                yield this.transporter.sendMail({
                    from: `"${businessName} - אתר" <${senderEmail}>`,
                    to: ownerEmail,
                    subject: `הזמנה חדשה התקבלה 🍽️ - ${businessName}`,
                    html: ownerHtml
                });
            }
            catch (err) {
                console.error('Order email: failed to send to business owner (OWNER_EMAIL):', (err === null || err === void 0 ? void 0 : err.message) || err);
                throw err;
            }
            // 2. Send Receipt to the Customer (if customerEmail provided from frontend)
            const customerEmailTrimmed = typeof customerEmail === 'string' ? customerEmail.trim() : '';
            if (customerEmailTrimmed) {
                try {
                    yield this.transporter.sendMail({
                        from: `"${businessName}" <${senderEmail}>`,
                        replyTo: ownerEmail,
                        to: customerEmailTrimmed,
                        subject: `אישור הזמנה - ${businessName}`,
                        html: customerHtml
                    });
                }
                catch (err) {
                    console.error('Order email: failed to send receipt to customer:', (err === null || err === void 0 ? void 0 : err.message) || err);
                    throw err;
                }
            }
        });
    }
    /**
     * Send order confirmation email to the business owner (legacy: used by order.service after DB save).
     * Agency model: sends via EMAIL_USER, appears from BUSINESS_NAME, to OWNER_EMAIL (client).
     */
    sendOrderEmail(order) {
        return __awaiter(this, void 0, void 0, function* () {
            var _j, _k, _q, _z, _2, _3, _4, _6;
            try {
                const businessName = process.env.BUSINESS_NAME || 'קייטרינג מגדים';
                const senderEmail = process.env.EMAIL_USER;
                const clientEmail = process.env.OWNER_EMAIL || EMAIL_USER || 'owner@megadim.com';
                const itemsList = order.items
                    .map((item, index) => `${index + 1}. ${item.name}\n   כמות: ${item.quantity}\n   מחיר ליחידה: ₪${item.price}\n   סה"כ: ₪${(item.price * item.quantity).toFixed(2)}`)
                    .join('\n');
                const customerInfo = `
שם: ${((_j = order.customerDetails) === null || _j === void 0 ? void 0 : _j.fullName) || 'לא צוין'}
טלפון: ${((_k = order.customerDetails) === null || _k === void 0 ? void 0 : _k.phone) || 'לא צוין'}
אימייל: ${((_q = order.customerDetails) === null || _q === void 0 ? void 0 : _q.email) || 'לא צוין'}
כתובת: ${((_z = order.customerDetails) === null || _z === void 0 ? void 0 : _z.address) || 'לא צוין'}
הערות: ${((_2 = order.customerDetails) === null || _2 === void 0 ? void 0 : _2.notes) || 'אין הערות'}
      `.trim();
                yield this.transporter.sendMail({
                    from: `"${businessName} - אתר" <${senderEmail}>`,
                    to: clientEmail,
                    subject: `הזמנה חדשה #${((_3 = order._id) === null || _3 === void 0 ? void 0 : _3.toString().substring(0, 8)) || 'N/A'} - ${businessName}`,
                    html: `
          <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
            <h2 style="color: #0E1A24; text-align: center;">הזמנה חדשה התקבלה</h2>
            <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <h3 style="color: #cbb69e; border-bottom: 2px solid #cbb69e; padding-bottom: 10px;">פרטי ההזמנה</h3>
              <p><strong>מספר הזמנה:</strong> ${((_4 = order._id) === null || _4 === void 0 ? void 0 : _4.toString()) || 'N/A'}</p>
              <p><strong>תאריך:</strong> ${new Date(order.createdAt || Date.now()).toLocaleString('he-IL')}</p>
              <p><strong>סטטוס:</strong> ${order.status}</p>
              <p><strong>סה"כ לתשלום:</strong> <span style="font-size: 1.2em; color: #cbb69e; font-weight: bold;">₪${order.totalPrice.toFixed(2)}</span></p>
            </div>
            <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <h3 style="color: #cbb69e; border-bottom: 2px solid #cbb69e; padding-bottom: 10px;">פרטי הלקוח</h3>
              <pre style="white-space: pre-wrap; font-family: Arial, sans-serif; line-height: 1.6;">${customerInfo}</pre>
            </div>
            <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <h3 style="color: #cbb69e; border-bottom: 2px solid #cbb69e; padding-bottom: 10px;">פריטי ההזמנה</h3>
              <pre style="white-space: pre-wrap; font-family: Arial, sans-serif; line-height: 1.6;">${itemsList}</pre>
            </div>
          </div>
        `,
                    text: `הזמנה חדשה התקבלה\n\nמספר הזמנה: ${((_6 = order._id) === null || _6 === void 0 ? void 0 : _6.toString()) || 'N/A'}\nתאריך: ${new Date(order.createdAt || Date.now()).toLocaleString('he-IL')}\nסטטוס: ${order.status}\nסה"כ: ₪${order.totalPrice.toFixed(2)}\n\nפרטי הלקוח:\n${customerInfo}\n\nפריטי ההזמנה:\n${itemsList}`
                });
                console.log('✅ Order confirmation email sent:', order._id);
            }
            catch (error) {
                console.error('❌ Error sending order email:', (error === null || error === void 0 ? void 0 : error.message) || error);
                console.error('❌ Email error details:', { message: error === null || error === void 0 ? void 0 : error.message, code: error === null || error === void 0 ? void 0 : error.code, response: error === null || error === void 0 ? void 0 : error.response });
            }
        });
    }
    /**
     * Send "order approved and being prepared" email to the customer (when admin sets status to 'processing').
     * Gold brand theme. No-op if customer has no email.
     */
    sendOrderApprovedToCustomer(order) {
        return __awaiter(this, void 0, void 0, function* () {
            var _j, _k, _q, _z;
            const toEmail = (((_j = order.customerDetails) === null || _j === void 0 ? void 0 : _j.email) || '').toString().trim();
            if (!toEmail) {
                console.warn('⚠️ Order approved but customer has no email – skipping approval email');
                return;
            }
            if (!EMAIL_USER || !EMAIL_PASS) {
                console.warn('⚠️ Email not configured – skipping approval email to customer');
                return;
            }
            const businessName = process.env.BUSINESS_NAME || 'קייטרינג מגדים';
            const senderEmail = process.env.EMAIL_USER;
            const ownerEmail = (process.env.OWNER_EMAIL || '').trim();
            const customerName = ((_k = order.customerDetails) === null || _k === void 0 ? void 0 : _k.fullName) || 'לקוח/ה';
            const orderIdShort = ((_q = order._id) === null || _q === void 0 ? void 0 : _q.toString().slice(-8)) || '';
            const itemsList = (order.items || [])
                .map((item, i) => `${i + 1}. ${item.name} – כמות: ${item.quantity}, סה"כ: ₪${((item.price || 0) * (item.quantity || 0)).toFixed(2)}`)
                .join('<br/>');
            const html = `
      <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: linear-gradient(180deg, #fefaf2 0%, #f7ecd3 100%); border: 1px solid #e2cfa4;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #0E1A24; margin: 0 0 8px;">הזמנתך אושרה!</h1>
          <p style="color: #1f3540; font-size: 1.1em; margin: 0;">קייטרינג מגדים</p>
          <div style="height: 3px; background: linear-gradient(90deg, transparent, #e0c075, transparent); margin: 16px auto; max-width: 200px;"></div>
        </div>
        <p style="color: #333; font-size: 1.05em; line-height: 1.6;">שלום ${escapeHtml(customerName)},</p>
        <p style="color: #333; font-size: 1.05em; line-height: 1.6;"><strong>הזמנתך מקייטרינג מגדים אושרה!</strong> השפים שלנו כבר התחילו בהכנות.</p>
        <div style="background: #fff; padding: 20px; border-radius: 12px; margin: 20px 0; border: 1px solid rgba(224, 192, 117, 0.4); box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
          <h3 style="color: #0E1A24; border-bottom: 2px solid #e0c075; padding-bottom: 10px; margin: 0 0 16px;">פרטי ההזמנה</h3>
          <p style="margin: 0 0 8px;"><strong>מספר הזמנה:</strong> #${orderIdShort}</p>
          <p style="margin: 0 0 8px;"><strong>סה"כ:</strong> <span style="color: #e0c075; font-weight: bold;">₪${((_z = order.totalPrice) !== null && _z !== void 0 ? _z : 0).toFixed(2)}</span></p>
          <p style="margin: 0 0 8px;"><strong>פריטים:</strong></p>
          <div style="color: #555; font-size: 0.95em;">${itemsList}</div>
        </div>
        <p style="color: #666; font-size: 0.95em;">נעדכן כשההזמנה תהיה מוכנה. לכל שאלה – צרו איתנו קשר.</p>
        <p style="color: #0E1A24; font-weight: 600;">בתיאבון,<br/>צוות מגדים</p>
      </div>`;
            try {
                yield this.transporter.sendMail({
                    from: `"${businessName}" <${senderEmail}>`,
                    replyTo: ownerEmail || undefined,
                    to: toEmail,
                    subject: `הזמנתך אושרה – ${businessName}`,
                    html
                });
                console.log('✅ Order approved email sent to customer:', toEmail);
            }
            catch (err) {
                console.error('❌ Failed to send order approved email to customer:', (err === null || err === void 0 ? void 0 : err.message) || err);
                throw err;
            }
        });
    }
}
exports.EmailService = EmailService;
/** Singleton for use in controllers and server startup. */
exports.emailService = new EmailService();
