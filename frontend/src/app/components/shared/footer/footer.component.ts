import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';

import { LanguageService } from '../../../services/language.service';
import { ContactService } from '../../../services/contact.service';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule],
  template: `
    <footer class="main-footer">
      <div class="container">
        <!-- Quote Request Section - Top Center -->
        <div class="quote-request-section">
          <div class="quote-request-content">
            <h3 class="quote-title">רוצה הצעת מחיר לאירוע?</h3>
            <p class="quote-description">מלא את הפרטים ונחזור אליך בהקדם עם הצעת מחיר מותאמת אישית</p>
            
            <form [formGroup]="contactForm" (ngSubmit)="onSubmit()" class="quote-contact-form">
              <div class="quote-form-row">
                <div class="form-group">
                  <input 
                    type="text" 
                    formControlName="name"
                    class="form-input"
                    placeholder="שם מלא"
                    [attr.aria-label]="languageService.strings.name"
                  >
                  <div class="error-message" *ngIf="contactForm.get('name')?.invalid && contactForm.get('name')?.touched">
                    שם חובה
                  </div>
                </div>
                
                <div class="form-group">
                  <input 
                    type="tel" 
                    formControlName="phone"
                    class="form-input"
                    placeholder="טלפון (למשל: 0528240230)"
                    [attr.aria-label]="languageService.strings.phone"
                  >
                  <div class="error-message" *ngIf="contactForm.get('phone')?.invalid && contactForm.get('phone')?.touched">
                    <span *ngIf="contactForm.get('phone')?.errors?.['required']">טלפון חובה</span>
                    <span *ngIf="contactForm.get('phone')?.errors?.['pattern']">מספר טלפון לא תקין</span>
                  </div>
                </div>
                
                <div class="form-group">
                  <select 
                    formControlName="eventType"
                    class="form-select"
                    [attr.aria-label]="'סוג האירוע'"
                  >
                    <option value="">בחר סוג אירוע</option>
                    <option value="בר מצווה">בר מצווה</option>
                    <option value="ברית">ברית</option>
                    <option value="חתונה">חתונה</option>
                    <option value="שמחת תורה">שמחת תורה</option>
                    <option value="אירוע עסקי">אירוע עסקי</option>
                    <option value="יום הולדת">יום הולדת</option>
                    <option value="אירוע משפחתי">אירוע משפחתי</option>
                    <option value="אחר">אחר</option>
                  </select>
                </div>
              </div>
              
              <div class="form-group">
                <textarea 
                  formControlName="message"
                  class="form-textarea"
                  rows="2"
                  placeholder="פרטים נוספים על האירוע (אופציונלי)"
                  [attr.aria-label]="languageService.strings.message"
                ></textarea>
              </div>
              
              <div class="form-group">
                <button 
                  type="submit" 
                  class="btn btn-quote-submit"
                  [disabled]="contactForm.invalid || isSubmitting"
                >
                  <span *ngIf="isSubmitting">
                    <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
                    שולח...
                  </span>
                  <span *ngIf="!isSubmitting">
                    <i class="fas fa-paper-plane" aria-hidden="true"></i>
                    שלח בקשה
                  </span>
                </button>
              </div>
              
              <div class="form-success" *ngIf="showSuccess">
                <i class="fas fa-check-circle" aria-hidden="true"></i>
                <span>הבקשה נשלחה בהצלחה! נחזור אליך בהקדם.</span>
              </div>
              
              <div class="form-error" *ngIf="showError">
                <i class="fas fa-exclamation-circle" aria-hidden="true"></i>
                <span>שגיאה בשליחת הבקשה. אנא נסה שוב.</span>
              </div>
            </form>
          </div>
        </div>
        
        <div class="footer-content">
          <!-- Company Info -->
          <div class="footer-section company-info">
            <div class="footer-logo">
              <h3 class="logo-text">{{ languageService.strings.heroTitle }}</h3>
              <p class="logo-subtitle">{{ languageService.strings.heroSubtitle }}</p>
            </div>
            
            <p class="company-description">
              שירותי קייטרינג כשר מפוקח ברמה הגבוהה ביותר. אוכל ביתי ברמת שף, 
              מתמחים באירועים משפחתיים ועסקיים, אוכל מוכן לשבת וחגים.
            </p>
            
            <div class="social-links">
              <a 
                href="tel:{{ contactInfo.phone }}" 
                class="social-link phone-link"
                [attr.aria-label]="'התקשרו למספר ' + contactInfo.phone"
              >
                <i class="fas fa-phone" aria-hidden="true"></i>
              </a>
              <a 
                href="https://wa.me/972{{ contactInfo.whatsapp.substring(1) }}" 
                target="_blank"
                rel="noopener noreferrer"
                class="social-link whatsapp-link"
                aria-label="שלחו הודעה בוואטסאפ"
              >
                <i class="fab fa-whatsapp" aria-hidden="true"></i>
              </a>
              <a 
                href="https://instagram.com/magadim" 
                target="_blank"
                rel="noopener noreferrer"
                class="social-link instagram-link"
                aria-label="עקבו אחרינו באינסטגרם"
              >
                <i class="fab fa-instagram" aria-hidden="true"></i>
              </a>
              <a 
                href="https://facebook.com/magadim" 
                target="_blank"
                rel="noopener noreferrer"
                class="social-link facebook-link"
                aria-label="עקבו אחרינו בפייסבוק"
              >
                <i class="fab fa-facebook-f" aria-hidden="true"></i>
              </a>
            </div>
          </div>
          
          <!-- Quick Links -->
          <div class="footer-section quick-links">
            <h4 class="section-title">{{ languageService.strings.quickLinks }}</h4>
            <ul class="links-list">
              <li>
                <a routerLink="/" [attr.aria-label]="languageService.strings.home">
                  {{ languageService.strings.home }}
                </a>
              </li>
              <li>
                <a routerLink="/about" [attr.aria-label]="languageService.strings.about">
                  {{ languageService.strings.about }}
                </a>
              </li>
              <li>
                <a routerLink="/events-catering" [attr.aria-label]="languageService.strings.eventsCatering">
                  {{ languageService.strings.eventsCatering }}
                </a>
              </li>
              <li>
                <a routerLink="/ready-for-shabbat" [attr.aria-label]="languageService.strings.readyForShabbat">
                  {{ languageService.strings.readyForShabbat }}
                </a>
              </li>
              <li>
                <a routerLink="/cholent-bar" [attr.aria-label]="languageService.strings.cholentBar">
                  {{ languageService.strings.cholentBar }}
                </a>
              </li>
              <li>
                <a routerLink="/kosher" [attr.aria-label]="languageService.strings.kosherCertificate">
                  {{ languageService.strings.kosherCertificate }}
                </a>
              </li>
              <li>
                <a routerLink="/contact" [attr.aria-label]="languageService.strings.contact">
                  {{ languageService.strings.contact }}
                </a>
              </li>
            </ul>
          </div>
          
          <!-- Contact Info -->
          <div class="footer-section contact-info">
            <h4 class="section-title">פרטי התקשרות</h4>
            <div class="contact-details">
              <div class="contact-item">
                <i class="fas fa-phone" aria-hidden="true"></i>
                <div class="contact-content">
                  <strong>טלפון:</strong>
                  <a href="tel:{{ contactInfo.phone }}">{{ contactInfo.phone }}</a>
                </div>
              </div>
              
              <div class="contact-item">
                <i class="fab fa-whatsapp" aria-hidden="true"></i>
                <div class="contact-content">
                  <strong>וואטסאפ:</strong>
                  <a 
                    href="https://wa.me/972{{ contactInfo.whatsapp.substring(1) }}"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {{ contactInfo.whatsapp }}
                  </a>
                </div>
              </div>
              
              <div class="contact-item">
                <i class="fas fa-envelope" aria-hidden="true"></i>
                <div class="contact-content">
                  <strong>אימייל:</strong>
                  <a href="mailto:{{ contactInfo.email }}">{{ contactInfo.email }}</a>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Business Hours -->
          <div class="footer-section business-info">
            <h4 class="section-title">{{ languageService.strings.businessHours }}</h4>
            <p class="business-hours">{{ contactInfo.businessHours }}</p>
            
            <div class="kosher-info">
              <i class="fas fa-certificate" aria-hidden="true"></i>
              <span>כשר מפוקח</span>
            </div>
          </div>
          
        </div>
        
        <!-- Footer Bottom -->
        <div class="footer-bottom">
          <div class="footer-bottom-content">
            <p class="copyright">
              &copy; {{ currentYear }} {{ languageService.strings.rights }}
            </p>
            
            <div class="footer-bottom-links">
              <a routerLink="/kosher" class="bottom-link">הכשרות</a>
              <span class="divider">|</span>
              <a routerLink="/contact" class="bottom-link">צור קשר</a>
              <span class="divider">|</span>
              <button class="bottom-link language-toggle" (click)="languageService.toggleLanguage()">
                {{ currentLanguage === 'he' ? 'English' : 'עברית' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </footer>
  `,
  styleUrls: ['./footer.component.scss']
})
export class FooterComponent implements OnInit {
  languageService = inject(LanguageService);
  contactService = inject(ContactService);
  private fb = inject(FormBuilder);
  
  contactInfo = this.contactService.getContactInfo();
  currentYear = new Date().getFullYear();
  currentLanguage = 'he';
  
  contactForm: FormGroup;
  isSubmitting = false;
  showSuccess = false;
  showError = false;

  constructor() {
    this.contactForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      phone: ['', [Validators.required, Validators.pattern(/^[0-9]{9,10}$/)]],
      eventType: [''],
      message: ['']
    });
  }

  ngOnInit(): void {
    // Subscribe to language changes
    this.languageService.currentLanguage$.subscribe(lang => {
      this.currentLanguage = lang;
    });
  }

  onSubmit(): void {
    if (this.contactForm.invalid) {
      this.contactForm.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    this.showSuccess = false;
    this.showError = false;

    const formData = this.contactForm.value;

    this.contactService.submitContactForm(formData).subscribe({
      next: (response) => {
        if (response.success) {
          this.showSuccess = true;
          this.contactForm.reset();
          setTimeout(() => {
            this.showSuccess = false;
          }, 5000);
        } else {
          this.showError = true;
          setTimeout(() => {
            this.showError = false;
          }, 5000);
        }
        this.isSubmitting = false;
      },
      error: (error) => {
        console.error('Error submitting contact form:', error);
        this.showError = true;
        this.isSubmitting = false;
        setTimeout(() => {
          this.showError = false;
        }, 5000);
      }
    });
  }
}
