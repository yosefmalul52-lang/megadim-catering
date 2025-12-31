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
          <h1>הרשמה</h1>
          <form [formGroup]="registerForm" (ngSubmit)="onSubmit()">
            <div class="form-group">
              <label for="fullName">שם מלא</label>
              <input 
                type="text" 
                id="fullName" 
                formControlName="fullName"
                class="form-control"
                placeholder="הזן שם מלא"
              >
              <div *ngIf="registerForm.get('fullName')?.invalid && registerForm.get('fullName')?.touched" class="error-message">
                שם מלא נדרש
              </div>
            </div>
            
            <div class="form-group">
              <label for="username">אימייל (שם משתמש)</label>
              <input 
                type="email" 
                id="username" 
                formControlName="username"
                class="form-control"
                placeholder="your@email.com"
              >
              <div *ngIf="registerForm.get('username')?.invalid && registerForm.get('username')?.touched" class="error-message">
                אימייל תקין נדרש
              </div>
            </div>
            
            <div class="form-group">
              <label for="phone">טלפון</label>
              <input 
                type="tel" 
                id="phone" 
                formControlName="phone"
                class="form-control"
                placeholder="052-824-0230"
              >
              <div *ngIf="registerForm.get('phone')?.invalid && registerForm.get('phone')?.touched" class="error-message">
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
                placeholder="הזן סיסמה (לפחות 6 תווים)"
              >
              <div *ngIf="registerForm.get('password')?.invalid && registerForm.get('password')?.touched" class="error-message">
                סיסמה נדרשת (לפחות 6 תווים)
              </div>
            </div>
            
            <div class="form-group">
              <label for="address">כתובת (אופציונלי)</label>
              <input 
                type="text" 
                id="address" 
                formControlName="address"
                class="form-control"
                placeholder="הזן כתובת למשלוח"
              >
            </div>
            
            <button type="submit" class="btn btn-primary" [disabled]="registerForm.invalid || isLoading">
              <span *ngIf="isLoading">נרשם...</span>
              <span *ngIf="!isLoading">הירשם</span>
            </button>
            
            <div *ngIf="errorMessage" class="error-message">
              {{ errorMessage }}
            </div>
          </form>
          
          <p class="auth-link">
            יש לך חשבון? <a routerLink="/login">התחבר כאן</a>
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
      phone: ['', [Validators.required]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      address: ['']
    });
  }

  onSubmit() {
    if (this.registerForm.invalid) return;
    
    this.isLoading = true;
    this.errorMessage = '';
    
    const { fullName, username, phone, password, address } = this.registerForm.value;
    this.authService.register({ fullName, username, phone, password, address }).subscribe({
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
