# מפת אתר MD Finance - Site Map

## סקירה כללית
אתר Angular 20 עם SSR (Server-Side Rendering) בעברית (RTL) עבור חברת ייעוץ פיננסי.

---

## 📁 מבנה הפרויקט

### 1. **Routes (ניתוב)**
קובץ: `src/app/app.routes.ts`

| Path | Component | תיאור |
|------|-----------|--------|
| `/` | `HomeComponent` | עמוד הבית |
| `/service/:id` | `ServiceDetailComponent` | עמוד פרטי שירות |
| `/terms` | `TermsComponent` | תנאי שימוש |
| `/blog` | `BlogComponent` | בלוג |
| `/contact` | `ContactPageComponent` | עמוד יצירת קשר |
| `**` | redirect to `/` | כל שאר הנתיבים מנותבים לעמוד הבית |

---

## 🏠 עמוד הבית (`HomeComponent`)

**קובץ:** `src/app/pages/home/home.ts` + `home.html`

### מבנה העמוד (מלמעלה למטה):

#### 1. **Header (כותרת עליונה)**
- **קומפוננטה:** `<app-site-header>`
- **מיקום:** `src/app/components/site-header/`
- **תפקיד:** תפריט ניווט ראשי

#### 2. **Hero Section (סקציית כניסה)**
- **קומפוננטה:** `<app-hero>`
- **מיקום:** `src/app/components/hero/`
- **תפקיד:** אזור הכניסה הראשי עם תמונה רקע וקריאה לפעולה

#### 3. **Social Sidebar (סרגל צדדי)**
- **קומפוננטה:** `<app-social-sidebar>`
- **מיקום:** `src/app/components/social-sidebar/`
- **תפקיד:** קישורים לרשתות חברתיות בצד

#### 4. **About Section (סקציית אודות)**
- **קומפוננטה:** `<app-about>`
- **מיקום:** `src/app/components/about/`
- **ID:** `#about`
- **תוכן:**
  - תמונה של מאיר דהאן
  - סיפור אישי
  - רשימת יתרונות (credentials): ליווי אישי, פשטות, שקיפות, ניסיון, תוצאות

#### 5. **Financial Reality Section (מציאות פיננסית)**
- **מיקום:** ישירות ב-`home.html`
- **תוכן:**
  - כותרת: "איך לא להוריד מרמת החיים ועדיין לא לפחד להיכנס לחשבון הבנק בסוף החודש?"
  - סטטיסטיקות:
    - 67% מהאנשים בישראל במינוס כרוני
    - 80% מהמשפחות לא ישרדו 3 חודשים בלי משכורת
  - תיבות הדגשה (highlight boxes)

#### 6. **Process Introduction Section (הקדמה לתהליך)**
- **מיקום:** ישירות ב-`home.html`
- **תוכן:**
  - כותרת: "כסף זה לא הכל בחיים..."
  - 3 צירים:
    1. ניתוח ואפיון המצב הפיננסי (אייקון תרשים)
    2. בניית תכנית מתאימה (אייקון מטרה)
    3. הטמעה, יישום ובקרה (אייקון מטרה)

#### 7. **Services Section (סקציית שירותים)**
- **קומפוננטה:** `<app-services>`
- **מיקום:** `src/app/components/services/`
- **ID:** `#services`
- **תוכן:** 5 שירותים:
  1. **שלב 1** - ניתוח ואפיון המצב הפיננסי (`mapping`)
  2. **שלב 2** - בניית תכנית מתאימה (`goals`)
  3. **שלב 3** - הטמעה, יישום ובקרה (`budget`)
  4. **שלב 4** - השקעות מותאמות אישית (`investments`)
  5. **שלב 5** - עצמאות כלכלית מלאה (`independence`)

#### 8. **Target Audience Section (קהל יעד)**
- **מיקום:** ישירות ב-`home.html`
- **ID:** `#target-audience`
- **תוכן:**
  - **למי מתאים:**
    - 8 נקודות (רשימה ירוקה)
    - `suitableAudience` array ב-`home.ts`
  - **למי לא מתאים:**
    - 5 נקודות (רשימה אדומה)
    - `notSuitableAudience` array ב-`home.ts`

#### 9. **Testimonials Section (המלצות)**
- **קומפוננטה:** `<app-iphone-gallery>`
- **מיקום:** `src/app/components/iphone-gallery/`
- **ID:** `#testimonials`
- **תוכן:**
  - קרוסלת תמונות של המלצות לקוחות
  - תמונות: `Recommend-carousel1.jpeg` עד `Recommend-carousel4.jpeg`

#### 10. **Contact Section (יצירת קשר)**
- **מיקום:** ישירות ב-`home.html`
- **ID:** `#contact`
- **תוכן:**
  - **טופס יצירת קשר:**
    - שם פרטי (חובה)
    - שם משפחה
    - אימייל (חובה)
    - טלפון
    - נושא הפנייה (חובה): dropdown
    - הודעה (max 600 תווים)
  - **שירות:** `ContactWeb3FormsService`
  - **Directives:** `AutoResizeTextareaDirective`, `ScrollToFirstInvalidDirective`
  - **Toast notifications:** הצגת הודעות הצלחה/שגיאה
  - **כרטיס מידע:** פרטי התקשרות (אימייל, טלפון, שעות פעילות)

#### 11. **Footer (תחתית)**
- **קומפוננטה:** `<app-footer>`
- **מיקום:** `src/app/components/footer/`
- **תוכן:**
  - מידע על החברה
  - קישורים לרשתות חברתיות
  - פרטי התקשרות
  - שעות פעילות
  - קישורים לשירותים
  - קישורים משפטיים (תנאי שימוש, מדיניות פרטיות)

#### 12. **Back to Top Button**
- כפתור שמופיע כשגוללים למטה
- מופיע מ-300px scroll

#### 13. **Success Popup Modal**
- מודאל שמציג הצלחה לאחר שליחת טופס

---

## 🔧 קומפוננטות נוספות

### **About Component** (`app-about`)
- **קובץ:** `src/app/components/about/about.ts`
- **תוכן:**
  - תמונת פרופיל: `main-background-image-6.png.png`
  - סיפור אישי של מאיר דהאן
  - Overlay עם שם ותפקיד
  - 5 ריבועי יתרונות

### **Services Component** (`app-services`)
- **קובץ:** `src/app/components/services/services.ts`
- **תוכן:**
  - רשת של 5 כרטיסי שירותים
  - כל כרטיס ניתן ללחיצה → מעבר ל-`/service/:id`
  - אייקונים מותאמים אישית (CSS) לכל שירות

### **Service Detail Component** (`app-service-detail`)
- **קובץ:** `src/app/pages/service-detail/service-detail.ts`
- **תוכן דינמי לפי `id`:**
  - פרטי השירות
  - תכונות השירות (`getServiceFeatures()`)
  - שלבי התהליך (`getProcessSteps()`)
  - יתרונות (`getServiceBenefits()`)
  - שירותים אחרים (`getOtherServices()`)

### **Blog Component** (`app-blog`)
- **קובץ:** `src/app/components/blog/blog.ts`
- **תוכן:**
  - רשימת פוסטים (6 פוסטים לדוגמה)
  - סינון לפי קטגוריות
  - קטגוריות: הכל, חיסכון, השקעות, תקציב, נדלן, חובות, פנסיה

### **Terms Component** (`app-terms`)
- **קובץ:** `src/app/components/terms/terms.ts`
- **תוכן:** תנאי שימוש

### **Footer Component** (`app-footer`)
- **קובץ:** `src/app/components/footer/footer.ts`
- **תוכן:** מידע על החברה, קישורים, פרטי התקשרות

### **Iphone Gallery Component** (`app-iphone-gallery`)
- **קובץ:** `src/app/components/iphone-gallery/` (לא נמצא בקוד, אבל בשימוש)
- **תפקיד:** קרוסלת תמונות בסגנון iPhone

### **Testimonials iPhone Carousel** (`app-testimonials-iphone-carousel`)
- **קובץ:** `src/app/components/testimonials-iphone-carousel/`
- **תפקיד:** קרוסלת המלצות נוספת

---

## 🎨 Shared Components & Directives

### **Directives:**
1. **RevealDirective** (`src/app/shared/directives/reveal.directive.ts`)
   - אנימציות גילוי בעת גלילה
   - תמיכה ב-`reveal="up"`, `reveal="left"`, `reveal="right"`

2. **AutoResizeTextareaDirective** (`src/app/shared/directives/auto-resize-textarea.directive.ts`)
   - התאמת גובה textarea אוטומטית

3. **ScrollToFirstInvalidDirective** (`src/app/shared/directives/scroll-to-first-invalid.directive.ts`)
   - גלילה לשדה הראשון הלא תקין בטופס

---

## 🔌 Services

### **ContactWeb3FormsService**
- **קובץ:** `src/app/services/contact-web3forms.service.ts`
- **תפקיד:** שליחת טופס יצירת קשר דרך Web3Forms API

### **EmailService**
- **קובץ:** `src/app/services/email.service.ts`
- **תפקיד:** שירות אימייל (ייתכן שימוש ב-EmailJS)

---

## 📸 Assets (נכסים)

### **תמונות:**
- **Hero:** `final-background.png`, `main-background-image-7.png`, ועוד
- **About:** `main-background-image-6.png.png`, `profile.jpg`
- **Testimonials:** `Recommend-carousel1.jpeg` עד `Recommend-carousel4.jpeg`
- **iPhone Mockups:** `iphone_mockup_1.png` עד `iphone_mockup_4.png`
- **Logos:** `md-logo.png`, `md-logo-transparent.png`, `main-logo-md.png`

### **JSON:**
- **Testimonials:** `src/assets/testimonials.json`

---

## 🎯 IDs וסקריפטים חשובים

### **Section IDs:**
- `#about` - סקציית אודות
- `#services` - סקציית שירותים
- `#target-audience` - קהל יעד
- `#testimonials` - המלצות
- `#contact` - יצירת קשר

### **Scripts:**
- `generate-testimonials-manifest.ts` - רץ לפני build/start
- מגדיר טעינת תמונות testimonials

---

## 📝 טופס יצירת קשר

### **שדות:**
- `firstName` (חובה, min 2 תווים)
- `lastName` (אופציונלי)
- `email` (חובה, אימות email)
- `phone` (אופציונלי, pattern: `^0\d([- ]?\d){7,9}$`)
- `topic` (חובה, dropdown)
- `message` (אופציונלי, max 600 תווים)
- `website` (honeypot - שדה נסתר נגד בוטים)

### **פונקציונליות:**
- אימות בזמן אמת
- גלילה אוטומטית לשדה שגוי
- Toast notifications
- מודאל הצלחה
- אנימציות

---

## 🔄 State Management

### **HomeComponent Properties:**
- `showBackToTop` - הצגת כפתור חזרה למעלה
- `showAppointmentButton` - הצגת כפתור תאום פגישה
- `suitableAudience` - רשימת קהל יעד מתאים
- `notSuitableAudience` - רשימת קהל יעד לא מתאים
- `loading` - מצב טעינה של טופס
- `sent` - מצב שליחה מוצלחת
- `toast` - הודעת toast
- `showSuccessPopup` - הצגת מודאל הצלחה
- `contactForm` - ReactiveForm

---

## 🎨 Styling

### **Global Styles:**
- `src/styles.scss` - סגנונות גלובליים
- `src/app/app.scss` - סגנונות של App component
- כל קומפוננטה עם קובץ SCSS משלה

### **תכונות:**
- RTL support (כיוון ימין לשמאל)
- Animations (Angular Animations)
- Responsive design
- Custom scrollbar styling
- Font Awesome icons

---

## 🚀 Build & Deploy

### **Scripts:**
- `prestart` - רץ לפני start, יוצר testimonials manifest
- `start` - `ng serve`
- `prebuild` - רץ לפני build, יוצר testimonials manifest
- `build` - `ng build`
- `serve:ssr:md-finance` - הפעלת SSR server

---

## 📋 הערות חשובות

1. **קומפוננטות חסרות:**
   - `hero`, `site-header`, `social-sidebar`, `iphone-gallery` - מוזכרות בקוד אבל לא נמצאו קבצים

2. **Routing:**
   - כל הנתיבים מנותבים דרך `app.routes.ts`
   - SSR מופעל (`app.config.server.ts`)

3. **Forms:**
   - Reactive Forms עם Angular Forms
   - אימות מלא
   - Honeypot להגנה מפני בוטים

4. **Animations:**
   - Route transitions
   - Scroll reveal animations
   - Form interactions

---

## 🔗 קישורים חיצוניים

- **WhatsApp:** `https://wa.me/972501234567`
- **Email:** `info@md-finance.com` / `info@mdfinance.co.il`
- **Phone:** `050-123-4567`
- **Font Awesome:** CDN
- **Google Fonts:** Preconnect

---

**עודכן לאחרונה:** בהתבסס על מבנה הקוד הנוכחי
**גרסת Angular:** 20.3.6

