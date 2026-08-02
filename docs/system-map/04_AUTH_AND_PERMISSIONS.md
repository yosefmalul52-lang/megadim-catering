# 04 — Auth and Permissions

מיפוי זה מבוסס על ה־routers שממונטו בפועל ב־`backend/src/server.ts:219-245`, על כל רישומי ה־routes הפעילים, על middleware ההרשאות, על בדיקות הבעלות ב־controllers ועל guards/consumers ב־frontend. אין כאן routes לא־ממונטו או שורות wildcard.

## 1. Authentication flow — facts from active code

### Site users (`admin`, `user`, `driver`, `institution`)

1. `POST /api/auth/login` מקבל `username` וסיסמה. למרות ניסוחים ישנים, החיפוש הוא **רק** `User.findOne({ username: username.toLowerCase() })`; אין login לפי phone (`auth.routes.ts:66-80`).
2. סיסמת `User` נשמרת כ־bcrypt עם salt cost 10 ב־pre-save ומושווית ב־`bcrypt.compare` (`models/User.js:80-102`).
3. לאחר בדיקת `isActive`, נחתם JWT עם payload `{ id, role }` ו־`expiresIn: '7d'` (`auth.routes.ts:97-124`).
4. גם register ציבורי יוצר role קבוע `user`, חותם JWT ל־7 ימים ומגדיר cookie (`auth.routes.ts:153-201`).

### Employee

1. `POST /api/auth/employee-login` מקבל `phone` ו־`pinCode`, מחפש התאמה מדויקת יחד עם `isActive: true`, וחותם JWT `{ id, role: 'employee', type: 'employee' }` ל־7 ימים (`auth.routes.ts:215-258`).
2. `Employee.role` העסקי הוא אחד `Chef|Driver|Cleaner|Manager|Other`, אבל ה־principal שמוצמד ל־request מקבל תמיד auth role `employee` (`models/Employee.js:15-20`; `middleware/auth.ts:43-75`).
3. `pinCode` הוא מחרוזת plaintext בת 4–6 תווים; אין hash (`models/Employee.js:35-41`).

### Cookie, Bearer, JWT, expiry and session

- Cookie name: `token`; `HttpOnly`, `path=/`, `maxAge=7d`. Production: `secure=true`, `sameSite=none`; development: `secure=false`, `sameSite=lax`; אין `domain` מפורש (`auth.routes.ts:24-38`).
- `authenticate` נותן עדיפות ל־cookie ורק אחריו ל־`Authorization: Bearer <token>` (`middleware/auth.ts:15-21`).
- `jwt.verify` בודק חתימה ו־expiry. token לא תקין או פג מחזיר 401; לאחר מכן נטען `User`/`Employee` מחדש ונבדק `isActive` (`middleware/auth.ts:39-145`).
- `JWT_SECRET` נדרש בזמן startup וגם בזמן טעינת auth/order routers; השרת מסרב לעלות בלעדיו (`server.ts:110-113`; `auth.routes.ts:9-12`).
- `GET /api/auth/me` משחזר session מה־cookie/Bearer ואינו מחזיר token (`auth.routes.ts:279-292`). ה־frontend מריץ אותו לפני הכרעת guards (`auth.service.ts:67-105`).
- `POST /api/auth/logout` ציבורי ומנקה את cookie עם אותם `path/secure/sameSite`; הוא **לא** מבטל JWT שכבר הונפק (`auth.routes.ts:294-303`). ה־frontend גם מוחק שרידי auth מ־local/session storage (`auth.service.ts:127-152`).
- אין refresh token, blacklist/revocation, forgot-password, reset-password או change-password route פעיל. קישור “שכחתי סיסמה” ב־auth modal אינו מחובר לפעולת backend.
- לא נמצא middleware ייעודי ל־CSRF. Cookie production הוא cross-site (`SameSite=None`), ולכן פעולות cookie-authenticated נשענות על CORS/סביבת הדפדפן ולא על CSRF token.

## 2. Principals, roles and capabilities

| Principal | יכולת backend מדויקת |
|---|---|
| guest/public | רק routes ללא `authenticate`; לעיתים limiter ייעודי |
| `user` | routes עם `authenticate`; הזמנות לפי `userId` ובדיקות ownership ב־controller/service |
| `admin` | כל capability; היחיד שעובר `requireAdmin` |
| `driver` | רק `deliveries:my:list` ו־`deliveries:my:update_status`; בנוסף authenticated ownership routes |
| `institution` | `requireInstitution` ב־portal; אינו staff/admin |
| employee JWT | `authenticate` בלבד; נדחה מ־`requireAdmin`, `requireInstitution` ו־`requireCapability` |

`CAP` מכיל capabilities רבים להזמנות, דוחות וקניות, אך `roleHasCapability` נותן ל־`admin` את כולם ול־`driver` רק את שתי יכולות המשלוחים (`config/role-access.ts:3-38`). לכן כל `CAP` אחר הוא בפועל admin-only. `authorize(...roles)` מוגדר אך אינו משמש route פעיל.

## 3. Middleware notation used in the matrix

כל path תחת `/api` עובר, לפי הסדר, `cors → helmet → morgan → generalApiLimiter(100/15m/IP) → express.json → express.urlencoded → cookieParser → mongoSanitize` (`server.ts:137-199`). בטבלה:

- `API` = השרשרת הגלובלית המדויקת לעיל.
- `A` = `API → authenticate`.
- `AD` = `API → authenticate → requireAdmin`.
- `INST` = `API → authenticate → requireInstitution`.
- `CAP(x)` = `API → authenticate → requireCapability(x)`.
- `optionalAuthenticate` מאמת cookie קודם ואז Bearer; token חסר/לא תקין הופך ל־guest ולא נכשל.
- `AD×2` = אותו `authenticate → requireAdmin` מופעל פעמיים: פעם ב־`institution.routes.ts:16` ופעם ב־`admin-institutions.routes.ts:17`.

## 4. Frontend guards and backend alignment

| Frontend route | Guards בפועל | Backend alignment |
|---|---|---|
| `/admin` shell | outer `authGuard`; lazy root שוב `authGuard` ואז `adminStaffGuard` | shell מאפשר `admin,driver`; child guards מצמצמים |
| `/admin/delivery` | `adminRouteRolesGuard`, roles `admin,driver` | תואם `DELIVERIES_MY_*`; controller מסנן driver להזמנות משויכות |
| כל שאר child routes תחת `/admin` | `adminRouteRolesGuard`, role `admin` | תואם AD/CAP-admin routes |
| `/portal` | `authGuard → institutionGuard` | תואם `INST` |
| `/my-orders`, `/my-account` | `institutionRetailRedirectGuard → authGuard` | authenticated; institution נחסם בצד UI |
| `/my-zone` | `employeeGuard` | API `/employees/my/stats` הוא רק `A`, ללא בדיקת role employee; controller משתמש ב־ID של ה־principal |
| `/time-clock` | ללא guard | תואם clock ציבורי לפי PIN |
| `/order-confirmation/:id` | ללא guard | mismatch: `GET /api/payment/status/:orderId` דורש auth+ownership, ולכן guest checkout לא יכול לבצע polling |

`authInterceptor` שולח cookies בכל request ומבצע logout על 401/403, למעט `/auth/me` ולמעט business-403 של `/api/portal` (`auth.interceptor.ts:9-33`). הקובץ `admin-app.routes.ts` אינו מיובא בשום מקום פעיל; ה־routes הלא־מוגנים שבו אינם חלק מה־main router.

## 5. Complete sensitive-endpoint matrix

עמודת “בעלות/בדיקת controller” מציינת בדיקה נוספת אחרי middleware; “אין” פירושו שה־role gate הוא גבול ההרשאה. כל row הוא endpoint מלא יחיד.

| # | Method + full path | Frontend screen / consumer | Middleware chain | Allowed principals | בעלות / בדיקת controller | Action | Evidence |
|---:|---|---|---|---|---|---|---|
| 1 | POST `/api/auth/login` | `/login`, `AuthService.login` | `API → loginLimiter(10/15m, skip success)` | public credentials | username+password, active User | issue 7d site JWT cookie | `auth.routes.ts:66` |
| 2 | POST `/api/auth/register` | `/register`, `AuthService.register` | `API` | public | unique username; forces role `user` | create user + issue JWT | `auth.routes.ts:154` |
| 3 | POST `/api/auth/employee-login` | `/employee-login` | `API → loginLimiter(10/15m, skip success)` | public phone+PIN | active employee exact phone/PIN | issue 7d employee JWT | `auth.routes.ts:216` |
| 4 | GET `/api/auth/me` | app initializer / guards | `A` | any active authenticated principal | returns current principal only | session rehydrate | `auth.routes.ts:280` |
| 5 | POST `/api/auth/logout` | `AuthService.logout` | `API` | public | none; no JWT revocation | clear auth cookie | `auth.routes.ts:295` |
| 6 | POST `/api/menu` | `/admin/menu`, `MenuService.addMenuItem` | `AD` | admin | none | create menu item | `menu.routes.ts:28` |
| 7 | POST `/api/menu/migrate-cholent-desserts-category` | no frontend consumer found | `AD` | admin | none | migrate menu categories | `menu.routes.ts:29` |
| 8 | PUT `/api/menu/reorder` | `/admin/menu`, `MenuService.updateMenuOrder` | `AD` | admin | none | reorder menu items | `menu.routes.ts:30` |
| 9 | PUT `/api/menu/:id` | `/admin/menu`, `MenuService.updateMenuItem` | `AD` | admin | none | update menu item | `menu.routes.ts:31` |
| 10 | DELETE `/api/menu/:id` | `/admin/menu`, `MenuService.deleteMenuItem` | `AD` | admin | none | delete menu item | `menu.routes.ts:32` |
| 11 | POST `/api/contact` | `/contact`, `ContactService` | `API` | public | form validation in controller | create CRM/contact lead | `contact.routes.ts:10` |
| 12 | GET `/api/contact` | `/admin/leads`, `AdminContactsService` | `AD` | admin | none | list contact PII | `contact.routes.ts:13` |
| 13 | GET `/api/contact/analytics/source` | `/admin/leads`, `AdminContactsService` | `AD` | admin | none | lead-source report | `contact.routes.ts:14` |
| 14 | GET `/api/contact/stats` | no direct frontend consumer found | `AD` | admin | none | contact statistics | `contact.routes.ts:15` |
| 15 | GET `/api/contact/:id` | no direct frontend consumer found | `AD` | admin | none | read one contact | `contact.routes.ts:16` |
| 16 | PATCH `/api/contact/:id/status` | `/admin/leads`, `AdminContactsService` | `AD` | admin | none | update CRM status/notes | `contact.routes.ts:17` |
| 17 | DELETE `/api/contact/:id` | `/admin/leads`, `AdminContactsService` | `AD` | admin | none | delete contact | `contact.routes.ts:18` |
| 18 | POST `/api/catering` | `/holiday-food` | `API` | public | payload validation | submit catering inquiry/order | `catering.routes.ts:7` |
| 19 | POST `/api/catering/events` | `/events-catering` | `API` | public | payload validation | submit event inquiry/order | `catering.routes.ts:8` |
| 20 | POST `/api/orders` | `/checkout`; also admin manual-order builder | `API → placeOrderLimiter(10/15m) → optionalAuthenticate` | public or authenticated | attaches valid user ID; honors client `manualOrder`/`paymentStatus` | create persisted order | `orders.routes.ts:64` |
| 21 | GET `/api/orders/myorders` | `/my-orders`, `OrderService.getMyOrders` | `A` | any authenticated principal | query by current principal ID | list own orders | `orders.routes.ts:68-87` |
| 22 | POST `/api/order/checkout` | legacy cart/order services | `API → checkoutLimiter(10/15m) → optionalAuthenticate` | public or authenticated | valid user ID attached, otherwise guest | create checkout order | `order.routes.ts:89` |
| 23 | POST `/api/order/send` | cart modal | `API → checkoutLimiter(10/15m)` | public | validates payload; no identity | send order email | `order.routes.ts:90` |
| 24 | GET `/api/order/my-orders` | legacy `OrderService` | `A` | any authenticated principal | query by current principal ID | list own orders | `order.routes.ts:93` |
| 25 | GET `/api/order` | `/admin/orders`, dashboard | `CAP(orders:list)` | admin | none | list all orders/PII | `order.routes.ts:96` |
| 26 | GET `/api/order/analytics/revenue-by-source` | `/admin/dashboard` | `CAP(orders:analytics)` | admin | none | revenue-source analytics | `order.routes.ts:97-102` |
| 27 | GET `/api/order/analytics/monthly-revenue` | `/admin/dashboard` | `CAP(orders:analytics)` | admin | none | monthly revenue analytics | `order.routes.ts:103-108` |
| 28 | GET `/api/order/stats` | admin analytics | `CAP(orders:stats)` | admin | none | order statistics | `order.routes.ts:109` |
| 29 | GET `/api/order/stats/revenue` | `/admin/dashboard` | `CAP(orders:stats_revenue)` | admin | none | revenue statistics | `order.routes.ts:110-115` |
| 30 | GET `/api/order/kitchen-report` | `/admin/orders`; client print | `AD` | admin | none | kitchen report/export source | `order.routes.ts:116` |
| 31 | GET `/api/order/delivery-report` | `/admin/delivery`; client print | `CAP(deliveries:my:list)` | admin, driver | driver ID passed to service; admin unscoped | delivery report | `order.routes.ts:117` |
| 32 | GET `/api/order/recent` | admin dashboard | `CAP(orders:recent)` | admin | none | recent orders | `order.routes.ts:118` |
| 33 | GET `/api/order/search` | admin order search | `CAP(orders:search)` | admin | none | search all orders | `order.routes.ts:119` |
| 34 | GET `/api/order/dashboard-stats` | `/admin/dashboard` | `CAP(orders:dashboard_stats)` | admin | none | dashboard totals | `order.routes.ts:120` |
| 35 | GET `/api/order/admin/tab-counts` | `/admin/orders` | `CAP(orders:list)` | admin | none | order tab counts | `order.routes.ts:121-126` |
| 36 | GET `/api/order/driver/my` | `/admin/delivery` | `CAP(deliveries:my:list)` | admin, driver | service filters by current ID; for admin this also uses admin ID | assigned delivery list | `order.routes.ts:127` |
| 37 | GET `/api/order/:id` | order confirmation/admin order detail | `A` | admin; driver; other authenticated principals | admin any; driver only assigned; others only matching `order.userId` | read order detail | `order.routes.ts:132`; `order.controller.ts:515-549` |
| 38 | PATCH `/api/order/:id/assign-driver` | `/admin/orders` | `AD` | admin | target must be active site user role `driver` | assign/unassign driver | `order.routes.ts:128` |
| 39 | POST `/api/order/bulk` | `/admin/orders` | `AD` | admin | validates action and IDs | bulk status/archive/restore/permanent-delete | `order.routes.ts:129` |
| 40 | PUT `/api/order/:id/restore` | `/admin/orders` | `AD` | admin | none | restore order | `order.routes.ts:135` |
| 41 | DELETE `/api/order/:id/permanent` | `/admin/orders` | `AD` | admin | none | permanently delete order | `order.routes.ts:136` |
| 42 | PUT `/api/order/:id/status` | `/admin/orders`, `/admin/delivery` | `CAP(deliveries:my:update_status)` | admin, driver | driver service enforces assignment/status scope; admin any | update order status | `order.routes.ts:137`; `order.controller.ts:551-618` |
| 43 | PATCH `/api/order/:id/status` | alternate API consumer; no distinct screen | `CAP(deliveries:my:update_status)` | admin, driver | same driver assignment/status check | update order status | `order.routes.ts:138` |
| 44 | PATCH `/api/order/:id/date` | alternate API consumer | `CAP(orders:date_write)` | admin | none | update event date | `order.routes.ts:139` |
| 45 | PUT `/api/order/:id/date` | `/admin/orders` | `CAP(orders:date_write)` | admin | none | update event date | `order.routes.ts:140` |
| 46 | PUT `/api/order/admin/:id/items` | `/admin/orders` | `AD` | admin | prices recalculated by service | replace order items | `order.routes.ts:141` |
| 47 | PATCH `/api/order/admin/:id/portions` | `/admin/orders` | `AD` | admin | none | update portion counts | `order.routes.ts:142` |
| 48 | PATCH `/api/order/admin/:id/admin-notes` | `/admin/orders` | `AD` | admin | none | update internal notes | `order.routes.ts:143` |
| 49 | PATCH `/api/order/:id/shipping-cost` | `/admin/orders` | `AD` | admin | service limits to retail order and recalculates total | update shipping cost | `order.routes.ts:144` |
| 50 | DELETE `/api/order/:id` | `/admin/orders` | `AD` | admin | none | soft-delete order | `order.routes.ts:145` |
| 51 | GET `/api/testimonials/admin/all` | no frontend consumer found | `AD` | admin | none | list published+unpublished testimonials | `testimonials.routes.ts:67` |
| 52 | POST `/api/testimonials` | no frontend consumer found | `AD` | admin | validates name/event/quote/rating | create testimonial | `testimonials.routes.ts:79` |
| 53 | PUT `/api/testimonials/:id` | no frontend consumer found | `AD` | admin | exact ID lookup | update testimonial | `testimonials.routes.ts:119` |
| 54 | DELETE `/api/testimonials/:id` | no frontend consumer found | `AD` | admin | exact ID lookup | delete testimonial | `testimonials.routes.ts:151` |
| 55 | GET `/api/testimonials/stats` | no frontend consumer found | `AD` | admin | none | testimonial statistics | `testimonials.routes.ts:175` |
| 56 | POST `/api/agent` | shared chat agent | `API` | public | controller/service validation only | invoke AI agent | `agent.routes.ts:8` |
| 57 | POST `/api/upload` | `UploadService.uploadImage`, admin media/menu forms | `API → upload.single('image')` | public | file middleware only; no principal | upload image to Cloudinary | `upload.routes.ts:36` |
| 58 | POST `/api/upload/video` | `UploadService.uploadVideo`, admin gallery | `AD → uploadVideo.single('video')` | admin | multer/file checks | upload video | `upload.routes.ts:76-89` |
| 59 | GET `/api/shopping` | `/admin/shopping`; client print/copy | `CAP(shopping:list)` | admin | none | shopping report/export source | `shopping.routes.ts:12` |
| 60 | GET `/api/employees` | employee admin component (not routed in current `admin.routes.ts`) | `AD` | admin | none | list employees/status/PIN-bearing records per service projection | `employee.routes.ts:12` |
| 61 | GET `/api/employees/:id` | employee detail component (not currently routed) | `AD` | admin | none | employee detail | `employee.routes.ts:13` |
| 62 | POST `/api/employees` | employee admin component (not currently routed) | `AD` | admin | default PIN `1234` if omitted | create employee | `employee.routes.ts:14` |
| 63 | PUT `/api/employees/:id` | employee detail component (not currently routed) | `AD` | admin | none | update employee | `employee.routes.ts:15` |
| 64 | DELETE `/api/employees/:id` | employee admin component (not currently routed) | `AD` | admin | service soft-delete | delete employee | `employee.routes.ts:16` |
| 65 | GET `/api/employees/my/stats` | `/my-zone` | `A` | any authenticated principal | queries employee stats using current principal ID; no employee-role check | own stats/pay data | `employee.routes.ts:19`; `employee.controller.ts:135-149` |
| 66 | POST `/api/attendance/clock` | public `/time-clock` kiosk | `API` | public with PIN | service resolves employee by PIN | clock in/out mutation | `attendance.routes.ts:12` |
| 67 | POST `/api/attendance/clock-in` | no routed frontend consumer found | `AD` | admin | employeeId required | admin clock-in | `attendance.routes.ts:15` |
| 68 | POST `/api/attendance/clock-out` | no routed frontend consumer found | `AD` | admin | employeeId required | admin clock-out | `attendance.routes.ts:16` |
| 69 | GET `/api/attendance/history/:employeeId` | employee detail component | `AD` | admin | none | employee attendance history | `attendance.routes.ts:17` |
| 70 | GET `/api/attendance/active` | employee admin component | `AD` | admin | none | active shifts | `attendance.routes.ts:18` |
| 71 | GET `/api/attendance/report` | employee detail/report export source | `AD` | admin | optional employeeId filter | payroll report | `attendance.routes.ts:19` |
| 72 | GET `/api/gallery/stats` | `GalleryService.getGalleryStatistics` | **effective `API → public GET /:id`**; intended later `AD` handler is unreachable | public effective principal | first matching route calls `getGalleryItemById('stats')` | route-order defect; does not execute stats controller | `gallery.routes.ts:11,14` |
| 73 | POST `/api/gallery` | `/admin/gallery` | `AD` | admin | none | create gallery item | `gallery.routes.ts:15` |
| 74 | PUT `/api/gallery/:id` | `/admin/gallery` | `AD` | admin | none | update gallery item | `gallery.routes.ts:16` |
| 75 | DELETE `/api/gallery/:id` | `/admin/gallery` | `AD` | admin | none | delete gallery item | `gallery.routes.ts:17` |
| 76 | GET `/api/videos/stats` | admin video gallery | `AD` | admin | registered before `/:id` | video statistics | `video.routes.ts:13` |
| 77 | POST `/api/videos` | `/admin/gallery`, `VideoService` | `AD` | admin | none | add video metadata | `video.routes.ts:18` |
| 78 | PUT `/api/videos/:id` | `/admin/gallery`, `VideoService` | `AD` | admin | none | update video metadata | `video.routes.ts:19` |
| 79 | DELETE `/api/videos/:id` | `/admin/gallery`, `VideoService` | `AD` | admin | none | delete video metadata | `video.routes.ts:20` |
| 80 | PUT `/api/settings` | `/admin/settings`, `SiteSettingsService` | `AD` | admin | none | update site settings | `settings.routes.ts:12` |
| 81 | PUT `/api/settings/store` | admin delivery/settings service | `AD` | admin | none | update store settings | `settings.routes.ts:16` |
| 82 | PUT `/api/settings/delivery` | `/admin/shipping`, `ShippingService` | `AD` | admin | none | update delivery/open-date/pricing settings | `settings.routes.ts:20` |
| 83 | POST `/api/delivery/calculate-fee` | checkout and `/admin/shipping` test | `API` | public | server calculates from destination/cart total | calculate fee; no DB write | `delivery.routes.ts:21` |
| 84 | POST `/api/delivery/cities` | `/admin/shipping`, `ShippingService` | `AD` | admin | none | create city override | `delivery.routes.ts:27` |
| 85 | PUT `/api/delivery/cities/:id` | `/admin/shipping`, `ShippingService` | `AD` | admin | none | update city override | `delivery.routes.ts:28` |
| 86 | DELETE `/api/delivery/cities/:id` | `/admin/shipping`, `ShippingService` | `AD` | admin | none | delete city override | `delivery.routes.ts:29` |
| 87 | POST `/api/coupons/apply` | checkout/cart, `CouponService` | `API → applyCouponLimiter(5/1m)` | public | coupon rules validated by service | evaluate coupon | `coupon.routes.ts:21` |
| 88 | GET `/api/coupons` | `/admin/coupons` | `AD` | admin | none | list coupon secrets/rules | `coupon.routes.ts:23` |
| 89 | POST `/api/coupons` | `/admin/coupons` | `AD` | admin | controller validation | create coupon | `coupon.routes.ts:24` |
| 90 | PUT `/api/coupons/:id` | `/admin/coupons` | `AD` | admin | controller validation | update coupon | `coupon.routes.ts:25` |
| 91 | DELETE `/api/coupons/:id` | `/admin/coupons` | `AD` | admin | none | delete coupon | `coupon.routes.ts:26` |
| 92 | GET `/api/users/resolve` | `/admin/customers`, `UsersService` | `AD` | admin | resolves username/phone | read site user identity | `user.routes.ts:14` |
| 93 | GET `/api/users/drivers` | `/admin/orders` | `AD` | admin | only active driver users in controller | list drivers | `user.routes.ts:15` |
| 94 | PATCH `/api/users/:id/role` | `/admin/customers`, `UsersService` | `AD` | admin | validates target role | change site-user role | `user.routes.ts:16` |
| 95 | GET `/api/users` | no current service method; admin API | `AD` | admin | none | list site users | `user.routes.ts:17` |
| 96 | PUT `/api/users/:id/crm` | no current service method; legacy admin API | `AD` | admin | none | update user CRM fields | `user.routes.ts:18` |
| 97 | GET `/api/customers` | `/admin/customers`, `UsersService` | `AD` | admin | derives category from order activity/registration | list CRM/customer PII; conditionally `bulkWrite` changed `customerCategory` values | `customer.routes.ts:15`; `customer.controller.ts:318-412` |
| 98 | POST `/api/customers` | `/admin/customers` | `AD` | admin | controller validation/deduplication | create CRM customer | `customer.routes.ts:16` |
| 99 | POST `/api/customers/migrate` | `/admin/customers` | `AD` | admin | none | migrate legacy customer data | `customer.routes.ts:17` |
| 100 | POST `/api/customers/audit` | `/admin/customers` | `AD` | admin | none | audit/sync customer aggregates | `customer.routes.ts:18` |
| 101 | PUT `/api/customers/:id/crm` | `/admin/customers` | `AD` | admin | none | update CRM profile | `customer.routes.ts:19` |
| 102 | DELETE `/api/customers/:id` | `/admin/customers` | `AD` | admin | none | delete CRM customer | `customer.routes.ts:20` |
| 103 | GET `/api/campaign` | `/admin/marketing` | `AD` | admin | none | list campaigns/provider results | `campaign.routes.ts:8` |
| 104 | POST `/api/campaign/launch` | `/admin/marketing` | `AD` | admin | controller validates payload | launch/schedule external campaign | `campaign.routes.ts:9` |
| 105 | POST `/api/holiday-events/migrate-shavuot` | no frontend consumer found | `AD` | admin | none | migrate legacy holiday data | `holiday-event.routes.ts:18-23` |
| 106 | GET `/api/holiday-events` | `/admin/holiday-events` | `AD` | admin | none | list all holiday events | `holiday-event.routes.ts:24` |
| 107 | GET `/api/holiday-events/:id` | `/admin/holiday-events` | `AD` | admin | none | read holiday event | `holiday-event.routes.ts:25` |
| 108 | POST `/api/holiday-events` | `/admin/holiday-events` | `AD` | admin | controller validation | create holiday event | `holiday-event.routes.ts:26` |
| 109 | PUT `/api/holiday-events/:id` | `/admin/holiday-events` | `AD` | admin | controller validation | update holiday event | `holiday-event.routes.ts:27` |
| 110 | DELETE `/api/holiday-events/:id` | `/admin/holiday-events` | `AD` | admin | none | delete holiday event | `holiday-event.routes.ts:28` |
| 111 | GET `/api/payment/success` | Tranzila/browser callback | `API` | public payment-provider/browser callback | response code + mandatory stored token + optional amount + idempotency | authorize payment and redirect | `payment.routes.ts:15`; `payment.controller.ts:187-375` |
| 112 | POST `/api/payment/success` | Tranzila callback/IPN | `API` | public payment-provider callback | same fail-closed token/amount checks | authorize payment and redirect | `payment.routes.ts:16`; `payment.controller.ts:187-375` |
| 113 | POST `/api/payment/initiate/:orderId` | checkout | `API` | public knowing order ID | order existence/state only; no owner check; generates security token | move order to awaiting payment / mock authorize | `payment.routes.ts:22`; `payment.controller.ts:69-185` |
| 114 | GET `/api/payment/status/:orderId` | order confirmation/admin order | `A` | admin or authenticated owner | admin any; else matching userId **or phone or email** | read payment status; gateway IDs only for admin | `payment.routes.ts:27`; `payment.controller.ts:41-61,519-551` |
| 115 | POST `/api/payment/capture/:orderId` | `/admin/orders` | `AD` | admin | requires authorized state and provider transaction data | capture pre-authorization | `payment.routes.ts:32` |
| 116 | POST `/api/payment/void/:orderId` | `/admin/orders` | `AD` | admin | requires authorized state and provider transaction data | void authorization | `payment.routes.ts:37` |
| 117 | GET `/api/admin/accounting/summary` | `/admin/accounting` | `AD` via router-level middleware | admin | none | accounting summary | `accounting.routes.ts:11-13` |
| 118 | GET `/api/admin/accounting/transactions` | `/admin/accounting` | `AD` via router-level middleware | admin | none | financial transaction report | `accounting.routes.ts:11,14` |
| 119 | POST `/api/admin/accounting/external` | `/admin/accounting` | `AD` via router-level middleware | admin | controller validation | create external invoice/transaction | `accounting.routes.ts:11,15` |
| 120 | POST `/api/admin/accounting/upload` | `/admin/accounting` | `AD → uploadDocumentMiddleware.single('file')` | admin | document file validation | upload accounting document | `accounting.routes.ts:11,16` |
| 121 | GET `/api/admin/institutions/menu` | `/admin/institutions` | `AD×2` | admin | week key validation | read institution week menu; conditionally migrate a legacy menu document | `institution.routes.ts:16-19`; `admin-institutions.routes.ts:17,19`; `institution-admin.controller.ts:287-318` |
| 122 | POST `/api/admin/institutions/menu` | `/admin/institutions` | `AD×2` | admin | week/menu validation | upsert institution week menu | `admin-institutions.routes.ts:20` |
| 123 | DELETE `/api/admin/institutions/menu` | `/admin/institutions` | `AD×2` | admin | week key validation | delete institution week menu | `admin-institutions.routes.ts:21` |
| 124 | GET `/api/admin/institutions/reports` | `/admin/institutions`; client print | `AD×2` | admin | week key validation | institution kitchen/packing report; conditionally migrate legacy menu/order documents | `admin-institutions.routes.ts:22`; `institution-admin.controller.ts:557-646` |
| 125 | GET `/api/admin/institutions/order/:institutionId` | `/admin/institutions` | `AD×2` | admin | explicit institution ID + week | read institution order; conditionally migrate legacy menu/order documents | `admin-institutions.routes.ts:23`; `institution-admin.controller.ts:422-460` |
| 126 | PUT `/api/admin/institutions/order/:institutionId` | `/admin/institutions` | `AD×2` | admin | explicit institution ID + week/payload validation | update institution order | `admin-institutions.routes.ts:24` |
| 127 | DELETE `/api/admin/institutions/order/:institutionId` | `/admin/institutions` | `AD×2` | admin | explicit institution ID + week | delete institution order | `admin-institutions.routes.ts:25` |
| 128 | GET `/api/admin/institutions` | `/admin/institutions` | `AD` | admin | none | list institution users; conditionally migrate legacy institution orders | `institution.routes.ts:21`; `institution.controller.ts:41-73` |
| 129 | GET `/api/admin/institutions/:id` | `/admin/institutions` | `AD` | admin | none | institution detail | `institution.routes.ts:22` |
| 130 | POST `/api/admin/institutions` | `/admin/institutions` | `AD` | admin | creates site user role institution | create institution login | `institution.routes.ts:23` |
| 131 | PUT `/api/admin/institutions/:id` | `/admin/institutions` | `AD` | admin | target institution validation; optional password update | update institution/login | `institution.routes.ts:24` |
| 132 | DELETE `/api/admin/institutions/:id` | `/admin/institutions` | `AD` | admin | none | delete/deactivate institution | `institution.routes.ts:25` |
| 133 | GET `/api/admin/b2b-dictionary` | `/admin/institutions` | `AD` via router-level middleware | admin | none | list B2B dictionary | `b2b-dictionary.routes.ts:14,16` |
| 134 | POST `/api/admin/b2b-dictionary` | `/admin/institutions` | `AD` via router-level middleware | admin | controller validation | create B2B dictionary item | `b2b-dictionary.routes.ts:17` |
| 135 | PUT `/api/admin/b2b-dictionary/:id` | `/admin/institutions` | `AD` via router-level middleware | admin | controller validation | update B2B dictionary item | `b2b-dictionary.routes.ts:18` |
| 136 | DELETE `/api/admin/b2b-dictionary/:id` | `/admin/institutions` | `AD` via router-level middleware | admin | none | delete/deactivate B2B item | `b2b-dictionary.routes.ts:19` |
| 137 | GET `/api/portal/status` | `/portal` institution dashboard | `INST` | institution | reloads current User; reads order only for `user._id`; checks active/deleted | own menu/order status; conditionally migrate legacy menu/order documents and synchronize computed `isLocked` | `portal.routes.ts:9-10`; `portal.controller.ts:29-147` |
| 138 | POST `/api/portal/submit` | `/portal` institution dashboard | `INST` | institution | reloads current User; upserts only `{institutionId:user._id, week}`; deadline/lock validation | create/update own weekly order | `portal.routes.ts:9,11`; `portal.controller.ts:146-275` |
| 139 | GET `/api/menu` | public menu/home/checkout, `MenuService` | `API` | public | if total menu count is below 5, controller deletes all remaining items and inserts the built-in master menu | read menu with destructive auto-seed side effect | `menu.routes.ts:19`; `menu.controller.ts:8-18,330` |
| 140 | GET `/api/settings` | site-wide `SiteSettingsService` | `API` | public | creates one fixed default `SiteSettings` document only when none exists; no caller-supplied fields | read/initialize site settings | `settings.routes.ts:11`; `settings.controller.ts:68-86` |
| 141 | GET `/api/settings/store` | shipping/admin delivery consumers | `API` | public | creates one fixed default `Setting` document only when none exists; no caller-supplied fields | read/initialize store settings | `settings.routes.ts:15`; `settings.controller.ts:275-284` |
| 142 | GET `/api/settings/delivery` | checkout, holiday-food, `/admin/shipping` | `API` | public | creates one fixed default `StoreSettings` document only when none exists; no caller-supplied fields | read/initialize delivery settings | `settings.routes.ts:19`; `settings.controller.ts:328-338` |

## 6. Explicit resolution of previously contradictory endpoints

- `POST /api/menu` is **not public**: `authenticate → requireAdmin` (`menu.routes.ts:28`).
- `POST /api/delivery/cities` is **not public**: `authenticate → requireAdmin` (`delivery.routes.ts:27`).
- `PUT /api/testimonials/:id` and `DELETE /api/testimonials/:id` are **not public**: both use `authenticate → requireAdmin` (`testimonials.routes.ts:119,151`). None of these four is a security finding.
- `POST /api/attendance/clock` is intentionally public for kiosk PIN use (`attendance.routes.ts:11-12`).
- `POST /api/contact` is public (`contact.routes.ts:9-10`).
- `POST /api/coupons/apply` is public and has its own `5/minute/IP` limiter in addition to the global limiter (`coupon.routes.ts:10-21`).
- `POST /api/delivery/calculate-fee` is public (`delivery.routes.ts:21`).
- `GET /api/settings`, `GET /api/settings/store`, `GET /api/settings/delivery` are public read APIs; when the singleton document is missing each GET creates fixed defaults, while all corresponding PUTs are admin-only (`settings.routes.ts:10-20`; rows 140-142).
- `GET /api/gallery` and `GET /api/gallery/:id` are public (`gallery.routes.ts:9-11`). Mutations are admin-only. The separate `/stats` registration is shadowed as documented in row 72.
- `GET /api/holiday-events/public/active` is public; all admin list/detail/mutations are protected (`holiday-event.routes.ts:17-28`).
- `POST /api/upload/video` is admin-only (`upload.routes.ts:76-80`); only image `POST /api/upload` is public.
- both `GET /api/payment/success` and `POST /api/payment/success` are public by provider design, but the controller fails closed on response code and a mandatory per-order security token and checks amount when supplied (`payment.controller.ts:270-347`).

## 7. Security findings supported by active code

1. **Destructive public GET on the menu:** `GET /api/menu` checks the collection count and, when it is below 5, executes `deleteMany({})` before inserting the built-in master menu. A public read can therefore erase legitimate partial data and replace it (`menu.controller.ts:8-18,330`).
2. **Public Cloudinary image write:** `POST /api/upload` performs `upload.single('image')` before any auth and has no route-specific limiter. Any caller can consume upload/storage quota (`upload.routes.ts:35-73`).
3. **Public manual/paid-order flag path:** `POST /api/orders` uses optional auth. `createOrder` honors `manualOrder`; the service sets `customerDetails.isPaid` from client `paymentStatus` when `manualOrder===true` (`order.controller.ts:201-248`; `order.service.ts:181-195`). This permits an unauthenticated caller to create an order represented as a manual paid order and bypass normal event-date validation.
4. **Public payment-initiation mutation by order ID:** `POST /api/payment/initiate/:orderId` has no ownership or secret check. It changes payment state and token for any existing order ID; when Tranzila is unconfigured, mock mode marks the order authorized (`payment.routes.ts:18-22`; `payment.controller.ts:78-147`).
5. **Attendance PIN exposure:** public `POST /api/attendance/clock` changes attendance using a 4–6 character PIN, while PINs are stored and queried plaintext. It has only the global 100/15m/IP limiter, unlike login (`attendance.routes.ts:11-12`; `models/Employee.js:35-41`).
6. **Public AI invocation/cost surface:** `POST /api/agent` has no auth or route-specific limiter beyond the global API limiter (`agent.routes.ts:7-8`).

Not security findings: public contact/catering/order-submission forms, coupon apply, delivery calculation, public settings/gallery/holiday reads, and payment success callbacks match their documented browser/provider flows. The `/api/gallery/stats` ordering issue is a correctness/availability defect, not evidence of disclosure by the intended statistics controller.

## 8. Export/report behavior

- Kitchen, delivery, shopping, institution and payroll data originate from protected GET rows 30, 31, 59, 71 and 124. Printing/export is client-side (`window.print`/popup print); there is no separate generic export endpoint.
- Customer CSV export is generated client-side from the already admin-protected `/api/customers` response (`admin-customers.component.ts:640`).
- Employee “Excel export” is currently a frontend placeholder (`employee-details.component.ts:533-534`).
- Accounting document upload is row 120 and is admin-only.

**Matrix total: 142 sensitive endpoint rows; generic/wildcard rows: 0.**

