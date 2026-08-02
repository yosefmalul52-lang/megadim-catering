# 05 — Business Flows (verified)

This map contains **exactly 20 flow records**. Counting rule: the requested semantic item “partial payment/deposit” is one record (#9) with two explicit substatuses; “balance” remains a separate record (#10). Cancellation is therefore #11 and returning customer is #20. Status values are `IMPLEMENTED`, `PARTIAL`, and `ABSENT`.

Primary route mounts are in `backend/src/server.ts` (`/api/order`, `/api/orders`, `/api/payment`, `/api/catering`, `/api/portal`, `/api/menu`, `/api/upload`, `/api/coupons`, `/api/customers`). “Public” below means the route code has no `authenticate` middleware; it does not mean the operation is safe.

---

## 1. Regular order — `IMPLEMENTED`

- **Frontend entry:** `/ready-for-shabbat/**` (also `/ready-food`, `/shabbat`) → cart → `/checkout`; `CheckoutPageComponent.placeOrder`.
- **Ordered APIs:** page initialization `GET /api/settings/delivery`; when delivery city changes `POST /api/delivery/calculate-fee`; optional preview `POST /api/coupons/apply`; submit `POST /api/orders`; then `POST /api/payment/initiate/:orderId`; browser goes to Tranzila HPP; provider/browser calls `GET|POST /api/payment/success`; success redirects to `/order-confirmation/:orderId`.
- **Auth:** all creation/initiation/callback routes are public. `POST /api/orders` uses `optionalAuthenticate` only and is limited to 10 requests/15 minutes/IP.
- **Validation:** `CheckoutPageComponent` requires name, phone, email, event date, delivery type, terms, and address for delivery; checks open-date/cutoff and delivery eligibility. `OrderController.createOrder` rechecks name/phone/email, delivery/address, non-empty items, non-negative totals, and `OrderService.validateEventDateOpen`; server recalculates delivery fee and coupon-adjusted total. Item prices and `subtotal` still originate from the client.
- **DB reads/writes:** reads `StoreSettings`, delivery settings/tier data, optional `Coupon`; `OrderService.createOrderFromCheckout` writes `orders` fields `userId`, `orderNumber`, `customerDetails`, `items`, `subtotal`, `deliveryFee`, `totalPrice`, `status:'pending'`, `paymentStatus:'pending'`, `marketingData`; `initiatePreAuth` writes `paymentStatus:'awaiting_payment'`, `paymentSecurityToken`, `authorizedAmount`, `transactionId`; callback writes authorization/token fields. `upsertCustomerFromOrder` writes `customers`.
- **Messages/integrations:** `fireWebhook(N8N_ORDER_WEBHOOK_URL, order)` is fire-and-forget; confirmation email is sent after authorization by `EmailService.sendOrderConfirmationAfterPayment`.
- **Failure/final state:** validation/DB failure prevents creation. Webhook and CRM are fail-open. Payment callback failures set `paymentStatus:'failed'` for decline/amount mismatch and redirect to checkout; token mismatch redirects without changing the current state. Success leaves `status:'pending'`, `paymentStatus:'authorized'`, then confirmation page clears the cart.
- **Contradictions:** legacy public `POST /api/order/checkout` (`OrderController.submitOrder`) still exists and creates an order without Tranzila; the active checkout uses `/api/orders`. Server trusts client item prices/subtotal. Public `payment/initiate/:orderId` has no ownership check.
- **Evidence:** `frontend/src/app/components/pages/checkout-page/checkout-page.component.ts`; `frontend/src/app/components/pages/order-confirmation/order-confirmation.component.ts`; `backend/src/routes/orders.routes.ts`; `backend/src/controllers/order.controller.ts` (`createOrder`); `backend/src/services/order.service.ts` (`createOrderFromCheckout`); `backend/src/controllers/payment.controller.ts`.

---

## 2. Shabbat/holiday catering order — `IMPLEMENTED`

- **Frontend entry:** `/holiday-food`, `/holiday`, `/shabbat-events` → `HolidayFoodComponent.submitOrder`.
- **Ordered APIs:** `GET /api/settings/delivery` → `POST /api/catering`.
- **Auth:** public (`catering.routes.ts` has no auth middleware).
- **Validation:** frontend requires contact/date/meal/delivery fields, positive per-meal portions, 6–8 distinct salads, exactly two first courses/two mains/three sides per selected meal, and open date/cutoff. `CateringController.submitCateringOrder` rechecks required fields/email/date, reads `StoreSettings`, calls `assertEventDateOpen`, validates meal type/portions/delivery and `validateShabbatCateringSelection`.
- **DB reads/writes:** reads `store-settings`; writes one `orders` document with `orderType:'catering'`, `cateringKind:'shabbat'`, contact/date in `customerDetails`, normalized item lines, `totalPrice:0`, `status:'pending'`, portions/meal/course arrays; schema default is `paymentStatus:'pending'`.
- **Messages/integrations:** `EmailService.sendCateringOrderEmails` sends owner and customer mail when `OWNER_EMAIL`, `EMAIL_USER`, and `EMAIL_PASS` exist.
- **Failure/final state:** DB failure returns 500 and no order. Email/config failure is logged/skipped after save. Success returns 201 and a saved operational catering order; no payment call.
- **Contradictions:** no Tranzila step and `totalPrice` is always 0; unlike regular checkout, this controller never calls `upsertCustomerFromOrder`.
- **Evidence:** `frontend/src/app/components/pages/holiday-food/holiday-food.component.ts`; `backend/src/routes/catering.routes.ts`; `backend/src/controllers/catering.controller.ts` (`submitCateringOrder`); `backend/src/models/Order.ts`.

---

## 3. Event catering — `IMPLEMENTED`

- **Frontend entry:** `/events-catering` or `/catering` → `EventsCateringComponent.submitOrder`.
- **Ordered APIs:** no business API is required before submit (site settings are loaded for page content) → `POST /api/catering/events`.
- **Auth:** public.
- **Validation:** frontend requires name/phone/email/date/event type/positive guest count and blocks past dates/Saturday. `CateringController.submitEventCateringOrder` repeats email/date/calendar/past/Saturday/guest/event-type checks. Price and upgrades are calculated in the frontend and accepted as `pricePerPortion`/`totalEventPrice`.
- **DB reads/writes:** writes `orders` fields `orderType:'catering'`, `cateringKind:'events'`, generated `orderNumber`, `customerDetails`, generated package item descriptions, client-derived `totalPrice`, `subtotal` (price per portion), `status:'pending'`, `eventType`, `guestCount`, `venue`, `numberOfPortions`.
- **Messages/integrations:** `EmailService.sendOrderEmails` sends owner and customer messages when SMTP/owner config exists.
- **Failure/final state:** invalid request returns 400; DB failure returns 500; email failure is fail-open. Success is a pending inquiry/order with no payment.
- **Contradictions:** server validates structure but does not independently recalculate event pricing; this route also does not upsert CRM customer data.
- **Evidence:** `frontend/src/app/components/pages/events-catering/events-catering.component.ts`; `frontend/src/app/components/pages/events-catering/events-catering.model.ts`; `backend/src/controllers/catering.controller.ts` (`submitEventCateringOrder`, `buildEventCateringItems`).

---

## 4. Institution order — `IMPLEMENTED`

- **Frontend entry:** authenticated institution `/portal` → `InstitutionDashboardComponent`.
- **Ordered APIs:** `GET /api/portal/status?weekStartDate=YYYY-MM-DD` → user edits → `POST /api/portal/submit` → on success `GET /api/portal/status` refresh.
- **Auth:** `authenticate` + `requireInstitution`; controller additionally verifies the DB user is an active, non-deleted institution.
- **Validation:** FE non-negative integers/max-length notes/at least one portion and lock state. `submitPortalOrder` validates canonical week key, published menu, full and split deadlines, weekday payload, Shabbat payload, notes, and meaningful quantity; locked sections may remain unchanged but cannot be modified.
- **DB reads/writes:** reads `users`, `institutionmenus`, existing `institutionorders`; may migrate legacy Date-keyed orders; upserts unique `{institutionId, weekStartDate}` with `days`, `shabbatOrder`, `generalNotes`, `isLocked`.
- **Messages/integrations:** none in `portal.controller.ts`.
- **Failure/final state:** 401/403 for auth, inactive account, unpublished/locked menu; 400 for invalid/empty order; 500 on persistence error. Success stores one weekly institution order and returns its normalized state.
- **Contradictions:** institution orders live in `institutionorders`, not retail `orders`; retail kitchen report reads only `orders`, while institution production/packing reporting is a separate admin path.
- **Evidence:** `backend/src/routes/portal.routes.ts`; `backend/src/controllers/portal.controller.ts` (`getPortalStatus`, `submitPortalOrder`); `backend/src/models/InstitutionOrder.ts`; `backend/src/models/InstitutionMenu.ts`; `frontend/src/app/services/institution-portal.service.ts`.

---

## 5. Manual admin order — `PARTIAL`

- **Frontend entry:** `/admin/orders` → `ManualOrderBuilderComponent.submit` (a second `ManualOrderDialogComponent` implements the same service call).
- **Ordered APIs:** builder loads `GET /api/menu`; submit calls `OrderService.createManualOrder` → `POST /api/orders` with `manualOrder:true`.
- **Auth:** UI is behind admin routing, but **the backend endpoint is public** and only optionally authenticates.
- **Validation:** FE requires customer/date/delivery/payment/items, validates delivery address, phone length, item quantities/prices, total ≥ subtotal, and confirms unpaid. `OrderController.createOrder` performs ordinary checkout checks but skips open-date validation when `manualOrder:true`; server still recalculates delivery fee and total.
- **DB reads/writes:** writes ordinary `orders`; `OrderService.createOrderFromCheckout` sets operational `status:'processing'`; manual `paymentStatus:'paid'|'unpaid'` is not written to `Order.paymentStatus`—it becomes `customerDetails.isPaid:boolean`. CRM is upserted immediately.
- **Messages/integrations:** manual creation calls `EmailService.sendOrderEmail`; n8n order webhook also fires.
- **Failure/final state:** mail/webhook/CRM are fail-open; persistence failure fails the request. Success is a processing order with optional bookkeeping `customerDetails.isPaid`.
- **Contradictions:** public callers can set `manualOrder:true`, bypass open-date validation, force processing status, and set `customerDetails.isPaid`; “paid” is not equivalent to captured Tranzila payment.
- **Evidence:** `frontend/src/app/components/admin/manual-order-builder/manual-order-builder.component.ts`; `frontend/src/app/services/order.service.ts` (`createManualOrder`); `backend/src/routes/orders.routes.ts`; `backend/src/controllers/order.controller.ts` (`createOrder`); `backend/src/services/order.service.ts` (`createOrderFromCheckout`).

---

## 6. Order approval — `IMPLEMENTED`

- **Frontend entry:** `/admin/orders`; choosing “processing” invokes `AdminOrdersComponent.applyStatusForOrder`.
- **Ordered APIs:** `PUT /api/order/:id/status` with `{status:'processing'}`.
- **Auth:** route uses `authenticate` + `requireCapability(CAP.DELIVERIES_MY_UPDATE_STATUS)`. Admin passes. Driver also reaches the handler, but `updateOrderStatusForDriver` permits only `out_for_delivery`, `delivered`, `delivery_failed` on an assigned order, so a driver cannot approve.
- **Validation:** ID/status required; admin status must be in controller allowlist. Driver has the narrower service allowlist and assignment predicate.
- **DB reads/writes:** `OrderService.updateOrderStatus` updates `orders.status` (and optional date/notes); approval then reads the fresh order for email.
- **Messages/integrations:** on `processing`, `EmailService.sendOrderApprovedToCustomer`; no email if missing address/config.
- **Failure/final state:** DB failure fails/rolls back the optimistic FE value. Email failure is logged but API still reports approval success. Final state is `status:'processing'`; payment state is unchanged.
- **Contradictions:** route-level capability name suggests drivers may change status generally, but service scope blocks approval. UI success text says mail was sent even when mail was skipped/failed.
- **Evidence:** `backend/src/routes/order.routes.ts`; `backend/src/config/role-access.ts`; `backend/src/controllers/order.controller.ts` (`updateOrderStatus`); `backend/src/services/order.service.ts` (`updateOrderStatus`, `updateOrderStatusForDriver`); `backend/src/services/email.service.ts` (`sendOrderApprovedToCustomer`).

---

## 7. Tranzila authorize/capture — `IMPLEMENTED`

- **Frontend entry:** checkout initiates authorization; `/admin/orders` `AdminOrdersComponent.capturePayment` captures or `voidPayment` releases a hold.
- **Ordered APIs:** `POST /api/payment/initiate/:orderId` → HPP `tranmode=VK` → `GET|POST /api/payment/success` → admin `POST /api/payment/capture/:orderId`. Alternate cancellation branch: admin `POST /api/payment/void/:orderId`.
- **Auth:** initiate and success callback are public; capture/void require authenticated admin; status polling requires authentication plus controller ownership/admin check.
- **Validation:** initiation requires existing order and state guard; callback requires response `000|0`, matching `paymentSecurityToken`, and amount tolerance ≤ ₪0.02. Capture requires `authorized`, non-placeholder transaction ID, auth code, card token, valid expiry; Tranzila request has 15s timeout and no retry.
- **DB reads/writes:** initiation writes `awaiting_payment`, token, `authorizedAmount`, placeholder transaction ID. Callback writes `authorized`, provider `transactionId`, `authCode`, `cardToken`, expiry. Capture reads payment fields plus items/customer and writes `paymentStatus:'captured'`, `status:'processing'`. Void writes `paymentStatus:'voided'`, `status:'cancelled'`.
- **Messages/integrations:** Tranzila HPP and V1 `transaction/credit_card/create`; authorization triggers CRM backup upsert and confirmation email.
- **Failure/final state:** callback decline/amount mismatch → `failed`; capture provider negative response → `failed` and 502; thrown provider/config/network error returns 400/502 without changing authorized state; void provider error leaves state authorized. Successful capture finalizes charge.
- **Contradictions:** missing Tranzila configuration enables mock authorization, but mock transaction IDs are explicitly rejected by capture before the later mock-capture branch, making that branch unreachable. Capture’s `alreadyCaptured` branch is also after the `!== authorized` rejection and therefore unreachable. Initiation has no ownership check.
- **Evidence:** `backend/src/routes/payment.routes.ts`; `backend/src/controllers/payment.controller.ts`; `backend/src/services/tranzila.service.ts`; `backend/src/models/Order.ts`; `frontend/src/app/services/order.service.ts`.

---

## 8. Full payment — `IMPLEMENTED`

- **Frontend entry:** admin order details → `AdminOrdersComponent.capturePayment`; manual admin builder also offers a non-gateway “paid” marker.
- **Ordered APIs:** for real card settlement, the complete sequence is flow #7 ending with `POST /api/payment/capture/:orderId`.
- **Auth:** capture is admin-only.
- **Validation:** capture can settle only `paymentStatus:'authorized'`; amount sent is current `Order.totalPrice`. FE warns when it differs from `authorizedAmount`, but the backend does not reject the mismatch.
- **DB reads/writes:** reads order payment token/auth/expiry/items/total; successful provider response writes `paymentStatus:'captured'` and `status:'processing'`. There is no `capturedAmount` or capture timestamp field.
- **Messages/integrations:** Tranzila V1 force transaction with invoice item lines; no dedicated post-capture email.
- **Failure/final state:** provider negative result marks payment `failed`; transport/config errors leave it authorized. Success means fully captured according to the single `totalPrice`.
- **Contradictions:** manual `customerDetails.isPaid:true` is only a boolean bookkeeping flag and does not set `Order.paymentStatus:'captured'`; reporting can therefore represent “paid” in two incompatible ways.
- **Evidence:** `backend/src/controllers/payment.controller.ts` (`capturePayment`); `backend/src/services/tranzila.service.ts` (`capturePayment`); `backend/src/models/Order.ts`; `frontend/src/app/components/admin/admin-orders/admin-orders.component.ts`.

---

## 9. Partial payment / deposit — `ABSENT`

- **Explicit substatus:** `partial payment = ABSENT`; `deposit = ABSENT`.
- **Frontend/API:** no checkout/admin consumer and no partial/deposit endpoint.
- **Validation/DB/messages/final state:** none. `Order.paymentStatus` only permits `pending`, `awaiting_payment`, `authorized`, `captured`, `voided`, `failed`; only one `authorizedAmount` exists and capture always uses full current `totalPrice`.
- **Failure handling:** not applicable.
- **Absence proof:** searched `backend/src/routes`, `controllers`, `services`, and `models` for `deposit`, `partialPayment`, `partial_payment`, and `capturedAmount`; no implementation was found. `payment.routes.ts`, `payment.controller.ts`, `tranzila.service.ts`, and `Order.ts` expose only full authorize/capture/void.
- **Contradictions:** none to reconcile—manual `paymentStatus:'paid'|'unpaid'` is mapped to a boolean and does not implement a deposit.

---

## 10. Balance payment — `ABSENT`

- **Frontend/API:** no balance-due display/action and no balance endpoint.
- **Validation/DB/messages/final state:** none; there are no `balanceDue`, installments, payment ledger, or multiple transaction records on `Order`.
- **Failure handling:** not applicable.
- **Absence proof:** searched backend route/model/controller/service code for `balanceDue`, `balance_due`, deposit/partial and refund constructs; no route or field exists. `Order.ts` stores only one transaction/auth/token set and one payment status.
- **Contradictions:** “authorizedAmount” is a preauthorization comparison value, not an outstanding balance.

---

## 11. Cancellation — `PARTIAL`

- **Frontend entry:** `/admin/orders`; either change operational status to cancelled or, for an authorized card, invoke `AdminOrdersComponent.voidPayment`.
- **Ordered APIs:** operational-only branch `PUT /api/order/:id/status {status:'cancelled'}`; authorization branch `POST /api/payment/void/:orderId`.
- **Auth:** status route accepts admin or limited driver capability, but driver service allowlist excludes cancellation; void is admin-only.
- **Validation:** status enum validation; void requires exactly `paymentStatus:'authorized'`, real provider transaction ID, and configured credentials.
- **DB reads/writes:** status branch writes only `Order.status:'cancelled'`; void branch writes both `paymentStatus:'voided'` and `status:'cancelled'`. No cancellation metadata fields exist.
- **Messages/integrations:** void calls Tranzila reversal; operational cancellation sends no customer email.
- **Failure/final state:** status update can cancel an authorized order without releasing its hold. Void provider failure leaves the order authorized. Successful void releases hold and cancels operationally. Captured payments cannot be cancelled financially because there is no refund.
- **Contradictions:** two non-transactional cancellation paths can diverge; no `cancelReason`, `cancelledAt`, or `cancelledBy`.
- **Evidence:** `backend/src/controllers/order.controller.ts` (`updateOrderStatus`); `backend/src/controllers/payment.controller.ts` (`voidPayment`); `backend/src/routes/order.routes.ts`; `backend/src/routes/payment.routes.ts`.

---

## 12. Refund — `ABSENT`

- **Frontend/API:** no refund action, route, or provider call.
- **Validation/DB/messages/final state:** none; `paymentStatus` has no `refunded` value and `Order` has no refund amount/reference/timestamp.
- **Failure handling:** not applicable.
- **Absence proof:** searched backend routes, models, controllers, and services for `refund`/`refunded`; no implementation was found. Tranzila adapter exports only `capturePayment` and `voidPayment`; void is restricted to pre-capture authorization.
- **Contradictions:** cancellation after capture cannot return money through this codebase.

---

## 13. Status change — `IMPLEMENTED`

- **Frontend entry:** `/admin/orders` status controls; driver delivery UI uses its assigned-order controls.
- **Ordered APIs:** single `PUT|PATCH /api/order/:id/status`; bulk admin `POST /api/order/bulk` with `action:'status'`.
- **Auth:** single route uses `authenticate` + `CAP.DELIVERIES_MY_UPDATE_STATUS` (admin or driver); driver is restricted to assigned orders and delivery statuses. Bulk is admin-only.
- **Validation:** controller admin allowlist covers operational statuses; driver service allowlist covers only `out_for_delivery`, `delivered`, `delivery_failed`; bulk validates action/order IDs/status, then service applies it.
- **DB reads/writes:** single path updates `Order.status` plus optional `deliveryDate` and `customerDetails.notes`; bulk status updates matching order documents. Changing to processing triggers a fresh read for email.
- **Messages/integrations:** only `processing` triggers approval email; other statuses have no customer notification.
- **Failure/final state:** errors return 4xx/5xx; FE rolls back optimistic single-order status. Final state is the requested allowed status; payment state is independent.
- **Contradictions:** comments call mutations “admin only,” but route capability intentionally permits scoped driver updates. Bulk status changes do not execute the controller’s per-order approval-email branch.
- **Evidence:** `backend/src/routes/order.routes.ts`; `backend/src/controllers/order.controller.ts` (`updateOrderStatus`, `bulkUpdateOrders`); `backend/src/services/order.service.ts`.

---

## 14. Email — `PARTIAL`

- **Frontend entry/triggers:** checkout/payment success, catering submissions, event catering, manual order creation, approval (`processing`), item edits, contact form; public legacy `POST /api/order/send` directly sends an order summary.
- **Ordered APIs:** trigger endpoint first; controller/service then calls `EmailService` → Nodemailer SMTP. There is no queue API.
- **Auth:** varies by trigger. `/api/order/send`, catering, checkout, and payment callback are public; approval/item edit are protected by their order routes.
- **Validation:** each trigger validates its request; `EmailService` requires SMTP env values and usually `OWNER_EMAIL`; missing customer email skips customer message.
- **DB reads/writes:** most email sends do not write mail records. Payment confirmation atomically sets `Order.confirmationEmailSentAt` before calling `sendOrderEmail`.
- **Messages/integrations:** owner/customer order mail, catering mail, approval mail, item-update mail, and contact owner mail via SMTP.
- **Failure/final state:** order/catering/payment flows generally log mail failure and preserve the business state; `/api/order/send` returns 503/500. No queue or retry exists.
- **Contradictions:** `sendOrderConfirmationAfterPayment` claims `confirmationEmailSentAt` **before** SMTP; if sending fails, later calls see the claim and will not retry. Legacy and current order-email paths overlap, producing inconsistent timing/semantics.
- **Evidence:** `backend/src/services/email.service.ts` (`sendOrderEmails`, `sendOrderConfirmationAfterPayment`, `sendOrderEmail`, `sendOrderApprovedToCustomer`, `sendOrderUpdateEmail`); `backend/src/controllers/order.controller.ts`; `backend/src/controllers/catering.controller.ts`.

---

## 15. Kitchen report — `IMPLEMENTED`

- **Frontend entry:** `/admin/orders` → kitchen report modal (`OrderService.getKitchenReport`).
- **Ordered APIs:** `GET /api/order/kitchen-report?date=YYYY-MM-DD&includeCatering=true|false`.
- **Auth:** authenticated **admin only** (`requireAdmin`), not the unused `CAP.ORDERS_KITCHEN_REPORT`.
- **Validation:** optional date is normalized; active statuses are fixed to pending/new/processing/in-progress; catering is excluded unless requested.
- **DB reads/writes:** read-only aggregation on `orders`: match status/not deleted/date, unwind `items`, `$lookup` `menuitems`, choose DB category with order-item fallback, scale catering lines by portions, group quantities/weights. No DB write.
- **Messages/integrations:** none; frontend renders/prints.
- **Failure/final state:** controller catches errors and returns 500; frontend catches errors and returns empty items/meta. Success is a transient report payload.
- **Contradictions:** current menu item metadata is joined at report time, so historical order output is not a complete immutable snapshot. Institution orders are not included.
- **Evidence:** `backend/src/routes/order.routes.ts`; `backend/src/controllers/order.controller.ts` (`getKitchenReport`); `backend/src/services/order.service.ts` (`getKitchenReport`); `frontend/src/app/services/order.service.ts`.

---

## 16. Export — `PARTIAL`

- **Frontend entry:** `/admin/customers` `exportFilteredCustomersCsv`; order-detail and institution reports use print actions.
- **Ordered APIs:** customer screen first loads `GET /api/customers`; CSV generation/download is entirely client-side. Kitchen/order/institution print uses already loaded API data and `window.print()`.
- **Auth:** customer data API is admin-only; print source APIs are admin-only. There is no export endpoint.
- **Validation:** CSV escapes double quotes and prefixes UTF-8 BOM; it exports only current `filteredUsers` fields name/phone/email/total spent.
- **DB reads/writes:** source APIs read `customers`, `orders`, or institution collections; export itself writes no DB data.
- **Messages/integrations:** browser `Blob`, object URL/download, or print dialog only.
- **Failure/final state:** source API failure prevents useful export; browser download/print has no server retry/audit. Final state is a local CSV or printed/PDF-via-browser document.
- **Contradictions:** no generic order/accounting export API. Employee “Excel export” is an alert placeholder and is not a real export.
- **Absence/implementation evidence:** no `export`, CSV, XLSX, or download route exists under `backend/src/routes`; `frontend/src/app/components/admin/admin-customers/admin-customers.component.ts` implements `exportFilteredCustomersCsv`; admin orders/institutions implement print HTML.

---

## 17. Image upload — `IMPLEMENTED`

- **Frontend entry:** admin gallery `GalleryManagementComponent` → `UploadService.uploadImage`; returned URL is then saved through gallery APIs.
- **Ordered APIs:** `POST /api/upload` multipart field `image` → later gallery/menu save API by the consuming screen.
- **Auth:** **public** image upload route. Video upload at `/api/upload/video` is separately admin-only.
- **Validation:** Multer/Cloudinary accepts JPEG/JPG/PNG/WebP, max 5 MB, limits dimensions to 1200×1200 and applies automatic quality; route requires `req.file`.
- **DB reads/writes:** upload writes Cloudinary asset and returns URL/public ID/metadata; `/api/upload` itself writes no MongoDB document. Consumer subsequently writes the URL to its own model.
- **Messages/integrations:** Cloudinary.
- **Failure/final state:** invalid type/size/no file returns 400; Cloudinary/handler errors return 500. Success leaves an external Cloudinary asset and client-held URL.
- **Contradictions:** the consumer is admin UI but the image upload endpoint has no `authenticate`/`requireAdmin`, allowing unauthenticated storage use; there is no rollback/delete if the later model save fails.
- **Evidence:** `frontend/src/app/services/upload.service.ts`; `frontend/src/app/components/admin/gallery-management/gallery-management.component.ts`; `backend/src/routes/upload.routes.ts`; `backend/src/config/cloudinary.config.ts`.

---

## 18. Menu update — `IMPLEMENTED`

- **Frontend entry:** `/admin/menu` via admin menu component and `MenuService`.
- **Ordered APIs:** list `GET /api/menu?includeUnavailable=true`; create `POST /api/menu`; update `PUT /api/menu/:id`; reorder `PUT /api/menu/reorder`; delete `DELETE /api/menu/:id`; mutations are followed by `GET /api/menu` reload.
- **Auth:** reads are public; create/update/reorder/delete require authenticated admin.
- **Validation:** create requires name/category and positive single/variant/option pricing; update validates supplied pricing; reorder requires non-empty array; Mongoose validators run on update.
- **DB reads/writes:** `POST/PUT/DELETE /api/menu` and `PUT /api/menu/reorder` update `menuitems` including pricing, availability, image, feature and order fields.
- **Messages/integrations:** none, except image URLs may originate from flow #17.
- **Failure/final state:** validation/not-found errors fail the mutation; FE propagates error. Success persists item or order changes and reloads menu state.
- **Contradictions:** public `GET /api/menu` is not read-only: when item count is below 5, `MenuController.getAllMenuItems` deletes all menu items and inserts a hard-coded seed menu. A read can therefore destroy partial admin data.
- **Evidence:** `backend/src/routes/menu.routes.ts`; `backend/src/controllers/menu.controller.ts`; `frontend/src/app/services/menu.service.ts`.

---

## 19. Coupon — `IMPLEMENTED`

- **Frontend entry:** checkout `CheckoutPageComponent.applyCoupon`; admin `/admin/coupons`.
- **Ordered APIs:** preview `POST /api/coupons/apply`; checkout later revalidates inside `POST /api/orders`; after order save it calls `incrementCouponUsage` then `updateCouponRevenue`. Admin management: `GET /api/coupons`, `POST /api/coupons`, `PUT /api/coupons/:id`, `DELETE /api/coupons/:id`.
- **Auth:** apply is public and limited to 5/min/IP; admin management endpoints require `authenticate → requireAdmin`.
- **Validation:** code/total, active/expiry/minimum/global/per-phone limits, percentage/fixed discount, VIP/blacklist/category logic. Checkout revalidation uses customer phone and server-recalculated delivery-inclusive total.
- **DB reads/writes:** reads `coupons`, and for targeted coupons `customers`/completed `orders`; successful order increments `Coupon.usageCount`, pushes normalized phone to `usedByPhones`, increments `totalRevenueGenerated`; order stores only discounted `totalPrice`—not coupon code/discount fields.
- **Messages/integrations:** none.
- **Failure/final state:** invalid preview fails without writes. Order is saved before usage/revenue updates; if either update throws, request can fail after the order already exists. Successful final state is discounted order plus coupon counters.
- **Contradictions:** frontend preview `CouponService.applyCoupon` sends only `{code, cartTotal}`, not `customerPhone`; targeted/VIP coupon preview can fail even though final checkout sends phone. Counter updates are not in a transaction with order creation. Revenue records post-discount order amount, not discount-attributed revenue semantics.
- **Evidence:** `backend/src/routes/coupon.routes.ts`; `backend/src/controllers/coupon.controller.ts`; `backend/src/services/coupon.service.ts`; `backend/src/models/coupon.model.ts`; `frontend/src/app/services/coupon.service.ts`; `backend/src/controllers/order.controller.ts`.

---

## 20. Returning customer — `PARTIAL`

- **Frontend entry:** any retail/manual order with phone; admin `/admin/customers`; checkout also pre-fills logged-in `User` details.
- **Ordered APIs:** order creation (`POST /api/orders` or legacy `/api/order/checkout`) → internal `upsertCustomerFromOrder`; admin reads `GET /api/customers`; admin CRM edits `PUT /api/customers/:id/crm`. Payment success repeats the upsert as a fail-open backup.
- **Auth:** order creation is public/optional auth; customer CRM routes are admin-only.
- **Validation:** phone normalization handles Israeli prefixes; missing phone skips CRM upsert; per-order `orderHistory` prevents duplicate counting when order ObjectId is valid.
- **DB reads/writes:** `Customer` upsert keyed by `normalizedPhone`; updates profile, `orderHistory`, `orderCount`, `totalSpent`, `lastOrderDate`, city. Admin list may synchronize `customerCategory`; manual CRM edits tags/status/category/notes. Checkout `userId` links authenticated orders to `User`.
- **Messages/integrations:** no dedicated returning-customer message; coupon flow may read CRM category.
- **Failure/final state:** CRM is fail-open; order remains successful if upsert fails. Existing phone produces an updated CRM record; registered users can retrieve linked orders through `/api/orders/myorders`.
- **Contradictions:** CRM increments `orderCount`/`totalSpent` at order creation before payment authorization/capture, so failed/abandoned payments can count. `upsertCustomerFromOrder` does not automatically set `customerCategory:'returning'`; `getSyncedCategory` mostly preserves explicit categories and only transitions stale `sleeping` records based on count. Catering controllers do not call the upsert. Admin order UI separately computes returning badges from loaded-page phone frequency, which is not the CRM source of truth.
- **Evidence:** `backend/src/services/customer.service.ts` (`upsertCustomerFromOrder`); `backend/src/models/Customer.ts`; `backend/src/controllers/customer.controller.ts` (`getCustomers`, `getSyncedCategory`); `backend/src/routes/customer.routes.ts`; `backend/src/controllers/payment.controller.ts`.

---

## Cross-flow conclusions

1. Operational `Order.status` and financial `Order.paymentStatus` are independent; several UI actions update only one.
2. Public mutation exposure is material: manual-order flags and payment initiation are public, and image upload is unauthenticated.
3. Partial/deposit, balance, and refund are genuinely absent from route and model surfaces.
4. CRM and coupon counters are updated around order creation, not in a MongoDB transaction with successful payment.
5. Email/webhook behavior is fail-open and has no queue/retry; confirmation mail can be permanently claimed before SMTP succeeds.

## Machine-readable flow index (20 rows)

```json
[
  {"id":1,"flow":"regular_order","frontendConsumer":"CheckoutPageComponent.placeOrder","backendEndpoints":["GET /api/settings/delivery","POST /api/delivery/calculate-fee","POST /api/coupons/apply (optional)","POST /api/orders","POST /api/payment/initiate/:orderId","GET|POST /api/payment/success"],"requiredRole":"public (optional user on order create)","status":"IMPLEMENTED"},
  {"id":2,"flow":"shabbat_holiday_order","frontendConsumer":"HolidayFoodComponent.submitOrder","backendEndpoints":["GET /api/settings/delivery","POST /api/catering"],"requiredRole":"public","status":"IMPLEMENTED"},
  {"id":3,"flow":"event_catering","frontendConsumer":"EventsCateringComponent.submitOrder","backendEndpoints":["POST /api/catering/events"],"requiredRole":"public","status":"IMPLEMENTED"},
  {"id":4,"flow":"institution_order","frontendConsumer":"InstitutionDashboardComponent","backendEndpoints":["GET /api/portal/status","POST /api/portal/submit"],"requiredRole":"institution","status":"IMPLEMENTED"},
  {"id":5,"flow":"manual_admin_order","frontendConsumer":"ManualOrderBuilderComponent.submit","backendEndpoints":["GET /api/menu","POST /api/orders"],"requiredRole":"public backend endpoint (admin UI only)","status":"PARTIAL"},
  {"id":6,"flow":"order_approval","frontendConsumer":"AdminOrdersComponent.applyStatusForOrder","backendEndpoints":["PUT /api/order/:id/status"],"requiredRole":"admin; driver capability reaches route but cannot set processing","status":"IMPLEMENTED"},
  {"id":7,"flow":"tranzila_authorize_capture","frontendConsumer":"CheckoutPageComponent + AdminOrdersComponent","backendEndpoints":["POST /api/payment/initiate/:orderId","GET|POST /api/payment/success","POST /api/payment/capture/:orderId","POST /api/payment/void/:orderId"],"requiredRole":"public initiate/callback; admin capture/void","status":"IMPLEMENTED"},
  {"id":8,"flow":"full_payment","frontendConsumer":"AdminOrdersComponent.capturePayment","backendEndpoints":["POST /api/payment/capture/:orderId"],"requiredRole":"admin","status":"IMPLEMENTED"},
  {"id":9,"flow":"partial_payment_deposit","substatus":{"partial_payment":"ABSENT","deposit":"ABSENT"},"frontendConsumer":null,"backendEndpoints":[],"requiredRole":null,"status":"ABSENT"},
  {"id":10,"flow":"balance_payment","frontendConsumer":null,"backendEndpoints":[],"requiredRole":null,"status":"ABSENT"},
  {"id":11,"flow":"cancellation","frontendConsumer":"AdminOrdersComponent status/void actions","backendEndpoints":["PUT|PATCH /api/order/:id/status","POST /api/payment/void/:orderId"],"requiredRole":"admin; assigned driver cannot choose cancelled","status":"PARTIAL"},
  {"id":12,"flow":"refund","frontendConsumer":null,"backendEndpoints":[],"requiredRole":null,"status":"ABSENT"},
  {"id":13,"flow":"status_change","frontendConsumer":"AdminOrdersComponent / driver delivery UI","backendEndpoints":["PUT|PATCH /api/order/:id/status","POST /api/order/bulk"],"requiredRole":"admin or scoped assigned driver; bulk admin","status":"IMPLEMENTED"},
  {"id":14,"flow":"email","frontendConsumer":"checkout/catering/admin/contact trigger consumers","backendEndpoints":["POST /api/order/send","POST /api/orders","GET|POST /api/payment/success","POST /api/catering","POST /api/catering/events","PUT /api/order/:id/status","PUT /api/order/admin/:id/items"],"requiredRole":"mixed: public and admin by trigger","status":"PARTIAL"},
  {"id":15,"flow":"kitchen_report","frontendConsumer":"KitchenReportModalComponent via OrderService.getKitchenReport","backendEndpoints":["GET /api/order/kitchen-report"],"requiredRole":"admin","status":"IMPLEMENTED"},
  {"id":16,"flow":"export","frontendConsumer":"AdminCustomersComponent.exportFilteredCustomersCsv + print consumers","backendEndpoints":["GET /api/customers (source data); no export endpoint"],"requiredRole":"admin","status":"PARTIAL"},
  {"id":17,"flow":"image_upload","frontendConsumer":"GalleryManagementComponent via UploadService.uploadImage","backendEndpoints":["POST /api/upload"],"requiredRole":"public","status":"IMPLEMENTED"},
  {"id":18,"flow":"menu_update","frontendConsumer":"admin menu UI via MenuService","backendEndpoints":["GET /api/menu","POST /api/menu","PUT /api/menu/:id","PUT /api/menu/reorder","DELETE /api/menu/:id"],"requiredRole":"public read; admin mutate","status":"IMPLEMENTED"},
  {"id":19,"flow":"coupon","frontendConsumer":"CheckoutPageComponent + AdminCouponsComponent","backendEndpoints":["POST /api/coupons/apply","POST /api/orders (final revalidation)","GET /api/coupons","POST /api/coupons","PUT /api/coupons/:id","DELETE /api/coupons/:id"],"requiredRole":"public apply; admin for coupon management","status":"IMPLEMENTED"},
  {"id":20,"flow":"returning_customer","frontendConsumer":"checkout/manual order + AdminCustomersComponent","backendEndpoints":["POST /api/orders","POST /api/order/checkout","GET /api/customers","PUT /api/customers/:id/crm","GET /api/orders/myorders"],"requiredRole":"public order; admin CRM; authenticated customer history","status":"PARTIAL"}
]
```
