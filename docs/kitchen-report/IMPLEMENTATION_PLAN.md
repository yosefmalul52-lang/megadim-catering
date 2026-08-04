# Implementation plan — kitchen ops multi-day (Megadim)

Updated from code audit 2026-08-02. Source of truth: repository code. This plan drives continuous execution (no pause for approval).

## Architecture (locked)

```
Order.items/portions ──► orderedQuantity (fulfillment view / classic kitchen-report)
         │
         ├── wizard / backfill / demo seed ──► KitchenPreparationTask (work only)
         │                                         │
         │                                         ├── today / event / changes views
         │                                         └── plannedQuantity / actualQuantity per stage
         └── kitchenChangeLog + sync hooks ──► syncStatus needs_review (never clobber done/manual)
MenuItem.recipe (optional) ──► ingredients completeness full|partial|none
KitchenStation (optional) ──► capacity or "טרם הוגדרה"
```

**Quantity rule:** never sum thaw+cook+pack as ordered qty.

## Stage map

| Stage | Goal | Status |
|-------|------|--------|
| 0 Baseline | `00_BASELINE.md`, git/tests snapshot | Done in this pass |
| 1 Model/CAP/audit | aliases + `itemSnapshot` + demo flags + prod guards | In progress |
| 2 API | keep `/api/kitchen`; accept new status aliases; 409/idempotency | Extend existing |
| 3 Backfill | idempotent + refuse production without explicit allow | Harden script |
| 9 Demo seed | KDEMO-001..004 local only, after stage 3 | Primary deliverable |
| 4 UI | 4 tabs/wizard/actions vs demo | Polish gaps |
| 5 Sync | keep hooks; accept_difference decision | Minor align |
| 6 Export/print | filters parity + sample artifacts | Verify |
| 7–8 Capacity/recipes | only when configured; else explicit missing | Already partial |
| 10 Verify | tests, local browser, screenshots, git outputs | End |

## Decisions vs new command enums

Keep existing short stage codes (`prep`, `qa`, …) **and** accept long aliases (`pre_prep`, `quality_check`, …).  
Canonical write targets for new work: `partially_completed`, `completed`, `accepted_difference`, `automatic_legacy` with read-compat for `partial`/`done`/`manual_override`/`auto`.

Audit: keep embedded `auditLog[]` (already present) rather than a second collection for MVP size.

## Safety

- Demo/backfill refuse Atlas / `mongodb+srv` unless `--allow-production` (human-only; not used here).
- Require `ALLOW_DEMO_SEED=true` and `NODE_ENV !== production` for seed.
- `isDemo` + `demoBatchId: kitchen-report-local-v1`.
- Reset deletes only matching demo batch — never `deleteMany({})`.
- No email/WhatsApp/CRM/payment side effects (direct model writes).
- No commit / push / deploy.

## Demo orders

| Order | Case |
|-------|------|
| KDEMO-001 | Shabbat delivery, variants, note, prep time |
| KDEMO-002 | Pickup, mealTime both, split portions |
| KDEMO-003 | Catering event, allergy, multi-day tasks |
| KDEMO-004 | Changed then cancelled; done + cancelled tasks |

Report date: `DEMO_REPORT_DATE` or tomorrow Asia/Jerusalem.

## Out of scope this pass

Tranzila, payment flow, employee kitchen write CAP, inventing recipes/capacity, Production migration.
