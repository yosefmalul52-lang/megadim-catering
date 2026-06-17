import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, FormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule } from '@angular/material/table';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import {
  InstitutionAdminService,
  InstitutionUser,
  InstitutionWeekReports,
  PackingOrderDay,
  institutionId,
  getCurrentWeekStart,
  getPreviousWeekStartKey,
  normalizeWeekInput,
  sumOrderDays
} from '../../../services/institution-admin.service';
import {
  MENU_CATEGORIES,
  MENU_DAY_FORM_FIELDS,
  emptyMenuDayItems,
  isMenuWeekPublished,
  type MenuCategoryKey,
  type MenuWeek
} from '../../../utils/menu-structure';
import { shiftWeekStartKey, getWeekRangeString, getWeekRangeReportString, getWeekRangePackingReportString, formatWeekDateHe, getWeekEndKey, getWeekOffsetFromCurrent, getWeekOffsetLabel } from '../../../utils/portal-week';
import { datetimeLocalToIso, isoToDatetimeLocal } from '../../../utils/datetime-local.utils';
import { B2BDictionaryService } from '../../../services/b2b-dictionary.service';
import {
  B2B_DICTIONARY_CATEGORIES,
  dictionaryCategoryForMenuKey,
  dictionaryCategoryLabel,
  type B2BMenuItem,
  type B2BDictionaryCategory
} from '../../../utils/b2b-dictionary';
import {
  buildCategoryLogisticsLine,
  formatLogisticsBrief,
  type CategoryLogisticsDisplayLine
} from '../../../utils/kitchen-logistics';

@Component({
  selector: 'app-admin-institutions',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
    MatTabsModule,
    MatTableModule,
    MatSelectModule,
    MatFormFieldModule
  ],
  templateUrl: './admin-institutions.component.html',
  styleUrls: ['./admin-institutions.component.scss']
})
export class AdminInstitutionsComponent implements OnInit {
  private institutionService = inject(InstitutionAdminService);
  private dictionaryService = inject(B2BDictionaryService);
  private fb = inject(FormBuilder);
  private snackBar = inject(MatSnackBar);

  /** Global week timeline — drives all tabs */
  selectedWeekStart = getCurrentWeekStart();

  showOrderModal = false;
  orderEditInstitutionId = '';
  orderEditInstitutionName = '';
  orderEditWeek = '';
  orderForm!: FormGroup;
  isLoadingOrder = false;
  isSavingOrder = false;
  orderError = '';

  institutions: InstitutionUser[] = [];
  isLoadingAccounts = true;
  isSavingAccount = false;
  accountsError = '';

  showModal = false;
  editingId: string | null = null;
  accountForm!: FormGroup;

  menuForm!: FormGroup;
  isLoadingMenu = false;
  isSavingMenu = false;
  isClearingMenu = false;
  isCopyingMenu = false;
  menuError = '';
  menuPublished = false;

  reports: InstitutionWeekReports | null = null;
  isLoadingReports = false;
  reportsError = '';
  reportsLoaded = false;

  showDictionaryModal = false;
  dictionaryItems: B2BMenuItem[] = [];
  isLoadingDictionary = false;
  isSavingDictionary = false;
  dictionaryError = '';
  editingDictionaryId: string | null = null;
  dictionaryForm!: FormGroup;

  readonly institutionId = institutionId;
  readonly menuDayFields = MENU_DAY_FORM_FIELDS;
  readonly menuCategories = MENU_CATEGORIES;
  readonly dictionaryCategories = B2B_DICTIONARY_CATEGORIES;
  readonly dictionaryCategoryLabel = dictionaryCategoryLabel;

  kitchenColumns = ['dayLabel', 'menuItem', 'totalRegular', 'totalVegetarian', 'grandTotal'];
  accountColumns = ['fullName', 'username', 'weekOrder', 'status', 'actions'];

  get selectedWeekRangeLabel(): string {
    return getWeekRangeString(this.selectedWeekStart);
  }

  get selectedWeekDatesOnly(): string {
    const start = normalizeWeekInput(this.selectedWeekStart);
    if (!start) return '';
    return `מ- ${formatWeekDateHe(start)} עד ${formatWeekDateHe(getWeekEndKey(start))}`;
  }

  get selectedWeekOffset(): number {
    return getWeekOffsetFromCurrent(this.selectedWeekStart);
  }

  get selectedWeekOffsetLabel(): string {
    return getWeekOffsetLabel(this.selectedWeekStart);
  }

  get reportsWeekRangeTitle(): string {
    const week = this.reports?.weekStartDate || this.selectedWeekStart;
    return getWeekRangeReportString(week);
  }

  get reportsPackingRangeTitle(): string {
    const week = this.reports?.weekStartDate || this.selectedWeekStart;
    return getWeekRangePackingReportString(week);
  }

  ngOnInit(): void {
    this.buildAccountForm();
    this.buildMenuForm();
    this.buildDictionaryForm();
    this.orderForm = this.fb.group({ days: this.fb.array([]) });
    this.loadDictionary();
    this.refreshAllTabs();
  }

  get orderDaysArray(): FormArray {
    return this.orderForm.get('days') as FormArray;
  }

  private buildAccountForm(): void {
    this.accountForm = this.fb.group({
      fullName: ['', [Validators.required, Validators.minLength(2)]],
      username: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.minLength(6)]],
      phone: [''],
      customMessage: [''],
      isActive: [true]
    });
  }

  /** Refresh data for all tabs from the global week selector */
  refreshAllTabs(): void {
    this.loadInstitutions();
    this.loadWeekMenu();
    this.loadReports();
  }

  private buildMenuDayGroup() {
    return this.fb.group({
      mainMeat: [''],
      vegetarianMain: [''],
      carb1: [''],
      carb2: [''],
      side: [''],
      saladFruit: ['']
    });
  }

  private buildMenuForm(): void {
    const dayGroups: Record<string, FormGroup> = {};
    for (const day of MENU_DAY_FORM_FIELDS) {
      dayGroups[day.key] = this.buildMenuDayGroup();
    }
    this.menuForm = this.fb.group({
      orderDeadline: ['', Validators.required],
      ...dayGroups
    });
  }

  menuDayGroup(dayKey: string): FormGroup {
    return this.menuForm.get(dayKey) as FormGroup;
  }

  private buildDictionaryForm(): void {
    this.dictionaryForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      category: ['mainMeat' as B2BDictionaryCategory, Validators.required],
      gramsPerPortion: [200, [Validators.min(1)]],
      portionsPerGastronorm: [40, [Validators.min(1)]]
    });
  }

  get dictionaryFormCategory(): B2BDictionaryCategory {
    return this.dictionaryForm.get('category')?.value || 'mainMeat';
  }

  loadDictionary(): void {
    this.isLoadingDictionary = true;
    this.dictionaryService.list(undefined, true).subscribe({
      next: (items) => {
        this.dictionaryItems = items;
        this.isLoadingDictionary = false;
      },
      error: (err) => {
        this.isLoadingDictionary = false;
        this.dictionaryError = err?.error?.message || 'שגיאה בטעינת מאגר מנות';
      }
    });
  }

  openDictionaryModal(): void {
    this.dictionaryError = '';
    this.editingDictionaryId = null;
    this.dictionaryForm.reset({
      name: '',
      category: 'mainMeat',
      gramsPerPortion: 200,
      portionsPerGastronorm: 40
    });
    this.showDictionaryModal = true;
    if (!this.dictionaryItems.length) {
      this.loadDictionary();
    }
  }

  closeDictionaryModal(): void {
    this.showDictionaryModal = false;
    this.editingDictionaryId = null;
    this.dictionaryError = '';
  }

  editDictionaryItem(item: B2BMenuItem): void {
    this.editingDictionaryId = item.id;
    this.dictionaryForm.patchValue({
      name: item.name,
      category: item.category,
      gramsPerPortion: item.gramsPerPortion || 200,
      portionsPerGastronorm: item.portionsPerGastronorm || 40
    });
  }

  cancelDictionaryEdit(): void {
    this.editingDictionaryId = null;
    this.dictionaryForm.reset({
      name: '',
      category: 'mainMeat',
      gramsPerPortion: 200,
      portionsPerGastronorm: 40
    });
  }

  submitDictionaryForm(): void {
    if (this.dictionaryForm.invalid) return;
    const v = this.dictionaryForm.value;
    const payload = {
      name: String(v.name).trim(),
      category: v.category as B2BDictionaryCategory,
      gramsPerPortion: v.category === 'mainMeat' ? Number(v.gramsPerPortion) || 200 : undefined,
      portionsPerGastronorm: v.category === 'mainMeat' ? undefined : Number(v.portionsPerGastronorm) || 40
    };

    this.isSavingDictionary = true;
    this.dictionaryError = '';
    const req = this.editingDictionaryId
      ? this.dictionaryService.update(this.editingDictionaryId, payload)
      : this.dictionaryService.create(payload);

    req.subscribe({
      next: () => {
        this.isSavingDictionary = false;
        this.snackBar.open(this.editingDictionaryId ? 'מנה עודכנה' : 'מנה נוספה למאגר', 'סגור', {
          duration: 4000
        });
        this.cancelDictionaryEdit();
        this.loadDictionary();
      },
      error: (err) => {
        this.isSavingDictionary = false;
        this.dictionaryError = err?.error?.message || 'שגיאה בשמירת מנה';
      }
    });
  }

  deleteDictionaryItem(item: B2BMenuItem): void {
    if (!confirm(`להסיר את "${item.name}" מהמאגר? (המנה תישמר לדוחות היסטוריים)`)) return;
    this.dictionaryService.delete(item.id).subscribe({
      next: () => {
        this.snackBar.open('מנה הוסרה מהמאגר', 'סגור', { duration: 4000 });
        if (this.editingDictionaryId === item.id) {
          this.cancelDictionaryEdit();
        }
        this.loadDictionary();
      },
      error: (err) => {
        this.snackBar.open(err?.error?.message || 'שגיאה במחיקת מנה', 'סגור', { duration: 5000 });
      }
    });
  }

  dictionaryItemsByCategory(category: B2BDictionaryCategory): B2BMenuItem[] {
    return this.dictionaryItems.filter((i) => i.category === category && i.isActive !== false);
  }

  menuSelectOptions(menuCategoryKey: MenuCategoryKey, currentValue?: string | null): { value: string; label: string }[] {
    const dictCat = dictionaryCategoryForMenuKey(menuCategoryKey);
    const items = this.dictionaryItems.filter((i) => i.category === dictCat && i.isActive !== false);
    const options: { value: string; label: string }[] = [{ value: '', label: '— ללא —' }];
    for (const item of items) {
      const suffix =
        item.category === 'mainMeat'
          ? ` (${item.gramsPerPortion} ג' למנה)`
          : ` (${item.portionsPerGastronorm || 40} מנות/גסטרונום)`;
      options.push({ value: item.name, label: `${item.name}${suffix}` });
    }
    const current = String(currentValue ?? '').trim();
    if (current && !items.some((i) => i.name === current)) {
      options.push({ value: current, label: `${current} (לא במאגר)` });
    }
    return options;
  }

  lookupDictionaryItem(dishName: string, menuCategoryKey: MenuCategoryKey): B2BMenuItem | undefined {
    const trimmed = dishName.trim();
    if (!trimmed) return undefined;
    const dictCat = dictionaryCategoryForMenuKey(menuCategoryKey);
    return this.dictionaryItems.find((i) => i.name === trimmed && i.category === dictCat);
  }

  /** Report math: dictionary hit, else safe defaults (40 GN / 200g meat). */
  logisticsForDish(dishName: string, menuCategoryKey: MenuCategoryKey) {
    const item = this.lookupDictionaryItem(dishName, menuCategoryKey);
    if (menuCategoryKey === 'mainMeat') {
      return { gramsPerPortion: item?.gramsPerPortion };
    }
    return { portionsPerGastronorm: item?.portionsPerGastronorm };
  }

  /**
   * mainMeat → regular only; vegetarianMain → vegetarian only; sides/carbs → both.
   */
  private portionsForCategory(
    menuCategoryKey: MenuCategoryKey,
    regularCount: unknown,
    vegetarianCount: unknown
  ): number {
    const regular = Number(regularCount) || 0;
    const vegetarian = Number(vegetarianCount) || 0;
    if (menuCategoryKey === 'mainMeat') {
      return regular;
    }
    if (menuCategoryKey === 'vegetarianMain') {
      return vegetarian;
    }
    return regular + vegetarian;
  }

  private shouldIncludeReportLine(
    menuCategoryKey: MenuCategoryKey,
    portions: number
  ): boolean {
    if (menuCategoryKey === 'vegetarianMain' && portions <= 0) {
      return false;
    }
    return true;
  }

  kitchenCategoryLineItems(row: {
    dayOfWeek: number;
    totalRegular: number;
    totalVegetarian: number;
    grandTotal: number;
  }): CategoryLogisticsDisplayLine[] {
    const dayField = MENU_DAY_FORM_FIELDS.find((d) => d.dayOfWeek === row.dayOfWeek);
    if (!dayField || !this.reports?.menu) return [];
    const dayMenu = this.reports.menu[dayField.key];
    return MENU_CATEGORIES.map((c) => {
      const dish = dayMenu[c.key] || '';
      const portions = this.portionsForCategory(c.key, row.totalRegular, row.totalVegetarian);
      if (!this.shouldIncludeReportLine(c.key, portions)) return null;
      return buildCategoryLogisticsLine(
        c.label,
        dish,
        portions,
        c.key,
        this.logisticsForDish(dish, c.key)
      );
    }).filter((line): line is CategoryLogisticsDisplayLine => line !== null);
  }

  packingCategoryLineItems(day: PackingOrderDay): CategoryLogisticsDisplayLine[] {
    return MENU_CATEGORIES.map((c) => {
      const dish = day.menuItems?.[c.key] || '';
      const portions = this.portionsForCategory(c.key, day.regularCount, day.vegetarianCount);
      if (!this.shouldIncludeReportLine(c.key, portions)) return null;
      return buildCategoryLogisticsLine(
        c.label,
        dish,
        portions,
        c.key,
        this.logisticsForDish(dish, c.key)
      );
    }).filter((line): line is CategoryLogisticsDisplayLine => line !== null);
  }

  packingLogisticsBrief(day: PackingOrderDay): string {
    return formatLogisticsBrief(this.packingCategoryLineItems(day));
  }

  packingLogisticsBriefFromLines(lines: CategoryLogisticsDisplayLine[]): string {
    return formatLogisticsBrief(lines);
  }

  packingDayPortions(day: PackingOrderDay): number {
    return (Number(day.regularCount) || 0) + (Number(day.vegetarianCount) || 0);
  }

  packingDayNotes(day: PackingOrderDay): string {
    return (day.notes || '').trim();
  }

  onGlobalWeekDateChange(): void {
    const normalized = normalizeWeekInput(this.selectedWeekStart);
    if (!normalized) {
      this.snackBar.open('תאריך לא תקין — בחר יום ראשון', 'סגור', { duration: 4000 });
      return;
    }
    this.selectedWeekStart = normalized;
    this.refreshAllTabs();
  }

  goToPreviousWeek(): void {
    this.selectedWeekStart = getPreviousWeekStartKey(this.selectedWeekStart);
    this.refreshAllTabs();
  }

  goToCurrentWeek(): void {
    this.selectedWeekStart = getCurrentWeekStart();
    this.refreshAllTabs();
  }

  goToNextWeek(): void {
    this.selectedWeekStart = shiftWeekStartKey(this.selectedWeekStart, 1);
    this.refreshAllTabs();
  }

  loadInstitutions(): void {
    this.isLoadingAccounts = true;
    this.accountsError = '';
    this.institutionService.list(this.selectedWeekStart).subscribe({
      next: (rows) => {
        this.institutions = rows;
        this.isLoadingAccounts = false;
      },
      error: (err) => {
        this.isLoadingAccounts = false;
        this.accountsError = err?.error?.message || 'שגיאה בטעינת מוסדות';
      }
    });
  }

  loadWeekMenu(): void {
    this.isLoadingMenu = true;
    this.menuError = '';
    this.institutionService.getWeekMenu(this.selectedWeekStart).subscribe({
      next: (data) => {
        this.menuForm.patchValue({
          ...data.menu,
          orderDeadline: data.orderDeadline ? isoToDatetimeLocal(data.orderDeadline) : ''
        });
        this.menuPublished = data.menuPublished ?? isMenuWeekPublished(data.menu);
        this.isLoadingMenu = false;
      },
      error: (err) => {
        this.isLoadingMenu = false;
        this.menuError = err?.error?.message || 'שגיאה בטעינת תפריט';
      }
    });
  }

  saveWeekMenu(): void {
    if (this.menuForm.invalid) {
      this.menuForm.markAllAsTouched();
      if (this.menuForm.get('orderDeadline')?.invalid) {
        this.snackBar.open('נדרש תאריך ושעת סגירת הזמנות לפני שמירת התפריט', 'סגור', { duration: 5000 });
      }
      return;
    }

    const weekStartDate = normalizeWeekInput(this.selectedWeekStart);
    if (!weekStartDate) {
      this.snackBar.open('תאריך שבוע לא תקין', 'סגור', { duration: 5000 });
      return;
    }
    const v = this.menuForm.value;
    const orderDeadlineIso = datetimeLocalToIso(String(v.orderDeadline));
    const menu = MENU_DAY_FORM_FIELDS.reduce((acc, d) => {
      acc[d.key] = { ...emptyMenuDayItems(), ...(v[d.key] || {}) };
      return acc;
    }, {} as MenuWeek);

    this.isSavingMenu = true;
    this.menuError = '';
    this.institutionService
      .saveWeekMenu(weekStartDate, {
        ...menu,
        orderDeadline: orderDeadlineIso
      })
      .subscribe({
        next: (data) => {
          this.isSavingMenu = false;
          this.menuForm.patchValue({
            ...data.menu,
            orderDeadline: data.orderDeadline ? isoToDatetimeLocal(data.orderDeadline) : ''
          });
          this.menuPublished = data.menuPublished ?? isMenuWeekPublished(data.menu);
          this.snackBar.open('תפריט שבועי נשמר בהצלחה', 'סגור', { duration: 4000 });
          if (this.reportsLoaded) this.loadReports();
        },
        error: (err) => {
          this.isSavingMenu = false;
          console.error('[AdminInstitutions] saveWeekMenu failed:', err);
          const msg = err?.error?.message || err?.message || 'שגיאה בשמירת תפריט';
          this.menuError = msg;
          this.snackBar.open(msg, 'סגור', { duration: 6000 });
        }
      });
  }

  clearWeekMenu(): void {
    const week = normalizeWeekInput(this.selectedWeekStart);
    if (!week) return;
    if (!confirm(`למחוק את התפריט לשבוע ${week}?`)) return;

    this.isClearingMenu = true;
    this.institutionService.deleteWeekMenu(week).subscribe({
      next: () => {
        this.isClearingMenu = false;
        this.menuForm.reset({
          orderDeadline: '',
          ...MENU_DAY_FORM_FIELDS.reduce(
            (acc, d) => {
              acc[d.key] = emptyMenuDayItems();
              return acc;
            },
            {} as Record<string, ReturnType<typeof emptyMenuDayItems>>
          )
        });
        this.menuPublished = false;
        this.snackBar.open('תפריט השבוע נמחק', 'סגור', { duration: 4000 });
        if (this.reportsLoaded) this.loadReports();
      },
      error: (err) => {
        this.isClearingMenu = false;
        console.error('[AdminInstitutions] deleteWeekMenu failed:', err);
        this.snackBar.open(err?.error?.message || 'שגיאה במחיקת תפריט', 'סגור', { duration: 5000 });
      }
    });
  }

  copyMenuFromPreviousWeek(): void {
    const week = normalizeWeekInput(this.selectedWeekStart);
    if (!week) return;
    const prevWeek = getPreviousWeekStartKey(week);

    this.isCopyingMenu = true;
    this.institutionService.getWeekMenu(prevWeek).subscribe({
      next: (data) => {
        this.isCopyingMenu = false;
        if (!isMenuWeekPublished(data.menu)) {
          this.snackBar.open('אין תפריט בשבוע הקודם להעתקה', 'סגור', { duration: 5000 });
          return;
        }
        this.menuForm.patchValue({
          ...data.menu,
          orderDeadline: data.orderDeadline ? isoToDatetimeLocal(data.orderDeadline) : ''
        });
        this.snackBar.open(`תפריט הועתק משבוע ${prevWeek} — לחץ שמור לשמירה`, 'סגור', { duration: 5000 });
      },
      error: (err) => {
        this.isCopyingMenu = false;
        this.snackBar.open(err?.error?.message || 'שגיאה בטעינת תפריט קודם', 'סגור', { duration: 5000 });
      }
    });
  }

  loadReports(): void {
    const week = normalizeWeekInput(this.selectedWeekStart);
    if (!week) return;
    this.isLoadingReports = true;
    this.reportsError = '';
    this.institutionService.getWeekReports(week).subscribe({
      next: (data) => {
        this.reports = data;
        this.reportsLoaded = true;
        this.isLoadingReports = false;
      },
      error: (err) => {
        this.isLoadingReports = false;
        this.reportsError = err?.error?.message || 'שגיאה בטעינת דוחות';
      }
    });
  }

  printReports(): void {
    const printContent = document.getElementById('print-section');
    if (!printContent) {
      console.error('Print section not found!');
      return;
    }

    const stylesHtml = Array.from(document.head.querySelectorAll('link[rel="stylesheet"], style'))
      .map((el) => el.outerHTML)
      .join('\n');

    const popupWin = window.open('', '_blank', 'top=0,left=0,height=100%,width=auto');
    if (!popupWin) {
      alert('אנא אפשר חלונות קופצים (Popups) כדי להדפיס.');
      return;
    }

    popupWin.document.open();
    popupWin.document.write(`
      <html dir="rtl" lang="he">
        <head>
          <meta charset="utf-8">
          <title>דוחות מטבח - מגדים</title>
          ${stylesHtml}
          <style>
            @page { size: A4 portrait; margin: 1.5cm; }
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif, Arial !important;
              direction: rtl;
              background-color: white !important;
              color: black !important;
              padding: 0;
              margin: 0;
            }

            /* Hide non-printable elements */
            button, .no-print, .mat-mdc-tab-header, .global-week-selector {
              display: none !important;
            }

            /* Typography & Spacing */
            h2, h3 { text-align: center; color: #000; margin-bottom: 5px; }
            .report-container { margin-bottom: 40px; }

            /* Force Material Tables to behave like standard HTML tables for printing */
            table, .mat-mdc-table {
              width: 100% !important;
              border-collapse: collapse !important;
              margin-top: 15px;
              font-size: 13px !important;
              display: table !important;
            }
            thead, .mat-mdc-header-row { display: table-header-group !important; }
            tr, .mat-mdc-row, .mat-mdc-header-row { display: table-row !important; page-break-inside: avoid; }
            th, td, .mat-mdc-cell, .mat-mdc-header-cell {
              display: table-cell !important;
              border: 1px solid #aaa !important;
              padding: 10px !important;
              text-align: right !important;
              vertical-align: top !important;
            }

            /* Header styling */
            th, .mat-mdc-header-cell {
              background-color: #f2f2f2 !important;
              font-weight: bold !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
              color-adjust: exact;
            }

            /* List of items inside the cell styling */
            .mat-mdc-cell div, .item-row {
              padding: 4px 0;
              border-bottom: 1px dashed #ddd;
              display: block !important;
            }
            .mat-mdc-cell div:last-child, .item-row:last-child {
              border-bottom: none;
            }

            /* Highlight notes in Packing breakdown */
            .institution-notes {
              background-color: #fff9c4 !important;
              border-right: 4px solid #fbc02d !important;
              padding: 6px !important;
              margin-top: 8px !important;
              font-weight: bold;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
              color-adjust: exact;
              display: block !important;
            }

            /* Avoid cutting cards in half */
            .day-packing-card {
              page-break-inside: avoid;
              border: 1px solid #ccc !important;
              margin-bottom: 15px !important;
              padding: 10px !important;
            }
          </style>
        </head>
        <body>${printContent.innerHTML}</body>
      </html>
    `);
    popupWin.document.close();

    setTimeout(() => {
      popupWin.focus();
      popupWin.print();
      popupWin.close();
    }, 500);
  }

  openCreateModal(): void {
    this.editingId = null;
    this.accountForm.reset({
      fullName: '',
      username: '',
      password: '',
      phone: '',
      customMessage: '',
      isActive: true
    });
    this.accountForm.get('password')?.setValidators([Validators.required, Validators.minLength(6)]);
    this.accountForm.get('password')?.updateValueAndValidity();
    this.showModal = true;
  }

  openEditModal(row: InstitutionUser): void {
    const id = institutionId(row);
    if (!id) return;
    this.editingId = id;
    const ps = row.portalSettings;
    this.accountForm.patchValue({
      fullName: row.fullName,
      username: row.username,
      password: '',
      phone: row.phone || '',
      customMessage: ps?.customMessage ?? '',
      isActive: row.isActive !== false
    });
    this.accountForm.get('password')?.setValidators([Validators.minLength(6)]);
    this.accountForm.get('password')?.updateValueAndValidity();
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.editingId = null;
  }

  submitAccountForm(): void {
    if (this.accountForm.invalid) {
      this.accountForm.markAllAsTouched();
      return;
    }

    const v = this.accountForm.value;
    const portalSettings = {
      customMessage: String(v.customMessage || '').trim()
    };

    this.isSavingAccount = true;

    if (this.editingId) {
      const payload: Record<string, unknown> = {
        fullName: String(v.fullName).trim(),
        username: String(v.username).trim(),
        phone: String(v.phone || '').trim(),
        isActive: !!v.isActive,
        portalSettings
      };
      if (String(v.password || '').trim()) {
        payload['password'] = String(v.password).trim();
      }
      this.institutionService.update(this.editingId, payload).subscribe({
        next: () => {
          this.isSavingAccount = false;
          this.snackBar.open('המוסד עודכן בהצלחה', 'סגור', { duration: 4000 });
          this.closeModal();
          this.loadInstitutions();
        },
        error: (err) => {
          this.isSavingAccount = false;
          this.snackBar.open(err?.error?.message || 'שגיאה בעדכון מוסד', 'סגור', { duration: 5000 });
        }
      });
      return;
    }

    this.institutionService
      .create({
        fullName: String(v.fullName).trim(),
        username: String(v.username).trim(),
        password: String(v.password).trim(),
        phone: String(v.phone || '').trim(),
        portalSettings
      })
      .subscribe({
        next: () => {
          this.isSavingAccount = false;
          this.snackBar.open('מוסד נוצר בהצלחה', 'סגור', { duration: 4000 });
          this.closeModal();
          this.loadInstitutions();
        },
        error: (err) => {
          this.isSavingAccount = false;
          this.snackBar.open(err?.error?.message || 'שגיאה ביצירת מוסד', 'סגור', { duration: 5000 });
        }
      });
  }

  toggleInstitutionActive(row: InstitutionUser): void {
    const id = institutionId(row);
    if (!id) return;
    const nextActive = row.isActive === false;
    const label = nextActive ? 'הפעלת' : 'השהיית';
    if (!confirm(`${label} את המוסד "${row.fullName}"?`)) return;

    this.institutionService.toggleActive(id, nextActive).subscribe({
      next: () => {
        this.snackBar.open(nextActive ? 'המוסד הופעל' : 'המוסד הושהה', 'סגור', { duration: 4000 });
        this.loadInstitutions();
      },
      error: (err) => {
        this.snackBar.open(err?.error?.message || 'שגיאה בעדכון סטטוס', 'סגור', { duration: 5000 });
      }
    });
  }

  deleteInstitution(row: InstitutionUser): void {
    const id = institutionId(row);
    if (!id) return;
    if (!confirm(`למחוק את המוסד "${row.fullName}"? (מחיקה רכה — היסטוריית הזמנות תישמר)`)) return;

    this.institutionService.delete(id).subscribe({
      next: () => {
        this.snackBar.open('מוסד הוסר מהמערכת', 'סגור', { duration: 4000 });
        this.loadInstitutions();
      },
      error: (err) => {
        this.snackBar.open(err?.error?.message || 'שגיאה במחיקה', 'סגור', { duration: 5000 });
      }
    });
  }

  get accountModalTitle(): string {
    return this.editingId ? 'עריכת מוסד' : 'מוסד חדש';
  }

  weekOrderLabel(row: InstitutionUser): string {
    const wo = row.weekOrder;
    if (!wo?.hasOrder || !wo.weeklyTotalPortions) {
      return 'טרם הוזמן';
    }
    return `הוזמנו ${wo.weeklyTotalPortions} מנות`;
  }

  packingDayRows(order: InstitutionWeekReports['orders'][number]) {
    return order.days || [];
  }

  openOrderEditModal(institutionIdValue: string, institutionName: string, weekStartDate: string): void {
    if (!institutionIdValue) return;
    const week = normalizeWeekInput(weekStartDate) || weekStartDate;
    this.orderEditInstitutionId = institutionIdValue;
    this.orderEditInstitutionName = institutionName;
    this.orderEditWeek = week;
    this.orderError = '';
    this.isLoadingOrder = true;
    this.showOrderModal = true;
    this.orderDaysArray.clear();

    this.institutionService.getInstitutionOrder(institutionIdValue, week).subscribe({
      next: (data) => {
        this.buildOrderDaysForm(data.days);
        this.isLoadingOrder = false;
      },
      error: (err) => {
        console.error('[AdminInstitutions] getInstitutionOrder failed:', err);
        this.buildOrderDaysForm(
          MENU_DAY_FORM_FIELDS.map((d) => ({
            dayOfWeek: d.dayOfWeek,
            dayLabel: d.label,
            regularCount: 0,
            vegetarianCount: 0,
            notes: '',
            menuItems: emptyMenuDayItems()
          }))
        );
        this.isLoadingOrder = false;
        this.orderError = err?.error?.message || 'לא נמצאה הזמנה — ניתן ליצור הזמנה חדשה';
      }
    });
  }

  openOrderEditFromAccount(row: InstitutionUser): void {
    this.openOrderEditModal(institutionId(row), row.fullName, this.selectedWeekStart);
  }

  openOrderEditFromPacking(order: InstitutionWeekReports['orders'][number]): void {
    this.openOrderEditModal(order.institutionId, order.institutionName, this.selectedWeekStart);
  }

  deleteOrderFromPacking(order: InstitutionWeekReports['orders'][number]): void {
    if (!order.hasOrder && !order.orderId) {
      this.snackBar.open('אין הזמנה למחיקה לשבוע זה', 'סגור', { duration: 4000 });
      return;
    }
    if (!confirm(`למחוק את הזמנת "${order.institutionName}" לשבוע ${this.selectedWeekStart}?`)) return;

    this.institutionService.deleteInstitutionOrder(order.institutionId, this.selectedWeekStart).subscribe({
      next: () => {
        this.snackBar.open('הזמנה נמחקה בהצלחה', 'סגור', { duration: 4000 });
        this.loadInstitutions();
        this.loadReports();
      },
      error: (err) => {
        console.error('[AdminInstitutions] deleteInstitutionOrder failed:', err);
        this.snackBar.open(err?.error?.message || 'שגיאה במחיקת הזמנה', 'סגור', { duration: 5000 });
      }
    });
  }

  private buildOrderDaysForm(days: PackingOrderDay[]): void {
    this.orderDaysArray.clear();
    const sorted = [...days].sort((a, b) => a.dayOfWeek - b.dayOfWeek);
    for (const day of sorted) {
      const label = MENU_DAY_FORM_FIELDS.find((d) => d.dayOfWeek === day.dayOfWeek)?.label || day.dayLabel;
      this.orderDaysArray.push(
        this.fb.group({
          dayOfWeek: [day.dayOfWeek],
          dayLabel: [label],
          regularCount: [day.regularCount ?? 0, [Validators.min(0)]],
          vegetarianCount: [day.vegetarianCount ?? 0, [Validators.min(0)]],
          notes: [day.notes ?? '']
        })
      );
    }
  }

  closeOrderModal(): void {
    this.showOrderModal = false;
    this.orderEditInstitutionId = '';
    this.orderError = '';
  }

  get orderEditWeeklyTotal(): number {
    const days: PackingOrderDay[] = this.orderDaysArray.controls.map((ctrl) => this.mapOrderDayCtrl(ctrl));
    return sumOrderDays(days);
  }

  private mapOrderDayCtrl(ctrl: { value: Record<string, unknown> }): PackingOrderDay {
    const v = ctrl.value;
    return {
      dayOfWeek: Number(v['dayOfWeek']),
      dayLabel: String(v['dayLabel'] || ''),
      regularCount: Number(v['regularCount']) || 0,
      vegetarianCount: Number(v['vegetarianCount']) || 0,
      notes: String(v['notes'] || '').trim(),
      menuItems: emptyMenuDayItems()
    };
  }

  saveOrderOverride(): void {
    if (this.orderForm.invalid || !this.orderEditInstitutionId) {
      this.orderForm.markAllAsTouched();
      return;
    }

    const days: PackingOrderDay[] = this.orderDaysArray.controls.map((ctrl) => {
      const base = this.mapOrderDayCtrl(ctrl);
      return {
        ...base,
        regularCount: Math.max(0, base.regularCount),
        vegetarianCount: Math.max(0, base.vegetarianCount)
      };
    });

    this.isSavingOrder = true;
    this.institutionService.updateInstitutionOrder(this.orderEditInstitutionId, this.orderEditWeek, days).subscribe({
      next: () => {
        this.isSavingOrder = false;
        this.snackBar.open('הזמנת המוסד עודכנה בהצלחה (עדכון מנהל)', 'סגור', { duration: 4000 });
        this.closeOrderModal();
        this.loadInstitutions();
        this.loadReports();
      },
      error: (err) => {
        this.isSavingOrder = false;
        console.error('[AdminInstitutions] updateInstitutionOrder failed:', err);
        this.snackBar.open(err?.error?.message || 'שגיאה בעדכון הזמנה', 'סגור', { duration: 6000 });
      }
    });
  }
}
