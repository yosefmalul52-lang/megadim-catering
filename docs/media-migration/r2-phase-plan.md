# שלב R2 — תכנון בלבד (לא להפעיל)

## מתי
רק אחרי שאישורים ב־`mapping-state.json` / ייצוא ההחלטות מוכנים, ובאישור מפורש.

## העלאה
- רק רשומות עם `approvalStatus: אושרה` + `entityId`
- מקור: byte-for-byte (`original.ext`) — Content-Type לפי magic bytes
- `assetId` אקראי (לא שם הקובץ המקורי)
- מבנה מתוכנן:

```
products/{productId}/{assetId}/original.{ext}
products/{productId}/{assetId}/large.webp
products/{productId}/{assetId}/card.webp
products/{productId}/{assetId}/thumbnail.webp
```

קטגוריות (אם יאושרו נפרד):

```
categories/{categoryId}/{assetId}/original.{ext}
...
```

## גרסאות WebP
- רק כקבצים נפרדים, אחרי אישור נפרד
- איכות גבוהה; בלי הגדלה מעל המקור
- sRGB + orientation תקין
- מידות מוצעות לפי UI נוכחי: thumbnail≈200, card≈400, large≈1200 (לא סופי)

## API / מודלים
- להמשיך להחזיר `imageUrl` כ־URL מלא ציבורי (אותו חוזה)
- שדות נוספים (`imageAssetId`, variants) — אופציונלי בהמשך, לא לפני בדיקת מודלים
- Cloudinary הישן: **לא למחוק**

## חבילות חסרות כרגע
- `sharp` — לא מותקן; יידרש רק ליצירת variants (לא למקור)
- `@aws-sdk/client-s3` — לא מותקן; יידרש להעלאת R2
- אין להתקין עד אישור שלב R2

## אבטחה בהעלאה העתידית
authenticate + requireAdmin, rate limit, MIME+magic bytes, keys אקראיים, Cache-Control immutable
