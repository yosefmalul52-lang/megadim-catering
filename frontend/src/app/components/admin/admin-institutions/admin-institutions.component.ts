import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormArray, FormBuilder, FormControl, FormGroup, ReactiveFormsModule, FormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule } from '@angular/material/table';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatCheckboxModule } from '@angular/material/checkbox';
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
  MENU_WEEKDAY_FORM_FIELDS,
  FRIDAY_NIGHT_MENU_FIELDS,
  SHABBAT_DAY_MENU_FIELDS,
  SEUDA_SHLISHIT_MENU_FIELDS,
  SHABBAT_SALAD_SLOTS,
  emptyMenuDayItems,
  emptyShabbatPackage,
  emptyShabbatOrder,
  mealPortionsForForm,
  sumMealPortions,
  totalShabbatPortionCount,
  resolveShabbatMealCounts,
  hasStoredMealPortions,
  formatLegacyShabbatOrderSummary,
  isLegacyShabbatOrderWithoutMealPortions,
  ORDER_NOTES_MAX_LENGTH,
  isMenuWeekPublished,
  type MenuCategoryKey,
  type InstitutionMenuContent,
  type ShabbatOrder,
  type ShabbatMealPortions,
  type MenuWeekdayField
} from '../../../utils/menu-structure';
import { shiftWeekStartKey, getWeekRangeString, getWeekRangeReportString, getWeekRangePackingReportString, formatWeekDateHe, getWeekEndKey, getWeekOffsetFromCurrent, getWeekOffsetLabel } from '../../../utils/portal-week';
import { datetimeLocalToIso, isoToDatetimeLocal } from '../../../utils/datetime-local.utils';
import { B2BDictionaryService } from '../../../services/b2b-dictionary.service';
import {
  B2B_DICTIONARY_CATEGORIES,
  dictionaryCategoryForMenuKey,
  dictionaryCategoryLabel,
  dictionaryLogisticsBadge,
  isGastronormCategory,
  isMeatKgCategory,
  isUnitCountCategory,
  B2B_REPORT_UNIT_OPTIONS,
  B2B_CALCULATION_METHOD_OPTIONS,
  B2B_ROUNDING_OPTIONS,
  type B2BMenuItem,
  type B2BDictionaryCategory,
  type B2BCalculationMethod,
  type B2BReportUnit,
  type B2BRoundingMode
} from '../../../utils/b2b-dictionary';
import {
  buildAggregatedShabbatKitchenLines,
  buildPackingShabbatLines,
  buildInstitutionProductionShabbatRows,
  aggregateShabbatExtras,
  aggregateShabbatKitchenTotals,
  formatShabbatExtrasSummary,
  type ShabbatExtrasTotals,
  type InstitutionKitchenPrintRow
} from '../../../utils/shabbat-logistics';

export interface PastWeekCopyOption {
  value: string;
  label: string;
}

const PAST_WEEKS_COPY_COUNT = 12;
import {
  buildCategoryLogisticsLine,
  formatLogisticsBrief,
  type CategoryLogisticsDisplayLine,
  type DishLogisticsLookup
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
    MatFormFieldModule,
    MatCheckboxModule
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
  /** Last committed week — revert date picker when navigation is cancelled */
  private committedWeekStart = getCurrentWeekStart();

  showOrderModal = false;
  orderEditInstitutionId = '';
  orderEditInstitutionName = '';
  orderEditWeek = '';
  orderEditGeneralNotes = '';
  orderEditShabbatSource: ShabbatOrder | null = null;
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
  pastWeeksToCopy: PastWeekCopyOption[] = [];
  selectedPastWeekToCopy = new FormControl<string | null>(null);

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
  readonly menuDayFields = MENU_WEEKDAY_FORM_FIELDS;
  readonly menuCategories = MENU_CATEGORIES;
  readonly fridayNightFields = FRIDAY_NIGHT_MENU_FIELDS;
  readonly shabbatDayFields = SHABBAT_DAY_MENU_FIELDS;
  readonly seudaShlishitFields = SEUDA_SHLISHIT_MENU_FIELDS;
  readonly shabbatSaladSlots = SHABBAT_SALAD_SLOTS;
  readonly dictionaryCategories = B2B_DICTIONARY_CATEGORIES;
  readonly reportUnitOptions = B2B_REPORT_UNIT_OPTIONS;
  readonly calculationMethodOptions = B2B_CALCULATION_METHOD_OPTIONS;
  readonly roundingOptions = B2B_ROUNDING_OPTIONS;
  readonly dictionaryLogisticsBadge = dictionaryLogisticsBadge;
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
    this.orderForm = this.fb.group({
      days: this.fb.array([]),
      shabbatOrder: this.buildShabbatOrderGroup(),
      adminNotes: ['', [Validators.maxLength(ORDER_NOTES_MAX_LENGTH)]]
    });
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
    this.refreshPastWeeksToCopyList();
    this.loadInstitutions();
    this.loadWeekMenu();
    this.loadReports();
  }

  /** Last N Sundays before the currently selected week — for copy-menu dropdown. */
  private refreshPastWeeksToCopyList(): void {
    const current = normalizeWeekInput(this.selectedWeekStart);
    if (!current) {
      this.pastWeeksToCopy = [];
      this.selectedPastWeekToCopy.setValue(null);
      return;
    }

    const options: PastWeekCopyOption[] = [];
    let key = getPreviousWeekStartKey(current);
    for (let i = 0; i < PAST_WEEKS_COPY_COUNT; i++) {
      const end = getWeekEndKey(key);
      options.push({
        value: key,
        label: `מ- ${formatWeekDateHe(key)} עד ${formatWeekDateHe(end)}`
      });
      key = getPreviousWeekStartKey(key);
    }

    this.pastWeeksToCopy = options;
    const selected = this.selectedPastWeekToCopy.value;
    if (selected && !options.some((o) => o.value === selected)) {
      this.selectedPastWeekToCopy.setValue(null);
    }
  }

  get orderShabbatGroup(): FormGroup {
    return this.orderForm.get('shabbatOrder') as FormGroup;
  }

  get orderShabbatMealPortionsGroup(): FormGroup {
    return this.orderShabbatGroup.get('mealPortions') as FormGroup;
  }

  get orderWantsSeudaShlishit(): boolean {
    return this.orderShabbatGroup.get('wantsSeudaShlishit')?.value === true;
  }

  get menuShabbatGroup(): FormGroup {
    return this.menuForm.get('shabbatPackage') as FormGroup;
  }

  get menuShabbatSaladsArray(): FormArray {
    return this.menuShabbatGroup.get('shabbatSalads') as FormArray;
  }

  private buildMealGroup(keys: readonly { key: string }[]) {
    const group: Record<string, ReturnType<FormBuilder['control']>> = {};
    for (const field of keys) {
      group[field.key] = this.fb.control('');
    }
    return this.fb.group(group);
  }

  private buildShabbatSaladsArray(values?: string[]) {
    const slots = Array.from({ length: SHABBAT_SALAD_SLOTS }, (_, i) => values?.[i] ?? '');
    return this.fb.array(slots.map((v) => this.fb.control(v)));
  }

  private buildShabbatPackageGroup(pkg = emptyShabbatPackage()) {
    return this.fb.group({
      hasShabbat: [pkg.hasShabbat !== false],
      fridayNight: this.buildMealGroup(FRIDAY_NIGHT_MENU_FIELDS),
      shabbatDay: this.buildMealGroup(SHABBAT_DAY_MENU_FIELDS),
      seudaShlishit: this.buildMealGroup(SEUDA_SHLISHIT_MENU_FIELDS),
      shabbatSalads: this.buildShabbatSaladsArray(pkg.shabbatSalads)
    });
  }

  private buildMealPortionGroup(counts = { regularCount: 0, vegetarianCount: 0 }) {
    return this.fb.group({
      regularCount: [counts.regularCount ?? 0, [Validators.min(0)]],
      vegetarianCount: [counts.vegetarianCount ?? 0, [Validators.min(0)]]
    });
  }

  private buildShabbatOrderGroup(order = emptyShabbatOrder()) {
    const portions = mealPortionsForForm(order);
    return this.fb.group({
      wantsSeudaShlishit: [order.wantsSeudaShlishit === true],
      mealPortions: this.fb.group({
        fridayNight: this.buildMealPortionGroup(portions.fridayNight),
        shabbatDay: this.buildMealPortionGroup(portions.shabbatDay),
        seudaShlishit: this.buildMealPortionGroup(portions.seudaShlishit ?? { regularCount: 0, vegetarianCount: 0 })
      }),
      extras: this.fb.group({
        challahs: [order.extras?.challahs ?? 0, [Validators.min(0)]],
        rolls: [order.extras?.rolls ?? 0, [Validators.min(0)]],
        grapeJuice: [order.extras?.grapeJuice ?? 0, [Validators.min(0)]]
      }),
      notes: [order.notes ?? '', [Validators.maxLength(ORDER_NOTES_MAX_LENGTH)]]
    });
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
    for (const day of MENU_WEEKDAY_FORM_FIELDS) {
      dayGroups[day.key] = this.buildMenuDayGroup();
    }
    this.menuForm = this.fb.group({
      weekdayOrderDeadline: ['', Validators.required],
      shabbatOrderDeadline: ['', Validators.required],
      ...dayGroups,
      shabbatPackage: this.buildShabbatPackageGroup()
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
      portionsPerGastronorm: [40, [Validators.min(1)]],
      calculationSettings: this.fb.group({
        enabled: [false],
        reportUnit: ['kg' as B2BReportUnit],
        calculationMethod: ['per_portion' as B2BCalculationMethod],
        quantityPerPortion: [null as number | null],
        quantityPerOrder: [null as number | null],
        quantityPerXPortions: [null as number | null],
        xPortions: [null as number | null],
        rounding: ['none' as B2BRoundingMode],
        minimumQuantity: [null as number | null]
      })
    });

    const calcGroup = this.dictionaryForm.get('calculationSettings') as FormGroup;
    calcGroup.get('enabled')?.valueChanges.subscribe(() => this.updateCalculationSettingsValidators());
    calcGroup.get('calculationMethod')?.valueChanges.subscribe(() => this.updateCalculationSettingsValidators());
  }

  get calculationSettingsGroup(): FormGroup {
    return this.dictionaryForm.get('calculationSettings') as FormGroup;
  }

  get calculationSettingsEnabled(): boolean {
    return this.calculationSettingsGroup.get('enabled')?.value === true;
  }

  get dictionaryCalculationMethod(): B2BCalculationMethod {
    return this.calculationSettingsGroup.get('calculationMethod')?.value || 'per_portion';
  }

  private defaultCalculationSettingsFormValue() {
    return {
      enabled: false,
      reportUnit: 'kg' as B2BReportUnit,
      calculationMethod: 'per_portion' as B2BCalculationMethod,
      quantityPerPortion: null,
      quantityPerOrder: null,
      quantityPerXPortions: null,
      xPortions: null,
      rounding: 'none' as B2BRoundingMode,
      minimumQuantity: null
    };
  }

  private updateCalculationSettingsValidators(): void {
    const group = this.calculationSettingsGroup;
    const enabled = group.get('enabled')?.value === true;
    const method = group.get('calculationMethod')?.value as B2BCalculationMethod;

    const perPortion = group.get('quantityPerPortion');
    const perOrder = group.get('quantityPerOrder');
    const perXQty = group.get('quantityPerXPortions');
    const xPortions = group.get('xPortions');
    const minimum = group.get('minimumQuantity');

    perPortion?.clearValidators();
    perOrder?.clearValidators();
    perXQty?.clearValidators();
    xPortions?.clearValidators();
    minimum?.clearValidators();

    if (enabled) {
      group.get('reportUnit')?.setValidators([Validators.required]);
      group.get('calculationMethod')?.setValidators([Validators.required]);
      if (method === 'per_portion') {
        perPortion?.setValidators([Validators.required, Validators.min(0.0001)]);
      } else if (method === 'fixed_per_order') {
        perOrder?.setValidators([Validators.required, Validators.min(0.0001)]);
      } else if (method === 'per_x_portions') {
        perXQty?.setValidators([Validators.required, Validators.min(0.0001)]);
        xPortions?.setValidators([Validators.required, Validators.min(0.0001)]);
      }
      minimum?.setValidators([Validators.min(0)]);
    } else {
      group.get('reportUnit')?.clearValidators();
      group.get('calculationMethod')?.clearValidators();
    }

    group.get('reportUnit')?.updateValueAndValidity({ emitEvent: false });
    group.get('calculationMethod')?.updateValueAndValidity({ emitEvent: false });
    perPortion?.updateValueAndValidity({ emitEvent: false });
    perOrder?.updateValueAndValidity({ emitEvent: false });
    perXQty?.updateValueAndValidity({ emitEvent: false });
    xPortions?.updateValueAndValidity({ emitEvent: false });
    minimum?.updateValueAndValidity({ emitEvent: false });
    this.dictionaryForm.updateValueAndValidity({ emitEvent: false });
  }

  private buildCalculationSettingsPayload(): B2BMenuItem['calculationSettings'] | undefined {
    const calc = this.calculationSettingsGroup.value;
    if (!calc.enabled) return undefined;
    const payload: NonNullable<B2BMenuItem['calculationSettings']> = {
      enabled: true,
      reportUnit: calc.reportUnit,
      calculationMethod: calc.calculationMethod,
      rounding: calc.rounding || 'none'
    };
    if (calc.minimumQuantity !== null && calc.minimumQuantity !== '' && calc.minimumQuantity !== undefined) {
      payload.minimumQuantity = Number(calc.minimumQuantity);
    }
    if (calc.calculationMethod === 'per_portion') {
      payload.quantityPerPortion = Number(calc.quantityPerPortion);
    } else if (calc.calculationMethod === 'fixed_per_order') {
      payload.quantityPerOrder = Number(calc.quantityPerOrder);
    } else if (calc.calculationMethod === 'per_x_portions') {
      payload.quantityPerXPortions = Number(calc.quantityPerXPortions);
      payload.xPortions = Number(calc.xPortions);
    }
    return payload;
  }

  private patchCalculationSettingsForm(item?: B2BMenuItem): void {
    const settings = item?.calculationSettings;
    this.calculationSettingsGroup.patchValue(
      settings?.enabled
        ? {
            enabled: true,
            reportUnit: settings.reportUnit,
            calculationMethod: settings.calculationMethod,
            quantityPerPortion: settings.quantityPerPortion ?? null,
            quantityPerOrder: settings.quantityPerOrder ?? null,
            quantityPerXPortions: settings.quantityPerXPortions ?? null,
            xPortions: settings.xPortions ?? null,
            rounding: settings.rounding || 'none',
            minimumQuantity: settings.minimumQuantity ?? null
          }
        : this.defaultCalculationSettingsFormValue()
    );
    this.updateCalculationSettingsValidators();
  }

  readonly isMeatKgCategory = isMeatKgCategory;
  readonly isUnitCountCategory = isUnitCountCategory;
  readonly isGastronormCategory = isGastronormCategory;

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
      portionsPerGastronorm: 40,
      calculationSettings: this.defaultCalculationSettingsFormValue()
    });
    this.updateCalculationSettingsValidators();
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
    this.patchCalculationSettingsForm(item);
  }

  cancelDictionaryEdit(): void {
    this.editingDictionaryId = null;
    this.dictionaryForm.reset({
      name: '',
      category: 'mainMeat',
      gramsPerPortion: 200,
      portionsPerGastronorm: 40,
      calculationSettings: this.defaultCalculationSettingsFormValue()
    });
    this.updateCalculationSettingsValidators();
  }

  submitDictionaryForm(): void {
    if (this.dictionaryForm.invalid) return;
    const v = this.dictionaryForm.value;
    const payload = {
      name: String(v.name).trim(),
      category: v.category as B2BDictionaryCategory,
      gramsPerPortion: isMeatKgCategory(v.category) ? Number(v.gramsPerPortion) || 200 : undefined,
      portionsPerGastronorm: isGastronormCategory(v.category)
        ? Number(v.portionsPerGastronorm) || 40
        : undefined,
      calculationSettings: this.buildCalculationSettingsPayload()
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
    return this.dictionarySelectOptions(dictionaryCategoryForMenuKey(menuCategoryKey), currentValue);
  }

  dictionarySelectOptions(
    dictCategory: B2BDictionaryCategory,
    currentValue?: string | null
  ): { value: string; label: string }[] {
    const items = this.dictionaryItems.filter((i) => i.category === dictCategory && i.isActive !== false);
    const options: { value: string; label: string }[] = [{ value: '', label: '— ללא —' }];
    for (const item of items) {
      const suffix = ` (${dictionaryLogisticsBadge(item)})`;
      options.push({ value: item.name, label: `${item.name}${suffix}` });
    }
    const current = String(currentValue ?? '').trim();
    if (current && !items.some((i) => i.name === current)) {
      options.push({ value: current, label: `${current} (לא במאגר)` });
    }
    return options;
  }

  shabbatFieldDictCategory(fieldKey: string): B2BDictionaryCategory {
    return dictionaryCategoryForMenuKey(fieldKey as MenuCategoryKey | 'fish' | 'carb' | 'protein');
  }

  lookupDictionaryItem(dishName: string, menuCategoryKey: MenuCategoryKey): B2BMenuItem | undefined {
    return this.lookupDictionaryByCategory(dishName, dictionaryCategoryForMenuKey(menuCategoryKey));
  }

  lookupDictionaryByCategory(dishName: string, dictCategory: B2BDictionaryCategory): B2BMenuItem | undefined {
    const trimmed = dishName.trim();
    if (!trimmed) return undefined;
    return this.dictionaryItems.find((i) => i.name === trimmed && i.category === dictCategory);
  }

  shabbatLogisticsLookup(dishName: string, fieldKey: string): DishLogisticsLookup {
    const dictCategory = this.shabbatFieldDictCategory(fieldKey);
    const item = this.lookupDictionaryByCategory(dishName, dictCategory);
    const lookup: DishLogisticsLookup = { dictCategory };
    if (item?.calculationSettings?.enabled) {
      lookup.calculationSettings = item.calculationSettings;
    }
    if (isMeatKgCategory(dictCategory)) {
      lookup.gramsPerPortion = item?.gramsPerPortion;
    } else if (!isUnitCountCategory(dictCategory)) {
      lookup.portionsPerGastronorm = item?.portionsPerGastronorm;
    }
    return lookup;
  }

  /** Report math: dictionary hit, else safe defaults (40 GN / 200g meat). */
  logisticsForDish(dishName: string, menuCategoryKey: MenuCategoryKey): DishLogisticsLookup {
    const item = this.lookupDictionaryItem(dishName, menuCategoryKey);
    const dictCategory = item?.category ?? dictionaryCategoryForMenuKey(menuCategoryKey);
    const lookup: DishLogisticsLookup = { dictCategory };
    if (item?.calculationSettings?.enabled) {
      lookup.calculationSettings = item.calculationSettings;
    }
    if (menuCategoryKey === 'mainMeat') {
      lookup.gramsPerPortion = item?.gramsPerPortion;
    } else if (menuCategoryKey !== 'vegetarianMain') {
      lookup.portionsPerGastronorm = item?.portionsPerGastronorm;
    }
    return lookup;
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
    const dayField = MENU_WEEKDAY_FORM_FIELDS.find((d) => d.dayOfWeek === row.dayOfWeek);
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

  get shabbatKitchenLines(): CategoryLogisticsDisplayLine[] {
    if (!this.reports?.menu?.shabbatPackage?.hasShabbat) return [];
    return buildAggregatedShabbatKitchenLines(this.reports.menu, this.reports.orders || [], (dish, fieldKey) =>
      this.shabbatLogisticsLookup(dish, fieldKey)
    );
  }

  get shabbatKitchenTotals() {
    return aggregateShabbatKitchenTotals(this.reports?.orders || []);
  }

  get shabbatExtrasTotals(): ShabbatExtrasTotals {
    return aggregateShabbatExtras(this.reports?.orders || []);
  }

  get shabbatExtrasSummary(): string {
    return formatShabbatExtrasSummary(this.shabbatExtrasTotals);
  }

  packingShabbatLineItems(order: InstitutionWeekReports['orders'][number]): CategoryLogisticsDisplayLine[] {
    const pkg = this.reports?.menu?.shabbatPackage;
    if (!pkg?.hasShabbat || !order.shabbatOrder) return [];
    return buildPackingShabbatLines(pkg, order.shabbatOrder, (dish, fieldKey) =>
      this.shabbatLogisticsLookup(dish, fieldKey)
    );
  }

  packingShabbatFilterPrefix(day: PackingOrderDay): string {
    switch (day.shabbatMeal) {
      case 'fridayNight':
        return 'ערב שבת';
      case 'shabbatDay':
        return 'שבת בבוקר';
      case 'seudaShlishit':
        return 'סעודה שלישית';
      default:
        return '';
    }
  }

  packingShabbatLineItemsForMeal(
    order: InstitutionWeekReports['orders'][number],
    day: PackingOrderDay
  ): CategoryLogisticsDisplayLine[] {
    const allLines = this.packingShabbatLineItems(order);
    if (day.shabbatMeal === 'legacy') return allLines;
    const prefix = this.packingShabbatFilterPrefix(day);
    if (!prefix) return allLines;
    return allLines.filter((line) => line.categoryLabel.startsWith(`${prefix} —`));
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

  private confirmLeaveWithUnsavedChanges(): boolean {
    if (!this.menuForm?.dirty) return true;
    return confirm('יש שינויים שלא נשמרו. לעבור שבוע בלי לשמור?');
  }

  private applyWeekNavigation(nextWeek: string): void {
    const normalized = normalizeWeekInput(nextWeek);
    if (!normalized) {
      this.snackBar.open('תאריך לא תקין — בחר יום ראשון', 'סגור', { duration: 4000 });
      this.selectedWeekStart = this.committedWeekStart;
      return;
    }
    if (!this.confirmLeaveWithUnsavedChanges()) {
      this.selectedWeekStart = this.committedWeekStart;
      return;
    }
    this.selectedWeekStart = normalized;
    this.committedWeekStart = normalized;
    this.refreshAllTabs();
  }

  onGlobalWeekDateChange(): void {
    this.applyWeekNavigation(this.selectedWeekStart);
  }

  goToPreviousWeek(): void {
    this.applyWeekNavigation(getPreviousWeekStartKey(this.committedWeekStart));
  }

  goToCurrentWeek(): void {
    this.applyWeekNavigation(getCurrentWeekStart());
  }

  goToNextWeek(): void {
    this.applyWeekNavigation(shiftWeekStartKey(this.committedWeekStart, 1));
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

  private patchMenuContentOnly(menu: InstitutionMenuContent): void {
    const pkg = menu.shabbatPackage || emptyShabbatPackage();
    const weekdayPatch = MENU_WEEKDAY_FORM_FIELDS.reduce(
      (acc, d) => {
        acc[d.key] = { ...emptyMenuDayItems(), ...(menu[d.key] || {}) };
        return acc;
      },
      {} as Record<MenuWeekdayField, ReturnType<typeof emptyMenuDayItems>>
    );

    this.menuForm.patchValue({
      ...weekdayPatch,
      shabbatPackage: {
        hasShabbat: pkg.hasShabbat !== false,
        fridayNight: { ...emptyShabbatPackage().fridayNight, ...pkg.fridayNight },
        shabbatDay: { ...emptyShabbatPackage().shabbatDay, ...pkg.shabbatDay },
        seudaShlishit: { ...emptyShabbatPackage().seudaShlishit, ...pkg.seudaShlishit }
      }
    });

    const saladsArray = this.menuShabbatSaladsArray;
    saladsArray.clear();
    const salads = pkg.shabbatSalads?.length ? pkg.shabbatSalads : emptyShabbatPackage().shabbatSalads;
    for (let i = 0; i < SHABBAT_SALAD_SLOTS; i++) {
      saladsArray.push(this.fb.control(salads[i] || ''));
    }
  }

  private patchMenuFormFromContent(
    menu: InstitutionMenuContent,
    deadlines?: {
      orderDeadline?: string | null;
      weekdayOrderDeadline?: string | null;
      shabbatOrderDeadline?: string | null;
    }
  ): void {
    const pkg = menu.shabbatPackage || emptyShabbatPackage();
    const legacy = deadlines?.orderDeadline ?? null;
    const weekday = deadlines?.weekdayOrderDeadline || legacy;
    const shabbat = deadlines?.shabbatOrderDeadline || legacy;
    this.menuForm.patchValue({
      ...menu,
      weekdayOrderDeadline: weekday ? isoToDatetimeLocal(weekday) : '',
      shabbatOrderDeadline: shabbat ? isoToDatetimeLocal(shabbat) : '',
      shabbatPackage: {
        hasShabbat: pkg.hasShabbat !== false,
        fridayNight: pkg.fridayNight,
        shabbatDay: pkg.shabbatDay,
        seudaShlishit: pkg.seudaShlishit
      }
    });
    const saladsArray = this.menuShabbatSaladsArray;
    saladsArray.clear();
    const salads = pkg.shabbatSalads?.length ? pkg.shabbatSalads : emptyShabbatPackage().shabbatSalads;
    for (let i = 0; i < SHABBAT_SALAD_SLOTS; i++) {
      saladsArray.push(this.fb.control(salads[i] || ''));
    }
  }

  private menuContentFromForm(): InstitutionMenuContent {
    const v = this.menuForm.value;
    const weekdays = MENU_WEEKDAY_FORM_FIELDS.reduce(
      (acc, d) => {
        acc[d.key] = { ...emptyMenuDayItems(), ...(v[d.key] || {}) };
        return acc;
      },
      {} as Record<MenuWeekdayField, ReturnType<typeof emptyMenuDayItems>>
    );
    const pkg = v.shabbatPackage || {};
    const salads = (this.menuShabbatSaladsArray.value as string[]).map((s) => String(s || '').trim());
    while (salads.length < SHABBAT_SALAD_SLOTS) salads.push('');
    return {
      ...weekdays,
      shabbatPackage: {
        hasShabbat: pkg.hasShabbat !== false,
        fridayNight: { ...emptyShabbatPackage().fridayNight, ...(pkg.fridayNight || {}) },
        shabbatDay: { ...emptyShabbatPackage().shabbatDay, ...(pkg.shabbatDay || {}) },
        seudaShlishit: { ...emptyShabbatPackage().seudaShlishit, ...(pkg.seudaShlishit || {}) },
        shabbatSalads: salads.slice(0, SHABBAT_SALAD_SLOTS)
      }
    };
  }

  loadWeekMenu(): void {
    this.isLoadingMenu = true;
    this.menuError = '';
    this.institutionService.getWeekMenu(this.selectedWeekStart).subscribe({
      next: (data) => {
        this.patchMenuFormFromContent(data.menu, {
          orderDeadline: data.orderDeadline,
          weekdayOrderDeadline: data.weekdayOrderDeadline,
          shabbatOrderDeadline: data.shabbatOrderDeadline
        });
        this.menuForm.markAsPristine();
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
      if (
        this.menuForm.get('weekdayOrderDeadline')?.invalid ||
        this.menuForm.get('shabbatOrderDeadline')?.invalid
      ) {
        this.snackBar.open('נדרשים שני זמני סגירת הזמנות (ימי חול ושבת) לפני שמירה', 'סגור', {
          duration: 5000
        });
      }
      return;
    }

    const weekStartDate = normalizeWeekInput(this.selectedWeekStart);
    if (!weekStartDate) {
      this.snackBar.open('תאריך שבוע לא תקין', 'סגור', { duration: 5000 });
      return;
    }
    const v = this.menuForm.value;
    const weekdayOrderDeadlineIso = datetimeLocalToIso(String(v.weekdayOrderDeadline));
    const shabbatOrderDeadlineIso = datetimeLocalToIso(String(v.shabbatOrderDeadline));
    const menu = this.menuContentFromForm();

    this.isSavingMenu = true;
    this.menuError = '';
    this.institutionService
      .saveWeekMenu(weekStartDate, {
        ...menu,
        weekdayOrderDeadline: weekdayOrderDeadlineIso,
        shabbatOrderDeadline: shabbatOrderDeadlineIso
      })
      .subscribe({
        next: (data) => {
          this.isSavingMenu = false;
          this.patchMenuFormFromContent(data.menu, {
            orderDeadline: data.orderDeadline,
            weekdayOrderDeadline: data.weekdayOrderDeadline,
            shabbatOrderDeadline: data.shabbatOrderDeadline
          });
          this.menuForm.markAsPristine();
          this.menuPublished = data.menuPublished ?? isMenuWeekPublished(data.menu);
          this.snackBar.open('הגדרות השבוע נשמרו בהצלחה', 'סגור', { duration: 4000 });
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
          weekdayOrderDeadline: '',
          shabbatOrderDeadline: '',
          ...MENU_WEEKDAY_FORM_FIELDS.reduce(
            (acc, d) => {
              acc[d.key] = emptyMenuDayItems();
              return acc;
            },
            {} as Record<string, ReturnType<typeof emptyMenuDayItems>>
          )
        });
        this.menuForm.setControl('shabbatPackage', this.buildShabbatPackageGroup());
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

  copyFromSelectedWeek(): void {
    const sourceWeek = this.selectedPastWeekToCopy.value;
    if (!sourceWeek) {
      this.snackBar.open('נא לבחור שבוע להעתקה', 'סגור', { duration: 4000 });
      return;
    }

    const currentWeek = normalizeWeekInput(this.selectedWeekStart);
    if (!currentWeek) {
      this.snackBar.open('תאריך שבוע לא תקין', 'סגור', { duration: 4000 });
      return;
    }

    if (sourceWeek === currentWeek) {
      this.snackBar.open('לא ניתן להעתיק מאותו שבוע', 'סגור', { duration: 4000 });
      return;
    }

    this.isCopyingMenu = true;
    this.institutionService.getWeekMenu(sourceWeek).subscribe({
      next: (data) => {
        this.isCopyingMenu = false;
        if (!data?.menu || !isMenuWeekPublished(data.menu)) {
          this.snackBar.open('לא נמצא תפריט לשבוע שנבחר', 'סגור', { duration: 5000 });
          return;
        }
        this.patchMenuContentOnly(data.menu);
        this.menuForm.patchValue({ weekdayOrderDeadline: '', shabbatOrderDeadline: '' });
        this.menuForm.get('weekdayOrderDeadline')?.markAsUntouched();
        this.menuForm.get('shabbatOrderDeadline')?.markAsUntouched();
        this.snackBar.open('התפריט הועתק בהצלחה — הגדר דדליין ולחץ שמור', 'סגור', { duration: 5000 });
      },
      error: () => {
        this.isCopyingMenu = false;
        this.snackBar.open('לא נמצא תפריט לשבוע שנבחר', 'סגור', { duration: 5000 });
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

  printProductionReport(): void {
    if (!this.reports) return;
    this.openPrintWindow(this.buildProductionReportHtml(), 'דוח ייצור מוסדות — מגדים');
  }

  printPackingReport(): void {
    if (!this.reports) return;
    this.openPrintWindow(this.buildPackingReportHtml(), 'דוח אריזה מוסדות — מגדים');
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

    const legacyStyles = `
      @page { size: A4 portrait; margin: 1.5cm; }
      button, .no-print, .mat-mdc-tab-header, .global-week-selector { display: none !important; }
      h2, h3 { text-align: center; color: #000; margin-bottom: 5px; }
      .report-container { margin-bottom: 40px; }
      table, .mat-mdc-table {
        width: 100% !important; border-collapse: collapse !important; margin-top: 15px;
        font-size: 13px !important; display: table !important;
      }
      thead, .mat-mdc-header-row { display: table-header-group !important; }
      tr, .mat-mdc-row, .mat-mdc-header-row { display: table-row !important; page-break-inside: avoid; }
      th, td, .mat-mdc-cell, .mat-mdc-header-cell {
        display: table-cell !important; border: 1px solid #aaa !important; padding: 10px !important;
        text-align: right !important; vertical-align: top !important;
      }
      th, .mat-mdc-header-cell { background-color: #f2f2f2 !important; font-weight: bold !important; }
      .day-packing-card { page-break-inside: avoid; border: 1px solid #ccc !important; margin-bottom: 15px !important; padding: 10px !important; }
    `;

    this.openPrintWindow(printContent.innerHTML, 'דוחות מטבח - מגדים', `${stylesHtml}<style>${legacyStyles}</style>`);
  }

  private openPrintWindow(bodyHtml: string, title: string, extraHead = ''): void {
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
          <title>${this.escapePrintHtml(title)}</title>
          ${extraHead}
          <style>${this.institutionPrintBaseStyles()}</style>
        </head>
        <body>${bodyHtml}</body>
      </html>
    `);
    popupWin.document.close();

    setTimeout(() => {
      popupWin.focus();
      popupWin.print();
      popupWin.close();
    }, 500);
  }

  private institutionPrintBaseStyles(): string {
    return `
      @page { size: A4 portrait; margin: 12mm; }
      body {
        font-family: Heebo, 'Segoe UI', Tahoma, Arial, sans-serif !important;
        direction: rtl; background: #fff !important; color: #111 !important;
        padding: 0; margin: 0; text-align: right;
      }
      h1 { margin: 0 0 8px; font-size: 1.35rem; font-weight: 800; text-align: center; color: #000; }
      h2 { margin: 16px 0 8px; font-size: 1rem; font-weight: 800; color: #000; border-bottom: 1px solid #111; padding-bottom: 4px; }
      h3 { margin: 0 0 8px; font-size: 0.95rem; font-weight: 700; color: #000; }
      .meta { margin: 0 0 14px; font-size: 0.9rem; line-height: 1.7; text-align: center; }
      .meta-line { margin: 2px 0; }
      .section-note { margin: 8px 0 12px; padding: 8px 10px; border: 1px solid #111; font-size: 0.85rem; }
      table { width: 100%; border-collapse: collapse; margin: 8px 0 16px; font-size: 12px; }
      th, td { border: 1px solid #111; padding: 5px 7px; text-align: right; vertical-align: top; color: #000; }
      th { background: #f4f4f4; font-weight: 700; }
      .done-col { width: 32px; text-align: center; }
      .num-col { width: 44px; text-align: center; white-space: nowrap; }
      .summary-block { margin-top: 16px; padding: 10px 12px; border: 1px solid #111; page-break-inside: avoid; }
      .summary-title { font-weight: 800; margin-bottom: 6px; }
      .institution-block { page-break-inside: avoid; margin-bottom: 20px; border: 1px solid #ccc; padding: 10px; }
      .institution-block + .institution-block { page-break-before: always; }
      .institution-meta { margin: 4px 0 10px; font-size: 0.85rem; line-height: 1.6; }
      .menu-cell { white-space: pre-line; font-size: 11px; }
      button, .no-print { display: none !important; }
    `;
  }

  private escapePrintHtml(value: unknown): string {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private printTimestamp(): string {
    return new Date().toLocaleString('he-IL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  private printWeekRangeLine(): string {
    const week = normalizeWeekInput(this.reports?.weekStartDate || this.selectedWeekStart);
    if (!week) return '';
    return `שבוע: ${formatWeekDateHe(week)} עד ${formatWeekDateHe(getWeekEndKey(week))}`;
  }

  private categoryDinerCounts(
    menuCategoryKey: MenuCategoryKey,
    totalRegular: number,
    totalVegetarian: number
  ): { regular: number; vegetarian: number; total: number } {
    if (menuCategoryKey === 'mainMeat') {
      return { regular: totalRegular, vegetarian: 0, total: totalRegular };
    }
    if (menuCategoryKey === 'vegetarianMain') {
      return { regular: 0, vegetarian: totalVegetarian, total: totalVegetarian };
    }
    return {
      regular: totalRegular,
      vegetarian: totalVegetarian,
      total: totalRegular + totalVegetarian
    };
  }

  private buildProductionWeekdayRows(): InstitutionKitchenPrintRow[] {
    if (!this.reports) return [];
    const rows: InstitutionKitchenPrintRow[] = [];
    for (const kRow of this.reports.kitchenReport) {
      const dayField = MENU_WEEKDAY_FORM_FIELDS.find((d) => d.dayOfWeek === kRow.dayOfWeek);
      if (!dayField) continue;
      const dayMenu = this.reports.menu[dayField.key];
      for (const c of MENU_CATEGORIES) {
        const dish = (dayMenu[c.key] || '').trim();
        if (!dish) continue;
        const counts = this.categoryDinerCounts(c.key, kRow.totalRegular, kRow.totalVegetarian);
        if (!this.shouldIncludeReportLine(c.key, counts.total)) continue;
        const line = buildCategoryLogisticsLine(
          c.label,
          dish,
          counts.total,
          c.key,
          this.logisticsForDish(dish, c.key)
        );
        if (!line) continue;
        rows.push({
          sectionLabel: kRow.dayLabel,
          categoryLabel: c.label,
          dish,
          regular: counts.regular,
          vegetarian: counts.vegetarian,
          total: counts.total,
          logisticsText: line.logisticsMetric || `${counts.total} מנות`
        });
      }
    }
    return rows;
  }

  private buildProductionShabbatRows(): InstitutionKitchenPrintRow[] {
    if (!this.reports) return [];
    return buildInstitutionProductionShabbatRows(this.reports.menu, this.reports.orders || [], (dish, fieldKey) =>
      this.shabbatLogisticsLookup(dish, fieldKey)
    );
  }

  private collectProductionNotes(): string[] {
    const notes: string[] = [];
    for (const order of this.reports?.orders || []) {
      const generalNotes = (order.generalNotes || '').trim();
      if (generalNotes) {
        notes.push(`${order.institutionName} — הערה כללית מהמוסד: ${generalNotes}`);
      }
      const shabbatNotes = (order.shabbatOrder?.notes || '').trim();
      if (shabbatNotes) {
        notes.push(`${order.institutionName} — הערות שבת: ${shabbatNotes}`);
      }
      const adminNotes = (order.adminNotes || '').trim();
      if (adminNotes) {
        notes.push(`${order.institutionName} — הערת מנהל: ${adminNotes}`);
      }
      for (const day of order.days || []) {
        const dayNotes = (day.notes || '').trim();
        if (dayNotes) {
          notes.push(`${order.institutionName} — ${day.dayLabel}: ${dayNotes}`);
        }
      }
    }
    return notes;
  }

  private buildProductionReportHtml(): string {
    const weekdayRows = this.buildProductionWeekdayRows();
    const shabbatRows = this.buildProductionShabbatRows();
    const notes = this.collectProductionNotes();
    const extrasSummary = this.shabbatExtrasSummary;

    let totalRegular = 0;
    let totalVegetarian = 0;
    let totalPortions = 0;
    const daySummary = new Map<string, { regular: number; vegetarian: number; total: number }>();

    for (const row of weekdayRows) {
      totalRegular += row.regular;
      totalVegetarian += row.vegetarian;
      totalPortions += row.total;
      const prev = daySummary.get(row.sectionLabel) || { regular: 0, vegetarian: 0, total: 0 };
      prev.regular += row.regular;
      prev.vegetarian += row.vegetarian;
      prev.total += row.total;
      daySummary.set(row.sectionLabel, prev);
    }

    const weekdayTableRows = weekdayRows
      .map(
        (row) => `<tr>
          <td class="done-col">☐</td>
          <td>${this.escapePrintHtml(row.sectionLabel)}</td>
          <td>${this.escapePrintHtml(row.categoryLabel)}</td>
          <td>${this.escapePrintHtml(row.dish)}</td>
          <td class="num-col">${row.regular}</td>
          <td class="num-col">${row.vegetarian}</td>
          <td class="num-col">${row.total}</td>
          <td>${this.escapePrintHtml(row.logisticsText)}</td>
        </tr>`
      )
      .join('');

    const shabbatTableRows = shabbatRows
      .map(
        (row) => `<tr>
          <td class="done-col">☐</td>
          <td>${this.escapePrintHtml(row.sectionLabel)}</td>
          <td>${this.escapePrintHtml(row.categoryLabel)}</td>
          <td>${this.escapePrintHtml(row.dish)}</td>
          <td class="num-col">${row.regular}</td>
          <td class="num-col">${row.vegetarian}</td>
          <td class="num-col">${row.total}</td>
          <td>${this.escapePrintHtml(row.logisticsText)}</td>
        </tr>`
      )
      .join('');

    for (const row of shabbatRows) {
      totalRegular += row.regular;
      totalVegetarian += row.vegetarian;
      totalPortions += row.total;
      const prev = daySummary.get(row.sectionLabel) || { regular: 0, vegetarian: 0, total: 0 };
      prev.regular += row.regular;
      prev.vegetarian += row.vegetarian;
      prev.total += row.total;
      daySummary.set(row.sectionLabel, prev);
    }

    const daySummaryRows = Array.from(daySummary.entries())
      .map(
        ([label, s]) => `<tr>
          <td>${this.escapePrintHtml(label)}</td>
          <td class="num-col">${s.regular}</td>
          <td class="num-col">${s.vegetarian}</td>
          <td class="num-col">${s.total}</td>
        </tr>`
      )
      .join('');

    const notesHtml =
      notes.length > 0
        ? `<div class="section-note"><strong>הערות לייצור:</strong><br>${notes.map((n) => this.escapePrintHtml(n)).join('<br>')}</div>`
        : '';

    const shabbatSection =
      shabbatRows.length > 0
        ? `<h2>שבת</h2>
          <table>
            <thead>
              <tr>
                <th class="done-col">בוצע</th>
                <th>סעודה</th>
                <th>קטגוריה</th>
                <th>שם מנה / פריט</th>
                <th class="num-col">כמות רגילה</th>
                <th class="num-col">כמות צמחונית</th>
                <th class="num-col">סה"כ</th>
                <th>לוגיסטיקה / הערות הכנה</th>
              </tr>
            </thead>
            <tbody>${shabbatTableRows || '<tr><td colspan="8">—</td></tr>'}</tbody>
          </table>
          ${extrasSummary ? `<div class="section-note"><strong>תוספות שבת (סיכום):</strong> ${this.escapePrintHtml(extrasSummary)}</div>` : ''}`
        : '';

    return `
      <h1>דוח ייצור מוסדות — מגדים</h1>
      <div class="meta">
        <div class="meta-line">${this.escapePrintHtml(this.printWeekRangeLine())}</div>
        <div class="meta-line"><strong>הודפס:</strong> ${this.printTimestamp()}</div>
        ${!this.reports?.menuPublished ? '<div class="meta-line">שים לב: תפריט לשבוע זה טרם פורסם</div>' : ''}
      </div>
      ${notesHtml}
      <h2>ימי חול</h2>
      <table>
        <thead>
          <tr>
            <th class="done-col">בוצע</th>
            <th>יום</th>
            <th>קטגוריה</th>
            <th>שם מנה / פריט</th>
            <th class="num-col">כמות רגילה</th>
            <th class="num-col">כמות צמחונית</th>
            <th class="num-col">סה"כ</th>
            <th>לוגיסטיקה / הערות הכנה</th>
          </tr>
        </thead>
        <tbody>${weekdayTableRows || '<tr><td colspan="8">—</td></tr>'}</tbody>
      </table>
      ${shabbatSection}
      <div class="summary-block">
        <div class="summary-title">סיכום כללי</div>
        <div>סה"כ רגיל: <strong>${totalRegular}</strong></div>
        <div>סה"כ צמחוני: <strong>${totalVegetarian}</strong></div>
        <div>סה"כ מנות: <strong>${totalPortions}</strong></div>
      </div>
      ${
        daySummaryRows
          ? `<div class="summary-block">
              <div class="summary-title">סיכום לפי יום / סעודה</div>
              <table>
                <thead><tr><th>יום / סעודה</th><th class="num-col">רגיל</th><th class="num-col">צמחוני</th><th class="num-col">סה"כ</th></tr></thead>
                <tbody>${daySummaryRows}</tbody>
              </table>
            </div>`
          : ''
      }`;
  }

  private institutionContactInfo(institutionIdValue: string): { phone: string; contact: string } {
    const inst = this.institutions.find((i) => institutionId(i) === institutionIdValue);
    return {
      phone: (inst?.phone || '').trim(),
      contact: (inst?.username || '').trim()
    };
  }

  private formatShabbatExtrasForOrder(order: InstitutionWeekReports['orders'][number]): string {
    const extras = order.shabbatOrder?.extras;
    if (!extras) return '';
    const parts: string[] = [];
    if (extras.challahs) parts.push(`חלות: ${extras.challahs}`);
    if (extras.rolls) parts.push(`לחמניות: ${extras.rolls}`);
    if (extras.grapeJuice) parts.push(`מיץ ענבים: ${extras.grapeJuice}`);
    return parts.join(' · ');
  }

  private buildPackingShabbatPrintRows(
    order: InstitutionWeekReports['orders'][number]
  ): Array<{
    dayMeal: string;
    regular: number;
    vegetarian: number;
    total: number;
    menuText: string;
    extras: string;
    institutionNotes: string;
  }> {
    const pkg = this.reports?.menu?.shabbatPackage;
    const s = order.shabbatOrder;
    if (!pkg?.hasShabbat || !s) return [];

    const rows: Array<{
      dayMeal: string;
      regular: number;
      vegetarian: number;
      total: number;
      menuText: string;
      extras: string;
      institutionNotes: string;
    }> = [];

    if (!hasStoredMealPortions(s)) {
      const regular = Number(s.regularCount) || 0;
      const vegetarian = Number(s.vegetarianCount) || 0;
      const allLines = this.packingShabbatLineItems(order);
      if (regular + vegetarian > 0 || allLines.length > 0) {
        rows.push({
          dayMeal: 'שבת — הזמנה ישנה ללא פיצול סעודות',
          regular,
          vegetarian,
          total: regular + vegetarian,
          menuText: allLines.map((l) => l.displayText).join('\n') || '—',
          extras: this.formatShabbatExtrasForOrder(order),
          institutionNotes: (s.notes || '').trim()
        });
      }
      return rows;
    }

    const allLines = this.packingShabbatLineItems(order);
    const sections: Array<{ displayLabel: string; filterPrefix: string; meal: 'fridayNight' | 'shabbatDay' | 'seudaShlishit' }> = [
      { displayLabel: 'סעודה ראשונה — ערב שבת', filterPrefix: 'ערב שבת', meal: 'fridayNight' },
      { displayLabel: 'סעודה שנייה — שבת בבוקר', filterPrefix: 'שבת בבוקר', meal: 'shabbatDay' }
    ];
    if (s.wantsSeudaShlishit) {
      sections.push({ displayLabel: 'סעודה שלישית', filterPrefix: 'סעודה שלישית', meal: 'seudaShlishit' });
    }

    for (const section of sections) {
      const counts = resolveShabbatMealCounts(s, section.meal);
      const sectionLines = allLines.filter((line) => line.categoryLabel.startsWith(`${section.filterPrefix} —`));
      if (sectionLines.length === 0 && counts.regularCount + counts.vegetarianCount <= 0) continue;
      rows.push({
        dayMeal: section.displayLabel,
        regular: counts.regularCount,
        vegetarian: counts.vegetarianCount,
        total: counts.regularCount + counts.vegetarianCount,
        menuText: sectionLines.map((l) => l.displayText).join('\n') || '—',
        extras: '',
        institutionNotes: section.meal === 'fridayNight' ? (s.notes || '').trim() : ''
      });
    }

    const saladLines = allLines.filter((line) => line.categoryLabel.startsWith('סלטי שבת —'));
    if (saladLines.length > 0) {
      const fn = resolveShabbatMealCounts(s, 'fridayNight');
      const sd = resolveShabbatMealCounts(s, 'shabbatDay');
      rows.push({
        dayMeal: 'סלטי שבת',
        regular: fn.regularCount + sd.regularCount,
        vegetarian: fn.vegetarianCount + sd.vegetarianCount,
        total: fn.regularCount + fn.vegetarianCount + sd.regularCount + sd.vegetarianCount,
        menuText: saladLines.map((l) => l.displayText).join('\n'),
        extras: '',
        institutionNotes: ''
      });
    }

    const extrasText = this.formatShabbatExtrasForOrder(order);
    if (extrasText) {
      rows.push({
        dayMeal: 'תוספות שבת',
        regular: 0,
        vegetarian: 0,
        total: 0,
        menuText: '—',
        extras: extrasText,
        institutionNotes: (s.notes || '').trim()
      });
    }

    return rows;
  }

  private buildPackingReportHtml(): string {
    const orders = this.reports?.orders || [];

    const institutionsHtml = orders
      .map((order) => {
        const contact = this.institutionContactInfo(order.institutionId);
        const adminNotes = (order.adminNotes || '').trim();
        const generalNotes = (order.generalNotes || '').trim();

        const weekdayRows = (order.days || [])
          .filter((day) => day.regularCount || day.vegetarianCount)
          .map((day, index) => {
            const lines = this.packingCategoryLineItems(day);
            const institutionNotes = [
              index === 0 && generalNotes ? `הערה כללית: ${generalNotes}` : '',
              this.packingDayNotes(day)
            ]
              .filter(Boolean)
              .join(' · ');
            return {
              dayMeal: day.dayLabel,
              regular: day.regularCount,
              vegetarian: day.vegetarianCount,
              total: (Number(day.regularCount) || 0) + (Number(day.vegetarianCount) || 0),
              menuText: lines.map((l) => l.displayText).join('\n') || '—',
              extras: '',
              institutionNotes,
              adminNotes: ''
            };
          });

        const shabbatRows = this.buildPackingShabbatPrintRows(order).map((row, index) => {
          const institutionNotes = [
            weekdayRows.length === 0 && index === 0 && generalNotes ? `הערה כללית: ${generalNotes}` : '',
            row.institutionNotes
          ]
            .filter(Boolean)
            .join(' · ');
          return { ...row, institutionNotes };
        });

        const allRows = [...weekdayRows, ...shabbatRows];
        if (allRows.length === 0) return '';

        const tableRows = allRows
          .map((row, index) => {
            const showAdmin = index === 0 && adminNotes;
            return `<tr>
              <td class="done-col">☐</td>
              <td>${this.escapePrintHtml(row.dayMeal)}</td>
              <td class="num-col">${row.regular}</td>
              <td class="num-col">${row.vegetarian}</td>
              <td class="num-col">${row.total}</td>
              <td class="menu-cell">${this.escapePrintHtml(row.menuText)}</td>
              <td>${this.escapePrintHtml(row.extras)}</td>
              <td>${this.escapePrintHtml(row.institutionNotes)}</td>
              <td>${showAdmin ? this.escapePrintHtml(adminNotes) : ''}</td>
            </tr>`;
          })
          .join('');

        const metaParts: string[] = [];
        if (contact.contact) metaParts.push(`<div>איש קשר: ${this.escapePrintHtml(contact.contact)}</div>`);
        if (contact.phone) metaParts.push(`<div>טלפון: ${this.escapePrintHtml(contact.phone)}</div>`);

        return `<div class="institution-block">
          <h3>${this.escapePrintHtml(order.institutionName)}</h3>
          <div class="institution-meta">${metaParts.join('') || ''}</div>
          <table>
            <thead>
              <tr>
                <th class="done-col">בוצע</th>
                <th>יום / סעודה</th>
                <th class="num-col">כמות רגילה</th>
                <th class="num-col">כמות צמחונית</th>
                <th class="num-col">סה"כ</th>
                <th>תפריט / פריטים לאריזה</th>
                <th>תוספות</th>
                <th>הערות מוסד</th>
                <th>הערות מנהל</th>
              </tr>
            </thead>
            <tbody>${tableRows}</tbody>
          </table>
        </div>`;
      })
      .filter(Boolean)
      .join('');

    return `
      <h1>דוח אריזה מוסדות — מגדים</h1>
      <div class="meta">
        <div class="meta-line">${this.escapePrintHtml(this.printWeekRangeLine())}</div>
        <div class="meta-line"><strong>הודפס:</strong> ${this.printTimestamp()}</div>
      </div>
      ${institutionsHtml || '<p>אין הזמנות לשבוע זה</p>'}`;
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

  packingDayRows(order: InstitutionWeekReports['orders'][number]): PackingOrderDay[] {
    const rows = [...(order.days || [])];
    const pkg = this.reports?.menu?.shabbatPackage;
    const s = order.shabbatOrder;
    if (!pkg?.hasShabbat || !s) return rows;

    const generalNotes = (order.generalNotes || '').trim();
    const adminNotes = (order.adminNotes || '').trim();
    const shabbatNotes = (s.notes || '').trim();

    const buildNotes = (includeGeneral: boolean, includeShabbat: boolean, includeAdmin: boolean): string => {
      const parts: string[] = [];
      if (includeGeneral && generalNotes) parts.push(`הערה כללית: ${generalNotes}`);
      if (includeShabbat && shabbatNotes) parts.push(`הערות מוסד: ${shabbatNotes}`);
      if (includeAdmin && adminNotes) parts.push(`הערת מנהל: ${adminNotes}`);
      return parts.join(' · ');
    };

    if (!hasStoredMealPortions(s)) {
      rows.push({
        dayOfWeek: -1,
        dayLabel: 'שבת — הזמנה ישנה ללא פיצול סעודות',
        regularCount: s.regularCount || 0,
        vegetarianCount: s.vegetarianCount || 0,
        notes: buildNotes(true, true, true),
        menuItems: emptyMenuDayItems(),
        isShabbat: true,
        shabbatMeal: 'legacy'
      });
      return rows;
    }

    const sections: Array<{
      dayOfWeek: number;
      displayLabel: string;
      meal: 'fridayNight' | 'shabbatDay' | 'seudaShlishit';
    }> = [
      { dayOfWeek: -11, displayLabel: 'סעודה ראשונה — ערב שבת', meal: 'fridayNight' },
      { dayOfWeek: -12, displayLabel: 'סעודה שנייה — שבת בבוקר', meal: 'shabbatDay' }
    ];
    if (s.wantsSeudaShlishit) {
      sections.push({ dayOfWeek: -13, displayLabel: 'סעודה שלישית', meal: 'seudaShlishit' });
    }

    let firstShabbatRow = true;
    for (const section of sections) {
      const counts = resolveShabbatMealCounts(s, section.meal);
      if (counts.regularCount + counts.vegetarianCount <= 0) continue;
      rows.push({
        dayOfWeek: section.dayOfWeek,
        dayLabel: section.displayLabel,
        regularCount: counts.regularCount,
        vegetarianCount: counts.vegetarianCount,
        notes: buildNotes(firstShabbatRow, section.meal === 'fridayNight', firstShabbatRow),
        menuItems: emptyMenuDayItems(),
        isShabbat: true,
        shabbatMeal: section.meal
      });
      firstShabbatRow = false;
    }

    const allLines = this.packingShabbatLineItems(order);
    const saladLines = allLines.filter((line) => line.categoryLabel.startsWith('סלטי שבת —'));
    if (saladLines.length > 0) {
      const fn = resolveShabbatMealCounts(s, 'fridayNight');
      const sd = resolveShabbatMealCounts(s, 'shabbatDay');
      rows.push({
        dayOfWeek: -14,
        dayLabel: 'סלטי שבת',
        regularCount: fn.regularCount + sd.regularCount,
        vegetarianCount: fn.vegetarianCount + sd.vegetarianCount,
        notes: '',
        menuItems: emptyMenuDayItems(),
        isShabbat: true
      });
    }

    const extrasText = this.formatShabbatExtrasForOrder(order);
    if (extrasText) {
      rows.push({
        dayOfWeek: -15,
        dayLabel: 'תוספות שבת',
        regularCount: 0,
        vegetarianCount: 0,
        notes: extrasText,
        menuItems: emptyMenuDayItems(),
        isShabbat: true
      });
    }

    return rows;
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
        this.orderEditShabbatSource = data.shabbatOrder || null;
        this.orderForm.setControl('shabbatOrder', this.buildShabbatOrderGroup(data.shabbatOrder || emptyShabbatOrder()));
        this.orderForm.patchValue({ adminNotes: data.adminNotes || '' });
        this.orderEditGeneralNotes = (data.generalNotes || '').trim();
        this.isLoadingOrder = false;
      },
      error: (err) => {
        console.error('[AdminInstitutions] getInstitutionOrder failed:', err);
        this.orderEditGeneralNotes = '';
        this.orderEditShabbatSource = null;
        this.buildOrderDaysForm(
          MENU_WEEKDAY_FORM_FIELDS.map((d) => ({
            dayOfWeek: d.dayOfWeek,
            dayLabel: d.label,
            regularCount: 0,
            vegetarianCount: 0,
            notes: '',
            menuItems: emptyMenuDayItems()
          }))
        );
        this.orderForm.setControl('shabbatOrder', this.buildShabbatOrderGroup());
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
      const label = MENU_WEEKDAY_FORM_FIELDS.find((d) => d.dayOfWeek === day.dayOfWeek)?.label || day.dayLabel;
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
    this.orderEditGeneralNotes = '';
    this.orderEditShabbatSource = null;
    this.orderError = '';
  }

  get orderEditShabbatLegacySummary(): string {
    if (!this.orderEditShabbatSource) return '';
    return formatLegacyShabbatOrderSummary(this.orderEditShabbatSource);
  }

  get orderEditWeeklyTotal(): number {
    const days: PackingOrderDay[] = this.orderDaysArray.controls.map((ctrl) => this.mapOrderDayCtrl(ctrl));
    return sumOrderDays(days, this.mapShabbatOrderFromForm());
  }

  private mapShabbatOrderFromForm(): ShabbatOrder {
    const v = this.orderShabbatGroup.getRawValue();
    const extras = v.extras || {};
    const mpRaw = v.mealPortions || {};
    const wantsSeudaShlishit = v.wantsSeudaShlishit === true;

    const mealPortions: ShabbatMealPortions = {
      fridayNight: {
        regularCount: Math.max(0, Math.trunc(Number(mpRaw.fridayNight?.regularCount) || 0)),
        vegetarianCount: Math.max(0, Math.trunc(Number(mpRaw.fridayNight?.vegetarianCount) || 0))
      },
      shabbatDay: {
        regularCount: Math.max(0, Math.trunc(Number(mpRaw.shabbatDay?.regularCount) || 0)),
        vegetarianCount: Math.max(0, Math.trunc(Number(mpRaw.shabbatDay?.vegetarianCount) || 0))
      }
    };

    if (wantsSeudaShlishit) {
      mealPortions.seudaShlishit = {
        regularCount: Math.max(0, Math.trunc(Number(mpRaw.seudaShlishit?.regularCount) || 0)),
        vegetarianCount: Math.max(0, Math.trunc(Number(mpRaw.seudaShlishit?.vegetarianCount) || 0))
      };
    }

    const legacy = sumMealPortions(mealPortions, wantsSeudaShlishit);
    const hasEnteredMealSplit =
      legacy.regularCount + legacy.vegetarianCount > 0;

    if (!hasEnteredMealSplit && this.orderEditShabbatSource && isLegacyShabbatOrderWithoutMealPortions(this.orderEditShabbatSource)) {
      return {
        regularCount: this.orderEditShabbatSource.regularCount ?? 0,
        vegetarianCount: this.orderEditShabbatSource.vegetarianCount ?? 0,
        wantsSeudaShlishit,
        notes: String(v.notes || '').trim().slice(0, ORDER_NOTES_MAX_LENGTH),
        extras: {
          challahs: Math.max(0, Math.trunc(Number(extras.challahs) || 0)),
          rolls: Math.max(0, Math.trunc(Number(extras.rolls) || 0)),
          grapeJuice: Math.max(0, Math.trunc(Number(extras.grapeJuice) || 0))
        }
      };
    }

    return {
      regularCount: legacy.regularCount,
      vegetarianCount: legacy.vegetarianCount,
      wantsSeudaShlishit,
      mealPortions,
      notes: String(v.notes || '').trim().slice(0, ORDER_NOTES_MAX_LENGTH),
      extras: {
        challahs: Math.max(0, Math.trunc(Number(extras.challahs) || 0)),
        rolls: Math.max(0, Math.trunc(Number(extras.rolls) || 0)),
        grapeJuice: Math.max(0, Math.trunc(Number(extras.grapeJuice) || 0))
      }
    };
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

    const shabbatOrder = this.mapShabbatOrderFromForm();
    const adminNotes = String(this.orderForm.get('adminNotes')?.value || '').trim().slice(0, ORDER_NOTES_MAX_LENGTH);

    const weekdayTotal = days.reduce((sum, d) => sum + d.regularCount + d.vegetarianCount, 0);
    const shabbatTotal = totalShabbatPortionCount(shabbatOrder);
    if (weekdayTotal + shabbatTotal <= 0) {
      this.snackBar.open('יש להזין לפחות מנה אחת בהזמנה', 'סגור', { duration: 5000 });
      this.orderForm.markAllAsTouched();
      return;
    }

    this.isSavingOrder = true;
    this.institutionService
      .updateInstitutionOrder(this.orderEditInstitutionId, this.orderEditWeek, days, shabbatOrder, adminNotes)
      .subscribe({
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
