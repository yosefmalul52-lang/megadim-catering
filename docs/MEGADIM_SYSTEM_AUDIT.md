# MEGADIM SYSTEM AUDIT

**מערכת:** מגדים — אתר הזמנות ומערכת ניהול לקייטרינג  
**מטרת המסמך:** צילום מצב עובדתי לפני שינויי מוצר  
**תאריך Audit:** 2026-07-29  
**היקף האימות:** קריאת קוד, מודלים, Routes, Services, Components, תלויות ו־CI. לא בוצעו קריאות ל־Production, תשלומים, שליחת הודעות, migrations, שינוי DB או deployment.  
**כלל פרשנות:** הסטטוס **"קיים ועובד"** מציין שמימוש מלא ומחובר נמצא בקוד. הוא אינו מהווה אישור לכך ששירות חיצוני עובד כרגע ב־Production. שירותים חיצוניים שלא נבדקו מסומנים **"לא ניתן לאמת"**.

---

## 1. תקציר מנהלים

מגדים היא מערכת רחבה עם שלושה ערוצי פעילות מחוברים למסד נתונים משותף:

1. אתר ציבורי להזמנת אוכל מוכן לשבת וחג, כולל סל, קופון, משלוח ותשלום.
2. טפסי קייטרינג לאירועים ולקייטרינג שבת/חג הנשמרים כהזמנות.
3. מערכת ניהול הכוללת הזמנות, תפריט, לקוחות, קופונים, משלוחים, דוחות מטבח, מוסדות, הנהלת חשבונות, מדיה ושיווק.

המערכת חזקה ברמת תפעול הזמנה בסיסי: פריטי הזמנה נשמרים בתוך ההזמנה, קיימת הפרדה בין סטטוס תפעולי לסטטוס תשלום, קיימים authorize/capture/void, הזמנות מסווגות לפי מקור, וקיימים מסכי עבודה למטבח, משלוחים ומוסדות.

המערכת אינה מוכנה עדיין להצגה כמוצר JT Solutions מלא מהסיבות הבאות:

- אין מודל כספי שמכסה החזר מלא/חלקי, מקדמה, יתרה, תשלום חלקי והיסטוריית ניסיונות.
- קיימות הגדרות שונות וסותרות של "הכנסה". חלק מהדוחות כוללים כל הזמנה שאינה מבוטלת, וחלק כוללים גם `authorized` לפני גבייה בפועל.
- אין Audit Log מרכזי, ולכן לא ניתן לדעת מי שינה מחיר, הזמנה, סטטוס או תשלום ומה היה הערך הקודם.
- דוח המטבח קיים ומועיל, אך חלק מהחישוב תלוי ב־`$lookup` למוצר הנוכחי; שינוי מוצר עלול לשנות קטגוריה/יחידה בדוח של הזמנה ישנה.
- אין PDF/Excel אמיתי לדוחות; רוב הייצוא הוא הדפסת דפדפן, ורק לקוחות תומכים ב־CSV.
- אין בדיקות Unit, Integration או E2E בפועל.
- `POST /api/upload` מאפשר העלאת תמונה ללא Authentication או הרשאת Admin.
- `POST /api/orders` הציבורי מקבל `manualOrder`/`paymentStatus` בלי `requireAdmin`; קריאת תפריט עם פחות מ־5 פריטים מוחקת את כל ה־menu ו־seed מחדש.
- דשבורד ההכנסות מציג נתונים אקראיים אם API מגמת ההכנסות נכשל.
- לא נמצאה הוכחה בקוד לגיבוי אוטומטי, מדיניות retention או תהליך שחזור שנבדק.

### עשרת הממצאים החמורים ביותר

1. **קריטי — העלאת תמונות לא מוגנת:** `POST /api/upload` אינו משתמש ב־`authenticate` או `requireAdmin` (`backend/src/routes/upload.routes.ts`, route `router.post('/')`).
2. **קריטי — יצירת הזמנה ידנית/paid דרך API ציבורי:** `POST /api/orders` מחובר עם `optionalAuthenticate` בלבד; `createOrderFromCheckout()` מקבל `manualOrder: true` ו־`paymentStatus: 'paid'` וכותב `customerDetails.isPaid` בלי `requireAdmin` (`backend/src/routes/orders.routes.ts`, `backend/src/services/order.service.ts`).
3. **קריטי — מחיקת תפריט אוטומטית:** `MenuController.getAllMenuItems()` מבצע `MenuItem.deleteMany({})` ואז seed מחדש כאשר `countDocuments() < 5` (`backend/src/controllers/menu.controller.ts`).
4. **גבוה — נתוני הכנסה אקראיים בדשבורד:** בכשל API מופעל `initializeChartWithDummyData()` שמייצר ערכים עם `Math.random()` (`frontend/src/app/components/admin/dashboard/dashboard.component.ts`).
5. **גבוה — הכנסה אינה מוגדרת באופן עקבי:** `getDashboardStats()` כולל `authorized` ו־`captured`; `getRevenueBySource()` ו־`getMonthlyRevenue()` אינם מסננים כלל לפי `paymentStatus` (`backend/src/services/order.service.ts`). Accounting לעומת זאת סופר רק `captured`.
6. **גבוה — אין החזרים / ledger:** לא נמצאו refund מלא/חלקי, סכום שנגבה בפועל, או Payment/Transaction model נפרד.
7. **גבוה — אין Audit Log ואין מטא־דאטה לביטול:** אין actor/before-after; אין `cancelReason`/`cancelledBy`/`cancelledAt`.
8. **גבוה — דוח מטבח אינו היסטורי לחלוטין + אין PDF/CSV:** `getKitchenReport()` מעדיף `$lookup` למוצר חי; הייצוא הוא `window.print()` בלבד.
9. **גבוה — אין בדיקות אוטומטיות + CI חלקי:** אין `*.spec.*`/`*.test.*`; CI בונה frontend בלבד (`.github/workflows/ci.yml`).
10. **גבוה — אבטחת תשלום/עובדים:** `POST /api/payment/initiate/:orderId` ציבורי לפי `orderId`; PIN עובד נשמר כ־plaintext ב־`Employee.pinCode`; cookies ב־prod עם `sameSite: 'none'` ללא CSRF middleware.

### שלושת החסמים לפני צילום סרטון מכירה

1. **אמינות נתונים עסקיים:** יש להסדיר Payment ledger, ביטולים והגדרת Revenue לפני הצגת KPI.
2. **אמינות תפעולית ואבטחה:** יש לסגור upload ציבורי, לחסום `manualOrder` ציבורי, להסיר auto-wipe של תפריט, להסיר נתוני דמה בדשבורד ולהוסיף Audit Log.
3. **תוצרי דמו מקצועיים:** נדרשים דוח מטבח PDF/CSV, נתוני דמו בטוחים ותהליך איפוס דמו מוגן.

### מה כבר מספיק חזק להצגה בדמו מוגבל

- אתר ציבורי, קטלוג, סל ו־checkout.
- ניהול תפריט ומדיה.
- קליטת הזמנות משלושה מקורות והצגתן באדמין.
- פורטל מוסדות עם תפריט והזמנה שבועית.
- תפעול הזמנה, נהג, משלוח, capture/void ברמת UI וקוד.
- CRM לקוחות בסיסי, קופונים, דוח מטבח בדפדפן ורשימת קניות.

### מה חייבים להשלים לפני הצגה כמוצר מלא

- Payment ledger + refunds + partial payments + cancellation model.
- Audit Log.
- KPI definitions אחידות ושאילתות מבוססות captured/refunded.
- בדיקות אוטומטיות למסלולים הקריטיים.
- PDF/CSV/Excel לדוחות.
- הגנת upload וסקירת הרשאות מלאה.
- תוכנית Backup/Restore מאומתת.
- סביבת Demo מבודדת עם reset.

---

## 2. ארכיטקטורת המערכת

### 2.1 טכנולוגיות

| שכבה | טכנולוגיה | הוכחה |
|---|---|---|
| Frontend | Angular 19.2, TypeScript, RxJS, Angular Material | `frontend/package.json`, `frontend/angular.json` |
| Charts | Chart.js + ng2-charts | `frontend/package.json`, `frontend/src/app/components/admin/dashboard/dashboard.component.ts` |
| Backend | Node.js, Express 4, TypeScript | `backend/package.json`, `backend/src/server.ts` |
| DB | MongoDB דרך Mongoose | `backend/package.json`, `backend/src/models/*` |
| Authentication | JWT ב־HttpOnly cookie או Bearer | `backend/src/middleware/auth.ts`, `backend/src/routes/auth.routes.ts` |
| Payments | Tranzila Hosted Payment + force capture/void | `backend/src/controllers/payment.controller.ts`, `backend/src/services/tranzila.service.ts` |
| Email | Nodemailer/SMTP | `backend/src/services/email.service.ts` |
| Media | Cloudinary + Multer | `backend/src/config/cloudinary.config.ts`, `backend/src/routes/upload.routes.ts` |
| WhatsApp | קישורי `wa.me`; Twilio לליד מה־agent בלבד | `frontend/src/app/constants/contact.constants.ts`, `backend/src/services/whatsapp.service.ts` |
| Maps/Delivery | Google Maps + תמחור מרחק/עיר | `backend/src/controllers/delivery.controller.ts`, `backend/src/services/delivery.service.ts` |
| Automation | n8n webhooks להזמנה/ליד/קמפיין | `backend/src/utils/webhook.util.ts`, `backend/src/controllers/order.controller.ts` |
| CI | GitHub Actions — build frontend בלבד | `.github/workflows/ci.yml` |

### 2.2 מבנה תיקיות מרכזי

```text
Megadim-P/
├── frontend/                 Angular public site + admin + institution portal
│   └── src/app/
│       ├── components/
│       │   ├── pages/        Public ordering/catering pages
│       │   ├── admin/        Administration modules
│       │   └── portal/       Institution portal
│       ├── services/         HTTP/state/tracking services
│       └── guards/           Frontend route guards
├── backend/                  Main Express/TypeScript API
│   └── src/
│       ├── models/           Mongoose schemas
│       ├── routes/           Mounted API routers
│       ├── controllers/      Request handling
│       ├── services/         Domain and external services
│       └── middleware/       Auth, errors, uploads
├── server/                   Separate legacy/OpenAI-oriented server; not the main API
├── scripts/                  Utility scripts
├── seed.js                   Root seed utility
└── .github/workflows/ci.yml  Frontend build CI
```

### 2.3 קשר בין השכבות

```text
Customer / Admin / Institution
            │
            ▼
Angular SPA (frontend)
            │ HTTPS + credentials
            ▼
Express API (backend/src/server.ts)
   ├── MongoDB / Mongoose
   ├── Tranzila
   ├── SMTP
   ├── Cloudinary
   ├── Google Maps
   ├── Twilio
   └── n8n webhooks
```

### 2.4 תהליך הזמנה קמעונאית מלא

1. המשתמש בוחר מוצר; `CartService` שומר סל ב־`localStorage` (`frontend/src/app/services/cart.service.ts`).
2. Checkout טוען הגדרות תאריכים ומשלוח ומחשב קופון (`checkout-page.component.ts`).
3. `POST /api/orders` או `POST /api/order/checkout` יוצר Order; בקוד קיימים שני מסלולי יצירה פעילים (`backend/src/routes/orders.routes.ts`, `backend/src/routes/order.routes.ts`).
4. `POST /api/payment/initiate/:orderId` מעביר את ההזמנה ל־`awaiting_payment`.
5. Tranzila מחזיר ל־`GET|POST /api/payment/success`; מתבצעות בדיקות response code, token וסכום.
6. ההזמנה עוברת ל־`authorized`, נוצר/מתעדכן Customer ונשלח מייל best-effort.
7. מנהל מבצע `capture`; סטטוס התשלום עובר ל־`captured` והסטטוס התפעולי ל־`processing`.
8. צוות מטפל דרך admin orders / kitchen / delivery.

### 2.5 מפת API ראשית

כל ה־mounts הבאים אומתו ב־`backend/src/server.ts`. הטבלה מתארת את תחום ה־router; הרשאה מפורטת נבחנת בסעיף 16 ובשורות R-072–R-081.

| Prefix | Route file | תחום |
|---|---|---|
| `/api/settings` | `backend/src/routes/settings.routes.ts` | הגדרות אתר, חנות ותאריכי הזמנה |
| `/api/delivery` | `backend/src/routes/delivery.routes.ts` | חישוב משלוח, תמחור וחריגות עיר |
| `/api/menu` | `backend/src/routes/menu.routes.ts` | קטלוג ציבורי ו־CRUD ניהולי |
| `/api/contact` | `backend/src/routes/contact.routes.ts` | לידים, סטטוסים וניתוח מקורות |
| `/api/catering` | `backend/src/routes/catering.routes.ts` | קייטרינג שבת/חג ואירועים |
| `/api/order` | `backend/src/routes/order.routes.ts` | checkout, admin orders, KPI, kitchen/delivery reports |
| `/api/orders` | `backend/src/routes/orders.routes.ts` | יצירת הזמנה ומסלול `myorders` נוסף |
| `/api/auth` | `backend/src/routes/auth.routes.ts` | login, register, employee login, session, logout |
| `/api/search` | `backend/src/routes/search.routes.ts` | חיפוש |
| `/api/testimonials` | `backend/src/routes/testimonials.routes.ts` | המלצות ציבוריות וניהול |
| `/api/agent` | `backend/src/routes/agent.routes.ts` | שיחה/ליד דרך agent |
| `/api/upload` | `backend/src/routes/upload.routes.ts` | העלאת תמונה/וידאו |
| `/api/shopping` | `backend/src/routes/shopping.routes.ts` | רשימת קניות מצטברת |
| `/api/employees` | `backend/src/routes/employee.routes.ts` | עובדים ונתוני עובד |
| `/api/attendance` | `backend/src/routes/attendance.routes.ts` | שעון נוכחות ודוחות |
| `/api/gallery` | `backend/src/routes/gallery.routes.ts` | גלריית תמונות |
| `/api/videos` | `backend/src/routes/video.routes.ts` | וידאו |
| `/api/coupons` | `backend/src/routes/coupon.routes.ts` | קופונים ויישום קופון |
| `/api/users` | `backend/src/routes/user.routes.ts` | משתמשים, תפקידים ונהגים |
| `/api/customers` | `backend/src/routes/customer.routes.ts` | CRM, sync ו־CSV בצד הלקוח |
| `/api/campaign` | `backend/src/routes/campaign.routes.ts` | יצירה/שיגור קמפיינים |
| `/api/holiday-events` | `backend/src/routes/holiday-event.routes.ts` | אירועי חג ומוצרים |
| `/api/payment` | `backend/src/routes/payment.routes.ts` | initiate, callback, status, capture, void |
| `/api/admin/accounting` | `backend/src/routes/accounting.routes.ts` | ledger חשבונאי ומסמכים חיצוניים |
| `/api/admin/institutions` | `backend/src/routes/institution.routes.ts` | מוסדות; כולל menu/orders/reports דרך router פנימי |
| `/api/admin/b2b-dictionary` | `backend/src/routes/b2b-dictionary.routes.ts` | מילון מנות B2B |
| `/api/portal` | `backend/src/routes/portal.routes.ts` | פורטל המוסד המחובר |

`backend/src/app.ts` ו־`backend/src/routes/auth.js` קיימים אך אינם נקודת החיבור הראשית שממופה ב־`backend/src/server.ts`; אין להסיק מהם את מצב Production בלי לבדוק את פקודת ההפעלה אצל ספק האירוח.

### 2.6 מפת מודלי הנתונים

| מודל | קובץ | שימוש מרכזי | פער משמעותי |
|---|---|---|---|
| Order | `backend/src/models/Order.ts` | הזמנות, פריטים, לקוח, תפעול ותשלום מוטמע | אין cancellation object, refund או transaction history |
| User | `backend/src/models/User.js` | לקוחות רשומים, admin, driver, institution | אין revocation/session store |
| Customer | `backend/src/models/Customer.ts` | CRM מצטבר לפי טלפון מנורמל | אין consent ledger או identity merge מלא |
| MenuItem | `backend/src/models/menuItem.ts` | מוצר, מחיר, קטגוריה, זמינות ומתכון | אין versioning של מוצר/מתכון/עלות |
| StoreSettings | `backend/src/models/store-settings.model.ts` | משלוח, תאריכים פתוחים ו־lead time | הגדרות גלובליות ללא היסטוריית שינוי |
| SiteSettings | `backend/src/models/siteSettings.model.ts` | תוכן, קישורים ופרטי אתר | אין content revision/audit |
| Coupon | `backend/src/models/coupon.model.ts` | הנחות, מגבלות שימוש ונתוני שימוש | אין transaction-safe usage שהוכח בבדיקה |
| InstitutionMenu | `backend/src/models/InstitutionMenu.ts` | תפריט מוסדי שבועי | אין version history |
| InstitutionOrder | `backend/src/models/InstitutionOrder.ts` | הזמנת מוסד לפי ימים ושבת | אין audit/version |
| Employee | `backend/src/models/Employee.js` | עובד, PIN, שכר שעתי | זהות נפרדת מ־User |
| Attendance | `backend/src/models/Attendance.js` | כניסה/יציאה ושעות | לא בוצע audit payroll |
| Contact | `backend/src/models/Contact.ts` | לידים ו־UTM | אין notification delivery history |
| Campaign | `backend/src/models/Campaign.ts` | קמפיין ו־scheduledAt | אין scheduler פנימי |
| ExternalInvoice | `backend/src/models/ExternalInvoice.ts` | מסמך/חשבונית חיצונית | אין קשר מלא ל־PaymentTransaction |
| GalleryItem / Video | `backend/src/models/GalleryItem.js`; `backend/src/models/Video.js` | מדיה ציבורית | גיבוי/retention חיצוניים לא אומתו |
| B2BMenuItem | `backend/src/models/B2BMenuItem.ts` | חישובי מנות מוסדיים | אינו inventory/ingredient master |

לא נמצא מודל `PaymentTransaction`, `AuditEvent`, `NotificationDelivery`, `Inventory`, `Supplier` או `PurchaseOrder`.

### 2.7 שמות משתני סביבה שנמצאו בקוד

ה־Audit אינו מציג ערכים. שמות שנמצאו במימוש הראשי ובאינטגרציות:

`ALLOWED_ORIGINS`, `BACKEND_URL`, `BUSINESS_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `CLOUDINARY_CLOUD_NAME`, `DATABASE_URL`, `EMAIL_FROM_DISPLAY_NAME`, `EMAIL_HOST`, `EMAIL_PASS`, `EMAIL_PORT`, `EMAIL_USER`, `FRONTEND_URL`, `GOOGLE_MAPS_API_KEY`, `JWT_EXPIRES_IN`, `JWT_SECRET`, `MONGO_URI`, `MONGODB_URI`, `N8N_CAMPAIGN_WEBHOOK_URL`, `N8N_CONTACT_WEBHOOK_URL`, `N8N_ORDER_WEBHOOK_URL`, `NODE_ENV`, `OWNER_EMAIL`, `PORT`, `TRANZILA_APP_KEY`, `TRANZILA_APP_SECRET`, `TRANZILA_HOSTED_URL`, `TRANZILA_SUCCESS_URL`, `TRANZILA_TERMINAL_NAME`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM`.

בנוסף, תיקיית `server/` הנפרדת קוראת לשמות `ADMIN_KEY`, `ALLOWED_ORIGIN`, `OPENAI_API_KEY`, `OPENAI_CHAT_MODEL`, `OPENAI_SUMMARY_MODEL`; היא אינה ה־backend הראשי לפי `backend/src/server.ts`.

---

## 3. מפת התפקידים וההרשאות

| סוג משתמש | מקור נתונים | הרשאות בפועל |
|---|---|---|
| Guest | ללא User | גלישה, checkout, טפסי קייטרינג, יצירת Order, initiate payment |
| `user` | `backend/src/models/User.js` | חשבון, `my-orders`, payment status להזמנה בבעלותו/טלפון/אימייל תואם |
| `admin` | User role | רוב מסכי `/admin`, CRUD, payments capture/void, דוחות, מוסדות |
| `driver` | User role | `/admin/delivery`; capabilities לרשימת משלוחים ושינוי סטטוס |
| `institution` | User role | `/portal`; תפריט והזמנה של המוסד המחובר |
| Employee | `backend/src/models/Employee.js` | login נפרד, שעון נוכחות ו־`/my-zone`; אינו חלק מלא מ־User RBAC |

**מימוש:** `backend/src/middleware/auth.ts`, `backend/src/config/role-access.ts`, `frontend/src/app/guards/*`, `frontend/src/app/components/admin/admin.routes.ts`, `frontend/src/app/components/portal/portal.routes.ts`.

**פער מרכזי:** Capability constants קיימים אך חלק מה־routes עדיין משתמשים ב־`requireAdmin`; אין policy audit אוטומטי המוכיח שכל route ניהולי מוגן.

---

## 4. טבלת דרישות מלאה

> חומרה מתארת את חומרת הפער, לא את חשיבות הפיצ'ר העסקי בלבד. "אין פער" משמש ליכולת שלמה ברמת קוד.

| מזהה | תחום | דרישה / יכולת | סטטוס | מה קיים בפועל | מה חסר / חלקי | קבצים רלוונטיים | Routes / Models / Services | תלות חיצונית | חומרה | המלצה | שלב |
|---|---|---|---|---|---|---|---|---|---|---|---|
| R-001 | אתר ציבורי | דפי תוכן וניווט | קיים ועובד | Home, About, Contact, legal, catering routes מחוברים | Runtime ב־Production לא נבדק | `frontend/src/app/app.routes.ts`; `frontend/src/app/components/pages/` | Angular Router | Cloudinary לתמונות מסוימות | נמוך | smoke E2E | Launch |
| R-002 | הזמנה | קטלוג אוכל מוכן | קיים ועובד | קטגוריות, פרטי מוצר, זמינות ותמחור | אין בדיקת E2E | `frontend/src/app/components/pages/ready-for-shabbat/`; `backend/src/routes/menu.routes.ts` | `MenuItem` | MongoDB, Cloudinary | בינוני | E2E קטלוג | Launch |
| R-003 | הזמנה | סל קניות | קיים ועובד | הוספה, עדכון, מחיקה ושמירה ב־localStorage | אין התאוששות סל בין מכשירים | `frontend/src/app/services/cart.service.ts`; `frontend/src/app/components/pages/cart-page/` | `CartService` | Browser storage | נמוך | test ל־pricing variants | Launch |
| R-004 | הזמנה | Checkout | קיים חלקית | פרטים, משלוח/איסוף, קופון, תאריך, terms | שני מסלולי order creation; אין E2E | `frontend/src/app/components/pages/checkout-page/checkout-page.component.ts`; `backend/src/controllers/order.controller.ts` | `POST /api/orders`; `POST /api/order/checkout` | Maps, MongoDB | גבוה | לאחד contract ולבדוק E2E | Launch |
| R-005 | הזמנה | Snapshot פריט בהזמנה | קיים חלקית | Order item שומר `name`, `price`, `quantity`, `category`, option, image, description | אין snapshot מפורש של unit/servingSize/recipe; kitchen lookup מעדיף מוצר חי | `backend/src/models/Order.ts`; `backend/src/services/order.service.ts` | `Order.items`; `getKitchenReport()` | MongoDB | גבוה | snapshot immutable מלא | Launch |
| R-006 | הזמנה | הזמנה ידנית | קיים חלקית | UI אדמין יוצר הזמנה ידנית עם paid/unpaid | `POST /api/orders` ציבורי מקבל `manualOrder`/`paymentStatus` בלי `requireAdmin`; `isPaid` אינו `paymentStatus: captured` | `frontend/src/app/components/admin/manual-order-dialog/`; `backend/src/routes/orders.routes.ts`; `backend/src/services/order.service.ts` | `createOrderFromCheckout()` | SMTP | קריטי | להגביל manualOrder ל־Admin בלבד | Launch |
| R-007 | אירועים | קייטרינג לאירועים | קיים ועובד | טופס, חישוב מחיר, שמירת `cateringKind: events` | אין תשלום מובנה לטופס; מחיר מהלקוח נשלח לשרת | `frontend/src/app/components/pages/events-catering/`; `backend/src/controllers/catering.controller.ts` | `POST /api/catering/events` | SMTP | גבוה | לחשב מחיר בצד שרת | Launch |
| R-008 | שבת/חג | טופס קייטרינג שבת וחג | קיים ועובד | מנות לפי ארוחה, כמויות, תאריכי openDates | אין תשלום מובנה ואימות E2E | `frontend/src/app/components/pages/holiday-food/`; `backend/src/controllers/catering.controller.ts` | `POST /api/catering` | SMTP | בינוני | integration test | Launch |
| R-009 | הזמנות | ניהול הזמנות באדמין | קיים ועובד | tabs, pagination, status, עריכת פריטים/תאריך/עלות, notes | אין audit; permanent delete זמין | `frontend/src/app/components/admin/admin-orders/`; `backend/src/routes/order.routes.ts` | Order admin routes | MongoDB | גבוה | audit + הגבלת delete | Launch |
| R-010 | הזמנות | סיווג מקורות | קיים ועובד | retail / catering / events לפי `orderType` ו־`cateringKind` | הזמנות legacy מזוהות באמצעות signals | `backend/src/services/order.service.ts`; `frontend/src/app/components/admin/admin-orders/` | `buildAdminOrderSourceFilter()` | MongoDB | בינוני | migration sourceType מפורש | Growth |
| R-011 | הזמנות | ארכיון ושחזור | קיים ועובד | soft delete ו־restore | אין actor/reason | `backend/src/models/Order.ts`; `backend/src/routes/order.routes.ts` | `isDeleted`; restore/delete routes | MongoDB | בינוני | audit metadata | Launch |
| R-012 | הזמנות | מחיקה לצמיתות | קיים חלקית | Admin יכול permanent delete | אובדן היסטוריה עסקית; אין policy/retention | `backend/src/routes/order.routes.ts`; `backend/src/controllers/order.controller.ts` | `DELETE /api/order/:id/permanent` | MongoDB | גבוה | לבטל או להגביל לפי policy | Launch |
| R-013 | תשלום | Pre-authorization | קיים חלקית | initiate, callback, token/amount validation, idempotency | `POST /api/payment/initiate/:orderId` ציבורי ללא ownership; תלוי Tranzila; runtime לא נבדק | `backend/src/routes/payment.routes.ts`; `backend/src/controllers/payment.controller.ts`; `backend/src/services/tranzila.service.ts` | `/api/payment/initiate`, `/success` | Tranzila | גבוה | ownership/rate-limit + staging certification | Launch |
| R-014 | תשלום | Capture | לא ניתן לאמת | קוד capture ל־authorized קיים ומוגן Admin | לא בוצעה עסקה מול ספק | `backend/src/controllers/payment.controller.ts`; `backend/src/routes/payment.routes.ts` | `POST /api/payment/capture/:orderId` | Tranzila | גבוה | test terminal + reconciliation | Launch |
| R-015 | תשלום | Void authorization | לא ניתן לאמת | קוד void קיים ומבטל Order | לא בוצעה עסקה מול ספק; אין cancel reason | אותם קבצים | `POST /api/payment/void/:orderId` | Tranzila | גבוה | בדיקת provider + audit | Launch |
| R-016 | תשלום | החזר מלא | חסר | לא נמצא route/model/status | אין refundAmount/refundId/refundedAt | `backend/src/models/Order.ts`; `backend/src/routes/payment.routes.ts` | אין | Tranzila | גבוה | PaymentTransaction + refund | Launch |
| R-017 | תשלום | החזר חלקי | חסר | לא נמצא | אין partial refund ledger | אותם קבצים | אין | Tranzila | גבוה | ledger ותמיכת provider | Launch |
| R-018 | תשלום | מקדמה ויתרה | חסר | לא נמצא | אין due/paid/balance/schedule | `backend/src/models/Order.ts` | אין | Payment provider | גבוה | Payment model | Growth |
| R-019 | תשלום | תשלום חלקי | חסר | לא נמצא | capture משתמש ב־`totalPrice` | `backend/src/controllers/payment.controller.ts` | `capturePayment()` | Tranzila | גבוה | payment allocations | Growth |
| R-020 | תשלום | היסטוריית ניסיונות | חסר | transactionId יחיד על Order | אין attempts, response history או idempotency key ledger | `backend/src/models/Order.ts` | אין Payment model | Tranzila | גבוה | PaymentTransaction model | Launch |
| R-021 | תשלום | סכום ששולם ויתרה | חסר | `authorizedAmount` בלבד | אין paidAmount/refundedAmount/balance | `backend/src/models/Order.ts` | Order payment fields | — | גבוה | שדות מחושבים מה־ledger | Launch |
| R-022 | תשלום | התאמת סטטוס הזמנה/תשלום | קיים חלקית | capture מעביר ל־processing; void ל־cancelled | שינוי status ידני אינו אוכף payment policy | `backend/src/controllers/payment.controller.ts`; `backend/src/controllers/order.controller.ts` | status routes | — | גבוה | transition policy | Launch |
| R-023 | ביטול | סיבת ביטול | חסר | `cancelled` קיים | אין reason | `backend/src/models/Order.ts` | Order.status | — | גבוה | cancellation object | Launch |
| R-024 | ביטול | מבצע ומועד ביטול | חסר | `updatedAt` כללי בלבד | אין cancelledBy/cancelledAt/source | `backend/src/models/Order.ts` | timestamps | — | גבוה | actor metadata | Launch |
| R-025 | ביטול | השפעה על הכנסות | קיים חלקית | חלק מהדוחות מסננים `cancelled` | אין אחידות ואין refunds | `backend/src/services/order.service.ts` | revenue methods | — | גבוה | RevenuePolicy אחידה | Launch |
| R-026 | Audit | Audit Log מרכזי | חסר | לא נמצא Model/Service/Middleware | אין actor, before/after, IP, source | `backend/src/models/`; `backend/src/routes/` | אין | — | גבוה | AuditEvent model + middleware | Launch |
| R-027 | KPI | הכנסה חודשית | קיים חלקית | `getDashboardStats()` מסכם `authorized` ו־`captured` לפי `createdAt` | authorized טרם נגבה; אין refunds | `backend/src/services/order.service.ts` | `getDashboardStats()` | MongoDB | גבוה | רק captured net refunds לפי paidAt | Launch |
| R-028 | KPI | הכנסה לפי מקור | קיים חלקית | UTM aggregation | אין filter paymentStatus; כל non-cancelled נספר | אותו קובץ | `getRevenueBySource()` | MongoDB | גבוה | RevenuePolicy | Launch |
| R-029 | KPI | הכנסה חודשית בגרף | קיים חלקית | aggregation לפי חודש | אין payment filter; לפי createdAt | אותו קובץ | `getMonthlyRevenue()` | MongoDB | גבוה | paidAt + captured | Launch |
| R-030 | KPI | מגמת 7 ימים | קיים חלקית | endpoint וגרף | בכשל מוצגים נתוני Math.random | `frontend/src/app/components/admin/dashboard/dashboard.component.ts` | `initializeChartWithDummyData()` | — | גבוה | empty/error state בלבד | Launch |
| R-031 | KPI | מספר הזמנות | קיים חלקית | counts קיימים | בחלק מהשאילתות cancelled/deleted/payment failed אינם אחידים | `backend/src/services/order.service.ts`; dashboard component | stats endpoints | MongoDB | בינוני | metric definitions | Launch |
| R-032 | KPI | ממוצע הזמנה | חסר | לא נמצא KPI | אין AOV endpoint/UI | dashboard files | אין | — | בינוני | net revenue / paid orders | Growth |
| R-033 | KPI | לקוחות חוזרים | קיים חלקית | Customer שומר orderCount/totalSpent; מסך segments | אין KPI trend/cohort; תלוי sync | `backend/src/models/Customer.ts`; `frontend/src/app/components/admin/admin-customers/` | Customer CRM APIs | MongoDB | בינוני | repeat-rate endpoint | Growth |
| R-034 | KPI | מנות מובילות | חסר | אין KPI Dashboard מאומת | ניתן לחשב מ־Order.items | `backend/src/models/Order.ts` | אין endpoint ייעודי | MongoDB | בינוני | product analytics snapshot | Growth |
| R-035 | KPI | ביטולים והחזרים | חסר | אין dashboard metric | אין refunds/cancel metadata | dashboard + Order | אין | — | גבוה | לאחר payment/cancel model | Launch |
| R-036 | KPI | פילטר יום/שבוע/חודש | קיים חלקית | `getOrderStatistics(period)` תומך תקופות; UI dashboard ללא controls מלאים | הגדרות revenue לא אחידות | `backend/src/services/order.service.ts`; dashboard | stats routes | MongoDB | בינוני | date-filter API/UI אחיד | Growth |
| R-037 | KPI | טווח תאריכים מותאם | קיים חלקית | order lists תומכים טווח; revenue methods מקבלים filters פנימיים | dashboard frontend לא שולח טווח מלא | admin orders + order service | query filters | — | בינוני | DateRangePicker KPI | Growth |
| R-038 | מטבח | ריכוז כמויות לפי מנה | קיים ועובד | aggregation של packages/weight | אין test fixtures | `backend/src/services/order.service.ts`; `frontend/src/app/components/modals/kitchen-report-modal/` | `GET /api/order/kitchen-report` | MongoDB | בינוני | golden integration tests | Launch |
| R-039 | מטבח | חלוקה לפי ארוחה | קיים חלקית | catering fields evening/morning קיימים; דוחות order-specific | aggregate retail report אינו מטריצה מלאה לכל meal | `backend/src/models/Order.ts`; admin orders | catering arrays | — | בינוני | report schema אחיד | Growth |
| R-040 | מטבח | משלוח מול איסוף | קיים חלקית | delivery report ודפי הזמנה כוללים method | kitchen aggregate אינו מחלק תמיד לפי method | order service + delivery management | delivery report | Maps | בינוני | dimension ב־report | Growth |
| R-041 | מטבח | הערות הזמנה/מנה | קיים חלקית | customer notes/adminNotes/description קיימים | אין item-level kitchen note מובנה | `backend/src/models/Order.ts`; admin orders | notes fields | — | בינוני | itemNotes snapshot | Launch |
| R-042 | מטבח | אלרגנים | חסר | Customer dietaryInfo קיים, אך לא נמצא allergen snapshot/report flow | אין field/item validation והדגשה בדוח | `backend/src/models/User.js`; Order | אין | — | גבוה | allergens per order/item | Launch |
| R-043 | מטבח | תאריך, שעה וכתובת | קיים חלקית | eventDate/address/deliveryType נשמרים | שעת אספקה אינה schema אחיד לכל order | `backend/src/models/Order.ts`; checkout | customerDetails | Maps | בינוני | deliverySlot snapshot | Launch |
| R-044 | מטבח | הדפסה | קיים ועובד | browser print לדוח aggregate ולקייטרינג | תלוי דפדפן | kitchen modal; admin orders | `window.print()` | Browser | נמוך | print regression test | Launch |
| R-045 | מטבח | PDF אמיתי | חסר | אין generator/download | Save as PDF בדפדפן אינו PDF יישומי | frontend/backend package files | אין | — | בינוני | server/client PDF | Launch |
| R-046 | מטבח | Excel/CSV | חסר | אין kitchen export | אין library/route | package files; kitchen modal | אין | — | בינוני | CSV תחילה, XLSX Growth | Launch |
| R-047 | CRM | כרטיס לקוח | קיים ועובד | פרטים, notes, tags, history, totals | אין audit/consent history | `backend/src/models/Customer.ts`; `frontend/src/app/components/admin/admin-customers/` | `/api/customers` | MongoDB | בינוני | audit + consent | Growth |
| R-048 | CRM | זיהוי לקוח חוזר | קיים חלקית | normalizedPhone, orderCount, orderHistory | התאמה מבוססת טלפון; איכות sync לא נבדקה | `backend/src/services/customer.service.ts`; Customer model | customer upsert | MongoDB | בינוני | identity rules + tests | Growth |
| R-049 | CRM | מנות מועדפות | חסר | orderHistory קיים | אין aggregation/UI favorites | Customer + Order | אין | — | נמוך | product affinity | Growth |
| R-050 | CRM | הסכמה לשיווק והסרה | חסר | cookie consent אינו marketing opt-in ללקוח | אין optInAt/optOutAt/source | Customer/User models | אין | WhatsApp/Email provider | גבוה | consent ledger | Launch |
| R-051 | קופונים | יצירה ושימוש | קיים ועובד | limits, expiry, targeting, revenue fields | אין audit; race/transaction לא אומתו | `backend/src/models/coupon.model.ts`; admin coupons | `/api/coupons` | MongoDB | בינוני | integration concurrency tests | Growth |
| R-052 | ייצוא | CSV לקוחות | קיים ועובד | filtered CSV קיים | נדרש אימות RTL/encoding ידני | `frontend/src/app/components/admin/admin-customers/admin-customers.component.ts` | client CSV | Browser | נמוך | UTF-8 BOM test | Launch |
| R-053 | ייצוא | הזמנות | חסר | print בלבד | אין CSV/XLSX/PDF structured | admin orders | אין | — | בינוני | CSV orders | Growth |
| R-054 | ייצוא | תשלומים/חשבונאות | חסר | ledger UI, מסמכים חיצוניים | אין export | accounting component/routes | אין | — | בינוני | CSV + reconciliation | Growth |
| R-055 | ייצוא | מוצרים וקופונים | חסר | CRUD/UI | אין export | menu/coupon admin | אין | — | נמוך | CSV export | Growth |
| R-056 | מייל | אישור הזמנה | קיים חלקית | templates ושליחה ללקוח/עסק; כשל אינו מבטל Order | אין queue/retry/delivery status | `backend/src/services/email.service.ts`; payment/catering controllers | EmailService | SMTP | בינוני | MessageDelivery + queue | Launch |
| R-057 | מייל | כשל שליחה אינו מפיל הזמנה | קיים ועובד | Order נשמר לפני email; exceptions נתפסות | אין alert/retry | `backend/src/controllers/catering.controller.ts`; `backend/src/controllers/order.controller.ts` | try/catch סביב email | SMTP | בינוני | persist failure + retry | Launch |
| R-058 | WhatsApp | CTA ידני | קיים ועובד | `wa.me` עם טקסט מוכן במסכים | אין delivery tracking | `frontend/src/app/constants/contact.constants.ts`; shared CTA | links | WhatsApp | נמוך | להשאיר כ־fallback | Launch |
| R-059 | WhatsApp | אישורי הזמנה אוטומטיים | חסר | Twilio משמש רק `sendLeadWhatsApp` ב־agent | אין order templates/webhook/status | `backend/src/services/whatsapp.service.ts`; `backend/src/services/agent.service.ts` | Twilio lead only | Twilio/Meta BSP | בינוני | ספק + templates + consent | Growth |
| R-060 | הודעות | Queue וניסיונות חוזרים | חסר | direct calls / fire-and-forget webhook | אין job model, retry, DLQ | email/whatsapp/webhook services | אין queue | SMTP, Twilio, n8n | גבוה | durable queue | Growth |
| R-061 | התראות | התראות אדמין | קיים חלקית | email על הזמנה, auto-refresh orders | אין notification center; אין alerts לכשל/חוסר תשלום | admin orders; email service | direct email | SMTP | בינוני | Notification model | Growth |
| R-062 | Analytics | GA4 | לא ניתן לאמת | loader, service ו־pageviews קיימים | runtime/consent events לא נבדקו | `frontend/src/index.html`; `frontend/src/app/services/analytics.service.ts` | gtag | Google | בינוני | Consent Mode test | Launch |
| R-063 | Analytics | Meta Pixel | קיים חלקית | SDK, PageView, CTA tracking | noscript pixel אינו consent-gated; form submit tracking לא מחובר | `frontend/src/index.html`; tracking services | fbq | Meta | גבוה | privacy review | Launch |
| R-064 | משימות | Cron / scheduler | חסר | `scheduledAt` לקמפיין נשמר; לא נמצא runner | אין cron/jobs | `backend/src/models/Campaign.ts`; `backend/package.json` | אין | n8n אפשרי | בינוני | external scheduler contract | Growth |
| R-065 | גיבוי | DB backup אוטומטי | לא ניתן לאמת | MongoDB connection קיים | אין backup config/code/doc | `backend/src/server.ts`; env names | Mongoose | MongoDB host | גבוה | לאמת provider policy | Launch |
| R-066 | גיבוי | תהליך שחזור | לא ניתן לאמת | לא נמצא runbook | לא ידוע RPO/RTO או test restore | הפרויקט כולו | אין | MongoDB host | גבוה | staging restore drill | Launch |
| R-067 | גיבוי | גיבוי מדיה | לא ניתן לאמת | Cloudinary מארח assets | אין export/backup/restore docs | Cloudinary config/upload | upload routes | Cloudinary | בינוני | media export policy | Growth |
| R-068 | בדיקות | Unit tests | חסר | tooling frontend קיים בלבד | אין test files; backend test נכשל בכוונה | package files | npm test scripts | — | גבוה | domain unit tests | Launch |
| R-069 | בדיקות | Integration tests | חסר | לא נמצאו | אין DB/API test harness | repository | אין | Mongo test DB | גבוה | API integration suite | Launch |
| R-070 | בדיקות | E2E tests | חסר | לא נמצאו Playwright/Cypress | אין checkout/admin/portal E2E | package files | אין | test providers | גבוה | Playwright test mode | Launch |
| R-071 | CI | Build pipeline | קיים חלקית | GitHub Action בונה frontend ומוודא index | backend build/test/security scan אינם ב־CI | `.github/workflows/ci.yml` | GitHub Actions | GitHub | גבוה | frontend+backend+tests | Launch |
| R-072 | אבטחה | Image upload auth | חסר | POST image upload public | אין authenticate/requireAdmin | `backend/src/routes/upload.routes.ts` | `POST /api/upload` | Cloudinary | קריטי | להגן מיד לאחר אישור | Launch |
| R-073 | אבטחה | Video upload auth | קיים ועובד | authenticate + requireAdmin | runtime לא נבדק | אותו קובץ | `POST /api/upload/video` | Cloudinary | נמוך | security test | Launch |
| R-074 | אבטחה | Admin order routes | קיים ועובד | routes רגישים משתמשים auth + admin/capability | coverage policy לא אוטומטי | `backend/src/routes/order.routes.ts` | admin order routes | — | בינוני | route authorization tests | Launch |
| R-075 | אבטחה | JWT וסיסמאות | קיים חלקית | bcrypt למשתמשי User, JWT, HttpOnly cookie | PIN עובד ב־plaintext (`Employee.pinCode`); אין refresh/revocation; session 7d | `backend/src/models/User.js`; `backend/src/models/Employee.js`; `backend/src/middleware/auth.ts` | auth / employee-login | — | גבוה | hash PIN + revocation | Launch |
| R-076 | אבטחה | Rate limiting | קיים חלקית | login, checkout, order, coupon וכללי API | לא לכל טפסי public באופן ייעודי | server + route files | express-rate-limit | — | בינוני | endpoint policy + tests | Launch |
| R-077 | אבטחה | CORS | קיים חלקית | allowlist logic ב־server | ערכי production לא נבדקו | `backend/src/server.ts` | cors middleware | deployment env | בינוני | verify allowed origins | Launch |
| R-078 | אבטחה | CSRF | חסר | cookie `sameSite:none` בפרוד; לא נמצא CSRF token middleware | state-changing cookie-auth requests ללא CSRF layer מפורש | auth routes; server | JWT cookie | Browser | גבוה | CSRF token/origin enforcement | Launch |
| R-079 | אבטחה | NoSQL sanitization | קיים ועובד | `mongoSanitize()` ב־main server | coverage תלוי server.ts ולא app.ts | `backend/src/server.ts` | middleware | — | נמוך | integration test | Launch |
| R-080 | אבטחה | Validation | קיים חלקית | validations ידניות/Joi dependency | contracts מפוזרים; client totals בחלק מהflows | controllers; package | Joi חלקי | — | גבוה | schemas מרכזיים | Launch |
| R-081 | אבטחה | הגנת ספאם | קיים חלקית | rate limits קיימים | אין CAPTCHA/honeypot/abuse telemetry | public routes | rate-limit | CAPTCHA אופציונלי | בינוני | risk-based spam control | Growth |
| R-082 | מוסדות | פורטל והזמנה שבועית | קיים ועובד | menu, deadlines, weekday/Shabbat order | אין E2E | portal components; institution models/routes | `/api/portal`; institution APIs | MongoDB | גבוה | isolation E2E | Launch |
| R-083 | מוסדות | הפרדת נתוני מוסד | קיים חלקית | backend משתמש institution identity ו־guards | לא בוצעה penetration test; admin APIs רחבים | portal routes/controllers; institution guard | User role institution | — | גבוה | tenant-isolation tests | Launch |
| R-084 | עובדים | עובדים ונוכחות | קיים חלקית | Employee, PIN clock, attendance/report | security של PIN ו־payroll לא נבדקה; Employee/User כפולים | employee/attendance models/routes/components | employee APIs | MongoDB | בינוני | threat model + tests | Growth |
| R-085 | תפעול | רשימת קניות | קיים ועובד | aggregation לפי recipes, safety margin, print/WhatsApp | תלוי recipes לא מלאים; אין inventory transaction | shopping controller/component; `menuItem.recipe` | `/api/shopping` | MongoDB | בינוני | recipe completeness report | Growth |
| R-086 | Scale | מלאי | חסר | לא נמצא Inventory/StockMovement model | כל יכולות המלאי חסרות | `backend/src/models/` | אין | — | בינוני | מודל inventory לאחר Launch | Scale |
| R-087 | Scale | מתכונים ועלויות | קיים חלקית | `recipe[]` בפריט ותשתית shopping list | אין ingredient master, cost history, margin | `backend/src/models/menuItem.ts`; shopping service | recipe fields | — | בינוני | Ingredient/RecipeVersion | Scale |
| R-088 | Scale | ספקים ורכש | חסר | לא נמצאו Supplier/PO/GoodsReceipt | המודול חסר | `backend/src/models/`; admin routes | אין | — | נמוך | לתכנן אחרי inventory | Scale |
| R-089 | חשבוניות | רישום חשבוניות חיצוניות | קיים חלקית | ExternalInvoice + upload + accounting UI | אין אינטגרציה מלאה למערכת חשבוניות/זיכויים | `backend/src/models/ExternalInvoice.ts`; accounting routes/components | `/api/admin/accounting` | ספק חשבוניות | בינוני | invoice adapter | Growth |
| R-090 | חשבוניות | מסמך מ־Tranzila | לא ניתן לאמת | capture שולח context itemized לספק | הפקת מסמך בפועל תלויה terminal/provider | `backend/src/services/tranzila.service.ts` | capture API | Tranzila | בינוני | certification + document IDs | Growth |
| R-091 | דמו | Seed data | קיים חלקית | root/backend seed ומיגרציות קיימים | חלק מה־seeds מבצעים `deleteMany` ומסוכנים ל־prod; אין seed דמו אנונימי מוגן | `seed.js`; `backend/seed.js`; `scripts/seed-orders.js` | seed scripts | MongoDB | קריטי | seed רק עם guard לסביבת demo | Launch |
| R-092 | דמו | איפוס סביבת דמו | חסר | לא נמצא reset בטוח | אין environment guard/snapshot/reset; `getAllMenuItems` מוחק תפריט אם `<5` פריטים | `backend/src/controllers/menu.controller.ts`; scripts | `MenuItem.deleteMany` | MongoDB | קריטי | להסיר auto-wipe + reset staging מפורש | Launch |
| R-093 | דמו | פרטיות נתוני דמו | חסר | אין policy/fixture ייעודי | סיכון שימוש בנתוני אמת | seed/scripts | אין | — | גבוה | synthetic fixtures בלבד | Launch |
| R-094 | Deployment | תצורת deployment בקוד | קיים חלקית | CI frontend; environment files; production URLs | אין `vercel.json`/`render.yaml`/Docker; dashboard settings חיצוניות | `.github/workflows/ci.yml`; environment files | CI/build | Vercel/Render | בינוני | deployment runbook | Launch |
| R-095 | DB | Hosting MongoDB | לא ניתן לאמת | קיימים שמות env לחיבור Mongo | סוג plan/backup/region אינם בקוד | `backend/src/server.ts`; env variable names | Mongoose | MongoDB provider | גבוה | vendor evidence | Launch |
| R-096 | DB | אינדקסים | קיים חלקית | Order ו־Customer כוללים אינדקסים שימושיים | לא בוצע explain/production workload audit | `backend/src/models/Order.ts`; `backend/src/models/Customer.ts` | Mongoose indexes | MongoDB | בינוני | explain plans על reports | Growth |
| R-097 | יציבות | Logging | קיים חלקית | morgan + console + error middleware | אין structured correlation/central log/PII policy | `backend/src/server.ts`; controllers | logs | hosting logs | בינוני | structured logger | Growth |
| R-098 | יציבות | Retry לשירותים חיצוניים | חסר | אין retry policy כללית | SMTP/Twilio/n8n/Tranzila failures ללא durable retry | external services/utilities | direct calls | external providers | גבוה | queue + retry policy | Growth |
| R-099 | ביצועים | תמונות | קיים חלקית | Angular image loader/Cloudinary transformations | assets מקומיים גדולים וחלק מה־img ללא optimized loader | `frontend/src/app/app.config.ts`; components/media | IMAGE_LOADER | Cloudinary | בינוני | image budget/Lighthouse | Launch |
| R-100 | ביצועים | שאילתות דוחות | קיים חלקית | aggregations ו־indexes בסיסיים | kitchen `$lookup`, dashboard aggregations ללא evidence של explain | `backend/src/services/order.service.ts` | Mongo aggregations | MongoDB | בינוני | production-like explain/load test | Growth |

---

## 5. אתר ציבורי ותהליך הזמנה

### קיים

- Routes ציבוריים מוגדרים ב־`frontend/src/app/app.routes.ts`.
- Ready-for-Shabbat משתמש ב־lazy routes ב־`frontend/src/app/components/pages/ready-for-shabbat/ready-for-shabbat.routes.ts`.
- סל נשמר מקומית דרך `CartService`.
- Checkout כולל:
  - פרטי לקוח;
  - תאריך פתוח ו־cutoff;
  - משלוח/איסוף;
  - תמחור משלוח;
  - קופון;
  - terms acceptance;
  - יצירת הזמנה והעברה לתשלום.

### פערי אמינות

- קיימים שני endpoints ליצירת הזמנה (`/api/orders` ו־`/api/order/checkout`), ולכן נדרש contract אחד כדי למנוע סטייה בין validation, coupons, CRM ו־webhooks.
- במסלולים מסוימים הלקוח שולח מחיר/סה"כ. בחלק מה־checkout הסכום מתוקן בשרת, אך בטופס events מחיר למנה וסה"כ מתקבלים מה־body.
- אין test שמוכיח שסכום סל, קופון, משלוח והסכום שנשלח ל־Tranzila תמיד זהים.

---

## 6. ניהול הזמנות באדמין

`frontend/src/app/components/admin/admin-orders/admin-orders.component.ts` ו־`.html` מספקים:

- חלוקה ל־retail, catering, events.
- חלוקה ל־pending, processing, ready, failed ו־archive.
- server pagination, חיפוש, מיון וטווחי תאריך.
- יצירת הזמנה ידנית.
- עריכת פריטים, כמויות, מחיר משלוח, תאריך ו־admin notes.
- capture/void.
- הדפסת הזמנה ודוחות מטבח.
- bulk status/archive/restore/permanent delete.

### סיכונים

- כל שינוי מחיר/פריט/סטטוס מתבצע ללא Audit Log.
- permanent delete מאפשר אובדן היסטוריה פיננסית ותפעולית.
- שינוי סכום אחרי authorization עשוי ליצור mismatch; קיימת אזהרה UI, אך אין ledger שמסביר את השינוי.
- שינוי סטטוס תפעולי אינו כפוף למכונת מצבים עסקית מול payment status.

---

## 7. הזמנות שבת, חג ואירועים

### אוכל מוכן

Order רגיל שומר snapshots בסיסיים של פריטים וזורם לתשלום. התאריכים נשלטים באמצעות `StoreSettings.openDates`, `openDateRules` ו־`minimumLeadDays`.

### קייטרינג שבת וחג

`HolidayFoodComponent` אוסף portion counts ופריטי ארוחה נפרדים. `submitCateringOrder()` יוצר Order מסוג catering ושולח מייל לאחר השמירה.

### קייטרינג אירועים

`EventsCateringComponent` מחשב מחיר בצד לקוח. `submitEventCateringOrder()` מקבל את המחיר ושומר אותו. כדי להציג מוצר מסחרי אמין, השרת צריך לחשב או לאמת תמחור מול גרסת מחיר/חבילה שמורה.

---

## 8. פורטל מוסדות

### מבנה

- מוסד הוא `User` עם role `institution`; אין Institution master model נפרד.
- `InstitutionMenu` שומר תפריט שבועי.
- `InstitutionOrder` שומר ימים, כמויות, notes ו־Shabbat order.
- `/api/portal` משרת את המוסד המחובר.
- `/api/admin/institutions` מאפשר ניהול על ידי Admin.

### מוכנות

המודול ראוי לדמו תפעולי, אך לפני מכירה נדרשים:

- בדיקות isolation בין שני מוסדות.
- Audit על שינוי תפריט/דדליין/הזמנה.
- versioning לתפריט שבועי.
- ייצוא מובנה של production/packing.

---

## 9. מודל התשלומים הקיים

### שדות קיימים ב־Order

`paymentStatus`, `authCode`, `transactionId`, `cardToken`, expiry, `authorizedAmount`, `paymentSecurityToken`, `confirmationEmailSentAt`.

### מכונת מצבים קיימת

```text
pending
  └── initiate → awaiting_payment
        └── callback valid → authorized
              ├── admin capture → captured + order.processing
              └── admin void → voided + order.cancelled
        └── callback invalid/declined → failed
```

### הגדרת הכנסה בפועל

אין הגדרה אחת:

1. `getDashboardStats()`:
   - מסנן `status != cancelled`;
   - כולל `paymentStatus in ['authorized', 'captured']`;
   - משתמש ב־`createdAt` של ההזמנה.
2. `getOrderStatistics()`:
   - מסנן רק `status != cancelled`;
   - אינו מסנן payment status.
3. `getRevenueBySource()` ו־`getMonthlyRevenue()`:
   - מסננים `status != cancelled` ו־soft delete;
   - אינם מסננים payment status.
4. Accounting משתמש ב־captured orders וב־ExternalInvoice, אך הוא אינו מקור האמת היחיד לכל דשבורד.

**הגדרה מומלצת:** הכנסה נטו = סכום captures בפועל פחות refunds בפועל, לפי `capturedAt/refundedAt`, ולא לפי `Order.createdAt`. `authorized` אינו הכנסה.

---

## 10. ביטולים והחזרים

### קיים

- סטטוס תפעולי `cancelled`.
- `void` ל־authorization ומעבר ל־`paymentStatus: voided`.
- archive/restore.

### חסר

- cancellation reason;
- cancellation actor;
- cancelledAt;
- source: customer/admin/system/provider;
- full/partial refund;
- refunded amount;
- refund provider reference;
- effect on coupon usage/customer totals;
- notification status;
- reversal of accounting/KPI.

### מבנה נתונים מומלץ

```text
Order.cancellation {
  reasonCode, reasonText, cancelledAt, cancelledBy, source
}

PaymentTransaction {
  orderId, type, amount, status, provider, providerReference,
  attemptedAt, completedAt, failureCode, initiatedBy, metadata
}
```

---

## 11. דשבורד והגדרת מדדי KPI

### מדדים קיימים

- total orders;
- active/popular products;
- new/pending orders;
- events today;
- monthly revenue;
- 7-day trend;
- revenue by UTM source;
- monthly revenue chart.

### הגדרות נדרשות לפני פיתוח

| KPI | הגדרה מומלצת |
|---|---|
| הכנסה | captured transactions פחות completed refunds |
| מספר הזמנות | הזמנות שאינן test/deleted; להציג created ו־paid בנפרד |
| ממוצע הזמנה | net captured revenue / captured orders |
| לקוח חוזר | identity יציבה עם לפחות שתי הזמנות paid בזמנים שונים |
| מנה מובילה כמות | סכום snapshot quantity בפריטי captured/non-cancelled orders |
| מנה מובילה הכנסה | סכום item snapshot line totals, לאחר הקצאת discounts/refunds |
| ביטולים | cancellation events / created orders |
| טווח תאריך | payment date למדדי כסף; creation date ל־demand; delivery date לתפעול |

**חסם:** אין להתחיל redesign של הדשבורד לפני PaymentTransaction ו־RevenuePolicy.

---

## 12. דוח מטבח וייצוא

### קיים

- `OrderService.getKitchenReport()`:
  - מסנן active statuses;
  - יכול לסנן תאריך;
  - מסכם packages/weight;
  - משייך category;
  - כולל meta.
- מסכי הדפסה:
  - aggregate kitchen report;
  - catering kitchen sheet;
  - shopping list;
  - delivery manifest;
  - institution production/packing.

### פערים

- אין PDF generator.
- אין CSV/XLSX לדוח מטבח.
- אין item-level allergy/note schema.
- הקטגוריה בדוח מעדיפה Product חי באמצעות `$lookup`.
- אין report snapshot או test שמוכיח שהדוח לא משתנה אחרי עריכת מוצר.

---

## 13. CRM ושימור לקוחות

### קיים

- Customer לפי normalized phone.
- order count, total spent, last order, history.
- tags, notes, category, VIP/blacklist.
- customer CSV.
- customer-targeted coupons.

### חסר

- opt-in/opt-out לשיווק עם מקור וזמן.
- customer identity resolution מעבר לטלפון.
- favorite dishes/cohorts/churn/repeat-rate.
- automated feedback/win-back.
- delivery status להודעות.
- audit של עריכת כרטיס לקוח.

---

## 14. מיילים ו־WhatsApp

### Email

EmailService תומך במיילי contact, order, payment confirmation, update ו־catering. ברוב מסלולי ההזמנה ההזמנה נשמרת לפני המייל, וכשל מייל נתפס ונרשם; לכן כשל SMTP אינו מבטל את ההזמנה.

### WhatsApp

- frontend: קישורי `wa.me`.
- backend: Twilio `sendLeadWhatsApp` בהקשר agent lead בלבד.
- אין WhatsApp order lifecycle.
- אין templates registry, consent, delivery webhook, retry או queue.

### אפשרויות ספק

| ספק | יתרון | מגבלה |
|---|---|---|
| Meta WhatsApp Cloud API | ישיר, שליטה מלאה | דורש templates/webhooks/consent ותפעול |
| Twilio WhatsApp | SDK קיים בפרויקט | עלות מתווך ותלות ב־Twilio |
| BSP ישראלי | תמיכה מקומית | API/עלות/vendor lock-in משתנים |

אין לבחור ספק לפני הגדרת MessageDelivery model ודרישות consent.

---

## 15. העלאת קבצים ומדיה

### קיים

- תמונות Cloudinary.
- וידאו Cloudinary/YouTube.
- gallery/video admin.
- accounting document upload.

### ממצא קריטי

`router.post('/', upload.single('image'), ...)` ב־`backend/src/routes/upload.routes.ts` אינו מוגן. לעומתו upload video משתמש ב־`authenticate` ו־`requireAdmin`.

### נדרש

- Authentication + authorization.
- MIME/content validation ולא רק extension.
- size policy נפרדת לתמונה/וידאו.
- rate limit ו־quota.
- ownership/folder rules.
- audit של uploads/deletes.

---

## 16. אבטחה והרשאות API

### בקרות קיימות

- Helmet, compression, CORS.
- general API rate limiter.
- endpoint rate limit ל־login/checkout/order/coupon.
- `express-mongo-sanitize`.
- JWT verification ו־active user lookup.
- role/capability middleware.
- bcrypt password hashing.
- HttpOnly/secure cookies ב־Production.
- select:false לשדות תשלום רגישים.

### פערים

1. Public image upload.
2. Public `POST /api/orders` מקבל `manualOrder`/`paymentStatus` ללא `requireAdmin`.
3. אין CSRF middleware מפורש כאשר cookie משתמש ב־`sameSite:none`.
4. Validation מפוזר וידני.
5. אין route-policy test.
6. אין audit/revocation; PIN עובד ב־plaintext.
7. optional auth מדפיס payload/user identifiers ל־console ב־`order.routes.ts`; נדרש PII logging review.
8. initiate payment ציבורי לפי orderId; קיימות guards פנימיות, אך אין ownership/rate limit ייעודי ב־route.
9. `getAllMenuItems` מוחק ו־seed מחדש את התפריט כאשר יש פחות מ־5 פריטים.

### Routes ניהוליים

ב־routes שנבדקו, רוב פעולות admin ב־order/payment/institution/customer/coupon/settings משתמשות ב־auth/role middleware. החריגות המוכחות כוללות image upload ציבורי ו־manual-order flags ב־`POST /api/orders` הציבורי. יש להשלים inventory אוטומטי של כל route ב־CI כדי למנוע regression.

| קבוצת Route | מצב הרשאה שנמצא |
|---|---|
| Payment capture/void | `authenticate` + `requireAdmin` ב־`backend/src/routes/payment.routes.ts` |
| Institutions + nested menu/reports | router-level `authenticate` + `requireAdmin` ב־`backend/src/routes/institution.routes.ts` |
| Settings mutations | `authenticate` + `requireAdmin` ב־`backend/src/routes/settings.routes.ts` |
| Menu/gallery/video/holiday/testimonial mutations | פעולות mutation משתמשות ב־`authenticate` + `requireAdmin` בקובצי ה־routes המתאימים |
| Customer/user/coupon/campaign/accounting management | מוגן ב־auth/admin middleware בקובצי ה־routes |
| Image upload | **לא מוגן** ב־`backend/src/routes/upload.routes.ts` |
| Video upload | מוגן ב־`authenticate` + `requireAdmin` באותו קובץ |
| Public order create | `optionalAuthenticate` בלבד; מקבל `manualOrder`/`paymentStatus` — **פער הרשאות** |
| Payment initiate | ציבורי במכוון עבור guest checkout; מקבל `orderId` בלבד, ולכן דורש threat-model ו־rate-limit/anti-abuse ייעודי |

### ליקויי סדר Routes שנמצאו

- `backend/src/routes/gallery.routes.ts` רושם `GET /:id` לפני `GET /stats`; לכן המחרוזת `stats` עלולה להיבלע כ־ID וה־handler הניהולי המוגן אינו נגיש במסלול המיועד. זהו ליקוי חיבור/יציבות, לא הוכחה לעקיפת `requireAdmin` של handler הסטטיסטיקה.
- `backend/src/routes/employee.routes.ts` רושם `GET /:id` המוגן Admin לפני `GET /my/stats`; בקשת עובד ל־`/my/stats` עלולה להיתפס כ־`:id` ולהיחסם לפני ה־self-service handler.

---

## 17. גיבוי ושחזור

### מה ניתן לאמת

- האפליקציה מתחברת ל־MongoDB באמצעות environment variable.
- מדיה נשמרת ב־Cloudinary.
- מסמכי accounting עשויים להישמר דרך upload provider.

### מה לא ניתן לאמת

- ספק/plan MongoDB.
- snapshots אוטומטיים.
- frequency ו־retention.
- Point-in-time restore.
- גיבוי Cloudinary.
- גיבוי מסמכים חיצוניים.
- restore runbook.
- restore drill שבוצע.

### תוכנית בדיקת שחזור בטוחה

1. לקבל מספקי DB/media export של policy ו־retention.
2. ליצור staging project מבודד ללא outbound email/WhatsApp/payment.
3. לשחזר snapshot ל־DB חדש.
4. לחבר build staging עם secrets staging בלבד.
5. להריץ count/hash checks על orders/customers/menu/media references.
6. לבצע smoke read-only.
7. למחוק staging restored data לפי policy.
8. לתעד RPO, RTO, owner ותוצאה.

---

## 18. בדיקות ואיכות קוד

| מסלול | אוטומציה קיימת | סוג נדרש | תוצאה צפויה | חומרת כשל |
|---|---|---|---|---|
| הזמנה רגילה | אין | E2E + Integration | Order וסכום מדויקים | קריטי |
| הזמנה ידנית | אין | Integration | source/paid state נכונים | גבוה |
| שינוי הזמנה | אין | Integration | snapshots/totals/audit | גבוה |
| ביטול | אין | Integration | cancel/refund/KPI עקביים | קריטי |
| תשלום מוצלח | אין | Provider sandbox E2E | authorize/capture idempotent | קריטי |
| תשלום נכשל | אין | Integration | failed, cart retained | גבוה |
| החזר | לא קיים | Integration/E2E | ledger+KPI+notification | קריטי |
| תשלום חלקי | לא קיים | Integration | paid/balance נכון | גבוה |
| מייל לקוח/עסק | אין | Integration עם fake SMTP | order נשמר; status מתועד | בינוני |
| הרשאות | אין | API integration | 401/403 לפי role | קריטי |
| מובייל | אין | E2E visual | routes/forms usable | גבוה |
| עומס | אין | Load | checkout/report SLAs | גבוה |
| אבטחה | אין | SAST/DAST/API | אין upload/IDOR/CSRF | קריטי |
| Backup/Restore | אין | Manual controlled drill | RPO/RTO מתקיימים | קריטי |
| Analytics | אין | Browser integration | consent + no dummy | גבוה |
| WhatsApp | אין | Provider sandbox | delivery/retry/status | בינוני |
| ייצוא | חלקי ידני | Unit/E2E | Hebrew/RTL/encoding | בינוני |
| דוח מטבח | אין | Golden integration | quantities stable | קריטי |
| דשבורד | אין | Integration | metrics match ledger | קריטי |

CI הנוכחי בונה רק frontend ואינו מריץ tests. אין backend build ב־CI.

---

## 19. מוכנות לסביבת דמו ולצילום

### מוכנות נוכחית

| יכולת צילום | מצב |
|---|---|
| דף בית מקצועי | קיים |
| הזמנה לדוגמה | קיים בקוד; נדרש test data |
| כרטיס לקוח | קיים |
| דוח מטבח | קיים כהדפסה |
| ניהול מנות/מחירים/תמונות | קיים |
| דשבורד אמין | לא מוכן |
| מייל אישור | קיים; ספק לא אומת |
| WhatsApp אוטומטי | חסר |
| תשלום דוגמה | mock קיים; אינו מתאים להצגת Production |
| ביטול והחזר | ביטול חלקי; החזר חסר |
| reset demo | חסר |

### Seed דמו מומלץ

- 6 חודשים של הזמנות synthetic.
- 40–60 לקוחות בדויים עם טלפונים/מיילים reserved ולא אמיתיים.
- ערוצי source מגוונים.
- retail/catering/events/institution.
- captured/cancelled/failed/refunded (לאחר תמיכת model).
- מגוון מוצרים, קופונים ומשלוח/איסוף.
- flags ברורים `isDemo: true`, `demoBatchId`.
- outbound providers כבויים.

אסור להשתמש בלקוחות Production לצילום.

---

## 20. תוכנית עבודה לפי Launch, Growth ו־Scale

### Launch — חובה לפני הצגת המוצר

#### שלב L1: שלמות כסף וביטול

- **מטרה:** מקור אמת פיננסי.
- **משימות:** PaymentTransaction, cancellation metadata, refund design, RevenuePolicy, paid/refunded timestamps.
- **מודולים מושפעים:** Order/payment/accounting/dashboard/admin orders.
- **DB:** collection חדשה + fields/migration מתוכננת.
- **תלות:** אין.
- **בדיקות:** payment state integration + KPI reconciliation.
- **Done:** כל KPI כסף מחושב מ־ledger; authorized אינו revenue.
- **מאמץ:** גדול.
- **סיכון:** גבוה.

#### שלב L2: אבטחה ו־Audit

- **מטרה:** traceability וסגירת upload.
- **משימות:** הגנת upload, AuditEvent, route authorization tests, CSRF decision.
- **תלות:** actor model מ־L1 לפעולות כספיות.
- **Done:** כל mutation קריטי מתועד; upload admin-only.
- **מאמץ:** בינוני־גדול.
- **סיכון:** גבוה.

#### שלב L3: דוחות אמינים

- **מטרה:** דשבורד ודוח מטבח שניתנים להצגה.
- **משימות:** הסרת dummy data, KPI endpoints, item snapshots, CSV/PDF kitchen.
- **תלות:** L1.
- **Done:** reconciliation מול fixtures; export Hebrew תקין.
- **מאמץ:** גדול.
- **סיכון:** בינוני.

#### שלב L4: Quality Gate

- **מטרה:** למנוע regression.
- **משימות:** backend build ב־CI; Unit/Integration/E2E; fake providers.
- **תלות:** L1–L3 contracts.
- **Done:** checkout/payment/admin/portal green ב־CI.
- **מאמץ:** גדול.
- **סיכון:** בינוני.

#### שלב L5: Demo Environment

- **מטרה:** צילום בטוח וחוזר.
- **משימות:** synthetic seed, reset, outbound disabled, provider mocks, runbook.
- **תלות:** L1–L4.
- **Done:** reset + scripted demo ללא מידע אמיתי.
- **מאמץ:** בינוני.
- **סיכון:** בינוני.

### Growth — מוצר שניתן למכור

1. WhatsApp lifecycle עם consent, templates, MessageDelivery ו־Queue.
2. CRM retention, feedback, win-back ו־marketing opt-out.
3. exports לכל domains.
4. advanced KPI ו־date comparisons.
5. invoice provider integration.
6. observability, retries ו־alerts.

### Scale — תפעול מורחב

1. Ingredient master + units.
2. Recipe versions + costs.
3. Inventory locations + movements + counts.
4. Supplier + purchase orders + goods receipts.
5. COGS/margin analytics.

**תלות הכרחית:** Recipes → Inventory → Suppliers/Purchasing → Profitability.

### המשימה הבאה המומלצת בלבד

**להגדיר ולאשר מסמך Payment & Revenue Domain Contract** לפני כתיבת קוד: סטטוסים, אירועים, סכומים, תאריכים, refunds, partial payments, cancellation semantics והגדרת KPI. בלי חוזה זה, דשבורד, refunds ו־audit עלולים להיבנות על בסיס לא עקבי.

---

## 21. סיכום סטטוסים

הטבלה כוללת **100 פריטים ייחודיים**:

| סטטוס | מספר |
|---|---:|
| קיים ועובד | 20 |
| קיים חלקית | 39 |
| חסר | 33 |
| לא ניתן לאמת | 8 |
| **סה"כ** | **100** |

> הספירה מבוססת על שורות R-001 עד R-100 בטבלת הדרישות בלבד.

---

## 22. דברים הדורשים בדיקה ידנית ב־Production או אצל ספק

1. Tranzila authorize/capture/void אמיתי, idempotency ומסמך עסקה.
2. האם terminal תומך refund/partial refund/partial capture.
3. MongoDB hosting plan, backup frequency, retention ו־PITR.
4. Restore drill ל־MongoDB.
5. Cloudinary backup/export/version retention.
6. SMTP delivery, bounce, SPF/DKIM/DMARC.
7. Twilio/WhatsApp sender approval ותבניות.
8. n8n webhook availability/retry/log retention.
9. Google Maps quota/billing/failure behavior.
10. Vercel Root/Build/Output settings ו־deployment history.
11. Render service settings, health checks ו־log retention.
12. GA4/Meta consent behavior בדפדפן אמיתי.
13. CORS allowed origins בפועל.
14. DB explain plans עם נפח Production.
15. mobile/browser/accessibility smoke tests.

---

## 23. רשימת קבצים שנבדקו

### Root / CI

- `package.json`
- `.github/workflows/ci.yml`
- `seed.js`
- `test-connection.js`
- `B2B_Go_Live_Certificate.md`

### Frontend

- `frontend/package.json`
- `frontend/angular.json`
- `frontend/src/index.html`
- `frontend/src/app/app.routes.ts`
- `frontend/src/app/app.config.ts`
- `frontend/src/app/app.component.ts`
- `frontend/src/app/services/auth.service.ts`
- `frontend/src/app/services/cart.service.ts`
- `frontend/src/app/services/order.service.ts`
- `frontend/src/app/services/analytics.service.ts`
- `frontend/src/app/services/meta-pixel.service.ts`
- `frontend/src/app/services/tracking.service.ts`
- `frontend/src/app/guards/auth.guard.ts`
- `frontend/src/app/guards/admin-staff.guard.ts`
- `frontend/src/app/guards/admin-route-roles.guard.ts`
- `frontend/src/app/guards/institution.guard.ts`
- `frontend/src/app/components/pages/checkout-page/checkout-page.component.ts`
- `frontend/src/app/components/pages/order-confirmation/order-confirmation.component.ts`
- `frontend/src/app/components/pages/events-catering/events-catering.component.ts`
- `frontend/src/app/components/pages/holiday-food/holiday-food.component.ts`
- `frontend/src/app/components/admin/admin.routes.ts`
- `frontend/src/app/components/admin/dashboard/dashboard.component.ts`
- `frontend/src/app/components/admin/admin-orders/admin-orders.component.ts`
- `frontend/src/app/components/admin/admin-orders/admin-orders.component.html`
- `frontend/src/app/components/modals/kitchen-report-modal/kitchen-report-modal.component.ts`
- `frontend/src/app/components/admin/admin-customers/admin-customers.component.ts`
- `frontend/src/app/components/admin/admin-coupons/admin-coupons.component.ts`
- `frontend/src/app/components/admin/admin-institutions/admin-institutions.component.ts`
- `frontend/src/app/components/admin/accounting/accounting-management.component.ts`
- `frontend/src/app/components/admin/shopping-list/shopping-list.component.ts`
- `frontend/src/app/components/admin/delivery-management/delivery-management.component.ts`
- `frontend/src/app/components/admin/shipping-management/shipping-management.component.ts`
- `frontend/src/app/components/portal/portal.routes.ts`
- `frontend/src/app/components/portal/institution-dashboard/institution-dashboard.component.ts`
- `frontend/src/app/constants/contact.constants.ts`

### Backend entry, config and middleware

- `backend/package.json`
- `backend/src/server.ts`
- `backend/src/app.ts`
- `backend/src/middleware/auth.ts`
- `backend/src/middleware/errorHandler.ts`
- `backend/src/middleware/upload.ts`
- `backend/src/middleware/upload-video.ts`
- `backend/src/config/role-access.ts`
- `backend/src/config/cloudinary.config.ts`

### Backend models

- `backend/src/models/Order.ts`
- `backend/src/models/User.js`
- `backend/src/models/Customer.ts`
- `backend/src/models/menuItem.ts`
- `backend/src/models/coupon.model.ts`
- `backend/src/models/store-settings.model.ts`
- `backend/src/models/siteSettings.model.ts`
- `backend/src/models/InstitutionMenu.ts`
- `backend/src/models/InstitutionOrder.ts`
- `backend/src/models/Employee.js`
- `backend/src/models/Attendance.js`
- `backend/src/models/ExternalInvoice.ts`
- `backend/src/models/Contact.ts`
- `backend/src/models/Campaign.ts`
- `backend/src/models/GalleryItem.js`
- `backend/src/models/Video.js`
- `backend/src/models/B2BMenuItem.ts`
- `backend/src/models/holidayEvent.model.ts`
- `backend/src/models/delivery-pricing.model.ts`
- `backend/src/models/delivery-city-override.model.ts`
- `backend/src/models/setting.model.ts`
- `backend/src/models/Product.js`

### Backend routes

- `backend/src/routes/auth.routes.ts`
- `backend/src/routes/order.routes.ts`
- `backend/src/routes/orders.routes.ts`
- `backend/src/routes/payment.routes.ts`
- `backend/src/routes/catering.routes.ts`
- `backend/src/routes/menu.routes.ts`
- `backend/src/routes/settings.routes.ts`
- `backend/src/routes/delivery.routes.ts`
- `backend/src/routes/upload.routes.ts`
- `backend/src/routes/customer.routes.ts`
- `backend/src/routes/user.routes.ts`
- `backend/src/routes/coupon.routes.ts`
- `backend/src/routes/institution.routes.ts`
- `backend/src/routes/admin-institutions.routes.ts`
- `backend/src/routes/portal.routes.ts`
- `backend/src/routes/accounting.routes.ts`
- `backend/src/routes/shopping.routes.ts`
- `backend/src/routes/employee.routes.ts`
- `backend/src/routes/attendance.routes.ts`
- `backend/src/routes/gallery.routes.ts`
- `backend/src/routes/video.routes.ts`
- `backend/src/routes/contact.routes.ts`
- `backend/src/routes/campaign.routes.ts`
- `backend/src/routes/search.routes.ts`
- `backend/src/routes/testimonials.routes.ts`
- `backend/src/routes/agent.routes.ts`
- `backend/src/routes/b2b-dictionary.routes.ts`
- `backend/src/routes/holiday-event.routes.ts`

### Backend controllers/services

- `backend/src/controllers/order.controller.ts`
- `backend/src/controllers/payment.controller.ts`
- `backend/src/controllers/catering.controller.ts`
- `backend/src/controllers/settings.controller.ts`
- `backend/src/controllers/customer.controller.ts`
- `backend/src/services/order.service.ts`
- `backend/src/services/tranzila.service.ts`
- `backend/src/services/email.service.ts`
- `backend/src/services/email-templates.ts`
- `backend/src/services/whatsapp.service.ts`
- `backend/src/services/customer.service.ts`
- `backend/src/services/delivery.service.ts`
- `backend/src/utils/webhook.util.ts`
- `backend/src/utils/open-date-rules.ts`

---

## 24. מגבלות ה־Audit

- לא בוצע login ל־Production או קריאת נתוני לקוחות.
- לא בוצעה עסקת Tranzila.
- לא נשלחו Email/WhatsApp.
- לא בוצע restore.
- לא בוצעו migrations או seed.
- לא הורצו בדיקות מפני שאין suite קיים ובשל איסור לשנות state.
- הגדרות Vercel/Render/MongoDB/Cloudinary שאינן בקוד אינן ניתנות לאימות.
- סטטוס "קיים ועובד" במסמך הוא סטטוס מימוש מחובר בקוד; אינו תחליף ל־acceptance test בסביבה.

