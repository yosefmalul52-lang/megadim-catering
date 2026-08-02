# כלי מיפוי תמונות מקומי (לא production)

## הפעלה

```bash
cd /Users/yosefmalul/Desktop/Megadim-P
node scripts/serve-media-mapper.cjs
```

פתח: http://127.0.0.1:4178

## מקור תמונות

`media-migration-input` → symlink לתיקיית Drive המקומית (gitignore).

## קבצים

| קובץ | תפקיד | Git |
|------|--------|-----|
| `mapper.html` | UI | כן (docs) |
| `serve-media-mapper.cjs` | שרת מקומי | כן (scripts) |
| `entities-export.json` | ייצוא מוצרים ללא לקוחות/הזמנות | ignore |
| `mapping-file.json` | הצעות ראשוניות | ignore |
| `mapping-state.json` | החלטות שנשמרו | ignore |
| `r2-phase-plan.md` | תכנון R2 בלבד | כן |

## איך לאשר

1. סנן לפי תיקייה/סטטוס.
2. בחר מוצר בחיפוש (רשימה מהמסד, קריאה בלבד).
3. לחץ **אשר** (חובה entityId).
4. אם אותו מוצר מקושר לשתי תמונות — תופיע אזהרת כפילות; אפשר לסמן שיתוף במפורש.
5. **שמור מיפוי**.
6. עצור כאן — אין העלאה ל־R2 בלי אישור נפרד.
