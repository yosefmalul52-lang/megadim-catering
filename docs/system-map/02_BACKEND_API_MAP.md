# 02 — Backend API Map

Evidence snapshot: active `backend/src/server.ts`, its 27 mounted routers (including nested `admin-institutions.routes.ts`), imported controllers/services/models, frontend search, and separate `server/index.js`. Commented `/api/session-token` is excluded. No secret values are reproduced.

## Completeness

- Active primary-backend method+path registrations: **162**.
- Separate `server/index.js` active registrations: **6**.
- Fully detailed endpoint records: **168 / 168**.
- Generic-handler count: **0**.

## Global execution evidence

Primary `/api/*` chain is `cors` (`server.ts:138-147`) → `helmet` (150-168) → `morgan` (171) →, except health, `generalApiLimiter` (183-190) → `express.json` (193) → `express.urlencoded` (194) → `cookieParser` (195) → `mongoSanitize` (199) → router middleware in each record → handler. `GET /api/health` is registered at 174-180 before the limiter and parsers. `authenticate` reads HttpOnly `token` then Bearer JWT and can return 401/403/404/500 (`middleware/auth.ts:15-148`); `requireAdmin`, `requireCapability`, and `requireInstitution` enforce the exact roles/capabilities in `config/role-access.ts:44-122`. Unhandled async errors routed through `asyncHandler` reach the global `{success:false,message[,stack]}` response with `err.statusCode || 500` (`server.ts:250-261`).

## Primary backend: 162 endpoint evidence records

### 1. `GET /`
- Registration: `backend/src/server.ts:202-204`. Middleware: `cors → helmet → morgan → express.json → express.urlencoded → cookieParser → mongoSanitize → server.ts anonymous GET / callback (lines 202-204)`.
- Handler: `backend/src/server.ts:202-204` — `server.ts anonymous GET / callback (lines 202-204)`. Auth/capability: public.
- Inputs: path params none; query none; body none. Validation: none.
- Response: implicit 200 text body `✅ API is running on Port ${PORT}`. Models/files/providers: reads none; writes none; exact fields written: none; file/provider operations: none.
- External integrations: none. Frontend/external consumers: none found. Status: active, no frontend consumer, external consumer.

### 2. `POST /api/admin/accounting/external`
- Registration: `backend/src/routes/accounting.routes.ts:15`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireAdmin → createExternal`.
- Handler: `backend/src/controllers/accounting.controller.ts:208-236` — `createExternal`. Auth/capability: authenticated site User with exact role admin.
- Inputs: path params none; query none; body clientName, amount, issueDate, description, invoiceNumber, fileUrl, fileKey. Validation: `clientName` must be a nonblank string and `amount` must coerce to a positive number (`accounting.controller.ts:211-216`).
- Response: status 400, 201; shape keys success, message, data. Models/files/providers: reads none; writes ExternalInvoice document `save`; exact fields written: `clientName`, `amount`, `issueDate`, `description`, `invoiceNumber`, `fileUrl`, `fileKey`, plus schema timestamps; file/provider operations: none.
- External integrations: none. Frontend/external consumers: AccountingService. Status: active.

### 3. `GET /api/admin/accounting/summary`
- Registration: `backend/src/routes/accounting.routes.ts:13`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireAdmin → getSummary`.
- Handler: `backend/src/controllers/accounting.controller.ts:32-115` — `getSummary`. Auth/capability: authenticated site User with exact role admin.
- Inputs: path params none; query none; body none. Validation: none.
- Response: status 200; shape keys success, data. Models/files/providers: reads Order with `aggregate` and ExternalInvoice with `aggregate`; writes none; exact fields written: none; file/provider operations: none.
- External integrations: none. Frontend/external consumers: AccountingService. Status: active.

### 4. `GET /api/admin/accounting/transactions`
- Registration: `backend/src/routes/accounting.routes.ts:14`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireAdmin → getTransactions`.
- Handler: `backend/src/controllers/accounting.controller.ts:115-208` — `getTransactions`. Auth/capability: authenticated site User with exact role admin.
- Inputs: path params none; query page, limit, source, dateFrom, dateTo; body none. Validation: none.
- Response: status 200; shape keys success, data, meta. Models/files/providers: reads Order with `find` and ExternalInvoice with `find`; writes none; exact fields written: none; file/provider operations: none.
- External integrations: none. Frontend/external consumers: AccountingService. Status: active.

### 5. `POST /api/admin/accounting/upload`
- Registration: `backend/src/routes/accounting.routes.ts:16`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireAdmin → uploadDocumentMiddleware.single('file') → uploadDocument`.
- Handler: `backend/src/controllers/accounting.controller.ts:236-248` — `uploadDocument`. Auth/capability: authenticated site User with exact role admin.
- Inputs: path params none; query none; multipart field `file` exposed as `req.file`; no text body fields. Validation: multipart field `file` is required; middleware permits JPEG/JPG/PNG/WebP/PDF up to 10 MB (`accounting.routes.ts:16`; `upload-document.config.ts:14-27`; `accounting.controller.ts:236-239`).
- Response: status 400, 200; shape keys success, message, fileUrl, fileKey. Models/files/providers: reads none; writes none; exact fields written: none; file/provider operations: Multer CloudinaryStorage uploads one `file` to `magadim-catering/invoices` with `resource_type:auto`; accepted JPEG/PNG/WebP/PDF, maximum 10 MB; handler returns Cloudinary path/secure URL and filename/public ID.
- External integrations: Multer CloudinaryStorage uploads one `file` to `magadim-catering/invoices` with `resource_type:auto`; accepted JPEG/PNG/WebP/PDF, maximum 10 MB; handler returns Cloudinary path/secure URL and filename/public ID. Frontend/external consumers: AccountingService. Status: active.

### 6. `GET /api/admin/b2b-dictionary`
- Registration: `backend/src/routes/b2b-dictionary.routes.ts:16`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireAdmin → listB2BMenuItems`.
- Handler: `backend/src/controllers/b2b-dictionary.controller.ts:92-109` — `listB2BMenuItems`. Auth/capability: authenticated site User with exact role admin.
- Inputs: path params none; query category, includeInactive; body none. Validation: none.
- Response: status 500, 200 (implicit where no status is set); shape keys success, data, message. Models/files/providers: reads B2BMenuItem with `find`; writes none; exact fields written: none; file/provider operations: none.
- External integrations: none. Frontend/external consumers: B2BDictionaryService. Status: active.

### 7. `POST /api/admin/b2b-dictionary`
- Registration: `backend/src/routes/b2b-dictionary.routes.ts:17`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireAdmin → createB2BMenuItem`.
- Handler: `backend/src/controllers/b2b-dictionary.controller.ts:109-140` — `createB2BMenuItem`. Auth/capability: authenticated site User with exact role admin.
- Inputs: path params none; query none; body name, category. Validation: `name` and `category` are required; duplicate key yields 409 and other service validation messages yield 400 (`b2b-dictionary.controller.ts:114-131`).
- Response: status 400, 201, 409, 500; shape keys success, message, data. Models/files/providers: reads none; writes B2BMenuItem with `create`; exact fields written: `name`, `category`, `gramsPerPortion`, `portionsPerGastronorm`, `isActive=true`, and optional `calculationSettings` (`b2b-dictionary.controller.ts:53-88,122-123`); file/provider operations: none.
- External integrations: none. Frontend/external consumers: B2BDictionaryService. Status: active.

### 8. `DELETE /api/admin/b2b-dictionary/:id`
- Registration: `backend/src/routes/b2b-dictionary.routes.ts:19`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireAdmin → deleteB2BMenuItem`.
- Handler: `backend/src/controllers/b2b-dictionary.controller.ts:188-207` — `deleteB2BMenuItem`. Auth/capability: authenticated site User with exact role admin.
- Inputs: path params id; query none; body none. Validation: none.
- Response: status 404, 500, 200 (implicit where no status is set); shape keys success, message. Models/files/providers: reads none; writes B2BMenuItem with `findByIdAndUpdate`; exact fields written: `isActive=false`; file/provider operations: none.
- External integrations: none. Frontend/external consumers: B2BDictionaryService. Status: active.

### 9. `PUT /api/admin/b2b-dictionary/:id`
- Registration: `backend/src/routes/b2b-dictionary.routes.ts:18`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireAdmin → updateB2BMenuItem`.
- Handler: `backend/src/controllers/b2b-dictionary.controller.ts:140-188` — `updateB2BMenuItem`. Auth/capability: authenticated site User with exact role admin.
- Inputs: path params id; query none; body name, category. Validation: `name` and `category` are required; target must exist; duplicate key yields 409; optional calculation settings are explicitly unset when requested (`b2b-dictionary.controller.ts:145-179`).
- Response: status 400, 404, 409, 500, 200 (implicit where no status is set); shape keys success, message, data. Models/files/providers: reads none; writes B2BMenuItem with `findByIdAndUpdate`; exact fields written: `$set.name`, `$set.category`, `$set.gramsPerPortion`, `$set.portionsPerGastronorm`, `$set.isActive=true`, optional `$set.calculationSettings`, or `$unset.calculationSettings` when disabled (`b2b-dictionary.controller.ts:53-88,153-165`); file/provider operations: none.
- External integrations: none. Frontend/external consumers: B2BDictionaryService. Status: active.

### 10. `GET /api/admin/institutions`
- Registration: `backend/src/routes/institution.routes.ts:21`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireAdmin → listInstitutions`.
- Handler: `backend/src/controllers/institution.controller.ts:41-73` — `listInstitutions`. Auth/capability: authenticated site User with exact role admin.
- Inputs: path params none; query weekStartDate; body none. Validation: none.
- Response: status 500, 200 (implicit where no status is set); shape keys success, data, row, weekOrder, weekStartDate, hasOrder, weeklyTotalPortions, message. Models/files/providers: reads InstitutionOrder with `find` and native collection `find`; User with `find`; writes conditional legacy InstitutionOrder migration via `findOneAndUpdate` upsert followed by native `deleteOne`; exact fields written: `institutionId`, string `weekStartDate`, `isLocked`, `days[].dayOfWeek|regularCount|vegetarianCount|notes`, `shabbatOrder.regularCount|vegetarianCount|wantsSeudaShlishit|notes`, `shabbatOrder.extras.challahs|rolls|grapeJuice`, optional `shabbatOrder.mealPortions.fridayNight|shabbatDay|seudaShlishit.regularCount|vegetarianCount` (`institution-admin.controller.ts:219-286`; `models/InstitutionOrder.ts:13-107`); file/provider operations: none.
- External integrations: none. Frontend/external consumers: InstitutionAdminService. Status: active.

### 11. `POST /api/admin/institutions`
- Registration: `backend/src/routes/institution.routes.ts:23`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireAdmin → createInstitution`.
- Handler: `backend/src/controllers/institution.controller.ts:90-135` — `createInstitution`. Auth/capability: authenticated site User with exact role admin.
- Inputs: path params none; query none; body username, password, phone, portalSettings. Validation: trimmed `fullName`, lower-cased `username`, and `password` are required; password length is at least 6; username must be unique (`institution.controller.ts:97-108`).
- Response: status 400, 409, 201, 500; shape keys success, message, data. Models/files/providers: reads User with `findOne`, then `findById`; writes User document `save`; exact fields written: `fullName`, lower-cased `username`, `password`, `phone`, sanitized `portalSettings`, `role=institution`, `isActive=true`, plus schema timestamps; file/provider operations: none.
- External integrations: none. Frontend/external consumers: InstitutionAdminService. Status: active.

### 12. `DELETE /api/admin/institutions/:id`
- Registration: `backend/src/routes/institution.routes.ts:25`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireAdmin → deleteInstitution`.
- Handler: `backend/src/controllers/institution.controller.ts:191-208` — `deleteInstitution`. Auth/capability: authenticated site User with exact role admin.
- Inputs: path params id; query none; body none. Validation: none.
- Response: status 404, 500, 200 (implicit where no status is set); shape keys success, message. Models/files/providers: reads none; writes User with `findOneAndUpdate`; exact fields written: `isActive=false`, `deletedAt`; file/provider operations: none.
- External integrations: none. Frontend/external consumers: InstitutionAdminService. Status: active.

### 13. `GET /api/admin/institutions/:id`
- Registration: `backend/src/routes/institution.routes.ts:22`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireAdmin → getInstitution`.
- Handler: `backend/src/controllers/institution.controller.ts:73-90` — `getInstitution`. Auth/capability: authenticated site User with exact role admin.
- Inputs: path params id; query none; body none. Validation: none.
- Response: status 404, 500, 200 (implicit where no status is set); shape keys success, message, data. Models/files/providers: reads User with `findOne`; writes none; exact fields written: none; file/provider operations: none.
- External integrations: none. Frontend/external consumers: InstitutionAdminService. Status: active.

### 14. `PUT /api/admin/institutions/:id`
- Registration: `backend/src/routes/institution.routes.ts:24`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireAdmin → updateInstitution`.
- Handler: `backend/src/controllers/institution.controller.ts:135-191` — `updateInstitution`. Auth/capability: authenticated site User with exact role admin.
- Inputs: path params id; query none; body fullName, username, password, phone, isActive, portalSettings.customMessage. Validation: target must be an institution; changed username must be unique; nonblank changed password must be at least 6 characters; `isActive` is only accepted as boolean; `sanitizePortalSettings` accepts only `customMessage` and ignores deadline fields (`institution.controller.ts:11-18,137-181`).
- Response: status 404, 409, 400, 500, 200 (implicit where no status is set); shape keys success, message, data. Models/files/providers: reads User with `findOne` for target/username collision, then `findById`; writes User document `save`; exact fields written: supplied `fullName`, lower-cased `username`, `phone`, boolean `isActive`, nonblank `password`, `portalSettings.customMessage`, plus `updatedAt`; existing `portalSettings.deadlineDay` and `portalSettings.deadlineTime` are preserved but not accepted or written from this request (`institution.controller.ts:11-18,137-182`; `models/User.js:57-77`); file/provider operations: none.
- External integrations: none. Frontend/external consumers: InstitutionAdminService. Status: active.

### 15. `DELETE /api/admin/institutions/menu`
- Registration: `backend/src/routes/admin-institutions.routes.ts:21`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireAdmin → deleteInstitutionWeekMenu`.
- Handler: `backend/src/controllers/institution-admin.controller.ts:373-392` — `deleteInstitutionWeekMenu`. Auth/capability: authenticated site User with exact role admin.
- Inputs: path params none; query `weekStartDate`; body none. Validation: query `weekStartDate` is required and must parse as `YYYY-MM-DD` (`institution-admin.controller.ts:373-377`).
- Response: status 400, 500, 200 (implicit where no status is set); shape keys success, message. Models/files/providers: reads none; writes InstitutionMenu native collection `deleteMany`; exact fields written: none (document deletion); file/provider operations: none.
- External integrations: none. Frontend/external consumers: InstitutionAdminService. Status: active.

### 16. `GET /api/admin/institutions/menu`
- Registration: `backend/src/routes/admin-institutions.routes.ts:19`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireAdmin → getInstitutionWeekMenu`.
- Handler: `backend/src/controllers/institution-admin.controller.ts:287-318` — `getInstitutionWeekMenu`. Auth/capability: authenticated site User with exact role admin.
- Inputs: path params none; query `weekStartDate`; body none. Validation: query `weekStartDate` is required and must parse as `YYYY-MM-DD` (`institution-admin.controller.ts:287-291`).
- Response: status 400, 500, 200 (implicit where no status is set); shape keys success, message, data, weekStartDateLabel, orderDeadline, weekdayOrderDeadline, shabbatOrderDeadline. Models/files/providers: reads InstitutionMenu with `findOne`, then native collection `findOne` fallback; writes conditional legacy InstitutionMenu native `deleteOne` plus `findOneAndUpdate` upsert; exact fields written: `weekStartDate`; each `sunday|monday|tuesday|wednesday|thursday` object writes `mainMeat`, `vegetarianMain`, `carb1`, `carb2`, `side`, `saladFruit`; `shabbatPackage.hasShabbat`, `shabbatPackage.fridayNight.fish|mainMeat|vegetarianMain|carb1|carb2|side`, `shabbatPackage.shabbatDay.mainMeat|vegetarianMain|carb1|carb2|side`, `shabbatPackage.seudaShlishit.carb|protein`, `shabbatPackage.shabbatSalads`, and `orderDeadline` (`models/InstitutionMenu.ts:12-113`); file/provider operations: none.
- External integrations: none. Frontend/external consumers: InstitutionAdminService. Status: active.

### 17. `POST /api/admin/institutions/menu`
- Registration: `backend/src/routes/admin-institutions.routes.ts:20`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireAdmin → upsertInstitutionWeekMenu`.
- Handler: `backend/src/controllers/institution-admin.controller.ts:318-373` — `upsertInstitutionWeekMenu`. Auth/capability: authenticated site User with exact role admin.
- Inputs: path params none; query none; body `weekStartDate`; weekday objects `sunday`, `monday`, `tuesday`, `wednesday`, `thursday`, each read as either a string or `{mainMeat,vegetarianMain,carb1,carb2,side,saladFruit}`; preferred `shabbatPackage` object `{hasShabbat,fridayNight:{fish,mainMeat,vegetarianMain,carb1,carb2,side},shabbatDay:{mainMeat,vegetarianMain,carb1,carb2,side},seudaShlishit:{carb,protein},shabbatSalads[]}`; legacy fallback objects `friday` and `saturday` with weekday-menu fields when `shabbatPackage` is absent; deadlines `orderDeadline`, `weekdayOrderDeadline`, `shabbatOrderDeadline`. Validation: body `weekStartDate` must be a valid Sunday `YYYY-MM-DD`; normalized menu payload must produce `orderDeadline` directly or from both weekday/shabbat deadlines (`institution-admin.controller.ts:94-113,318-340`; `menu-structure.ts:356-434,503-554`).
- Response: status 400, 500, 200 (implicit where no status is set); shape keys success, message, data, weekStartDateLabel, menuPublished, orderDeadline, weekdayOrderDeadline, shabbatOrderDeadline, menu. Models/files/providers: reads InstitutionMenu with `findOne`; writes InstitutionMenu conditional native `deleteMany` and `findOneAndUpdate` upsert; exact fields written: `weekStartDate`, `sunday`, `monday`, `tuesday`, `wednesday`, `thursday`, `shabbatPackage`, `orderDeadline`, optional `weekdayOrderDeadline`, optional `shabbatOrderDeadline`; file/provider operations: none.
- External integrations: none. Frontend/external consumers: InstitutionAdminService. Status: active.

### 18. `DELETE /api/admin/institutions/order/:institutionId`
- Registration: `backend/src/routes/admin-institutions.routes.ts:25`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireAdmin → adminDeleteInstitutionOrder`.
- Handler: `backend/src/controllers/institution-admin.controller.ts:392-422` — `adminDeleteInstitutionOrder`. Auth/capability: authenticated site User with exact role admin.
- Inputs: path params `institutionId`; query `weekStartDate`; body none. Validation: query `weekStartDate` is required and must parse as `YYYY-MM-DD`; `institutionId` must resolve to a nondeleted institution (`institution-admin.controller.ts:394-403`).
- Response: status 400, 404, 500, 200 (implicit where no status is set); shape keys success, message. Models/files/providers: reads User with `findOne`; writes InstitutionOrder native collection `deleteMany` and model `deleteMany`; exact fields written: none (document deletion); file/provider operations: none.
- External integrations: none. Frontend/external consumers: InstitutionAdminService. Status: active.

### 19. `GET /api/admin/institutions/order/:institutionId`
- Registration: `backend/src/routes/admin-institutions.routes.ts:23`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireAdmin → getAdminInstitutionOrder`.
- Handler: `backend/src/controllers/institution-admin.controller.ts:422-460` — `getAdminInstitutionOrder`. Auth/capability: authenticated site User with exact role admin.
- Inputs: path params `institutionId`; optional query `weekStartDate`; body none. Validation: when query `weekStartDate` is absent or invalid, the handler does not reject the request and internally falls back to `getWeekStartKey()` for the current week; `institutionId` must resolve to an institution (`institution-admin.controller.ts:422-434`).
- Response: status 404, 500, 200 (implicit where no status is set); shape keys success, message, data, orderId, institutionId, institutionName, adminNotes, generalNotes, weeklyGrandTotal. Models/files/providers: reads User with `findOne`; InstitutionOrder with `findOne` then native `findOne`; InstitutionMenu with `findOne` then native `findOne`; writes conditional legacy InstitutionOrder and InstitutionMenu migrations via `findOneAndUpdate` upsert followed by native `deleteOne`; exact fields written: InstitutionOrder `institutionId`, `weekStartDate`, `isLocked`, `days[].dayOfWeek`, `days[].regularCount`, `days[].vegetarianCount`, `days[].notes`, `shabbatOrder.regularCount`, `shabbatOrder.vegetarianCount`, `shabbatOrder.wantsSeudaShlishit`, `shabbatOrder.extras.challahs|rolls|grapeJuice`, optional `shabbatOrder.mealPortions.fridayNight|shabbatDay|seudaShlishit.regularCount|vegetarianCount`, `shabbatOrder.notes`; InstitutionMenu paths are exactly those enumerated for endpoint 16 (`models/InstitutionOrder.ts:13-107`; `models/InstitutionMenu.ts:12-113`); file/provider operations: none.
- External integrations: none. Frontend/external consumers: InstitutionAdminService. Status: active.

### 20. `PUT /api/admin/institutions/order/:institutionId`
- Registration: `backend/src/routes/admin-institutions.routes.ts:24`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireAdmin → adminUpdateInstitutionOrder`.
- Handler: `backend/src/controllers/institution-admin.controller.ts:460-557` — `adminUpdateInstitutionOrder`. Auth/capability: authenticated site User with exact role admin.
- Inputs: path params `institutionId`; query none; body `weekStartDate`, `days[]` (`dayOfWeek`, `regularCount`, `vegetarianCount`, `notes`), `shabbatOrder` (`regularCount`, `vegetarianCount`, `wantsSeudaShlishit`, `extras.{challahs,rolls,grapeJuice}`, optional `mealPortions.{fridayNight,shabbatDay,seudaShlishit}.{regularCount,vegetarianCount}`, `notes`), optional `adminNotes`. `generalNotes` is not read from `req.body`; the handler preserves it from the existing order. Validation: body `weekStartDate` must parse as `YYYY-MM-DD`; institution must exist; weekday/shabbat payloads must satisfy portal-week type/count rules; at least one portion is required; optional admin notes must pass its validator (`institution-admin.controller.ts:462-521`).
- Response: status 400, 404, 500, 200 (implicit where no status is set); shape keys success, message, data, orderId, institutionId, institutionName, days, shabbatOrder, adminNotes, generalNotes, weeklyGrandTotal. Models/files/providers: reads User with `findOne`; InstitutionOrder with `findOne`/native `findOne`; InstitutionMenu with `findOne`/native `findOne`; writes InstitutionOrder native `deleteMany`, conditional legacy migration, and `findOneAndUpdate` upsert; conditional InstitutionMenu legacy migration; exact fields written: InstitutionOrder `institutionId`, `weekStartDate`, `days[].dayOfWeek|regularCount|vegetarianCount|notes`, `shabbatOrder.regularCount|vegetarianCount|wantsSeudaShlishit|notes`, `shabbatOrder.extras.challahs|rolls|grapeJuice`, optional `shabbatOrder.mealPortions.fridayNight|shabbatDay|seudaShlishit.regularCount|vegetarianCount`, `isLocked=false`, `generalNotes`, optional `adminNotes`; conditional InstitutionMenu migration writes `weekStartDate`, weekday `sunday|monday|tuesday|wednesday|thursday` objects with `mainMeat|vegetarianMain|carb1|carb2|side|saladFruit`, `shabbatPackage.hasShabbat`, `shabbatPackage.fridayNight.fish|mainMeat|vegetarianMain|carb1|carb2|side`, `shabbatPackage.shabbatDay.mainMeat|vegetarianMain|carb1|carb2|side`, `shabbatPackage.seudaShlishit.carb|protein`, `shabbatPackage.shabbatSalads`, and `orderDeadline` (`institution-admin.controller.ts:460-557`; model schemas); file/provider operations: none.
- External integrations: none. Frontend/external consumers: InstitutionAdminService. Status: active.

### 21. `GET /api/admin/institutions/reports`
- Registration: `backend/src/routes/admin-institutions.routes.ts:22`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireAdmin → getInstitutionWeekReports`.
- Handler: `backend/src/controllers/institution-admin.controller.ts:557-646` — `getInstitutionWeekReports`. Auth/capability: authenticated site User with exact role admin.
- Inputs: path params none; query `weekStartDate`; body none. Validation: query `weekStartDate` is required and must parse as `YYYY-MM-DD` (`institution-admin.controller.ts:557-561`).
- Response: status 400, 500, 200 (implicit where no status is set); shape keys success, message, data, weekStartDateLabel, orderDeadline, weekdayOrderDeadline, shabbatOrderDeadline, orders. Models/files/providers: reads InstitutionMenu with `findOne`/native `findOne`; InstitutionOrder with `find`/native `find`; User with `find`; writes conditional legacy InstitutionMenu and InstitutionOrder migrations via `findOneAndUpdate` upsert followed by native `deleteOne`; exact fields written: InstitutionMenu `weekStartDate`, weekday `sunday|monday|tuesday|wednesday|thursday` objects with `mainMeat|vegetarianMain|carb1|carb2|side|saladFruit`, `shabbatPackage.hasShabbat`, `shabbatPackage.fridayNight.fish|mainMeat|vegetarianMain|carb1|carb2|side`, `shabbatPackage.shabbatDay.mainMeat|vegetarianMain|carb1|carb2|side`, `shabbatPackage.seudaShlishit.carb|protein`, `shabbatPackage.shabbatSalads`, and `orderDeadline`; InstitutionOrder `institutionId`, `weekStartDate`, `isLocked`, `days[].dayOfWeek|regularCount|vegetarianCount|notes`, `shabbatOrder.regularCount|vegetarianCount|wantsSeudaShlishit|notes`, `shabbatOrder.extras.challahs|rolls|grapeJuice`, optional `shabbatOrder.mealPortions.fridayNight|shabbatDay|seudaShlishit.regularCount|vegetarianCount` (`institution-admin.controller.ts:557-646`; model schemas); file/provider operations: none.
- External integrations: none. Frontend/external consumers: InstitutionAdminService. Status: active.

### 22. `POST /api/agent`
- Registration: `backend/src/routes/agent.routes.ts:8`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → handleAgentMessage`.
- Handler: `backend/src/controllers/agent.controller.ts:7-49` — `handleAgentMessage`; called-service evidence: backend/src/services/agent.service.ts:21-149 `handleMessage`. Auth/capability: public.
- Inputs: path params none; query none; body message. Validation: none.
- Response: status 200; shape keys success, data, reply, session, timestamp. Models/files/providers: reads in-memory agent session Map lookup; writes in-memory agent session Map mutation; exact fields written: `session.step`, `session.data.eventType`, `session.data.date`, `session.data.guests`, `session.data.menu`, `session.data.contact`, and whole-object reset `session.data={}` (`agent.service.ts:21-149`); file/provider operations: none.
- External integrations: none. Frontend/external consumers: ChatAgentComponent. Status: active.

### 23. `GET /api/attendance/active`
- Registration: `backend/src/routes/attendance.routes.ts:18`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireAdmin → getActiveShifts`.
- Handler: `backend/src/controllers/attendance.controller.ts:134-154` — `getActiveShifts`; called-service evidence: backend/src/services/attendance.service.ts:143-158 `getActiveShifts`. Auth/capability: authenticated site User with exact role admin.
- Inputs: path params none; query none; body none. Validation: none.
- Response: status 200, 500; shape keys success, data, count, message, error, stack. Models/files/providers: reads Attendance with `find({status:"active"})`; writes none; exact fields written: none; file/provider operations: none.
- External integrations: none. Frontend/external consumers: TimeClock / Admin attendance. Status: active.

### 24. `POST /api/attendance/clock`
- Registration: `backend/src/routes/attendance.routes.ts:12`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → clockByPin`.
- Handler: `backend/src/controllers/attendance.controller.ts:13-53` — `clockByPin`; called-service evidence: backend/src/services/attendance.service.ts:6-60 `clockByPin`. Auth/capability: public.
- Inputs: path params none; query none; body `pinCode`. Validation: `pinCode` is required (400); `AttendanceService.clockByPin` requires an active Employee matching the PIN, then clocks out an open Attendance or creates a clock-in.
- Response: status 400, 200, 500; shape keys success, message, data, employee, _id, firstName, lastName, fullName, role, attendance, action, clockTime, error. Models/files/providers: reads Employee with `findOne({pinCode,isActive:true})`; Attendance with `findOne({employeeId,status:"active"})`; writes Attendance document `save` (new document on clock-in; existing document on clock-out); exact fields written: clock-in: `employeeId`, `clockIn`, `status="active"`; clock-out: `clockOut`, `status="completed"`, `totalHours`; save hook recalculates `totalHours` and timestamps are maintained; file/provider operations: none.
- External integrations: none. Frontend/external consumers: TimeClockComponent. Status: active.

### 25. `POST /api/attendance/clock-in`
- Registration: `backend/src/routes/attendance.routes.ts:15`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireAdmin → clockIn`.
- Handler: `backend/src/controllers/attendance.controller.ts:53-82` — `clockIn`; called-service evidence: backend/src/services/attendance.service.ts:60-99 `clockIn`. Auth/capability: authenticated site User with exact role admin.
- Inputs: path params none; query none; body `employeeId`, optional `pinCode`. Validation: body `employeeId` is required; Employee must exist and be active; optional PIN must match; no active Attendance may already exist (`attendance.controller.ts:58-60`; `attendance.service.ts:63-90`).
- Response: status 400, 200, 500; shape keys success, message, data, error, stack. Models/files/providers: reads Employee with `findById`; Attendance with `findOne({employeeId,status:"active"})`; writes new Attendance document `save`; exact fields written: `employeeId`, `clockIn`, `status="active"`, plus timestamps; file/provider operations: none.
- External integrations: none. Frontend/external consumers: TimeClock / Admin attendance. Status: active.

### 26. `POST /api/attendance/clock-out`
- Registration: `backend/src/routes/attendance.routes.ts:16`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireAdmin → clockOut`.
- Handler: `backend/src/controllers/attendance.controller.ts:82-111` — `clockOut`; called-service evidence: backend/src/services/attendance.service.ts:99-128 `clockOut`. Auth/capability: authenticated site User with exact role admin.
- Inputs: path params none; query none; body `employeeId`. Validation: body `employeeId` is required and an active Attendance for that employee must exist (`attendance.controller.ts:87-89`; `attendance.service.ts:102-119`).
- Response: status 400, 200, 500; shape keys success, message, data, error, stack. Models/files/providers: reads Attendance with `findOne({employeeId,status:"active"})`; writes Attendance document `save`; exact fields written: `clockOut`, `status="completed"`, `totalHours`; save hook recalculates `totalHours` and updates timestamps; file/provider operations: none.
- External integrations: none. Frontend/external consumers: TimeClock / Admin attendance. Status: active.

### 27. `GET /api/attendance/history/:employeeId`
- Registration: `backend/src/routes/attendance.routes.ts:17`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireAdmin → getEmployeeHistory`.
- Handler: `backend/src/controllers/attendance.controller.ts:111-134` — `getEmployeeHistory`; called-service evidence: backend/src/services/attendance.service.ts:128-143 `getEmployeeHistory`. Auth/capability: authenticated site User with exact role admin.
- Inputs: path params employeeId; query limit; body none. Validation: none.
- Response: status 200, 500; shape keys success, data, count, message, error, stack. Models/files/providers: reads Attendance with `find({employeeId})`; writes none; exact fields written: none; file/provider operations: none.
- External integrations: none. Frontend/external consumers: TimeClock / Admin attendance. Status: active.

### 28. `GET /api/attendance/report`
- Registration: `backend/src/routes/attendance.routes.ts:19`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireAdmin → getPayrollReport`.
- Handler: `backend/src/controllers/attendance.controller.ts:154-185` — `getPayrollReport`; called-service evidence: backend/src/services/attendance.service.ts:158-231 `getPayrollReport`. Auth/capability: authenticated site User with exact role admin.
- Inputs: path params none; query `month`, optional `employeeId`; body none. Validation: query `month` is required as a string; the service splits it as `YYYY-MM` to build the date range; optional `employeeId` narrows the completed-shift query (`attendance.controller.ts:156-168`; `attendance.service.ts:160-179`).
- Response: status 400, 200, 500; shape keys success, message, format, data, error, stack. Models/files/providers: reads Attendance with `find` using completed-status/month range and optional employee filter; writes none; exact fields written: none; file/provider operations: none.
- External integrations: none. Frontend/external consumers: TimeClock / Admin attendance. Status: active.

### 29. `POST /api/auth/employee-login`
- Registration: `backend/src/routes/auth.routes.ts:216-277`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → loginLimiter → auth.routes.ts anonymous POST /employee-login callback (lines 216-277)`.
- Handler: `backend/src/routes/auth.routes.ts:216-277` — `auth.routes.ts anonymous POST /employee-login callback (lines 216-277)`. Auth/capability: public.
- Inputs: path params none; query none; body `phone`, `pinCode`. Validation: both required; exact trimmed phone+PIN must match an active Employee.
- Response: status 400, 500, 200(default); shape keys success, message, employee, id, firstName, lastName, fullName. Models/files/providers: reads Employee with `findOne` on trimmed phone/PIN and `isActive:true`; writes none; exact fields written: none; file/provider operations: none.
- External integrations: none. Frontend/external consumers: EmployeeLoginComponent. Status: active.

### 30. `POST /api/auth/login`
- Registration: `backend/src/routes/auth.routes.ts:66-151`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → loginLimiter → auth.routes.ts anonymous POST /login callback (lines 66-151)`.
- Handler: `backend/src/routes/auth.routes.ts:66-151` — `auth.routes.ts anonymous POST /login callback (lines 66-151)`. Auth/capability: public.
- Inputs: path params none; query none; body `username`, `password`. Validation: both required; lower-cased username must exist, User must be active, and `comparePassword(password)` must succeed.
- Response: status 400, 403, 500, 200(default); shape keys success, message, user. Models/files/providers: reads User with `findOne`, then `findById` after password verification; writes none; exact fields written: none; file/provider operations: none.
- External integrations: none. Frontend/external consumers: AuthService, LoginComponent. Status: active.

### 31. `POST /api/auth/logout`
- Registration: `backend/src/routes/auth.routes.ts:295-304`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → auth.routes.ts anonymous POST /logout callback (lines 295-304)`.
- Handler: `backend/src/routes/auth.routes.ts:295-304` — `auth.routes.ts anonymous POST /logout callback (lines 295-304)`. Auth/capability: public.
- Inputs: path params none; query none; body none. Validation: none.
- Response: status 200; shape keys success, message. Models/files/providers: reads none; writes none; exact fields written: none; file/provider operations: none.
- External integrations: none. Frontend/external consumers: AuthService. Status: active.

### 32. `GET /api/auth/me`
- Registration: `backend/src/routes/auth.routes.ts:280-292`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → auth.routes.ts anonymous GET /me callback (lines 280-292)`.
- Handler: `backend/src/routes/auth.routes.ts:280-292` — `auth.routes.ts anonymous GET /me callback (lines 280-292)`. Auth/capability: any active authenticated User or Employee JWT; handler may further ownership-check.
- Inputs: path params none; query none; body none. Validation: none.
- Response: status 200(default); shape keys success, user. Models/files/providers: reads none; writes none; exact fields written: none; file/provider operations: none.
- External integrations: none. Frontend/external consumers: AuthService. Status: active.

### 33. `POST /api/auth/register`
- Registration: `backend/src/routes/auth.routes.ts:154-213`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → auth.routes.ts anonymous POST /register callback (lines 154-213)`.
- Handler: `backend/src/routes/auth.routes.ts:154-213` — `auth.routes.ts anonymous POST /register callback (lines 154-213)`. Auth/capability: public.
- Inputs: path params none; query none; body `fullName`, `username`, `password`, optional `phone`. Validation: first three required; lower-cased username must be unique; User schema/password hook applies.
- Response: status 400, 500, 200(default); shape keys success, message, user. Models/files/providers: reads User with `findOne`, then `findById`; writes new User document `save`; exact fields written: `fullName`, lower-cased `username`, `password`, optional trimmed `phone`, plus schema defaults/timestamps; file/provider operations: none.
- External integrations: none. Frontend/external consumers: AuthService, RegisterComponent. Status: active.

### 34. `GET /api/campaign`
- Registration: `backend/src/routes/campaign.routes.ts:8`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireAdmin → getCampaigns`.
- Handler: `backend/src/controllers/campaign.controller.ts:43-66` — `getCampaigns`. Auth/capability: authenticated site User with exact role admin.
- Inputs: path params none; query status, limit; body none. Validation: none.
- Response: status 200; shape keys success, data, timestamp. Models/files/providers: reads Campaign with `find`; writes none; exact fields written: none; file/provider operations: none.
- External integrations: none. Frontend/external consumers: CampaignService. Status: active.

### 35. `POST /api/campaign/launch`
- Registration: `backend/src/routes/campaign.routes.ts:9`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireAdmin → launchCampaign`.
- Handler: `backend/src/controllers/campaign.controller.ts:66-179` — `launchCampaign`. Auth/capability: authenticated site User with exact role admin.
- Inputs: path params none; query none; body title, content, mediaUrl, platforms, scheduledAt. Validation: trimmed `title` and `content` are required; normalized `platforms` must contain at least one of `facebook|instagram`; invalid `scheduledAt` becomes null (`campaign.controller.ts:68-83`).
- Response: status 502, 200; shape keys success, message, data, timestamp. Models/files/providers: reads none initially; writes Campaign with `create`, then `findByIdAndUpdate`; exact fields written: create: `title`, processed `content`, optional `mediaUrl`, normalized `platforms`, `status="pending"`, `scheduledAt`; update: `status` to `published` or `failed` and `n8nResponse`; file/provider operations: HTTP POST to configured n8n campaign webhook with campaign payload.
- External integrations: HTTP POST to configured n8n campaign webhook with campaign payload. Frontend/external consumers: CampaignService. Status: active.

### 36. `POST /api/catering`
- Registration: `backend/src/routes/catering.routes.ts:7`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → submitCateringOrder`.
- Handler: `backend/src/controllers/catering.controller.ts:167-358` — `submitCateringOrder`; called-service evidence: backend/src/services/email.service.ts:597-688 `sendCateringOrderEmails`. Auth/capability: public.
- Inputs: path params none; query none; body fullName, phone, email, eventDate, mealTime, deliveryType, salads, sidesEvening, sidesMorning, miscItems, seudaShlishit, address, remarks. Validation: nonblank fullName/phone/email/eventDate required; email format required; `mealTime` enum `evening|morning|both`; `deliveryType` enum `pickup|delivery`; legacy first/main-course arrays are rejected; normalized catering lines and portions are validated (`catering.controller.ts:171-207`).
- Response: status 500, 201; shape keys success, message, timestamp, orderId. Models/files/providers: reads StoreSettings with `findOne`; writes Order with `create`; exact fields written: root `orderType="catering"`, `cateringKind="shabbat"`, `items`, `totalPrice=0`, `status="pending"`, `numberOfPortions`, `mealTime`, `mealTypes`, `salads`, `firstCourses`, `mainCourses`, `firstCoursesEvening`, `firstCoursesMorning`, `mainCoursesEvening`, `mainCoursesMorning`, `sidesEvening`, `sidesMorning`, optional `portionsEvening`, optional `portionsMorning`; `items[]` declared subpaths `name`, `price`, `quantity`, `category`, optional `description`; `customerDetails` is the declared unconstrained Object and receives nested keys `fullName`, `phone`, `email`, `eventDate`, optional `address`, optional `notes`. Inputs `seudaShlishit` and `remarks` only contribute text to `customerDetails.notes`; neither is a root Order field (`catering.controller.ts:278-319`; `models/Order.ts:111-128`); file/provider operations: sends catering order emails through email.service.
- External integrations: sends catering order emails through email.service. Frontend/external consumers: HolidayFoodComponent. Status: active.

### 37. `POST /api/catering/events`
- Registration: `backend/src/routes/catering.routes.ts:8`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → submitEventCateringOrder`.
- Handler: `backend/src/controllers/catering.controller.ts:358-513` — `submitEventCateringOrder`; called-service evidence: backend/src/services/email.service.ts:310-369 `sendOrderEmails`. Auth/capability: public.
- Inputs: path params none; query none; body fullName, phone, email, eventDate, guestCount, eventType, venue, notes, deliveryType, address, pricePerPortion, totalEventPrice. Validation: nonblank fullName/phone/email/eventDate/eventType required; email valid; eventDate exact valid `YYYY-MM-DD`, not past, not Saturday; guestCount positive; delivery/address and numeric price semantics are normalized (`catering.controller.ts:362-391`).
- Response: status 500, 201; shape keys success, message, timestamp, orderId. Models/files/providers: reads none; writes Order with `create`; exact fields written: root `orderType="catering"`, `cateringKind="events"`, `orderNumber`, `items`, `totalPrice` (from input `totalEventPrice`), `subtotal`, `status="pending"`, `eventType`, `guestCount`, optional `venue`, `numberOfPortions`; `items[]` writes `productId`, `name`, `price`, `quantity`, `category`, optional `selectedOption.label|amount|price`, `imageUrl`, `description`; `customerDetails` is the declared unconstrained Object and receives nested keys `fullName`, `phone`, `email`, `eventDate`, `address`, `deliveryType`, `pricePerPortion`, `notes`. Input `pricePerPortion` is not a root Order field; input `totalEventPrice` maps to root `totalPrice` (`catering.controller.ts:409-441`; `models/Order.ts:111-168`); file/provider operations: sends event order emails through email.service.
- External integrations: sends event order emails through email.service. Frontend/external consumers: EventsCateringComponent. Status: active.

### 38. `GET /api/contact`
- Registration: `backend/src/routes/contact.routes.ts:13`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireAdmin → getAllContactRequests`.
- Handler: `backend/src/controllers/contact.controller.ts:56-81` — `getAllContactRequests`; called-service evidence: backend/src/services/contact.service.ts:98-125 `getAllContactRequests`. Auth/capability: authenticated site User with exact role admin.
- Inputs: path params none; query status, limit, offset; body none. Validation: none.
- Response: status 200; shape keys success, data, pagination, limit, offset, hasMore. Models/files/providers: reads Contact with `countDocuments` and `find`; writes none; exact fields written: none; file/provider operations: none.
- External integrations: none. Frontend/external consumers: ContactService.submitContactRequest. Status: active.

### 39. `POST /api/contact`
- Registration: `backend/src/routes/contact.routes.ts:10`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → submitContactForm`.
- Handler: `backend/src/controllers/contact.controller.ts:14-56` — `submitContactForm`; called-service evidence: backend/src/services/contact.service.ts:61-98 `submitContactForm`. Auth/capability: public.
- Inputs: path params none; query none; body `name`, `phone`, `email`, `message`, optional `marketingData`; handler forces `source=website`. Validation: nonblank name/phone/email/message; Israeli-phone regex; email regex; message length 10-1000; marketing data is sanitized.
- Response: 200 `{success,data:{success,message,contactId},message,timestamp}`; validation errors use the shared 400 error shape; unexpected errors use shared 500. Models/files/providers: reads none; writes Contact with `create`; exact fields written: `name`, `email`, `phone`, `message`, `source="website"`, `status="new"`, `marketingData.utm_source`, `marketingData.utm_medium`, `marketingData.utm_campaign`, `marketingData.utm_term`, `marketingData.utm_content`, plus timestamps (`models/Contact.ts:38-110`); file/provider operations: business email through email.service and asynchronous HTTP POST to configured contact n8n webhook.
- External integrations: business email through email.service and asynchronous HTTP POST to configured contact n8n webhook. Frontend/external consumers: `ContactService.submitContactRequest`. Status: active.

### 40. `DELETE /api/contact/:id`
- Registration: `backend/src/routes/contact.routes.ts:18`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireAdmin → deleteContactRequest`.
- Handler: `backend/src/controllers/contact.controller.ts:168-188` — `deleteContactRequest`; called-service evidence: backend/src/services/contact.service.ts:163-173 `deleteContactRequest`. Auth/capability: authenticated site User with exact role admin.
- Inputs: path params id; query none; body none. Validation: path `id` is required, must be a valid Mongo ObjectId, and must identify an existing Contact (`contact.controller.ts:172-190`; `contact.service.ts:163-173`).
- Response: status 200; shape keys success, message, timestamp. Models/files/providers: reads none; writes Contact with `findByIdAndDelete`; exact fields written: none (document deletion); file/provider operations: none.
- External integrations: none. Frontend/external consumers: ContactService / AdminContactsService. Status: active.

### 41. `GET /api/contact/:id`
- Registration: `backend/src/routes/contact.routes.ts:16`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireAdmin → getContactRequestById`.
- Handler: `backend/src/controllers/contact.controller.ts:81-102` — `getContactRequestById`; called-service evidence: backend/src/services/contact.service.ts:125-131 `getContactRequestById`. Auth/capability: authenticated site User with exact role admin.
- Inputs: path params id; query none; body none. Validation: path `id` is required, must be a valid Mongo ObjectId, and must identify an existing Contact (`contact.controller.ts:85-104`; `contact.service.ts:125-131`).
- Response: status 200; shape keys success, data, timestamp. Models/files/providers: reads Contact with `findById`; writes none; exact fields written: none; file/provider operations: none.
- External integrations: none. Frontend/external consumers: ContactService / AdminContactsService. Status: active.

### 42. `PATCH /api/contact/:id/status`
- Registration: `backend/src/routes/contact.routes.ts:17`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireAdmin → updateContactStatus`.
- Handler: `backend/src/controllers/contact.controller.ts:102-138` — `updateContactStatus`; called-service evidence: backend/src/services/contact.service.ts:131-163 `updateContactStatus`. Auth/capability: authenticated site User with exact role admin.
- Inputs: path params id; query none; body notes, leadScore, lastContactAt, nextFollowUpAt, outcomeReason, ownerNotes, status. Validation: path `id` is required and valid; optional `status` must be an allowed contact status; at least one supported update field must be present; target must exist (`contact.controller.ts:107-140`; `contact.service.ts:131-163`).
- Response: status 200; shape keys success, data, message, timestamp. Models/files/providers: reads none; writes Contact with `findByIdAndUpdate`; exact fields written: provided `status`, `notes`, `leadScore`, `lastContactAt`, `nextFollowUpAt`, `outcomeReason`, `ownerNotes`; file/provider operations: none.
- External integrations: none. Frontend/external consumers: ContactService / AdminContactsService. Status: active.

### 43. `GET /api/contact/analytics/source`
- Registration: `backend/src/routes/contact.routes.ts:14`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireAdmin → getLeadsBySource`.
- Handler: `backend/src/controllers/contact.controller.ts:149-168` — `getLeadsBySource`; called-service evidence: backend/src/services/contact.service.ts:243-320 `getLeadsBySource`. Auth/capability: authenticated site User with exact role admin.
- Inputs: path params none; query from, to; body none. Validation: none.
- Response: status 200; shape keys success, timestamp. Models/files/providers: reads Contact with `aggregate`; writes none; exact fields written: none; file/provider operations: none.
- External integrations: none. Frontend/external consumers: ContactService / AdminContactsService. Status: active.

### 44. `GET /api/contact/stats`
- Registration: `backend/src/routes/contact.routes.ts:15`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireAdmin → getContactStatistics`.
- Handler: `backend/src/controllers/contact.controller.ts:138-149` — `getContactStatistics`; called-service evidence: backend/src/services/contact.service.ts:173-220 `getContactStatistics`. Auth/capability: authenticated site User with exact role admin.
- Inputs: path params none; query none; body none. Validation: none.
- Response: status 200; shape keys success, data, timestamp. Models/files/providers: reads Contact with `countDocuments`; writes none; exact fields written: none; file/provider operations: none.
- External integrations: none. Frontend/external consumers: ContactService / AdminContactsService. Status: active.

### 45. `GET /api/coupons`
- Registration: `backend/src/routes/coupon.routes.ts:23`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireAdmin → listCoupons`.
- Handler: `backend/src/controllers/coupon.controller.ts:14-24` — `listCoupons`. Auth/capability: authenticated site User with exact role admin.
- Inputs: path params none; query none; body none. Validation: none.
- Response: status 500, 200 (implicit where no status is set); shape keys success, message. Models/files/providers: reads Coupon with `find`; writes none; exact fields written: none; file/provider operations: none.
- External integrations: none. Frontend/external consumers: CouponService. Status: active.

### 46. `POST /api/coupons`
- Registration: `backend/src/routes/coupon.routes.ts:24`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireAdmin → createCoupon`.
- Handler: `backend/src/controllers/coupon.controller.ts:24-87` — `createCoupon`. Auth/capability: authenticated site User with exact role admin.
- Inputs: path params none; query none; body code, discountType, discountValue, minOrderValue, expiresAt, expiryDate, maxUses, maxUsesPerCustomer, targetCustomerCategory, isActive, isVipOnly. Validation: code required; discountType enum `percentage|fixedAmount`; discountValue/minOrderValue nonnegative and percentage <=100; expiry valid when supplied; maxUses null or >=1; maxUsesPerCustomer >=1 (`coupon.controller.ts:29-59`).
- Response: status 201, 500; shape keys success, message. Models/files/providers: reads none; writes new Coupon document `save`; exact fields written: normalized `code`, `discountType`, `discountValue`, `minOrderValue`, `expiresAt`, `maxUses`, `maxUsesPerCustomer`, `targetCustomerCategory`, `isActive`, `isVipOnly`, plus schema defaults/timestamps; file/provider operations: none.
- External integrations: none. Frontend/external consumers: CouponService. Status: active.

### 47. `DELETE /api/coupons/:id`
- Registration: `backend/src/routes/coupon.routes.ts:26`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireAdmin → deleteCoupon`.
- Handler: `backend/src/controllers/coupon.controller.ts:192-206` — `deleteCoupon`. Auth/capability: authenticated site User with exact role admin.
- Inputs: path params id; query none; body none. Validation: none.
- Response: status 404, 500, 200 (implicit where no status is set); shape keys success, message. Models/files/providers: reads none; writes Coupon with `findByIdAndDelete`; exact fields written: none (document deletion); file/provider operations: none.
- External integrations: none. Frontend/external consumers: CouponService. Status: active.

### 48. `PUT /api/coupons/:id`
- Registration: `backend/src/routes/coupon.routes.ts:25`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireAdmin → updateCoupon`.
- Handler: `backend/src/controllers/coupon.controller.ts:87-160` — `updateCoupon`. Auth/capability: authenticated site User with exact role admin.
- Inputs: path params id; query none; body code, discountType, discountValue, minOrderValue, expiresAt, expiryDate, maxUses, maxUsesPerCustomer, isActive, isVipOnly, targetCustomerCategory. Validation: target must exist; changed type is `percentage|fixedAmount`; amounts are nonnegative and percentage <=100; expiry valid/null; maxUses null or >=1 and not below usageCount; per-customer max >=1; booleans only applied as booleans (`coupon.controller.ts:91-138`).
- Response: status 404, 500, 200 (implicit where no status is set); shape keys success, message. Models/files/providers: reads Coupon with `findById`; writes Coupon document `save`; exact fields written: provided normalized `code`, `discountType`, `discountValue`, `minOrderValue`, `expiresAt`, `maxUses`, `maxUsesPerCustomer`, `isActive`, `isVipOnly`, `targetCustomerCategory`, plus updated timestamp; file/provider operations: none.
- External integrations: none. Frontend/external consumers: CouponService. Status: active.

### 49. `POST /api/coupons/apply`
- Registration: `backend/src/routes/coupon.routes.ts:21`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → applyCouponLimiter → applyCoupon`.
- Handler: `backend/src/controllers/coupon.controller.ts:160-192` — `applyCoupon`; called-service evidence: backend/src/services/coupon.service.ts:93-201 `validateAndApplyCoupon`. Auth/capability: public.
- Inputs: path params none; query none; body cartTotal, customerPhone. Validation: coupon code required; cart total must be a nonnegative number; coupon must exist, be active, unexpired, within global/per-phone use limits and minimum order; customer/category/VIP/blacklist prerequisites apply (`coupon.controller.ts:166-197`; `coupon.service.ts:93-201`).
- Response: status 400, 404, 500, 200 (implicit where no status is set); shape keys success, message, discountAmount, newTotal, couponId. Models/files/providers: reads Coupon with `findOne`; conditionally Customer with `findOne`; writes none; exact fields written: none; file/provider operations: none.
- External integrations: none. Frontend/external consumers: CouponService. Status: active.

### 50. `GET /api/customers`
- Registration: `backend/src/routes/customer.routes.ts:15`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireAdmin → getCustomers`.
- Handler: `backend/src/controllers/customer.controller.ts:318-412` — `getCustomers`. Auth/capability: authenticated site User with exact role admin.
- Inputs: path params none; query search, manualStatus, limit, city, minTotalSpent, lastOrderBeforeDays, isRegistered; body none. Validation: none.
- Response: status 500, 200 (implicit where no status is set); shape keys success, message. Models/files/providers: reads Customer with `find`; writes conditional Customer `bulkWrite` of `updateOne` operations; exact fields written: `customerCategory` only when derived category differs; file/provider operations: none.
- External integrations: none. Frontend/external consumers: UsersService. Status: active.

### 51. `POST /api/customers`
- Registration: `backend/src/routes/customer.routes.ts:16`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireAdmin → createCustomer`.
- Handler: `backend/src/controllers/customer.controller.ts:412-476` — `createCustomer`. Auth/capability: authenticated site User with exact role admin.
- Inputs: path params none; query none; body phone, fullName, email, address, city. Validation: phone must normalize to a valid value and must not duplicate an existing Customer (`customer.controller.ts:415-429`).
- Response: status 400, 409, 201, 500; shape keys success, message. Models/files/providers: reads Customer with `findOne` duplicate check; writes Customer with `create`; exact fields written: `normalizedPhone`, `fullName`, `email`, `address`, `city`, `totalSpent=0`, `orderCount=0`, `orderHistory=[]`, `manualStatus="NONE"`, `customerCategory="all"`, `tags=[]`, `adminNotes=""`, `dietaryInfo=""`, plus timestamps. Input `phone` maps only to `normalizedPhone`; Customer has no `phone` schema path (`customer.controller.ts:433-447`; `models/Customer.ts:27-104`); file/provider operations: none.
- External integrations: none. Frontend/external consumers: UsersService. Status: active.

### 52. `DELETE /api/customers/:id`
- Registration: `backend/src/routes/customer.routes.ts:20`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireAdmin → deleteCustomer`.
- Handler: `backend/src/controllers/customer.controller.ts:657-675` — `deleteCustomer`. Auth/capability: authenticated site User with exact role admin.
- Inputs: path params id; query none; body none. Validation: none.
- Response: status 404, 500, 200 (implicit where no status is set); shape keys success, message, _id. Models/files/providers: reads none; writes Customer with `findByIdAndDelete`; exact fields written: none (document deletion); file/provider operations: none.
- External integrations: none. Frontend/external consumers: UsersService. Status: active.

### 53. `PUT /api/customers/:id/crm`
- Registration: `backend/src/routes/customer.routes.ts:19`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireAdmin → updateCustomerCrm`.
- Handler: `backend/src/controllers/customer.controller.ts:476-657` — `updateCustomerCrm`. Auth/capability: authenticated site User with exact role admin.
- Inputs: path params id; query none; body tags, fullName, email, address, city, phone, adminNotes, dietaryInfo, manualStatus, customerCategory. Validation: target must exist; tags normalized to strings; phone must normalize; manualStatus enum `NONE|VIP|BLACKLIST`; customerCategory enum `all|returning|sleeping|vip|registered`; linked username/email cannot collide (`customer.controller.ts:476-580`).
- Response: status 404, 400, 409, 500, 200 (implicit where no status is set); shape keys success, message. Models/files/providers: reads Customer with `findById`; User with `findOne`; writes Customer with `findByIdAndUpdate` and optional `updateOne`; linked User with optional `updateOne`; exact fields written: Customer `tags`, `fullName`, `email`, `address`, `city`, `normalizedPhone`, `adminNotes`, `dietaryInfo`, `manualStatus`, `customerCategory`, `isRegistered`; linked User `fullName`, `phone`, `username` (`customer.controller.ts:476-634`); file/provider operations: none.
- External integrations: none. Frontend/external consumers: UsersService. Status: active.

### 54. `POST /api/customers/audit`
- Registration: `backend/src/routes/customer.routes.ts:18`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireAdmin → auditCustomersSync`.
- Handler: `backend/src/controllers/customer.controller.ts:675-824` — `auditCustomersSync`. Auth/capability: authenticated site User with exact role admin.
- Inputs: path params none; query none; body none. Validation: none.
- Response: status 500, 200 (implicit where no status is set); shape keys success, generatedAt, message. Models/files/providers: reads Order with `find`; User with `find`; Customer with `find`; writes none; exact fields written: none; file/provider operations: none.
- External integrations: none. Frontend/external consumers: UsersService. Status: active.

### 55. `POST /api/customers/migrate`
- Registration: `backend/src/routes/customer.routes.ts:17`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireAdmin → migrateLegacyData`.
- Handler: `backend/src/controllers/customer.controller.ts:824-1083` — `migrateLegacyData`. Auth/capability: authenticated site User with exact role admin.
- Inputs: path params none; query none; body none. Validation: none.
- Response: status 500, 200 (implicit where no status is set); shape keys success, message, groupedPhones, migratedCustomers. Models/files/providers: reads Order, User, Contact, Customer with `find`; writes Customer with `bulkWrite` (`updateOne` upserts) and final `updateMany`; exact fields written: `$set.fullName`, `$set.email`, `$set.tags`, `$set.adminNotes`, `$set.dietaryInfo`, `$set.city`, `$set.orderCount`, `$set.totalSpent`, `$set.lastOrderDate`, `$set.isRegistered`; on insertion `$setOnInsert.manualStatus="NONE"` and `$setOnInsert.customerCategory="all"`; final purge writes `$set.email=""` for matching business addresses (`customer.controller.ts:991-1067`); file/provider operations: none.
- External integrations: none. Frontend/external consumers: UsersService. Status: active.

### 56. `GET /api/delivery`
- Registration: `backend/src/routes/delivery.routes.ts:17-19`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → delivery.routes.ts anonymous GET / callback (lines 17-19)`.
- Handler: `backend/src/routes/delivery.routes.ts:17-19` — `delivery.routes.ts anonymous GET / callback (lines 17-19)`. Auth/capability: public.
- Inputs: path params none; query none; body none. Validation: none.
- Response: status 200; shape keys success, message, calculateFee. Models/files/providers: reads none; writes none; exact fields written: none; file/provider operations: none.
- External integrations: none. Frontend/external consumers: DeliveryService / ShippingService. Status: active.

### 57. `POST /api/delivery/calculate-fee`
- Registration: `backend/src/routes/delivery.routes.ts:21`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → postCalculateFee`.
- Handler: `backend/src/controllers/delivery.controller.ts:11-164` — `postCalculateFee`; called service `backend/src/services/delivery.service.ts` — `calculateDeliveryFee`. Auth/capability: public.
- Inputs: path params none; query none; body `destinationCity` or fallback `city`, and `cartTotal`. Validation: cartTotal coerced to Number and must be finite/nonnegative; city must be nonblank; out-of-area and geocoding failures return 400; per-tier minimum and free-shipping thresholds are enforced.
- Response: 400 `{error[,code,isEligible]}`; 200 fallback, minimum-not-met, eligible, or estimated-fee objects with explicit `distance`, `price`, `isFree`, `isEligible`, threshold and estimation fields. Models/files/providers: reads StoreSettings with `findOne`; DeliveryPricing and DeliveryCityOverride through delivery calculation lookups; writes none; exact fields written: none; file/provider operations: Google Maps Distance Matrix/geocoding, with OpenStreetMap fallback, through delivery.service.
- External integrations: Google Maps Distance Matrix/geocoding, with OpenStreetMap fallback, through delivery.service. Frontend/external consumers: `ShippingService.calculateFee`; checkout/order delivery calculations. Status: active.

### 58. `GET /api/delivery/cities`
- Registration: `backend/src/routes/delivery.routes.ts:26`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → getCityOverrides`.
- Handler: `backend/src/controllers/delivery.controller.ts:180-191` — `getCityOverrides`. Auth/capability: public.
- Inputs: path params none; query none; body none. Validation: none.
- Response: status 200, 500; shape keys error. Models/files/providers: reads DeliveryCityOverride with `find`; writes none; exact fields written: none; file/provider operations: none.
- External integrations: none. Frontend/external consumers: DeliveryService / ShippingService. Status: active.

### 59. `POST /api/delivery/cities`
- Registration: `backend/src/routes/delivery.routes.ts:27`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireAdmin → createCityOverride`.
- Handler: `backend/src/controllers/delivery.controller.ts:191-224` — `createCityOverride`. Auth/capability: authenticated site User with exact role admin.
- Inputs: path params none; query none; body `displayName`, `overridePrice`. Validation: `displayName` is the required city input; it is trimmed and normalized into stored `cityName`; `overridePrice` must coerce to a nonnegative number; normalized `cityName` must be unique (`delivery.controller.ts:191-215`).
- Response: status 400, 409, 201, 500; shape keys error. Models/files/providers: reads DeliveryCityOverride with `findOne` duplicate check; writes DeliveryCityOverride with `create`; exact fields written: normalized `cityName`, `displayName`, `overridePrice`, `isActive=true`, plus timestamps; file/provider operations: none.
- External integrations: none. Frontend/external consumers: DeliveryService / ShippingService. Status: active.

### 60. `DELETE /api/delivery/cities/:id`
- Registration: `backend/src/routes/delivery.routes.ts:29`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireAdmin → deleteCityOverride`.
- Handler: `backend/src/controllers/delivery.controller.ts:248-262` — `deleteCityOverride`. Auth/capability: authenticated site User with exact role admin.
- Inputs: path params `id`; query none; body none. Validation: target city override must exist (`delivery.controller.ts:248-262`).
- Response: status 404, 200, 500; shape keys error, deleted. Models/files/providers: reads none; writes DeliveryCityOverride with `findByIdAndDelete`; exact fields written: none (document deletion); file/provider operations: none.
- External integrations: none. Frontend/external consumers: DeliveryService / ShippingService. Status: active.

### 61. `PUT /api/delivery/cities/:id`
- Registration: `backend/src/routes/delivery.routes.ts:28`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireAdmin → updateCityOverride`.
- Handler: `backend/src/controllers/delivery.controller.ts:224-248` — `updateCityOverride`. Auth/capability: authenticated site User with exact role admin.
- Inputs: path params id; query none; body displayName, overridePrice, isActive. Validation: none.
- Response: status 404, 200, 500; shape keys error. Models/files/providers: reads none; writes DeliveryCityOverride with `findByIdAndUpdate`; exact fields written: provided normalized `displayName`/`cityName`, nonnegative `overridePrice`, boolean `isActive`; file/provider operations: none.
- External integrations: none. Frontend/external consumers: DeliveryService / ShippingService. Status: active.

### 62. `GET /api/delivery/pricing`
- Registration: `backend/src/routes/delivery.routes.ts:24`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → getPricing`.
- Handler: `backend/src/controllers/delivery.controller.ts:167-180` — `getPricing`. Auth/capability: public.
- Inputs: path params none; query none; body none. Validation: none.
- Response: status 200, 500; shape keys error. Models/files/providers: reads DeliveryPricing with `find`; writes none; exact fields written: none; file/provider operations: none.
- External integrations: none. Frontend/external consumers: ShippingService (GET); POST/PUT/DELETE from FE are BROKEN. Status: active.

### 63. `GET /api/employees`
- Registration: `backend/src/routes/employee.routes.ts:12`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireAdmin → getEmployeesWithStatus`.
- Handler: `backend/src/controllers/employee.controller.ts:15-36` — `getEmployeesWithStatus`; called-service evidence: backend/src/services/employee.service.ts:22-63 `getEmployeesWithStatus`. Auth/capability: authenticated site User with exact role admin.
- Inputs: path params none; query none; body none. Validation: none.
- Response: status 200, 500; shape keys success, data, count, timestamp, message, error, stack. Models/files/providers: reads Employee with `find({isActive:true})`; Attendance with `find({status:"active"})`; writes none; exact fields written: none; file/provider operations: none.
- External integrations: none. Frontend/external consumers: Admin employees UI / MyZone. Status: active.

### 64. `POST /api/employees`
- Registration: `backend/src/routes/employee.routes.ts:14`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireAdmin → createEmployee`.
- Handler: `backend/src/controllers/employee.controller.ts:36-71` — `createEmployee`; called-service evidence: backend/src/services/employee.service.ts:63-75 `createEmployee`. Auth/capability: authenticated site User with exact role admin.
- Inputs: path params none; query none; body firstName, lastName, role, phone, hourlyRate, pinCode. Validation: the controller explicitly requires firstName, lastName, role, and phone, and defaults PIN to `1234`; it does not explicitly check `hourlyRate`, but the Employee schema requires a numeric value ≥0, so successful `save()` also requires `hourlyRate` (`employee.controller.ts:36-53`; `models/Employee.js:26-30`).
- Response: status 400, 201, 500; shape keys success, message, fields, data, error, stack. Models/files/providers: reads none; writes new Employee document `save`; exact fields written on successful creation: `firstName`, `lastName`, `role`, `phone`, required `hourlyRate`, generated/provided `pinCode`, plus schema defaults/timestamps; file/provider operations: none.
- External integrations: none. Frontend/external consumers: Admin employees UI / MyZone. Status: active.

### 65. `DELETE /api/employees/:id`
- Registration: `backend/src/routes/employee.routes.ts:16`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireAdmin → deleteEmployee`.
- Handler: `backend/src/controllers/employee.controller.ts:94-115` — `deleteEmployee`; called-service evidence: backend/src/services/employee.service.ts:95-105 `deleteEmployee`. Auth/capability: authenticated site User with exact role admin.
- Inputs: path params id; query none; body none. Validation: none.
- Response: status 200, 500; shape keys success, message, error, stack. Models/files/providers: reads none; writes Employee with `findByIdAndUpdate`; exact fields written: `isActive=false`; file/provider operations: none.
- External integrations: none. Frontend/external consumers: Admin employees UI / MyZone. Status: active.

### 66. `GET /api/employees/:id`
- Registration: `backend/src/routes/employee.routes.ts:13`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireAdmin → getEmployeeById`.
- Handler: `backend/src/controllers/employee.controller.ts:115-136` — `getEmployeeById`; called-service evidence: backend/src/services/employee.service.ts:105-119 `getEmployeeById`. Auth/capability: authenticated site User with exact role admin.
- Inputs: path params id; query none; body none. Validation: none.
- Response: status 200, 500; shape keys success, data, message, error, stack. Models/files/providers: reads Employee with `findById`; writes none; exact fields written: none; file/provider operations: none.
- External integrations: none. Frontend/external consumers: Admin employees UI / MyZone. Status: active.

### 67. `PUT /api/employees/:id`
- Registration: `backend/src/routes/employee.routes.ts:15`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireAdmin → updateEmployee`.
- Handler: `backend/src/controllers/employee.controller.ts:71-94` — `updateEmployee`; called-service evidence: backend/src/services/employee.service.ts:75-95 `updateEmployee`. Auth/capability: authenticated site User with exact role admin.
- Inputs: path params `id`; query none; body is passed directly as the Mongoose update document; schema-accepted fields are `firstName`, `lastName`, `role`, `phone`, `hourlyRate`, `isActive`, `pinCode` (undeclared keys are stripped by the strict schema). Validation: no controller field whitelist or required-field check; `runValidators:true` applies Employee schema enum/type/range/string-length rules to supplied fields, and the target must exist (`employee.controller.ts:71-89`; `employee.service.ts:75-90`; `models/Employee.js:4-44`).
- Response: status 200, 500; shape keys success, data, message, error, stack. Models/files/providers: reads none; writes Employee with `findByIdAndUpdate`; exact fields written: request body is passed directly, but Mongoose's strict Employee schema retains only `firstName`, `lastName`, `role`, `phone`, `hourlyRate`, `isActive`, `pinCode`, plus `updatedAt`; undeclared keys are stripped (`employee.service.ts:75-81`; `models/Employee.js:4-44`); file/provider operations: none.
- External integrations: none. Frontend/external consumers: Admin employees UI / MyZone. Status: active.

### 68. `GET /api/employees/my/stats`
- Registration: `backend/src/routes/employee.routes.ts:19`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → getMyStats`.
- Handler: `backend/src/controllers/employee.controller.ts:136-165` — `getMyStats`; called-service evidence: backend/src/services/employee.service.ts:119-196 `getEmployeeStats`. Auth/capability: any active authenticated User or Employee JWT; handler may further ownership-check.
- Inputs: path params none; query month, split; body none. Validation: none.
- Response: status 401, 200, 500; shape keys success, message, data, error, stack. Models/files/providers: reads Employee with `findById`; Attendance with `find` by employee/month; writes none; exact fields written: none; file/provider operations: none.
- External integrations: none. Frontend/external consumers: MyZoneComponent. Status: active.

### 69. `GET /api/gallery`
- Registration: `backend/src/routes/gallery.routes.ts:10`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → getAllGalleryItems`.
- Handler: `backend/src/controllers/gallery.controller.ts:29-57` — `getAllGalleryItems`. Auth/capability: public.
- Inputs: path params none; query type, active; body none. Validation: none.
- Response: status 200; shape keys success, data, count, timestamp. Models/files/providers: reads GalleryItem with `find`; writes none; exact fields written: none; file/provider operations: none.
- External integrations: none. Frontend/external consumers: GalleryService. Status: active.

### 70. `POST /api/gallery`
- Registration: `backend/src/routes/gallery.routes.ts:15`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireAdmin → createGalleryItem`.
- Handler: `backend/src/controllers/gallery.controller.ts:78-119` — `createGalleryItem`. Auth/capability: authenticated site User with exact role admin.
- Inputs: path params none; query none; body title, type, url, thumbnail, order, isActive. Validation: type required and enum `image|video`; URL required and nonblank; video thumbnail is derived from YouTube URL when omitted (`gallery.controller.ts:81-95`).
- Response: status 201; shape keys success, message, data, timestamp. Models/files/providers: reads none; writes new GalleryItem document `save`; exact fields written: `title`, enum `type`, trimmed `url`, supplied/derived `thumbnail`, `order`, `isActive`, plus timestamps; file/provider operations: none.
- External integrations: none. Frontend/external consumers: GalleryService. Status: active.

### 71. `DELETE /api/gallery/:id`
- Registration: `backend/src/routes/gallery.routes.ts:17`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireAdmin → deleteGalleryItem`.
- Handler: `backend/src/controllers/gallery.controller.ts:165-186` — `deleteGalleryItem`. Auth/capability: authenticated site User with exact role admin.
- Inputs: path params id; query none; body none. Validation: path `id` is required and must identify an existing GalleryItem (`gallery.controller.ts:165-175`).
- Response: status 200; shape keys success, message, timestamp. Models/files/providers: reads none; writes GalleryItem with `findByIdAndDelete`; exact fields written: none (document deletion); file/provider operations: none.
- External integrations: none. Frontend/external consumers: GalleryService. Status: active.

### 72. `GET /api/gallery/:id`
- Registration: `backend/src/routes/gallery.routes.ts:11`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → getGalleryItemById`.
- Handler: `backend/src/controllers/gallery.controller.ts:57-78` — `getGalleryItemById`. Auth/capability: public.
- Inputs: path params id; query none; body none. Validation: path `id` is required and must identify an existing GalleryItem (`gallery.controller.ts:57-67`).
- Response: status 200; shape keys success, data, timestamp. Models/files/providers: reads GalleryItem with `findById`; writes none; exact fields written: none; file/provider operations: none.
- External integrations: none. Frontend/external consumers: GalleryService. Status: active.

### 73. `PUT /api/gallery/:id`
- Registration: `backend/src/routes/gallery.routes.ts:16`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireAdmin → updateGalleryItem`.
- Handler: `backend/src/controllers/gallery.controller.ts:119-165` — `updateGalleryItem`. Auth/capability: authenticated site User with exact role admin.
- Inputs: path params id; query none; body title, type, url, thumbnail, order, isActive. Validation: path `id` required and target must exist; changed type must be `image|video`; URL is trimmed; absent video thumbnail may be derived from URL (`gallery.controller.ts:119-150`).
- Response: status 200; shape keys success, message, data, timestamp. Models/files/providers: reads GalleryItem with `findById`; writes GalleryItem document `save`; exact fields written: provided `title`, enum `type`, trimmed `url`, `thumbnail`, `order`, `isActive`; may derive `thumbnail` from YouTube URL; file/provider operations: none.
- External integrations: none. Frontend/external consumers: GalleryService. Status: active.

### 74. `GET /api/gallery/stats`
- Registration: `backend/src/routes/gallery.routes.ts:14`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireAdmin → getGalleryStatistics`.
- Handler: `backend/src/controllers/gallery.controller.ts:186-206` — `getGalleryStatistics`. Auth/capability: authenticated site User with exact role admin.
- Inputs: path params none; query none; body none. Validation: none.
- Response: status 200; shape keys success, data, total, images, videos, active, inactive. Models/files/providers: reads GalleryItem with four `countDocuments` queries; writes none; exact fields written: none; file/provider operations: none.
- External integrations: none. Frontend/external consumers: GalleryService. Status: active, broken; broken evidence: `/:id` is registered at gallery.routes.ts:11 before `/stats` at line 14, so Express dispatches `stats` to getGalleryItemById.

### 75. `GET /api/health`
- Registration: `backend/src/server.ts:174-180`. Middleware: `cors → helmet → morgan → server.ts anonymous GET /api/health callback (lines 174-180)`.
- Handler: `backend/src/server.ts:174-180` — `server.ts anonymous GET /api/health callback (lines 174-180)`. Auth/capability: public.
- Inputs: path params none; query none; body none. Validation: none.
- Response: status 200; shape keys success, status, timestamp. Models/files/providers: reads none; writes none; exact fields written: none; file/provider operations: none.
- External integrations: none. Frontend/external consumers: none found. Status: active, no frontend consumer, external consumer.

### 76. `GET /api/holiday-events`
- Registration: `backend/src/routes/holiday-event.routes.ts:24`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireAdmin → listHolidayEvents`.
- Handler: `backend/src/controllers/holiday-event.controller.ts:183-189` — `listHolidayEvents`. Auth/capability: authenticated site User with exact role admin.
- Inputs: path params none; query none; body none. Validation: none.
- Response: status 200 (implicit where no status is set); shape keys serialized service/model return value. Models/files/providers: reads HolidayEvent with `find`; writes none; exact fields written: none; file/provider operations: none.
- External integrations: none. Frontend/external consumers: HolidayEventService. Status: active.

### 77. `POST /api/holiday-events`
- Registration: `backend/src/routes/holiday-event.routes.ts:26`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireAdmin → createHolidayEvent`.
- Handler: `backend/src/controllers/holiday-event.controller.ts:198-235` — `createHolidayEvent`. Auth/capability: authenticated site User with exact role admin.
- Inputs: path params none; query none; body name, orderDeadline, products, isActive, imageUrl. Validation: name required; orderDeadline must be a valid date; products normalized by schema; activating the event deactivates others (`holiday-event.controller.ts:198-227`).
- Response: status 400, 201; shape keys success, message. Models/files/providers: reads none; writes HolidayEvent with `create`; if active, other events with `updateMany`; exact fields written: created `name`, `orderDeadline`, `products`, `isActive`, `imageUrl`; other events `isActive=false`; file/provider operations: none.
- External integrations: none. Frontend/external consumers: HolidayEventService. Status: active.

### 78. `DELETE /api/holiday-events/:id`
- Registration: `backend/src/routes/holiday-event.routes.ts:28`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireAdmin → deleteHolidayEvent`.
- Handler: `backend/src/controllers/holiday-event.controller.ts:326-333` — `deleteHolidayEvent`. Auth/capability: authenticated site User with exact role admin.
- Inputs: path params id; query none; body none. Validation: none.
- Response: status 404, 200 (implicit where no status is set); shape keys success, message. Models/files/providers: reads none; writes HolidayEvent with `findByIdAndDelete`; exact fields written: none (document deletion); file/provider operations: none.
- External integrations: none. Frontend/external consumers: HolidayEventService. Status: active.

### 79. `GET /api/holiday-events/:id`
- Registration: `backend/src/routes/holiday-event.routes.ts:25`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireAdmin → getHolidayEventById`.
- Handler: `backend/src/controllers/holiday-event.controller.ts:189-198` — `getHolidayEventById`. Auth/capability: authenticated site User with exact role admin.
- Inputs: path params id; query none; body none. Validation: none.
- Response: status 404, 200 (implicit where no status is set); shape keys success, message. Models/files/providers: reads HolidayEvent with `findById`; writes none; exact fields written: none; file/provider operations: none.
- External integrations: none. Frontend/external consumers: HolidayEventService. Status: active.

### 80. `PUT /api/holiday-events/:id`
- Registration: `backend/src/routes/holiday-event.routes.ts:27`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireAdmin → updateHolidayEvent`.
- Handler: `backend/src/controllers/holiday-event.controller.ts:235-302` — `updateHolidayEvent`. Auth/capability: authenticated site User with exact role admin.
- Inputs: path params id; query none; body name, isActive, orderDeadline, imageUrl, products. Validation: path id must be a valid ObjectId and target must exist; changed name nonblank; orderDeadline valid; products accepted as update payload; at least one update field required (`holiday-event.controller.ts:235-289`).
- Response: status 400, 404, 200 (implicit where no status is set); shape keys success, message. Models/files/providers: reads none; writes HolidayEvent with `findByIdAndUpdate`; if activated, other events with `updateMany`; exact fields written: provided `name`, boolean `isActive`, valid `orderDeadline`, `imageUrl`, `products`; other events `isActive=false`; file/provider operations: none.
- External integrations: none. Frontend/external consumers: HolidayEventService. Status: active.

### 81. `POST /api/holiday-events/migrate-shavuot`
- Registration: `backend/src/routes/holiday-event.routes.ts:18-23`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireAdmin → migrateShavuotToHoliday`.
- Handler: `backend/src/controllers/holiday-event.controller.ts:302-326` — `migrateShavuotToHoliday`; called-service evidence: backend/src/services/shavuot-migration.service.ts:121-218 `migrateShavuotProductsToHoliday`. Auth/capability: authenticated site User with exact role admin.
- Inputs: path params none; query dryRun; body orderDeadline, createAsActive. Validation: none.
- Response: status 200 (implicit where no status is set); shape keys message. Models/files/providers: reads MenuItem with `find`; HolidayEvent with `findOne`; writes MenuItem document `save`, conditional HolidayEvent `create`, and HolidayEvent document `save` unless `dryRun`; exact fields written: MenuItem `isAvailable=false`, `category="archived_holiday"`; newly created HolidayEvent `name="חג שבועות"`, `isActive`, `orderDeadline`, `products=[]`; appended `products[]` entries write `title`, `price`, `description`, `imageUrl`, `isAvailable=true`, while product schema supplies `pricingType`, `weightUnit`, `pricingOptions`; existing event save persists the changed `products` array and timestamps (`shavuot-migration.service.ts:72-115,151-189`; `holidayEvent.model.ts:45-75`); file/provider operations: none.
- External integrations: none. Frontend/external consumers: HolidayEventService. Status: active.

### 82. `GET /api/holiday-events/public/active`
- Registration: `backend/src/routes/holiday-event.routes.ts:17`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → getActiveHolidayEvent`.
- Handler: `backend/src/controllers/holiday-event.controller.ts:166-183` — `getActiveHolidayEvent`. Auth/capability: public.
- Inputs: path params none; query none; body none. Validation: none.
- Response: status 200 (implicit where no status is set); shape keys visible, event. Models/files/providers: reads HolidayEvent with `find`; writes none; exact fields written: none; file/provider operations: none.
- External integrations: none. Frontend/external consumers: HolidayEventService. Status: active.

### 83. `GET /api/menu`
- Registration: `backend/src/routes/menu.routes.ts:19`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → getAllMenuItems`.
- Handler: `backend/src/controllers/menu.controller.ts:8-372` — `getAllMenuItems`. Auth/capability: public.
- Inputs: path params none; query includeArchived, includeUnavailable, category, tag, available, popular; body none. Validation: none.
- Response: status 200; shape keys success, data, count, timestamp. Models/files/providers: reads MenuItem with `countDocuments` then `find`; writes conditional MenuItem `deleteMany({})` and `insertMany(masterMenu)` when count is below 5; exact fields written: inserted documents set `name`, `category`, `description`, `price`, `imageUrl`, `tags`, `isAvailable`, `isPopular`, `isFeatured`; schema supplies `order=0`, `recipe=[]`, `createdAt`, `updatedAt` (`menu.controller.ts:14-330`; `models/menuItem.ts:105-183`); file/provider operations: none.
- External integrations: none. Frontend/external consumers: MenuService. Status: active.

### 84. `POST /api/menu`
- Registration: `backend/src/routes/menu.routes.ts:28`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireAdmin → createMenuItem`.
- Handler: `backend/src/controllers/menu.controller.ts:477-529` — `createMenuItem`. Auth/capability: authenticated site User with exact role admin.
- Inputs: path params none; query none; body name, category, price, pricingVariants, pricingOptions. Validation: name/category required; at least one pricing form required; scalar price and every variant/option price must be positive; variant/option labels and option amounts required (`menu.controller.ts:477-511`).
- Response: status 201; shape keys success, data, message, timestamp. Models/files/providers: reads none; writes new MenuItem document `save`; exact fields written: Mongoose strict schema accepts `name`, `category`, `description`, `price`, `pricePer100g`, `pricingVariants[].size`, `pricingVariants[].label`, `pricingVariants[].price`, `pricingVariants[].weight`, `pricingOptions[].label`, `pricingOptions[].price`, `pricingOptions[].amount`, `imageUrl`, `tags`, `isAvailable`, `isPopular`, `isFeatured`, `order`, `servingSize`, `recipe[].name`, `recipe[].quantity`, `recipe[].unit`, `recipe[].category`, plus timestamps; undeclared request keys are stripped (`menu.controller.ts:477-518`; `models/menuItem.ts:105-183`); file/provider operations: none.
- External integrations: none. Frontend/external consumers: MenuService. Status: active.

### 85. `DELETE /api/menu/:id`
- Registration: `backend/src/routes/menu.routes.ts:32`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireAdmin → deleteMenuItem`.
- Handler: `backend/src/controllers/menu.controller.ts:629-650` — `deleteMenuItem`. Auth/capability: authenticated site User with exact role admin.
- Inputs: path params id; query none; body none. Validation: path `id` required and must identify an existing MenuItem (`menu.controller.ts:629-640`).
- Response: status 200; shape keys success, message, timestamp. Models/files/providers: reads none; writes MenuItem with `findByIdAndDelete`; exact fields written: none (document deletion); file/provider operations: none.
- External integrations: none. Frontend/external consumers: MenuService. Status: active.

### 86. `GET /api/menu/:id`
- Registration: `backend/src/routes/menu.routes.ts:25`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → getMenuItemById`.
- Handler: `backend/src/controllers/menu.controller.ts:372-393` — `getMenuItemById`. Auth/capability: public.
- Inputs: path params id; query none; body none. Validation: path `id` required and must identify an existing MenuItem (`menu.controller.ts:372-382`).
- Response: status 200; shape keys success, data, timestamp. Models/files/providers: reads MenuItem with `findById`; writes none; exact fields written: none; file/provider operations: none.
- External integrations: none. Frontend/external consumers: MenuService. Status: active.

### 87. `PUT /api/menu/:id`
- Registration: `backend/src/routes/menu.routes.ts:31`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireAdmin → updateMenuItem`.
- Handler: `backend/src/controllers/menu.controller.ts:529-629` — `updateMenuItem`. Auth/capability: authenticated site User with exact role admin.
- Inputs: path params id; query none; body price, pricingVariants, pricingOptions. Validation: path `id` required; scalar price positive when supplied; pricingVariants/pricingOptions must be arrays and each nonempty entry needs required labels/amounts and positive prices; target must exist (`menu.controller.ts:529-622`).
- Response: status 200; shape keys success, data, message, timestamp. Models/files/providers: reads none; writes MenuItem with `findByIdAndUpdate`; exact fields written: `$set` may contain strict-schema paths `name`, `category`, `description`, `price`, `pricePer100g`, `pricingVariants[].size|label|price|weight`, `pricingOptions[].label|price|amount`, `imageUrl`, `tags`, `isAvailable`, `isPopular`, `isFeatured`, `order`, `servingSize`, `recipe[].name|quantity|unit|category`; pricing precedence assigns JavaScript `undefined` to competing `price`, `pricingVariants`, or `pricingOptions` keys before update (`menu.controller.ts:529-614`; `models/menuItem.ts:105-183`); file/provider operations: none.
- External integrations: none. Frontend/external consumers: MenuService. Status: active.

### 88. `GET /api/menu/categories`
- Registration: `backend/src/routes/menu.routes.ts:22`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → getMenuCategories`.
- Handler: `backend/src/controllers/menu.controller.ts:452-477` — `getMenuCategories`. Auth/capability: public.
- Inputs: path params none; query none; body none. Validation: none.
- Response: status 200; shape keys success, data, count, timestamp. Models/files/providers: reads MenuItem with `distinct("category", filter)`; writes none; exact fields written: none; file/provider operations: none.
- External integrations: none. Frontend/external consumers: MenuService. Status: active.

### 89. `GET /api/menu/category/:category`
- Registration: `backend/src/routes/menu.routes.ts:23`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → getMenuItemsByCategory`.
- Handler: `backend/src/controllers/menu.controller.ts:393-418` — `getMenuItemsByCategory`. Auth/capability: public.
- Inputs: path params category; query none; body none. Validation: path `category` is required (`menu.controller.ts:393-397`).
- Response: status 200; shape keys success, data, category, count, timestamp. Models/files/providers: reads MenuItem with `find` by category and availability/archive filters; writes none; exact fields written: none; file/provider operations: none.
- External integrations: none. Frontend/external consumers: MenuService. Status: active.

### 90. `GET /api/menu/featured`
- Registration: `backend/src/routes/menu.routes.ts:21`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → getFeaturedMenuItems`.
- Handler: `backend/src/controllers/menu.controller.ts:436-452` — `getFeaturedMenuItems`. Auth/capability: public.
- Inputs: path params none; query none; body none. Validation: none.
- Response: status 200; shape keys success, data, count, timestamp. Models/files/providers: reads MenuItem with `find` on featured/available/non-archived filters; writes none; exact fields written: none; file/provider operations: none.
- External integrations: none. Frontend/external consumers: MenuService. Status: active.

### 91. `POST /api/menu/migrate-cholent-desserts-category`
- Registration: `backend/src/routes/menu.routes.ts:29`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireAdmin → migrateCholentDessertsCategory`.
- Handler: `backend/src/controllers/menu.controller.ts:725-740` — `migrateCholentDessertsCategory`. Auth/capability: authenticated site User with exact role admin.
- Inputs: path params none; query none; body none. Validation: none.
- Response: status 200; shape keys success, message. Models/files/providers: reads none; writes MenuItem with `updateMany`; exact fields written: `category` from legacy cholent-dessert value to target category; file/provider operations: none.
- External integrations: none. Frontend/external consumers: MenuService. Status: active.

### 92. `GET /api/menu/popular`
- Registration: `backend/src/routes/menu.routes.ts:20`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → getPopularMenuItems`.
- Handler: `backend/src/controllers/menu.controller.ts:418-436` — `getPopularMenuItems`. Auth/capability: public.
- Inputs: path params none; query limit; body none. Validation: none.
- Response: status 200; shape keys success, data, count, timestamp. Models/files/providers: reads MenuItem with `find` on popular/available/non-archived filters; writes none; exact fields written: none; file/provider operations: none.
- External integrations: none. Frontend/external consumers: MenuService. Status: active.

### 93. `PUT /api/menu/reorder`
- Registration: `backend/src/routes/menu.routes.ts:30`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireAdmin → reorderMenuItems`.
- Handler: `backend/src/controllers/menu.controller.ts:650-670` — `reorderMenuItems`. Auth/capability: authenticated site User with exact role admin.
- Inputs: path params none; query none; body length, map. Validation: body `items` must be a nonempty array; each entry supplies an id used for ordered bulk updates (`menu.controller.ts:650-665`).
- Response: status 200; shape keys success, message, timestamp. Models/files/providers: reads none; writes MenuItem `bulkWrite` update operations; exact fields written: `$set.order` only; each request `id` is used solely as selector `filter._id` and `_id` is not written (`menu.controller.ts:649-661`); file/provider operations: none.
- External integrations: none. Frontend/external consumers: MenuService. Status: active.

### 94. `GET /api/menu/stats`
- Registration: `backend/src/routes/menu.routes.ts:24`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → getMenuStatistics`.
- Handler: `backend/src/controllers/menu.controller.ts:670-725` — `getMenuStatistics`. Auth/capability: public.
- Inputs: path params none; query none; body none. Validation: none.
- Response: status 200; shape keys success, data, timestamp. Models/files/providers: reads MenuItem with `countDocuments`, `distinct`, and `find`; writes none; exact fields written: none; file/provider operations: none.
- External integrations: none. Frontend/external consumers: MenuService. Status: active.

### 95. `GET /api/order`
- Registration: `backend/src/routes/order.routes.ts:96`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireCapability(CAP.ORDERS_LIST) → getAllOrders`.
- Handler: `backend/src/controllers/order.controller.ts:384-516` — `getAllOrders`; called-service evidence: backend/src/services/order.service.ts:240-296 `getAllOrders`, backend/src/services/order.service.ts:486-579 `getAdminOrdersPage`. Auth/capability: authenticated site User with capability orders:list; admin always, driver only for deliveries:my:*.
- Inputs: path params none; query status, limit, offset, startDate, endDate, archive, paymentFilter, page, source, statusTab, search, dateFrom, dateTo, orderNumberSearch, customerSearch, createdFrom, createdTo, eventFrom, eventTo, sortBy, sortDir, hasCustomerNotes, hasAdminNotes; body none. Validation: none.
- Response: status 200; shape keys success, data, pagination, page, limit, total, totalPages, offset, hasMore. Models/files/providers: reads Order with `countDocuments` and `find`; writes none; exact fields written: none; file/provider operations: none.
- External integrations: none. Frontend/external consumers: OrderService / AdminOrders / Dashboard. Status: active.

### 96. `DELETE /api/order/:id`
- Registration: `backend/src/routes/order.routes.ts:145`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireAdmin → deleteOrder`.
- Handler: `backend/src/controllers/order.controller.ts:825-846` — `deleteOrder`; called-service evidence: backend/src/services/order.service.ts:1324-1341 `deleteOrder`. Auth/capability: authenticated site User with exact role admin.
- Inputs: path params id; query none; body none. Validation: path `id` required and must identify a nondeleted Order (`order.controller.ts:825-838`).
- Response: status 200; shape keys success, message, timestamp. Models/files/providers: reads none; writes Order with `findByIdAndUpdate`; exact fields written: `isDeleted=true`; file/provider operations: none.
- External integrations: none. Frontend/external consumers: OrderService / AdminOrders / Dashboard. Status: active.

### 97. `GET /api/order/:id`
- Registration: `backend/src/routes/order.routes.ts:132`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → getOrderById`.
- Handler: `backend/src/controllers/order.controller.ts:516-552` — `getOrderById`; called-service evidence: backend/src/services/order.service.ts:625-646 `getOrderById`, backend/src/services/order.service.ts:646-658 `getOrderByIdForAdmin`, backend/src/services/order.service.ts:658-677 `getOrderByIdForDriver`. Auth/capability: any active authenticated User or Employee JWT; handler may further ownership-check.
- Inputs: path params id; query none; body none. Validation: path `id` required; authenticated user identity required; admin can read any order, driver only assigned order, other user only owned order; target must exist (`order.controller.ts:516-545`).
- Response: status 401, 200; shape keys success, message, data, timestamp. Models/files/providers: reads Order with ownership-scoped/admin/driver `findOne`; writes none; exact fields written: none; file/provider operations: none.
- External integrations: none. Frontend/external consumers: OrderService / AdminOrders / Dashboard. Status: active.

### 98. `PATCH /api/order/:id/assign-driver`
- Registration: `backend/src/routes/order.routes.ts:128`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireAdmin → assignOrderToDriver`.
- Handler: `backend/src/controllers/order.controller.ts:1065-1085` — `assignOrderToDriver`; called-service evidence: backend/src/services/order.service.ts:776-801 `assignOrderToDriver`. Auth/capability: authenticated site User with exact role admin.
- Inputs: path params id; query none; body driverId. Validation: path `id` required; when `driverId` supplied it must identify an active User with role driver; target Order must exist (`order.controller.ts:1065-1078`; `order.service.ts:776-801`).
- Response: status 200; shape keys success, data. Models/files/providers: reads User with `findById`; Order with `findByIdAndUpdate`; writes Order `findByIdAndUpdate`; exact fields written: assignment sets `assignedDriverId`, `assignedDriverName`, `assignedAt`; clearing sets `assignedDriverId=null`, `assignedDriverName=""`, `assignedAt=null`; file/provider operations: none.
- External integrations: none. Frontend/external consumers: OrderService / AdminOrders / Dashboard. Status: active.

### 99. `PATCH /api/order/:id/date`
- Registration: `backend/src/routes/order.routes.ts:139`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireCapability(CAP.ORDERS_DATE_WRITE) → updateOrderDate`.
- Handler: `backend/src/controllers/order.controller.ts:621-656` — `updateOrderDate`; called-service evidence: backend/src/services/order.service.ts:1185-1208 `updateOrderEventDate`. Auth/capability: authenticated site User with capability orders:date_write; admin always, driver only for deliveries:my:*.
- Inputs: path params id; query none; body eventDate, newDate. Validation: path `id` and nonblank `eventDate|newDate` required; date must parse; target Order must exist (`order.controller.ts:621-633`; `order.service.ts:1185-1208`).
- Response: status 200; shape keys success, data, message, timestamp. Models/files/providers: reads Order with `findById` after update; writes Order with `updateOne`; exact fields written: `customerDetails.eventDate`; file/provider operations: none.
- External integrations: none. Frontend/external consumers: OrderService / AdminOrders / Dashboard. Status: active.

### 100. `PUT /api/order/:id/date`
- Registration: `backend/src/routes/order.routes.ts:140`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireCapability(CAP.ORDERS_DATE_WRITE) → updateOrderDate`.
- Handler: `backend/src/controllers/order.controller.ts:621-656` — `updateOrderDate`; called-service evidence: backend/src/services/order.service.ts:1185-1208 `updateOrderEventDate`. Auth/capability: authenticated site User with capability orders:date_write; admin always, driver only for deliveries:my:*.
- Inputs: path params id; query none; body eventDate, newDate. Validation: path `id` and nonblank `eventDate|newDate` required; date must parse; target Order must exist (`order.controller.ts:621-633`; `order.service.ts:1185-1208`).
- Response: status 200; shape keys success, data, message, timestamp. Models/files/providers: reads Order with `findById` after update; writes Order with `updateOne`; exact fields written: `customerDetails.eventDate`; file/provider operations: none.
- External integrations: none. Frontend/external consumers: OrderService / AdminOrders / Dashboard. Status: active.

### 101. `DELETE /api/order/:id/permanent`
- Registration: `backend/src/routes/order.routes.ts:136`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireAdmin → permanentDeleteOrder`.
- Handler: `backend/src/controllers/order.controller.ts:868-889` — `permanentDeleteOrder`; called-service evidence: backend/src/services/order.service.ts:1358-1368 `permanentDeleteOrder`. Auth/capability: authenticated site User with exact role admin.
- Inputs: path params id; query none; body none. Validation: path `id` required and must identify an Order (`order.controller.ts:868-880`).
- Response: status 200; shape keys success, message, timestamp. Models/files/providers: reads none; writes Order with `findByIdAndDelete`; exact fields written: none (document deletion); file/provider operations: none.
- External integrations: none. Frontend/external consumers: OrderService / AdminOrders / Dashboard. Status: active.

### 102. `PUT /api/order/:id/restore`
- Registration: `backend/src/routes/order.routes.ts:135`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireAdmin → restoreOrder`.
- Handler: `backend/src/controllers/order.controller.ts:846-868` — `restoreOrder`; called-service evidence: backend/src/services/order.service.ts:1341-1358 `restoreOrder`. Auth/capability: authenticated site User with exact role admin.
- Inputs: path params id; query none; body none. Validation: path `id` required and must identify an archived Order (`order.controller.ts:846-858`).
- Response: status 200; shape keys success, data, message, timestamp. Models/files/providers: reads none; writes Order with `findByIdAndUpdate`; exact fields written: `isDeleted=false`; file/provider operations: none.
- External integrations: none. Frontend/external consumers: OrderService / AdminOrders / Dashboard. Status: active.

### 103. `PATCH /api/order/:id/shipping-cost`
- Registration: `backend/src/routes/order.routes.ts:144`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireAdmin → updateOrderShippingCost`.
- Handler: `backend/src/controllers/order.controller.ts:697-727` — `updateOrderShippingCost`; called-service evidence: backend/src/services/order.service.ts:1057-1116 `updateOrderShippingCost`. Auth/capability: authenticated site User with exact role admin.
- Inputs: path params id; query none; body shippingCost. Validation: path `id` required; shippingCost must be a finite nonnegative number; only supported order types are recalculated; target must exist (`order.controller.ts:697-712`; `order.service.ts:1057-1116`).
- Response: status 200; shape keys success, data, message, timestamp. Models/files/providers: reads Order with `findById` before and after update; writes Order with `updateOne`; exact fields written: `deliveryFee`, recalculated `subtotal`, recalculated `totalPrice`; file/provider operations: none.
- External integrations: none. Frontend/external consumers: OrderService / AdminOrders / Dashboard. Status: active.

### 104. `PATCH /api/order/:id/status`
- Registration: `backend/src/routes/order.routes.ts:138`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireCapability(CAP.DELIVERIES_MY_UPDATE_STATUS) → updateOrderStatus`.
- Handler: `backend/src/controllers/order.controller.ts:552-621` — `updateOrderStatus`; called-service evidence: backend/src/services/order.service.ts:1116-1122 `getOrderByIdForEmail`, backend/src/services/order.service.ts:706-732 `updateOrderStatus`, backend/src/services/order.service.ts:732-755 `updateOrderStatusForDriver`, backend/src/services/email.service.ts:539-597 `sendOrderApprovedToCustomer`. Auth/capability: authenticated site User with capability deliveries:my:update_status; admin always, driver only for deliveries:my:*.
- Inputs: path params id; query none; body status, deliveryDate, notes. Validation: path `id` and status required; status must be allowed; driver is restricted to driver-allowed statuses and assigned ownership; target must exist (`order.controller.ts:552-588`; `order.service.ts:706-755`).
- Response: status 200; shape keys success, data, message, timestamp. Models/files/providers: reads Order with `findById` for email; target Order lookup/update; writes Order with `findByIdAndUpdate` for admin or ownership-scoped `findOneAndUpdate` for driver; exact fields written: declared root `status`; `customerDetails.notes` under declared unconstrained Object `customerDetails`; admin service also attempts undeclared runtime root `deliveryDate`, but Order schema declares no `deliveryDate` and `strict:true` update behavior may strip it or reject it rather than persist it; driver service writes only `status` and uses `assignedDriverId` solely in the ownership filter (`order.service.ts:706-750`; `models/Order.ts:111-219`); file/provider operations: approval email through email.service only when status becomes `processing`.
- External integrations: approval email through email.service only when status becomes `processing`. Frontend/external consumers: OrderService / AdminOrders / Dashboard. Status: active.

### 105. `PUT /api/order/:id/status`
- Registration: `backend/src/routes/order.routes.ts:137`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireCapability(CAP.DELIVERIES_MY_UPDATE_STATUS) → updateOrderStatus`.
- Handler: `backend/src/controllers/order.controller.ts:552-621` — `updateOrderStatus`; called-service evidence: backend/src/services/order.service.ts:1116-1122 `getOrderByIdForEmail`, backend/src/services/order.service.ts:706-732 `updateOrderStatus`, backend/src/services/order.service.ts:732-755 `updateOrderStatusForDriver`, backend/src/services/email.service.ts:539-597 `sendOrderApprovedToCustomer`. Auth/capability: authenticated site User with capability deliveries:my:update_status; admin always, driver only for deliveries:my:*.
- Inputs: path params id; query none; body status, deliveryDate, notes. Validation: path `id` and status required; status must be allowed; driver is restricted to driver-allowed statuses and assigned ownership; target must exist (`order.controller.ts:552-588`; `order.service.ts:706-755`).
- Response: status 200; shape keys success, data, message, timestamp. Models/files/providers: reads Order with `findById` for email; target Order lookup/update; writes Order with `findByIdAndUpdate` for admin or ownership-scoped `findOneAndUpdate` for driver; exact fields written: declared root `status`; `customerDetails.notes` under declared unconstrained Object `customerDetails`; admin service also attempts undeclared runtime root `deliveryDate`, but Order schema declares no `deliveryDate` and `strict:true` update behavior may strip it or reject it rather than persist it; driver service writes only `status` and uses `assignedDriverId` solely in the ownership filter (`order.service.ts:706-750`; `models/Order.ts:111-219`); file/provider operations: approval email through email.service only when status becomes `processing`.
- External integrations: approval email through email.service only when status becomes `processing`. Frontend/external consumers: OrderService / AdminOrders / Dashboard. Status: active.

### 106. `PATCH /api/order/admin/:id/admin-notes`
- Registration: `backend/src/routes/order.routes.ts:143`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireAdmin → updateOrderAdminNotes`.
- Handler: `backend/src/controllers/order.controller.ts:755-780` — `updateOrderAdminNotes`; called-service evidence: backend/src/services/order.service.ts:1171-1185 `updateOrderAdminNotes`. Auth/capability: authenticated site User with exact role admin.
- Inputs: path params id; query none; body adminNotes. Validation: path `id` required; adminNotes must pass notes payload validator; target must exist (`order.controller.ts:755-765`; `order.service.ts:1171-1185`).
- Response: status 200; shape keys success, data, message, timestamp. Models/files/providers: reads Order with `findById` after update; writes Order with `updateOne`; exact fields written: `adminNotes`; file/provider operations: none.
- External integrations: none. Frontend/external consumers: OrderService / AdminOrders / Dashboard. Status: active.

### 107. `PUT /api/order/admin/:id/items`
- Registration: `backend/src/routes/order.routes.ts:141`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireAdmin → updateOrderItems`.
- Handler: `backend/src/controllers/order.controller.ts:656-697` — `updateOrderItems`; called-service evidence: backend/src/services/order.service.ts:801-1057 `updateOrderItems`, backend/src/services/email.service.ts:404-465 `sendOrderUpdateEmail`. Auth/capability: authenticated site User with exact role admin.
- Inputs: path params id; query none; body items, length. Validation: path `id` required; items must be nonempty array; each item needs resolvable product id/name, positive finite quantity, and server-resolved nonnegative price; target must exist (`order.controller.ts:656-676`; `order.service.ts:801-1057`).
- Response: status 200; shape keys success, data, message, timestamp. Models/files/providers: reads MenuItem with `findOne`/`findById`; HolidayEvent with `findById` for holiday products; Order with `findById` before/after update; writes Order with `updateOne`; exact fields written: root `items`, `subtotal`, `totalPrice`; each `items[]` entry writes `productId`, `name`, `price`, `quantity`, `category`, optional `selectedOption.label|amount|price`, `imageUrl`, `description`; `deliveryFee` is read for calculation but not written by this endpoint (`order.service.ts:801-1050`; `models/Order.ts:115-128`); file/provider operations: order-update email through email.service.
- External integrations: order-update email through email.service. Frontend/external consumers: OrderService / AdminOrders / Dashboard. Status: active.

### 108. `PATCH /api/order/admin/:id/portions`
- Registration: `backend/src/routes/order.routes.ts:142`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireAdmin → updateOrderPortions`.
- Handler: `backend/src/controllers/order.controller.ts:727-755` — `updateOrderPortions`; called-service evidence: backend/src/services/order.service.ts:1122-1171 `updateOrderPortions`. Auth/capability: authenticated site User with exact role admin.
- Inputs: path params id; query none; body portionsEvening, portionsMorning. Validation: path `id` required; target must be non-event catering; supplied portions must be nonnegative integers and leave a positive applicable total (`order.controller.ts:727-740`; `order.service.ts:1122-1171`).
- Response: status 200; shape keys success, data, message, timestamp. Models/files/providers: reads Order with `findById` before/after update; writes Order with `updateOne`; exact fields written: validated `portionsEvening` and/or `portionsMorning`; file/provider operations: none.
- External integrations: none. Frontend/external consumers: OrderService / AdminOrders / Dashboard. Status: active.

### 109. `GET /api/order/admin/tab-counts`
- Registration: `backend/src/routes/order.routes.ts:121-126`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireCapability(CAP.ORDERS_LIST) → getAdminTabCounts`.
- Handler: `backend/src/controllers/order.controller.ts:790-800` — `getAdminTabCounts`; called-service evidence: backend/src/services/order.service.ts:579-625 `getAdminTabCounts`. Auth/capability: authenticated site User with capability orders:list; admin always, driver only for deliveries:my:*.
- Inputs: path params none; query none; body none. Validation: none.
- Response: status 200; shape keys success, data, timestamp. Models/files/providers: reads Order with `countDocuments`; writes none; exact fields written: none; file/provider operations: none.
- External integrations: none. Frontend/external consumers: OrderService / AdminOrders / Dashboard. Status: active.

### 110. `GET /api/order/analytics/monthly-revenue`
- Registration: `backend/src/routes/order.routes.ts:103-108`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireCapability(CAP.ORDERS_ANALYTICS) → getMonthlyRevenue`.
- Handler: `backend/src/controllers/order.controller.ts:975-996` — `getMonthlyRevenue`; called-service evidence: backend/src/services/order.service.ts:1573-1622 `getMonthlyRevenue`. Auth/capability: authenticated site User with capability orders:analytics; admin always, driver only for deliveries:my:*.
- Inputs: path params none; query from, to, includeArchived; body none. Validation: none.
- Response: status 200; shape keys success, timestamp. Models/files/providers: reads Order with `aggregate`; writes none; exact fields written: none; file/provider operations: none.
- External integrations: none. Frontend/external consumers: OrderService / AdminOrders / Dashboard. Status: active.

### 111. `GET /api/order/analytics/revenue-by-source`
- Registration: `backend/src/routes/order.routes.ts:97-102`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireCapability(CAP.ORDERS_ANALYTICS) → getRevenueBySource`.
- Handler: `backend/src/controllers/order.controller.ts:954-975` — `getRevenueBySource`; called-service evidence: backend/src/services/order.service.ts:1508-1573 `getRevenueBySource`. Auth/capability: authenticated site User with capability orders:analytics; admin always, driver only for deliveries:my:*.
- Inputs: path params none; query from, to, includeArchived; body none. Validation: none.
- Response: status 200; shape keys success, timestamp. Models/files/providers: reads Order with `aggregate`; writes none; exact fields written: none; file/provider operations: none.
- External integrations: none. Frontend/external consumers: OrderService / AdminOrders / Dashboard. Status: active.

### 112. `POST /api/order/bulk`
- Registration: `backend/src/routes/order.routes.ts:129`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireAdmin → bulkUpdateOrders`.
- Handler: `backend/src/controllers/order.controller.ts:907-944` — `bulkUpdateOrders`; called-service evidence: backend/src/services/order.service.ts:1368-1444 `bulkApplyAction`. Auth/capability: authenticated site User with exact role admin.
- Inputs: path params none; query none; body action, status, orderIds. Validation: action required and enum `status|archive|restore|delete`; orderIds nonempty/valid; status action requires an allowed status (`order.controller.ts:907-926`; `order.service.ts:1368-1444`).
- Response: status 200; shape keys success, data, message, timestamp. Models/files/providers: reads none; writes Order with `updateMany` or `deleteMany` according to action; exact fields written: status action: `status`; archive: `isDeleted=true`; restore: `isDeleted=false`; delete: none (document deletion); file/provider operations: none.
- External integrations: none. Frontend/external consumers: OrderService / AdminOrders / Dashboard. Status: active.

### 113. `POST /api/order/checkout`
- Registration: `backend/src/routes/order.routes.ts:89`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → checkoutLimiter → optionalAuthenticate → submitOrder`.
- Handler: `backend/src/controllers/order.controller.ts:260-348` — `submitOrder`; called-service evidence: backend/src/services/order.service.ts:83-164 `submitOrder`, backend/src/services/order.service.ts:68-78 `validateEventDateOpen`. Auth/capability: public; optional cookie/Bearer JWT enriches req.user.
- Inputs: path params none; query none; body `customerName`, `phone`, optional `email`, `items[]` with `id`, `name`, `quantity`, `price`, optional `category`, optional `imageUrl` or `image`; optional `notes`, `deliveryAddress`, `preferredDeliveryTime`, `eventDate`, `eventType`, `guestCount`. Validation: customerName/phone/nonempty items required; phone format and optional email format; each item needs id/name and positive numeric quantity/price; guestCount positive if supplied; eventDate must satisfy open-date rules (`order.controller.ts:260-337`; `order.service.ts:83-141`; `order.model.ts:27-38`).
- Response: status 201; shape keys success, data, message, timestamp. Models/files/providers: reads StoreSettings with `findOne`; writes new Order document `save` and Customer with `updateOne`; exact fields written: Order root `userId`, generated `orderNumber`, `customerDetails`, `items`, calculated `totalPrice`, `status="new"`, plus timestamps; `customerDetails` is declared unconstrained Object and receives `fullName`, `phone`, `email`, `address`, `notes`, `preferredDeliveryTime`, `eventDate`, `eventType`, `guestCount`; declared `items[]` writes `productId`, `name`, `price`, `quantity`, `category`, optional `imageUrl`—there are no root `quantity` or `price` writes. Customer upsert may write `$set.fullName|email|city`, `$setOnInsert.normalizedPhone|manualStatus|customerCategory|tags|adminNotes|dietaryInfo|city`, `$max.lastOrderDate`, `$addToSet.orderHistory`, `$inc.totalSpent`, `$inc.orderCount` (`order.service.ts:83-141`; `models/Order.ts:97-128`; `customer.service.ts:100-182`); file/provider operations: sends order email through email.service.
- External integrations: `emailService.sendOrderEmail(savedOrder)` sends the owner notification after save; email failure is logged and does not roll back the Order. Frontend/external consumers: OrderService.submitOrder, CartService.sendOrder. Status: active.

### 114. `GET /api/order/dashboard-stats`
- Registration: `backend/src/routes/order.routes.ts:120`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireCapability(CAP.ORDERS_DASHBOARD_STATS) → getDashboardStats`.
- Handler: `backend/src/controllers/order.controller.ts:780-790` — `getDashboardStats`; called-service evidence: backend/src/services/order.service.ts:1208-1239 `getDashboardStats`. Auth/capability: authenticated site User with capability orders:dashboard_stats; admin always, driver only for deliveries:my:*.
- Inputs: path params none; query none; body none. Validation: none.
- Response: status 200; shape keys success, data, timestamp. Models/files/providers: reads Order with `countDocuments` and `aggregate`; writes none; exact fields written: none; file/provider operations: none.
- External integrations: none. Frontend/external consumers: OrderService / AdminOrders / Dashboard. Status: active.

### 115. `GET /api/order/delivery-report`
- Registration: `backend/src/routes/order.routes.ts:117`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireCapability(CAP.DELIVERIES_MY_LIST) → getDeliveryReport`.
- Handler: `backend/src/controllers/order.controller.ts:1021-1052` — `getDeliveryReport`; called-service evidence: backend/src/services/order.service.ts:2210-2241 `getDeliveryReport`. Auth/capability: authenticated site User with capability deliveries:my:list; admin always, driver only for deliveries:my:*.
- Inputs: path params none; query fromDate, toDate, date; body none. Validation: none.
- Response: status 200, 500; shape keys success, data, message, error, stack. Models/files/providers: reads Order through delivery-report query helper; writes none; exact fields written: none; file/provider operations: none.
- External integrations: none. Frontend/external consumers: OrderService / AdminOrders / Dashboard. Status: active.

### 116. `GET /api/order/driver/my`
- Registration: `backend/src/routes/order.routes.ts:127`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireCapability(CAP.DELIVERIES_MY_LIST) → getDriverMyOrders`.
- Handler: `backend/src/controllers/order.controller.ts:1052-1065` — `getDriverMyOrders`; called-service evidence: backend/src/services/order.service.ts:755-776 `getDriverAssignedOrders`. Auth/capability: authenticated site User with capability deliveries:my:list; admin always, driver only for deliveries:my:*.
- Inputs: path params none; query fromDate, toDate, limit; body none. Validation: authenticated driver id is required; optional date range limits owned assignments (`order.controller.ts:1052-1056`; `order.service.ts:755-776`).
- Response: status 200; shape keys success. Models/files/providers: reads Order with `find` constrained to authenticated driver assignment and optional dates; writes none; exact fields written: none; file/provider operations: none.
- External integrations: none. Frontend/external consumers: OrderService / AdminOrders / Dashboard. Status: active.

### 117. `GET /api/order/kitchen-report`
- Registration: `backend/src/routes/order.routes.ts:116`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireAdmin → getKitchenReport`.
- Handler: `backend/src/controllers/order.controller.ts:996-1021` — `getKitchenReport`; called-service evidence: backend/src/services/order.service.ts:1622-2044 `getKitchenReport`. Auth/capability: authenticated site User with exact role admin.
- Inputs: path params none; query date, includeCatering; body none. Validation: none.
- Response: status 200, 500; shape keys success, data, meta, message, error, stack. Models/files/providers: reads Order with `countDocuments` and `aggregate`; writes none; exact fields written: none; file/provider operations: none.
- External integrations: none. Frontend/external consumers: OrderService / AdminOrders / Dashboard. Status: active.

### 118. `GET /api/order/my-orders`
- Registration: `backend/src/routes/order.routes.ts:93`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → getMyOrders`.
- Handler: `backend/src/controllers/order.controller.ts:348-384` — `getMyOrders`; called-service evidence: backend/src/services/order.service.ts:224-240 `getOrdersByUserId`. Auth/capability: any active authenticated User or Employee JWT; handler may further ownership-check.
- Inputs: path params none; query none; body none. Validation: authenticated user id is required; ownership is enforced by `find({userId})` (`order.controller.ts:348-357`; `order.service.ts:224-240`).
- Response: status 200; shape keys success, data, count, timestamp. Models/files/providers: reads Order with `find({userId})`; writes none; exact fields written: none; file/provider operations: none.
- External integrations: none. Frontend/external consumers: OrderService / AdminOrders / Dashboard. Status: active.

### 119. `GET /api/order/recent`
- Registration: `backend/src/routes/order.routes.ts:118`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireCapability(CAP.ORDERS_RECENT) → getRecentOrders`.
- Handler: `backend/src/controllers/order.controller.ts:812-825` — `getRecentOrders`; called-service evidence: backend/src/services/order.service.ts:1307-1324 `getRecentOrders`. Auth/capability: authenticated site User with capability orders:recent; admin always, driver only for deliveries:my:*.
- Inputs: path params none; query limit; body none. Validation: none.
- Response: status 200; shape keys success, data, count, timestamp. Models/files/providers: reads Order with `find`; writes none; exact fields written: none; file/provider operations: none.
- External integrations: none. Frontend/external consumers: OrderService / AdminOrders / Dashboard. Status: active.

### 120. `GET /api/order/search`
- Registration: `backend/src/routes/order.routes.ts:119`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireCapability(CAP.ORDERS_SEARCH) → searchOrders`.
- Handler: `backend/src/controllers/order.controller.ts:889-907` — `searchOrders`; called-service evidence: backend/src/services/order.service.ts:1444-1465 `searchOrders`. Auth/capability: authenticated site User with capability orders:search; admin always, driver only for deliveries:my:*.
- Inputs: path params none; query q; body none. Validation: query `q` is required and must be a string; service escapes it for search (`order.controller.ts:889-893`; `order.service.ts:1444-1465`).
- Response: status 200; shape keys success, data, count, query, timestamp. Models/files/providers: reads Order with `find` using escaped search expression; writes none; exact fields written: none; file/provider operations: none.
- External integrations: none. Frontend/external consumers: OrderService / AdminOrders / Dashboard. Status: active.

### 121. `POST /api/order/send`
- Registration: `backend/src/routes/order.routes.ts:90`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → checkoutLimiter → sendOrder`.
- Handler: `backend/src/controllers/order.controller.ts:93-167` — `sendOrder`; called-service evidence: backend/src/services/email.service.ts:310-369 `sendOrderEmails`. Auth/capability: public.
- Inputs: path params none; query none; body customerName, phone, deliveryType, address, items, total, customerEmail. Validation: customerName/phone required; deliveryType enum pickup/delivery; delivery address required for delivery; items nonempty with name/quantity/price; total nonnegative; optional customerEmail valid (`order.controller.ts:93-122`).
- Response: status 503, 200; shape keys success, message, timestamp, error. Models/files/providers: reads none; writes none; exact fields written: none; file/provider operations: sends order emails through email.service.
- External integrations: sends order emails through email.service. Frontend/external consumers: CartModalComponent. Status: active.

### 122. `GET /api/order/stats`
- Registration: `backend/src/routes/order.routes.ts:109`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireCapability(CAP.ORDERS_STATS) → getOrderStatistics`.
- Handler: `backend/src/controllers/order.controller.ts:800-812` — `getOrderStatistics`; called-service evidence: backend/src/services/order.service.ts:1239-1307 `getOrderStatistics`. Auth/capability: authenticated site User with capability orders:stats; admin always, driver only for deliveries:my:*.
- Inputs: path params none; query period; body none. Validation: none.
- Response: status 200; shape keys success, data, timestamp. Models/files/providers: reads Order with `countDocuments` and `aggregate`; writes none; exact fields written: none; file/provider operations: none.
- External integrations: none. Frontend/external consumers: OrderService / AdminOrders / Dashboard. Status: active.

### 123. `GET /api/order/stats/revenue`
- Registration: `backend/src/routes/order.routes.ts:110-115`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireCapability(CAP.ORDERS_STATS_REVENUE) → getRevenueStats`.
- Handler: `backend/src/controllers/order.controller.ts:944-954` — `getRevenueStats`; called-service evidence: backend/src/services/order.service.ts:1465-1508 `getRevenueStats`. Auth/capability: authenticated site User with capability orders:stats_revenue; admin always, driver only for deliveries:my:*.
- Inputs: path params none; query none; body none. Validation: none.
- Response: status 200; shape keys success, data. Models/files/providers: reads Order with `aggregate`; writes none; exact fields written: none; file/provider operations: none.
- External integrations: none. Frontend/external consumers: OrderService / AdminOrders / Dashboard. Status: active.

### 124. `POST /api/orders`
- Registration: `backend/src/routes/orders.routes.ts:64`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → placeOrderLimiter → optionalAuthenticate → createOrder`.
- Handler: `backend/src/controllers/order.controller.ts:167-260` — `createOrder`; called-service evidence: backend/src/services/order.service.ts:164-224 `createOrderFromCheckout`, backend/src/services/order.service.ts:68-78 `validateEventDateOpen`, backend/src/services/email.service.ts:465-539 `sendOrderEmail`, backend/src/services/coupon.service.ts:93-201 `validateAndApplyCoupon`. Auth/capability: public; optional cookie/Bearer JWT enriches req.user.
- Inputs: path params none; query none; body customerName, phone, deliveryMethod, address, items, subtotal, deliveryFee, totalAmount, email, eventDate, manualOrder, couponCode. Validation: customerName/phone required; deliveryMethod enum; address required for delivery; items nonempty; subtotal/deliveryFee/totalAmount nonnegative; optional email valid; nonmanual eventDate must be open; coupon must satisfy coupon prerequisites (`order.controller.ts:167-218`; directly called services).
- Response: status 201; shape keys success, orderId, orderNumber, order, message. Models/files/providers: reads StoreSettings with `findOne`; Coupon with `findOne`; conditionally Customer with `findOne`; writes new Order document `save`, Customer with `updateOne`, and Coupon with two `updateOne` calls after a coupon-backed save; exact fields written: Order root `userId`, generated `orderNumber`, `customerDetails`, `items`, `totalPrice`, `subtotal`, `deliveryFee`, `status` (`processing` for manual, otherwise `pending`), optional declared `marketingData.utm_source|utm_medium|utm_campaign|utm_term|utm_content`, plus timestamps; `customerDetails` is declared unconstrained Object and receives `fullName` from input `customerName`, `phone`, `email`, string `address`, `deliveryMethod`, `eventDate`, `deliveryFee`, `subtotal`, `notes`, and manual-only `isPaid`; declared `items[]` receives `productId`, `name`, `price`, `quantity`, `category`, optional `imageUrl`; inputs `customerName`, `phone`, `deliveryMethod` are not Order root paths. Customer upsert may write `$set.fullName|email|city`, `$setOnInsert.normalizedPhone|manualStatus|customerCategory|tags|adminNotes|dietaryInfo|city`, `$max.lastOrderDate`, `$addToSet.orderHistory`, `$inc.totalSpent`, `$inc.orderCount`. Coupon side effects write `$inc.usageCount`, optional `$push.usedByPhones`, and `$inc.totalRevenueGenerated` (`order.controller.ts:209-235`; `order.service.ts:163-220`; `customer.service.ts:100-182`; `coupon.service.ts:201-248`); file/provider operations: fires configured n8n order webhook and sends email only for manual orders.
- External integrations: sends order email through email.service. Frontend/external consumers: CheckoutPageComponent, OrderService.createManualOrder. Status: active.

### 125. `GET /api/orders/myorders`
- Registration: `backend/src/routes/orders.routes.ts:68-88`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → orders.routes.ts anonymous GET /myorders callback (lines 68-88)`.
- Handler: `backend/src/routes/orders.routes.ts:68-88` — `orders.routes.ts anonymous GET /myorders callback (lines 68-88)`. Auth/capability: any active authenticated User or Employee JWT; handler may further ownership-check.
- Inputs: path params none; query none; body none. Validation: authenticated `userId` is required and passed to `OrderService.getOrdersByUserId`; results are ownership-filtered by `Order.find({userId})` (`orders.routes.ts:68-86`; `order.service.ts:223-236`).
- Response: status 401, 200(default); shape keys message. Models/files/providers: reads Order with `find({userId})`; for each missing item image, `enrichOrderItemsImageUrlPublic` reads HolidayEvent with `findById` for holiday-product IDs or MenuItem with `findById` and fallback `findOne` for ordinary product IDs; writes none (image URL enrichment mutates only the in-memory response objects) (`orders.routes.ts:79-85`; `order.service.ts:676-702`; `holiday-order.utils.ts:34-60`); exact fields written: none; file/provider operations: none.
- External integrations: none. Frontend/external consumers: OrderService.getMyOrders. Status: active.

### 126. `POST /api/payment/capture/:orderId`
- Registration: `backend/src/routes/payment.routes.ts:32`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireAdmin → capturePayment`.
- Handler: `backend/src/controllers/payment.controller.ts:383-481` — `capturePayment`; called-service evidence: backend/src/services/tranzila.service.ts:259-378 `capturePayment`. Auth/capability: authenticated site User with exact role admin.
- Inputs: path params orderId; query none; body none. Validation: orderId required; Order must exist with paymentStatus authorized and transactionId; repeated captured status is idempotent; gateway must be configured/succeed (`payment.controller.ts:383-481`).
- Response: status 200, 502; shape keys success, alreadyCaptured, message, captureRef, gateway. Models/files/providers: reads Order with `findById`; writes Order with `findByIdAndUpdate`; exact fields written: success sets `paymentStatus="captured"` and `status="processing"`; provider-declared failure sets `paymentStatus="failed"`; file/provider operations: calls `tranzilaService.capturePayment` with transaction reference, amount, authorization/card token/expiry, and order context.
- External integrations: Tranzila capture through `tranzilaService.capturePayment`. Frontend/external consumers: OrderService.capturePayment. Status: active.

### 127. `POST /api/payment/initiate/:orderId`
- Registration: `backend/src/routes/payment.routes.ts:22`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → initiatePreAuth`.
- Handler: `backend/src/controllers/payment.controller.ts:78-202` — `initiatePreAuth`; called-service evidence: backend/src/services/customer.service.ts:240-298 `upsertCustomerFromOrder`, backend/src/services/email.service.ts:369-390 `sendOrderConfirmationAfterPayment`. Auth/capability: public.
- Inputs: path params orderId; query none; body none. Validation: orderId required; Order must exist; current payment status controls idempotent/forbidden transitions; gateway configuration and order payment data prerequisites apply (`payment.controller.ts:78-202`).
- Response: status 200; shape keys success, alreadyInitiated, alreadyAuthorized, redirectUrl, message. Models/files/providers: reads Order with `findById`; writes Order with `findByIdAndUpdate`, Customer with `updateOne`, and Order with `findOneAndUpdate` in confirmation-email claiming; exact fields written: Order initiation sets `paymentStatus="awaiting_payment"`, `paymentSecurityToken`, `authorizedAmount`, `transactionId="ORD-<orderId>"`; mock authorization sets `paymentStatus="authorized"` and `transactionId="MOCK-<timestamp>"`; Customer upsert writes `$set.fullName`, `$set.email`, `$set.city`, `$set.lastOrderDate`, `$addToSet.orderHistory`, `$inc.totalSpent`, `$inc.orderCount`, with insertion-only `normalizedPhone`, `manualStatus`, `customerCategory`, `tags`, `adminNotes`, `dietaryInfo`; confirmation claim sets `confirmationEmailSentAt`; file/provider operations: generates a Tranzila authorization URL or mock redirect and sends confirmation email only on already-authorized/mock paths.
- External integrations: creates Tranzila pre-authorization redirect/session and may send confirmation email. Frontend/external consumers: CheckoutPageComponent. Status: active.

### 128. `GET /api/payment/status/:orderId`
- Registration: `backend/src/routes/payment.routes.ts:27`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → getPaymentStatus`.
- Handler: `backend/src/controllers/payment.controller.ts:523-554` — `getPaymentStatus`. Auth/capability: any active authenticated User or Employee JWT; handler may further ownership-check.
- Inputs: path params orderId; query none; body none. Validation: orderId required; authenticated user required; target Order must exist; nonadmin access requires order ownership (`payment.controller.ts:523-554`).
- Response: status 200; shape keys serialized service/model return value. Models/files/providers: reads Order with `findById`; writes none; exact fields written: none; file/provider operations: none.
- External integrations: none. Frontend/external consumers: OrderService.getPaymentStatus. Status: active.

### 129. `GET /api/payment/success`
- Registration: `backend/src/routes/payment.routes.ts:15`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → paymentSuccess`.
- Handler: `backend/src/controllers/payment.controller.ts:202-383` — `paymentSuccess`; called-service evidence: backend/src/services/customer.service.ts:240-298 `upsertCustomerFromOrder`, backend/src/services/email.service.ts:369-390 `sendOrderConfirmationAfterPayment`; this handler does not call `tranzilaService.capturePayment`. Auth/capability: public.
- Inputs: path params none; GET query fields `orderId|order_id|order`, `token`, `Response|response|ResponseCode|responseCode`, `index|Index`, `ConfirmationCode|confirmationCode`, `AuthCode|authCode`, `TranzilaTK|ccard|Ccard`, `expmonth|ExpMonth`, `expyear|ExpYear`, `TranzilaPW|pw`, `sum|Sum`; body none. Validation: order id required; gateway response must indicate success; Order must exist; callback token must match `paymentSecurityToken`; when both amounts are finite, absolute returned-versus-expected difference must not exceed ₪0.02 (`payment.controller.ts:264-324`).
- Response: 302 redirect to checkout with `paymentError=missing_order|declined|order_not_found|security|amount_mismatch`, or to `/order-confirmation/:orderId`. Models/files/providers: reads Order with `findById`; writes Order with `findByIdAndUpdate`, Customer with `updateOne`, and Order with `findOneAndUpdate` for confirmation-email claiming; exact fields written: failure branches set `paymentStatus="failed"`; success sets `paymentStatus="authorized"` and optional `transactionId`, `authCode`, `cardToken`, `expireMonth`, `expireYear`; Customer upsert writes `$set.fullName`, `$set.email`, `$set.city`, `$set.lastOrderDate`, `$addToSet.orderHistory`, `$inc.totalSpent`, `$inc.orderCount`, with insertion-only `normalizedPhone`, `manualStatus`, `customerCategory`, `tags`, `adminNotes`, `dietaryInfo`; confirmation claim sets `confirmationEmailSentAt`; file/provider operations: validates the Tranzila callback fields, upserts CRM customer, sends confirmation email, and redirects the browser.
- External integrations: Tranzila callback parsing/validation, confirmation email, and browser redirect; no capture API call occurs in this handler. Frontend/external consumers: Tranzila browser redirect. Status: active, external consumer.

### 130. `POST /api/payment/success`
- Registration: `backend/src/routes/payment.routes.ts:16`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → paymentSuccess`.
- Handler: `backend/src/controllers/payment.controller.ts:202-383` — `paymentSuccess`; called-service evidence: backend/src/services/customer.service.ts:240-298 `upsertCustomerFromOrder`, backend/src/services/email.service.ts:369-390 `sendOrderConfirmationAfterPayment`; this handler does not call `tranzilaService.capturePayment`. Auth/capability: public.
- Inputs: path params none; query may contain the same Tranzila fields; form-urlencoded body fields `orderId|order_id|order`, `token`, `Response|response|ResponseCode|responseCode`, `index|Index`, `ConfirmationCode|confirmationCode`, `AuthCode|authCode`, `TranzilaTK|ccard|Ccard`, `expmonth|ExpMonth`, `expyear|ExpYear`, `TranzilaPW|pw`, `sum|Sum`. Validation: order id required; gateway response must indicate success; Order must exist; callback token must match `paymentSecurityToken`; when both amounts are finite, absolute returned-versus-expected difference must not exceed ₪0.02 (`payment.controller.ts:264-324`).
- Response: 302 redirect to checkout with `paymentError=missing_order|declined|order_not_found|security|amount_mismatch`, or to `/order-confirmation/:orderId`. Models/files/providers: reads Order with `findById`; writes Order with `findByIdAndUpdate`, Customer with `updateOne`, and Order with `findOneAndUpdate` for confirmation-email claiming; exact fields written: failure branches set `paymentStatus="failed"`; success sets `paymentStatus="authorized"` and optional `transactionId`, `authCode`, `cardToken`, `expireMonth`, `expireYear`; Customer upsert writes `$set.fullName`, `$set.email`, `$set.city`, `$set.lastOrderDate`, `$addToSet.orderHistory`, `$inc.totalSpent`, `$inc.orderCount`, with insertion-only `normalizedPhone`, `manualStatus`, `customerCategory`, `tags`, `adminNotes`, `dietaryInfo`; confirmation claim sets `confirmationEmailSentAt`; file/provider operations: validates the Tranzila callback fields, upserts CRM customer, sends confirmation email, and redirects the browser.
- External integrations: Tranzila callback parsing/validation, confirmation email, and browser redirect; no capture API call occurs in this handler. Frontend/external consumers: Tranzila browser redirect. Status: active, external consumer.

### 131. `POST /api/payment/void/:orderId`
- Registration: `backend/src/routes/payment.routes.ts:37`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireAdmin → voidPayment`.
- Handler: `backend/src/controllers/payment.controller.ts:481-523` — `voidPayment`. Auth/capability: authenticated site User with exact role admin.
- Inputs: path params orderId; query none; body none. Validation: orderId required; Order must exist with paymentStatus authorized and transactionId; gateway must be configured/succeed (`payment.controller.ts:481-523`).
- Response: status 200, 502; shape keys success, message. Models/files/providers: reads Order with `findById`; writes Order with `findByIdAndUpdate`; exact fields written: successful mock or provider void sets `paymentStatus="voided"` and `status="cancelled"`; provider failure writes none (`payment.controller.ts:481-516`); file/provider operations: Tranzila void request.
- External integrations: Tranzila void request. Frontend/external consumers: OrderService.voidPayment. Status: active.

### 132. `GET /api/portal/status`
- Registration: `backend/src/routes/portal.routes.ts:10`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireInstitution → getPortalStatus`.
- Handler: `backend/src/controllers/portal.controller.ts:108-147` — `getPortalStatus`. Auth/capability: authenticated site User with exact role institution.
- Inputs: path params none; query weekStartDate; body none. Validation: none.
- Response: status 403, 500, 200 (implicit where no status is set); shape keys success, message, data, institutionName, currentWeekStartDate, nextWeekStartDate. Models/files/providers: reads User with `findById`; InstitutionMenu with `findOne`/native `findOne`; InstitutionOrder with `findOne`/native `findOne`; writes conditional legacy InstitutionMenu/InstitutionOrder migrations plus InstitutionOrder `updateOne` when computed lock differs; exact fields written: legacy InstitutionMenu `weekStartDate`, weekday `sunday|monday|tuesday|wednesday|thursday` objects with `mainMeat|vegetarianMain|carb1|carb2|side|saladFruit`, `shabbatPackage.hasShabbat`, `shabbatPackage.fridayNight.fish|mainMeat|vegetarianMain|carb1|carb2|side`, `shabbatPackage.shabbatDay.mainMeat|vegetarianMain|carb1|carb2|side`, `shabbatPackage.seudaShlishit.carb|protein`, `shabbatPackage.shabbatSalads`, and `orderDeadline`; legacy InstitutionOrder `institutionId`, `weekStartDate`, `isLocked`, `days[].dayOfWeek|regularCount|vegetarianCount|notes`, `shabbatOrder.regularCount|vegetarianCount|wantsSeudaShlishit|notes`, `shabbatOrder.extras.challahs|rolls|grapeJuice`, optional `shabbatOrder.mealPortions.fridayNight.regularCount|vegetarianCount`, `shabbatOrder.mealPortions.shabbatDay.regularCount|vegetarianCount`, and `shabbatOrder.mealPortions.seudaShlishit.regularCount|vegetarianCount`; lock synchronization writes only `$set.isLocked` (`portal.controller.ts:29-128`; model schemas); file/provider operations: none.
- External integrations: none. Frontend/external consumers: InstitutionPortalService. Status: active.

### 133. `POST /api/portal/submit`
- Registration: `backend/src/routes/portal.routes.ts:11`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireInstitution → submitPortalOrder`.
- Handler: `backend/src/controllers/portal.controller.ts:147-278` — `submitPortalOrder`. Auth/capability: authenticated site User with exact role institution.
- Inputs: path params none; query none; body weekStartDate, days, shabbatOrder, generalNotes. Validation: authenticated active institution required; body weekStartDate valid; menu must be published; weekday/shabbat deadlines and ownership apply; day/shabbat/generalNotes payloads valid; at least one meaningful portion required or existing order is deleted (`portal.controller.ts:147-278`).
- Response: status 403, 400, 500, 200 (implicit where no status is set); shape keys success, message, data, isLocked, days, shabbatOrder, generalNotes. Models/files/providers: reads User with `findById`; InstitutionMenu with `findOne`/native `findOne`; InstitutionOrder with `findOne`/native `findOne`; writes conditional legacy migrations; InstitutionOrder `deleteOne` for empty order or `findOneAndUpdate` upsert; exact fields written: `institutionId`, `weekStartDate`, `days[].dayOfWeek|regularCount|vegetarianCount|notes`, `shabbatOrder.regularCount|vegetarianCount|wantsSeudaShlishit|notes`, `shabbatOrder.extras.challahs|rolls|grapeJuice`, optional `shabbatOrder.mealPortions.fridayNight|shabbatDay|seudaShlishit.regularCount|vegetarianCount`, `generalNotes`, computed `isLocked`; empty submission deletes the matching document and writes no fields (`portal.controller.ts:147-278`; `models/InstitutionOrder.ts:78-107`); file/provider operations: none.
- External integrations: none. Frontend/external consumers: InstitutionPortalService. Status: active.

### 134. `GET /api/search`
- Registration: `backend/src/routes/search.routes.ts:10-82`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → search.routes.ts anonymous GET / callback (lines 10-82)`.
- Handler: `backend/src/routes/search.routes.ts:10-82` — `search.routes.ts anonymous GET / callback (lines 10-82)`. Auth/capability: public.
- Inputs: path params none; query `q`; body none. Validation: `q` is required, must be a string, and must contain at least two characters.
- Response: status 200; shape keys success, data, results, totalResults, query. Models/files/providers: reads none; writes none; exact fields written: none; file/provider operations: none.
- External integrations: none. Frontend/external consumers: SearchService (מוערם). Status: active.

### 135. `GET /api/settings`
- Registration: `backend/src/routes/settings.routes.ts:11`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → getSettings`.
- Handler: `backend/src/controllers/settings.controller.ts:68-118` — `getSettings`. Auth/capability: public.
- Inputs: path params none; query none; body none. Validation: none.
- Response: status 200, 500; shape keys success, message, error. Models/files/providers: reads SiteSettings with `findOne`; writes conditional new SiteSettings document `save` when singleton is absent; exact fields written: `shabbatMenuUrl=""`, `eventsMenuUrl=""`, `kosherCertificateUrl=""`, `contactPhone`, `orderEmail`, `whatsappLink=""`, `cholentForceOpen=false`, `cholentCustomMessage=""`, `cholentClosedMessage`, and Mixed `pageAnnouncements.<page>.bannerText|popupTitle|popupText|popupLinkText|popupLinkUrl`, plus timestamps (`settings.controller.ts:68-86`; `siteSettings.model.ts:39-96`); file/provider operations: none.
- External integrations: none. Frontend/external consumers: SiteSettingsService / ShippingService. Status: active.

### 136. `PUT /api/settings`
- Registration: `backend/src/routes/settings.routes.ts:12`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireAdmin → updateSettings`.
- Handler: `backend/src/controllers/settings.controller.ts:118-276` — `updateSettings`. Auth/capability: authenticated site User with exact role admin.
- Inputs: path params none; query none; body shabbatMenuUrl, eventsMenuUrl, kosherCertificateUrl, contactPhone, orderEmail, whatsappLink, cholentForceOpen, cholentCustomMessage, cholentClosedMessage, pageAnnouncements, homeAnnouncement, homeAnnouncementTitle, cateringAnnouncement, holidayAnnouncement. Validation: optional URL/contact/email/WhatsApp/cholent fields must have required primitive types; pageAnnouncements must be object keyed by known pages and nested fields strings; HTTP(S) URL checks apply where coded (`settings.controller.ts:118-192`).
- Response: status 200, 400, 500; shape keys success, message, error. Models/files/providers: reads none; writes SiteSettings with `findOneAndUpdate` upsert; exact fields written: named validated paths `shabbatMenuUrl`, `eventsMenuUrl`, `kosherCertificateUrl`, `contactPhone`, `orderEmail`, `whatsappLink`, `cholentForceOpen`, `cholentCustomMessage`, `cholentClosedMessage`; Mixed `pageAnnouncements.<key>.bannerText|popupTitle|popupText|popupLinkText|popupLinkUrl`; synchronized legacy `homeAnnouncement`, `homeAnnouncementTitle`, `cateringAnnouncement`, `holidayAnnouncement`. The update uses `strict:false`, so each additional request-body key is persisted as an explicitly classified strict:false extension rather than a declared schema path (`settings.controller.ts:118-230`; `siteSettings.model.ts:87-96`); file/provider operations: none.
- External integrations: none. Frontend/external consumers: SiteSettingsService / ShippingService. Status: active.

### 137. `GET /api/settings/delivery`
- Registration: `backend/src/routes/settings.routes.ts:19`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → getDeliverySettings`.
- Handler: `backend/src/controllers/settings.controller.ts:329-358` — `getDeliverySettings`. Auth/capability: public.
- Inputs: path params none; query none; body none. Validation: none.
- Response: status 200; shape keys success, data, freeShippingThreshold, isFreeShippingActive, baseDeliveryFee, pricePerKm. Models/files/providers: reads StoreSettings with `findOne`; DeliveryPricing with `find`; writes conditional StoreSettings with `create` when singleton is absent; exact fields written: `freeShippingThreshold=500`, `isFreeShippingActive=false`, `openDates=[]`, `minimumLeadDays=2`; schema defaults additionally set `baseDeliveryFee=25`, `pricePerKm=3`, `openDateRules=[]`, plus timestamps (`settings.controller.ts:328-339`; `store-settings.model.ts:7-27`); file/provider operations: none.
- External integrations: none. Frontend/external consumers: SiteSettingsService / ShippingService. Status: active.

### 138. `PUT /api/settings/delivery`
- Registration: `backend/src/routes/settings.routes.ts:20`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireAdmin → updateDeliverySettings`.
- Handler: `backend/src/controllers/settings.controller.ts:358-513` — `updateDeliverySettings`. Auth/capability: authenticated site User with exact role admin.
- Inputs: path params none; query none; body freeShippingThreshold, isFreeShippingActive, openDates, openDateRules, minimumLeadDays, baseDeliveryFee, pricePerKm, tiers. Validation: all supplied monetary/lead-day values nonnegative (lead days integer); openDates array of YYYY-MM-DD; openDateRules valid and reference openDates; tiers array objects with nonnegative distances/prices/thresholds, min<=max, boolean isActive (`settings.controller.ts:358-433`).
- Response: status 200; shape keys success, data, freeShippingThreshold, isFreeShippingActive, baseDeliveryFee, pricePerKm, openDates, openDateRules, minimumLeadDays, tiers. Models/files/providers: reads DeliveryPricing with `find` after mutation; writes StoreSettings singleton update/upsert in transaction; DeliveryPricing `deleteMany` then optional `insertMany`; exact fields written: StoreSettings `freeShippingThreshold`, `isFreeShippingActive`, `openDates`, `openDateRules[].date`, `openDateRules[].cutoffTime`, `minimumLeadDays`, `baseDeliveryFee`, `pricePerKm`; each inserted DeliveryPricing writes `minDistanceKm`, `maxDistanceKm`, `price`, `isActive`, `freeShippingThreshold`, `minOrderForDelivery`, plus timestamps (`settings.controller.ts:440-484`; model schemas); file/provider operations: none.
- External integrations: none. Frontend/external consumers: SiteSettingsService / ShippingService. Status: active.

### 139. `GET /api/settings/store`
- Registration: `backend/src/routes/settings.routes.ts:15`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → getStoreSettings`.
- Handler: `backend/src/controllers/settings.controller.ts:276-297` — `getStoreSettings`. Auth/capability: public.
- Inputs: path params none; query none; body none. Validation: none.
- Response: status 200; shape keys success, data, freeShippingThreshold, baseDeliveryFee, pricePerKm. Models/files/providers: reads Setting with `findOne`; writes conditional Setting with `create` when singleton is absent; exact fields written: default `freeShippingThreshold`, `baseDeliveryFee`, `pricePerKm`, plus timestamps; file/provider operations: none.
- External integrations: none. Frontend/external consumers: SiteSettingsService / ShippingService. Status: active.

### 140. `PUT /api/settings/store`
- Registration: `backend/src/routes/settings.routes.ts:16`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireAdmin → updateStoreSettings`.
- Handler: `backend/src/controllers/settings.controller.ts:297-329` — `updateStoreSettings`. Auth/capability: authenticated site User with exact role admin.
- Inputs: path params none; query none; body freeShippingThreshold, baseDeliveryFee, pricePerKm. Validation: each supplied freeShippingThreshold/baseDeliveryFee/pricePerKm must coerce to a nonnegative number (`settings.controller.ts:297-312`).
- Response: status 200; shape keys success, data, freeShippingThreshold, baseDeliveryFee, pricePerKm. Models/files/providers: reads none; writes Setting with `findOneAndUpdate` upsert; exact fields written: provided nonnegative `freeShippingThreshold`, `baseDeliveryFee`, `pricePerKm`; file/provider operations: none.
- External integrations: none. Frontend/external consumers: SiteSettingsService / ShippingService. Status: active.

### 141. `GET /api/shopping`
- Registration: `backend/src/routes/shopping.routes.ts:12`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireCapability(CAP.SHOPPING_LIST) → getShoppingList`.
- Handler: `backend/src/controllers/shopping.controller.ts:13-39` — `getShoppingList`; called-service evidence: backend/src/services/shopping.service.ts:41-212 `getShoppingList`. Auth/capability: authenticated site User with capability shopping:list; admin always, driver only for deliveries:my:*.
- Inputs: path params none; query safetyMargin; body none. Validation: none.
- Response: status 200, 500; shape keys success, data, timestamp, message, error, stack. Models/files/providers: reads Order with `find`; MenuItem with `find`; writes none; exact fields written: none; file/provider operations: none.
- External integrations: none. Frontend/external consumers: ShoppingListComponent. Status: active.

### 142. `GET /api/testimonials`
- Registration: `backend/src/routes/testimonials.routes.ts:36-46`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → testimonials.routes.ts anonymous GET / callback (lines 36-46)`.
- Handler: `backend/src/routes/testimonials.routes.ts:36-46` — `testimonials.routes.ts anonymous GET / callback (lines 36-46)`. Auth/capability: public.
- Inputs: path params none; query none; body none. Validation: none.
- Response: status 200; shape keys success, data, count, timestamp. Models/files/providers: reads `backend/src/data/testimonials.json` via `loadTestimonials` → `fs.readFile` + `JSON.parse`; writes none; exact fields written: none; file/provider operations: reads and parses the entire testimonials JSON array.
- External integrations: reads and parses the entire testimonials JSON array. Frontend/external consumers: none found (home and TestimonialsComponent use hard-coded arrays; no testimonial HTTP request). Status: active.

### 143. `POST /api/testimonials`
- Registration: `backend/src/routes/testimonials.routes.ts:79-116`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireAdmin → testimonials.routes.ts anonymous POST / callback (lines 79-116)`.
- Handler: `backend/src/routes/testimonials.routes.ts:79-116` — `testimonials.routes.ts anonymous POST / callback (lines 79-116)`. Auth/capability: authenticated site User with exact role admin.
- Inputs: path params none; query none; body `name`, `event`, `quote`, optional `rating`, `location`, `imageUrl`. Validation: name/event/quote required; rating, when supplied, must be 1-5.
- Response: status 201; shape keys success, data, message, timestamp. Models/files/providers: reads testimonials JSON via `loadTestimonials` → `readFile` + `JSON.parse`; writes testimonials JSON via `saveTestimonials` → `writeFile` of the entire array; exact fields written: appended object: `id`, `name`, `event`, `quote`, `rating`, `date`, `location`, `imageUrl`, `isApproved=false`, `isPublished=false`, `createdAt`, `updatedAt`; file/provider operations: reads/parses, appends, serializes, and rewrites the entire array.
- External integrations: reads/parses, appends, serializes, and rewrites the entire array. Frontend/external consumers: none found (home and TestimonialsComponent use hard-coded arrays; no testimonial HTTP request). Status: active.

### 144. `DELETE /api/testimonials/:id`
- Registration: `backend/src/routes/testimonials.routes.ts:151-172`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireAdmin → testimonials.routes.ts anonymous DELETE /:id callback (lines 151-172)`.
- Handler: `backend/src/routes/testimonials.routes.ts:151-172` — `testimonials.routes.ts anonymous DELETE /:id callback (lines 151-172)`. Auth/capability: authenticated site User with exact role admin.
- Inputs: path params id; query none; body none. Validation: path `id` required and must match an existing testimonial before the filtered array is written (`testimonials.routes.ts:151-165`).
- Response: status 200; shape keys success, message, timestamp. Models/files/providers: reads testimonials JSON via `loadTestimonials` → `readFile` + `JSON.parse`; writes testimonials JSON via `saveTestimonials` → `writeFile` of the filtered entire array; exact fields written: none on retained objects; matching `id` object is removed; file/provider operations: reads/parses, filters by `id`, serializes, and rewrites the entire array.
- External integrations: reads/parses, filters by `id`, serializes, and rewrites the entire array. Frontend/external consumers: none found (home and TestimonialsComponent use hard-coded arrays; no testimonial HTTP request). Status: active.

### 145. `PUT /api/testimonials/:id`
- Registration: `backend/src/routes/testimonials.routes.ts:119-148`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireAdmin → testimonials.routes.ts anonymous PUT /:id callback (lines 119-148)`.
- Handler: `backend/src/routes/testimonials.routes.ts:119-148` — `testimonials.routes.ts anonymous PUT /:id callback (lines 119-148)`. Auth/capability: authenticated site User with exact role admin.
- Inputs: path params id; query none; body entire request body object. Validation: path `id` required and must match an existing testimonial; request body is otherwise merged without field-level validation (`testimonials.routes.ts:119-140`).
- Response: status 200; shape keys success, data, message, timestamp. Models/files/providers: reads testimonials JSON via `loadTestimonials` → `readFile` + `JSON.parse`; writes testimonials JSON via `saveTestimonials` → `writeFile` of the entire array; exact fields written: schema-free JSON file operation merges every request-body key onto the matching object and then overwrites `updatedAt`; arbitrary keys are explicitly classified as file data, not schema paths (`testimonials.routes.ts:119-140`); file/provider operations: reads/parses, finds `id`, merges, serializes, and rewrites the entire array.
- External integrations: reads/parses, finds `id`, merges, serializes, and rewrites the entire array. Frontend/external consumers: none found (home and TestimonialsComponent use hard-coded arrays; no testimonial HTTP request). Status: active.

### 146. `GET /api/testimonials/admin/all`
- Registration: `backend/src/routes/testimonials.routes.ts:67-76`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireAdmin → testimonials.routes.ts anonymous GET /admin/all callback (lines 67-76)`.
- Handler: `backend/src/routes/testimonials.routes.ts:67-76` — `testimonials.routes.ts anonymous GET /admin/all callback (lines 67-76)`. Auth/capability: authenticated site User with exact role admin.
- Inputs: path params none; query none; body none. Validation: none.
- Response: status 200; shape keys success, data, count, timestamp. Models/files/providers: reads testimonials JSON via `loadTestimonials` → `readFile` + `JSON.parse`; writes none; exact fields written: none; file/provider operations: reads and parses the entire testimonials JSON array.
- External integrations: reads and parses the entire testimonials JSON array. Frontend/external consumers: none found (home and TestimonialsComponent use hard-coded arrays; no testimonial HTTP request). Status: active.

### 147. `GET /api/testimonials/featured`
- Registration: `backend/src/routes/testimonials.routes.ts:49-64`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → testimonials.routes.ts anonymous GET /featured callback (lines 49-64)`.
- Handler: `backend/src/routes/testimonials.routes.ts:49-64` — `testimonials.routes.ts anonymous GET /featured callback (lines 49-64)`. Auth/capability: public.
- Inputs: path params none; query limit; body none. Validation: none.
- Response: status 200; shape keys success, data, count, timestamp. Models/files/providers: reads testimonials JSON via `loadTestimonials` → `readFile` + `JSON.parse`; writes none; exact fields written: none; file/provider operations: reads/parses the array, filters published records, sorts by rating, slices to limit.
- External integrations: reads/parses the array, filters published records, sorts by rating, slices to limit. Frontend/external consumers: none found (home and TestimonialsComponent use hard-coded arrays; no testimonial HTTP request). Status: active.

### 148. `GET /api/testimonials/stats`
- Registration: `backend/src/routes/testimonials.routes.ts:175-202`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireAdmin → testimonials.routes.ts anonymous GET /stats callback (lines 175-202)`.
- Handler: `backend/src/routes/testimonials.routes.ts:175-202` — `testimonials.routes.ts anonymous GET /stats callback (lines 175-202)`. Auth/capability: authenticated site User with exact role admin.
- Inputs: path params none; query none; body none. Validation: none; location presence only controls aggregation and is not request validation (`testimonials.routes.ts:175-190`).
- Response: status 200; shape keys success, data, averageRating. Models/files/providers: reads testimonials JSON via `loadTestimonials` → `readFile` + `JSON.parse`; writes none; exact fields written: none; file/provider operations: reads/parses the array and computes counts/rating/location statistics.
- External integrations: reads/parses the array and computes counts/rating/location statistics. Frontend/external consumers: none found (home and TestimonialsComponent use hard-coded arrays; no testimonial HTTP request). Status: active.

### 149. `POST /api/upload`
- Registration: `backend/src/routes/upload.routes.ts:36-73`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → upload.single('image') → upload.routes.ts anonymous POST / callback (lines 36-73)`.
- Handler: `backend/src/routes/upload.routes.ts:36-73` — `upload.routes.ts anonymous POST / callback (lines 36-73)`. Auth/capability: public.
- Inputs: path params none; query none; multipart field `image` exposed as `req.file`; no text body fields. Validation: multipart `image` file is required; upload middleware enforces its configured file type/size rules (`upload.routes.ts:36-53`).
- Response: status 200, 400, 500; shape keys success, message, imageUrl, publicId, format, width, height, bytes. Models/files/providers: reads none; writes none; exact fields written: none; file/provider operations: Multer/Cloudinary uploads one `image`; handler returns URL/public ID/format/dimensions/bytes.
- External integrations: Multer/Cloudinary uploads one `image`; handler returns URL/public ID/format/dimensions/bytes. Frontend/external consumers: UploadService. Status: active.

### 150. `POST /api/upload/video`
- Registration: `backend/src/routes/upload.routes.ts:76-134`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireAdmin → upload.routes.ts anonymous video multer callback (lines 80-88) → upload.routes.ts anonymous POST /video callback (lines 76-134)`.
- Handler: `backend/src/routes/upload.routes.ts:76-134` — `upload.routes.ts anonymous POST /video callback (lines 76-134)`. Auth/capability: authenticated site User with exact role admin.
- Inputs: path params none; query none; multipart field `video` exposed as `req.file`; no text body fields. Validation: Multer errors/type/size failures return 400; multipart `video` file and returned Cloudinary URL are required (`upload.routes.ts:76-114`).
- Response: status 200, 400, 500; shape keys success, message, publicId, format, bytes, duration. Models/files/providers: reads none; writes none; exact fields written: none; file/provider operations: authenticated admin Multer/Cloudinary upload of one `video` (MP4/WebM/MOV, middleware size/type limits); handler returns URL/public ID/format/bytes/duration.
- External integrations: authenticated admin Multer/Cloudinary upload of one `video` (MP4/WebM/MOV, middleware size/type limits); handler returns URL/public ID/format/bytes/duration. Frontend/external consumers: UploadService. Status: active.

### 151. `GET /api/users`
- Registration: `backend/src/routes/user.routes.ts:17`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireAdmin → getUsers`.
- Handler: `backend/src/controllers/user.controller.ts:24-77` — `getUsers`. Auth/capability: authenticated site User with exact role admin.
- Inputs: path params none; query none; body none. Validation: none.
- Response: status 500, 200 (implicit where no status is set); shape keys success, message. Models/files/providers: reads User with `aggregate`; writes none; exact fields written: none; file/provider operations: none.
- External integrations: none. Frontend/external consumers: UsersService. Status: active.

### 152. `PUT /api/users/:id/crm`
- Registration: `backend/src/routes/user.routes.ts:18`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireAdmin → updateUserCrm`.
- Handler: `backend/src/controllers/user.controller.ts:77-113` — `updateUserCrm`. Auth/capability: authenticated site User with exact role admin.
- Inputs: path params id; query none; body tags, adminNotes, dietaryInfo. Validation: none.
- Response: status 404, 500, 200 (implicit where no status is set); shape keys success, message. Models/files/providers: reads none; writes User with `findByIdAndUpdate`; exact fields written: provided `tags`, `adminNotes`, `dietaryInfo`; file/provider operations: none.
- External integrations: none. Frontend/external consumers: UsersService. Status: active.

### 153. `PATCH /api/users/:id/role`
- Registration: `backend/src/routes/user.routes.ts:16`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireAdmin → updateUserRole`.
- Handler: `backend/src/controllers/user.controller.ts:180-243` — `updateUserRole`. Auth/capability: authenticated site User with exact role admin.
- Inputs: path params id; query none; body role. Validation: role must be a SITE_ROLES enum; target must exist; cannot remove/deactivate the final active admin, including self-demotion (`user.controller.ts:180-220`).
- Response: status 400, 404, 500, 200 (implicit where no status is set); shape keys success, message. Models/files/providers: reads User with `findById`, `countDocuments`, then `findById`; writes User document `save`; exact fields written: `role`; save updates timestamps; file/provider operations: none.
- External integrations: none. Frontend/external consumers: UsersService. Status: active.

### 154. `GET /api/users/drivers`
- Registration: `backend/src/routes/user.routes.ts:15`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireAdmin → getDriverUsers`.
- Handler: `backend/src/controllers/user.controller.ts:243-263` — `getDriverUsers`. Auth/capability: authenticated site User with exact role admin.
- Inputs: path params none; query none; body none. Validation: none.
- Response: status 500, 200 (implicit where no status is set); shape keys success, data, d, _id, fullName, username, phone, message. Models/files/providers: reads User with `find({role:"driver",isActive:true})`; writes none; exact fields written: none; file/provider operations: none.
- External integrations: none. Frontend/external consumers: UsersService. Status: active.

### 155. `GET /api/users/resolve`
- Registration: `backend/src/routes/user.routes.ts:14`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireAdmin → resolveUserByUsername`.
- Handler: `backend/src/controllers/user.controller.ts:113-180` — `resolveUserByUsername`. Auth/capability: authenticated site User with exact role admin.
- Inputs: path params none; query username, phone; body none. Validation: at least username or normalized phone candidate required; multiple phone matches return conflict; one matching User required (`user.controller.ts:113-142`).
- Response: status 400, 409, 404, 500, 200 (implicit where no status is set); shape keys success, message, user, _id, username, role, fullName, phone, isActive, createdAt. Models/files/providers: reads User with `findOne` by username and/or `find` by phone candidates; writes none; exact fields written: none; file/provider operations: none.
- External integrations: none. Frontend/external consumers: UsersService. Status: active.

### 156. `GET /api/videos`
- Registration: `backend/src/routes/video.routes.ts:10`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → getVideos`.
- Handler: `backend/src/controllers/video.controller.ts:54-82` — `getVideos`. Auth/capability: public.
- Inputs: path params none; query includeAll, active; body none. Validation: none.
- Response: status 200; shape keys success, data, count, timestamp. Models/files/providers: reads Video with `find`; writes none; exact fields written: none; file/provider operations: none.
- External integrations: none. Frontend/external consumers: VideoService. Status: active.

### 157. `POST /api/videos`
- Registration: `backend/src/routes/video.routes.ts:18`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireAdmin → addVideo`.
- Handler: `backend/src/controllers/video.controller.ts:102-201` — `addVideo`. Auth/capability: authenticated site User with exact role admin.
- Inputs: path params none; query none; body title, source, youtubeUrl, videoUrl, publicId, thumbnailUrl. Validation: title nonblank; source resolves to youtube/cloudinary; YouTube requires valid unique URL/videoId; Cloudinary requires videoUrl and unique optional publicId; thumbnail must be supplied/derivable (`video.controller.ts:102-174`).
- Response: status 201; shape keys success, message, data, timestamp. Models/files/providers: reads Video with `findOne` duplicate checks; writes new Video document `save`; exact fields written: YouTube: `title`, `source="youtube"`, `youtubeUrl`, derived `videoId`, derived `thumbnailUrl`, `order=0`, `isActive=true`; Cloudinary: `title`, `source="cloudinary"`, `videoUrl`, optional `publicId`, supplied/derived `thumbnailUrl`, `order=0`, `isActive=true`; file/provider operations: none.
- External integrations: none. Frontend/external consumers: VideoService. Status: active.

### 158. `DELETE /api/videos/:id`
- Registration: `backend/src/routes/video.routes.ts:20`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireAdmin → deleteVideo`.
- Handler: `backend/src/controllers/video.controller.ts:292-312` — `deleteVideo`. Auth/capability: authenticated site User with exact role admin.
- Inputs: path params id; query none; body none. Validation: path `id` required and must identify an existing Video (`video.controller.ts:292-302`).
- Response: status 200; shape keys success, message, timestamp. Models/files/providers: reads none; writes Video with `findByIdAndDelete`; exact fields written: none (document deletion); file/provider operations: none.
- External integrations: none. Frontend/external consumers: VideoService. Status: active.

### 159. `GET /api/videos/:id`
- Registration: `backend/src/routes/video.routes.ts:15`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → getVideoById`.
- Handler: `backend/src/controllers/video.controller.ts:82-102` — `getVideoById`. Auth/capability: public.
- Inputs: path params id; query none; body none. Validation: path `id` required and must identify an existing Video (`video.controller.ts:82-92`).
- Response: status 200; shape keys success, data, timestamp. Models/files/providers: reads Video with `findById`; writes none; exact fields written: none; file/provider operations: none.
- External integrations: none. Frontend/external consumers: VideoService. Status: active.

### 160. `PUT /api/videos/:id`
- Registration: `backend/src/routes/video.routes.ts:19`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireAdmin → updateVideo`.
- Handler: `backend/src/controllers/video.controller.ts:201-292` — `updateVideo`. Auth/capability: authenticated site User with exact role admin.
- Inputs: path params id; query none; body title, source, youtubeUrl, videoUrl, publicId, thumbnailUrl, order, isActive. Validation: path `id` required and target exists; title nonblank if supplied; source-specific URL required/valid; YouTube videoId and Cloudinary publicId unique; source transitions clear incompatible fields (`video.controller.ts:201-280`).
- Response: status 200; shape keys success, message, data, timestamp. Models/files/providers: reads Video with `findById` and `findOne` duplicate checks; writes Video document `save`; exact fields written: provided/derived `title`, `source`, `youtubeUrl`, `videoId`, `thumbnailUrl`, `videoUrl`, `publicId`, `order`, `isActive`; incompatible source fields are cleared; file/provider operations: none.
- External integrations: none. Frontend/external consumers: VideoService. Status: active.

### 161. `GET /api/videos/stats`
- Registration: `backend/src/routes/video.routes.ts:13`. Middleware: `cors → helmet → morgan → generalApiLimiter → express.json → express.urlencoded → cookieParser → mongoSanitize → authenticate → requireAdmin → getVideoStatistics`.
- Handler: `backend/src/controllers/video.controller.ts:312-327` — `getVideoStatistics`. Auth/capability: authenticated site User with exact role admin.
- Inputs: path params none; query none; body none. Validation: none.
- Response: status 200; shape keys success, data, total, active, inactive. Models/files/providers: reads Video with `countDocuments`; writes none; exact fields written: none; file/provider operations: none.
- External integrations: none. Frontend/external consumers: VideoService. Status: active.

### 162. `GET /robots.txt`
- Registration: `backend/src/server.ts:207-209`. Middleware: `cors → helmet → morgan → express.json → express.urlencoded → cookieParser → mongoSanitize → server.ts anonymous GET /robots.txt callback (lines 207-209)`.
- Handler: `backend/src/server.ts:207-209` — `server.ts anonymous GET /robots.txt callback (lines 207-209)`. Auth/capability: public.
- Inputs: path params none; query none; body none. Validation: none.
- Response: implicit 200 `text/plain` body `User-agent: *\nAllow: /`. Models/files/providers: reads none; writes none; exact fields written: none; file/provider operations: none.
- External integrations: none. Frontend/external consumers: none found. Status: active, no frontend consumer, external consumer.

## Separate `server/index.js`: 6 active endpoints

All six execute `cors` (line 31) → `express.json` (32) → process-wide `rateLimit(180/minute)` (33) → listed callback. Storage is JSON files under `server/data`; no Mongo model is used.

### S1. `POST /api/catering-inquiry`
- Registration/handler: `server/index.js:284-296` — `server/index.js anonymous catering-inquiry callback (lines 284-296)`. Middleware: `cors → express.json → rateLimit → server/index.js anonymous catering-inquiry callback (lines 284-296)`. Auth/capability: public.
- Inputs: body fullName, phone, email, eventDate, eventTime, guestCount, optional location, kashrut, budgetRange, notes. Validation: validateInquiry: object; fullName>=2; phone/email regex; YYYY-MM-DD non-past date; HH:MM; integer guestCount>=1. Response: 200 `{ok:true,message,data}`; 400 `{ok:false,error}`; 500 `{ok:false,error}`.
- Models/files/providers: reads `server/data/catering-inquiries.json` with `existsSync`/`readFileSync` + `JSON.parse`; writes same file with `writeFileSync` of the entire appended array; exact fields written: schema-free JSON file object spreads every request-body key; validated named keys are `fullName`, `phone`, `email`, `eventDate`, `eventTime`, `guestCount`, with optional `location`, `kashrut`, `budgetRange`, `notes`, then adds `createdAt`, `confirmationId`; unknown body keys are retained because this is a file write without a schema (`server/index.js:87-120`); file/provider operations: creates data directory if absent; reads/parses and rewrites entire JSON array.

### S2. `POST /api/chat`
- Registration/handler: `server/index.js:299-334` — `server/index.js anonymous chat callback (lines 299-334)`. Middleware: `cors → express.json → rateLimit → server/index.js anonymous chat callback (lines 299-334)`. Auth/capability: public.
- Inputs: body conversationId, messages[].role/content, systemPrompt. Validation: conversationId synthesized unless string; messages accepted only when array and role=user; no content-length validation. Response: 200 `{ok:true,reply,conversationId}` or deliberately 200 `{ok:false,error:"chat_failed"}`.
- Models/files/providers: reads conversation JSON with `readFileSync` + `JSON.parse`; `chat-summaries.json` with `readFileSync` + `JSON.parse`; writes conversation JSON and `chat-summaries.json` with `writeFileSync`; exact fields written: message entries `role`, `content`, `ts`; summary `conversationId`, `title`, `bullets`, `userIntent`, `extracted.fullName`, `extracted.phone`, `extracted.email`, `extracted.eventDate`, `extracted.eventTime`, `extracted.guestCount`, `extracted.location`, `extracted.kashrut`, `extracted.budgetRange`, `lastUserMessage`, `lastAssistantMessage`, `startedAt`, `updatedAt` (`server/index.js:142-270`); file/provider operations: creates directories if absent; optionally calls OpenAI chat completions for reply and summary; emits summary event.

### S3. `GET /api/admin/summaries`
- Registration/handler: `server/index.js:337-342` — `server/index.js anonymous admin summaries callback (lines 337-342)`. Middleware: `cors → express.json → rateLimit → server/index.js anonymous admin summaries callback (lines 337-342)`. Auth/capability: query `key` or header `X-Admin-Key` must equal ADMIN_KEY.
- Inputs: query key; no body/path params. Validation: exact key equality in assertAdmin. Response: 200 `{ok:true,data}`; 401 `{ok:false,error:"unauthorized"}`.
- Models/files/providers: reads `server/data/chat-summaries.json` with `existsSync`/`readFileSync` + `JSON.parse`; writes none; exact fields written: none; file/provider operations: none.

### S4. `GET /api/admin/stream`
- Registration/handler: `server/index.js:345-360` — `server/index.js anonymous admin SSE callback (lines 345-360)`. Middleware: `cors → express.json → rateLimit → server/index.js anonymous admin SSE callback (lines 345-360)`. Auth/capability: query `key` or header `X-Admin-Key` must equal ADMIN_KEY.
- Inputs: query key; no body/path params. Validation: exact key equality in assertAdmin. Response: 200 streaming `text/event-stream`, `event: summary`, JSON data; 401 unauthorized JSON.
- Models/files/providers: reads in-memory EventEmitter summary events; writes none; exact fields written: none; file/provider operations: opens SSE stream and subscribes/unsubscribes the connection listener.

### S5. `GET /api/health`
- Registration/handler: `server/index.js:363-365` — `server/index.js anonymous health callback (lines 363-365)`. Middleware: `cors → express.json → rateLimit → server/index.js anonymous health callback (lines 363-365)`. Auth/capability: public.
- Inputs: no path/query/body fields. Validation: none. Response: 200 `{ok,service,port,time}`.
- Models/files/providers: reads none; writes none; exact fields written: none; file/provider operations: none.

### S6. `GET /`
- Registration/handler: `server/index.js:367-376` — `server/index.js anonymous root callback (lines 367-376)`. Middleware: `cors → express.json → rateLimit → server/index.js anonymous root callback (lines 367-376)`. Auth/capability: public.
- Inputs: no path/query/body fields. Validation: none. Response: 200 `{ok,message,endpoints}`.
- Models/files/providers: reads none; writes none; exact fields written: none; file/provider operations: none.

## Explicit contradiction ledger

| Previously recorded value | Corrected value and direct evidence |
|---|---|
| `POST /api/attendance/clock` ADMIN | **public**; route has only `attendanceController.clockByPin` (`attendance.routes.ts:12`). |
| `POST /api/contact` ADMIN | **public**; public block and no auth middleware (`contact.routes.ts:9-10`). |
| `POST /api/coupons/apply` ADMIN | **public, rate-limited**; `applyCouponLimiter` only (`coupon.routes.ts:10-21`). |
| `POST /api/delivery/calculate-fee` ADMIN | **public**; only `asyncHandler(postCalculateFee)` (`delivery.routes.ts:21`). |
| `GET /api/settings`, `GET /api/settings/delivery` ADMIN | **public** (`settings.routes.ts:10-11,18-19`). |
| `GET /api/gallery` ADMIN | **public** (`gallery.routes.ts:9-10`). |
| `GET /api/holiday-events/public/active` ADMIN | **public** (`holiday-event.routes.ts:17`). |
| `POST /api/upload/video` PUBLIC | **admin only**: `authenticate → requireAdmin → upload callback → response callback` (`upload.routes.ts:76-134`). |
| `GET/POST /api/payment/success` ADMIN | **public external consumer** for Tranzila/customer-browser redirect (`payment.routes.ts:10-16`). |
| `POST /api/menu` PUBLIC | **admin only**, `authenticate → requireAdmin` (`menu.routes.ts:27-28`). |
| `POST /api/delivery/cities` PUBLIC | **admin only**, `authenticate → requireAdmin` (`delivery.routes.ts:27`). |
| `PUT/DELETE /api/testimonials/:id` PUBLIC | **admin only**, `authenticate → requireAdmin` (`testimonials.routes.ts:119,151`). |
| `GET /api/payment/status/:orderId` PUBLIC | **authenticated** (`payment.routes.ts:27`), with handler ownership/admin check. |
| `GET /api/gallery/stats` active/reachable | **broken**: earlier `GET /:id` captures `stats` (`gallery.routes.ts:11` before line 14). |

## Focused data-operation verification

- GET endpoints with directly proven writes after correction: **11** (`/api/admin/institutions`, `/api/admin/institutions/menu`, `/api/admin/institutions/order/:institutionId`, `/api/admin/institutions/reports`, `/api/customers`, `/api/menu`, `/api/payment/success`, `/api/portal/status`, `/api/settings`, `/api/settings/delivery`, `/api/settings/store`).
- Generic write-detail placeholder count: **0**.
- Line-only validation description count: **0**.
- Automated schema-mismatch count: **0 unresolved**. Accepted non-schema classifications are explicit: `customerDetails` is an unconstrained Order Object; `pageAnnouncements`/`n8nResponse` are Mixed; SiteSettings update is `strict:false`; attempted Order `deliveryDate` is undeclared runtime data that strict update behavior may strip/reject; testimonial/catering-inquiry/chat writes are schema-free files; Tranzila/n8n/email operations are providers.
- Endpoint 125 correction: `GET /api/orders/myorders` calls `OrderService.getOrdersByUserId` and `enrichOrderItemsImageUrlPublic`, reads `Order.find({userId})` plus HolidayEvent/MenuItem image lookups, and writes none; it does not read `req.user.orders`.
- Testimonials file-write checks: POST reads/parses then appends and rewrites the full array; PUT reads/parses, finds id, merges body plus `updatedAt`, and rewrites the full array; DELETE reads/parses, filters id, and rewrites the full array.
- Attendance field check: clock-in writes only `employeeId`, `clockIn`, `status=active` (plus timestamps); clock-out writes `clockOut`, `status=completed`, `totalHours`, with the save hook recalculating `totalHours`/timestamps. No Attendance write lists `NODE_ENV`, `pinCode`, or `isActive`.

## Count verification

Parsed active primary registrations: **162** = router registrations plus `GET /`, `GET /robots.txt`, and pre-limit `GET /api/health`. Parsed separate-server registrations: **6**. Commented `POST /api/session-token` was not counted. Fully detailed: **168 / 168**; generic handlers: **0**.
