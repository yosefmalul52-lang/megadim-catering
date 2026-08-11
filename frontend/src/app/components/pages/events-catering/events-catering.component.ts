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
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { SiteSettingsService, SiteSettings } from '../../../services/site-settings.service';
import { EventsCatalogService, EventsCatalogDto } from '../../../services/events-catalog.service';
import { PageBannerComponent } from '../../shared/page-banner/page-banner.component';
import { PagePopupComponent } from '../../shared/page-popup/page-popup.component';
import { environment } from '../../../../environments/environment';
import { LocaleService } from '../../../i18n/locale.service';
import { eventsDisplayLabel } from './events-catering-labels';
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
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatDatepickerModule, MatNativeDateModule, PageBannerComponent, PagePopupComponent, TranslateModule],
  templateUrl: './events-catering.component.html',
  styleUrls: ['./events-catering.component.scss']
})
export class EventsCateringComponent implements OnInit {
  private http = inject(HttpClient);
  private eventsCatalogService = inject(EventsCatalogService);
  private translate = inject(TranslateService);
  settingsService = inject(SiteSettingsService);
  readonly localeService = inject(LocaleService);

  /** Display Hebrew catalog strings in EN when locale is English; values stay Hebrew for the kitchen. */
  label(he: string): string {
    return eventsDisplayLabel(he, this.localeService.locale);
  }

  basePackage = { ...EVENTS_BASE_PACKAGE };
  basePrice = EVENTS_BASE_PRICE;
  firstCourseUpgrade = { ...EVENTS_FIRST_COURSE_UPGRADE };
  dessertsUpgrade = { ...EVENTS_DESSERTS_UPGRADE };
  receptionBarUpgrade = {
    ...EVENTS_RECEPTION_BAR_UPGRADE,
    tiers: EVENTS_RECEPTION_BAR_UPGRADE.tiers.map((t) => ({ ...t, features: [...t.features] }))
  };
  kosherUpgradePrice = EVENTS_KOSHER_UPGRADE_PRICE;
  saladOptions = [...EVENTS_SALAD_OPTIONS];
  firstCourseUpgradeOptions = [...EVENTS_FIRST_COURSE_UPGRADE_OPTIONS];
  mainCourseOptions = [...EVENTS_MAIN_COURSE_OPTIONS];
  sideDishOptions = [...EVENTS_SIDE_DISH_OPTIONS];

  saladIndexes = Array.from({ length: EVENTS_SALAD_SLOT_COUNT }, (_, i) => i + 1);
  mainCourseIndexes = Array.from({ length: EVENTS_MAIN_COURSE_SLOT_COUNT }, (_, i) => i + 1);
  sideIndexes = Array.from({ length: EVENTS_SIDE_SLOT_COUNT }, (_, i) => i + 1);
  firstCourseIndexes = Array.from({ length: EVENTS_FIRST_COURSE_SLOT_COUNT }, (_, i) => i + 1);

  private liveCatalog: EventsCatalogDto | null = null;

  readonly EVENT_TYPES = [
    'חתונה', 'בר / בת מצווה', 'אירוע עסקי', 'יום הולדת', 'ברית / קידוש', 'סיום / מסיבה', 'אחר'
  ];

  /** Hebrew values for backend; EN labels via translate keys. */
  readonly eventTypeOptions = [
    { value: 'חתונה', labelKey: 'EVENTS.TYPE_WEDDING' },
    { value: 'בר / בת מצווה', labelKey: 'EVENTS.TYPE_BNM' },
    { value: 'אירוע עסקי', labelKey: 'EVENTS.TYPE_CORP' },
    { value: 'יום הולדת', labelKey: 'EVENTS.TYPE_BDAY' },
    { value: 'ברית / קידוש', labelKey: 'EVENTS.TYPE_BRIT' },
    { value: 'סיום / מסיבה', labelKey: 'EVENTS.TYPE_PARTY' },
    { value: 'אחר', labelKey: 'EVENTS.TYPE_OTHER' }
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
    this.minEventDateObj = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    this.settingsService.getSettings(true).subscribe(settings => {
      this.settings = settings;
      const ev = settings?.pageAnnouncements?.['events'];
      if ((ev?.popupTitle?.trim() ?? '') !== '' || (ev?.popupText?.trim() ?? '') !== '') {
        this.showPopup = true;
      }
    });

    this.eventsCatalogService.getPublicCatalog().subscribe({
      next: (catalog) => this.applyCatalog(catalog),
      error: () => {
        /* keep hardcoded defaults */
      }
    });
  }

  private applyCatalog(catalog: EventsCatalogDto): void {
    if (!catalog) return;
    this.liveCatalog = catalog;
    this.basePrice = Number(catalog.basePrice) || EVENTS_BASE_PRICE;
    this.basePackage = {
      id: 'base-event-menu',
      title: catalog.baseTitle || EVENTS_BASE_PACKAGE.title,
      pricePerPortion: this.basePrice,
      mandatoryLabel: EVENTS_BASE_PACKAGE.mandatoryLabel,
      includes: Array.isArray(catalog.baseIncludes) && catalog.baseIncludes.length
        ? catalog.baseIncludes
        : [...EVENTS_BASE_PACKAGE.includes]
    };
    this.firstCourseUpgrade = {
      title: catalog.firstCourseUpgradeTitle || EVENTS_FIRST_COURSE_UPGRADE.title,
      pricePerPortion: Number(catalog.firstCourseUpgradePrice) || EVENTS_FIRST_COURSE_UPGRADE.pricePerPortion,
      priceLabel: `+₪${Number(catalog.firstCourseUpgradePrice) || EVENTS_FIRST_COURSE_UPGRADE.pricePerPortion} למנה`,
      includes: [...EVENTS_FIRST_COURSE_UPGRADE.includes]
    };
    this.dessertsUpgrade = {
      title: catalog.dessertsUpgradeTitle || EVENTS_DESSERTS_UPGRADE.title,
      pricePerPortion: Number(catalog.dessertsUpgradePrice) || EVENTS_DESSERTS_UPGRADE.pricePerPortion,
      priceLabel: `+₪${Number(catalog.dessertsUpgradePrice) || EVENTS_DESSERTS_UPGRADE.pricePerPortion} למנה`,
      includes: [...EVENTS_DESSERTS_UPGRADE.includes]
    };
    this.kosherUpgradePrice = Number(catalog.kosherUpgradePrice) || EVENTS_KOSHER_UPGRADE_PRICE;
    if (Array.isArray(catalog.receptionTiers) && catalog.receptionTiers.length) {
      this.receptionBarUpgrade = {
        title: EVENTS_RECEPTION_BAR_UPGRADE.title,
        minStationsNote: EVENTS_RECEPTION_BAR_UPGRADE.minStationsNote,
        tiers: catalog.receptionTiers.map((t) => ({
          id: t.id,
          backendId: t.backendId,
          title: t.title,
          pricePerPortion: Number(t.pricePerPortion) || 0,
          stations: Number(t.stations) || 4,
          features: Array.isArray(t.features) ? t.features : []
        })) as typeof EVENTS_RECEPTION_BAR_UPGRADE.tiers
      };
    }
    if (catalog.saladOptions?.length) this.saladOptions = [...catalog.saladOptions];
    if (catalog.firstCourseOptions?.length) {
      this.firstCourseUpgradeOptions = [...catalog.firstCourseOptions];
    }
    if (catalog.mainCourseOptions?.length) this.mainCourseOptions = [...catalog.mainCourseOptions];
    if (catalog.sideDishOptions?.length) this.sideDishOptions = [...catalog.sideDishOptions];

    const saladSlots = Number(catalog.saladSlotCount) || EVENTS_SALAD_SLOT_COUNT;
    const mainSlots = Number(catalog.mainCourseSlotCount) || EVENTS_MAIN_COURSE_SLOT_COUNT;
    const sideSlots = Number(catalog.sideSlotCount) || EVENTS_SIDE_SLOT_COUNT;
    const firstSlots = Number(catalog.firstCourseSlotCount) || EVENTS_FIRST_COURSE_SLOT_COUNT;
    this.saladIndexes = Array.from({ length: saladSlots }, (_, i) => i + 1);
    this.mainCourseIndexes = Array.from({ length: mainSlots }, (_, i) => i + 1);
    this.sideIndexes = Array.from({ length: sideSlots }, (_, i) => i + 1);
    this.firstCourseIndexes = Array.from({ length: firstSlots }, (_, i) => i + 1);
    this.syncPrice();
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
    return calculatePricePerPortion(
      {
        isFirstCourseSelected: this.isFirstCourseSelected,
        isDessertsSelected: this.isDessertsSelected,
        isReceptionSelected: this.isReceptionSelected,
        receptionTier: this.isReceptionSelected ? this.receptionTier : '',
        isKosherUpgradeSelected: this.isKosherUpgradeSelected
      },
      this.liveCatalog || undefined
    );
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
      this.eventDateError = 'ניתן לבחור כל תאריך מהיום ומעלה, חוץ משבת.';
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
    if (!this.orderForm.fullName?.trim()) missing.push(this.translate.instant('EVENTS.FIELD_FULL_NAME'));
    if (!this.orderForm.phone?.trim()) missing.push(this.translate.instant('EVENTS.FIELD_PHONE'));
    if (!this.orderForm.email?.trim()) missing.push(this.translate.instant('EVENTS.FIELD_EMAIL'));
    if (!this.orderForm.guestCount || this.orderForm.guestCount < 1) {
      missing.push(this.translate.instant('EVENTS.FIELD_GUESTS'));
    }
    if (!this.orderForm.eventType?.trim()) missing.push(this.translate.instant('EVENTS.FIELD_EVENT_TYPE'));

    if (this.eventDateControl && !this.dateFilter(this.eventDateControl)) {
      this.eventDateError = this.translate.instant('EVENTS.ERR_DATE');
      this.submitError = this.eventDateError || this.translate.instant('EVENTS.ERR_DATE');
      return;
    }

    if (this.eventDateControl) {
      this.orderForm.eventDate = this.formatDateForInput(this.eventDateControl);
    }

    if (!this.orderForm.eventDate?.trim()) missing.push(this.translate.instant('EVENTS.FIELD_EVENT_DATE'));

    if (this.isReceptionSelected && !this.receptionTier) {
      this.submitError = this.translate.instant('EVENTS.ERR_RECEPTION_TIER');
      return;
    }

    if (missing.length > 0) {
      this.submitError = this.translate.instant('EVENTS.ERR_REQUIRED_FIELDS', {
        fields: missing.join(', ')
      });
      return;
    }

    const receptionTierDef = this.receptionBarUpgrade.tiers.find(t => t.id === this.receptionTier);

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
      basePackageTitle: this.basePackage.title
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
