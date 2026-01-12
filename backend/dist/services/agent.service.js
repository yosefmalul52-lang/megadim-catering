"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleMessage = handleMessage;
const whatsapp_service_1 = require("./whatsapp.service");
const sessions = new Map();
function handleMessage({ sessionId, message }) {
    const safeSessionId = sessionId || `default_${Date.now()}`;
    const safeMessage = (message || '').trim();
    let session = sessions.get(safeSessionId);
    if (!session) {
        session = {
            step: 'welcome',
            data: {}
        };
        sessions.set(safeSessionId, session);
    }
    if (!safeMessage) {
        return {
            reply: "לא קיבלתי הודעה 🤔 נסה לכתוב שוב.",
            session
        };
    }
    const resetCommands = ['התחלה', 'reset', 'איפוס', 'מחדש'];
    if (resetCommands.some(cmd => safeMessage.toLowerCase().includes(cmd.toLowerCase()))) {
        session = {
            step: 'welcome',
            data: {}
        };
        sessions.set(safeSessionId, session);
        return {
            reply: "היי 👋 כאן נציג השירות של \"מגדים\". בשביל איזה אירוע אתה צריך קייטרינג? (בר מצווה / שבת / אירוע חברה / צ׳ולנט)",
            session
        };
    }
    switch (session.step) {
        case 'welcome':
            session.step = 'ask_event';
            sessions.set(safeSessionId, session);
            return {
                reply: "היי 👋 כאן נציג השירות של \"מגדים\". בשביל איזה אירוע אתה צריך קייטרינג? (בר מצווה / שבת / אירוע חברה / צ׳ולנט)",
                session
            };
        case 'ask_event':
            session.data.eventType = safeMessage;
            session.step = 'ask_date';
            sessions.set(safeSessionId, session);
            return {
                reply: "מעולה 👍 מה התאריך או היום של האירוע?",
                session
            };
        case 'ask_date':
            session.data.date = safeMessage;
            session.step = 'ask_guests';
            sessions.set(safeSessionId, session);
            return {
                reply: "וכמה אנשים בערך יהיו?",
                session
            };
        case 'ask_guests':
            session.data.guests = safeMessage;
            session.step = 'ask_menu';
            sessions.set(safeSessionId, session);
            return {
                reply: "רוצה תפריט בשרי, חלבי או שבת?",
                session
            };
        case 'ask_menu':
            session.data.menu = safeMessage;
            session.step = 'ask_contact';
            sessions.set(safeSessionId, session);
            return {
                reply: "מושלם ✅ כדי שנחזור אליך עם הצעת מחיר – איך לקרוא לך?",
                session
            };
        case 'ask_contact':
            session.data.contact = safeMessage;
            session.step = 'done';
            sessions.set(safeSessionId, session);
            const lead = {
                name: session.data.contact,
                eventType: session.data.eventType,
                date: session.data.date,
                guests: session.data.guests,
                menu: session.data.menu,
                createdAt: new Date().toLocaleString('he-IL')
            };
            (0, whatsapp_service_1.sendLeadWhatsApp)(lead).catch(err => {
                console.error('Failed to send WhatsApp lead:', err);
            });
            return {
                reply: "תודה 🙏 קיבלנו את הפרטים ונחזור אליך. אם יש דרישות כשרות – תכתוב כאן.",
                session
            };
        case 'done':
            return {
                reply: "תודה על המידע הנוסף! נשמור את זה ונחזור אליך בהקדם.",
                session
            };
        default:
            session.step = 'welcome';
            session.data = {};
            sessions.set(safeSessionId, session);
            return {
                reply: "היי 👋 כאן נציג השירות של \"מגדים\". בשביל איזה אירוע אתה צריך קייטרינג? (בר מצווה / שבת / אירוע חברה / צ׳ולנט)",
                session
            };
    }
}
//# sourceMappingURL=agent.service.js.map