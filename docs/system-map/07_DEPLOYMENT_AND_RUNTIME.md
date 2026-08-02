# 07 — Deployment and Runtime

---

## 1. Frontend build
- `cd frontend && ng build` / `build:production`
- Output: `frontend/dist/megadim-catering` (`angular.json`)
- Root: `npm run build` → install + frontend build

## 2. Backend build
- `cd backend && npm run build` (`tsc`) → `backend/dist/`
- Start: `node dist/server.js`
- Dev: `npm run dev` → `src/server.ts`

## 3. פקודות הפעלה מקומיות
| מטרה | פקודה |
|------|--------|
| שניהם | root `npm start` (concurrently) |
| FE | `npm run start:frontend` |
| BE | `npm run start:backend` |
| Seed | root/`backend` `npm run seed` |
| Mini server | `cd server && npm start` |

## 4. Render
- רמז חזק: `environment.prod.ts` → `https://magadim-backend.onrender.com/api`
- אין `render.yaml` ב־repo
- **לא ניתן לאמת** service settings, health probes, disks מהקוד

## 5. Vercel
- אין `vercel.json` ב־repo
- הערות CORS/cookies ל־Vercel↔Render ב־`auth.routes.ts`
- **לא ניתן לאמת** project settings; CI לא מdeploy ל־Vercel

## 6. MongoDB Atlas
- שימוש ב־`MONGO_URI` בלבד בקוד הפעיל
- **לא ניתן לאמת** Atlas vs self-host, backups, PITR

## 7. Domains & CORS
- `ALLOWED_ORIGINS` / `ALLOWED_ORIGIN` / `FRONTEND_URL` ב־server CORS setup (`server.ts`)
- Prod API host כנ״ל Render URL
- Domain ציבורי מהקוד: **לא ניתן לאמת** DNS records

## 8. CI — GitHub Actions
- `.github/workflows/ci.yml`
- Trigger: push/PR ל־main/master
- Job יחיד: Node 20, `npm run build`, assert `frontend/dist/megadim-catering/index.html`
- **אין** backend build/test, **אין** deploy job

## 9. Environment variable names (by service)

### Backend
`NODE_ENV`, `PORT`, `MONGO_URI`, `JWT_SECRET`, `JWT_EXPIRES_IN` (legacy auth.js), `ALLOWED_ORIGINS`, `ALLOWED_ORIGIN`, `FRONTEND_URL`, `BACKEND_URL`, `OWNER_EMAIL`, `BUSINESS_NAME`, `EMAIL_*`, `CLOUDINARY_*`, `GOOGLE_MAPS_API_KEY`, `TRANZILA_*`, `N8N_*`, `TWILIO_*`, `TZ`

### Frontend (compile-time)
`environment.apiUrl`, `googleAnalyticsId`, `adminSummariesKey`, `assistant.*`

### server/
`OPENAI_API_KEY`, `OPENAI_CHAT_MODEL`, `OPENAI_SUMMARY_MODEL`, `ALLOWED_ORIGIN`, `ADMIN_KEY` / admin key header, `PORT`

### `.env.example` (חלקי)
רק Maps + n8n — אינו מכסה את כל המשתנים שבשימוש.

## 10. Health checks
- `GET /api/health` ב־`server.ts` (לפני rate limit)
- `GET /api/health` גם ב־`server/index.js`
- UptimeRobot מוזכר ב־README בלבד

## 11. Logs
- `morgan` + `console.*` ב־controllers/services
- אין centralized log shipper בקוד

## 12–13. Backups / Restore
- **לא נמצאו** סקריפטי `mongodump`/restore ב־repo
- Soft-delete order restore ≠ DB backup
- Menu reseed ≠ backup
- **לא ניתן לאמת** מדיניות ספק

## 14. Seed
| Script | Path |
|--------|------|
| Root menu seed | `seed.js` |
| Backend seed | `backend/seed.js` |
| Orders | `scripts/seed-orders.js` |
| B2B | `backend/scripts/seed-b2b-menu.ts` |
| Cholent/delivery startup | `backend/src/seed/*` via `database.ts` |
| Admin create | `scripts/create-admin.js` |

חלק מה־seeds מבצעים `deleteMany` — מסוכן ל־prod.

## 15. Scripts נוספים
`scripts/fix-prices.js`, `sync-*-menu*.js`, `backend/scripts/migrate-shavuot-to-holiday.ts`, `reset-featured-flags.ts`, `fix-video-indexes.ts`

## 16. Dev / Test / Prod
| | Dev | Test | Prod |
|--|-----|------|------|
| API URL | localhost:4000 | **אין סביבת test מוגדרת בקוד** | Render URL ב־environment.prod |
| Tests | backend `npm test` stub fail; 0 spec files | — | — |
| Tranzila | mock ללא terminal | לא ניתן לאמת | env-dependent |
| Cookies | sameSite lax-ish local | — | none+secure |

## 17. לא ניתן לאמת מהקוד
- הגדרות Vercel/Render מדויקות
- Mongo backup/PITR
- DNS/SSL
- האם `server/` רץ בפרודקשן
- Quotas של Maps/Twilio/Cloudinary
- האם UptimeRobot פעיל

