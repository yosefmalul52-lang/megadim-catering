"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendLeadWhatsApp = sendLeadWhatsApp;
const twilio_1 = __importDefault(require("twilio"));
const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM } = process.env;
const BUSINESS_WHATSAPP_TO = 'whatsapp:+972528240230';
let client = null;
if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
    client = (0, twilio_1.default)(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
}
async function sendLeadWhatsApp(lead) {
    if (!client) {
        console.warn('⚠️ Twilio not configured. Skipping WhatsApp send.');
        return;
    }
    if (!TWILIO_WHATSAPP_FROM) {
        console.warn('⚠️ TWILIO_WHATSAPP_FROM not configured. Skipping WhatsApp send.');
        return;
    }
    const text = `🔔 ליד חדש ממגדים\n` +
        `שם: ${lead.contact || lead.name || ''}\n` +
        `אירוע: ${lead.eventType || ''}\n` +
        `תאריך: ${lead.date || ''}\n` +
        `אורחים: ${lead.guests || ''}\n` +
        `תפריט: ${lead.menu || ''}\n` +
        `נוצר: ${lead.createdAt || new Date().toLocaleString('he-IL')}`;
    try {
        const message = await client.messages.create({
            from: TWILIO_WHATSAPP_FROM,
            to: BUSINESS_WHATSAPP_TO,
            body: text
        });
        console.log('✅ WhatsApp lead sent successfully:', message.sid);
    }
    catch (err) {
        console.error('❌ Error sending WhatsApp:', err.message);
    }
}
//# sourceMappingURL=whatsapp.service.js.map