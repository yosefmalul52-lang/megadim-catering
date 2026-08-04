# Kitchen report baseline — 2026-08-02

## Git snapshot (before gap-close work)

- Working tree already contained kitchen-report upgrades + kitchen-ops MVP (uncommitted).
- `git status --short`: modified classic kitchen report files + untracked kitchen-ops models/routes/services/FE service.
- No commit/push/deploy performed in this session.

## Verified existing assets

| Area | Status | Evidence |
|------|--------|----------|
| Admin kitchen report page | Exists | `frontend/.../kitchen-report/` + route `/admin/kitchen-report` |
| Classic quantities API | Exists | `GET /api/order/kitchen-report` |
| CSV/XLSX/PDF/print (quantities) | Exists | `kitchen-report.service` + exports specs |
| Kitchen ops models | Exists | `KitchenPreparationTask`, `KitchenStation`, `KitchenPrepTemplate` |
| Caps | Exists | `KITCHEN_OPS_READ` / `KITCHEN_OPS_WRITE` |
| `/api/kitchen/*` | Exists | `kitchen.routes.ts` mounted in `server.ts` |
| 4 FE tabs + wizard + actions | Exists (partial UI polish) | kitchen-report component |
| Order sync hooks | Exists | `onOrderKitchenRelevantChange` from order/allergy paths |
| Ops report 4 views + export | Exists | `getKitchenOpsReport` / `exportKitchenOpsReport` |
| Demo seed KDEMO-* | Missing | — |
| `docs/kitchen-report/*` | Missing at baseline | — |
| Production guard on backfill | Missing | script used env URI as-is |

## Enum / naming gaps vs new command spec

| Spec | Code at baseline | Decision |
|------|------------------|----------|
| `partially_completed` / `completed` | `partial` / `done` | Accept both; store canonical new names going forward |
| `accepted_difference` | `manual_override` (+ `orphaned`) | Add `accepted_difference`; keep legacy values |
| `automatic_legacy` | `auto` | Add alias; keep `auto` |
| stage names (`pre_prep`, `qa`→`quality_check`, …) | shorter names | Accept both aliases |
| `itemSnapshot` | only `orderSnapshot` | Add `itemSnapshot` |
| `isDemo` / `demoBatchId` | absent | Add |

## Baseline tests (pre gap-close)

- Backend `npm run test:kitchen`: **28/28 pass**
- Frontend kitchen-report specs: **7/7 pass**
- TypeScript/build: previously green in prior session; re-run at Stage 10

## Mongo note

`backend/.env` points at Atlas `magadimcluster`. Demo seed / backfill / verification must use **local isolated Mongo only** (`scripts/start-local-isolated-db.cjs` + URI override). Never write demo data to Atlas.
