import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import {
  InstitutionPortalService,
  InstitutionOrderDay,
  PortalStatus,
  PORTAL_DAY_LABELS,
  formatPortalDeadlineNotices
} from '../../../services/institution-portal.service';
import { getWeekRangeString, getCurrentWeekStart, getNextWeekStartKey } from '../../../utils/portal-week';
import type { ShabbatOrder, ShabbatMealPortions } from '../../../utils/menu-structure';
import {
  emptyShabbatOrder,
  mealPortionsForForm,
  sumMealPortions,
  totalShabbatPortionCount,
  ORDER_NOTES_MAX_LENGTH
} from '../../../utils/menu-structure';

function nonNegativeIntegerValidator(control: AbstractControl): ValidationErrors | null {
  const raw = control.value;
  if (raw === null || raw === undefined || raw === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
    return { nonNegativeInteger: true };
  }
  return null;
}

export type PortalWeekView = 'current' | 'next';

@Component({
  selector: 'app-institution-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatCheckboxModule,
    MatIconModule,
    MatSnackBarModule
  ],
  templateUrl: './institution-dashboard.component.html',
  styleUrls: ['./institution-dashboard.component.scss']
})
export class InstitutionDashboardComponent implements OnInit {
  private portalService = inject(InstitutionPortalService);
  private fb = inject(FormBuilder);
  private snackBar = inject(MatSnackBar);

  readonly dayLabels = PORTAL_DAY_LABELS;
  readonly countValidators = [Validators.min(0), nonNegativeIntegerValidator];
  readonly notesValidators = [Validators.maxLength(ORDER_NOTES_MAX_LENGTH)];

  status: PortalStatus | null = null;
  isLoading = true;
  isSaving = false;
  errorMessage = '';
  form!: FormGroup;
  selectedWeekView: PortalWeekView = 'current';

  ngOnInit(): void {
    this.form = this.fb.group({
      days: this.fb.array([]),
      shabbatOrder: this.buildShabbatOrderGroup(),
      generalNotes: ['', this.notesValidators]
    });
    this.loadStatus();
  }

  get shabbatOrderGroup(): FormGroup {
    return this.form.get('shabbatOrder') as FormGroup;
  }

  get shabbatExtrasGroup(): FormGroup {
    return this.shabbatOrderGroup.get('extras') as FormGroup;
  }

  get shabbatMealPortionsGroup(): FormGroup {
    return this.shabbatOrderGroup.get('mealPortions') as FormGroup;
  }

  get wantsSeudaShlishit(): boolean {
    return this.shabbatOrderGroup.get('wantsSeudaShlishit')?.value === true;
  }

  get hasShabbatMenu(): boolean {
    return this.status?.menu?.shabbatPackage?.hasShabbat !== false;
  }

  private buildMealPortionGroup(counts = { regularCount: 0, vegetarianCount: 0 }) {
    return this.fb.group({
      regularCount: [counts.regularCount ?? 0, this.countValidators],
      vegetarianCount: [counts.vegetarianCount ?? 0, this.countValidators]
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
        challahs: [order.extras?.challahs ?? 0, this.countValidators],
        rolls: [order.extras?.rolls ?? 0, this.countValidators],
        grapeJuice: [order.extras?.grapeJuice ?? 0, this.countValidators]
      }),
      notes: [order.notes ?? '', this.notesValidators]
    });
  }

  weekStartDateForView(view: PortalWeekView): string {
    return view === 'current' ? getCurrentWeekStart() : getNextWeekStartKey();
  }

  onWeekViewChange(view: PortalWeekView | null): void {
    if (!view || this.selectedWeekView === view) return;
    this.selectedWeekView = view;
    this.loadStatus(this.weekStartDateForView(view));
  }

  private syncWeekViewFromStatus(weekStartDate: string): void {
    const nextWeek = getNextWeekStartKey();
    this.selectedWeekView = weekStartDate === nextWeek ? 'next' : 'current';
  }

  get daysArray() {
    return this.form.get('days') as import('@angular/forms').FormArray;
  }

  get isLocked(): boolean {
    return this.isFullyLocked;
  }

  get isFullyLocked(): boolean {
    if (this.status?.isLocked !== undefined) {
      return !!this.status.isLocked;
    }
    return this.isWeekdayLocked && this.isShabbatLocked;
  }

  get isWeekdayLocked(): boolean {
    if (this.status?.isWeekdayLocked !== undefined) {
      return !!this.status.isWeekdayLocked;
    }
    return !!this.status?.isLocked;
  }

  get isShabbatLocked(): boolean {
    if (this.status?.isShabbatLocked !== undefined) {
      return !!this.status.isShabbatLocked;
    }
    return !!this.status?.isLocked;
  }

  get deadlineNotices(): { weekday: string; shabbat: string; usesLegacyFallback: boolean } {
    if (!this.status) {
      return { weekday: '', shabbat: '', usesLegacyFallback: false };
    }
    return formatPortalDeadlineNotices(this.status);
  }

  get noMenuPublished(): boolean {
    return !!this.status?.noMenuPublished;
  }

  get weekRangeLabel(): string {
    return getWeekRangeString(this.status?.weekStartDate || '', 'טופס הזמנת מנות לשבוע');
  }

  get customMessage(): string {
    return this.status?.portalSettings?.customMessage?.trim() || '';
  }

  loadStatus(weekStartDate?: string): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.portalService.getStatus(weekStartDate).subscribe({
      next: (data) => {
        this.status = data;
        if (!weekStartDate) {
          this.syncWeekViewFromStatus(data.weekStartDate);
        }
        if (!data.noMenuPublished) {
          this.buildDaysForm(data.order.days);
          this.form.setControl('shabbatOrder', this.buildShabbatOrderGroup(data.order.shabbatOrder || emptyShabbatOrder()));
          this.form.patchValue({ generalNotes: data.order.generalNotes || '' });
        } else {
          this.daysArray.clear();
          this.form.setControl('shabbatOrder', this.buildShabbatOrderGroup());
        }
        this.isLoading = false;
        this.applyFormLockState();
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err?.error?.message || 'שגיאה בטעינת הפורטל';
      }
    });
  }

  private applyFormLockState(): void {
    if (!this.status || this.status.noMenuPublished) {
      this.form.disable();
      return;
    }

    this.form.enable();
    if (this.isWeekdayLocked) {
      this.daysArray.disable();
    }
    if (this.isShabbatLocked) {
      this.shabbatOrderGroup.disable();
    }
  }

  private buildDaysForm(days: InstitutionOrderDay[]): void {
    this.daysArray.clear();
    const sorted = [...days].sort((a, b) => a.dayOfWeek - b.dayOfWeek);
    for (const day of sorted) {
      this.daysArray.push(
        this.fb.group({
          dayOfWeek: [day.dayOfWeek],
          regularCount: [day.regularCount ?? 0, this.countValidators],
          vegetarianCount: [day.vegetarianCount ?? 0, this.countValidators],
          notes: [day.notes ?? '']
        })
      );
    }
  }

  private mapShabbatOrderFromForm(): ShabbatOrder {
    const v = this.shabbatOrderGroup.getRawValue();
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

  private weekdayPortionsTotal(days: InstitutionOrderDay[]): number {
    return days.reduce((sum, d) => sum + d.regularCount + d.vegetarianCount, 0);
  }

  submitOrder(): void {
    if (this.noMenuPublished || this.isFullyLocked || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const days: InstitutionOrderDay[] = this.daysArray.controls.map((ctrl) => {
      const v = ctrl.value;
      return {
        dayOfWeek: Number(v.dayOfWeek),
        regularCount: Math.max(0, Math.trunc(Number(v.regularCount) || 0)),
        vegetarianCount: Math.max(0, Math.trunc(Number(v.vegetarianCount) || 0)),
        notes: String(v.notes || '').trim()
      };
    });

    const shabbatOrder = this.hasShabbatMenu ? this.mapShabbatOrderFromForm() : emptyShabbatOrder();

    const weekdayTotal = this.weekdayPortionsTotal(days);
    const shabbatTotal = this.hasShabbatMenu ? totalShabbatPortionCount(shabbatOrder) : 0;
    if (weekdayTotal + shabbatTotal <= 0) {
      this.snackBar.open('יש להזין לפחות מנה אחת בהזמנה', 'סגור', { duration: 5000 });
      this.form.markAllAsTouched();
      return;
    }

    this.isSaving = true;
    const weekStartDate = this.status?.weekStartDate;
    if (!weekStartDate) {
      this.isSaving = false;
      return;
    }

    this.portalService
      .submit(days, weekStartDate, shabbatOrder, String(this.form.get('generalNotes')?.value || '').trim())
      .subscribe({
      next: () => {
        this.isSaving = false;
        this.snackBar.open('ההזמנה נשמרה בהצלחה', 'סגור', { duration: 4000 });
        this.loadStatus(weekStartDate);
      },
      error: (err) => {
        this.isSaving = false;
        const msg = err?.error?.message || 'שגיאה בשמירת ההזמנה';
        this.snackBar.open(msg, 'סגור', { duration: 5000 });
        if (err?.status === 403) {
          this.loadStatus(weekStartDate);
        }
      }
    });
  }
}
