import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
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
import { toYYYYMMDD } from '../../../utils/date.utils';
import {
  isDateOpenForOrdering,
  normalizeOpenDateRules,
  OpenDateSettings,
  resolveCutoffTime
} from '../../../utils/open-date-rules';

type MealTime = 'evening' | 'morning' | 'both' | '';

@Component({
  selector: 'app-holiday-food',
  standalone: true,
  imports: [
    CommonModule,
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
  submitSuccess = false;
  submitError = '';

  isOrderFormOpen: boolean = false;

  saladIndexes = [1, 2, 3, 4, 5, 6, 7, 8];
  readonly courseSlotIndexes = [1, 2];
  readonly sidesSlotIndexes = [1, 2, 3];

  saladOptions: string[] = [
    'חומוס', 'טחינה', 'מטבוחה', 'חציל פיקנטי', 'חציל במיונז', 'חציל בטחינה',
    'סחוג', 'חילבה', 'אנטיפסטי', 'סלט גזר מרוקאי', 'סלט סלק מזרחי', 'סלט ביצים',
    'סלט קצוץ ישראלי', 'סלט וולדורף', 'גזר מגורד בלימון', 'כרוב לבן וחמוציות',
    'קולוסלאו', 'כרוב בסגנון אסיאתי', 'שרי פסטו', 'סלט חסה עם שרי', 'טאבולה',
    'חמוצי הבית', 'סלט תירס'
  ];

  firstCourseOptions: string[] = [
    'פילה אמנון מזרחי', 'פילה אמנון בעשבי תיבול', 'פילה סלמון בחרדל ודבש',
    'פילה סלמון בטריאקי', 'פילה סלמון בעשבי תיבול', 'גלילות חצילים במילוי בשר',
    'תחתיות ארטישוק במילוי בשר', 'כבד קצוץ', 'בצל ממולא בשר ואורז',
    'פלפל ממולא בשר ואורז', 'בצל ממולא אורז', 'פלפל ממולא אורז'
  ];

  mainCourseOptions: string[] = [
    'כרעיים עוף בסילאן', 'כרעיים עוף בעשבי תיבול', 'אסאדו בסגנון ארגנטינאי',
    'צלי בקר ברוטב', 'פרגית בטריאקי', 'פרגית בעשבי תיבול', 'פרגית מונטריאון',
    'שוקיים בצ\'ילי', 'שניצל', 'שניצלונים', 'שוק טלה', 'צ\'ולנט'
  ];

  sideDishOptions: string[] = [
    'אורז לבן', 'אורז בקארי וירקות', 'אורז שקדים וצימוקים במייפל',
    'תפו"א פריזיאן בסגנון מזרחי', 'סירות תפו"א ובטטה', 'זיתים ברוטב פיקנטי',
    'קוסקוס עם ירקות בסגנון טריפולטאי', 'ירקות מוקפצים', 'שעועית ירוקה מוקפצת בסגנון סיני'
  ];

  readonly blockedHolidays: string[] = ['2026-04-23', '2026-05-02'];

  minEventDate: string = '';
  minEventDateObj: Date | null = null;
  eventDateError: string | null = null;
  eventDateControl: Date | null = null;
  openDateSettings: OpenDateSettings = { openDates: [], openDateRules: [] };
  minimumLeadDays = 2;
  eventDateCutoffHint = '';
  eventDateClosedMessage = '';

  showEveningPortions = false;
  showMorningPortions = false;
  portionsError: string | null = null;
  menuSelectionError: string | null = null;

  orderForm = {
    fullName: '',
    phone: '',
    email: '',
    portionsEvening: '' as string | number,
    portionsMorning: '' as string | number,
    eventDate: '',
    mealTime: '' as MealTime,
    salads: ['', '', '', '', '', '', '', ''] as string[],
    firstCoursesEvening: ['', ''] as string[],
    firstCoursesMorning: ['', ''] as string[],
    mainCoursesEvening: ['', ''] as string[],
    mainCoursesMorning: ['', ''] as string[],
    sidesEvening: ['', '', ''] as string[],
    sidesMorning: ['', '', ''] as string[],
    seudaShlishit: 'no',
    deliveryType: '',
    address: '',
    remarks: ''
  };

  dateFilter = (d: Date | null): boolean => {
    if (!d) return false;
    const day = d.getDay();
    const key = toYYYYMMDD(d);
    if (this.minEventDateObj) {
      const pick = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const min = new Date(
        this.minEventDateObj.getFullYear(),
        this.minEventDateObj.getMonth(),
        this.minEventDateObj.getDate()
      );
      if (pick < min) return false;
    }
    if (day === 6) return false;
    if (this.blockedHolidays.includes(key)) return false;
    return isDateOpenForOrdering(key, this.openDateSettings);
  };

  get showEveningMealBlock(): boolean {
    return this.orderForm.mealTime === 'evening' || this.orderForm.mealTime === 'both';
  }

  get showMorningMealBlock(): boolean {
    return this.orderForm.mealTime === 'morning' || this.orderForm.mealTime === 'both';
  }

  private formatDateForInput(date: Date): string {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  onEventDateChange(value: Date | null): void {
    this.eventDateControl = value;
    this.eventDateError = null;
    if (!value) {
      this.orderForm.eventDate = '';
      this.updateEventDateMessages(null);
      return;
    }
    if (!this.dateFilter(value)) {
      this.orderForm.eventDate = '';
      this.updateEventDateMessages(value);
      this.eventDateError = this.eventDateClosedMessage || 'נא לבחור תאריך הספקה פתוח להזמנות.';
      return;
    }
    this.orderForm.eventDate = toYYYYMMDD(value);
    this.updateEventDateMessages(value);
  }

  private updateEventDateMessages(date: Date | null): void {
    if (!date) {
      this.eventDateCutoffHint = '';
      this.eventDateClosedMessage = '';
      return;
    }
    const key = toYYYYMMDD(date);
    const cutoff = resolveCutoffTime(key, this.openDateSettings);
    if (!cutoff) {
      this.eventDateCutoffHint = '';
      this.eventDateClosedMessage = 'תאריך זה אינו פתוח להזמנות';
      return;
    }
    if (!isDateOpenForOrdering(key, this.openDateSettings)) {
      this.eventDateCutoffHint = '';
      this.eventDateClosedMessage = `ההזמנות לתאריך זה נסגרו בשעה ${cutoff}`;
      return;
    }
    this.eventDateClosedMessage = '';
    this.eventDateCutoffHint = `תאריך זה פתוח להזמנות עד ${cutoff}`;
  }

  private loadDeliverySettings(): void {
    this.http
      .get<{
        success: boolean;
        data: { openDates?: string[]; openDateRules?: { date: string; cutoffTime: string }[]; minimumLeadDays?: number };
      }>(`${environment.apiUrl}/settings/delivery`)
      .subscribe({
        next: (res) => {
          const data = res?.data;
          const openDates = Array.isArray(data?.openDates)
            ? data.openDates.filter((s): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s))
            : [];
          const openDateRules = normalizeOpenDateRules(data?.openDateRules);
          this.openDateSettings = { openDates, openDateRules };
          if (typeof data?.minimumLeadDays === 'number' && data.minimumLeadDays >= 0) {
            this.minimumLeadDays = data.minimumLeadDays;
          }
          const today = new Date();
          const min = new Date(today.getFullYear(), today.getMonth(), today.getDate() + this.minimumLeadDays);
          this.minEventDate = this.formatDateForInput(min);
          this.minEventDateObj = min;
          if (this.eventDateControl) {
            this.updateEventDateMessages(this.eventDateControl);
          }
        },
        error: () => {
          const today = new Date();
          const min = new Date(today.getFullYear(), today.getMonth(), today.getDate() + this.minimumLeadDays);
          this.minEventDate = this.formatDateForInput(min);
          this.minEventDateObj = min;
        }
      });
  }

  private clearArraySlots(arr: string[], keep = 0): void {
    for (let i = keep; i < arr.length; i++) arr[i] = '';
  }

  onMealTimeChange(value: 'evening' | 'morning' | 'both'): void {
    this.orderForm.mealTime = value;
    this.portionsError = null;
    this.menuSelectionError = null;

    this.showEveningPortions = value === 'evening' || value === 'both';
    this.showMorningPortions = value === 'morning' || value === 'both';

    if (!this.showEveningPortions) {
      this.orderForm.portionsEvening = '';
      this.clearArraySlots(this.orderForm.firstCoursesEvening);
      this.clearArraySlots(this.orderForm.mainCoursesEvening);
      this.clearArraySlots(this.orderForm.sidesEvening);
    }
    if (!this.showMorningPortions) {
      this.orderForm.portionsMorning = '';
      this.clearArraySlots(this.orderForm.firstCoursesMorning);
      this.clearArraySlots(this.orderForm.mainCoursesMorning);
      this.clearArraySlots(this.orderForm.sidesMorning);
    }
  }

  /** Dropdown options excluding items already chosen in the same group (current slot kept). */
  availableOptions(options: string[], selections: string[], slotIndex: number): string[] {
    const used = new Set<string>();
    selections.forEach((val, i) => {
      if (i !== slotIndex && val?.trim()) used.add(val.trim());
    });
    const current = selections[slotIndex]?.trim();
    return options.filter((opt) => !used.has(opt) || opt === current);
  }

  private nonEmptySelections(arr: string[]): string[] {
    return arr.filter((s) => s?.trim()).map((s) => s.trim());
  }

  private assertNoDuplicates(arr: string[], label: string): string | null {
    const selected = this.nonEmptySelections(arr);
    if (new Set(selected).size !== selected.length) {
      return `${label}: לא ניתן לבחור את אותו פריט פעמיים`;
    }
    return null;
  }

  private assertExactCount(arr: string[], count: number, label: string): string | null {
    const n = this.nonEmptySelections(arr).length;
    if (n !== count) {
      return `${label}: יש לבחור בדיוק ${count} פריטים`;
    }
    return null;
  }

  private assertCountRange(arr: string[], min: number, max: number, label: string): string | null {
    const n = this.nonEmptySelections(arr).length;
    if (n < min || n > max) {
      return `${label}: יש לבחור בין ${min} ל-${max} פריטים`;
    }
    return null;
  }

  private parsePositivePortion(value: string | number): number | null {
    const raw = String(value ?? '').trim();
    if (!raw) return null;
    const n = Number(raw);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) return null;
    return n;
  }

  private validatePortions(): string | null {
    const mealTime = this.orderForm.mealTime;
    if (!mealTime) return 'זמן הארוחה';

    if (mealTime === 'evening') {
      if (this.parsePositivePortion(this.orderForm.portionsEvening) === null) {
        return 'נא להזין כמות מנות לערב (מספר שלם גדול מ-0)';
      }
      return null;
    }
    if (mealTime === 'morning') {
      if (this.parsePositivePortion(this.orderForm.portionsMorning) === null) {
        return 'נא להזין כמות מנות לבוקר (מספר שלם גדול מ-0)';
      }
      return null;
    }
    if (this.parsePositivePortion(this.orderForm.portionsEvening) === null) {
      return 'נא להזין כמות מנות לערב (מספר שלם גדול מ-0)';
    }
    if (this.parsePositivePortion(this.orderForm.portionsMorning) === null) {
      return 'נא להזין כמות מנות לבוקר (מספר שלם גדול מ-0)';
    }
    return null;
  }

  private validateMenuSelection(): string | null {
    const mealTime = this.orderForm.mealTime;
    if (!mealTime) return 'זמן הארוחה';

    let err =
      this.assertNoDuplicates(this.orderForm.salads, 'סלטים') ||
      this.assertCountRange(this.orderForm.salads, 6, 8, 'סלטים');
    if (err) return err;

    if (this.showEveningMealBlock) {
      err =
        this.assertNoDuplicates(this.orderForm.firstCoursesEvening, 'מנות ראשונות לערב') ||
        this.assertExactCount(this.orderForm.firstCoursesEvening, 2, 'מנות ראשונות לערב') ||
        this.assertNoDuplicates(this.orderForm.mainCoursesEvening, 'מנות עיקריות לערב') ||
        this.assertExactCount(this.orderForm.mainCoursesEvening, 2, 'מנות עיקריות לערב') ||
        this.assertNoDuplicates(this.orderForm.sidesEvening, 'תוספות לערב') ||
        this.assertExactCount(this.orderForm.sidesEvening, 3, 'תוספות לערב');
      if (err) return err;
    }

    if (this.showMorningMealBlock) {
      err =
        this.assertNoDuplicates(this.orderForm.firstCoursesMorning, 'מנות ראשונות לבוקר') ||
        this.assertExactCount(this.orderForm.firstCoursesMorning, 2, 'מנות ראשונות לבוקר') ||
        this.assertNoDuplicates(this.orderForm.mainCoursesMorning, 'מנות עיקריות לבוקר') ||
        this.assertExactCount(this.orderForm.mainCoursesMorning, 2, 'מנות עיקריות לבוקר') ||
        this.assertNoDuplicates(this.orderForm.sidesMorning, 'תוספות לבוקר') ||
        this.assertExactCount(this.orderForm.sidesMorning, 3, 'תוספות לבוקר');
      if (err) return err;
    }

    return null;
  }

  private buildPortionsPayload(): {
    portionsEvening: number;
    portionsMorning: number;
    numberOfPortions: number;
  } {
    const mealTime = this.orderForm.mealTime;
    if (mealTime === 'evening') {
      const evening = this.parsePositivePortion(this.orderForm.portionsEvening)!;
      return { portionsEvening: evening, portionsMorning: 0, numberOfPortions: evening };
    }
    if (mealTime === 'morning') {
      const morning = this.parsePositivePortion(this.orderForm.portionsMorning)!;
      return { portionsEvening: 0, portionsMorning: morning, numberOfPortions: morning };
    }
    const evening = this.parsePositivePortion(this.orderForm.portionsEvening)!;
    const morning = this.parsePositivePortion(this.orderForm.portionsMorning)!;
    return { portionsEvening: evening, portionsMorning: morning, numberOfPortions: evening + morning };
  }

  toggleOrderForm() {
    this.isOrderFormOpen = !this.isOrderFormOpen;
    document.body.style.overflow = this.isOrderFormOpen ? 'hidden' : '';
  }

  submitOrder() {
    if (this.isSubmitting) return;
    if (this.eventDateControl) {
      this.orderForm.eventDate = toYYYYMMDD(this.eventDateControl);
    }

    const missing: string[] = [];
    if (!this.orderForm.fullName?.trim()) missing.push('שם מלא');
    if (!this.orderForm.phone?.trim()) missing.push('טלפון');
    if (!this.orderForm.email?.trim()) missing.push('אימייל');
    if (!this.orderForm.eventDate?.trim()) missing.push('תאריך הספקה');
    if (!this.orderForm.mealTime) missing.push('זמן הארוחה');
    if (!this.orderForm.deliveryType) missing.push('סוג אספקה (איסוף / משלוח)');

    if (missing.length > 0) {
      this.submitError = `נא למלא את השדות הבאים: ${missing.join(', ')}`;
      return;
    }

    const eventKey = this.orderForm.eventDate.trim();
    if (!isDateOpenForOrdering(eventKey, this.openDateSettings)) {
      const cutoff = resolveCutoffTime(eventKey, this.openDateSettings);
      this.submitError = cutoff
        ? `ההזמנות לתאריך זה נסגרו בשעה ${cutoff}`
        : 'תאריך זה אינו פתוח להזמנות';
      this.eventDateError = this.submitError;
      return;
    }

    const portionsErr = this.validatePortions();
    if (portionsErr) {
      this.portionsError = portionsErr;
      this.submitError = portionsErr;
      return;
    }

    const menuErr = this.validateMenuSelection();
    if (menuErr) {
      this.menuSelectionError = menuErr;
      this.submitError = menuErr;
      return;
    }

    this.portionsError = null;
    this.menuSelectionError = null;
    const portions = this.buildPortionsPayload();

    const payload: Record<string, unknown> = {
      fullName: this.orderForm.fullName.trim(),
      phone: this.orderForm.phone.trim(),
      email: this.orderForm.email.trim(),
      eventDate: this.orderForm.eventDate,
      mealTime: this.orderForm.mealTime,
      portionsEvening: portions.portionsEvening,
      portionsMorning: portions.portionsMorning,
      numberOfPortions: portions.numberOfPortions,
      salads: this.nonEmptySelections(this.orderForm.salads),
      sidesEvening: this.showEveningMealBlock ? this.nonEmptySelections(this.orderForm.sidesEvening) : [],
      sidesMorning: this.showMorningMealBlock ? this.nonEmptySelections(this.orderForm.sidesMorning) : [],
      seudaShlishit: this.orderForm.seudaShlishit,
      deliveryType: this.orderForm.deliveryType,
      address: this.orderForm.address,
      remarks: this.orderForm.remarks
    };

    if (this.showEveningMealBlock) {
      payload['firstCoursesEvening'] = this.nonEmptySelections(this.orderForm.firstCoursesEvening);
      payload['mainCoursesEvening'] = this.nonEmptySelections(this.orderForm.mainCoursesEvening);
    }
    if (this.showMorningMealBlock) {
      payload['firstCoursesMorning'] = this.nonEmptySelections(this.orderForm.firstCoursesMorning);
      payload['mainCoursesMorning'] = this.nonEmptySelections(this.orderForm.mainCoursesMorning);
    }

    this.isSubmitting = true;
    this.submitError = '';
    this.http
      .post<{ success: boolean; message?: string }>(`${environment.apiUrl}/catering`, payload)
      .subscribe({
        next: () => {
          this.isSubmitting = false;
          this.submitSuccess = true;
        },
        error: (err) => {
          this.isSubmitting = false;
          this.submitError =
            err?.error?.message ||
            (err?.status === 0 ? 'לא ניתן להתחבר לשרת. בדוק חיבור לאינטרנט.' : 'אירעה שגיאה בשליחת ההזמנה. נסה שוב.');
        }
      });
  }

  closeModal() {
    this.submitSuccess = false;
    this.submitError = '';
    this.toggleOrderForm();
  }

  ngOnInit(): void {
    this.loadDeliverySettings();

    this.settingsService.getSettings(true).subscribe(s => {
      this.settings = s || null;
      const hol = s?.pageAnnouncements?.['holiday'];
      if ((hol?.popupTitle?.trim() ?? '') !== '' || (hol?.popupText?.trim() ?? '') !== '') {
        this.showPopup = true;
      }
      this.eventsMenuUrl = '/assets/docs/shabbat-menu.pdf';
    });
  }

  openMenu(): void {
    if (this.eventsMenuUrl) {
      window.open(this.eventsMenuUrl, '_blank');
    } else {
      alert('קישור לתפריט טרם עודכן במערכת');
    }
  }

  hasMenuUrl(): boolean {
    return !!this.eventsMenuUrl && this.eventsMenuUrl.trim() !== '';
  }

  closePopup(): void {
    this.showPopup = false;
  }
}
