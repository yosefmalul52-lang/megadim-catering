import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { SiteSettingsService, SiteSettings } from '../../../services/site-settings.service';
import { PageBannerComponent } from '../../shared/page-banner/page-banner.component';
import { PagePopupComponent } from '../../shared/page-popup/page-popup.component';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-holiday-food',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatIconModule,
    MatButtonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatNativeDateModule,
    PageBannerComponent,
    PagePopupComponent
  ],
  templateUrl: './holiday-food.component.html',
  styleUrls: ['./holiday-food.component.scss']
})
export class HolidayFoodComponent implements OnInit {
  settingsService = inject(SiteSettingsService);
  private http = inject(HttpClient);
  settings: SiteSettings | null = null;
  eventsMenuUrl: string = '';
  showPopup = false;
  isSubmitting = false;

  isOrderFormOpen: boolean = false;
  
  // Arrays for dropdown loops
  saladIndexes = [1, 2, 3, 4, 5, 6, 7, 8];
  firstCourseIndexes = [1, 2, 3, 4];
  mainCourseIndexes = [1, 2, 3, 4];
  sidesEveningIndexes = [1, 2, 3];
  sidesMorningIndexes = [1, 2];
  
  // Salad options
  saladOptions: string[] = [
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
  
  // First course options
  firstCourseOptions: string[] = [
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
  
  // Main course options
  mainCourseOptions: string[] = [
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
  
  // Side dish options
  sideDishOptions: string[] = [
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

  // --- Dynamic business logic state ---
  readonly blockedHolidays: string[] = [
    // Placeholder examples – can be loaded from settings later
    '2026-04-23',
    '2026-05-02'
  ];

  minEventDate: string = '';
  minEventDateObj: Date | null = null;
  eventDateError: string | null = null;

  eventDateControl: Date | null = null;

  isEveningSidesEnabled = false;
  isMorningSidesEnabled = false;

  maxMainCourses = 2;
  maxFirstCourses = 2;
  mainCoursesError: string | null = null;
  firstCoursesError: string | null = null;

  /** כשרק סעודה אחת נבחרה – מציגים רק 2 בחירות למנה ראשונה ולמנה עיקרית */
  getFirstCourseIndexes(): number[] {
    return this.maxFirstCourses === 2 ? [1, 2] : [1, 2, 3, 4];
  }
  getMainCourseIndexes(): number[] {
    return this.maxMainCourses === 2 ? [1, 2] : [1, 2, 3, 4];
  }
  
  // Form data
  orderForm = {
    fullName: '',
    phone: '',
    email: '',
    numberOfPortions: '',
    eventDate: '',
    mealTime: '',
    salads: [] as string[],
    firstCourses: [] as string[],
    mainCourses: [] as string[],
    sidesEvening: [] as string[],
    sidesMorning: [] as string[],
    seudaShlishit: 'no',
    deliveryType: '',
    address: '',
    remarks: ''
  };

  // Disable dates before min date, all Saturdays, and blocked holidays
  dateFilter = (d: Date | null): boolean => {
    if (!d) {
      return false;
    }
    const day = d.getDay();
    const iso = d.toISOString().substring(0, 10);

    if (this.minEventDateObj && d < this.minEventDateObj) {
      return false;
    }

    // Block Saturdays
    if (day === 6) {
      return false;
    }

    // Block holidays
    if (this.blockedHolidays.includes(iso)) {
      return false;
    }

    return true;
  };

  private formatDateForInput(date: Date): string {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  onEventDateChange(value: Date | null): void {
    this.eventDateControl = value;
    this.eventDateError = null;

    if (!value) {
      this.orderForm.eventDate = '';
      return;
    }

    // If date is not allowed by filter, clear it
    if (!this.dateFilter(value)) {
      this.orderForm.eventDate = '';
      this.eventDateError = 'נא לבחור תאריך הספקה תקין.';
      return;
    }

    const iso = value.toISOString().substring(0, 10);
    this.orderForm.eventDate = iso;
  }

  onMealTimeChange(value: 'evening' | 'morning' | 'both'): void {
    this.orderForm.mealTime = value;

    this.isEveningSidesEnabled = value === 'evening' || value === 'both';
    this.isMorningSidesEnabled = value === 'morning' || value === 'both';

    if (!this.isEveningSidesEnabled) {
      this.orderForm.sidesEvening = [];
    }
    if (!this.isMorningSidesEnabled) {
      this.orderForm.sidesMorning = [];
    }

    const oneMeal = value !== 'both';
    this.maxMainCourses = oneMeal ? 2 : 4;
    this.maxFirstCourses = oneMeal ? 2 : 4;

    if (oneMeal) {
      this.orderForm.firstCourses[2] = '';
      this.orderForm.firstCourses[3] = '';
      this.orderForm.mainCourses[2] = '';
      this.orderForm.mainCourses[3] = '';
      this.firstCoursesError = null;
      this.mainCoursesError = null;
    } else {
      this.firstCoursesError = null;
      this.mainCoursesError = null;
    }
  }

  onFirstCourseChange(index: number): void {
    const selected = this.orderForm.firstCourses.filter(v => v && v.trim() !== '');
    this.firstCoursesError = null;
    if (selected.length > this.maxFirstCourses && index >= 0) {
      this.orderForm.firstCourses[index] = '';
    }
  }

  onMainCourseChange(index: number): void {
    const selected = this.orderForm.mainCourses.filter(v => v && v.trim() !== '');
    this.mainCoursesError = null;
    if (selected.length > this.maxMainCourses && index >= 0) {
      this.orderForm.mainCourses[index] = '';
    }
  }
  toggleOrderForm() {
    this.isOrderFormOpen = !this.isOrderFormOpen;
    if (this.isOrderFormOpen) {
      document.body.style.overflow = 'hidden'; // Prevent background scroll
    } else {
      document.body.style.overflow = '';
    }
  }
  
  submitOrder() {
    if (this.isSubmitting) return;
    if (this.eventDateControl) {
      this.orderForm.eventDate = this.eventDateControl.toISOString().slice(0, 10);
    }
    this.isSubmitting = true;
    this.http
      .post<{ success: boolean; message?: string }>(`${environment.apiUrl}/catering`, this.orderForm)
      .subscribe({
        next: () => {
          this.isSubmitting = false;
          alert('ההזמנה נשלחה בהצלחה!');
          this.toggleOrderForm();
        },
        error: (err) => {
          this.isSubmitting = false;
          const msg =
            err?.error?.message ||
            (err?.status === 0 ? 'לא ניתן להתחבר לשרת. בדוק חיבור לאינטרנט.' : 'אירעה שגיאה בשליחת ההזמנה. נסה שוב.');
          alert(msg);
        }
      });
  }
  
  closeModal() {
    this.toggleOrderForm();
  }

  ngOnInit(): void {
    // Initialize minimum event date (48 hours from now)
    const today = new Date();
    const min = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 2);
    this.minEventDate = this.formatDateForInput(min);
    this.minEventDateObj = min;

    this.settingsService.getSettings(true).subscribe(s => {
      this.settings = s || null;
      const hol = s?.pageAnnouncements?.['holiday'];
      if ((hol?.popupTitle?.trim() ?? '') !== '' || (hol?.popupText?.trim() ?? '') !== '') {
        this.showPopup = true;
      }
      // For now, use bundled PDF as the menu file
      this.eventsMenuUrl = '/assets/docs/shabbat-menu.pdf';
    });
  }

  openMenu(): void {
    console.log('Attempting to open menu URL:', this.eventsMenuUrl); // Debug log
    
    if (this.eventsMenuUrl) {
      // Force open in new tab
      window.open(this.eventsMenuUrl, '_blank'); 
    } else {
      console.error('Menu URL is missing or empty!');
      alert('קישור לתפריט טרם עודכן במערכת'); // Optional user feedback
    }
  }

  hasMenuUrl(): boolean {
    return !!this.eventsMenuUrl && this.eventsMenuUrl.trim() !== '';
  }

  closePopup(): void {
    this.showPopup = false;
  }
}
