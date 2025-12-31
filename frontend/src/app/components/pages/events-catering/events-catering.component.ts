import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ContactService } from '../../../services/contact.service';

@Component({
  selector: 'app-events-catering',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="events-catering-page">
      <div class="container">
        <!-- Hero Section -->
        <div class="hero-section">
          <h1>קייטרינג לאירועים</h1>
          <p class="hero-subtitle">אוכל מצוין שעושה רושם ונשאר בזיכרון</p>
          <p class="hero-description">
            מחפשים קייטרינג לאירועים שמשלב טעם מעולה, נראות מרשימה ושירות שאפשר לסמוך עליו באמת?<br>
            בקייטרינג מגדים אתם מקבלים תפריט איכותי, גמיש ומדויק – כזה שגורם לאורחים לדבר על האוכל הרבה אחרי שהאירוע נגמר.
          </p>
          <p class="hero-description">
            אנחנו מלווים אתכם משלב התכנון ועד האספקה, עם דגש על אוכל טרי, מגוון רחב והתאמה מלאה לאופי האירוע והתקציב.
          </p>
        </div>

        <!-- Bar Section -->
        <section class="package-section">
          <div class="section-header">
            <h2>בר קבלת פנים – פתיחה שמרימה את האירוע מהשנייה הראשונה</h2>
            <p class="section-intro">רושם ראשוני הוא קריטי – ובר קבלת הפנים שלנו עושה בדיוק את זה.</p>
          </div>

          <div class="packages-grid">
            <div class="package-card">
              <div class="package-header">
                <h3>בר קבלת פנים</h3>
                <div class="package-price">30 ₪ למנה</div>
              </div>
              <ul class="package-features">
                <li>✔ בחירה של 4 סוגים</li>
                <li>✔ 2 מנות בשריות + 2 מנות צמחוניות</li>
              </ul>
            </div>

            <div class="package-card featured">
              <div class="package-badge">מומלץ</div>
              <div class="package-header">
                <h3>בר קבלת פנים משודרג</h3>
                <div class="package-price">45 ₪ למנה</div>
              </div>
              <ul class="package-features">
                <li>✔ בחירה של 6 סוגים עשירים ומגוונים</li>
                <li>✔ אידיאלי לאירועים שרוצים "וואו" כבר בכניסה</li>
              </ul>
            </div>
          </div>
        </section>

        <!-- Starters Section -->
        <section class="package-section">
          <div class="section-header">
            <h2>מנות ראשונות – איזון מושלם לפני העיקרית</h2>
          </div>
          <div class="package-card single">
            <div class="package-header">
              <h3>מנה ראשונה</h3>
              <div class="package-price">20 ₪ למנה</div>
            </div>
            <ul class="package-features">
              <li>✔ בחירה של 2 סוגים</li>
              <li>✔ מוגשות בצורה מוקפדת ומזמינה</li>
            </ul>
          </div>
        </section>

        <!-- Main Courses Section -->
        <section class="package-section highlight">
          <div class="section-header">
            <h2>מנות עיקריות – הלב של האירוע</h2>
            <p class="section-intro">כאן האורחים באמת זוכרים אתכם.</p>
          </div>
          <div class="package-card single main-course">
            <div class="package-header">
              <h3>מנה עיקרית</h3>
              <div class="package-price">70 ₪ למנה</div>
            </div>
            <ul class="package-features">
              <li>✔ בחירה של 2 מנות עיקריות</li>
              <li>✔ 3 סוגי תוספות לבחירה</li>
              <li>✔ שילוב בין טעמים אהובים לקלאסיקות מנצחות</li>
            </ul>
            <div class="package-addon">
              <strong>➕ תוספת של מנה עיקרית שלישית – 5 ₪ בלבד למנה</strong>
              <span class="addon-note">(פתרון מושלם לקהל מגוון)</span>
            </div>
          </div>
        </section>

        <!-- Desserts Section -->
        <section class="package-section">
          <div class="section-header">
            <h2>קינוחים – סיום מתוק שעושה חשק לעוד</h2>
          </div>
          <div class="package-card single">
            <div class="package-header">
              <h3>קינוחי ביסקוטי</h3>
              <div class="package-price">8 ₪ לאדם</div>
            </div>
            <ul class="package-features">
              <li>✔ קינוחי ביס איכותיים</li>
              <li>✔ סוגרים את האירוע עם חיוך</li>
            </ul>
          </div>
        </section>

        <!-- Kashrut Section -->
        <section class="package-section kashrut-section">
          <div class="kashrut-card">
            <div class="kashrut-icon">🕊️</div>
            <h3>כשרות מהודרת – שקט נפשי מלא</h3>
            <ul class="package-features">
              <li>✔ אפשרות לכשרות מהדרין מחפוד (בשר ועוף)</li>
              <li class="addon">➕ תוספת של 7 ₪ למנה</li>
            </ul>
          </div>
        </section>

        <!-- Why Choose Us Section -->
        <section class="why-choose-section">
          <h2>למה לבחור בקייטרינג מגדים?</h2>
          <div class="benefits-grid">
            <div class="benefit-item">
              <i class="fas fa-check-circle"></i>
              <span>ניסיון באירועים פרטיים ועסקיים</span>
            </div>
            <div class="benefit-item">
              <i class="fas fa-check-circle"></i>
              <span>תפריט גמיש בהתאמה אישית</span>
            </div>
            <div class="benefit-item">
              <i class="fas fa-check-circle"></i>
              <span>מחירים הוגנים ושקופים</span>
            </div>
            <div class="benefit-item">
              <i class="fas fa-check-circle"></i>
              <span>עמידה בזמנים ללא פשרות</span>
            </div>
            <div class="benefit-item">
              <i class="fas fa-check-circle"></i>
              <span>שירות אישי וליווי לאורך כל הדרך</span>
            </div>
          </div>
          <p class="why-choose-tagline">אצלנו לא "סוגרים אוכל" – סוגרים אירוע בראש שקט.</p>
        </section>

        <!-- Terms Section -->
        <section class="terms-section">
          <h2>תנאים חשובים להזמנה</h2>
          <div class="terms-list">
            <div class="term-item">
              <i class="fas fa-info-circle"></i>
              <div>
                <strong>מינימום הזמנה:</strong> 600 ₪
              </div>
            </div>
            <div class="term-item">
              <i class="fas fa-clock"></i>
              <div>
                <strong>תאריך אחרון להזמנה:</strong> ניתן לבצע הזמנה עד יומיים לפני האספקה, עד השעה 13:00
              </div>
            </div>
            <div class="term-item">
              <i class="fas fa-utensils"></i>
              <div>
                <strong>תפריט מותאם:</strong> ניתן לבנות תפריט מותאם אישית לפי רצון הלקוח
              </div>
            </div>
            <div class="term-item">
              <i class="fas fa-plus-circle"></i>
              <div>
                <strong>תוספות:</strong> יין, שתייה, כלים חד־פעמיים ותפעול האירוע – בתוספת תשלום<br>
                <span class="term-note">(יש לציין בהערות ההזמנה)</span>
              </div>
            </div>
          </div>
        </section>

        <!-- Delivery Section -->
        <section class="delivery-section">
          <h2>משלוחים ואיסוף</h2>
          <div class="delivery-options">
            <div class="delivery-option">
              <i class="fas fa-car"></i>
              <h4>איסוף עצמי</h4>
              <p>מקייטרינג מגדים</p>
            </div>
            <div class="delivery-option">
              <i class="fas fa-truck"></i>
              <h4>משלוח עד הכתובת</h4>
              <p>בתשלום של 200–600 ₪ (בהתאם למרחק)</p>
            </div>
          </div>
        </section>

        <!-- CTA Section -->
        <section class="cta-section">
          <div class="cta-content">
            <h2>זה הזמן לסגור אירוע בלי להתלבט</h2>
            <div class="cta-buttons">
              <a routerLink="/contact" class="btn btn-primary">
                <i class="fas fa-phone"></i>
                צרו איתנו קשר עכשיו לקבלת הצעת מחיר מותאמת אישית
              </a>
              <a routerLink="/contact" class="btn btn-secondary">
                <i class="fas fa-calendar"></i>
                שריינו תאריך – ותנו לנו לדאוג שהאוכל יעשה את העבודה
              </a>
            </div>
          </div>
        </section>
      </div>
    </div>
  `,
  styles: [`
    .events-catering-page {
      padding: 3rem 0;
      min-height: 100vh;
      background: linear-gradient(to bottom, #fafafa 0%, #ffffff 100%);
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 2rem;
    }

    /* Hero Section */
    .hero-section {
      text-align: center;
      margin-bottom: 4rem;
      padding: 2rem 0;
    }

    .hero-section h1 {
      font-size: 3rem;
      color: #0E1A24;
      margin-bottom: 1rem;
      font-weight: bold;
    }

    .hero-subtitle {
      font-size: 1.5rem;
      color: #cbb69e;
      margin-bottom: 1.5rem;
      font-weight: 600;
    }

    .hero-description {
      font-size: 1.1rem;
      color: #6c757d;
      line-height: 1.8;
      max-width: 900px;
      margin: 0 auto 1rem;
    }

    /* Package Sections */
    .package-section {
      margin-bottom: 4rem;
      padding: 2.5rem;
      background: white;
      border-radius: 1rem;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
    }

    .package-section.highlight {
      background: linear-gradient(135deg, #0E1A24 0%, #1A2B37 100%);
      color: white;
    }

    .package-section.highlight .section-header h2,
    .package-section.highlight .section-intro {
      color: white;
    }

    .section-header {
      text-align: center;
      margin-bottom: 2rem;
    }

    .section-header h2 {
      font-size: 2rem;
      color: #0E1A24;
      margin-bottom: 0.75rem;
      font-weight: bold;
    }

    .section-intro {
      font-size: 1.1rem;
      color: #6c757d;
      font-style: italic;
    }

    .packages-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 2rem;
    }

    .package-card {
      background: #f8f9fa;
      border-radius: 1rem;
      padding: 2rem;
      border: 2px solid rgba(203, 182, 158, 0.2);
      position: relative;
      transition: all 0.3s ease;
    }

    .package-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
      border-color: #cbb69e;
    }

    .package-card.featured {
      background: linear-gradient(135deg, #cbb69e 0%, #d4c5b0 100%);
      border-color: #cbb69e;
    }

    .package-card.single {
      max-width: 600px;
      margin: 0 auto;
    }

    .package-card.main-course {
      background: rgba(255, 255, 255, 0.1);
      border-color: rgba(255, 255, 255, 0.3);
    }

    .package-badge {
      position: absolute;
      top: -12px;
      left: 50%;
      transform: translateX(-50%);
      background: #0E1A24;
      color: #cbb69e;
      padding: 0.5rem 1.5rem;
      border-radius: 2rem;
      font-weight: bold;
      font-size: 0.9rem;
    }

    .package-header {
      text-align: center;
      margin-bottom: 1.5rem;
    }

    .package-header h3 {
      font-size: 1.8rem;
      color: #0E1A24;
      margin-bottom: 0.5rem;
      font-weight: bold;
    }

    .package-card.featured .package-header h3,
    .package-card.main-course .package-header h3 {
      color: white;
    }

    .package-price {
      font-size: 2rem;
      font-weight: bold;
      color: #cbb69e;
    }

    .package-card.featured .package-price,
    .package-card.main-course .package-price {
      color: #0E1A24;
    }

    .package-features {
      list-style: none;
      padding: 0;
      margin: 0;
    }

    .package-features li {
      padding: 0.75rem 0;
      font-size: 1.05rem;
      color: #0E1A24;
      border-bottom: 1px solid rgba(0, 0, 0, 0.05);
    }

    .package-features li:last-child {
      border-bottom: none;
    }

    .package-card.featured .package-features li,
    .package-card.main-course .package-features li {
      color: white;
      border-bottom-color: rgba(255, 255, 255, 0.2);
    }

    .package-addon {
      margin-top: 1.5rem;
      padding-top: 1.5rem;
      border-top: 2px solid rgba(255, 255, 255, 0.3);
      text-align: center;
      color: white;
    }

    .addon-note {
      display: block;
      font-size: 0.9rem;
      opacity: 0.9;
      margin-top: 0.5rem;
    }

    /* Kashrut Section */
    .kashrut-section {
      background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
    }

    .kashrut-card {
      text-align: center;
      padding: 2rem;
    }

    .kashrut-icon {
      font-size: 3rem;
      margin-bottom: 1rem;
    }

    .kashrut-card h3 {
      font-size: 1.8rem;
      color: #0E1A24;
      margin-bottom: 1.5rem;
      font-weight: bold;
    }

    .kashrut-card .package-features li.addon {
      color: #cbb69e;
      font-weight: 600;
    }

    /* Why Choose Section */
    .why-choose-section {
      background: white;
      padding: 3rem 2.5rem;
      border-radius: 1rem;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
      margin-bottom: 4rem;
    }

    .why-choose-section h2 {
      text-align: center;
      font-size: 2rem;
      color: #0E1A24;
      margin-bottom: 2rem;
      font-weight: bold;
    }

    .benefits-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 1.5rem;
      margin-bottom: 2rem;
    }

    .benefit-item {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 1rem;
      background: #f8f9fa;
      border-radius: 0.5rem;
      font-size: 1.05rem;
      color: #0E1A24;
    }

    .benefit-item i {
      color: #cbb69e;
      font-size: 1.3rem;
    }

    .why-choose-tagline {
      text-align: center;
      font-size: 1.2rem;
      color: #cbb69e;
      font-weight: 600;
      font-style: italic;
      margin-top: 2rem;
    }

    /* Terms Section */
    .terms-section {
      background: white;
      padding: 2.5rem;
      border-radius: 1rem;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
      margin-bottom: 4rem;
    }

    .terms-section h2 {
      text-align: center;
      font-size: 2rem;
      color: #0E1A24;
      margin-bottom: 2rem;
      font-weight: bold;
    }

    .terms-list {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .term-item {
      display: flex;
      align-items: flex-start;
      gap: 1rem;
      padding: 1.5rem;
      background: #f8f9fa;
      border-radius: 0.5rem;
      border-right: 4px solid #cbb69e;
    }

    .term-item i {
      color: #cbb69e;
      font-size: 1.5rem;
      margin-top: 0.25rem;
    }

    .term-item strong {
      color: #0E1A24;
      display: block;
      margin-bottom: 0.5rem;
    }

    .term-item div {
      color: #6c757d;
      line-height: 1.6;
    }

    .term-note {
      display: block;
      font-size: 0.9rem;
      color: #999;
      margin-top: 0.5rem;
    }

    /* Delivery Section */
    .delivery-section {
      background: white;
      padding: 2.5rem;
      border-radius: 1rem;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
      margin-bottom: 4rem;
    }

    .delivery-section h2 {
      text-align: center;
      font-size: 2rem;
      color: #0E1A24;
      margin-bottom: 2rem;
      font-weight: bold;
    }

    .delivery-options {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 2rem;
    }

    .delivery-option {
      text-align: center;
      padding: 2rem;
      background: #f8f9fa;
      border-radius: 1rem;
      border: 2px solid rgba(203, 182, 158, 0.2);
    }

    .delivery-option i {
      font-size: 2.5rem;
      color: #cbb69e;
      margin-bottom: 1rem;
    }

    .delivery-option h4 {
      font-size: 1.3rem;
      color: #0E1A24;
      margin-bottom: 0.5rem;
      font-weight: bold;
    }

    .delivery-option p {
      color: #6c757d;
      font-size: 1rem;
    }

    /* CTA Section */
    .cta-section {
      background: linear-gradient(135deg, #0E1A24 0%, #1A2B37 100%);
      padding: 4rem 2.5rem;
      border-radius: 1rem;
      text-align: center;
      color: white;
    }

    .cta-content h2 {
      font-size: 2.2rem;
      color: #cbb69e;
      margin-bottom: 2rem;
      font-weight: bold;
    }

    .cta-buttons {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      max-width: 600px;
      margin: 0 auto;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.75rem;
      padding: 1.25rem 2rem;
      border-radius: 0.5rem;
      font-weight: 700;
      font-size: 1.05rem;
      text-decoration: none;
      transition: all 0.3s ease;
      border: none;
      cursor: pointer;
    }

    .btn-primary {
      background: #cbb69e;
      color: #0E1A24;
    }

    .btn-primary:hover {
      background: #b8a48a;
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(203, 182, 158, 0.4);
    }

    .btn-secondary {
      background: transparent;
      color: white;
      border: 2px solid #cbb69e;
    }

    .btn-secondary:hover {
      background: #cbb69e;
      color: #0E1A24;
      transform: translateY(-2px);
    }

    /* Responsive Design */
    @media (max-width: 1024px) {
      .packages-grid {
        grid-template-columns: 1fr;
      }

      .delivery-options {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 768px) {
      .hero-section h1 {
        font-size: 2.2rem;
      }

      .hero-subtitle {
        font-size: 1.2rem;
      }

      .package-section {
        padding: 1.5rem;
      }

      .section-header h2 {
        font-size: 1.6rem;
      }

      .benefits-grid {
        grid-template-columns: 1fr;
      }

      .cta-buttons {
        flex-direction: column;
      }

      .btn {
        width: 100%;
      }
    }
  `]
})
export class EventsCateringComponent {
  contactService = inject(ContactService);
}
