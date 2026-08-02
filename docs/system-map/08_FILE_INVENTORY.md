# 08 — File Inventory

ספירות ללא `node_modules`, `dist`, `.git`, `coverage`, `.angular`.

---

## 1. ספירת קבצים לפי אזור שורש

| אזור | קבצים (כל הסוגים) |
|------|------------------|
| `frontend/src` | 348 |
| `backend/src` | 136 |
| `server/` (ללא node_modules) | 6 |
| `scripts/` | 7 |
| `docs/` | 9 |
| `.github/` | 1 |

---

## 2. קבצי כניסה

| Entry | Path |
|-------|------|
| FE bootstrap | `frontend/src/main.ts` |
| FE app config | `frontend/src/app/app.config.ts` |
| BE active | `backend/src/server.ts` |
| BE unused | `backend/src/app.ts` |
| Mini server | `server/index.js` |
| Root package | `package.json` |

## 3–11. ספירות רכיבים

| קטגוריה | מספר | נתיב/גלוב |
|----------|------|-----------|
| Backend route files | 30 | `backend/src/routes/` |
| Controllers | 23 | `*.controller.ts` |
| Backend services | 15 | `backend/src/services/*.service.ts` |
| Model files (all) | 29 | `backend/src/models/` (כולל type-only) |
| Persisted models | 23 | ראו `03_DATABASE_MAP.md` |
| Middleware files | 6 | |
| Frontend components | 89 | `*.component.ts` |
| Frontend services | 32 | `services/*.service.ts` |
| Guards | 6 | `guards/*.guard.ts` |
| Interceptors | 1 | `auth.interceptor.ts` |
| Tests `*.spec.ts`/`*.test.*` | 0 | — |
| Root+backend scripts | ראו למטה | |

### Scripts

**Root `scripts/`:** create-admin, fix-prices, seed-orders, sync-all-menu-items, sync-menu-items, update-menu-from-frontend, update-salads-pricing  

**`backend/scripts/`:** fix-video-indexes, migrate-shavuot-to-holiday, reset-featured-flags, seed-b2b-menu  

**Seeds:** `seed.js`, `backend/seed.js`, `backend/src/seed/*`

### Deployment / CI
| File | Notes |
|------|-------|
| `.github/workflows/ci.yml` | FE build only |
| אין Dockerfile / render.yaml / vercel.json | |

---

## 12. קבצים לא מחוברים / Legacy חשוד

| Item | Evidence |
|------|----------|
| `backend/src/app.ts` | לא מיובא מ־server.ts |
| `backend/src/routes/auth.js`, `menu.js` | לא ב־mounts |
| `frontend/src/app/admin-app.routes.ts` | לא ב־bootstrap |
| `Product.js` | אין writers |
| DTO `*.model.ts` | type-only |
| `backend/src/services/0.3 mini/` | אפליקציית עזר/legacy נפרדת |
| `menu.service.ts` (JSON file menu) | בשימוש בעיקר ע״י search; menu CRUD דרך MenuItem Mongo |

## 13. קוד כפול / מקבילים

| כפילות | פרטים |
|--------|--------|
| Order create | `/api/orders` vs `/api/order/checkout` vs `/api/order/send` |
| Settings models | SiteSettings + StoreSettings + Setting |
| Menu | MenuItem vs Product vs JSON menu.service |
| Cloudinary config | `cloudinary.ts` + `cloudinary.config.ts` |
| Auth | `auth.routes.ts` vs legacy `auth.js` |
| FE login components | `components/login` vs `pages/auth/login` |

## 14. Services inventory (לכיסוי)

### Backend (15)
- `backend/src/services/agent.service.ts`
- `backend/src/services/attendance.service.ts`
- `backend/src/services/contact.service.ts`
- `backend/src/services/coupon.service.ts`
- `backend/src/services/customer.service.ts`
- `backend/src/services/delivery.service.ts`
- `backend/src/services/email.service.ts`
- `backend/src/services/employee.service.ts`
- `backend/src/services/menu.service.ts`
- `backend/src/services/order.service.ts`
- `backend/src/services/settings.service.ts`
- `backend/src/services/shavuot-migration.service.ts`
- `backend/src/services/shopping.service.ts`
- `backend/src/services/tranzila.service.ts`
- `backend/src/services/whatsapp.service.ts`

### Frontend (32)
- `frontend/src/app/services/accounting.service.ts`
- `frontend/src/app/services/admin-contacts.service.ts`
- `frontend/src/app/services/admin-delivery.service.ts`
- `frontend/src/app/services/analytics.service.ts`
- `frontend/src/app/services/auth-modal.service.ts`
- `frontend/src/app/services/auth.service.ts`
- `frontend/src/app/services/b2b-dictionary.service.ts`
- `frontend/src/app/services/campaign.service.ts`
- `frontend/src/app/services/cart.service.ts`
- `frontend/src/app/services/contact.service.ts`
- `frontend/src/app/services/coupon.service.ts`
- `frontend/src/app/services/delivery.service.ts`
- `frontend/src/app/services/gallery.service.ts`
- `frontend/src/app/services/holiday-catalog.service.ts`
- `frontend/src/app/services/holiday-event.service.ts`
- `frontend/src/app/services/institution-admin.service.ts`
- `frontend/src/app/services/institution-portal.service.ts`
- `frontend/src/app/services/language.service.ts`
- `frontend/src/app/services/location.service.ts`
- `frontend/src/app/services/marketing.service.ts`
- `frontend/src/app/services/menu.service.ts`
- `frontend/src/app/services/meta-pixel.service.ts`
- `frontend/src/app/services/order.service.ts`
- `frontend/src/app/services/search.service.ts`
- `frontend/src/app/services/seo.service.ts`
- `frontend/src/app/services/shipping.service.ts`
- `frontend/src/app/services/site-settings.service.ts`
- `frontend/src/app/services/toast.service.ts`
- `frontend/src/app/services/tracking.service.ts`
- `frontend/src/app/services/upload.service.ts`
- `frontend/src/app/services/users.service.ts`
- `frontend/src/app/services/video.service.ts`

