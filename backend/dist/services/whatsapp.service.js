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
exports.sendLeadWhatsApp = sendLeadWhatsApp;
const twilio_1 = __importDefault(require("twilio"));
const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM } = process.env;
// Business number (destination)
const BUSINESS_WHATSAPP_TO = 'whatsapp:+972528240230';
let client = null;
if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
    client = (0, twilio_1.default)(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
}
function sendLeadWhatsApp(lead) {
    return __awaiter(this, void 0, void 0, function* () {
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
            const message = yield client.messages.create({
                from: TWILIO_WHATSAPP_FROM, // e.g. 'whatsapp:+14155238886'
                to: BUSINESS_WHATSAPP_TO, // business number
                body: text
            });
            console.log('✅ WhatsApp lead sent successfully:', message.sid);
        }
        catch (err) {
            console.error('❌ Error sending WhatsApp:', err.message);
            // Don't throw - we don't want to break the chat flow if WhatsApp fails
        }
    });
}
