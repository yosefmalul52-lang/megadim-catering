# 09 — Audit Comparison

השוואה בין המיפוי ב־`docs/system-map/` לבין `docs/MEGADIM_SYSTEM_AUDIT.md` (2026-07-29).

---

## 1. מה היה נכון ב־Audit

| נושא | התאמה למיפוי |
|------|----------------|
| מבנה FE Angular + BE Express + Mongo | נכון |
| Entrypoint `server.ts` ו־apiUrl Render | נכון |
| `POST /api/upload` ללא auth | מאומת ב־`upload.routes.ts` |
| Dummy revenue ב־dashboard | מאומת (לא נסתר במיפוי הנוכחי) |
| אין refunds / Payment ledger | מאומת — אין model/endpoints |
| אין Audit Log | מאומת |
| אין בדיקות / CI FE בלבד | מאומת |
| Gallery `/:id` לפני `/stats` | מאומת |
| Tranzila authorize/capture/void | מאומת |
| Institution = User role + InstitutionMenu/Order | נכון |
| manualOrder ציבורי / menu wipe / plaintext PIN | עודכנו ב־Audit ונמצאו שוב במיפוי |

---

## 2. מה היה חלקי ב־Audit

| נושא | פער |
|------|-----|
| מיפוי כל ה־Endpoints | Audit סיכם domains; המיפוי מונה **162** endpoints פעילים |
| Frontend routes | Audit לא מנה כל alias/children; המיפוי: **105** |
| `server/` mini-app | הוזכר חלקית; כאן מופה בנפרד (6 endpoints פעילים) |
| Delivery pricing FE vs BE | Audit לא הדגיש ש־FE קורא POST/PUT/DELETE pricing שאינם קיימים |
| `app.ts` vs `server.ts` | הוזכר חלקית; כאן מפורש כ־unused divergent app |
| Chat `/api/chat` vs `/api/agent` | לא פוצל בבירור |
| Testimonials JSON vs Mongo model | דורש הבהרה — המיפוי מפריד |
| Settings triple models | Audit לא מיפה Setting/StoreSettings/SiteSettings לעומק |

---

## 3. מה לא היה מדויק / עלול להטעות

| נושא | הבהרה מהמיפוי |
|------|----------------|
| "קיים ועובד" כאימות runtime | Audit עצמו מזהיר; עדיין עלול להיקרא כ־prod-verified |
| מסלול checkout יחיד | בפועל שלושה: `/orders`, `/order/checkout`, `/order/send` |
| ספירת סטטוסים ב־Audit | עודכנה לאחר ממצאים מאוחרים; המיפוי לא סופר R-IDs אלא רכיבים |
| Backend dist committed ל־Render | `.gitignore`/מצב git — **לא ניתן לאמת** מדיניות deploy נוכחית |

---

## 4. מערכות/קשרים שלא מופו מספיק ב־Audit

1. מטריצת Role×Screen×API המלאה  
2. Inventory מלא של 32 FE services  
3. ERD + 23 collections  
4. Absolute URL expansion ל־Shabbat×3 mounts  
5. `server/` OpenAI + admin key summaries  
6. Broken FE→BE pricing write APIs  
7. Unmounted `auth.js`/`menu.js`  
8. `TestConnection` insert בכל startup  

---

## 5. ממצאים שדורשים שינוי חומרה (ב־Audit vs מיפוי)

| ממצא | חומרה במיפוי | הערה |
|------|----------------|------|
| Public upload | קריטי | ללא שינוי |
| Public manualOrder/paid flags | קריטי | מאומת |
| Menu auto wipe | קריטי | מאומת |
| Payment initiate IDOR surface | גבוה | מאומת |
| Plaintext employee PIN | גבוה | מאומת |
| Pricing CRUD שבור ב־FE | גבוה (פונקציונלי) | **חדש/מובהק יותר במיפוי** |
| Chat endpoint mismatch | בינוני | **מובהק יותר במיפוי** |

> מסמך זה **אינו** ממליץ על סדר תיקונים — רק משווה חומרת ממצאים תיאורית.

---

## 6. שאלות שעדיין לא ניתנות לאימות

1. האם Tranzila ב־prod במצב חי או mock?  
2. האם Mongo backups/PITR מוגדרים?  
3. האם `server/` רץ בפרודקשן מאחורי אותו דומיין?  
4. הגדרות Vercel Output/Root בפועל  
5. האם UptimeRobot פעיל  
6. SPF/DKIM/DMARC למייל  
7. האם reverse-proxy מאחד `/api/chat` ל־`server/`  

