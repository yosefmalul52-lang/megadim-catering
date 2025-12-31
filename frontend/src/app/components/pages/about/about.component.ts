import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="about-page">
      <div class="hero-section">
        <div class="container">
          <h1 class="main-title">אודות "מגדים"</h1>
          <p class="subtitle">כשהלב והמטבח נפגשים</p>
        </div>
      </div>

      <div class="content-section">
        <div class="container">
          <section class="intro-section">
            <p class="intro-text">
              קייטרינג "מגדים" נולד מתוך תשוקה עמוקה לאמנות הבישול ומתוך אהבה לאוכל שעושה טוב בלב. 
              עבורנו, אוכל הוא לא רק טעם – הוא ניחוחות מעוררי זיכרון, הוא תחושה של בית והוא הדרך הכי טובה לחגוג את הרגעים היפים של החיים.
            </p>
          </section>

          <section class="quality-section">
            <h2 class="section-title">האיכות שלנו, השקט שלכם</h2>
            <p class="section-text">
              אנו מאמינים שאיכות מתחילה בבחירה קפדנית של חומרי הגלם. במטבח שלנו תמצאו רק מוצרים טריים שנבחרים מדי יום, 
              המטופלים ביד אוהבת ומקצועית. כדי שתוכלו לארח בראש שקט באמת, אנו פועלים תחת סטנדרטים מחמירים של משרד הבריאות 
              (רישיון יצרן מס' 100694) ובכשרות מהדרין של רבנות מטה בנימין.
            </p>
          </section>

          <section class="services-section">
            <h2 class="section-title">מה אנחנו מציעים?</h2>
            
            <div class="service-item">
              <h3 class="service-title">אירועים עם נשמה</h3>
              <p class="service-text">
                בין אם מדובר באירוע בוטיק אינטימי או בחגיגה גדולה, אנו בונים עבורכם תפריט מגוון המשלב בין הטעמים הביתיים והמוכרים 
                לבין מנות גורמה אקסקלוסיביות בפרזנטציה מודרנית.
              </p>
            </div>

            <div class="service-item">
              <h3 class="service-title">מענה יומיומי למוסדות</h3>
              <p class="service-text">
                אנו מספקים ארוחות מזינות, טריות ובריאות למוסדות לאורך כל ימות השבוע, תוך עמידה בלוחות זמנים ובדרישות תזונתיות קפדניות.
              </p>
            </div>

            <div class="service-item">
              <h3 class="service-title">השבת של מגדים</h3>
              <p class="service-text">
                מדי סוף שבוע, המטבח שלנו נפתח למכירת אוכל מוכן לשבת. אתם מוזמנים לקחת הביתה את הטעמים של "מגדים" 
                וליהנות משבת עשירה, נינוחה וטעימה במיוחד.
              </p>
            </div>
          </section>

          <section class="vision-section">
            <h2 class="section-title">החזון שלנו</h2>
            <p class="vision-text">
              בכל מנה שיוצאת מהמטבח שלנו מושקעת מחשבה על האורח שיטעם אותה. אנחנו כאן כדי להפוך את האירוע שלכם לחוויה קולינרית 
              שתשאיר טעם של עוד, עם שירות אישי, שפע מכל הלב ומקצועיות ללא פשרות.
            </p>
            <p class="closing-text">
              <strong>מגדים</strong> – מביאים את טעמי הבית לאירוע שלכם.
            </p>
          </section>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .about-page {
      min-height: 100vh;
      background: #fdf5f0;
    }

    .hero-section {
      background: linear-gradient(135deg, #3d2f1f 0%, #5c4a37 100%);
      color: #fdf5f0;
      padding: 4rem 0 3rem;
      text-align: center;
      box-shadow: 0 4px 12px rgba(61, 47, 31, 0.2);
      position: relative;
      overflow: hidden;
    }

    .hero-section::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: url('data:image/svg+xml,<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg"><defs><pattern id="grain" width="100" height="100" patternUnits="userSpaceOnUse"><circle cx="25" cy="25" r="1" fill="%23fdf5f0" opacity="0.1"/><circle cx="75" cy="75" r="1" fill="%23fdf5f0" opacity="0.1"/></pattern></defs><rect width="100" height="100" fill="url(%23grain)"/></svg>');
      opacity: 0.3;
    }

    .hero-section .container {
      position: relative;
      z-index: 1;
    }

    .container {
      max-width: 1000px;
      margin: 0 auto;
      padding: 0 2rem;
    }

    .main-title {
      font-size: 3.5rem;
      font-weight: 700;
      margin: 0 0 1rem 0;
      letter-spacing: 1px;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      color: #fdf5f0;
      text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.2);
    }

    .subtitle {
      font-size: 1.5rem;
      font-weight: 300;
      margin: 0;
      opacity: 0.95;
      font-style: italic;
      color: #faf0e6;
    }

    .content-section {
      padding: 4rem 0;
    }

    .intro-section {
      margin-bottom: 4rem;
    }

    .intro-text {
      font-size: 1.25rem;
      line-height: 2;
      color: #3d2f1f;
      text-align: center;
      font-weight: 400;
      max-width: 900px;
      margin: 0 auto;
      padding: 2.5rem;
      background: #fff8f3;
      border-radius: 16px;
      box-shadow: 0 4px 16px rgba(61, 47, 31, 0.1);
      border: 1px solid rgba(200, 125, 96, 0.15);
    }

    .section-title {
      font-size: 2.25rem;
      font-weight: 600;
      color: #2d1f14;
      margin: 3rem 0 1.5rem 0;
      text-align: center;
      position: relative;
      padding-bottom: 1rem;
    }

    .section-title::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 50%;
      transform: translateX(-50%);
      width: 100px;
      height: 4px;
      background: linear-gradient(90deg, #c97d60, #d4a574);
      border-radius: 2px;
      box-shadow: 0 2px 4px rgba(200, 125, 96, 0.3);
    }

    .section-text {
      font-size: 1.1rem;
      line-height: 1.9;
      color: #5c4a37;
      margin-bottom: 2rem;
      text-align: justify;
      direction: rtl;
    }

    .services-section {
      margin: 4rem 0;
    }

    .service-item {
      background: #fff8f3;
      padding: 2.5rem;
      margin-bottom: 2rem;
      border-radius: 16px;
      box-shadow: 0 4px 16px rgba(61, 47, 31, 0.1);
      transition: transform 0.3s ease, box-shadow 0.3s ease, background 0.3s ease;
      border-right: 5px solid #c97d60;
      border-top: 1px solid rgba(200, 125, 96, 0.2);
      border-bottom: 1px solid rgba(200, 125, 96, 0.2);
      border-left: 1px solid rgba(200, 125, 96, 0.2);
    }

    .service-item:hover {
      transform: translateY(-6px);
      box-shadow: 0 8px 24px rgba(200, 125, 96, 0.2);
      background: #ffffff;
      border-right-color: #d4a574;
    }

    .service-title {
      font-size: 1.75rem;
      font-weight: 600;
      color: #2d1f14;
      margin: 0 0 1rem 0;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .service-title::before {
      content: '✦';
      color: #c97d60;
      font-size: 1.5rem;
      text-shadow: 0 1px 2px rgba(200, 125, 96, 0.3);
    }

    .service-text {
      font-size: 1.05rem;
      line-height: 1.85;
      color: #5c4a37;
      margin: 0;
      text-align: justify;
      direction: rtl;
    }

    .vision-section {
      margin-top: 4rem;
      padding: 3.5rem;
      background: linear-gradient(135deg, #fff8f3 0%, #faf0e6 100%);
      border-radius: 20px;
      box-shadow: 0 6px 24px rgba(61, 47, 31, 0.12);
      border: 1px solid rgba(200, 125, 96, 0.2);
      position: relative;
      overflow: hidden;
    }

    .vision-section::before {
      content: '';
      position: absolute;
      top: -50%;
      right: -50%;
      width: 200%;
      height: 200%;
      background: radial-gradient(circle, rgba(212, 165, 116, 0.05) 0%, transparent 70%);
      pointer-events: none;
    }

    .vision-section .section-title {
      position: relative;
      z-index: 1;
    }

    .vision-text {
      font-size: 1.15rem;
      line-height: 2;
      color: #3d2f1f;
      margin-bottom: 2rem;
      text-align: center;
      font-weight: 400;
      position: relative;
      z-index: 1;
    }

    .closing-text {
      font-size: 1.4rem;
      line-height: 1.8;
      color: #2d1f14;
      text-align: center;
      margin: 2rem 0 0 0;
      font-weight: 500;
      position: relative;
      z-index: 1;
    }

    .closing-text strong {
      color: #c97d60;
      font-weight: 700;
      font-size: 1.6rem;
      text-shadow: 0 1px 2px rgba(200, 125, 96, 0.2);
    }

    @media (max-width: 768px) {
      .main-title {
        font-size: 2.5rem;
      }

      .subtitle {
        font-size: 1.2rem;
      }

      .intro-text {
        font-size: 1.1rem;
        padding: 1.5rem;
      }

      .section-title {
        font-size: 1.75rem;
      }

      .service-item {
        padding: 1.5rem;
        border-right-width: 4px;
      }

      .vision-section {
        padding: 2rem;
      }

      .container {
        padding: 0 1rem;
      }

      .content-section {
        padding: 2.5rem 0;
      }

      .hero-section {
        padding: 3rem 0 2rem;
      }
    }
  `]
})
export class AboutComponent {}
