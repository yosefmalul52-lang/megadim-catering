import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../../services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="auth-page">
      <div class="auth-container">
        <div class="auth-card">
          <a routerLink="/" class="back-home-link"><i class="fa-solid fa-arrow-right"></i> חזרה לדף הבית</a>
          <h1 class="auth-title">הרשמה</h1>
          <p class="auth-subtitle">צור חשבון והזמן בקלות</p>
          <form [formGroup]="registerForm" (ngSubmit)="onSubmit()">
            <div class="form-group">
              <label for="fullName" class="form-label">
                <i class="fas fa-user" aria-hidden="true"></i>
                שם מלא
              </label>
              <div class="input-wrapper">
                <i class="fas fa-user input-icon" aria-hidden="true"></i>
                <input
                  type="text"
                  id="fullName"
                  formControlName="fullName"
                  class="form-control"
                  placeholder="הזן שם מלא"
                >
              </div>
              <div *ngIf="registerForm.get('fullName')?.invalid && registerForm.get('fullName')?.touched" class="error-message">
                שם מלא נדרש
              </div>
            </div>
            <div class="form-group">
              <label for="username" class="form-label">
                <i class="fas fa-envelope" aria-hidden="true"></i>
                אימייל
              </label>
              <div class="input-wrapper">
                <i class="fas fa-envelope input-icon" aria-hidden="true"></i>
                <input
                  type="email"
                  id="username"
                  formControlName="username"
                  class="form-control"
                  placeholder="your@email.com"
                >
              </div>
              <div *ngIf="registerForm.get('username')?.invalid && registerForm.get('username')?.touched" class="error-message">
                אימייל תקין נדרש
              </div>
            </div>
            <div class="form-group">
              <label for="password" class="form-label">
                <i class="fas fa-lock" aria-hidden="true"></i>
                סיסמה
              </label>
              <div class="input-wrapper">
                <i class="fas fa-lock input-icon" aria-hidden="true"></i>
                <input
                  type="password"
                  id="password"
                  formControlName="password"
                  class="form-control"
                  placeholder="הזן סיסמה (לפחות 6 תווים)"
                >
              </div>
              <div *ngIf="registerForm.get('password')?.invalid && registerForm.get('password')?.touched" class="error-message">
                סיסמה נדרשת (לפחות 6 תווים)
              </div>
            </div>
            <button type="submit" class="btn-primary" [disabled]="registerForm.invalid || isLoading">
              <span *ngIf="isLoading">נרשם...</span>
              <span *ngIf="!isLoading">הירשם</span>
            </button>
            <div *ngIf="errorMessage" class="error-message error-block">{{ errorMessage }}</div>
          </form>
          <p class="auth-footer">
            יש לך חשבון? <a routerLink="/login" class="auth-footer-link">התחבר</a>
          </p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .auth-page {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem;
      direction: rtl;
      background: #f4f5f7;
      box-sizing: border-box;
    }
    .auth-container {
      width: 100%;
      max-width: 440px;
    }
    .auth-card {
      background: #ffffff;
      padding: 40px;
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.08);
      transition: box-shadow 0.3s ease;
    }
    .auth-card:hover {
      box-shadow: 0 12px 48px rgba(0, 0, 0, 0.1);
    }
    .back-home-link {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      color: #5a6570;
      font-size: 0.875rem;
      text-decoration: none;
      margin-bottom: 1.25rem;
      transition: color 0.2s ease;
      font-weight: 500;
    }
    .back-home-link:hover {
      color: #E0C075;
    }
    .back-home-link i {
      font-size: 0.8rem;
    }
    .auth-title {
      text-align: center;
      color: #1f3540;
      margin: 0 0 0.5rem 0;
      font-size: 2rem;
      font-weight: 700;
      letter-spacing: -0.5px;
    }
    .auth-subtitle {
      text-align: center;
      color: #6c757d;
      margin: 0 0 2rem 0;
      font-size: 1rem;
    }
    .form-group {
      margin-bottom: 1.5rem;
    }
    .form-group label.form-label {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.5rem;
      color: #1f3540;
      font-weight: 600;
      font-size: 0.9375rem;
    }
    .form-label i {
      color: #E0C075;
      font-size: 0.9rem;
    }
    .input-wrapper {
      position: relative;
      display: flex;
      align-items: center;
    }
    .input-icon {
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      right: 15px;
      color: #888;
      font-size: 1rem;
      pointer-events: none;
      z-index: 1;
      transition: color 0.2s ease;
    }
    .input-wrapper:focus-within .input-icon {
      color: #E0C075;
    }
    .form-control {
      width: 100%;
      padding: 12px 40px 12px 12px;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      font-size: 1rem;
      transition: border-color 0.2s ease, box-shadow 0.2s ease;
      box-sizing: border-box;
      background: #ffffff;
      -webkit-appearance: none;
      appearance: none;
      text-align: right;
    }
    .form-control:hover:not(:disabled) {
      border-color: #d0d6db;
    }
    .form-control:focus {
      outline: none;
      border-color: #E0C075;
      box-shadow: 0 0 0 3px rgba(224, 192, 117, 0.2);
      background: #ffffff;
    }
    .btn-primary {
      width: 100%;
      padding: 0.875rem 1.5rem;
      margin-top: 0.5rem;
      border: none;
      border-radius: 8px;
      font-size: 1.0625rem;
      font-weight: bold;
      cursor: pointer;
      transition: all 0.25s ease;
      background: #e0c075;
      color: #111;
      box-shadow: 0 4px 14px rgba(224, 192, 117, 0.35);
    }
    .btn-primary:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(224, 192, 117, 0.45);
      background: color-mix(in srgb, #e0c075, black 10%);
    }
    .btn-primary:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
    }
    .error-message {
      color: #dc3545;
      font-size: 0.875rem;
      margin-top: 0.5rem;
    }
    .error-block {
      margin-top: 1rem;
      padding: 0.5rem 0;
    }
    .auth-footer {
      text-align: center;
      margin-top: 2rem;
      padding-top: 1.5rem;
      border-top: 1px solid #eee;
      color: #5a6570;
      font-size: 0.9375rem;
    }
    .auth-footer-link {
      color: #E0C075;
      text-decoration: none;
      font-weight: bold;
      transition: text-decoration 0.2s ease, color 0.2s ease;
    }
    .auth-footer-link:hover {
      text-decoration: underline;
      color: #c5a059;
    }
    @media (max-width: 480px) {
      .auth-page { padding: 1rem; }
      .auth-card { padding: 1.75rem; border-radius: 12px; }
      .auth-title { font-size: 1.75rem; }
    }
  `]
})
export class RegisterComponent {
  registerForm: FormGroup;
  isLoading = false;
  errorMessage = '';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.registerForm = this.fb.group({
      fullName: ['', [Validators.required]],
      username: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  onSubmit() {
    if (this.registerForm.invalid) return;
    
    this.isLoading = true;
    this.errorMessage = '';
    
    const { fullName, username, password } = this.registerForm.value;
    this.authService.register({ fullName, username, password }).subscribe({
      next: (result: any) => {
        if (result.success) {
          // Auto-login successful - redirect to home
          this.router.navigate(['/']);
        } else {
          this.errorMessage = result.message || 'שגיאה בהרשמה. נסה שוב.';
        }
        this.isLoading = false;
      },
      error: (error: any) => {
        console.error('Registration error:', error);
        this.errorMessage = error.error?.message || 'שגיאה בהרשמה. נסה שוב.';
        this.isLoading = false;
      }
    });
  }
}
