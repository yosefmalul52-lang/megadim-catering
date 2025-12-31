import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="auth-page">
      <div class="auth-container">
        <div class="auth-card">
          <h1>התחברות</h1>
          <form [formGroup]="loginForm" (ngSubmit)="onSubmit()">
            <div class="form-group">
              <label for="phone">טלפון</label>
              <input 
                type="tel" 
                id="phone" 
                formControlName="phone"
                class="form-control"
                placeholder="052-824-0230"
              >
              <div *ngIf="loginForm.get('phone')?.invalid && loginForm.get('phone')?.touched" class="error-message">
                טלפון נדרש
              </div>
            </div>
            
            <div class="form-group">
              <label for="password">סיסמה</label>
              <input 
                type="password" 
                id="password" 
                formControlName="password"
                class="form-control"
                placeholder="הזן סיסמה"
              >
              <div *ngIf="loginForm.get('password')?.invalid && loginForm.get('password')?.touched" class="error-message">
                סיסמה נדרשת
              </div>
            </div>
            
            <button type="submit" class="btn btn-primary" [disabled]="loginForm.invalid || isLoading">
              <span *ngIf="isLoading">מתחבר...</span>
              <span *ngIf="!isLoading">התחבר</span>
            </button>
            
            <div *ngIf="errorMessage" class="error-message">
              {{ errorMessage }}
            </div>
          </form>
          
          <p class="auth-link">
            אין לך חשבון? <a routerLink="/register">הירשם כאן</a>
          </p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .auth-page {
      min-height: 80vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem;
      background-color: #f8f9fa;
    }
    
    .auth-container {
      width: 100%;
      max-width: 400px;
    }
    
    .auth-card {
      background: white;
      padding: 3rem;
      border-radius: 0.75rem;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
    }
    
    h1 {
      text-align: center;
      color: #0E1A24;
      margin-bottom: 2rem;
      font-size: 2rem;
    }
    
    .form-group {
      margin-bottom: 1.5rem;
    }
    
    label {
      display: block;
      margin-bottom: 0.5rem;
      color: #0E1A24;
      font-weight: 600;
    }
    
    .form-control {
      width: 100%;
      padding: 0.75rem 1rem;
      border: 2px solid #e9ecef;
      border-radius: 0.5rem;
      font-size: 1rem;
      transition: border-color 0.3s ease;
    }
    
    .form-control:focus {
      outline: none;
      border-color: #cbb69e;
    }
    
    .btn {
      width: 100%;
      padding: 0.875rem;
      border: none;
      border-radius: 0.5rem;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
    }
    
    .btn-primary {
      background-color: #cbb69e;
      color: #0E1A24;
    }
    
    .btn-primary:hover:not(:disabled) {
      background-color: #b8a48a;
      transform: translateY(-1px);
    }
    
    .btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    
    .error-message {
      color: #dc3545;
      font-size: 0.875rem;
      margin-top: 0.5rem;
    }
    
    .auth-link {
      text-align: center;
      margin-top: 2rem;
      color: #6c757d;
    }
    
    .auth-link a {
      color: #cbb69e;
      text-decoration: none;
      font-weight: 600;
    }
    
    .auth-link a:hover {
      text-decoration: underline;
    }
  `]
})
export class LoginComponent {
  loginForm: FormGroup;
  isLoading = false;
  errorMessage = '';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.loginForm = this.fb.group({
      phone: ['', [Validators.required]],
      password: ['', [Validators.required]]
    });
  }

  onSubmit() {
    if (this.loginForm.invalid) return;
    
    this.isLoading = true;
    this.errorMessage = '';
    
    const { phone, password } = this.loginForm.value;
    this.authService.login({ phone, password }).subscribe({
      next: (result) => {
        if (result.success) {
          this.router.navigate(['/']);
        } else {
          this.errorMessage = result.message || 'שגיאה בהתחברות. נסה שוב.';
        }
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Login error:', error);
        this.errorMessage = 'שגיאה בהתחברות. נסה שוב.';
        this.isLoading = false;
      }
    });
  }
}
