import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-employee-login',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="employee-login-page">
      <div class="login-container">
        <!-- Logo -->
        <div class="logo-section">
          <div class="logo-circle">
            <i class="fas fa-utensils"></i>
          </div>
          <h1 class="logo-text">מגדים</h1>
        </div>

        <!-- Login Form -->
        <div class="login-card">
          <h2 class="login-title">כניסה לאזור אישי</h2>
          
          <form (ngSubmit)="onLogin()" class="login-form">
            <!-- Phone Input -->
            <div class="form-group">
              <label for="phone">מספר טלפון</label>
              <input 
                type="tel" 
                id="phone"
                [value]="phone"
                (input)="onPhoneChange($event)"
                placeholder="050-123-4567"
                class="form-input"
                required
              />
            </div>

            <!-- PIN Input -->
            <div class="form-group">
              <label for="pinCode">קוד PIN</label>
              <input 
                type="password" 
                id="pinCode"
                [value]="pinCode"
                (input)="onPinChange($event)"
                placeholder="1234"
                maxlength="6"
                class="form-input"
                required
              />
            </div>

            <!-- Error Message -->
            <div *ngIf="errorMessage" class="error-message">
              <i class="fas fa-exclamation-circle"></i>
              {{ errorMessage }}
            </div>

            <!-- Submit Button -->
            <button type="submit" class="btn-login" [disabled]="isLoading">
              <i *ngIf="!isLoading" class="fas fa-sign-in-alt"></i>
              <i *ngIf="isLoading" class="fas fa-spinner fa-spin"></i>
              {{ isLoading ? 'מתחבר...' : 'כניסה לאזור אישי' }}
            </button>
          </form>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .employee-login-page {
      min-height: 100vh;
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem 1rem;
    }

    .login-container {
      width: 100%;
      max-width: 400px;
    }

    /* Logo Section */
    .logo-section {
      text-align: center;
      margin-bottom: 2rem;
    }

    .logo-circle {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      background: white;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 1rem;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
    }

    .logo-circle i {
      font-size: 2.5rem;
      color: #10b981;
    }

    .logo-text {
      font-size: 2rem;
      font-weight: 700;
      color: white;
      margin: 0;
      text-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
    }

    /* Login Card */
    .login-card {
      background: white;
      border-radius: 16px;
      padding: 2rem;
      box-shadow: 0 8px 30px rgba(0, 0, 0, 0.2);
    }

    .login-title {
      font-size: 1.5rem;
      font-weight: 700;
      color: #1e293b;
      text-align: center;
      margin-bottom: 2rem;
    }

    /* Form */
    .login-form {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .form-group label {
      font-weight: 600;
      color: #475569;
      font-size: 0.9rem;
    }

    .form-input {
      padding: 1rem;
      border: 2px solid #e2e8f0;
      border-radius: 8px;
      font-size: 1rem;
      transition: all 0.2s ease;
      width: 100%;
      box-sizing: border-box;
    }

    .form-input:focus {
      outline: none;
      border-color: #10b981;
      box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
    }

    .error-message {
      background: #fee2e2;
      color: #991b1b;
      padding: 0.75rem 1rem;
      border-radius: 8px;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.9rem;
    }

    /* Login Button */
    .btn-login {
      padding: 1rem 2rem;
      background: #10b981;
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 1.1rem;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      margin-top: 0.5rem;
    }

    .btn-login:hover:not(:disabled) {
      background: #059669;
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
    }

    .btn-login:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    /* Responsive */
    @media (max-width: 480px) {
      .login-card {
        padding: 1.5rem;
      }

      .logo-circle {
        width: 60px;
        height: 60px;
      }

      .logo-circle i {
        font-size: 2rem;
      }

      .logo-text {
        font-size: 1.5rem;
      }
    }
  `]
})
export class EmployeeLoginComponent implements OnInit {
  private http = inject(HttpClient);
  private router = inject(Router);

  phone = '';
  pinCode = '';
  isLoading = false;
  errorMessage = '';

  ngOnInit(): void {
    // Check if already logged in
    const token = localStorage.getItem('employee_token');
    if (token) {
      this.router.navigate(['/my-zone']);
    }
  }

  onPhoneChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    if (target) {
      this.phone = target.value;
    }
  }

  onPinChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    if (target) {
      this.pinCode = target.value;
    }
  }

  onLogin(): void {
    if (!this.phone || !this.pinCode) {
      this.errorMessage = 'אנא מלא את כל השדות';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    const url = `${environment.apiUrl}/auth/employee-login`;
    
    this.http.post<{ success: boolean; token: string; employee: any }>(url, {
      phone: this.phone.trim(),
      pinCode: this.pinCode.trim()
    }).subscribe({
      next: (response) => {
        if (response.success && response.token) {
          // Store employee token
          localStorage.setItem('employee_token', response.token);
          localStorage.setItem('employee_data', JSON.stringify(response.employee));
          
          // Navigate to my-zone
          this.router.navigate(['/my-zone']);
        } else {
          this.errorMessage = 'פרטי התחברות שגויים';
          this.isLoading = false;
        }
      },
      error: (error) => {
        console.error('❌ Login error:', error);
        this.errorMessage = error.error?.message || 'שגיאה בהתחברות. אנא נסה שוב.';
        this.isLoading = false;
      }
    });
  }
}

