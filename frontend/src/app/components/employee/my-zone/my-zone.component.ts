import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { environment } from '../../../../environments/environment';

interface Shift {
  _id: string;
  date: string;
  clockIn: string;
  clockOut: string | null;
  duration: number;
}

interface EmployeeStats {
  employee: {
    _id: string;
    firstName: string;
    lastName: string;
    fullName: string;
    phone: string;
    role: string;
    hourlyRate: number;
  };
  monthlyHours: number;
  estimatedWage: number;
  shifts: Shift[];
  shiftCount: number;
}

@Component({
  selector: 'app-my-zone',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="my-zone-page">
      <!-- Header -->
      <div class="zone-header">
        <button class="btn-logout" (click)="logout()">
          <i class="fas fa-sign-out-alt"></i>
          יציאה
        </button>
        <h1 class="welcome-text">
          שלום, {{ employeeName }} 👋
        </h1>
      </div>

      <!-- Loading State -->
      <div *ngIf="isLoading" class="loading">
        <i class="fas fa-spinner fa-spin"></i>
        <span>טוען נתונים...</span>
      </div>

      <!-- Error State -->
      <div *ngIf="errorMessage" class="error-message">
        <i class="fas fa-exclamation-circle"></i>
        {{ errorMessage }}
      </div>

      <!-- Content -->
      <div *ngIf="!isLoading && !errorMessage && stats" class="zone-content">
        <!-- Salary Card -->
        <div class="salary-card">
          <div class="salary-header">
            <i class="fas fa-wallet"></i>
            <h2>שכר משוער החודש</h2>
          </div>
          <div class="salary-amount">{{ formatCurrency(stats.estimatedWage) }}</div>
          <div class="salary-hours">
            <i class="fas fa-clock"></i>
            <span>{{ stats.monthlyHours.toFixed(2) }} שעות</span>
          </div>
        </div>

        <!-- Shift History -->
        <div class="shifts-card">
          <div class="card-header">
            <h3>היסטוריית משמרות</h3>
            <span class="shift-count">{{ stats.shiftCount }} משמרות</span>
          </div>

          <div *ngIf="stats.shifts.length === 0" class="empty-shifts">
            <i class="fas fa-calendar-times"></i>
            <p>אין משמרות לחודש זה</p>
          </div>

          <div *ngIf="stats.shifts.length > 0" class="shifts-list">
            <div *ngFor="let shift of stats.shifts" class="shift-item">
              <div class="shift-date">
                <i class="fas fa-calendar"></i>
                {{ formatDate(shift.date) }}
              </div>
              <div class="shift-time">
                <span class="time-entry">
                  <i class="fas fa-sign-in-alt"></i>
                  {{ formatTime(shift.clockIn) }}
                </span>
                <span class="time-separator">-</span>
                <span class="time-exit" [class.missing]="!shift.clockOut">
                  <i class="fas fa-sign-out-alt"></i>
                  {{ shift.clockOut ? formatTime(shift.clockOut) : 'לא נרשמה יציאה' }}
                </span>
              </div>
              <div class="shift-duration">
                <i class="fas fa-hourglass-half"></i>
                {{ shift.duration.toFixed(2) }} שעות
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .my-zone-page {
      min-height: 100vh;
      background: #f3f4f6;
      padding-bottom: 2rem;
    }

    /* Header */
    .zone-header {
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      padding: 2rem 1rem;
      color: white;
      position: relative;
    }

    .btn-logout {
      position: absolute;
      top: 1rem;
      left: 1rem;
      padding: 0.5rem 1rem;
      background: rgba(255, 255, 255, 0.2);
      color: white;
      border: 1px solid rgba(255, 255, 255, 0.3);
      border-radius: 8px;
      cursor: pointer;
      font-weight: 600;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .btn-logout:hover {
      background: rgba(255, 255, 255, 0.3);
    }

    .welcome-text {
      font-size: 1.75rem;
      font-weight: 700;
      margin: 0;
      text-align: center;
      text-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
    }

    /* Loading & Error */
    .loading {
      text-align: center;
      padding: 4rem 2rem;
      color: #64748b;
    }

    .loading i {
      font-size: 2.5rem;
      margin-bottom: 1rem;
      color: #10b981;
    }

    .error-message {
      background: #fee2e2;
      color: #991b1b;
      padding: 1rem 1.5rem;
      margin: 1rem;
      border-radius: 8px;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    /* Content */
    .zone-content {
      padding: 1rem;
      max-width: 600px;
      margin: 0 auto;
    }

    /* Salary Card */
    .salary-card {
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      border-radius: 16px;
      padding: 2rem;
      margin-bottom: 1.5rem;
      box-shadow: 0 4px 20px rgba(16, 185, 129, 0.3);
      color: white;
    }

    .salary-header {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 1rem;
    }

    .salary-header i {
      font-size: 1.5rem;
    }

    .salary-header h2 {
      font-size: 1.25rem;
      font-weight: 600;
      margin: 0;
    }

    .salary-amount {
      font-size: 3rem;
      font-weight: 700;
      margin-bottom: 0.5rem;
      text-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
    }

    .salary-hours {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 1.1rem;
      opacity: 0.9;
    }

    /* Shifts Card */
    .shifts-card {
      background: white;
      border-radius: 16px;
      padding: 1.5rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5rem;
      padding-bottom: 1rem;
      border-bottom: 2px solid #e2e8f0;
    }

    .card-header h3 {
      font-size: 1.25rem;
      font-weight: 700;
      color: #1e293b;
      margin: 0;
    }

    .shift-count {
      background: #f1f5f9;
      color: #475569;
      padding: 0.25rem 0.75rem;
      border-radius: 9999px;
      font-size: 0.875rem;
      font-weight: 600;
    }

    .empty-shifts {
      text-align: center;
      padding: 3rem 2rem;
      color: #64748b;
    }

    .empty-shifts i {
      font-size: 3rem;
      margin-bottom: 1rem;
      color: #cbd5e1;
    }

    /* Shifts List */
    .shifts-list {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      max-height: 500px;
      overflow-y: auto;
    }

    .shift-item {
      padding: 1rem;
      background: #f8fafc;
      border-radius: 12px;
      border-left: 4px solid #10b981;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .shift-date {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-weight: 700;
      color: #1e293b;
      font-size: 1rem;
    }

    .shift-time {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      font-size: 0.9rem;
      color: #475569;
    }

    .time-entry,
    .time-exit {
      display: flex;
      align-items: center;
      gap: 0.25rem;
    }

    .time-exit.missing {
      color: #ef4444;
      font-weight: 600;
    }

    .time-separator {
      color: #cbd5e1;
    }

    .shift-duration {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-weight: 600;
      color: #059669;
      font-size: 0.95rem;
    }

    /* Responsive */
    @media (max-width: 480px) {
      .zone-header {
        padding: 1.5rem 1rem;
      }

      .welcome-text {
        font-size: 1.5rem;
      }

      .salary-card {
        padding: 1.5rem;
      }

      .salary-amount {
        font-size: 2.5rem;
      }

      .shifts-card {
        padding: 1rem;
      }
    }
  `]
})
export class MyZoneComponent implements OnInit {
  private http = inject(HttpClient);
  private router = inject(Router);

  employeeName = '';
  stats: EmployeeStats | null = null;
  isLoading = false;
  errorMessage = '';

  ngOnInit(): void {
    // Check if logged in
    const token = localStorage.getItem('employee_token');
    const employeeData = localStorage.getItem('employee_data');
    
    if (!token) {
      this.router.navigate(['/employee-login']);
      return;
    }

    if (employeeData) {
      try {
        const employee = JSON.parse(employeeData);
        this.employeeName = employee.firstName || 'עובד';
      } catch (e) {
        console.error('Error parsing employee data:', e);
      }
    }

    this.loadStats();
  }

  loadStats(): void {
    this.isLoading = true;
    this.errorMessage = '';

    const token = localStorage.getItem('employee_token');
    if (!token) {
      this.router.navigate(['/employee-login']);
      return;
    }

    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });

    const url = `${environment.apiUrl}/employees/my/stats`;
    
    this.http.get<{ success: boolean; data: EmployeeStats }>(url, { headers }).subscribe({
      next: (response) => {
        if (response.success) {
          this.stats = response.data;
          if (!this.employeeName && response.data.employee) {
            this.employeeName = response.data.employee.firstName;
          }
          console.log('📊 Employee stats loaded:', this.stats);
        } else {
          this.errorMessage = 'שגיאה בטעינת הנתונים';
        }
        this.isLoading = false;
      },
      error: (error) => {
        console.error('❌ Error loading stats:', error);
        if (error.status === 401) {
          // Token expired or invalid
          localStorage.removeItem('employee_token');
          localStorage.removeItem('employee_data');
          this.router.navigate(['/employee-login']);
        } else {
          this.errorMessage = 'שגיאה בטעינת הנתונים. אנא נסה שוב.';
        }
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

  logout(): void {
    localStorage.removeItem('employee_token');
    localStorage.removeItem('employee_data');
    this.router.navigate(['/employee-login']);
  }
}

