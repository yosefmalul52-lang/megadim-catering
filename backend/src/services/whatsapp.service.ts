import twilio from 'twilio';

const {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_WHATSAPP_FROM
} = process.env;

// Business number (destination)
const BUSINESS_WHATSAPP_TO = 'whatsapp:+972528240230';

interface Lead {
  name?: string;
  eventType?: string;
  date?: string;
  guests?: string;
  menu?: string;
  contact?: string;
  createdAt?: string;
}

let client: twilio.Twilio | null = null;

if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
  client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
}

export async function sendLeadWhatsApp(lead: Lead): Promise<void> {
  if (!client) {
    console.warn('⚠️ Twilio not configured. Skipping WhatsApp send.');
    return;
  }

  if (!TWILIO_WHATSAPP_FROM) {
    console.warn('⚠️ TWILIO_WHATSAPP_FROM not configured. Skipping WhatsApp send.');
    return;
  }

  const text =
    `🔔 ליד חדש ממגדים\n` +
    `שם: ${lead.contact || lead.name || ''}\n` +
    `אירוע: ${lead.eventType || ''}\n` +
    `תאריך: ${lead.date || ''}\n` +
    `אורחים: ${lead.guests || ''}\n` +
    `תפריט: ${lead.menu || ''}\n` +
    `נוצר: ${lead.createdAt || new Date().toLocaleString('he-IL')}`;

  try {
    const message = await client.messages.create({
      from: TWILIO_WHATSAPP_FROM,     // e.g. 'whatsapp:+14155238886'
      to: BUSINESS_WHATSAPP_TO,       // business number
      body: text
    });

    console.log('✅ WhatsApp lead sent successfully:', message.sid);
  } catch (err: any) {
    console.error('❌ Error sending WhatsApp:', err.message);
    // Don't throw - we don't want to break the chat flow if WhatsApp fails
  }
}

