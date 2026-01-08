import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { environment } from '../../../../environments/environment';

interface Employee {
  _id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  role: string;
  phone: string;
  hourlyRate: number;
  isActive: boolean;
  pinCode: string;
  isClockedIn: boolean;
  currentShiftId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

@Component({
  selector: 'app-employees',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="employees-page">
      <div class="container">
        <!-- Top Toolbar -->
        <div class="toolbar">
          <h1 class="page-title">
            <i class="fas fa-users"></i>
            ניהול צוות
          </h1>
          <button class="btn-add-employee" (click)="openAddModal()">
            <i class="fas fa-plus"></i>
            עובד חדש
          </button>
        </div>

        <!-- Loading State -->
        <div *ngIf="isLoading" class="loading">
          <i class="fas fa-spinner fa-spin"></i>
          <span>טוען עובדים...</span>
        </div>

        <!-- Error State -->
        <div *ngIf="errorMessage" class="error-message">
          <i class="fas fa-exclamation-circle"></i>
          {{ errorMessage }}
        </div>

        <!-- Employees Grid -->
        <div *ngIf="!isLoading && !errorMessage" class="employees-grid">
          <!-- Empty State -->
          <div *ngIf="employees.length === 0" class="empty-state">
            <i class="fas fa-users"></i>
            <h3>אין עובדים רשומים</h3>
            <p>הוסף עובדים חדשים כדי להתחיל</p>
          </div>

          <!-- Employee Cards -->
          <div *ngFor="let employee of employees" class="employee-card">
            <!-- Avatar & Name -->
            <div class="employee-header">
              <div class="employee-avatar">
                {{ getInitials(employee) }}
              </div>
              <div class="employee-info">
                <h3 class="employee-name">{{ employee.fullName }}</h3>
                <span class="role-badge">{{ translateRole(employee.role) }}</span>
              </div>
            </div>

            <!-- Status Indicator -->
            <div class="employee-status">
              <div class="status-indicator" [class.active]="employee.isClockedIn" [class.inactive]="!employee.isClockedIn">
                <span class="status-dot"></span>
                <span class="status-text">{{ employee.isClockedIn ? 'במשמרת' : 'לא פעיל' }}</span>
              </div>
            </div>

            <!-- Employee Details -->
            <div class="employee-details">
              <div class="detail-row">
                <i class="fas fa-phone"></i>
                <span>{{ employee.phone }}</span>
              </div>
              <div class="detail-row">
                <i class="fas fa-dollar-sign"></i>
                <span>{{ employee.hourlyRate }}₪ לשעה</span>
              </div>
              <div class="detail-row pin-row">
                <i class="fas fa-key"></i>
                <span class="pin-code">🔑 PIN: <strong>{{ employee.pinCode }}</strong></span>
              </div>
            </div>

            <!-- Action Footer -->
            <div class="employee-actions">
              <button class="action-btn" (click)="editEmployee(employee)" title="ערוך">
                <i class="fas fa-edit"></i>
              </button>
              <button class="action-btn" (click)="viewHistory(employee)" title="היסטוריה">
                <i class="fas fa-history"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .employees-page {
      padding: 2rem;
      min-height: 100vh;
      background: #f3f4f6;
    }

    .container {
      max-width: 1400px;
      margin: 0 auto;
    }

    /* Top Toolbar */
    .toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2rem;
      padding: 1.5rem;
      background: white;
      border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }

    .page-title {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      font-size: 1.75rem;
      font-weight: 700;
      color: #1e293b;
      margin: 0;
    }

    .page-title i {
      color: #10b981;
    }

    .btn-add-employee {
      padding: 0.75rem 1.5rem;
      background: #10b981;
      color: white;
      border: none;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.95rem;
    }

    .btn-add-employee:hover {
      background: #059669;
      transform: translateY(-2px);
      box-shadow: 0 4px 8px rgba(16, 185, 129, 0.3);
    }

    /* Loading & Error States */
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
      border-radius: 8px;
      margin-bottom: 2rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    /* Employees Grid */
    .employees-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 1.5rem;
    }

    /* Employee Card */
    .employee-card {
      background: white;
      border-radius: 16px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
      padding: 1.5rem;
      transition: all 0.2s ease;
    }

    .employee-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 12px -2px rgba(0, 0, 0, 0.1);
    }

    /* Employee Header */
    .employee-header {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 1rem;
    }

    .employee-avatar {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 1.25rem;
      flex-shrink: 0;
    }

    .employee-info {
      flex: 1;
      min-width: 0;
    }

    .employee-name {
      font-size: 1.1rem;
      font-weight: 700;
      color: #1e293b;
      margin: 0 0 0.25rem 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .role-badge {
      display: inline-block;
      padding: 0.25rem 0.75rem;
      background: #f1f5f9;
      color: #475569;
      border-radius: 9999px;
      font-size: 0.875rem;
      font-weight: 600;
    }

    /* Status Indicator */
    .employee-status {
      margin-bottom: 1rem;
    }

    .status-indicator {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .status-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #94a3b8;
      transition: all 0.3s ease;
    }

    .status-indicator.active .status-dot {
      background: #10b981;
      animation: pulse 2s infinite;
    }

    @keyframes pulse {
      0%, 100% {
        opacity: 1;
      }
      50% {
        opacity: 0.5;
      }
    }

    .status-text {
      font-size: 0.9rem;
      font-weight: 600;
      color: #64748b;
    }

    .status-indicator.active .status-text {
      color: #10b981;
    }

    /* Employee Details */
    .employee-details {
      margin-bottom: 1rem;
      padding-top: 1rem;
      border-top: 1px solid #e2e8f0;
    }

    .detail-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.5rem;
      font-size: 0.9rem;
      color: #64748b;
    }

    .detail-row:last-child {
      margin-bottom: 0;
    }

    .detail-row i {
      width: 16px;
      color: #94a3b8;
    }

    .pin-row {
      background: rgba(16, 185, 129, 0.1);
      padding: 0.75rem;
      border-radius: 8px;
      margin-top: 0.5rem;
      border: 1px solid rgba(16, 185, 129, 0.2);
    }

    .pin-code {
      font-size: 1rem;
      color: #059669;
    }

    .pin-code strong {
      font-size: 1.1rem;
      color: #047857;
      font-weight: 700;
    }

    /* Action Footer */
    .employee-actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
      padding-top: 1rem;
      border-top: 1px solid #e2e8f0;
    }

    .action-btn {
      width: 36px;
      height: 36px;
      border: none;
      background: #f1f5f9;
      color: #64748b;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .action-btn:hover {
      background: #e2e8f0;
      color: #1e293b;
      transform: scale(1.05);
    }

    /* Empty State */
    .empty-state {
      grid-column: 1 / -1;
      text-align: center;
      padding: 4rem 2rem;
      background: white;
      border-radius: 16px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
    }

    .empty-state i {
      font-size: 4rem;
      color: #cbd5e1;
      margin-bottom: 1rem;
    }

    .empty-state h3 {
      color: #475569;
      margin-bottom: 0.5rem;
      font-size: 1.5rem;
    }

    .empty-state p {
      color: #64748b;
    }

    /* Responsive */
    @media (max-width: 768px) {
      .employees-page {
        padding: 1rem;
      }

      .toolbar {
        flex-direction: column;
        gap: 1rem;
        align-items: flex-start;
      }

      .btn-add-employee {
        width: 100%;
        justify-content: center;
      }

      .employees-grid {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class EmployeesComponent implements OnInit {
  private http = inject(HttpClient);
  private router = inject(Router);
  
  employees: Employee[] = [];
  isLoading = false;
  errorMessage = '';

  ngOnInit(): void {
    this.loadEmployees();
  }

  loadEmployees(): void {
    this.isLoading = true;
    this.errorMessage = '';
    
    const url = `${environment.apiUrl}/employees`;
    
    this.http.get<{ success: boolean; data: Employee[] }>(url).subscribe({
      next: (response) => {
        if (response.success) {
          this.employees = response.data;
          console.log('👥 Employees loaded:', this.employees.length);
        } else {
          this.errorMessage = 'שגיאה בטעינת העובדים';
        }
        this.isLoading = false;
      },
      error: (error) => {
        console.error('❌ Error loading employees:', error);
        this.errorMessage = 'שגיאה בטעינת העובדים. אנא נסה שוב.';
        this.isLoading = false;
      }
    });
  }

  getInitials(employee: Employee): string {
    const first = employee.firstName.charAt(0).toUpperCase();
    const last = employee.lastName.charAt(0).toUpperCase();
    return first + last;
  }

  translateRole(role: string): string {
    const translations: { [key: string]: string } = {
      'Chef': 'שף',
      'Driver': 'נהג',
      'Cleaner': 'מנקה',
      'Manager': 'מנהל',
      'Other': 'אחר'
    };
    return translations[role] || role;
  }

  openAddModal(): void {
    // TODO: Implement add employee modal
    alert('פונקציונליות הוספת עובד תתווסף בקרוב');
  }

  editEmployee(employee: Employee): void {
    // TODO: Implement edit employee modal
    alert(`עריכת עובד: ${employee.fullName}`);
  }

  viewHistory(employee: Employee): void {
    // Navigate to employee details page
    this.router.navigate(['/admin/employees', employee._id]);
  }
}

