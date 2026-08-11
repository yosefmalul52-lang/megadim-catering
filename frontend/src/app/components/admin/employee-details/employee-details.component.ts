import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { environment } from '../../../../environments/environment';

interface Shift {
  _id: string;
  date: string;
  clockIn: string;
  clockOut: string | null;
  duration: number;
  hourlyRate: number;
  dailyWage: number;
  employee: {
    _id: string;
    firstName: string;
    lastName: string;
    fullName: string;
  };
}

interface PayrollReport {
  month: string;
  shifts: Shift[];
  totalHours: number;
  totalCost: number;
  shiftCount: number;
}

interface Employee {
  _id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  role: string;
  phone: string;
  hourlyRate: number;
}

@Component({
  selector: 'app-employee-details',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="employee-details-page">
      <div class="container">
        <!-- Header -->
        <div class="page-header">
          <button class="btn-back" (click)="goBack()">
            <i class="fas fa-arrow-right"></i>
            חזרה
          </button>
          <h1 class="page-title">
            <i class="fas fa-user"></i>
            {{ employee?.fullName || 'טוען...' }}
          </h1>
        </div>

        <!-- Controls -->
        <div class="controls-card">
          <div class="date-picker-group">
            <label for="monthPicker">בחר חודש:</label>
            <input 
              type="month" 
              id="monthPicker"
              [value]="selectedMonth"
              (input)="onMonthChange($event)"
              class="month-picker"
            />
          </div>
          <button class="btn-export" (click)="exportToExcel()" [disabled]="!report || report.shifts.length === 0">
            <i class="fas fa-file-excel"></i>
            הורד לאקסל
          </button>
        </div>

        <!-- Loading State -->
        <div *ngIf="isLoading" class="loading">
          <i class="fas fa-spinner fa-spin"></i>
          <span>טוען דוח שכר...</span>
        </div>

        <!-- Error State -->
        <div *ngIf="errorMessage" class="error-message">
          <i class="fas fa-exclamation-circle"></i>
          {{ errorMessage }}
        </div>

        <!-- Report Content -->
        <div *ngIf="!isLoading && !errorMessage && report" class="report-content">
          <!-- Timesheet Table -->
          <div class="timesheet-card">
            <h2 class="card-title">דוח שעות עבודה</h2>
            
            <div *ngIf="report.shifts.length === 0" class="empty-state">
              <i class="fas fa-calendar-times"></i>
              <p>אין משמרות לחודש זה</p>
            </div>

            <table *ngIf="report.shifts.length > 0" class="timesheet-table">
              <thead>
                <tr>
                  <th>תאריך</th>
                  <th>שעת כניסה</th>
                  <th>שעת יציאה</th>
                  <th>סה"כ שעות</th>
                  <th>שכר יומי (₪)</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let shift of report.shifts" [class.missing-clockout]="!shift.clockOut">
                  <td>{{ formatDate(shift.date) }}</td>
                  <td>{{ formatTime(shift.clockIn) }}</td>
                  <td [class.missing]="!shift.clockOut">
                    {{ shift.clockOut ? formatTime(shift.clockOut) : 'לא נרשמה יציאה' }}
                  </td>
                  <td>{{ shift.duration.toFixed(2) }}</td>
                  <td class="wage-cell">{{ shift.dailyWage.toFixed(2) }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Summary Footer -->
          <div class="summary-card">
            <div class="summary-row">
              <div class="summary-item">
                <span class="summary-label">מספר משמרות:</span>
                <span class="summary-value">{{ report.shiftCount }}</span>
              </div>
              <div class="summary-item">
                <span class="summary-label">סה"כ שעות:</span>
                <span class="summary-value hours">{{ report.totalHours.toFixed(2) }}</span>
              </div>
              <div class="summary-item highlight">
                <span class="summary-label">שכר לתשלום:</span>
                <span class="summary-value cost">{{ formatCurrency(report.totalCost) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .employee-details-page {
      padding: 2rem;
      min-height: 100vh;
      background: #F5F7FA;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
    }

    /* Header */
    .page-header {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 2rem;
    }

    .btn-back {
      padding: 0.75rem 1.5rem;
      background: white;
      border: 1px solid #E2E8F0;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 600;
      color: #55615a;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .btn-back:hover {
      background: #f1f5f9;
      border-color: #E2E8F0;
    }

    .page-title {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      font-size: 1.75rem;
      font-weight: 700;
      color: #1c2520;
      margin: 0;
    }

    .page-title i {
      color: #65B69D;
    }

    /* Controls */
    .controls-card {
      background: white;
      border-radius: 12px;
      padding: 1.5rem;
      margin-bottom: 2rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
    }

    .date-picker-group {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .date-picker-group label {
      font-weight: 600;
      color: #55615a;
    }

    .month-picker {
      padding: 0.75rem 1rem;
      border: 1px solid #E2E8F0;
      border-radius: 8px;
      font-size: 1rem;
      font-weight: 600;
      color: #1c2520;
      background: white;
      cursor: pointer;
    }

    .month-picker:focus {
      outline: none;
      border-color: #65B69D;
      box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
    }

    .btn-export {
      padding: 0.75rem 1.5rem;
      background: #65B69D;
      color: white;
      border: none;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .btn-export:hover:not(:disabled) {
      background: #1F2D3D;
      transform: translateY(-2px);
      box-shadow: 0 4px 8px rgba(16, 185, 129, 0.3);
    }

    .btn-export:disabled {
      /* disabled visual without fading text */ color: #687789; border-color: #E2E8F0; background: #F8FAFC;
      cursor: not-allowed;
    }

    /* Loading & Error */
    .loading {
      text-align: center;
      padding: 4rem 2rem;
      color: #6d776f;
    }

    .loading i {
      font-size: 2.5rem;
      margin-bottom: 1rem;
      color: #65B69D;
    }

    .error-message {
      background: #fee2e2;
      color: #991b1b;
      padding: 1rem 1.5rem;
      border-radius: 8px;
      margin-bottom: 2rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    /* Timesheet Card */
    .timesheet-card {
      background: white;
      border-radius: 12px;
      padding: 2rem;
      margin-bottom: 2rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }

    .card-title {
      font-size: 1.5rem;
      font-weight: 700;
      color: #1c2520;
      margin-bottom: 1.5rem;
    }

    .empty-state {
      text-align: center;
      padding: 3rem 2rem;
      color: #6d776f;
    }

    .empty-state i {
      font-size: 3rem;
      margin-bottom: 1rem;
      color: #E2E8F0;
    }

    /* Timesheet Table */
    .timesheet-table {
      width: 100%;
      border-collapse: collapse;
    }

    .timesheet-table thead {
      background: #F5F7FA;
    }

    .timesheet-table th {
      padding: 1rem;
      text-align: right;
      font-weight: 600;
      color: #55615a;
      border-bottom: 2px solid #E2E8F0;
      font-size: 0.9rem;
    }

    .timesheet-table td {
      padding: 1rem;
      text-align: right;
      color: #1c2520;
      border-bottom: 1px solid #E2E8F0;
    }

    .timesheet-table tbody tr:hover {
      background: #F5F7FA;
    }

    .timesheet-table tbody tr.missing-clockout {
      background: #FDEBEC;
    }

    .timesheet-table .missing {
      color: #ef4444;
      font-weight: 600;
    }

    .timesheet-table .wage-cell {
      font-weight: 600;
      color: #1F2D3D;
    }

    /* Summary Card */
    .summary-card {
      background: white;
      border-radius: 12px;
      padding: 2rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      border-top: 3px solid #65B69D;
    }

    .summary-row {
      display: flex;
      justify-content: space-around;
      align-items: center;
      gap: 2rem;
    }

    .summary-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
    }

    .summary-item.highlight {
      background: rgba(16, 185, 129, 0.1);
      padding: 1rem 2rem;
      border-radius: 8px;
    }

    .summary-label {
      font-size: 0.9rem;
      color: #6d776f;
      font-weight: 600;
    }

    .summary-value {
      font-size: 1.5rem;
      font-weight: 700;
      color: #1c2520;
    }

    .summary-value.hours {
      color: #65B69D;
    }

    .summary-value.cost {
      color: #1F2D3D;
      font-size: 2rem;
    }

    /* Responsive */
    @media (max-width: 768px) {
      .employee-details-page {
        padding: 1rem;
      }

      .controls-card {
        flex-direction: column;
        align-items: stretch;
      }

      .summary-row {
        flex-direction: column;
        gap: 1rem;
      }

      .timesheet-table {
        font-size: 0.875rem;
      }

      .timesheet-table th,
      .timesheet-table td {
        padding: 0.75rem 0.5rem;
      }
    }
  `]
})
export class EmployeeDetailsComponent implements OnInit {
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  employee: Employee | null = null;
  selectedMonth = '';
  report: PayrollReport | null = null;
  isLoading = false;
  errorMessage = '';

  ngOnInit(): void {
    // Get employee ID from route
    const employeeId = this.route.snapshot.paramMap.get('id');
    
    if (!employeeId) {
      this.errorMessage = 'מזהה עובד לא נמצא';
      return;
    }

    // Set default month to current month
    const now = new Date();
    this.selectedMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Load employee details
    this.loadEmployee(employeeId);
    
    // Load report
    this.loadReport();
  }

  loadEmployee(employeeId: string): void {
    const url = `${environment.apiUrl}/employees/${employeeId}`;
    
    this.http.get<{ success: boolean; data: Employee }>(url).subscribe({
      next: (response) => {
        if (response.success) {
          this.employee = response.data;
        }
      },
      error: (error) => {
        console.error('❌ Error loading employee:', error);
      }
    });
  }

  loadReport(): void {
    if (!this.selectedMonth) {
      return;
    }

    const employeeId = this.route.snapshot.paramMap.get('id');
    this.isLoading = true;
    this.errorMessage = '';

    const url = `${environment.apiUrl}/attendance/report?month=${this.selectedMonth}${employeeId ? `&employeeId=${employeeId}` : ''}`;
    
    this.http.get<{ success: boolean; data: PayrollReport }>(url).subscribe({
      next: (response) => {
        if (response.success) {
          this.report = response.data;
          console.log('📊 Payroll report loaded:', this.report);
        } else {
          this.errorMessage = 'שגיאה בטעינת הדוח';
        }
        this.isLoading = false;
      },
      error: (error) => {
        console.error('❌ Error loading payroll report:', error);
        this.errorMessage = 'שגיאה בטעינת הדוח. אנא נסה שוב.';
        this.isLoading = false;
      }
    });
  }

  formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  formatTime(isoString: string): string {
    const date = new Date(isoString);
    return date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
  }

  formatCurrency(amount: number): string {
    return amount.toFixed(2) + '₪';
  }

  onMonthChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.selectedMonth = target.value;
    this.loadReport();
  }

  exportToExcel(): void {
    // Placeholder for Excel export
    alert('פונקציונליות הורדה לאקסל תתווסף בקרוב');
    console.log('📊 Exporting to Excel:', this.report);
  }

  goBack(): void {
    this.router.navigate(['/admin/employees']);
  }
}

