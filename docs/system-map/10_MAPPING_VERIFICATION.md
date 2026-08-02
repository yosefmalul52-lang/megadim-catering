# 10 — Mapping Verification

**תאריך אימות:** 2026-07-30  
**היקף:** אימות המיפוי המעודכן תחת `docs/system-map/` מול הקוד הפעיל. לא שונה קוד מוצר.

---

## 1. Checklist שלמות

| # | בדיקה | תוצאה |
|---|--------|--------|
| 1 | כל Frontend Route פעיל מתועד עם קריאות API/forms/state מדויקות | **PASS** — `01_FRONTEND_MAP.md` (71 source / 115 mounted / 105 URL-bearing) |
| 2 | כל Backend Endpoint ממונט מתועד בפירוט מלא | **PASS** — 162 רשומות ב־`02_BACKEND_API_MAP.md` |
| 3 | כל Endpoint ב־`server/` הפעיל מתועד | **PASS** — 6 רשומות (S1–S6); `session-token` מוערם ולא נספר |
| 4 | Handler כללי (`inline`/`res`/`various`/`approx` כשם Handler) | **PASS** — 0; callbacks אנונימיים מתויגים עם קובץ+טווח שורות |
| 5 | כל Model שמור עם Schema מלא | **PASS** — 23/23 ב־`03_DATABASE_MAP.md` |
| 6 | מטריצת הרשאות לכל Endpoint רגיש | **PASS** — 142 שורות מפורשות, 0 wildcards ב־`04_AUTH_AND_PERMISSIONS.md` |
| 7 | Business flows = 20 והאינדקס תואם | **PASS** — `05_BUSINESS_FLOWS.md` כולל JSON index באורך 20 |
| 8 | סתירות Auth שצוינו נפתרו | **PASS** — ledger של 14 תיקונים ב־`02` + סעיף 6 ב־`04` |
| 9 | אין סודות במסמכים | **PASS** — שמות env בלבד |
| 10 | טבלת הצלבה FE↔Auth↔Role↔Flow ללא סתירות פתוחות | **PASS** — סעיף 3 להלן |
| 11 | פעולות DB/file/provider מיוחסות רק ל־Handler ולשירותים שהוא קורא להם | **PASS** — 168/168 רשומות נבדקו; 0 פעולות שאולות מ־Handler אחר |
| 12 | שדות כתיבה תואמים Schema או מסווגים כ־Mixed/Object/file/runtime/provider | **PASS** — 0 סתירות לא פתורות |
| 13 | Validation מתאר משמעות ולא רק מספרי שורות | **PASS** — 0 תיאורי line-only |
| 14 | כל `req.params`, `req.query`, `req.body`, `req.file` ו־`req.files` שנקראים ב־Handler או בשירות ישיר מופיעים ב־Inputs של אותו Endpoint | **PASS** — בדיקה אוטומטית ל־14 הרשומות שתוקנו: 0 שדות חסרים; 3/3 multipart endpoints מציינים את שם שדה הקובץ |

---

## 2. טבלת כיסוי

| תחום | נמצאו בקוד | מופו במסמכים | לא מופו | כיסוי |
|------|------------|--------------|---------|-------|
| Frontend URL-bearing routes | 105 | 105 | 0 | **100%** |
| API Endpoints (backend active) | 162 | 162 | 0 | **100%** |
| API Endpoints (`server/` active) | 6 | 6 | 0 | **100%** |
| Database Models (persisted) | 23 | 23 full schemas | 0 | **100%** |
| Sensitive endpoints in role matrix | 142 | 142 | 0 | **100%** |
| Business Flows (requested) | 20 | 20 | 0 | **100%** |

הערות ספירה:
- Frontend: 105 = 104 דפוסי URL ממשיים + `/**`; layouts ריקים לא נספרים פעמיים (`01` §Scope).
- API: 162 כולל `/`, `/robots.txt`, `/api/health`; 6 ב־`server/` נפרדים; סה״כ מפורטים 168.
- Models: 23 כולל `TestConnection`; 7 type-only אינם collections.
- Business Flows: בדיוק 20; תשלום חלקי/מקדמה מאוחד בזרימה 9; יתרה היא זרימה 10.

---

## 3. טבלת בדיקות סתירות

| Endpoint / נושא | Frontend consumer | Backend authentication | Role matrix | Business flow | סתירה פתוחה |
|-----------------|-------------------|------------------------|-------------|----------------|-------------|
| `POST /api/attendance/clock` | `/time-clock` | public (`attendance.routes.ts:12`) | public with PIN | attendance/kiosk surfaces | **0** |
| `POST /api/contact` | `/contact` | public | public | email/contact flows | **0** |
| `POST /api/coupons/apply` | `/checkout` | public + applyLimiter | public | Flow 19 | **0** |
| `POST /api/delivery/calculate-fee` | `/checkout`, shipping test | public | public | Flow 1 | **0** |
| `GET /api/settings` | public screens + admin | public | public | settings reads | **0** |
| `GET /api/settings/delivery` | checkout, holiday-food, shipping | public | public | Flow 1 | **0** |
| `GET /api/gallery` | home gallery child, admin | public | public read (not mutation) | media display | **0** |
| `GET /api/holiday-events/public/active` | Shabbat holiday routes | public | public read | Shabbat/holiday browse | **0** |
| `POST /api/upload/video` | admin gallery upload | `authenticate → requireAdmin` | admin | Flow 17 (video) | **0** |
| `GET/POST /api/payment/success` | Tranzila/browser redirect | public provider callback | public payment-provider/browser | Flow 7 | **0** |
| `POST /api/menu` | `/admin/menu` | `authenticate → requireAdmin` | admin | Flow 18 | **0** |
| `POST /api/delivery/cities` | `/admin/shipping` | `authenticate → requireAdmin` | admin | shipping admin | **0** |
| `PUT/DELETE /api/testimonials/:id` | no FE consumer | `authenticate → requireAdmin` | admin | none | **0** |
| `GET /api/gallery/stats` | `GalleryService` (unused on active route) | registered admin; **effective** capture by public `GET /:id` | matrix documents effective public + unreachable admin | correctness defect only | **0** (מתועד כ־broken, לא סתירה בין מסמכים) |
| `POST/PUT/DELETE /api/delivery/pricing` | ShippingService methods exist; no active routed invocation | **no backend route** | N/A | shipping tiers managed via `PUT /api/settings/delivery` | **0** (מסומן broken ב־FE) |
| Flow count 20 vs prior 21 | — | — | — | normalized to 20 with JSON index | **0** |

**סה״כ סתירות פתוחות בין ארבעת הצירים: 0.**

בדיקת Side Effects של GET מצאה **11** נתיבים שכותבים בפועל: `GET /api/admin/institutions`, `GET /api/admin/institutions/menu`, `GET /api/admin/institutions/order/:institutionId`, `GET /api/admin/institutions/reports`, `GET /api/customers`, `GET /api/menu`, `GET /api/payment/success`, `GET /api/portal/status`, `GET /api/settings`, `GET /api/settings/delivery`, `GET /api/settings/store`. יתר 27 המועמדים מתוך 38 הרשומות המקוריות תוקנו ל־`writes none`.

---

## 4. Contradiction ledger (מהתוקן)

מתוך `02_BACKEND_API_MAP.md` §Explicit contradiction ledger — **14** תיקונים שבוצעו:

1. attendance clock: ADMIN → public  
2. contact POST: ADMIN → public  
3. coupons apply: ADMIN → public+limiter  
4. delivery calculate-fee: ADMIN → public  
5. settings GET / delivery GET: ADMIN → public  
6. gallery GET: ADMIN → public  
7. holiday public/active: ADMIN → public  
8. upload video: PUBLIC → admin  
9. payment success GET/POST: ADMIN → public external  
10. menu POST: PUBLIC → admin  
11. delivery cities POST: PUBLIC → admin  
12. testimonials PUT/DELETE: PUBLIC → admin  
13. payment status: PUBLIC → authenticated  
14. gallery stats: active → broken (route order)

---

## 5. מטריקות Handler

| מדד | ערך |
|-----|-----|
| Endpoints עם פירוט מלא (backend + server) | **168** |
| Endpoints עם Handler כללי אסור | **0** |
| GET Endpoints שמבצעים כתיבה בפועל | **11** |
| Endpoints עם פירוט כתיבה כללי | **0** |
| Endpoints עם Validation המתואר רק במספרי שורות | **0** |
| סתירות שדות כתיבה מול Schemas | **0** |
| סתירות פתוחות בין המסמכים | **0** |
| Endpoints שבהם Inputs סותר Validation (סט התיקון הממוקד) | **0** |
| Endpoints שבהם Inputs סותר את פעולת הכתיבה (סט התיקון הממוקד) | **0** |
| Multipart Endpoints המתועדים כ־`body none` | **0** |
| סתירות בין External integrations לפעולות בפועל (סט התיקון הממוקד) | **0** |
| Models עם Schema מלא | **23** |
| Sensitive matrix rows | **142** |
| Business flows | **20** |

---

## 6. שאלות שלא ניתן לאמת מהקוד

1. האם Tranzila ב־production במצב חי או mock.  
2. מדיניות MongoDB backup/PITR בפועל.  
3. האם תהליך `server/` רץ בפרודקשן מאחורי אותו דומיין/proxy.  
4. הגדרות Vercel/Render המדויקות מחוץ ל־repo.  
5. האם UptimeRobot / monitors חיצוניים פעילים.  
6. תוכן מסמכי Mongo אמיתיים תחת `SiteSettings` `strict:false` ו־`Order.customerDetails` Object.  
7. Indexes חיים ב־Atlas מול הצהרות ה־schema (ייתכן פער היסטורי).

---

## 7. הצהרת סיום

המיפוי המעודכן עבר אימות הצלבה: אין סתירות פתוחות בין פעולות ה־Endpoint, Inputs, Validation, שדות ה־Schemas, External integrations, Frontend consumer, Backend authentication, Role matrix ו־Business flow. בדיקת Inputs הממוקדת עברה עבור 14/14 הרשומות ו־3/3 נתיבי multipart. כל 168 הרשומות כוללות פעולות Handler-scoped; 11 נתיבי GET מבצעים כתיבה מוכחת; אין פירוט כתיבה כללי ואין Validation שמסתפק במספרי שורות. ספירת Frontend routes היא 105 בכל מסמכי הספירה.  
לא שונה קוד מוצר — רק קבצים תחת `docs/system-map/`.
