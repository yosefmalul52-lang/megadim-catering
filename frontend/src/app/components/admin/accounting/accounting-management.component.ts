import {
  Component, OnInit, inject, HostListener, ElementRef, ViewChild
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatIconModule } from '@angular/material/icon';

import {
  AccountingService,
  AccountingSummary,
  TransactionItem,
  TransactionsMeta
} from '../../../services/accounting.service';

@Component({
  selector: 'app-accounting-management',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatSelectModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatIconModule
  ],
  providers: [DatePipe],
  templateUrl: './accounting-management.component.html',
  styleUrls:   ['./accounting-management.component.scss']
})
export class AccountingManagementComponent implements OnInit {
  private accountingService = inject(AccountingService);
  private snackBar          = inject(MatSnackBar);
  private fb                = inject(FormBuilder);
  private datePipe          = inject(DatePipe);

  // ── Summary ────────────────────────────────────────────────────────────────
  summary: AccountingSummary | null = null;
  summaryLoading = false;
  summaryError   = '';

  // ── Transactions ──────────────────────────────────────────────────────────
  transactions: TransactionItem[] = [];
  meta: TransactionsMeta = { total: 0, page: 1, limit: 25, totalPages: 0 };
  txLoading  = false;
  txError    = '';
  filterSource: '' | 'online' | 'external' = '';
  filterFrom = '';
  filterTo   = '';

  // ── Drag & Drop / Upload modal ────────────────────────────────────────────
  isDragOver       = false;
  showModal        = false;
  pendingFile:     File | null = null;
  uploadProgress   = false;
  invoiceForm!:    FormGroup;

  @ViewChild('dropZone') dropZoneRef!: ElementRef<HTMLElement>;

  ngOnInit(): void {
    this.invoiceForm = this.fb.group({
      clientName:    ['', [Validators.required]],
      amount:        ['', [Validators.required, Validators.min(0.01)]],
      issueDate:     [this.todayString(), [Validators.required]],
      invoiceNumber: [''],
      description:   ['']
    });

    this.loadSummary();
    this.loadTransactions();
  }

  // ── Data loading ──────────────────────────────────────────────────────────

  loadSummary(): void {
    this.summaryLoading = true;
    this.summaryError   = '';
    this.accountingService.getSummary().subscribe({
      next:  res => { this.summary = res.data; this.summaryLoading = false; },
      error: ()  => { this.summaryError = 'שגיאה בטעינת סיכום הכנסות'; this.summaryLoading = false; }
    });
  }

  loadTransactions(page = 1): void {
    this.txLoading = true;
    this.txError   = '';
    this.accountingService.getTransactions({
      page,
      limit:    this.meta.limit,
      source:   this.filterSource,
      dateFrom: this.filterFrom,
      dateTo:   this.filterTo
    }).subscribe({
      next: res => {
        this.transactions = res.data;
        this.meta         = res.meta;
        this.txLoading    = false;
      },
      error: () => {
        this.txError   = 'שגיאה בטעינת רשימת עסקאות';
        this.txLoading = false;
      }
    });
  }

  applyFilters(): void {
    this.loadTransactions(1);
  }

  resetFilters(): void {
    this.filterSource = '';
    this.filterFrom   = '';
    this.filterTo     = '';
    this.loadTransactions(1);
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.meta.totalPages) {
      this.loadTransactions(page);
    }
  }

  // ── Drag & Drop ───────────────────────────────────────────────────────────

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;
    const file = event.dataTransfer?.files?.[0];
    if (file) this.openModal(file);
  }

  onFileInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file  = input.files?.[0];
    if (file) this.openModal(file);
    input.value = '';
  }

  openModal(file: File): void {
    this.pendingFile = file;
    this.showModal   = true;
    this.invoiceForm.reset({
      clientName:    '',
      amount:        '',
      issueDate:     this.todayString(),
      invoiceNumber: '',
      description:   ''
    });
  }

  closeModal(): void {
    this.showModal   = false;
    this.pendingFile = null;
    this.uploadProgress = false;
  }

  submitInvoice(): void {
    if (this.invoiceForm.invalid) {
      this.invoiceForm.markAllAsTouched();
      return;
    }
    if (!this.pendingFile) return;

    this.uploadProgress = true;
    const v = this.invoiceForm.value;

    this.accountingService.uploadDocument(this.pendingFile).subscribe({
      next: uploadRes => {
        this.accountingService.createExternal({
          clientName:    v.clientName.trim(),
          amount:        Number(v.amount),
          issueDate:     v.issueDate,
          invoiceNumber: v.invoiceNumber?.trim() || undefined,
          description:   v.description?.trim()   || undefined,
          fileUrl:       uploadRes.fileUrl,
          fileKey:       uploadRes.fileKey
        }).subscribe({
          next: () => {
            this.snackBar.open('חשבונית נשמרה בהצלחה', 'סגור', {
              duration: 3000, horizontalPosition: 'start', verticalPosition: 'top'
            });
            this.closeModal();
            this.loadSummary();
            this.loadTransactions(1);
          },
          error: () => {
            this.uploadProgress = false;
            this.snackBar.open('שגיאה בשמירת החשבונית', 'סגור', { duration: 4000 });
          }
        });
      },
      error: () => {
        this.uploadProgress = false;
        this.snackBar.open('שגיאה בהעלאת הקובץ', 'סגור', { duration: 4000 });
      }
    });
  }

  submitExternalNoFile(): void {
    if (this.invoiceForm.invalid) {
      this.invoiceForm.markAllAsTouched();
      return;
    }
    this.uploadProgress = true;
    const v = this.invoiceForm.value;

    this.accountingService.createExternal({
      clientName:    v.clientName.trim(),
      amount:        Number(v.amount),
      issueDate:     v.issueDate,
      invoiceNumber: v.invoiceNumber?.trim() || undefined,
      description:   v.description?.trim()   || undefined
    }).subscribe({
      next: () => {
        this.snackBar.open('רשומה נשמרה בהצלחה', 'סגור', {
          duration: 3000, horizontalPosition: 'start', verticalPosition: 'top'
        });
        this.closeModal();
        this.loadSummary();
        this.loadTransactions(1);
      },
      error: () => {
        this.uploadProgress = false;
        this.snackBar.open('שגיאה בשמירת הרשומה', 'סגור', { duration: 4000 });
      }
    });
  }

  // ── Utilities ─────────────────────────────────────────────────────────────

  formatAmount(n: number): string {
    return `₪${n.toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  formatDate(d: string): string {
    return this.datePipe.transform(d, 'dd/MM/yyyy') ?? d;
  }

  get pages(): number[] {
    const total = this.meta.totalPages;
    if (total <= 1) return [];
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  private todayString(): string {
    return new Date().toISOString().split('T')[0];
  }

  trackById(_: number, item: TransactionItem): string {
    return item.id;
  }
}
