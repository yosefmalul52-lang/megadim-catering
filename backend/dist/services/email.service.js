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
exports.EmailService = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
class EmailService {
    constructor() {
        // Configure email transporter
        // For production, use environment variables for SMTP settings
        this.transporter = nodemailer_1.default.createTransport({
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: parseInt(process.env.SMTP_PORT || '587'),
            secure: false, // true for 465, false for other ports
            auth: {
                user: process.env.SMTP_USER || process.env.EMAIL_USER,
                pass: process.env.SMTP_PASS || process.env.EMAIL_PASSWORD
            }
        });
    }
    /**
     * Send order confirmation email to the business owner
     * @param order - The saved order object
     */
    sendOrderEmail(order) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g, _h;
            try {
                const ownerEmail = process.env.OWNER_EMAIL || process.env.EMAIL_USER || 'owner@megadim.com';
                // Format order items for email
                const itemsList = order.items.map((item, index) => {
                    return `
          ${index + 1}. ${item.name}
             כמות: ${item.quantity}
             מחיר ליחידה: ₪${item.price}
             סה"כ: ₪${(item.price * item.quantity).toFixed(2)}
        `;
                }).join('\n');
                // Format customer details
                const customerInfo = `
        שם: ${((_a = order.customerDetails) === null || _a === void 0 ? void 0 : _a.fullName) || 'לא צוין'}
        טלפון: ${((_b = order.customerDetails) === null || _b === void 0 ? void 0 : _b.phone) || 'לא צוין'}
        אימייל: ${((_c = order.customerDetails) === null || _c === void 0 ? void 0 : _c.email) || 'לא צוין'}
        כתובת: ${((_d = order.customerDetails) === null || _d === void 0 ? void 0 : _d.address) || 'לא צוין'}
        הערות: ${((_e = order.customerDetails) === null || _e === void 0 ? void 0 : _e.notes) || 'אין הערות'}
      `;
                const mailOptions = {
                    from: `"מגדים קייטרינג" <${process.env.SMTP_USER || process.env.EMAIL_USER}>`,
                    to: ownerEmail,
                    subject: `הזמנה חדשה #${((_f = order._id) === null || _f === void 0 ? void 0 : _f.toString().substring(0, 8)) || 'N/A'}`,
                    html: `
          <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
            <h2 style="color: #0E1A24; text-align: center;">הזמנה חדשה התקבלה</h2>
            
            <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <h3 style="color: #cbb69e; border-bottom: 2px solid #cbb69e; padding-bottom: 10px;">פרטי ההזמנה</h3>
              <p><strong>מספר הזמנה:</strong> ${((_g = order._id) === null || _g === void 0 ? void 0 : _g.toString()) || 'N/A'}</p>
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

            <div style="text-align: center; margin-top: 30px; color: #6c757d; font-size: 0.9em;">
              <p>זהו אימייל אוטומטי ממערכת הזמנות מגדים קייטרינג</p>
            </div>
          </div>
        `,
                    text: `
הזמנה חדשה התקבלה

מספר הזמנה: ${((_h = order._id) === null || _h === void 0 ? void 0 : _h.toString()) || 'N/A'}
תאריך: ${new Date(order.createdAt || Date.now()).toLocaleString('he-IL')}
סטטוס: ${order.status}
סה"כ לתשלום: ₪${order.totalPrice.toFixed(2)}

פרטי הלקוח:
${customerInfo}

פריטי ההזמנה:
${itemsList}
        `
                };
                const info = yield this.transporter.sendMail(mailOptions);
                console.log('✅ Email sent successfully:', info.messageId);
            }
            catch (error) {
                // Log error but don't throw - we don't want email failures to break order creation
                console.error('❌ Error sending order email:', error);
                console.error('❌ Email error details:', {
                    message: error.message,
                    code: error.code,
                    response: error.response
                });
            }
        });
    }
}
exports.EmailService = EmailService;
