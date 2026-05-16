import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { ToastrService } from 'ngx-toastr';
import {
  SiteSettingsService,
  SiteSettings,
  PAGE_IDS,
  PageId,
  DEFAULT_KOSHER_CERTIFICATE_URL
} from '../../../services/site-settings.service';
import { UploadService } from '../../../services/upload.service';
import { AdminDeliveryService } from '../../../services/admin-delivery.service';
import { toYYYYMMDD } from '../../../utils/date.utils';

const PAGE_LABELS: Record<PageId, string> = {
  home: 'דף הבית',
  events: 'קייטרינג לאירועים',
  holiday: 'אירועי שבת וחג',
  cholent: 'צ\'ולנט בר',
  salads: 'סלטים',
  fish: 'דגים',
  desserts: 'קינוחים'
};

@Component({
  selector: 'app-admin-settings',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, MatSlideToggleModule, MatExpansionModule, MatDatepickerModule, MatNativeDateModule],
  templateUrl: './admin-settings.component.html',
  styleUrls: ['./admin-settings.component.scss']
})
export class AdminSettingsComponent implements OnInit {
  private fb = inject(FormBuilder);
  private settingsService = inject(SiteSettingsService);
  private uploadService = inject(UploadService);
  private toastr = inject(ToastrService);
  private adminDelivery = inject(AdminDeliveryService);

  certificatePreviewUrl: string | null = null;
  isUploadingCertificate = false;
  isCertificateDragOver = false;
  readonly defaultKosherCertificateUrl = DEFAULT_KOSHER_CERTIFICATE_URL;

  settingsForm!: FormGroup;
  isLoading = false;
  isSaving = false;
  readonly PAGE_IDS = PAGE_IDS;
  readonly PAGE_LABELS = PAGE_LABELS;

  /** Available pages for CTA link dropdown (name + route) */
  readonly availablePages = [
    { name: 'דף הבית', route: '/' },
    { name: 'תפריט אירועים', route: '/events' },
    { name: 'תפריט מוכן לשבת', route: '/ready-for-shabbat' },
    { name: 'סלטים', route: '/salads' },
    { name: 'דגים', route: '/fish' },
    { name: 'צ\'ולנט', route: '/cholent' },
    { name: 'קינוחים', route: '/desserts' }
  ] as const;

  /** Specific dates open for orders (YYYY-MM-DD); loaded from store settings */
  openDates: string[] = [];
  /** Minimum days from today until earliest selectable order date (standalone ngModel, not in form) */
  minimumLeadDays = 2;
  isSavingDays = false;
  /** Calendar month to display (for mat-calendar) */
  calendarMonth: Date = new Date();

  ngOnInit(): void {
    this.settingsForm = this.fb.group({
      shabbatMenuUrl: [''],
      eventsMenuUrl: [''],
      kosherCertificateUrl: [''],
      contactPhone: [''],
      orderEmail: [''],
      whatsappLink: [''],
      cholentForceOpen: [false],
      cholentCustomMessage: [''],
      cholentClosedMessage: [''],
      pageAnnouncements: this.fb.group(
        PAGE_IDS.reduce((acc, id) => {
          acc[id] = this.fb.group({
            bannerText: [''],
            popupTitle: [''],
            popupText: [''],
            popupLinkText: [''],
            popupLinkUrl: ['']
          });
          return acc;
        }, {} as Record<string, FormGroup>)
      )
    });
    this.loadSettings();
    this.loadDeliverySettings();
  }

  loadDeliverySettings(): void {
    this.adminDelivery.getDeliverySettings().subscribe({
      next: (res) => {
        const data = res?.data;
        if (data?.openDates && Array.isArray(data.openDates)) {
          this.openDates = data.openDates.filter((s): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s));
        } else {
          this.openDates = [];
        }
        if (typeof data?.minimumLeadDays === 'number' && data.minimumLeadDays >= 0) {
          this.minimumLeadDays = data.minimumLeadDays;
        }
      }
    });
  }

  /** Format date to YYYY-MM-DD (local date only, no timezone shift). */
  toYYYYMMDD(date: Date): string {
    return toYYYYMMDD(date);
  }

  /**
   * Calendar cell CSS class based on whether the date is open.
   * Month view: dates in openDates -> 'opened-date', others -> 'closed-date'.
   */
  dateClass = (cellDate: Date, view: 'month' | 'year' | 'multi-year'): string => {
    if (view !== 'month') return '';
    const dateString = toYYYYMMDD(cellDate);
    const isOpen = this.openDates.includes(dateString);
    return isOpen ? 'opened-date' : 'closed-date';
  };

  /** Toggle a date in openDates: add if missing, remove if present. */
  onCalendarDateSelect(value: Date | null): void {
    if (!value) return;
    const key = toYYYYMMDD(value);
    if (this.openDates.includes(key)) {
      this.openDates = this.openDates.filter((d) => d !== key);
    } else {
      this.openDates = [...this.openDates, key].sort();
    }
  }

  saveOpenDates(): void {
    this.isSavingDays = true;
    const lead = Math.max(0, Math.floor(Number(this.minimumLeadDays)) || 2);
    this.adminDelivery.updateDeliverySettings({ openDates: [...this.openDates], minimumLeadDays: lead }).subscribe({
      next: () => {
        this.isSavingDays = false;
        this.toastr.success('תאריכי ההזמנה עודכנו', 'הצלחה', { timeOut: 3000, positionClass: 'toast-top-left' });
      },
      error: () => {
        this.isSavingDays = false;
        this.toastr.error('שגיאה בעדכון תאריכי ההזמנה', 'שגיאה', { timeOut: 5000, positionClass: 'toast-top-left' });
      }
    });
  }

  get pageAnnouncementsGroup(): FormGroup {
    return this.settingsForm.get('pageAnnouncements') as FormGroup;
  }

  getPageGroup(pageId: PageId): FormGroup {
    return this.pageAnnouncementsGroup.get(pageId) as FormGroup;
  }

  loadSettings(): void {
    this.isLoading = true;
    this.settingsService.getSettings().subscribe({
      next: (settings) => {
        if (settings) {
          this.settingsForm.patchValue({
            shabbatMenuUrl: settings.shabbatMenuUrl || '',
            eventsMenuUrl: settings.eventsMenuUrl || '',
            kosherCertificateUrl: settings.kosherCertificateUrl || '',
            contactPhone: settings.contactPhone || '',
            orderEmail: settings.orderEmail || '',
            whatsappLink: settings.whatsappLink || '',
            cholentForceOpen: !!settings.cholentForceOpen,
            cholentCustomMessage: settings.cholentCustomMessage || '',
            cholentClosedMessage: settings.cholentClosedMessage || 'ההזמנות נפתחות ביום חמישי בין השעות 09:00 ל-17:00',
            pageAnnouncements: this.normalizePageAnnouncementsForForm(settings.pageAnnouncements)
          });
          this.syncCertificatePreview();
        } else {
          this.patchDefaults();
        }
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading settings:', error);
        this.isLoading = false;
        this.toastr.error('שגיאה בטעינת ההגדרות', 'שגיאה', { timeOut: 5000, positionClass: 'toast-top-left' });
        this.patchDefaults();
      }
    });
  }

  private normalizePageAnnouncementsForForm(pa: Record<string, { bannerText?: string; popupTitle?: string; popupText?: string; popupLinkText?: string; popupLinkUrl?: string }> | null | undefined): Record<string, { bannerText: string; popupTitle: string; popupText: string; popupLinkText: string; popupLinkUrl: string }> {
    const out: Record<string, { bannerText: string; popupTitle: string; popupText: string; popupLinkText: string; popupLinkUrl: string }> = {};
    for (const id of PAGE_IDS) {
      const p = pa?.[id];
      out[id] = {
        bannerText: (p?.bannerText != null && typeof p.bannerText === 'string') ? p.bannerText : '',
        popupTitle: (p?.popupTitle != null && typeof p.popupTitle === 'string') ? p.popupTitle : '',
        popupText: (p?.popupText != null && typeof p.popupText === 'string') ? p.popupText : '',
        popupLinkText: (p?.popupLinkText != null && typeof p.popupLinkText === 'string') ? p.popupLinkText : '',
        popupLinkUrl: (p?.popupLinkUrl != null && typeof p.popupLinkUrl === 'string') ? p.popupLinkUrl : ''
      };
    }
    return out;
  }

  private patchDefaults(): void {
    this.settingsForm.patchValue({
      shabbatMenuUrl: '',
      eventsMenuUrl: '',
      kosherCertificateUrl: '',
      contactPhone: '',
      orderEmail: '',
      whatsappLink: '',
      cholentForceOpen: false,
      cholentCustomMessage: '',
      cholentClosedMessage: 'ההזמנות נפתחות ביום חמישי בין השעות 09:00 ל-17:00',
      pageAnnouncements: this.normalizePageAnnouncementsForForm(null)
    });
    this.syncCertificatePreview();
  }

  get certificateDisplayUrl(): string {
    return (
      this.certificatePreviewUrl ||
      this.settingsForm.get('kosherCertificateUrl')?.value?.trim() ||
      this.defaultKosherCertificateUrl
    );
  }

  syncCertificatePreview(): void {
    const url = this.settingsForm.get('kosherCertificateUrl')?.value?.trim();
    this.certificatePreviewUrl = url || null;
  }

  onCertificateFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.uploadCertificateFile(file);
    input.value = '';
  }

  onCertificateDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (!this.isUploadingCertificate) this.isCertificateDragOver = true;
  }

  onCertificateDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isCertificateDragOver = false;
  }

  onCertificateDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isCertificateDragOver = false;
    if (this.isUploadingCertificate) return;
    const file = event.dataTransfer?.files?.[0];
    if (file) this.uploadCertificateFile(file);
  }

  private uploadCertificateFile(file: File): void {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      this.toastr.warning('סוג קובץ לא נתמך. השתמש ב-JPG, PNG או WebP', 'תמונה', {
        positionClass: 'toast-top-left'
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      this.certificatePreviewUrl = (e.target as FileReader).result as string;
    };
    reader.readAsDataURL(file);

    this.isUploadingCertificate = true;
    this.uploadService.uploadImage(file).subscribe({
      next: (res) => {
        this.isUploadingCertificate = false;
        if (res.imageUrl) {
          this.settingsForm.patchValue({ kosherCertificateUrl: res.imageUrl });
          this.certificatePreviewUrl = res.imageUrl;
          this.settingsForm.markAsDirty();
        }
      },
      error: () => {
        this.isUploadingCertificate = false;
        this.toastr.error('שגיאה בהעלאת תעודת הכשרות', 'שגיאה', {
          positionClass: 'toast-top-left'
        });
      }
    });
  }

  removeCertificatePreview(): void {
    this.settingsForm.patchValue({ kosherCertificateUrl: '' });
    this.certificatePreviewUrl = null;
    this.settingsForm.markAsDirty();
  }

  onSubmit(event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (this.settingsForm.invalid) {
      Object.keys(this.settingsForm.controls).forEach(key => this.settingsForm.get(key)?.markAsTouched());
      return;
    }
    const payload = this.settingsForm.getRawValue();
    this.isSaving = true;
    this.settingsService.updateSettings(payload).subscribe({
      next: () => {
        this.isSaving = false;
        this.settingsService.clearCache();
        this.settingsService.getSettings(true).subscribe({
          next: (s) => {
            this.settingsForm.patchValue({
              kosherCertificateUrl: s.kosherCertificateUrl || ''
            });
            this.syncCertificatePreview();
          }
        });
        this.toastr.success('ההגדרות נשמרו בהצלחה', 'הצלחה', {
          timeOut: 3000,
          positionClass: 'toast-top-left'
        });
        this.settingsForm.markAsPristine();
      },
      error: (err) => {
        this.isSaving = false;
        console.error('Save failed:', err);
        this.toastr.error(err?.error?.message || err?.message || 'שגיאה בשמירת ההגדרות', 'שגיאה', { timeOut: 5000, positionClass: 'toast-top-left' });
      }
    });
  }

  hasError(fieldName: string): boolean {
    const field = this.settingsForm.get(fieldName);
    return !!(field && field.invalid && field.touched);
  }

  getErrorMessage(fieldName: string): string {
    const field = this.settingsForm.get(fieldName);
    if (field?.hasError('required')) return 'שדה זה חובה';
    return '';
  }
}
