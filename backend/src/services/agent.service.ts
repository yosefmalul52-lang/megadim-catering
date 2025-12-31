import { sendLeadWhatsApp } from './whatsapp.service';

interface Session {
  step: string;
  data: {
    eventType?: string;
    date?: string;
    guests?: string;
    menu?: string;
    contact?: string;
  };
}

interface AgentResponse {
  reply: string;
  session: Session;
}

const sessions: Map<string, Session> = new Map();

export function handleMessage({ sessionId, message }: { sessionId?: string; message?: string }): AgentResponse {
  // Safe defaults for missing parameters
  const safeSessionId = sessionId || `default_${Date.now()}`;
  const safeMessage = (message || '').trim();

  // Get or create session
  let session = sessions.get(safeSessionId);
  
  if (!session) {
    session = {
      step: 'welcome',
      data: {}
    };
    sessions.set(safeSessionId, session);
  }

  // Handle empty message
  if (!safeMessage) {
    return {
      reply: "לא קיבלתי הודעה 🤔 נסה לכתוב שוב.",
      session
    };
  }

  // Handle reset
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

  // Handle conversation flow
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
      
      // Send WhatsApp notification with lead information
      const lead = {
        name: session.data.contact,
        eventType: session.data.eventType,
        date: session.data.date,
        guests: session.data.guests,
        menu: session.data.menu,
        createdAt: new Date().toLocaleString('he-IL')
      };
      
      // Send asynchronously - don't wait for it (won't fail if Twilio not configured)
      sendLeadWhatsApp(lead).catch(err => {
        console.error('Failed to send WhatsApp lead:', err);
      });
      
      return {
        reply: "תודה 🙏 קיבלנו את הפרטים ונחזור אליך. אם יש דרישות כשרות – תכתוב כאן.",
        session
      };

    case 'done':
      // In done state, just acknowledge any additional messages
      return {
        reply: "תודה על המידע הנוסף! נשמור את זה ונחזור אליך בהקדם.",
        session
      };

    default:
      // Unknown step - reset to welcome
      session.step = 'welcome';
      session.data = {};
      sessions.set(safeSessionId, session);
      return {
        reply: "היי 👋 כאן נציג השירות של \"מגדים\". בשביל איזה אירוע אתה צריך קייטרינג? (בר מצווה / שבת / אירוע חברה / צ׳ולנט)",
        session
      };
  }
}

