import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Subscription, combineLatest } from 'rxjs';
import {
  QuotesService,
  Quote,
  QuoteLine,
  QuoteStatus,
  QuoteAudience,
  PrivatePackage,
  PrivateTemplateKey,
  PrivateServiceCategory,
  ReadyFoodLine,
  QUOTE_STATUS_LABELS,
  PRIVATE_CATEGORY_LABELS,
  MEGADIM_COMPANY_DEFAULTS,
  MEGADIM_BANK_DEFAULTS,
  computeQuoteTotalsLocal,
  getPrivateTemplate,
  getDefaultPackageForCategory,
  buildPrivateWhatsAppText,
  computePrivatePackageTotal,
  computeEventsRatePerPortion,
  resolveTemplateKey
} from '../../../services/quotes.service';

@Component({
  selector: 'app-admin-quotes',
  standalone: true,
  imports: [CommonModule, FormsModule, MatSnackBarModule, MatProgressSpinnerModule],
  providers: [DatePipe],
  templateUrl: './admin-quotes.component.html',
  styleUrls: ['./admin-quotes.component.scss']
})
export class AdminQuotesComponent implements OnInit, OnDestroy {
  private api = inject(QuotesService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private snack = inject(MatSnackBar);
  private datePipe = inject(DatePipe);
  private sub?: Subscription;

  mode: 'list' | 'editor' = 'list';
  audienceTab: QuoteAudience = 'business';
  loading = false;
  saving = false;

  quotes: Quote[] = [];
  kpis = {
    draftCount: 0,
    sentThisMonthCount: 0,
    acceptedCount: 0,
    openQuotesAmount: 0
  };
  meta = { page: 1, limit: 25, total: 0, pages: 1 };
  search = '';
  statusFilter = 'all';
  readonly statusLabels = QUOTE_STATUS_LABELS;
  readonly statusOptions: Array<{ value: string; label: string }> = [
    { value: 'all', label: 'כל הסטטוסים' },
    ...Object.entries(QUOTE_STATUS_LABELS).map(([value, label]) => ({ value, label }))
  ];
  readonly extraPresets = [
    'שתיה של קוקה קולה',
    'מפות ומפיות (בחירת צבעים לכל סעודה)',
    'כלים מזכוכית או חרסינה',
    'מנהל אירוע לתפעול, הכנה וסידור שולחנות'
  ];
  readonly categoryLabels = PRIVATE_CATEGORY_LABELS;
  readonly privateCategories: PrivateServiceCategory[] = [
    'events',
    'catering_shabbat',
    'shabbat_ready'
  ];

  quoteId: string | null = null;
  isNew = false;
  form = this.emptyBusinessForm();
  privatePkg: PrivatePackage = getDefaultPackageForCategory('catering_shabbat');
  extrasDraft = '';

  readonly quickTemplates = [
    {
      label: 'חבילת אירוע (לפי מנה)',
      line: {
        sku: '1000',
        description: 'שירותי קייטרינג — אירוע',
        quantity: 1,
        unitPriceInclVat: 0
      }
    },
    {
      label: 'משלוח',
      line: { sku: '9', description: 'משלוח', quantity: 1, unitPriceInclVat: 150 }
    },
    {
      label: 'לא כולל מלצרים',
      line: {
        sku: '0',
        description: 'המחיר לא כולל שירותי עריכה, כלים ומלצרים',
        quantity: 1,
        unitPriceInclVat: 0
      }
    }
  ];

  ngOnInit(): void {
    this.sub = combineLatest([this.route.paramMap, this.route.queryParamMap]).subscribe(
      ([params, query]) => {
        const tab = query.get('audience');
        if (tab === 'private' || tab === 'business') this.audienceTab = tab;

        const id = params.get('id');
        if (id) {
          this.mode = 'editor';
          this.quoteId = id === 'new' ? null : id;
          this.isNew = id === 'new';
          if (this.isNew) {
            const aud = (query.get('audience') as QuoteAudience) || this.audienceTab || 'business';
            this.audienceTab = aud === 'private' ? 'private' : 'business';
            this.form = this.emptyBusinessForm();
            this.privatePkg = getDefaultPackageForCategory('catering_shabbat');
            this.extrasDraft = this.privatePkg.extras.join('\n');
          } else if (this.quoteId) {
            this.loadQuote(this.quoteId);
          }
        } else {
          this.mode = 'list';
          this.loadList();
        }
      }
    );
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  get isPrivate(): boolean {
    return this.audienceTab === 'private';
  }

  get liveTotals() {
    return computeQuoteTotalsLocal({
      lines: this.form.lines,
      discountPercent: this.form.discountPercent,
      vatRate: this.form.vatRate
    });
  }

  get privateTotal(): number {
    return computePrivatePackageTotal(this.privatePkg);
  }

  get eventsRate(): number {
    return computeEventsRatePerPortion(this.privatePkg);
  }

  get whatsappPreview(): string {
    const pkg: PrivatePackage = {
      ...this.privatePkg,
      extras: this.parseExtras(),
      readyLines: this.privatePkg.readyLines || []
    };
    return buildPrivateWhatsAppText(pkg);
  }

  get editable(): boolean {
    return this.isNew || this.form.status === 'draft' || this.form.status === 'sent';
  }

  emptyBusinessForm() {
    return {
      quoteNumber: 'טיוטה חדשה',
      status: 'draft' as QuoteStatus,
      client: {
        name: '',
        company: '',
        idNumber: '',
        address: '',
        phone: '',
        email: '',
        theirRef: ''
      },
      eventDate: '',
      eventLocation: '',
      lines: [{ sku: '', description: '', quantity: 1, unitPriceInclVat: 0 }] as QuoteLine[],
      discountPercent: 0,
      notes: '',
      vatRate: 18,
      issuedBy: MEGADIM_COMPANY_DEFAULTS.producerName,
      companySnapshot: { ...MEGADIM_COMPANY_DEFAULTS },
      bankSnapshot: { ...MEGADIM_BANK_DEFAULTS }
    };
  }

  setAudienceTab(tab: QuoteAudience): void {
    if (this.mode !== 'list') return;
    this.audienceTab = tab;
    this.meta.page = 1;
    this.router.navigate(['/admin/quotes'], { queryParams: { audience: tab } });
  }

  loadList(): void {
    this.loading = true;
    this.api
      .list({
        audience: this.audienceTab,
        status: this.statusFilter,
        search: this.search.trim() || undefined,
        page: this.meta.page,
        limit: this.meta.limit
      })
      .subscribe({
        next: (res) => {
          this.quotes = res.data || [];
          this.kpis = res.kpis;
          this.meta = res.meta;
          this.loading = false;
        },
        error: (err) => {
          this.loading = false;
          this.snack.open(err?.error?.error?.message || 'שגיאה בטעינת הצעות מחיר', 'סגור', {
            duration: 4000
          });
        }
      });
  }

  loadQuote(id: string): void {
    this.loading = true;
    this.api.get(id).subscribe({
      next: (q) => {
        this.applyQuoteToForm(q);
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.snack.open(err?.error?.error?.message || 'הצעה לא נמצאה', 'סגור', { duration: 4000 });
        this.router.navigate(['/admin/quotes'], { queryParams: { audience: this.audienceTab } });
      }
    });
  }

  applyQuoteToForm(q: Quote): void {
    this.audienceTab = q.audience === 'private' ? 'private' : 'business';
    this.form = {
      quoteNumber: q.quoteNumber,
      status: q.status,
      client: {
        name: q.client?.name || '',
        company: q.client?.company || '',
        idNumber: q.client?.idNumber || '',
        address: q.client?.address || '',
        phone: q.client?.phone || '',
        email: q.client?.email || '',
        theirRef: q.client?.theirRef || ''
      },
      eventDate: q.eventDate ? String(q.eventDate).slice(0, 10) : '',
      eventLocation: q.eventLocation || '',
      lines: (q.lines || []).map((l) => ({
        sku: l.sku || '',
        description: l.description || '',
        quantity: Number(l.quantity) || 0,
        unitPriceInclVat: Number(l.unitPriceInclVat) || 0
      })),
      discountPercent: Number(q.discountPercent) || 0,
      notes: q.notes || '',
      vatRate: Number(q.vatRate) || 18,
      issuedBy: q.issuedBy || q.companySnapshot?.producerName || MEGADIM_COMPANY_DEFAULTS.producerName,
      companySnapshot: { ...MEGADIM_COMPANY_DEFAULTS, ...(q.companySnapshot || {}) },
      bankSnapshot: { ...MEGADIM_BANK_DEFAULTS, ...(q.bankSnapshot || {}) }
    };
    if (!this.form.lines.length) {
      this.form.lines = [{ sku: '', description: '', quantity: 1, unitPriceInclVat: 0 }];
    }
    if (q.privatePackage) {
      const key = resolveTemplateKey(q.privatePackage.templateKey || 'two_meals');
      const base = getPrivateTemplate(key);
      this.privatePkg = {
        ...base,
        ...q.privatePackage,
        serviceCategory:
          q.privatePackage.serviceCategory ||
          base.serviceCategory ||
          'catering_shabbat',
        templateKey: key,
        friday: { ...base.friday, ...(q.privatePackage.friday || {}) },
        saturday: { ...base.saturday, ...(q.privatePackage.saturday || {}) },
        extras: [...(q.privatePackage.extras || base.extras || [])],
        readyLines: (q.privatePackage.readyLines || base.readyLines || []).map((l) => ({
          description: l.description || '',
          quantity: Number(l.quantity) || 0,
          unitPrice: Number(l.unitPrice) || 0
        }))
      };
      if (!this.privatePkg.readyLines.length && this.privatePkg.serviceCategory === 'shabbat_ready') {
        this.privatePkg.readyLines = [{ description: '', quantity: 1, unitPrice: 0 }];
      }
      this.extrasDraft = this.privatePkg.extras.join('\n');
    } else {
      this.privatePkg = getDefaultPackageForCategory('catering_shabbat');
      this.extrasDraft = this.privatePkg.extras.join('\n');
    }
  }

  onSearch(): void {
    this.meta.page = 1;
    this.loadList();
  }

  createNew(): void {
    this.router.navigate(['/admin/quotes', 'new'], {
      queryParams: { audience: this.audienceTab }
    });
  }

  openQuote(q: Quote): void {
    this.router.navigate(['/admin/quotes', q._id], {
      queryParams: { audience: q.audience === 'private' ? 'private' : 'business' }
    });
  }

  backToList(): void {
    this.router.navigate(['/admin/quotes'], { queryParams: { audience: this.audienceTab } });
  }

  setPrivateCategory(category: PrivateServiceCategory): void {
    if (!this.editable) return;
    const prevPortions = this.privatePkg.portions;
    const prevClientNotes = {
      portionsEvening: this.privatePkg.portionsEvening,
      portionsMorning: this.privatePkg.portionsMorning
    };
    this.privatePkg = getDefaultPackageForCategory(category);
    if (category !== 'shabbat_ready' && prevPortions > 0) {
      this.privatePkg.portions = prevPortions;
      if (category === 'catering_shabbat') {
        this.privatePkg.portionsEvening = prevClientNotes.portionsEvening || prevPortions;
        this.privatePkg.portionsMorning =
          this.privatePkg.mealScope === 'both'
            ? prevClientNotes.portionsMorning || prevPortions
            : this.privatePkg.portionsMorning;
      }
    }
    this.extrasDraft = this.privatePkg.extras.join('\n');
  }

  applyPrivateTemplate(key: PrivateTemplateKey): void {
    const prevPortions = this.privatePkg.portions;
    const prevEvening = this.privatePkg.portionsEvening;
    const prevMorning = this.privatePkg.portionsMorning;
    this.privatePkg = getPrivateTemplate(key);
    if (this.privatePkg.serviceCategory !== 'shabbat_ready') {
      this.privatePkg.portions = prevPortions || this.privatePkg.portions;
      this.privatePkg.portionsEvening = prevEvening || this.privatePkg.portionsEvening;
      this.privatePkg.portionsMorning = prevMorning || this.privatePkg.portionsMorning;
    }
    this.extrasDraft = this.privatePkg.extras.join('\n');
  }

  syncShabbatPortionsFromScope(): void {
    if (this.privatePkg.mealScope === 'evening') {
      this.privatePkg.portions = this.privatePkg.portionsEvening;
    } else if (this.privatePkg.mealScope === 'morning') {
      this.privatePkg.portions = this.privatePkg.portionsMorning;
    } else {
      this.privatePkg.portions = Math.max(
        this.privatePkg.portionsEvening || 0,
        this.privatePkg.portionsMorning || 0
      );
    }
  }

  addReadyLine(): void {
    if (!this.privatePkg.readyLines) this.privatePkg.readyLines = [];
    this.privatePkg.readyLines.push({ description: '', quantity: 1, unitPrice: 0 });
  }

  removeReadyLine(index: number): void {
    if (!this.privatePkg.readyLines || this.privatePkg.readyLines.length <= 1) return;
    this.privatePkg.readyLines.splice(index, 1);
  }

  readyLineTotal(line: ReadyFoodLine): number {
    return Math.round((Number(line.quantity) || 0) * (Number(line.unitPrice) || 0) * 100) / 100;
  }

  categoryLabel(q: Quote): string {
    const cat = q.privatePackage?.serviceCategory;
    if (cat && PRIVATE_CATEGORY_LABELS[cat]) return PRIVATE_CATEGORY_LABELS[cat];
    return '';
  }

  parseExtras(): string[] {
    return String(this.extrasDraft || '')
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 20);
  }

  toggleExtraPreset(text: string): void {
    const list = this.parseExtras();
    const idx = list.indexOf(text);
    if (idx >= 0) list.splice(idx, 1);
    else list.push(text);
    this.extrasDraft = list.join('\n');
  }

  hasExtra(text: string): boolean {
    return this.parseExtras().includes(text);
  }

  addLine(noteOnly = false): void {
    this.form.lines.push({
      sku: noteOnly ? '0' : '',
      description: '',
      quantity: 1,
      unitPriceInclVat: 0
    });
  }

  addTemplate(line: QuoteLine): void {
    this.form.lines.push({ ...line });
  }

  removeLine(index: number): void {
    if (this.form.lines.length <= 1) return;
    this.form.lines.splice(index, 1);
  }

  lineTotal(line: QuoteLine): number {
    return Math.round((Number(line.quantity) || 0) * (Number(line.unitPriceInclVat) || 0) * 100) / 100;
  }

  payloadFromForm() {
    if (this.isPrivate) {
      const pkg = { ...this.privatePkg, extras: this.parseExtras() };
      return {
        audience: 'private' as QuoteAudience,
        client: this.form.client,
        eventDate: this.form.eventDate || null,
        eventLocation: this.form.eventLocation,
        notes: this.form.notes,
        issuedBy: this.form.issuedBy,
        privatePackage: pkg,
        companySnapshot: this.form.companySnapshot,
        bankSnapshot: this.form.bankSnapshot
      };
    }
    const totals = this.liveTotals;
    return {
      audience: 'business' as QuoteAudience,
      client: this.form.client,
      eventDate: this.form.eventDate || null,
      eventLocation: this.form.eventLocation,
      lines: totals.lines,
      discountPercent: this.form.discountPercent,
      notes: this.form.notes,
      vatRate: this.form.vatRate,
      issuedBy: this.form.issuedBy,
      companySnapshot: {
        ...this.form.companySnapshot,
        producerName: this.form.issuedBy || this.form.companySnapshot.producerName
      },
      bankSnapshot: this.form.bankSnapshot
    };
  }

  save(): void {
    if (!this.editable) return;
    const payload = this.payloadFromForm();
    if (!this.isPrivate) {
      const lines = (payload as any).lines || [];
      if (!lines.length) {
        this.snack.open('יש להוסיף לפחות שורה אחת עם תיאור', 'סגור', { duration: 3000 });
        return;
      }
    }
    this.saving = true;
    const req$ =
      this.isNew || !this.quoteId
        ? this.api.create(payload)
        : this.api.update(this.quoteId, payload);

    req$.subscribe({
      next: (q) => {
        this.saving = false;
        this.snack.open('ההצעה נשמרה', 'סגור', { duration: 2500 });
        if (this.isNew) {
          this.router.navigate(['/admin/quotes', q._id], {
            replaceUrl: true,
            queryParams: { audience: q.audience === 'private' ? 'private' : 'business' }
          });
        } else {
          this.applyQuoteToForm(q);
        }
      },
      error: (err) => {
        this.saving = false;
        this.snack.open(err?.error?.error?.message || 'שגיאה בשמירה', 'סגור', { duration: 4000 });
      }
    });
  }

  markSent(): void {
    this.saveThenStatus('sent');
  }

  setStatus(status: QuoteStatus): void {
    if (!this.quoteId || this.isNew) {
      this.snack.open('יש לשמור את ההצעה לפני שינוי סטטוס', 'סגור', { duration: 3000 });
      return;
    }
    this.saving = true;
    this.api.changeStatus(this.quoteId, status).subscribe({
      next: (q) => {
        this.saving = false;
        this.applyQuoteToForm(q);
        this.snack.open(`סטטוס עודכן ל־${QUOTE_STATUS_LABELS[status]}`, 'סגור', { duration: 2500 });
      },
      error: (err) => {
        this.saving = false;
        this.snack.open(err?.error?.error?.message || 'שגיאה בעדכון סטטוס', 'סגור', { duration: 4000 });
      }
    });
  }

  private saveThenStatus(status: QuoteStatus): void {
    if (!this.editable && status === 'sent') {
      this.setStatus(status);
      return;
    }
    const payload = this.payloadFromForm();
    this.saving = true;
    const afterSave = (q: Quote) => {
      this.quoteId = q._id;
      this.isNew = false;
      this.api.changeStatus(q._id, status).subscribe({
        next: (updated) => {
          this.saving = false;
          this.applyQuoteToForm(updated);
          this.router.navigate(['/admin/quotes', updated._id], {
            replaceUrl: true,
            queryParams: { audience: updated.audience === 'private' ? 'private' : 'business' }
          });
          this.snack.open(
            this.isPrivate ? 'ההצעה סומנה כנשלחה — אפשר להעתיק לוואטסאפ' : 'ההצעה סומנה כנשלחה',
            'סגור',
            { duration: 2800 }
          );
        },
        error: (err) => {
          this.saving = false;
          this.applyQuoteToForm(q);
          this.snack.open(err?.error?.error?.message || 'נשמרה אך עדכון הסטטוס נכשל', 'סגור', {
            duration: 4000
          });
        }
      });
    };

    const req$ =
      this.isNew || !this.quoteId
        ? this.api.create(payload)
        : this.api.update(this.quoteId, payload);
    req$.subscribe({
      next: afterSave,
      error: (err) => {
        this.saving = false;
        this.snack.open(err?.error?.error?.message || 'שגיאה בשמירה', 'סגור', { duration: 4000 });
      }
    });
  }

  async copyWhatsApp(): Promise<void> {
    const text = this.whatsappPreview;
    try {
      await navigator.clipboard.writeText(text);
      this.snack.open('הטקסט הועתק — הדביקו בוואטסאפ', 'סגור', { duration: 2800 });
    } catch {
      this.snack.open('לא ניתן להעתיק אוטומטית — סמנו את הטקסט ידנית', 'סגור', { duration: 3500 });
    }
  }

  duplicate(): void {
    if (!this.quoteId || this.isNew) return;
    this.saving = true;
    this.api.duplicate(this.quoteId).subscribe({
      next: (q) => {
        this.saving = false;
        this.snack.open('נוצרה הצעה משוכפלת', 'סגור', { duration: 2500 });
        this.router.navigate(['/admin/quotes', q._id], {
          queryParams: { audience: q.audience === 'private' ? 'private' : 'business' }
        });
      },
      error: (err) => {
        this.saving = false;
        this.snack.open(err?.error?.error?.message || 'שגיאה בשכפול', 'סגור', { duration: 4000 });
      }
    });
  }

  remove(): void {
    if (!this.quoteId || this.isNew) return;
    if (!confirm('למחוק את הצעת המחיר?')) return;
    this.api.remove(this.quoteId).subscribe({
      next: () => {
        this.snack.open('ההצעה נמחקה', 'סגור', { duration: 2500 });
        this.router.navigate(['/admin/quotes'], { queryParams: { audience: this.audienceTab } });
      },
      error: (err) => {
        this.snack.open(err?.error?.error?.message || 'שגיאה במחיקה', 'סגור', { duration: 4000 });
      }
    });
  }

  printPreview(): void {
    window.print();
  }

  downloadPdf(): void {
    if (this.isPrivate) {
      this.snack.open('להצעות פרטיות העתיקו את טקסט הוואטסאפ', 'סגור', { duration: 3000 });
      return;
    }
    if (!this.quoteId || this.isNew) {
      this.snack.open('יש לשמור לפני הורדת PDF', 'סגור', { duration: 3000 });
      return;
    }
    this.saving = true;
    this.api.downloadPdf(this.quoteId).subscribe({
      next: (blob) => {
        this.saving = false;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `quote-${String(this.form.quoteNumber).replace(/\//g, '-')}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      },
      error: (err) => {
        this.saving = false;
        this.snack.open(err?.error?.error?.message || 'שגיאה בהורדת PDF', 'סגור', { duration: 4000 });
      }
    });
  }

  formatMoney(n: number): string {
    return (Number(n) || 0).toLocaleString('he-IL', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  clientLabel(q: Quote): string {
    return q.client?.company || q.client?.name || '—';
  }

  statusClass(status: QuoteStatus): string {
    switch (status) {
      case 'draft':
        return 'st-draft';
      case 'sent':
        return 'st-sent';
      case 'accepted':
        return 'st-ok';
      case 'rejected':
      case 'expired':
        return 'st-bad';
      case 'converted':
        return 'st-done';
      default:
        return '';
    }
  }

  bankLine(): string {
    const b = this.form.bankSnapshot;
    return `בנק: ${b.bankCode} (${b.bankName}) סניף: ${b.branch} חשבון: ${b.account}`;
  }

  previewDate(): string {
    return this.datePipe.transform(new Date(), 'dd/MM/yyyy') || '';
  }

  previewTime(): string {
    return this.datePipe.transform(new Date(), 'HH:mm') || '';
  }
}
