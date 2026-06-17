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
  formatOrderDeadlineNotice,
  emptyShabbatOrder
} from '../../../services/institution-portal.service';
import { getWeekRangeString, getCurrentWeekStart, getNextWeekStartKey } from '../../../utils/portal-week';
import type { ShabbatOrder } from '../../../utils/menu-structure';

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

  status: PortalStatus | null = null;
  isLoading = true;
  isSaving = false;
  errorMessage = '';
  form!: FormGroup;
  selectedWeekView: PortalWeekView = 'current';

  ngOnInit(): void {
    this.form = this.fb.group({
      days: this.fb.array([]),
      shabbatOrder: this.buildShabbatOrderGroup()
    });
    this.loadStatus();
  }

  get shabbatOrderGroup(): FormGroup {
    return this.form.get('shabbatOrder') as FormGroup;
  }

  get shabbatExtrasGroup(): FormGroup {
    return this.shabbatOrderGroup.get('extras') as FormGroup;
  }

  get hasShabbatMenu(): boolean {
    return this.status?.menu?.shabbatPackage?.hasShabbat !== false;
  }

  private buildShabbatOrderGroup(order = emptyShabbatOrder()) {
    return this.fb.group({
      regularCount: [order.regularCount ?? 0, this.countValidators],
      vegetarianCount: [order.vegetarianCount ?? 0, this.countValidators],
      wantsSeudaShlishit: [order.wantsSeudaShlishit === true],
      extras: this.fb.group({
        challahs: [order.extras?.challahs ?? 0, this.countValidators],
        rolls: [order.extras?.rolls ?? 0, this.countValidators],
        grapeJuice: [order.extras?.grapeJuice ?? 0, this.countValidators]
      })
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
    return !!this.status?.isLocked;
  }

  get noMenuPublished(): boolean {
    return !!this.status?.noMenuPublished;
  }

  get weekRangeLabel(): string {
    return getWeekRangeString(this.status?.weekStartDate || '', 'טופס הזמנת מנות לשבוע');
  }

  get deadlineNotice(): string {
    return formatOrderDeadlineNotice(this.status?.orderDeadline);
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
        } else {
          this.daysArray.clear();
          this.form.setControl('shabbatOrder', this.buildShabbatOrderGroup());
        }
        this.isLoading = false;
        if (data.isLocked || data.noMenuPublished) {
          this.form.disable();
        } else {
          this.form.enable();
        }
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err?.error?.message || 'שגיאה בטעינת הפורטל';
      }
    });
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
    return {
      regularCount: Math.max(0, Math.trunc(Number(v.regularCount) || 0)),
      vegetarianCount: Math.max(0, Math.trunc(Number(v.vegetarianCount) || 0)),
      wantsSeudaShlishit: v.wantsSeudaShlishit === true,
      extras: {
        challahs: Math.max(0, Math.trunc(Number(extras.challahs) || 0)),
        rolls: Math.max(0, Math.trunc(Number(extras.rolls) || 0)),
        grapeJuice: Math.max(0, Math.trunc(Number(extras.grapeJuice) || 0))
      }
    };
  }

  submitOrder(): void {
    if (this.noMenuPublished || this.isLocked || this.form.invalid) {
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

    this.isSaving = true;
    const weekStartDate = this.status?.weekStartDate;
    if (!weekStartDate) {
      this.isSaving = false;
      return;
    }

    this.portalService.submit(days, weekStartDate, shabbatOrder).subscribe({
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
