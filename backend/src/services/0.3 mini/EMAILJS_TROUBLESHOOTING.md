# EmailJS Troubleshooting Guide - שגיאה 412

## מה זה שגיאה 412?
שגיאה 412 (Precondition Failed) ב-EmailJS מצביעה על בעיה בהגדרות או בנתונים שנשלחים.

## שלבים לבדיקה:

### 1. בדוק את ה-IDs ב-EmailJS Dashboard
- היכנס ל-[EmailJS Dashboard](https://dashboard.emailjs.com/)
- בדוק את ה-Service ID, Template ID, ו-Public Key
- השווה אותם עם הערכים בקוד:
  - `src/app/services/email.service.ts`
  - Service ID: `service_5u4rv0w`
  - Template ID: `template_p5dx79v`
  - Public Key: `sFwpqAdTOoobasQDE`

### 2. בדוק את התבנית ב-EmailJS
התבנית חייבת להכיל את המשתנים הבאים:
- `{{from_name}}` - שם מלא
- `{{from_email}}` - כתובת מייל
- `{{subject}}` - נושא
- `{{message}}` - הודעה
- `{{to_email}}` - כתובת מייל (אופציונלי, יכול להיות מוגדר בתבנית)

**Subject של התבנית:**
```
פנייה חדשה מאתר - {{subject}}
```

**Body של התבנית:**
```html
<h2>פנייה חדשה מאתר MD Finance</h2>
<p><strong>שם:</strong> {{from_name}}</p>
<p><strong>אימייל:</strong> {{from_email}}</p>
<p><strong>נושא:</strong> {{subject}}</p>
<p><strong>הודעה:</strong></p>
<p>{{message}}</p>
<hr>
<p><em>נשלח מאתר MD Finance</em></p>
```

### 3. בדוק את החיבור ל-Gmail
- ודא שה-Service מחובר ל-Gmail
- ודא שהחשבון Gmail פעיל
- בדוק שאין בעיות הרשאות

### 4. בדוק את הקונסול בדפדפן
לאחר ניסיון שליחה, בדוק את הקונסול:
- `EmailJS Configuration:` - מציג את ה-IDs
- `Template Params:` - מציג את הנתונים שנשלחים
- `EmailJS Error Details:` - מציג פרטים על השגיאה

### 5. פתרונות אפשריים:

#### פתרון 1: עדכן את ה-IDs
אם ה-IDs לא תואמים, עדכן אותם ב-`email.service.ts`:
```typescript
private readonly SERVICE_ID  = 'service_YOUR_SERVICE_ID';
private readonly TEMPLATE_ID = 'template_YOUR_TEMPLATE_ID';
private readonly PUBLIC_KEY  = 'YOUR_PUBLIC_KEY';
```

#### פתרון 2: בדוק את שמות המשתנים
ודא ששמות המשתנים בתבנית תואמים בדיוק למה שנשלח:
- `from_name` (לא `fromName` או `from_name_`)
- `from_email` (לא `fromEmail` או `email`)
- `subject` (לא `topic` או `subj`)
- `message` (לא `msg` או `text`)
- `to_email` (אופציונלי)

#### פתרון 3: Fallback למקרה ש-EmailJS נכשל
אם EmailJS נכשל, הטופס יציע פתיחת תוכנת המייל עם הנתונים מוכנים.

### 6. בדיקות נוספות:
- ודא שהאתר רץ ב-https (או localhost)
- בדוק שאין blockers או extensions חוסמים
- בדוק את ה-logs ב-EmailJS Dashboard

## אם הבעיה נמשכת:
1. בדוק את ה-logs ב-EmailJS Dashboard
2. צור Service חדש ו-Template חדש
3. בדוק את ה-Public Key ב-EmailJS Dashboard
4. פנה לתמיכה של EmailJS

