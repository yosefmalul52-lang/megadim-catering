"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailService = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
class EmailService {
    transporter;
    constructor() {
        this.transporter = nodemailer_1.default.createTransport({
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: parseInt(process.env.SMTP_PORT || '587'),
            secure: false,
            auth: {
                user: process.env.SMTP_USER || process.env.EMAIL_USER,
                pass: process.env.SMTP_PASS || process.env.EMAIL_PASSWORD
            }
        });
    }
    async sendOrderEmail(order) {
        try {
            const ownerEmail = process.env.OWNER_EMAIL || process.env.EMAIL_USER || 'owner@megadim.com';
            const itemsList = order.items.map((item, index) => {
                return `
          ${index + 1}. ${item.name}
             כמות: ${item.quantity}
             מחיר ליחידה: ₪${item.price}
             סה"כ: ₪${(item.price * item.quantity).toFixed(2)}
        `;
            }).join('\n');
            const customerInfo = `
        שם: ${order.customerDetails?.fullName || 'לא צוין'}
        טלפון: ${order.customerDetails?.phone || 'לא צוין'}
        אימייל: ${order.customerDetails?.email || 'לא צוין'}
        כתובת: ${order.customerDetails?.address || 'לא צוין'}
        הערות: ${order.customerDetails?.notes || 'אין הערות'}
      `;
            const mailOptions = {
                from: `"מגדים קייטרינג" <${process.env.SMTP_USER || process.env.EMAIL_USER}>`,
                to: ownerEmail,
                subject: `הזמנה חדשה #${order._id?.toString().substring(0, 8) || 'N/A'}`,
                html: `
          <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
            <h2 style="color: #0E1A24; text-align: center;">הזמנה חדשה התקבלה</h2>
            
            <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <h3 style="color: #cbb69e; border-bottom: 2px solid #cbb69e; padding-bottom: 10px;">פרטי ההזמנה</h3>
              <p><strong>מספר הזמנה:</strong> ${order._id?.toString() || 'N/A'}</p>
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

מספר הזמנה: ${order._id?.toString() || 'N/A'}
תאריך: ${new Date(order.createdAt || Date.now()).toLocaleString('he-IL')}
סטטוס: ${order.status}
סה"כ לתשלום: ₪${order.totalPrice.toFixed(2)}

פרטי הלקוח:
${customerInfo}

פריטי ההזמנה:
${itemsList}
        `
            };
            const info = await this.transporter.sendMail(mailOptions);
            console.log('✅ Email sent successfully:', info.messageId);
        }
        catch (error) {
            console.error('❌ Error sending order email:', error);
            console.error('❌ Email error details:', {
                message: error.message,
                code: error.code,
                response: error.response
            });
        }
    }
}
exports.EmailService = EmailService;
//# sourceMappingURL=email.service.js.map