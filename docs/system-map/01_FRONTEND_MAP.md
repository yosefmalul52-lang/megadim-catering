# 01 — Frontend Map (verified route-to-screen trace)

## Scope and counting

- Runtime router: `frontend/src/app/app.config.ts:61` supplies `routes` from `frontend/src/app/app.routes.ts:6-160`.
- Active trees: `app.routes.ts`, `ready-for-shabbat.routes.ts` mounted at three prefixes, `admin.routes.ts`, and `portal.routes.ts`.
- Inactive tree: `frontend/src/app/admin-app.routes.ts:5-35`. Nothing imported by the bootstrap references `adminAppRoutes`; its `/summaries` route and `ChatSummariesComponent` are not runtime routes.
- Source records: **71** = 31 app records + 22 Shabbat records (one layout plus 21 children) + 16 admin records (one layout plus 15 children) + 2 portal records (one layout plus one child).
- Mounted records: **115** = 31 + (22 × 3 mounts) + 16 + 2.
- URL-bearing leaf/redirect/matcher records: **105** = 26 top-level non-mount records + (21 Shabbat children × 3) + 15 admin children + 1 portal child. This is **104 concrete URL patterns plus the `/**` matcher**. Empty-path layout records are not counted again because they resolve to the same URL as their empty child.
- The previous value 107 was incorrect; it cannot be obtained from the active route arrays. Evidence: `app.routes.ts:6-160`, `ready-for-shabbat.routes.ts:3-113`, `admin.routes.ts:9-114`, `portal.routes.ts:3-22`.

## Cross-cutting execution on routed screens

`AppComponent` is the root layout for every route. On application initialization it reads `localStorage["cookieConsent"]`, may write `all`, `essential`, or `rejected`, initializes analytics/pixel state, captures UTM state through `MarketingService`, and observes `AuthService` state. `AuthService.verifySession()` is initialized by application configuration and performs `GET /api/auth/me` with credentials; backend handler is the inline `router.get('/me', authenticate, ...)` callback. Evidence: `frontend/src/app/app.component.ts:89-188`, `frontend/src/app/services/auth.service.ts:61-105`, `backend/src/routes/auth.routes.ts:280-292`.

For non-admin, non-portal, non-kiosk and non-employee screens, the root also instantiates `HeaderComponent`, `SearchBarComponent`, `CartModalComponent`, `FooterComponent`, and `WhatsappCtaComponent` (`app.component.ts:24-85`). `CartModalComponent` directly invokes `POST /api/order/send` with `{customerName,phone,email,deliveryAddress,notes,items}`; handler `OrderController.sendOrder` (`cart-modal.component.ts:374`, `order.routes.ts:90`). This call is user-triggered from the shared cart modal, not an automatic call by each routed component.

`CartService` shared state is `cartItemsSubject/cartItems$` and `isCartOpenSubject/isCartOpen$`; it reads and writes `localStorage["megadim-cart"]` (`cart.service.ts:27-39,168-224`). `MarketingService` reads/writes `localStorage["megadim_utms"]` (`marketing.service.ts:45-77`). `PagePopupComponent`, when imported by a screen, reads/writes `sessionStorage["popupDismissed"]` (`page-popup.component.ts:35-45`).

`MenuService` has an eager constructor side effect: the first component in an application lifetime that injects it triggers `loadMenuItems()` and therefore `GET /api/menu` → `MenuController.getAllMenuItems`, before that component's explicit service method runs. This applies to `/` through `FeaturedMenuComponent`, `/cholent-bar`, `/cholent`, every ordinary Shabbat category/detail component, `/admin/dashboard`, `/admin/menu`, and `/admin/orders`; Angular's root singleton means it happens once per application lifetime, not once per navigation. Evidence: `menu.service.ts:63-70,346-349,363-384`.

The current root template does **not** instantiate either chat component. If manually embedded, `ChatAgentComponent` uses `localStorage["chatSessionId"]` and active `POST /api/agent` → `AgentController.handleAgentMessage`; `ChatWidgetComponent` uses `localStorage["magadim_conversation_id"]` and calls `POST /api/chat`, for which no backend mount exists. Evidence: `chat-agent.component.ts:33-55,91-96`, `chat-widget.component.ts:90-100,241-247`, `backend/src/server.ts:229`, `backend/src/routes/agent.routes.ts:8`; no `/api/chat` mount exists in `backend/src/server.ts:219-245`.

## Public/auth/employee routes

### `/` — `HomeComponent`

- Guard/layout: `institutionRetailRedirectGuard`; root shell. Route evidence: `app.routes.ts:8-12`.
- Calls actually invoked:
  - `GET /api/settings` through `SiteSettingsService.getSettings(true)` → `settingsController.getSettings`.
  - First `MenuService` injection in this application lifetime also performs eager `GET /api/menu` → `MenuController.getAllMenuItems`.
  - Child `FeaturedMenuComponent`: `GET /api/menu/featured` through `MenuService.getFeaturedItems()` → `MenuController.getFeaturedMenuItems`.
  - Child `VideoSectionComponent`: `GET /api/videos?active=true` → `VideoController.getVideos`; `GET /api/gallery?type=image&active=true` → `GalleryController.getAllGalleryItems`.
  Evidence: `home.component.ts:31-39,132-142`, `featured-menu.component.ts:68-99`, `video-section.component.ts:134-153`, `site-settings.service.ts:92-177`, `menu.service.ts:592-603`, `video.routes.ts:9-15`, `gallery.routes.ts:10-17`, `settings.routes.ts:11-20`.
- Forms/payload: no submit form. Quantity selection is local child state `itemQuantities`; “add” writes a cart line `{id,name,price,imageUrl,description,category}` to `CartService`, not HTTP (`featured-menu.component.ts:64-67,106-175`).
- Local/shared state: `settings`, `showPopup`, review/typing indexes and timers; child `displayedProducts`, `mediaItems`, loading flags; `SiteSettingsService.settingsSubject`, `CartService`.
- Storage: cross-cutting keys above; `popupDismissed` through `PagePopupComponent`; cart writes `megadim-cart`.

### `/about`, `/terms`, `/accessibility`, `/privacy-policy`

- Components: `AboutPageComponent`, `TermsComponent`, `AccessibilityComponent`, `PrivacyPolicyComponent`; root shell; no route guards.
- No component API call, submit form, storage key, or shared mutable state beyond root shell/router. Evidence: routes `app.routes.ts:13-16,128-140`; component files `pages/about-page/about-page.component.ts`, `pages/terms/terms.component.ts`, `pages/accessibility/accessibility.component.ts`, `pages/privacy-policy/privacy-policy.component.ts`.

### `/events-catering` and `/catering`

- Both execute the canonical `EventsCateringComponent` block; no guard; root shell. Aliasing evidence: `app.routes.ts:17-24`.
- Calls: `GET /api/settings` → `settingsController.getSettings`; submit `POST /api/catering/events` → `CateringController.submitEventCateringOrder` (`events-catering.component.ts:91-102,303-305`; `catering.routes.ts:8`).
- Form fields map unchanged: `fullName`, `phone`, `email`, `eventDate`, `eventType`, `guestCount`, `venue`, `salads[]`, `mainCourses[]`, `sides[]`, `deliveryType`, `address`, `notes`. Added payload keys: `receptionBar`, `receptionBarVariant`, `desserts`, `firstCourses[]`, `firstCourseUpgrade`, `kosherUpgrade`, `pricePerPortion`, `totalEventPrice`, `basePackageTitle` (`events-catering.component.ts:105-120,286-301`).
- Validation: trimmed `fullName`, `phone`, `email`, `eventType` required; integer-like `guestCount >= 1`; `eventDate` required, today or later, Saturday rejected; `receptionTier` required when reception bar selected (`events-catering.component.ts:141-178,253-284`).
- State: `settings`, popup/form visibility, submit flags/messages, upgrade booleans, `receptionTier`, `firstCourses`, date control/error, `orderForm`, calculated prices (`events-catering.component.ts:66-89`). Shared: `SiteSettingsService`; popup session key.

### `/shabbat-events`, `/holiday-food`, `/holiday`

- All execute `HolidayFoodComponent`; no guard; root shell. Evidence: `app.routes.ts:37-40,49-56`.
- Calls: `GET /api/settings/delivery` → `settingsController.getDeliverySettings`; `GET /api/settings` → `settingsController.getSettings`; submit `POST /api/catering` → `CateringController.submitCateringOrder` (`holiday-food.component.ts:194-225,430-460,481-491`; `settings.routes.ts:19`; `catering.routes.ts:7`).
- Controls/payload: `fullName→fullName`, `phone→phone`, `email→email`, date control→`eventDate`, `mealTime→mealTime`, `portionsEvening→portionsEvening`, `portionsMorning→portionsMorning`, derived sum→`numberOfPortions`, eight salad selectors→`salads[]`, evening first/main/side selectors→`firstCoursesEvening[]/mainCoursesEvening[]/sidesEvening[]`, morning equivalents, `seudaShlishit`, `deliveryType`, `address`, `remarks` (`holiday-food.component.ts:102-121,359-375,430-455`; template `holiday-food.component.html:162-445`).
- Validation: required identity/date/meal/delivery fields; date must meet minimum lead days, be in configured open dates, before cutoff, not Saturday, and not `2026-04-23` or `2026-05-02`; active meal portion count must be a positive integer; 6–8 unique salads; each active meal requires exactly 2 unique first courses, 2 unique mains, and 3 unique sides (`holiday-food.component.ts:123-139,268-356,383-424`).
- State: settings/menu/popup/submission flags, date rules/messages, visibility booleans, validation errors, option arrays, `orderForm`; shared `SiteSettingsService`; popup session key.

### `/cholent-bar` and `/cholent`

- Alias pair for `CholentBarComponent`; no guard; root shell (`app.routes.ts:41-48`).
- Calls: `GET /api/settings` → `settingsController.getSettings`; `GET /api/menu?type=cholent` through `getAllItems('cholent')` → `MenuController.getAllMenuItems` (`cholent-bar.component.ts:34-51,83-99`; `menu.service.ts:351-384`).
- No submit form. State: settings/popup, grouped menu items/loading, `cholentForceOpen`, custom/closed messages. Shared: `MenuService.menuItemsSubject/loadingSubject`, `SiteSettingsService`; popup session key.

### `/kosher`

- `KosherCertificateComponent`; no guard; root shell (`app.routes.ts:57-60`).
- Calls `GET /api/settings` through `SiteSettingsService.getSettings(true)` → `settingsController.getSettings`; no form. State is settings/certificate URL and loading/error UI; shared settings cache. Evidence: `kosher-certificate.component.ts`, `site-settings.service.ts:82-85,92-177`.

### `/contact`

- `ContactComponent`; no guard; root shell (`app.routes.ts:61-64`).
- `POST /api/contact` through `ContactService.submitContactForm` → `ContactController.submitContactForm` (`contact.component.ts:58-82`, `contact.routes.ts:10`).
- Controls/payload: `name→name`, `phone→phone`, `email→email`, `message→message`; optional `marketingData` from stored UTM keys. Template-driven validity is required name/phone/email/message with email format (`contact.component.ts:21-26,58-71`; `contact.component.html` form controls).
- State: `form`, submit/success/error flags, contact info; shared `MarketingService`; reads `megadim_utms`.

### `/cart`

- `CartPageComponent`; guard `institutionRetailRedirectGuard`; root shell (`app.routes.ts:65-69`).
- No API call and no submit form. It invokes cart quantity/remove/clear methods only. State is `cartItems`, `cartSummary`; shared `CartService.cartItems$`; reads/writes `localStorage["megadim-cart"]`. Evidence: `cart-page.component.ts`, `cart.service.ts:27-224`.

### `/checkout`

- `CheckoutPageComponent`; guard `institutionRetailRedirectGuard`; root shell (`app.routes.ts:70-74`).
- Calls actually invoked:
  - `GET /api/settings` → `settingsController.getSettings`.
  - Direct `GET /api/settings/delivery` → `settingsController.getDeliverySettings`.
  - `DeliveryService.calculateFee`: `POST /api/delivery/calculate-fee` body `{destinationCity,cartTotal}` → `postCalculateFee`.
  - `CouponService.applyCoupon`: `POST /api/coupons/apply` body `{code,cartTotal}` → `CouponController.applyCoupon`.
  - Direct `POST /api/orders` → `OrderController.createOrder`.
  - Then direct `POST /api/payment/initiate/:orderId` body `{}` → `PaymentController.initiatePreAuth`.
  - `LocationService.getIsraeliCities()` calls the external Gov.il dataset, bypassing interceptors; it is not a project backend endpoint.
  Evidence: `checkout-page.component.ts:137-285,397-429,483-600`, `delivery.service.ts:22-30`, `coupon.service.ts:58-62`, `orders.routes.ts:64`, `payment.routes.ts:18-22`.
- Form controls/payload:
  - `fullName` required → retained as `fullName` and mapped to trimmed `customerName`.
  - `phone` required/minLength 9 → trimmed `phone`.
  - `customerEmail` required/email → retained and mapped to `email`.
  - `eventDate` required/open-date validation → formatted `eventDate`.
  - `deliveryType` required → retained and mapped to `deliveryMethod`.
  - `city`, `streetAddress` required only for delivery → `address:{city,street,apartment:''}`.
  - `notes` → trimmed `notes`.
  - `termsAccepted` required true; because `...formValue` is spread, it is also sent as `termsAccepted`.
  - Derived: `items[{id,name,quantity,price,category?,imageUrl?}]`, `subtotal`, `deliveryFee`, `totalAmount`, optional `couponCode`, `userId`, `marketingData`.
  Evidence: `checkout-page.component.ts:138-148,468-480,521-563`.
- State: coupon inputs/results; city autocomplete; all delivery status flags; `orderForm`, cart items/summary, settings, payment messages, date rules; Subjects for recalculation/destruction. Shared: cart, auth, settings, marketing. Storage: `megadim-cart`, `megadim_utms`; cart is intentionally cleared only by confirmation.

### `/order-confirmation/:id`

- `OrderConfirmationComponent`; no guard; root shell (`app.routes.ts:75-78`).
- No API call. It reads route param/navigation state, clears `CartService` immediately, and builds WhatsApp text from cached settings (`order-confirmation.component.ts:16-56`). No form. State: `order`, `orderId`, `copied`, timeout. Writes `megadim-cart` as `[]`.

### `/my-orders`

- `MyOrdersComponent`; guards `institutionRetailRedirectGuard` and `authGuard`; root shell (`app.routes.ts:79-86`).
- Calls: `GET /api/orders/myorders` → inline authenticated handler in `orders.routes.ts:68-88`; on detail click `GET /api/order/:id` → `OrderController.getOrderById`; logout `POST /api/auth/logout` → inline logout callback (`my-orders.component.ts:568-586,676-697,704-711`).
- No submit form. Reorder rewrites `megadim-cart` with `{id,name,price,quantity,imageUrl,category,description}`. State: orders/loading/error/logout/selected order; shared auth/cart.

### `/my-account`

- `UserProfileComponent`; guards `institutionRetailRedirectGuard` and `authGuard`; root shell (`app.routes.ts:87-94`).
- `GET /api/orders/myorders` → same inline handler as `/my-orders` (`user-profile.component.ts:27-57`). No form. State: current user, orders/loading/error; reorder writes cart.

### `/profile`

- Full redirect to `/my-account`; no component/API/form/local state/storage beyond router (`app.routes.ts:95-99`).

### `/login`

- `LoginComponent`; no route guard; root shell (`app.routes.ts:101-105`).
- Submit `POST /api/auth/login` body `{username,password}` → inline login callback; logout button `POST /api/auth/logout` body `{}` → inline logout callback. Session state is observed from `AuthService.currentUser$`, `isLoggedIn$`, `sessionInitDone$` (`login.component.ts:127-182,199-270,333-343`; `auth.service.ts:111-152`; `auth.routes.ts:66-151,295-301`).
- Controls: `username` required+email → `username`; `password` required → `password`. The method logs invalidity but still proceeds when fields are missing, so HTML validity is not an effective submission block (`login.component.ts:57-121,199-238`).
- State: credentials, mode/loading/messages/errors/logged-in/current user. Cookie `token` is HttpOnly and set/cleared by backend; auth logout also removes local keys `auth_token`, `auth_user`, `token`, `authToken`, `userToken` and session keys `auth_token`, `auth_user` (`auth.service.ts:127-152`).

### `/register`

- `RegisterComponent`; no guard; root shell (`app.routes.ts:106-109`).
- `POST /api/auth/register` body `{fullName,username,password}` → inline register callback (`register.component.ts:260-300`; `auth.routes.ts:154-213`).
- Controls: `fullName` required; `username` required+email; `password` required+minLength 6; keys map unchanged. State: `registerForm`, loading/error; shared auth subjects and HttpOnly `token`.

### `/time-clock`

- `TimeClockComponent`; no guard; root uses full-screen mode (`app.routes.ts:111-115`, `app.component.ts:151-160`).
- Direct `POST /api/attendance/clock` body `{pinCode}` → `AttendanceController.clockByPin` (`time-clock.component.ts:374-422`; `attendance.routes.ts:12`).
- Control/state: keypad-only `pinCode`, exactly four digits required before submit; time/date, processing/status/animation flags. No browser storage.

### `/employee-login`

- `EmployeeLoginComponent`; no guard; full-screen root (`app.routes.ts:117-121`).
- Direct `POST /api/auth/employee-login` body `{phone:trimmed,pinCode:trimmed}` with credentials → inline employee-login callback (`employee-login.component.ts:262-299`; `auth.routes.ts:216-277`).
- Controls: phone required; PIN required, HTML maxLength 6; component validates only non-empty. State: phone, PIN, loading/error; successful response writes only in-memory `AuthService` state; backend cookie is HttpOnly.

### `/my-zone`

- `MyZoneComponent`; `employeeGuard`; full-screen root (`app.routes.ts:122-126`).
- Direct `GET /api/employees/my/stats` → `EmployeeController.getMyStats`; logout `POST /api/auth/logout` (`my-zone.component.ts:372-408,425-428`; `employee.routes.ts:19`).
- No form. State: employee name, stats, loading/error; shared auth state; auth cleanup keys as listed under `/login`.

### `/**`

- Redirect to `/`; no component/API/form/local state/storage beyond router (`app.routes.ts:155-159`).

## Ready-for-Shabbat route family

All entries below are children of `ReadyForShabbatComponent` (nested `<router-outlet>` layout) and have no route guard. The same 21 child records are mounted under `/ready-for-shabbat`, `/ready-food`, and `/shabbat` (`app.routes.ts:25-36`; `ready-for-shabbat.routes.ts:3-113`).

### Complete expanded URL inventory

| Child record | `/ready-for-shabbat` URL | `/ready-food` URL | `/shabbat` URL | Execution |
|---|---|---|---|---|
| empty | `/ready-for-shabbat` | `/ready-food` | `/shabbat` | Shabbat landing block |
| `main` | `/ready-for-shabbat/main` | `/ready-food/main` | `/shabbat/main` | main category block |
| `fish` | `/ready-for-shabbat/fish` | `/ready-food/fish` | `/shabbat/fish` | fish category block |
| `salads` | `/ready-for-shabbat/salads` | `/ready-food/salads` | `/shabbat/salads` | salads category block |
| `sides` | `/ready-for-shabbat/sides` | `/ready-food/sides` | `/shabbat/sides` | sides category block |
| `desserts` | `/ready-for-shabbat/desserts` | `/ready-food/desserts` | `/shabbat/desserts` | desserts category block |
| `stuffed` | `/ready-for-shabbat/stuffed` | `/ready-food/stuffed` | `/shabbat/stuffed` | stuffed category block |
| `holiday` | `/ready-for-shabbat/holiday` | `/ready-food/holiday` | `/shabbat/holiday` | holiday category block |
| `desserts-new` | `/ready-for-shabbat/desserts-new` | `/ready-food/desserts-new` | `/shabbat/desserts-new` | redirect to sibling `desserts`; router only |
| `main-dishes` | `/ready-for-shabbat/main-dishes` | `/ready-food/main-dishes` | `/shabbat/main-dishes` | redirect to sibling `main`; router only |
| `side-dishes` | `/ready-for-shabbat/side-dishes` | `/ready-food/side-dishes` | `/shabbat/side-dishes` | redirect to sibling `sides`; router only |
| `main/:id` | `/ready-for-shabbat/main/:id` | `/ready-food/main/:id` | `/shabbat/main/:id` | product detail block, category `main` |
| `fish/:id` | `/ready-for-shabbat/fish/:id` | `/ready-food/fish/:id` | `/shabbat/fish/:id` | product detail block, category `fish` |
| `salads/:id` | `/ready-for-shabbat/salads/:id` | `/ready-food/salads/:id` | `/shabbat/salads/:id` | salad detail block |
| `sides/:id` | `/ready-for-shabbat/sides/:id` | `/ready-food/sides/:id` | `/shabbat/sides/:id` | product detail block, category `sides` |
| `desserts/:id` | `/ready-for-shabbat/desserts/:id` | `/ready-food/desserts/:id` | `/shabbat/desserts/:id` | product detail block, category `desserts` |
| `stuffed/:id` | `/ready-for-shabbat/stuffed/:id` | `/ready-food/stuffed/:id` | `/shabbat/stuffed/:id` | product detail block, category `stuffed` |
| `holiday/:id` | `/ready-for-shabbat/holiday/:id` | `/ready-food/holiday/:id` | `/shabbat/holiday/:id` | product detail block, category `holiday` |
| `main-dishes/:id` | `/ready-for-shabbat/main-dishes/:id` | `/ready-food/main-dishes/:id` | `/shabbat/main-dishes/:id` | product detail block, category `main` |
| `side-dishes/:id` | `/ready-for-shabbat/side-dishes/:id` | `/ready-food/side-dishes/:id` | `/shabbat/side-dishes/:id` | product detail block, category `sides` |
| `product/:id` | `/ready-for-shabbat/product/:id` | `/ready-food/product/:id` | `/shabbat/product/:id` | product detail block, category inferred |

Redirect rows have no API/form/state/storage beyond router.

### Shabbat landing block — `ShabbatMenuComponent`

- `GET /api/settings` → `settingsController.getSettings`; `GET /api/holiday-events/public/active` → `getActiveHolidayEvent` (`shabbat-menu.component.ts:82-105`; `holiday-event.routes.ts:17`).
- No form. State: settings/PDF URL, `activeHoliday`, categories, timer; shared settings and holiday services.

### Category blocks

- Main: `MenuService.getProductsByCategory('main-dishes')` → `GET /api/menu` → `MenuController.getAllMenuItems` (`main-dishes.component.ts:344-369`).
- Fish: `GET /api/settings` plus `getProductsByCategory('fish')` → `GET /api/menu` (`fish.component.ts:31-54`).
- Salads: `GET /api/settings` plus `getProductsByCategory('salads')` → `GET /api/menu` (`salads.component.ts:318-377`).
- Sides: `getProductsByCategory('sides')` → `GET /api/menu` (`side-dishes.component.ts:28-38`).
- Desserts and stuffed invoke their category equivalents, each resolving to `GET /api/menu` → `MenuController.getAllMenuItems`; desserts also invokes `GET /api/settings` for announcements. Evidence: `desserts.component.ts`, `stuffed.component.ts`, `menu.service.ts:865-896`.
- Holiday: `GET /api/settings` and `GET /api/holiday-events/public/active` → `getActiveHolidayEvent`; products are mapped client-side and cached in `HolidayCatalogService` (`holiday-category.component.ts:63-114`).
- There are no submit forms. Product option/variant and quantity selectors are local state; add-to-cart writes `{id,name,price,imageUrl,description,category}` to `megadim-cart`. Salads/sides require an option/variant before cart insertion. State names are the category item arrays, `isLoading`, `selectedOptions`, `selectedVariants`, `validationErrors`, settings/popup where imported.

### Product detail block — `ProductDetailsComponent`

- For ordinary IDs, `MenuService.getProductById` calls `GET /api/menu` and filters client-side; it does **not** call `GET /api/menu/:id` (`product-details.component.ts:674-714`; `menu.service.ts:733-847`).
- For IDs prefixed `he:`, it calls `GET /api/holiday-events/public/active` → `getActiveHolidayEvent`, caches mapped items, then resolves locally (`product-details.component.ts:677-687`; `menu.service.ts:744-757`).
- No submit form. Controls: selected size index and quantity 1–10; add-to-cart payload `{id,name,price,imageUrl,description,category}` plus quantity. State: `product`, loading, quantity, category, selected size; shared menu/holiday catalog/cart.

### Salad detail block — `SaladDetailComponent`

- Resolves the route ID through `MenuService.getProductById`, therefore ordinary IDs perform `GET /api/menu` → `MenuController.getAllMenuItems`; no `GET /api/menu/:id`. No HTTP form. Local option/variant/quantity state writes the selected line to `CartService`. Evidence: `salad-detail.component.ts`, `menu.service.ts:733-847`.

## Portal route

### `/portal` — `PortalLayoutComponent` → `InstitutionDashboardComponent`

- Guards/layout: `authGuard`, `institutionGuard`, isolated portal layout (`portal.routes.ts:3-22`).
- Calls: `GET /api/portal/status?weekStartDate=YYYY-MM-DD` → `getPortalStatus`; submit `POST /api/portal/submit` → `submitPortalOrder`; logout `POST /api/auth/logout` (`institution-dashboard.component.ts:193-217,294-343`; `institution-portal.service.ts:111-142`; `portal.routes.ts:9-11`).
- Form/payload:
  - each weekday: `dayOfWeek`, `regularCount`, `vegetarianCount`, `notes` → `days[]`.
  - Shabbat `wantsSeudaShlishit`; `mealPortions.fridayNight|shabbatDay|seudaShlishit.{regularCount,vegetarianCount}`; derived legacy `regularCount/vegetarianCount`; extras `challahs`, `rolls`, `grapeJuice`; `notes` → `shabbatOrder`.
  - `status.weekStartDate→weekStartDate`; `generalNotes→generalNotes`.
  - Service sends exactly `{weekStartDate,days,shabbatOrder,generalNotes}`.
  Counts must be non-negative integers; notes max `ORDER_NOTES_MAX_LENGTH`; at least one weekday/Shabbat portion is required; locked sections are disabled (`institution-dashboard.component.ts:65-127,235-287,294-328`).
- State: `status`, loading/saving/error, form, selected week view; shared auth/portal state. No browser storage beyond auth cleanup/root consent.

## Admin routes

All admin children use `AdminLayoutComponent`, parent guards `authGuard` and `adminStaffGuard`; each child uses `adminRouteRolesGuard`. `/admin/delivery` allows `admin|driver`; every other concrete child allows `admin` only (`admin.routes.ts:9-114`). `/admin` empty child redirects to `/admin/dashboard` and has no API/form/state beyond guard/router.

### `/admin/dashboard` — `AdminDashboardComponent`

- Calls: `GET /api/order/analytics/revenue-by-source` → `OrderController.getRevenueBySource`; `GET /api/order/analytics/monthly-revenue` → `OrderController.getMonthlyRevenue`; `GET /api/order/stats/revenue` → `OrderController.getRevenueStats`; `GET /api/order` → `OrderController.getAllOrders`; `GET /api/menu` → `MenuController.getAllMenuItems` (`dashboard.component.ts:624-625,712-725,855-876`; `order.routes.ts:96-115`).
- No submit form. State: chart datasets/options, counts/revenue/recent orders/menu counts, loading/error. Shared order/menu service state.

### `/admin/menu` — `MenuManagementComponent`

- Calls: `GET /api/menu?includeUnavailable=true` → `getAllMenuItems`; `POST /api/upload` multipart field `image` → upload route callback; `POST /api/menu` → `createMenuItem`; `PUT /api/menu/:id` → `updateMenuItem`; `DELETE /api/menu/:id` → `deleteMenuItem`; `PUT /api/menu/reorder` body `[{id,order}]` → `reorderMenuItems` (`menu-management.component.ts:1784-1902,2091-2104,2228-2258,2312-2388`; `menu.routes.ts:19-32`; `upload.routes.ts:36-73`).
- Item form keys: `name`, `category`, `description`, `pricingType`, `price`, `pricePer100g`, `pricingVariants[{label,price}]`, `pricingOptions[{label,amount,price}]`, `imageUrl`, comma-to-array `tags`, `recipe[{name,quantity,unit,category}]`, `isAvailable`, `isPopular`, `isFeatured`. Name/category required; single price >0; every selected variant requires label and price >0; every option requires label, amount, price >0; recipe fields required and quantity >0 (`menu-management.component.ts:1737-1749,2135-2217,2504-2541`).
- State: menu/category arrays, item form/modal/editing/upload/preview/loading/messages, drag order. Shared `MenuService` subjects.

### `/admin/orders` — `AdminOrdersComponent`

- Calls:
  - `GET /api/order/dashboard-stats` → `getDashboardStats`
  - `GET /api/order/admin/tab-counts` → `getAdminTabCounts`
  - `GET /api/order` with exact filters `page,limit,source,statusTab,search,dateFrom,dateTo,orderNumberSearch,customerSearch,createdFrom,createdTo,eventFrom,eventTo,sortBy,sortDir,hasCustomerNotes,hasAdminNotes` → `getAllOrders`
  - `PATCH /api/order/:id/shipping-cost` `{shippingCost}` → `updateOrderShippingCost`
  - `POST /api/order/bulk` `{orderIds,action,status?}` → `bulkUpdateOrders`
  - `DELETE /api/order/:id` → `deleteOrder`; `PUT /api/order/:id/restore` `{}` → `restoreOrder`; `DELETE /api/order/:id/permanent` → `permanentDeleteOrder`
  - `PUT /api/order/admin/:id/items` `{items}` → `updateOrderItems`
  - `PUT /api/order/:id/status` `{status}` → `updateOrderStatus`
  - `PATCH /api/order/admin/:id/admin-notes` `{adminNotes}` → `updateOrderAdminNotes`
  - `PUT /api/order/:id/date` `{eventDate,newDate}` → `updateOrderDate`
  - `PATCH /api/order/admin/:id/portions` `{portionsEvening,portionsMorning}` → `updateOrderPortions`
  - `POST /api/payment/capture/:id` `{}` → `PaymentController.capturePayment`; `POST /api/payment/void/:id` `{}` → `PaymentController.voidPayment`
  - product editor loads `GET /api/menu` → `getAllMenuItems`.
  Evidence: `admin-orders.component.ts:201-326,699-951,1164,1629-1709,1780,2117-2473`; `order.service.ts:286-591,783-839`; `order.routes.ts:120-145`; `payment.routes.ts:32-37`.
- Mutation controls map directly to the payload keys above. Filter controls do not mutate backend. Item rows map `productId/id/name/quantity/category/price/description/selectedOption`; portions must be finite integers ≥0; shipping cost finite ≥0; date non-empty; admin notes string. State includes selected IDs, source/status tabs, draft/applied filters/sort/page, order lists/counts/stats, edit buffers, payment/loading flags.
- Storage: reads/writes `localStorage["admin_orders_adoption_kpis_v1"]` (`admin-orders.component.ts:263-271`).

### `/admin/leads` — `AdminLeadsComponent`

- Calls: `GET /api/contact` through `getContacts({status,limit,offset})` → `ContactController.getAllContactRequests`; `GET /api/contact/analytics/source` → `getLeadsBySource`; `PATCH /api/contact/:id/status` → `updateContactStatus`; `DELETE /api/contact/:id` → `deleteContactRequest` (`admin-leads.component.ts:147-172,339-397`; `admin-contacts.service.ts:67-179`; `contact.routes.ts:13-18`).
- Editable payload keys: `status`, `notes`, `leadScore`, `lastContactAt`, `nextFollowUpAt`, `outcomeReason`, `ownerNotes`; filters `status`, search/source/follow-up/selection are local/query controls. State: contacts/pagination/filter/edit/selection/loading/KPI values.
- Storage: `localStorage["admin_leads_adoption_kpis_v1"]` (`admin-leads.component.ts:447-458`).

### `/admin/marketing` — `AdminMarketingComponent`

- Calls: `GET /api/contact/analytics/source` → `getLeadsBySource`; `GET /api/order/analytics/revenue-by-source` → `getRevenueBySource`; `GET /api/campaign?limit=20` → `getCampaigns`; `POST /api/campaign/launch` → `launchCampaign` (`admin-marketing.component.ts:161-182,185-258`; `campaign.routes.ts:8-9`).
- Campaign controls/payload: trimmed `campaignTitle→title` required; trimmed `campaignContent→content` required; optional trimmed `campaignMediaUrl→mediaUrl`; `selectedPlatforms→platforms` requires ≥1; optional valid datetime `campaignScheduledAt→scheduledAt` ISO string. State: charts/tab, campaign fields/list/status/messages, preview and drag/drop arrays.

### `/admin/customers` — `AdminCustomersComponent`

- Calls: customer list `GET /api/customers?...` → `getCustomers`; create `POST /api/customers` → `createCustomer`; CRM `PUT /api/customers/:id/crm` → `updateCustomerCrm`; delete `DELETE /api/customers/:id` → `deleteCustomer`; migrate `POST /api/customers/migrate` `{}` → `migrateLegacyData`; audit `POST /api/customers/audit` `{}` → `auditCustomersSync`; resolve `GET /api/users/resolve?email&phone` → `resolveUserByUsername`; role `PATCH /api/users/:id/role` `{role}` → `updateUserRole`; order history `GET /api/order` → `getAllOrders` (`admin-customers.component.ts:307-419,479-489,608-783`; `users.service.ts:136-185`; `customer.routes.ts:15-20`; `user.routes.ts:14-18`).
- Create fields map `newCustomerFullName→fullName`, `newCustomerPhone→phone`, optional email/address/city to same keys; full name and phone required. CRM fields map exactly `fullName,email,address,city,adminNotes,dietaryInfo,manualStatus,customerCategory,phone?`; site role maps `panelSiteRole→role`. State: customer lists/filters/selection, create modal, CRM panel fields, linked-site-user state, order history.

### `/admin/coupons` — `AdminCouponsComponent`

- Calls: `GET /api/coupons` → `CouponController.listCoupons`; `POST /api/coupons` → `createCoupon`; `PUT /api/coupons/:id` → `updateCoupon`; `DELETE /api/coupons/:id` → `deleteCoupon` (`admin-coupons.component.ts:53-166`; `coupon.routes.ts:21-26`).
- Create controls/payload: `code` required→trimmed uppercase `code`; required `discountType→discountType`; required `discountValue` min0→number; required `minOrderValue` min0→number; required `expiryDate→expiryDate`; required `maxUses` min1→number; required `maxUsesPerCustomer` min1→number; `isActive→isActive`; `isVipOnly→isVipOnly`; required `targetCustomerCategory→targetCustomerCategory`. Percentage value is additionally constrained to 0–100. Toggle sends `{isActive}`. State: coupons, selected IDs, create form, submit/delete/loading/messages (`admin-coupons.component.ts:18-63,91-177`).

### `/admin/holiday-events` — `AdminHolidayEventsComponent`

- Calls: `GET /api/holiday-events` → `listHolidayEvents`; `POST /api/holiday-events` → `createHolidayEvent`; `PUT /api/holiday-events/:id` → `updateHolidayEvent`; `DELETE /api/holiday-events/:id` → `deleteHolidayEvent`; cover/product image `POST /api/upload` → upload callback (`admin-holiday-events.component.ts:156-184,224-254,397-474`; `holiday-event.routes.ts:24-28`).
- Event payload: `name` required→trimmed `name`; `isActive→isActive`; required valid local datetime→ISO `orderDeadline`; `imageUrl→imageUrl`; products map `_id?`, form `name→title`, numeric `price`, `description`, `imageUrl`, `pricingType`, `weightUnit`, `pricingOptions[{label,amount,price}]`, `isAvailable`. Product name required, fixed price ≥0, active event requires ≥1 available product (`admin-holiday-events.component.ts:58-64,102-153,269-290,397-425`).
- State: events/selection/form/product modal/upload/save/delete/visibility status.

### `/admin/shipping` — `ShippingManagementComponent`

- Calls: `GET /api/settings/delivery` → `getDeliverySettings`; `PUT /api/settings/delivery` → `updateDeliverySettings` with complete payload; `GET /api/delivery/cities` → `getCityOverrides`; `POST /api/delivery/cities` → `createCityOverride`; `PUT /api/delivery/cities/:id` → `updateCityOverride`; `DELETE /api/delivery/cities/:id` → `deleteCityOverride`; test `POST /api/delivery/calculate-fee` → `postCalculateFee` (`shipping-management.component.ts:72-161,244-381`; `settings.routes.ts:19-20`; `delivery.routes.ts:21-29`).
- Global/tier payload: `freeShippingThreshold`, `isFreeShippingActive`, `baseDeliveryFee`, `pricePerKm`, optional `openDates`, `minimumLeadDays`, and `tiers[{_id,minDistanceKm,maxDistanceKm,price,isActive,freeShippingThreshold?,minOrderForDelivery?}]`. Tier controls map `minKm→minDistanceKm`, `maxKm→maxDistanceKm`, `price`, thresholds; min≤max and optional thresholds ≥0. City add maps `newCityName→displayName`, `newCityPrice→overridePrice`; edit sends `{overridePrice}` or `{isActive}`. Test maps `testAddress→destinationCity`, `testCartTotal→cartTotal`.
- Important: this routed screen does **not** invoke `ShippingService.createPricingTier`, `updatePricingTier`, or `deletePricingTier`; tiers are persisted inside `PUT /api/settings/delivery`. Those three service methods target nonexistent write endpoints and are broken if invoked.

### `/admin/delivery` — `DeliveryManagementComponent`

- Calls: `GET /api/users/drivers` → `getDriverUsers`; `GET /api/settings/delivery` → `getDeliverySettings`; `GET /api/order/delivery-report?fromDate&toDate` → `OrderController.getDeliveryReport`; `PATCH /api/order/:id/assign-driver` `{driverId|null}` → `assignOrderToDriver`; `PUT /api/order/:id/status` `{status:'delivered'}` → `updateOrderStatus` (`delivery-management.component.ts:1351-1416,1756-1774`; `user.routes.ts:15`; `order.routes.ts:117,128,137`).
- Controls are date range, driver assignment, and delivered status; outgoing keys are exactly `fromDate`, `toDate`, `driverId`, `status`. State: delivery report/day/city groups, date range, drivers, filters/selections, loading/error and mobile/print UI.

### `/admin/shopping` — `ShoppingListComponent`

- Direct `GET /api/shopping?safetyMargin=0|10` → `shoppingController.getShoppingList`; the sole control `safetyMarginEnabled` maps false→`safetyMargin=0`, true→`safetyMargin=10` (`shopping-list.component.ts:435-475`; `shopping.routes.ts:12`). No backend mutation form. State: `shoppingList`, `isLoading`, `errorMessage`, `safetyMarginEnabled`.

### `/admin/gallery` — `UnifiedGalleryComponent`

- Child `GalleryManagementComponent`: `GET /api/gallery?type=image&active=false`, `POST /api/gallery`, `PUT /api/gallery/:id`, `DELETE /api/gallery/:id` → corresponding `GalleryController` methods; image `POST /api/upload`.
- Child `VideoGalleryComponent`: `GET /api/videos?active=false`, `POST /api/videos`, `PUT /api/videos/:id`, `DELETE /api/videos/:id` → corresponding `VideoController` methods; video `POST /api/upload/video`.
- Evidence: `unified-gallery.component.ts`; `gallery-management.component.ts:71-314`; `video-gallery.component.ts:71-276`; `gallery.routes.ts:10-17`; `video.routes.ts:10-20`; `upload.routes.ts:36-97`.
- Gallery form maps `title,type,url,thumbnailUrl,description,order,isActive`; video form maps `title,description,videoUrl,youtubeUrl,thumbnailUrl,videoId,duration,order,isActive`. Required media URL rules are enforced by the child forms; file MIME/size validation occurs in `UploadService`. State is tab plus both child forms/lists/uploads/previews/messages.

### `/admin/institutions` — `AdminInstitutionsComponent`

- Calls:
  - `GET/POST/PUT/DELETE /api/admin/b2b-dictionary` and `PUT/DELETE /api/admin/b2b-dictionary/:id` → `listB2BMenuItems/createB2BMenuItem/updateB2BMenuItem/deleteB2BMenuItem`.
  - `GET/POST/PUT/DELETE /api/admin/institutions` and `/:id` → `listInstitutions/createInstitution/updateInstitution/deleteInstitution`.
  - `GET/POST/DELETE /api/admin/institutions/menu` → `getInstitutionWeekMenu/upsertInstitutionWeekMenu/deleteInstitutionWeekMenu`.
  - `GET /api/admin/institutions/reports` → `getInstitutionWeekReports`.
  - `GET/PUT/DELETE /api/admin/institutions/order/:institutionId` → `getAdminInstitutionOrder/adminUpdateInstitutionOrder/adminDeleteInstitutionOrder`.
  Evidence: `admin-institutions.component.ts:516-611,869-1117,1758-1818,1945-2135`; `institution-admin.service.ts:72-183`; backend `institution.routes.ts:21-25`, `admin-institutions.routes.ts:19-25`, `b2b-dictionary.routes.ts:16-19`.
- Account form: `fullName` required/min2, `username` required/email, new-account `password` required/min6 (edit optional/min6), `phone`, `customMessage→portalSettings.customMessage`, `isActive`.
- Week menu: required `weekdayOrderDeadline`, `shabbatOrderDeadline` converted to ISO; weekday groups map the named menu fields from `MENU_WEEKDAY_FORM_FIELDS`; Shabbat package maps `hasShabbat`, Friday-night/Shabbat-day/seuda-shlishit menu groups and salads.
- Dictionary form: `name` required/min2, `category` required, `gramsPerPortion` min1 for meat/kg categories, `portionsPerGastronorm` min1, and `calculationSettings{enabled,reportUnit,calculationMethod,quantityPerPortion,quantityPerOrder,quantityPerXPortions,xPortions,minimumQuantity}` with required positive fields selected by method.
- Order editor maps `days[{dayOfWeek,dayLabel,regularCount,vegetarianCount,notes}]`, `shabbatOrder` meal counts/extras/notes, and `adminNotes`; counts min0 and notes max configured limit. State: active tab, institution/menu/report/order/dictionary forms, lists, week selection, modals and loading/errors.

### `/admin/settings` — `AdminSettingsComponent`

- Calls: `GET /api/settings` → `getSettings`; `PUT /api/settings` → `updateSettings`; `GET /api/settings/delivery` → `getDeliverySettings`; `PUT /api/settings/delivery` → `updateDeliverySettings`; certificate `POST /api/upload` (`admin-settings.component.ts:95-155,297-318,329-358,433-507`).
- Settings payload is raw form value: `shabbatMenuUrl`, `eventsMenuUrl`, `kosherCertificateUrl`, `contactPhone`, `orderEmail`, `whatsappLink`, `cholentForceOpen`, `cholentCustomMessage`, `cholentClosedMessage`, and `pageAnnouncements` keyed by each of `home,events,holiday,cholent,salads,fish,desserts`, each containing `bannerText,popupTitle,popupText,popupLinkText,popupLinkUrl`. No validators are installed on these fields.
- Delivery-date payload: `{openDates:string[],openDateRules:[{date,cutoffTime}],minimumLeadDays}`; lead days normalized to non-negative integer and cutoff normalized. State: form/loading/saving, certificate preview/upload, open-date calendar/panel.

### `/admin/accounting` — `AccountingManagementComponent`

- Calls: `GET /api/admin/accounting/summary` → `getSummary`; `GET /api/admin/accounting/transactions?page&limit&source&dateFrom&dateTo` → `getTransactions`; `POST /api/admin/accounting/upload` multipart `file` → `uploadDocument`; `POST /api/admin/accounting/external` → `createExternal` (`accounting-management.component.ts:72-115,182-251`; `accounting.routes.ts:13-16`).
- Invoice controls/payload: `clientName` required→trimmed; `amount` required/min0.01→number; `issueDate` required; optional trimmed `invoiceNumber`, `description`; after upload add `fileUrl,fileKey`. Filters are source/from/to/page query controls. State: summary, transactions/meta/filters, file/modal/form/upload flags.

## Direct `HttpClient` calls in components

| Component | Routed consumer(s) | Exact call | Backend |
|---|---|---|---|
| `EventsCateringComponent` | `/events-catering`, `/catering` | `POST /api/catering/events` | `CateringController.submitEventCateringOrder` |
| `HolidayFoodComponent` | `/shabbat-events`, `/holiday-food`, `/holiday` | `GET /api/settings/delivery`; `POST /api/catering` | `settingsController.getDeliverySettings`; `CateringController.submitCateringOrder` |
| `CheckoutPageComponent` | `/checkout` | `GET /api/settings/delivery`; `POST /api/orders`; `POST /api/payment/initiate/:orderId` | `getDeliverySettings`; `OrderController.createOrder`; `PaymentController.initiatePreAuth` |
| `TimeClockComponent` | `/time-clock` | `POST /api/attendance/clock` | `AttendanceController.clockByPin` |
| `EmployeeLoginComponent` | `/employee-login` | `POST /api/auth/employee-login` | inline route callback |
| `MyZoneComponent` | `/my-zone` | `GET /api/employees/my/stats` | `EmployeeController.getMyStats` |
| `ShoppingListComponent` | `/admin/shopping` | `GET /api/shopping?safetyMargin=0|10` | `shoppingController.getShoppingList` |
| `CartModalComponent` | shared root child on retail routes | `POST /api/order/send` | `OrderController.sendOrder` |
| `ChatAgentComponent` | no active routed consumer | `POST /api/agent` | `AgentController.handleAgentMessage` |
| `ChatWidgetComponent` | no active routed consumer | `POST /api/chat` | **broken: no backend endpoint** |
| `ChatSummariesComponent` | inactive `admin-app.routes.ts` only | `GET /api/admin/summaries?key=...` | **broken in main backend; no mount** |
| `EmployeesComponent` | no active routed consumer | `GET /api/employees` | `EmployeeController.getEmployeesWithStatus`; component also navigates to inactive `/admin/employees/:id` |

Evidence: component `HttpClient` search results in the named files; mounts in `backend/src/server.ts:219-245`.

## HTTP service-method inventory and routed consumers

Methods listed as “none” exist but are not invoked by an active routed screen; their existence is not attributed to a route.

| Service methods | Method and endpoint | Active routed consumers |
|---|---|---|
| `AuthService.verifySession`, `validateToken` | `GET /api/auth/me` | app bootstrap/guards; `validateToken`: none |
| `AuthService.login`, `logout`, `register` | `POST /api/auth/login`; `POST /api/auth/logout`; `POST /api/auth/register` | `/login`; logout from `/login`, `/my-orders`, `/my-zone`, `/portal`/admin layouts; `/register` |
| `MenuService.loadMenuItems/getMenuItems/getAllItems/getProductsByCategory` | `GET /api/menu` with optional query keys `type` and `includeUnavailable` | Shabbat category/detail routes, `/cholent-bar`, `/cholent`, `/admin/dashboard`, `/admin/menu`, `/admin/orders` item editor |
| `MenuService.getFeaturedItems` | `GET /api/menu/featured` | `/` child |
| `MenuService.addMenuItem/updateMenuItem/deleteMenuItem/updateMenuOrder` | `POST /api/menu`; `PUT /api/menu/:id`; `DELETE /api/menu/:id`; `PUT /api/menu/reorder` | `/admin/menu` |
| `OrderService.submitOrder/createOrder` | `POST /api/order/checkout` | none in an active routed component; shared `CartService.sendOrder` uses same endpoint |
| `OrderService.createManualOrder` | `POST /api/orders` | admin manual-order child only when opened from admin order UI |
| `OrderService.getDashboardStats/getOrderTabCounts/getAdminOrdersPage/getAllOrders/getDriverMyOrders/getRevenueStats/getRevenueBySource/getMonthlyRevenue/getKitchenReport/getDeliveryReport` | `GET /api/order/dashboard-stats`; `GET /api/order/admin/tab-counts`; `GET /api/order`; `GET /api/order`; `GET /api/order/driver/my`; `GET /api/order/stats/revenue`; `GET /api/order/analytics/revenue-by-source`; `GET /api/order/analytics/monthly-revenue`; `GET /api/order/kitchen-report`; `GET /api/order/delivery-report` | `/admin/dashboard`, `/admin/orders`, `/admin/delivery`, `/admin/marketing`; kitchen report modal opened from `/admin/orders` |
| `OrderService.deleteOrder/restoreOrder/hardDeleteOrder/updateOrderStatus/assignOrderToDriver/updateOrderDate/updateShippingCost/updateOrderAdminNotes/updateOrderPortions/updateOrderItems/bulkUpdateOrders` | `DELETE /api/order/:id`; `PUT /api/order/:id/restore`; `DELETE /api/order/:id/permanent`; `PUT /api/order/:id/status`; `PATCH /api/order/:id/assign-driver`; `PUT /api/order/:id/date`; `PATCH /api/order/:id/shipping-cost`; `PATCH /api/order/admin/:id/admin-notes`; `PATCH /api/order/admin/:id/portions`; `PUT /api/order/admin/:id/items`; `POST /api/order/bulk` | `/admin/orders`; assignment and status also `/admin/delivery` |
| `OrderService.getMyOrders/getOrderById` | `GET /api/orders/myorders`; `GET /api/order/:id` | `/my-orders`, `/my-account`; detail only `/my-orders` |
| `OrderService.capturePayment/voidPayment/getPaymentStatus` | `POST /api/payment/capture/:id`; `POST /api/payment/void/:id`; `GET /api/payment/status/:id` | first two `/admin/orders`; status: none |
| `SiteSettingsService.getSettings/updateSettings` | `GET /api/settings`; `PUT /api/settings` | public screens listed above; update `/admin/settings` |
| `DeliveryService.calculateFee` | `POST /api/delivery/calculate-fee` `{destinationCity,cartTotal}` | `/checkout` |
| `ShippingService.getGlobalSettings/updateGlobalSettings/saveAllDeliverySettings/getCityOverrides/createCityOverride/updateCityOverride/deleteCityOverride/calculateFee` | `GET /api/settings/delivery`; `PUT /api/settings/delivery`; `PUT /api/settings/delivery`; `GET /api/delivery/cities`; `POST /api/delivery/cities`; `PUT /api/delivery/cities/:id`; `DELETE /api/delivery/cities/:id`; `POST /api/delivery/calculate-fee` | `/admin/shipping`; `getGlobalSettings` also `/admin/delivery`; `updateGlobalSettings` has no active routed invocation |
| `ShippingService.getPricingTiers` | `GET /api/delivery/pricing` | none |
| `ShippingService.createPricingTier/updatePricingTier/deletePricingTier` | `POST /api/delivery/pricing`; `PUT /api/delivery/pricing/:id`; `DELETE /api/delivery/pricing/:id` | none; **all three broken: backend exposes only GET `/pricing`** |
| `AdminDeliveryService.get/updateDeliverySettings` | `GET/PUT /api/settings/delivery` | `/admin/settings` |
| `CouponService.get/create/update/deleteCoupon` | `GET/POST /api/coupons`; `PUT/DELETE /api/coupons/:id` | `/admin/coupons` |
| `CouponService.applyCoupon` | `POST /api/coupons/apply` `{code,cartTotal}` | `/checkout` |
| `ContactService.submitContactForm` | `POST /api/contact` | `/contact` |
| `AdminContactsService.getContacts/updateContactStatus/getLeadsBySource/deleteContact` | `GET /api/contact`; `PATCH /api/contact/:id/status`; `GET /api/contact/analytics/source`; `DELETE /api/contact/:id` | `/admin/leads`; analytics also `/admin/marketing` |
| `GalleryService.getGalleryItems/getGalleryItemById/createGalleryItem/updateGalleryItem/deleteGalleryItem/getGalleryStatistics` | `GET /api/gallery`; `GET /api/gallery/:id`; `POST /api/gallery`; `PUT /api/gallery/:id`; `DELETE /api/gallery/:id`; `GET /api/gallery/stats` | list on `/` child and `/admin/gallery`; mutations `/admin/gallery`; `getGalleryItemById` and `getGalleryStatistics`: no active routed invocation |
| `VideoService.getVideos/getVideoById/createVideo/updateVideo/deleteVideo/getVideoStatistics` | `GET /api/videos`; `GET /api/videos/:id`; `POST /api/videos`; `PUT /api/videos/:id`; `DELETE /api/videos/:id`; `GET /api/videos/stats` | list on `/` child and `/admin/gallery`; mutations `/admin/gallery`; `getVideoById` and `getVideoStatistics`: no active routed invocation |
| `UploadService.uploadImage/uploadVideo` | multipart `POST /api/upload` field `image`; `POST /api/upload/video` field `video` | `/admin/menu`, `/admin/gallery`, `/admin/holiday-events`, `/admin/settings` |
| `HolidayEventService.getActive` | `GET /api/holiday-events/public/active` | Shabbat landing/holiday/detail routes |
| `HolidayEventService.list/getById/create/update/delete` | `GET /api/holiday-events`; `GET /api/holiday-events/:id`; `POST /api/holiday-events`; `PUT /api/holiday-events/:id`; `DELETE /api/holiday-events/:id` | `/admin/holiday-events`; `getById`: no active routed invocation |
| `UsersService.getUsers/updateUserCrm/createCustomer/deleteUser/migrateLegacyCustomers/runCustomerAudit/resolveSiteUser/patchSiteUserRole` | `GET /api/customers`; `PUT /api/customers/:id/crm`; `POST /api/customers`; `DELETE /api/customers/:id`; `POST /api/customers/migrate`; `POST /api/customers/audit`; `GET /api/users/resolve`; `PATCH /api/users/:id/role` | `/admin/customers` |
| `UsersService.getDriverUsers` | `GET /api/users/drivers` | `/admin/delivery` |
| `CampaignService.launchCampaign/getCampaigns` | `POST /api/campaign/launch`; `GET /api/campaign` | `/admin/marketing` |
| `InstitutionPortalService.getStatus/submit` | `GET /api/portal/status`; `POST /api/portal/submit` | `/portal` |
| `InstitutionAdminService.list/create/update/delete/toggleActive/deleteWeekMenu/deleteInstitutionOrder/getWeekMenu/saveWeekMenu/getInstitutionOrder/updateInstitutionOrder/getWeekReports` | `GET /api/admin/institutions`; `POST /api/admin/institutions`; `PUT /api/admin/institutions/:id`; `DELETE /api/admin/institutions/:id`; alias of `PUT /api/admin/institutions/:id`; `DELETE /api/admin/institutions/menu`; `DELETE /api/admin/institutions/order/:institutionId`; `GET /api/admin/institutions/menu`; `POST /api/admin/institutions/menu`; `GET /api/admin/institutions/order/:institutionId`; `PUT /api/admin/institutions/order/:institutionId`; `GET /api/admin/institutions/reports` | `/admin/institutions` |
| `B2BDictionaryService.list/create/update/delete` | `GET /api/admin/b2b-dictionary`; `POST /api/admin/b2b-dictionary`; `PUT /api/admin/b2b-dictionary/:id`; `DELETE /api/admin/b2b-dictionary/:id` | `/admin/institutions` |
| `AccountingService.getSummary/getTransactions/createExternal/uploadDocument` | `GET /api/admin/accounting/summary`; `GET /api/admin/accounting/transactions`; `POST /api/admin/accounting/external`; multipart `POST /api/admin/accounting/upload` field `file` | `/admin/accounting` |
| `CartService.sendOrder` | `POST /api/order/checkout` | none from `CartPageComponent`; service method currently has no active routed invocation |
| `SearchService` | no live HTTP call; former `/api/search` call is commented | none |
| `LocationService.getIsraeliCities` | external `GET https://data.gov.il/api/3/action/datastore_search?resource_id=5c78e9fa-c2e2-4771-93ff-7f400a12f7ba&limit=32000` | `/checkout` |
| `AnalyticsService`, `LanguageService`, `MarketingService`, `MetaPixelService`, `SeoService`, `ToastService`, `AuthModalService`, `HolidayCatalogService`, `TrackingService` | no project-backend HTTP methods | client/shared state only |

Service evidence: the 32 files under `frontend/src/app/services/`; handler/mount evidence: `backend/src/server.ts:219-245` and the route files cited in each route block.
