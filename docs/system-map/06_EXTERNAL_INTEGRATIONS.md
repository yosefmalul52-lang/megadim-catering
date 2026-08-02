# 06 — External Integrations

**כלל:** שמות משתני סביבה בלבד — ללא ערכים.

---

## Inventory

| # | Integration | Role | Primary files | Env names |
|---|-------------|------|---------------|-----------|
| 1 | Tranzila | Payments HPP + V1 capture/void | `tranzila.service.ts`, `payment.controller.ts` | `TRANZILA_TERMINAL_NAME`, `TRANZILA_APP_KEY`, `TRANZILA_APP_SECRET`, `TRANZILA_HOSTED_URL`, `TRANZILA_SUCCESS_URL`, `FRONTEND_URL`, `BACKEND_URL` |
| 2 | Cloudinary | Image/video upload | `cloudinary.ts`, `cloudinary.config.ts`, `middleware/upload*.ts`, `upload.routes.ts` | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` |
| 3 | SMTP / Nodemailer | Transactional email | `email.service.ts`, order/catering/contact controllers | `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_FROM_DISPLAY_NAME`, `OWNER_EMAIL`, `BUSINESS_NAME` |
| 4 | Twilio WhatsApp | Lead notify | `whatsapp.service.ts`, `agent.service.ts` | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM` |
| 5 | Google Maps Geocoding | Delivery distance | `delivery.service.ts`, `delivery.controller.ts` | `GOOGLE_MAPS_API_KEY` |
| 6 | OpenStreetMap Nominatim | Geocode fallback | `delivery.service.ts` | — (public HTTP) |
| 7 | n8n webhooks | Order/contact/campaign | `webhook.util.ts`, controllers | `N8N_ORDER_WEBHOOK_URL`, `N8N_CONTACT_WEBHOOK_URL`, `N8N_CAMPAIGN_WEBHOOK_URL` |
| 8 | GA4 | Analytics | `index.html`, `analytics.service.ts`, `environment*.ts` | compile-time `googleAnalyticsId` |
| 9 | Meta Pixel | Marketing | `index.html`, `meta-pixel.service.ts` | hardcoded pixel id in source |
| 10 | OpenAI | Chat/summaries | `server/index.js` | `OPENAI_API_KEY`, `OPENAI_CHAT_MODEL`, `OPENAI_SUMMARY_MODEL` |
| 11 | Gov.il datastore | Cities list | `location.service.ts` | public URL |
| 12 | MongoDB | Primary DB | `database.ts` | `MONGO_URI` (גם אזכורי `MONGODB_URI`/`DATABASE_URL` בסקריפטים ישנים — לבדיקה) |
| 13 | Render | Hosted API | `environment.prod.ts` | — |
| 14 | UptimeRobot | Keep-alive docs | `backend/README.md` | **תיעוד בלבד — לא ניתן לאמת שימוש חי** |

---

## Per-integration detail

### Tranzila
- **Read/Write:** create HPP session; capture; void; callback writes Order payment fields.
- **Failure:** mock mode אם חסר terminal; capture errors חוזרים ל־admin.
- **Retry:** אין. **Timeout:** 15_000 ms.
- **Sandbox/Prod:** מוגדר ע״י env — **לא ניתן לאמת** מצב חי מהקוד.
- **Business impact:** ללא terminal → mock authorize; checkout עדיין יוצר Order.

### Cloudinary
- Upload write; failure → upload endpoint error.
- Image upload **ללא auth** → סיכון abuse.
- כשל חיצוני חוסם העלאת מדיה, לא checkout בסיסי.

### SMTP
- Fail-soft בחלק מהזרימות (log + continue).
- אין retry/queue.
- כשל לא אמור למחוק Order שכבר נשמר.

### Twilio WhatsApp
- Skip אם env חסר (`whatsapp.service.ts` warn).
- אין retry.

### Google Maps / OSM
- Missing key → flat-rate fallback ב־delivery.controller (checkout לא נשבר).
- OSM כ־fallback ב־service.

### n8n
- `fireWebhook` — single fetch, fail-open, no retry (`webhook.util.ts`).

### Analytics (GA4 / Meta)
- Client-side; gated by cookie consent.
- כשל analytics לא משפיע על הזמנות.

### OpenAI (`server/`)
- נפרד מה־backend הראשי.
- Fallback תשובות אם אין מפתח — לפי `server/index.js`.

---

## Webhooks נוספים
רק n8n URLs לעיל. Payment success הוא browser redirect ל־backend, לא webhook ספק נפרד בקוד.

---

## האם כשל חיצוני מפיל פעולה עסקית מרכזית?

| Integration | מפיל יצירת הזמנה? |
|-------------|-------------------|
| Tranzila | לא ליצירה; כן להשלמת תשלום אמיתי |
| SMTP | בדרך כלל לא |
| n8n | לא (fail-open) |
| Maps | לא (fallback) |
| Cloudinary | רק העלאות |
| Twilio | לא |
| MongoDB | כן — תהליך לא עולה בלי MONGO_URI |

