# דוח ראיות — כלי תפעול מטבח רב־יומי

תאריך אימות: 2026-08-03 (מקומי)

## סטטוס: הושלם ל־MVP תפעולי + דמו מקומי (ללא commit/push/deploy)

### מה נבנה
- שכבת `KitchenPreparationTask` / `KitchenStation` / `KitchenPrepTemplate` מעל דוח המטבח הקיים
- API `/api/kitchen/*` עם CAP `kitchen:ops_read` / `kitchen:ops_write`
- 4 תצוגות FE + אשף + פעולות משימה (כולל ביטול ו־bulk complete)
- סנכרון שינויי הזמנה בלי לדרוס completed / accepted_difference / manual_override
- ייצוא ops: csv / xlsx / pdf / print
- Seed דמו מקומי: `KDEMO-001`…`004` (`demoBatchId=kitchen-report-local-v1`)
- תיעוד: `docs/kitchen-report/00_BASELINE.md`, `IMPLEMENTATION_PLAN.md`, מסמך זה

### מה כבר היה לפני
- דוח כמויות, סינון ארוחה, אלרגיות, CSV/XLSX/PDF RTL, kitchenChangeLog, עריכת הכנה

### מה לא נבנה / חלקי
- אימות דפדפן אינטראקטיבי מלא בכל 4 הרזולוציות על Angular (צולמו דפי print HTML ב־1440/1024/768/390)
- תבניות אשף מלאות (יצירה ידנית + apply-template קיימים; UI תבניות מצומצם)
- Employee PIN אינו כותב משימות (כמתוכנן)
- חומרי גלם: completeness=`none` על דמו כי אין התאמת מתכון מדויקת לכל מנות הדמו (לא מומצא)
- PDF רב־עמודי כבד: לדמו יצא PDF תקין (1 עמוד ליום הדמו)

## זרימת נתונים

```
Order.items/portions → orderedQuantity (fulfillment / classic report)
Order → wizard/backfill/demo → KitchenPreparationTask (planned/actual per stage)
Tasks → ops-report views today|event|changes + exports
MenuItem.recipe? → ingredients completeness
KitchenStation? → capacity % only if configured
```

## מודלים / שדות חדשים
- Task: stages/status aliases, `itemSnapshot`, `isDemo`, `demoBatchId`, `changeContext`, `completedBy`, sync `accepted_difference`
- Order: `isDemo`, `demoBatchId`
- Station/Template: כפי שמומש

## API עיקרי (`authenticate` + capability)
| Method | Path |
|--------|------|
| GET | `/api/kitchen/ops-report` |
| GET | `/api/kitchen/ops-report/export/:format` |
| GET/POST/PATCH | `/api/kitchen/tasks`… |
| POST | `/api/kitchen/tasks/:id/actions` (Idempotency-Key, 409 version) |
| POST | `/api/kitchen/tasks/bulk-actions` |
| POST | `/api/kitchen/plans`, `/plans/apply-template` |
| CRUD | `/stations`, `/templates` |
| POST | `/orders/:orderId/sync-review`, `/backfill` |

שגיאות מרכזיות: 400 validation/מעגל תלות, 403 capability, 409 version.

## הזמנות דמו (מקומי בלבד)
- תאריך דוח: **2026-08-04**
- `KDEMO-001` משלוח שבת + הערה
- `KDEMO-002` איסוף both + partial/blocked
- `KDEMO-003` קייטרינג + אלרגיה + משימות רב־יומיות
- `KDEMO-004` בוטלה + completed/cancelled + needs_review
- 9 משימות דמו

פקודות:
```bash
# URI למסד מבודד בלבד
export ALLOW_DEMO_SEED=true MONGO_URI='mongodb://127.0.0.1:PORT/db' NODE_ENV=development
npm run seed:kitchen-demo   # ב־backend/
npm run reset:kitchen-demo
```

התחברות מקומית ל־DB המבודד: `admin@local.test` / `LocalOnly!R2Verify`  
דוח: http://localhost:4200/admin/kitchen-report (יום עבודה 2026-08-04)

## בדיקות
| Suite | Result |
|-------|--------|
| BE `test:kitchen` | 30/30 |
| FE kitchen-report specs | 7/7 |
| BE `tsc --noEmit` | OK |
| Seed ×2 idempotent | orderCount=4, taskCount=9 |
| Reset ממוקד | מוחק רק demo batch |
| `git diff --check` | clean |

## ארטיפקטים
- `tmp-screenshots/kitchen-ops-demo.csv`
- `tmp-screenshots/kitchen-ops-demo.xlsx`
- `tmp-screenshots/kitchen-ops-demo.pdf`
- `tmp-screenshots/kitchen-ops-demo-print.html`
- `tmp-screenshots/kitchen-ops-print-{1440,1024,768,390}.png`

## אימות API מול דמו (אחרי restart נקי ל־4000)
- `today`: 7 משימות
- `fulfillment`: 6 שורות אספקה
- `event` (KDEMO-003): timeline 2 ימים
- `changes`: 2 משימות needs_review

## אישור בטיחות
- **לא** בוצעו commit / push / merge / PR / deploy
- Seed/אימות רצו מול Mongo **מקומי** `127.0.0.1:62759/megadim_local_r2_verify` בלבד
- backfill/seed מסרבים ל־Atlas בלי `--allow-production`
- `.env` / תשלום / Tranzila לא שונו
