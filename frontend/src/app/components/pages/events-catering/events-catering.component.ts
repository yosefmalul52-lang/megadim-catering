import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { SiteSettingsService, SiteSettings } from '../../../services/site-settings.service';
import { PageBannerComponent } from '../../shared/page-banner/page-banner.component';
import { PagePopupComponent } from '../../shared/page-popup/page-popup.component';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-events-catering',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule, PageBannerComponent, PagePopupComponent],
  templateUrl: './events-catering.component.html',
  styleUrls: ['./events-catering.component.scss']
})
export class EventsCateringComponent implements OnInit {
  private http = inject(HttpClient);
  settingsService = inject(SiteSettingsService);

  settings: SiteSettings | null = null;
  showPopup = false;

  showOrderForm = false;
  isSubmitting = false;
  submitSuccess = false;
  submitError = '';

  readonly EVENT_TYPES = [
    'חתונה',
    'בר / בת מצווה',
    'אירוע עסקי',
    'יום הולדת',
    'ברית / קידוש',
    'סיום / מסיבה',
    'אחר'
  ];

  // ─── Product lists (same as Shabbat catering) ───────────────────────────────

  readonly saladOptions: string[] = [
    'חומוס',
    'טחינה',
    'מטבוחה',
    'חציל פיקנטי',
    'חציל במיונז',
    'חציל בטחינה',
    'סחוג',
    'חילבה',
    'אנטיפסטי',
    'סלט גזר מרוקאי',
    'סלט סלק מזרחי',
    'סלט ביצים',
    'סלט קצוץ ישראלי',
    'סלט וולדורף',
    'גזר מגורד בלימון',
    'כרוב לבן וחמוציות',
    'קולוסלאו',
    'כרוב בסגנון אסיאתי',
    'שרי פסטו',
    'סלט חסה עם שרי',
    'טאבולה',
    'חמוצי הבית',
    'סלט תירס'
  ];

  readonly firstCourseOptions: string[] = [
    'פילה אמנון מזרחי',
    'פילה אמנון בעשבי תיבול',
    'פילה סלמון בחרדל ודבש',
    'פילה סלמון בטריאקי',
    'פילה סלמון בעשבי תיבול',
    'גלילות חצילים במילוי בשר',
    'תחתיות ארטישוק במילוי בשר',
    'כבד קצוץ',
    'בצל ממולא בשר ואורז',
    'פלפל ממולא בשר ואורז',
    'בצל ממולא אורז',
    'פלפל ממולא אורז'
  ];

  readonly mainCourseOptions: string[] = [
    'כרעיים עוף בסילאן',
    'כרעיים עוף בעשבי תיבול',
    'אסאדו בסגנון ארגנטינאי',
    'צלי בקר ברוטב',
    'פרגית בטריאקי',
    'פרגית בעשבי תיבול',
    'פרגית מונטריאון',
    'שוקיים בצ\'ילי',
    'שניצל',
    'שניצלונים',
    'שוק טלה',
    'צ\'ולנט'
  ];

  readonly sideDishOptions: string[] = [
    'אורז לבן',
    'אורז בקארי וירקות',
    'אורז שקדים וצימוקים במייפל',
    'תפו"א פריזיאן בסגנון מזרחי',
    'סירות תפו"א ובטטה',
    'זיתים ברוטב פיקנטי',
    'קוסקוס עם ירקות בסגנון טריפולטאי',
    'ירקות מוקפצים',
    'שעועית ירוקה מוקפצת בסגנון סיני'
  ];

  readonly saladIndexes = [1, 2, 3, 4, 5, 6];
  readonly firstCourseIndexes = [1, 2];
  readonly mainCourseIndexes = [1, 2];
  readonly sideIndexes = [1, 2, 3];

  // ─── Form state ──────────────────────────────────────────────────────────────

  orderForm = {
    fullName: '',
    phone: '',
    email: '',
    eventDate: '',
    eventType: '',
    guestCount: null as number | null,
    venue: '',
    receptionBar: false,
    receptionBarVariant: '' as '' | 'standard' | 'premium',
    salads: [] as string[],
    firstCourses: [] as string[],
    mainCourses: [] as string[],
    sides: [] as string[],
    desserts: false,
    kosherUpgrade: false,
    deliveryType: '' as '' | 'pickup' | 'delivery',
    address: '',
    notes: ''
  };

  // ─── Lifecycle ───────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.settingsService.getSettings(true).subscribe(settings => {
      this.settings = settings;
      const ev = settings?.pageAnnouncements?.['events'];
      if ((ev?.popupTitle?.trim() ?? '') !== '' || (ev?.popupText?.trim() ?? '') !== '') {
        this.showPopup = true;
      }
    });
  }

  // ─── Modal control ───────────────────────────────────────────────────────────

  closePopup(): void {
    this.showPopup = false;
  }

  openOrderForm(): void {
    this.showOrderForm = true;
    this.submitSuccess = false;
    this.submitError = '';
    document.body.style.overflow = 'hidden';
  }

  closeOrderForm(): void {
    this.showOrderForm = false;
    this.submitSuccess = false;
    this.submitError = '';
    document.body.style.overflow = '';
    this.resetForm();
  }

  private resetForm(): void {
    this.orderForm = {
      fullName: '',
      phone: '',
      email: '',
      eventDate: '',
      eventType: '',
      guestCount: null,
      venue: '',
      receptionBar: false,
      receptionBarVariant: '',
      salads: [],
      firstCourses: [],
      mainCourses: [],
      sides: [],
      desserts: false,
      kosherUpgrade: false,
      deliveryType: '',
      address: '',
      notes: ''
    };
  }

  // ─── Submit ──────────────────────────────────────────────────────────────────

  submitOrder(): void {
    if (this.isSubmitting) return;
    this.submitError = '';

    // Hebrew client-side validation
    const missing: string[] = [];
    if (!this.orderForm.fullName?.trim()) missing.push('שם מלא');
    if (!this.orderForm.phone?.trim()) missing.push('טלפון');
    if (!this.orderForm.email?.trim()) missing.push('אימייל');
    if (!this.orderForm.guestCount || this.orderForm.guestCount < 1) missing.push('מספר אורחים');
    if (!this.orderForm.eventType?.trim()) missing.push('סוג האירוע');
    if (!this.orderForm.eventDate?.trim()) missing.push('תאריך האירוע');

    if (missing.length > 0) {
      this.submitError = `נא למלא את השדות הבאים: ${missing.join(', ')}`;
      return;
    }

    this.isSubmitting = true;

    this.http
      .post<{ success: boolean; message?: string }>(
        `${environment.apiUrl}/catering/events`,
        { ...this.orderForm }
      )
      .subscribe({
        next: () => {
          this.isSubmitting = false;
          this.submitSuccess = true;
          this.resetForm();
          document.body.style.overflow = 'hidden'; // keep modal visible on success
        },
        error: (err) => {
          this.isSubmitting = false;
          this.submitError =
            err?.error?.message ||
            (err?.status === 0
              ? 'לא ניתן להתחבר לשרת. בדוק חיבור לאינטרנט.'
              : 'אירעה שגיאה בשליחת הבקשה. נסה שוב.');
        }
      });
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  get eventsMenuUrl(): string {
    return this.settings?.eventsMenuUrl || '';
  }

  hasMenuUrl(): boolean {
    return !!this.eventsMenuUrl && this.eventsMenuUrl.trim() !== '';
  }
}
