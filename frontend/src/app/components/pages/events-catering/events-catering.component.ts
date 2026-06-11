import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { SiteSettingsService, SiteSettings } from '../../../services/site-settings.service';
import { PageBannerComponent } from '../../shared/page-banner/page-banner.component';
import { PagePopupComponent } from '../../shared/page-popup/page-popup.component';
import { environment } from '../../../../environments/environment';
import {
  calculatePricePerPortion,
  calculateTotalEventPrice,
  EVENTS_BASE_PACKAGE,
  EVENTS_BASE_PRICE,
  EVENTS_DESSERTS_UPGRADE,
  EVENTS_FIRST_COURSE_SLOT_COUNT,
  EVENTS_FIRST_COURSE_UPGRADE,
  EVENTS_FIRST_COURSE_UPGRADE_OPTIONS,
  EVENTS_KOSHER_UPGRADE_PRICE,
  EVENTS_MAIN_COURSE_OPTIONS,
  EVENTS_MAIN_COURSE_SLOT_COUNT,
  EVENTS_RECEPTION_BAR_UPGRADE,
  EVENTS_SALAD_OPTIONS,
  EVENTS_SALAD_SLOT_COUNT,
  EVENTS_SIDE_DISH_OPTIONS,
  EVENTS_SIDE_SLOT_COUNT,
  EventsReceptionTier
} from './events-catering.model';

@Component({
  selector: 'app-events-catering',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatDatepickerModule, MatNativeDateModule, PageBannerComponent, PagePopupComponent],
  templateUrl: './events-catering.component.html',
  styleUrls: ['./events-catering.component.scss']
})
export class EventsCateringComponent implements OnInit {
  private http = inject(HttpClient);
  settingsService = inject(SiteSettingsService);

  readonly basePackage = EVENTS_BASE_PACKAGE;
  readonly basePrice = EVENTS_BASE_PRICE;
  readonly firstCourseUpgrade = EVENTS_FIRST_COURSE_UPGRADE;
  readonly dessertsUpgrade = EVENTS_DESSERTS_UPGRADE;
  readonly receptionBarUpgrade = EVENTS_RECEPTION_BAR_UPGRADE;
  readonly kosherUpgradePrice = EVENTS_KOSHER_UPGRADE_PRICE;
  readonly saladOptions = EVENTS_SALAD_OPTIONS;
  readonly firstCourseUpgradeOptions = EVENTS_FIRST_COURSE_UPGRADE_OPTIONS;
  readonly mainCourseOptions = EVENTS_MAIN_COURSE_OPTIONS;
  readonly sideDishOptions = EVENTS_SIDE_DISH_OPTIONS;

  readonly saladIndexes = Array.from({ length: EVENTS_SALAD_SLOT_COUNT }, (_, i) => i + 1);
  readonly mainCourseIndexes = Array.from({ length: EVENTS_MAIN_COURSE_SLOT_COUNT }, (_, i) => i + 1);
  readonly sideIndexes = Array.from({ length: EVENTS_SIDE_SLOT_COUNT }, (_, i) => i + 1);
  readonly firstCourseIndexes = Array.from({ length: EVENTS_FIRST_COURSE_SLOT_COUNT }, (_, i) => i + 1);

  readonly EVENT_TYPES = [
    'חתונה', 'בר / בת מצווה', 'אירוע עסקי', 'יום הולדת', 'ברית / קידוש', 'סיום / מסיבה', 'אחר'
  ];

  settings: SiteSettings | null = null;
  showPopup = false;
  showOrderForm = false;
  isSubmitting = false;
  submitSuccess = false;
  submitError = '';

  pricePerPortion = EVENTS_BASE_PRICE;

  isFirstCourseSelected = false;
  isDessertsSelected = false;
  isReceptionSelected = false;
  receptionTier: EventsReceptionTier = 'regular';
  isKosherUpgradeSelected = false;

  previewReceptionTab: EventsReceptionTier = 'regular';

  firstCourses: string[] = [];

  minEventDateObj: Date | null = null;
  eventDateControl: Date | null = null;
  eventDateError: string | null = null;

  orderForm = this.createEmptyOrderForm();

  ngOnInit(): void {
    const today = new Date();
    this.minEventDateObj = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 2);

    this.settingsService.getSettings(true).subscribe(settings => {
      this.settings = settings;
      const ev = settings?.pageAnnouncements?.['events'];
      if ((ev?.popupTitle?.trim() ?? '') !== '' || (ev?.popupText?.trim() ?? '') !== '') {
        this.showPopup = true;
      }
    });
  }

  private createEmptyOrderForm() {
    return {
      fullName: '',
      phone: '',
      email: '',
      eventDate: '',
      eventType: '',
      guestCount: null as number | null,
      venue: '',
      salads: [] as string[],
      mainCourses: [] as string[],
      sides: [] as string[],
      deliveryType: '' as '' | 'pickup' | 'delivery',
      address: '',
      notes: ''
    };
  }

  get computedPricePerPortion(): number {
    return calculatePricePerPortion({
      isFirstCourseSelected: this.isFirstCourseSelected,
      isDessertsSelected: this.isDessertsSelected,
      isReceptionSelected: this.isReceptionSelected,
      receptionTier: this.isReceptionSelected ? this.receptionTier : '',
      isKosherUpgradeSelected: this.isKosherUpgradeSelected
    });
  }

  get totalEventPrice(): number {
    return calculateTotalEventPrice(this.computedPricePerPortion, this.orderForm.guestCount);
  }

  private syncPrice(): void {
    this.pricePerPortion = this.computedPricePerPortion;
  }

  dateFilter = (d: Date | null): boolean => {
    if (!d || !this.minEventDateObj) return false;

    const pick = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const min = new Date(
      this.minEventDateObj.getFullYear(),
      this.minEventDateObj.getMonth(),
      this.minEventDateObj.getDate()
    );

    if (pick < min) return false;
    if (d.getDay() === 6) return false;

    return true;
  };

  onEventDateChange(value: Date | null): void {
    this.eventDateControl = value;
    this.eventDateError = null;

    if (!value) {
      this.orderForm.eventDate = '';
      return;
    }

    if (!this.dateFilter(value)) {
      this.orderForm.eventDate = '';
      this.eventDateError = 'ניתן לבחור תאריך מיומיים קדימה ומעלה, לא בשבת.';
      return;
    }

    this.orderForm.eventDate = this.formatDateForInput(value);
  }

  private formatDateForInput(date: Date): string {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  onFirstCourseToggle(checked: boolean): void {
    this.isFirstCourseSelected = checked;
    if (!checked) this.firstCourses = [];
    this.syncPrice();
  }

  onDessertsToggle(checked: boolean): void {
    this.isDessertsSelected = checked;
    this.syncPrice();
  }

  onReceptionToggle(checked: boolean): void {
    this.isReceptionSelected = checked;
    if (checked && !this.receptionTier) this.receptionTier = 'regular';
    this.syncPrice();
  }

  onReceptionTierChange(tier: EventsReceptionTier): void {
    this.receptionTier = tier;
    this.previewReceptionTab = tier;
    this.syncPrice();
  }

  setPreviewReceptionTab(tier: EventsReceptionTier): void {
    this.previewReceptionTab = tier;
  }

  get previewReceptionTier() {
    return this.receptionBarUpgrade.tiers.find(t => t.id === this.previewReceptionTab);
  }

  get activeReceptionTier() {
    return this.receptionBarUpgrade.tiers.find(t => t.id === this.receptionTier);
  }

  onKosherToggle(checked: boolean): void {
    this.isKosherUpgradeSelected = checked;
    this.syncPrice();
  }

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
    this.orderForm = this.createEmptyOrderForm();
    this.isFirstCourseSelected = false;
    this.isDessertsSelected = false;
    this.isReceptionSelected = false;
    this.receptionTier = 'regular';
    this.previewReceptionTab = 'regular';
    this.isKosherUpgradeSelected = false;
    this.firstCourses = [];
    this.eventDateControl = null;
    this.eventDateError = null;
    this.pricePerPortion = EVENTS_BASE_PRICE;
  }

  submitOrder(): void {
    if (this.isSubmitting) return;
    this.submitError = '';

    const missing: string[] = [];
    if (!this.orderForm.fullName?.trim()) missing.push('שם מלא');
    if (!this.orderForm.phone?.trim()) missing.push('טלפון');
    if (!this.orderForm.email?.trim()) missing.push('אימייל');
    if (!this.orderForm.guestCount || this.orderForm.guestCount < 1) missing.push('מספר אורחים');
    if (!this.orderForm.eventType?.trim()) missing.push('סוג האירוע');

    if (this.eventDateControl && !this.dateFilter(this.eventDateControl)) {
      this.eventDateError = 'ניתן לבחור תאריך מיומיים קדימה ומעלה, לא בשבת.';
      this.submitError = this.eventDateError;
      return;
    }

    if (this.eventDateControl) {
      this.orderForm.eventDate = this.formatDateForInput(this.eventDateControl);
    }

    if (!this.orderForm.eventDate?.trim()) missing.push('תאריך האירוע');

    if (this.isReceptionSelected && !this.receptionTier) {
      this.submitError = 'נא לבחור רמת בר קבלת פנים';
      return;
    }

    if (missing.length > 0) {
      this.submitError = `נא למלא את השדות הבאים: ${missing.join(', ')}`;
      return;
    }

    const receptionTierDef = EVENTS_RECEPTION_BAR_UPGRADE.tiers.find(t => t.id === this.receptionTier);

    this.isSubmitting = true;

    const payload = {
      ...this.orderForm,
      receptionBar: this.isReceptionSelected,
      receptionBarVariant: this.isReceptionSelected ? receptionTierDef?.backendId ?? 'standard' : '',
      desserts: this.isDessertsSelected,
      firstCourses: this.isFirstCourseSelected ? this.firstCourses : [],
      firstCourseUpgrade: this.isFirstCourseSelected,
      kosherUpgrade: this.isKosherUpgradeSelected,
      pricePerPortion: this.computedPricePerPortion,
      totalEventPrice: this.totalEventPrice,
      basePackageTitle: EVENTS_BASE_PACKAGE.title
    };

    this.http
      .post<{ success: boolean; message?: string }>(`${environment.apiUrl}/catering/events`, payload)
      .subscribe({
        next: () => {
          this.isSubmitting = false;
          this.submitSuccess = true;
          this.resetForm();
          document.body.style.overflow = 'hidden';
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

  get eventsMenuUrl(): string {
    return this.settings?.eventsMenuUrl || '';
  }

  hasMenuUrl(): boolean {
    return !!this.eventsMenuUrl && this.eventsMenuUrl.trim() !== '';
  }
}
