// Minimal Express server for Magadim catering inquiries
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import { EventEmitter } from 'events';
import OpenAI from 'openai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 8787);
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'http://localhost:4200';
const ADMIN_KEY = process.env.ADMIN_KEY || 'dev_admin_key_change_me';
let openai = null;
try {
  if (process.env.OPENAI_API_KEY && String(process.env.OPENAI_API_KEY).trim()) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
} catch (e) {
  console.warn('OpenAI client init failed, continuing without OpenAI.');
}
const adminBus = new EventEmitter();

app.use(cors({ origin: [ALLOWED_ORIGIN], credentials: false }));
app.use(express.json());
app.use(rateLimit({ windowMs: 60_000, max: 180 }));

// Data storage setup
const dataDir = path.join(__dirname, 'data');
const dataFile = path.join(dataDir, 'catering-inquiries.json');
const chatsDir = path.join(dataDir, 'chats');
const summariesFile = path.join(dataDir, 'chat-summaries.json');

function ensureDataDir() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  if (!fs.existsSync(chatsDir)) {
    fs.mkdirSync(chatsDir, { recursive: true });
  }
}

function readAllInquiries() {
  try {
    if (!fs.existsSync(dataFile)) return [];
    const raw = fs.readFileSync(dataFile, 'utf8');
    if (!raw.trim()) return [];
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed reading inquiries file:', err);
    return [];
  }
}

function writeAllInquiries(list) {
  ensureDataDir();
  fs.writeFileSync(dataFile, JSON.stringify(list, null, 2), 'utf8');
}

function generateConfirmationId() {
  const ts = Date.now().toString(36);
  const rnd = Math.random().toString(36).slice(2, 8);
  return `MAG-${ts}-${rnd}`.toUpperCase();
}

// Validation helpers
const phoneRegex = /^[0-9+\-()\s]{7,}$/;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const dateRegex = /^\d{4}-\d{2}-\d{2}$/; // YYYY-MM-DD
const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/; // HH:MM 24h

function isPastDate(yyyyMmDd) {
  const [y, m, d] = yyyyMmDd.split('-').map(Number);
  const input = new Date(Date.UTC(y, m - 1, d));
  const now = new Date();
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return input < todayUtc; // today allowed
}

function validateInquiry(i) {
  if (!i || typeof i !== 'object') return 'Invalid payload';
  const fullName = (i.fullName ?? '').toString().trim();
  if (fullName.length < 2) return 'fullName must be at least 2 characters';

  const phone = (i.phone ?? '').toString().trim();
  if (!phoneRegex.test(phone)) return 'phone is invalid';

  const email = (i.email ?? '').toString().trim();
  if (!emailRegex.test(email)) return 'email is invalid';

  const eventDate = (i.eventDate ?? '').toString().trim();
  if (!dateRegex.test(eventDate)) return 'eventDate must be YYYY-MM-DD';
  if (isPastDate(eventDate)) return 'eventDate cannot be in the past';

  const eventTime = (i.eventTime ?? '').toString().trim();
  if (!timeRegex.test(eventTime)) return 'eventTime must be HH:MM (24h)';

  const guestCount = Number(i.guestCount);
  if (!Number.isInteger(guestCount) || guestCount < 1) return 'guestCount must be integer >= 1';

  // Optional fields: location, kashrut, budgetRange, notes (all strings if provided)
  return null;
}

function appendInquiry(i) {
  const list = readAllInquiries();
  const entry = {
    ...i,
    createdAt: new Date().toISOString(),
    confirmationId: generateConfirmationId(),
  };
  list.push(entry);
  writeAllInquiries(list);
  return entry;
}

// ---------- Chat persistence & summaries ----------
function safeReadJson(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const raw = fs.readFileSync(filePath, 'utf8');
    if (!raw.trim()) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed reading JSON', filePath, e);
    return fallback;
  }
}

function safeWriteJson(filePath, value) {
  ensureDataDir();
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
}

async function appendChatMessage(conversationId, role, content) {
  ensureDataDir();
  const file = path.join(chatsDir, `${conversationId}.json`);
  const existing = safeReadJson(file, []);
  existing.push({ role, content, ts: new Date().toISOString() });
  safeWriteJson(file, existing);
}

async function readConversation(conversationId) {
  const file = path.join(chatsDir, `${conversationId}.json`);
  return safeReadJson(file, []);
}

async function upsertSummary(summary) {
  const items = safeReadJson(summariesFile, []);
  const idx = items.findIndex(x => x.conversationId === summary.conversationId);
  if (idx >= 0) {
    items[idx] = { ...items[idx], ...summary, updatedAt: summary.updatedAt };
  } else {
    items.push(summary);
  }
  safeWriteJson(summariesFile, items);
  return summary;
}

function basicExtract(messages) {
  const allText = messages.map(m => m.content).join('\n');
  const phoneMatch = allText.match(/[0-9+\-()\s]{7,}/);
  const emailMatch = allText.match(/[^\s@]+@[^\s@]+\.[^\s@]+/);
  const dateMatch = allText.match(/\b\d{4}-\d{2}-\d{2}\b/);
  const timeMatch = allText.match(/\b([01]\d|2[0-3]):([0-5]\d)\b/);
  const guestMatch = allText.match(/(\d{1,4})\s*(אורחים|מוזמנים)/);
  const locationMatch = allText.match(/(?:מיקום|עיר)[:\s]+([^\n,]+)/);
  const budgetMatch = allText.match(/(?:תקציב|טווח תקציב)[:\s]+([^\n,]+)/);
  const nameMatch = allText.match(/(?:שמי|קוראים לי|שם מלא)[:\s]+([^\n,]+)/);
  const kashrutMatch = allText.match(/(?:כשרות|העדפת כשרות)[:\s]+([^\n,]+)/);
  return {
    fullName: nameMatch?.[1]?.trim(),
    phone: phoneMatch?.[0]?.trim(),
    email: emailMatch?.[0]?.trim(),
    eventDate: dateMatch?.[0],
    eventTime: timeMatch?.[0],
    guestCount: guestMatch ? Number(guestMatch[1]) : undefined,
    location: locationMatch?.[1]?.trim(),
    kashrut: kashrutMatch?.[1]?.trim(),
    budgetRange: budgetMatch?.[1]?.trim(),
  };
}

async function summarizeConversation(conversationId) {
  const messages = await readConversation(conversationId);
  if (!messages.length) return null;
  const startedAt = messages[0]?.ts || new Date().toISOString();
  const lastUser = [...messages].reverse().find(m => m.role === 'user')?.content || '';
  const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant')?.content || '';
  const nowIso = new Date().toISOString();

  let summary = {
    conversationId,
    title: 'שיחה ללא כותרת',
    bullets: [],
    userIntent: 'אחר',
    extracted: basicExtract(messages),
    lastUserMessage: lastUser,
    lastAssistantMessage: lastAssistant,
    startedAt,
    updatedAt: nowIso,
  };

  try {
    if (!openai) {
      // Fallback: no OpenAI configured, keep heuristic summary only
      await upsertSummary(summary);
      adminBus.emit('summary:new', { type: 'chat-summary', data: summary });
      return summary;
    }
    const sys = 'את/ה מסכם/ת בקצרה בעברית שיחת צ׳אט לוח ניהול של קייטרינג. תחזיר/י אך ורק JSON תקין לפי המפתח המבוקש.';
    const user = [
      'סכם/י את השיחה בתמצית. אל תמציא/י עובדות.',
      'messages:',
      JSON.stringify(messages.map(m => ({ role: m.role, content: m.content, ts: m.ts }))),
      'schema:',
      JSON.stringify({
        conversationId,
        title: '...',
        bullets: ['...'],
        userIntent: 'הצעת מחיר | טעימות | שאלות כלליות | בירור כשרות | אחר',
        extracted: {
          fullName: '...', phone: '...', email: '...', eventDate: 'YYYY-MM-DD', eventTime: 'HH:MM', guestCount: 0,
          location: '...', kashrut: '...', budgetRange: '...'
        },
        lastUserMessage: '...',
        lastAssistantMessage: '...',
        startedAt: startedAt,
        updatedAt: nowIso,
      })
    ].join('\n');

    const resp = await openai.chat.completions.create({
      model: process.env.OPENAI_SUMMARY_MODEL || 'gpt-5',
      temperature: 0.2,
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: user }
      ]
    });
    const content = resp.choices?.[0]?.message?.content || '';
    try {
      const parsed = JSON.parse(content);
      summary = {
        conversationId,
        title: parsed.title || summary.title,
        bullets: Array.isArray(parsed.bullets) ? parsed.bullets : summary.bullets,
        userIntent: parsed.userIntent || summary.userIntent,
        extracted: { ...summary.extracted, ...(parsed.extracted || {}) },
        lastUserMessage: parsed.lastUserMessage || lastUser,
        lastAssistantMessage: parsed.lastAssistantMessage || lastAssistant,
        startedAt: parsed.startedAt || startedAt,
        updatedAt: nowIso,
      };
    } catch (e) {
      console.warn('Failed to parse summary JSON, using fallback');
    }
  } catch (err) {
    console.error('OpenAI summarize failed:', err?.message || err);
  }

  await upsertSummary(summary);
  adminBus.emit('summary:new', { type: 'chat-summary', data: summary });
  return summary;
}

function assertAdmin(req, res) {
  const key = req.query.key || req.header('X-Admin-Key');
  if (key !== ADMIN_KEY) {
    res.status(401).json({ ok: false, error: 'unauthorized' });
    return false;
  }
  return true;
}

// Endpoint: POST /api/catering-inquiry
app.post('/api/catering-inquiry', (req, res) => {
  const error = validateInquiry(req.body);
  if (error) {
    return res.status(400).json({ ok: false, error });
  }
  try {
    const saved = appendInquiry(req.body);
    return res.json({ ok: true, message: 'הפניה נקלטה, נחזור אליך לתיאום', data: saved });
  } catch (err) {
    console.error('Failed saving inquiry:', err);
    return res.status(500).json({ ok: false, error: 'Internal error' });
  }
});

// Chat API: persists messages and returns assistant reply
app.post('/api/chat', async (req, res) => {
  try {
    let { conversationId, messages, systemPrompt } = req.body || {};
    if (!conversationId || typeof conversationId !== 'string') {
      conversationId = `conv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    }
    const newUserMessages = Array.isArray(messages) ? messages.filter(m => m?.role === 'user') : [];
    for (const m of newUserMessages) {
      await appendChatMessage(conversationId, 'user', String(m.content || ''));
    }

    const convo = await readConversation(conversationId);
    const forOpenAI = [
      systemPrompt ? { role: 'system', content: String(systemPrompt) } : null,
      ...convo.map(m => ({ role: m.role, content: m.content }))
    ].filter(Boolean);

    let reply = '';
    if (!openai) {
      reply = 'קיבלתי את ההודעה. אחד מנציגינו יחזור בהקדם. ניתן להשאיר: שם מלא, טלפון, תאריך, שעה ומספר מוזמנים.';
    } else {
      const aiResp = await openai.chat.completions.create({
        model: process.env.OPENAI_CHAT_MODEL || 'gpt-5',
        temperature: 0.3,
        messages: forOpenAI
      });
      reply = aiResp.choices?.[0]?.message?.content || '';
    }
    await appendChatMessage(conversationId, 'assistant', reply);
    summarizeConversation(conversationId).catch(() => {});
    return res.json({ ok: true, reply, conversationId });
  } catch (err) {
    console.error('Chat error:', err);
    return res.status(200).json({ ok: false, error: 'chat_failed' });
  }
});

// Admin summaries list
app.get('/api/admin/summaries', (req, res) => {
  if (!assertAdmin(req, res)) return;
  const items = safeReadJson(summariesFile, []);
  items.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  return res.json({ ok: true, data: items });
});

// Admin SSE stream
app.get('/api/admin/stream', (req, res) => {
  if (!assertAdmin(req, res)) return;
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const onSummary = (payload) => {
    res.write(`event: summary\n`);
    res.write(`data: ${JSON.stringify(payload.data)}\n\n`);
  };
  adminBus.on('summary:new', onSummary);
  req.on('close', () => {
    adminBus.off('summary:new', onSummary);
  });
});

// Health checks and root info to avoid "Cannot GET /" confusion
app.get('/api/health', (req, res) => {
  return res.json({ ok: true, service: 'magadim-catering-server', port: PORT, time: new Date().toISOString() });
});

app.get('/', (req, res) => {
  return res.json({
    ok: true,
    message: 'Magadim Catering minimal server is running',
    endpoints: {
      createInquiry: 'POST /api/catering-inquiry',
      health: 'GET /api/health'
    }
  });
});

// Optional stub for future ChatKit session token (disabled)
// app.post('/api/session-token', (req, res) => {
//   return res.status(501).json({ ok: false, error: 'Not implemented' });
// });

app.listen(PORT, () => {
  console.log(`Server on http://localhost:${PORT}`);
});


