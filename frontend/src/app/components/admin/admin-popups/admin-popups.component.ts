import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import {
  SitePopupService,
  SitePopup,
  POPUP_PAGE_OPTIONS,
  PopupPageId,
  PopupLocaleContent
} from '../../../services/site-popup.service';
import { UploadService } from '../../../services/upload.service';

@Component({
  selector: 'app-admin-popups',
  standalone: true,
  imports: [CommonModule, DatePipe, ReactiveFormsModule],
  templateUrl: './admin-popups.component.html',
  styleUrls: ['./admin-popups.component.scss']
})
export class AdminPopupsComponent implements OnInit {
  private popupService = inject(SitePopupService);
  private uploadService = inject(UploadService);
  private fb = inject(FormBuilder);

  popups: SitePopup[] = [];
  isLoading = true;
  errorMessage = '';
  successMessage = '';
  isSubmitting = false;
  isMigrating = false;
  isUploading = false;
  editingId: string | null = null;
  showForm = false;
  contentTab: 'he' | 'en' = 'he';
  previewLocale: 'he' | 'en' = 'he';
  showPreview = false;
  previewMobile = false;

  readonly pageOptions = POPUP_PAGE_OPTIONS;
  readonly templateOptions = [
    { value: 'info', label: 'מידע / ברוכים הבאים' },
    { value: 'promo', label: 'מבצע / CTA' },
    { value: 'ops', label: 'תפעול' },
    { value: 'urgent', label: 'דחוף / התראה' }
  ];
  readonly placementOptions = [
    { value: 'modal', label: 'מודאל מרכזי' },
    { value: 'banner_top', label: 'באנר עליון' },
    { value: 'sticky_bottom', label: 'פס תחתון' }
  ];
  readonly statusOptions = [
    { value: 'draft', label: 'טיוטה' },
    { value: 'active', label: 'פעיל' },
    { value: 'disabled', label: 'כבוי' }
  ];
  readonly frequencyOptions = [
    { value: 'every', label: 'כל כניסה לדף' },
    { value: 'session', label: 'פעם בסשן' },
    { value: 'once', label: 'פעם אחת למכשיר' },
    { value: 'max', label: 'עד X פעמים' }
  ];

  form!: FormGroup;

  ngOnInit(): void {
    this.form = this.buildForm();
    this.load();
  }

  private buildForm(): FormGroup {
    return this.fb.group({
      internalName: ['', Validators.required],
      status: ['draft', Validators.required],
      template: ['info', Validators.required],
      placement: ['modal', Validators.required],
      targetAllPages: [true],
      pageTargets: [[] as PopupPageId[]],
      priority: [0],
      useSchedule: [false],
      startAt: [''],
      endAt: [''],
      frequency: ['session', Validators.required],
      maxViews: [3],
      heTitle: [''],
      heBody: [''],
      heCtaLabel: [''],
      heCtaUrl: [''],
      heImageUrl: [''],
      enTitle: [''],
      enBody: [''],
      enCtaLabel: [''],
      enCtaUrl: [''],
      enImageUrl: ['']
    });
  }

  load(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.popupService.list().subscribe({
      next: (list) => {
        this.popups = list;
        this.isLoading = false;
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err?.error?.message || 'שגיאה בטעינת ההודעות';
      }
    });
  }

  openCreate(): void {
    this.editingId = null;
    this.showForm = true;
    this.contentTab = 'he';
    this.showPreview = false;
    this.form.reset({
      internalName: '',
      status: 'draft',
      template: 'info',
      placement: 'modal',
      targetAllPages: true,
      pageTargets: [],
      priority: 0,
      useSchedule: false,
      startAt: '',
      endAt: '',
      frequency: 'session',
      maxViews: 3,
      heTitle: '',
      heBody: '',
      heCtaLabel: '',
      heCtaUrl: '',
      heImageUrl: '',
      enTitle: '',
      enBody: '',
      enCtaLabel: '',
      enCtaUrl: '',
      enImageUrl: ''
    });
  }

  openEdit(p: SitePopup): void {
    this.editingId = p._id || null;
    this.showForm = true;
    this.contentTab = 'he';
    this.showPreview = false;
    const he = p.content?.he || {};
    const en = p.content?.en || {};
    this.form.reset({
      internalName: p.internalName,
      status: p.status || 'draft',
      template: p.template || 'info',
      placement: p.placement || 'modal',
      targetAllPages: p.targetAllPages !== false && (!p.pageTargets || p.pageTargets.length === 0),
      pageTargets: [...(p.pageTargets || [])],
      priority: p.priority ?? 0,
      useSchedule: !!(p.startAt || p.endAt),
      startAt: this.toDateTimeLocal(p.startAt),
      endAt: this.toDateTimeLocal(p.endAt),
      frequency: p.frequency || 'session',
      maxViews: p.maxViews || 3,
      heTitle: he.title || '',
      heBody: he.body || '',
      heCtaLabel: he.ctaLabel || '',
      heCtaUrl: he.ctaUrl || '',
      heImageUrl: he.imageUrl || '',
      enTitle: en.title || '',
      enBody: en.body || '',
      enCtaLabel: en.ctaLabel || '',
      enCtaUrl: en.ctaUrl || '',
      enImageUrl: en.imageUrl || ''
    });
  }

  cancelForm(): void {
    this.showForm = false;
    this.editingId = null;
    this.showPreview = false;
  }

  isPageSelected(id: PopupPageId): boolean {
    const targets = (this.form.get('pageTargets')?.value || []) as PopupPageId[];
    return targets.includes(id);
  }

  togglePage(id: PopupPageId): void {
    const targets = new Set((this.form.get('pageTargets')?.value || []) as PopupPageId[]);
    if (targets.has(id)) targets.delete(id);
    else targets.add(id);
    this.form.patchValue({ pageTargets: Array.from(targets) });
  }

  onImageSelected(event: Event, locale: 'he' | 'en'): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.isUploading = true;
    this.uploadService.uploadImage(file).subscribe({
      next: (res) => {
        this.isUploading = false;
        const key = locale === 'he' ? 'heImageUrl' : 'enImageUrl';
        this.form.patchValue({ [key]: res.imageUrl });
        this.showSuccess('התמונה הועלתה');
        input.value = '';
      },
      error: () => {
        this.isUploading = false;
        this.showError('שגיאה בהעלאת התמונה');
        input.value = '';
      }
    });
  }

  clearImage(locale: 'he' | 'en'): void {
    const key = locale === 'he' ? 'heImageUrl' : 'enImageUrl';
    this.form.patchValue({ [key]: '' });
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.showError('נא למלא שם פנימי');
      return;
    }
    const v = this.form.getRawValue();
    if (!v.targetAllPages && (!v.pageTargets || v.pageTargets.length === 0)) {
      this.showError('בחרו לפחות דף אחד, או סמנו אתר שלם');
      return;
    }

    const payload: SitePopup = {
      internalName: (v.internalName || '').trim(),
      status: v.status,
      template: v.template,
      placement: v.placement,
      targetAllPages: !!v.targetAllPages,
      pageTargets: v.targetAllPages ? [] : v.pageTargets || [],
      priority: Number(v.priority) || 0,
      startAt: v.useSchedule && v.startAt ? new Date(v.startAt).toISOString() : null,
      endAt: v.useSchedule && v.endAt ? new Date(v.endAt).toISOString() : null,
      frequency: v.frequency,
      maxViews: v.frequency === 'max' ? Math.max(1, Number(v.maxViews) || 1) : null,
      content: {
        he: {
          title: (v.heTitle || '').trim(),
          body: (v.heBody || '').trim(),
          ctaLabel: (v.heCtaLabel || '').trim(),
          ctaUrl: (v.heCtaUrl || '').trim(),
          imageUrl: (v.heImageUrl || '').trim()
        },
        en: {
          title: (v.enTitle || '').trim(),
          body: (v.enBody || '').trim(),
          ctaLabel: (v.enCtaLabel || '').trim(),
          ctaUrl: (v.enCtaUrl || '').trim(),
          imageUrl: (v.enImageUrl || '').trim()
        }
      }
    };

    this.isSubmitting = true;
    const req = this.editingId
      ? this.popupService.update(this.editingId, payload)
      : this.popupService.create(payload);

    req.subscribe({
      next: () => {
        this.isSubmitting = false;
        this.showSuccess(this.editingId ? 'ההודעה עודכנה' : 'ההודעה נוצרה');
        this.cancelForm();
        this.load();
      },
      error: (err) => {
        this.isSubmitting = false;
        this.showError(err?.error?.message || 'שגיאה בשמירה');
      }
    });
  }

  deletePopup(p: SitePopup): void {
    if (!p._id) return;
    if (!confirm(`למחוק את "${p.internalName}"?`)) return;
    this.popupService.delete(p._id).subscribe({
      next: () => {
        this.showSuccess('נמחק');
        this.load();
      },
      error: () => this.showError('שגיאה במחיקה')
    });
  }

  setStatus(p: SitePopup, status: SitePopup['status']): void {
    if (!p._id) return;
    const payload: SitePopup = { ...p, status };
    this.popupService.update(p._id, payload).subscribe({
      next: () => {
        p.status = status;
        this.showSuccess('הסטטוס עודכן');
      },
      error: () => this.showError('שגיאה בעדכון סטטוס')
    });
  }

  migrate(): void {
    if (!confirm('לייבא הודעות קיימות מהגדרות האתר? (לא ייצור כפילויות)')) return;
    this.isMigrating = true;
    this.popupService.migrateFromSettings().subscribe({
      next: (r) => {
        this.isMigrating = false;
        this.showSuccess(r.created ? `יובאו ${r.created} הודעות` : 'לא נמצאו הודעות חדשות לייבוא');
        this.load();
      },
      error: () => {
        this.isMigrating = false;
        this.showError('שגיאה בייבוא');
      }
    });
  }

  openPreview(): void {
    this.showPreview = true;
    this.previewLocale = this.contentTab;
  }

  getPreviewContent(): PopupLocaleContent {
    const v = this.form.getRawValue();
    if (this.previewLocale === 'en') {
      return {
        title: v.enTitle,
        body: v.enBody,
        ctaLabel: v.enCtaLabel,
        ctaUrl: v.enCtaUrl,
        imageUrl: v.enImageUrl
      };
    }
    return {
      title: v.heTitle,
      body: v.heBody,
      ctaLabel: v.heCtaLabel,
      ctaUrl: v.heCtaUrl,
      imageUrl: v.heImageUrl
    };
  }

  statusLabel(s: string): string {
    return this.statusOptions.find((o) => o.value === s)?.label || s;
  }

  templateLabel(s: string): string {
    return this.templateOptions.find((o) => o.value === s)?.label || s;
  }

  placementLabel(s: string): string {
    return this.placementOptions.find((o) => o.value === s)?.label || s;
  }

  pagesLabel(p: SitePopup): string {
    if (p.targetAllPages || !p.pageTargets?.length) return 'אתר שלם';
    return p.pageTargets
      .map((id) => this.pageOptions.find((o) => o.id === id)?.label || id)
      .join(', ');
  }

  private toDateTimeLocal(raw: string | null | undefined): string {
    if (!raw) return '';
    const d = new Date(raw);
    if (isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  private showSuccess(msg: string): void {
    this.successMessage = msg;
    this.errorMessage = '';
    setTimeout(() => (this.successMessage = ''), 3500);
  }

  private showError(msg: string): void {
    this.errorMessage = msg;
    this.successMessage = '';
  }
}
