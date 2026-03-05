import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatExpansionModule } from '@angular/material/expansion';
import { ToastrService } from 'ngx-toastr';
import { SiteSettingsService, SiteSettings, PAGE_IDS, PageId } from '../../../services/site-settings.service';
import { AdminDeliveryService } from '../../../services/admin-delivery.service';

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
  imports: [CommonModule, ReactiveFormsModule, FormsModule, MatSlideToggleModule, MatExpansionModule],
  templateUrl: './admin-settings.component.html',
  styleUrls: ['./admin-settings.component.scss']
})
export class AdminSettingsComponent implements OnInit {
  private fb = inject(FormBuilder);
  private settingsService = inject(SiteSettingsService);
  private toastr = inject(ToastrService);
  private adminDelivery = inject(AdminDeliveryService);

  settingsForm!: FormGroup;
  isLoading = false;
  isSaving = false;
  readonly PAGE_IDS = PAGE_IDS;
  readonly PAGE_LABELS = PAGE_LABELS;

  /** Allowed days for checkout (0=Sun … 6=Sat); loaded from store settings */
  allowedDays: number[] = [0, 1, 2, 3];
  /** Minimum days from today until earliest selectable order date */
  minimumLeadDays = 2;
  isSavingDays = false;
  readonly DAY_LABELS: { value: number; label: string }[] = [
    { value: 0, label: 'ראשון' },
    { value: 1, label: 'שני' },
    { value: 2, label: 'שלישי' },
    { value: 3, label: 'רביעי' },
    { value: 4, label: 'חמישי' },
    { value: 5, label: 'שישי' },
    { value: 6, label: 'שבת' }
  ];

  ngOnInit(): void {
    this.settingsForm = this.fb.group({
      shabbatMenuUrl: [''],
      eventsMenuUrl: [''],
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
            popupText: ['']
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
        if (data?.allowedDays && Array.isArray(data.allowedDays)) {
          this.allowedDays = [...data.allowedDays];
        }
        if (typeof data?.minimumLeadDays === 'number' && data.minimumLeadDays >= 0) {
          this.minimumLeadDays = data.minimumLeadDays;
        }
      }
    });
  }

  isDayAllowed(day: number): boolean {
    return this.allowedDays.includes(day);
  }

  toggleDay(day: number): void {
    if (this.allowedDays.includes(day)) {
      this.allowedDays = this.allowedDays.filter((d) => d !== day);
    } else {
      this.allowedDays = [...this.allowedDays, day].sort((a, b) => a - b);
    }
  }

  saveAllowedDays(): void {
    this.isSavingDays = true;
    const lead = Math.max(0, Math.floor(Number(this.minimumLeadDays)) || 2);
    this.adminDelivery.updateDeliverySettings({ allowedDays: this.allowedDays, minimumLeadDays: lead }).subscribe({
      next: () => {
        this.isSavingDays = false;
        this.toastr.success('ימי ההזמנה עודכנו', 'הצלחה', { timeOut: 3000, positionClass: 'toast-top-left' });
      },
      error: () => {
        this.isSavingDays = false;
        this.toastr.error('שגיאה בעדכון ימי ההזמנה', 'שגיאה', { timeOut: 5000, positionClass: 'toast-top-left' });
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
            contactPhone: settings.contactPhone || '',
            orderEmail: settings.orderEmail || '',
            whatsappLink: settings.whatsappLink || '',
            cholentForceOpen: !!settings.cholentForceOpen,
            cholentCustomMessage: settings.cholentCustomMessage || '',
            cholentClosedMessage: settings.cholentClosedMessage || 'ההזמנות נפתחות ביום חמישי בין השעות 09:00 ל-17:00',
            pageAnnouncements: this.normalizePageAnnouncementsForForm(settings.pageAnnouncements)
          });
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

  private normalizePageAnnouncementsForForm(pa: Record<string, { bannerText?: string; popupTitle?: string; popupText?: string }> | null | undefined): Record<string, { bannerText: string; popupTitle: string; popupText: string }> {
    const out: Record<string, { bannerText: string; popupTitle: string; popupText: string }> = {};
    for (const id of PAGE_IDS) {
      const p = pa?.[id];
      out[id] = {
        bannerText: (p?.bannerText != null && typeof p.bannerText === 'string') ? p.bannerText : '',
        popupTitle: (p?.popupTitle != null && typeof p.popupTitle === 'string') ? p.popupTitle : '',
        popupText: (p?.popupText != null && typeof p.popupText === 'string') ? p.popupText : ''
      };
    }
    return out;
  }

  private patchDefaults(): void {
    this.settingsForm.patchValue({
      shabbatMenuUrl: '',
      eventsMenuUrl: '',
      contactPhone: '',
      orderEmail: '',
      whatsappLink: '',
      cholentForceOpen: false,
      cholentCustomMessage: '',
      cholentClosedMessage: 'ההזמנות נפתחות ביום חמישי בין השעות 09:00 ל-17:00',
      pageAnnouncements: this.normalizePageAnnouncementsForForm(null)
    });
  }

  onSubmit(): void {
    if (this.settingsForm.invalid) {
      Object.keys(this.settingsForm.controls).forEach(key => this.settingsForm.get(key)?.markAsTouched());
      return;
    }
    this.isSaving = true;
    const formData = this.settingsForm.value;
    this.settingsService.updateSettings(formData).subscribe({
      next: () => {
        this.isSaving = false;
        this.settingsForm.markAsPristine();
        this.toastr.success('ההגדרות נשמרו בהצלחה!', 'הצלחה', { timeOut: 3000, positionClass: 'toast-top-left' });
      },
      error: (error) => {
        this.isSaving = false;
        this.toastr.error(error.message || 'שגיאה בשמירת ההגדרות', 'שגיאה', { timeOut: 5000, positionClass: 'toast-top-left' });
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
