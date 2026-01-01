import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { trigger, transition, style, animate, query, stagger } from '@angular/animations';

import { AuthService, LoginCredentials, RegisterCredentials } from '../../../services/auth.service';
import { AuthModalService } from '../../../services/auth-modal.service';
import { ToastService } from '../../../services/toast.service';

@Component({
  selector: 'app-auth-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  animations: [
    trigger('fadeInOut', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateX(20px)' }),
        animate('300ms cubic-bezier(0.4, 0, 0.2, 1)', style({ opacity: 1, transform: 'translateX(0)' }))
      ]),
      transition(':leave', [
        animate('200ms cubic-bezier(0.4, 0, 0.2, 1)', style({ opacity: 0, transform: 'translateX(-20px)' }))
      ])
    ]),
    trigger('slideInDown', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(-10px)' }),
        animate('300ms cubic-bezier(0.4, 0, 0.2, 1)', style({ opacity: 1, transform: 'translateY(0)' }))
      ])
    ])
  ],
  template: `
    <div class="auth-overlay" [class.open]="isModalOpen" (click)="closeModal()">
      <div class="auth-modal" (click)="$event.stopPropagation()">
        <!-- Close Button -->
        <button 
          class="close-btn" 
          (click)="closeModal()"
          [attr.aria-label]="'סגור'"
          type="button"
        >
          <i class="fas fa-times" aria-hidden="true"></i>
        </button>

        <!-- Modal Content -->
        <div class="modal-content">
          <!-- Header -->
          <div class="modal-header">
            <div class="logo-container">
              <h2 class="modal-title">ברוכים הבאים למגדים</h2>
              <p class="modal-subtitle">{{ isLoginMode ? 'התחבר לחשבון שלך' : 'צור חשבון חדש' }}</p>
            </div>
          </div>

          <!-- Tabs -->
          <div class="auth-tabs">
            <div class="tab-indicator" [class.login-active]="isLoginMode" [class.register-active]="!isLoginMode"></div>
            <button 
              class="tab-btn" 
              [class.active]="isLoginMode"
              (click)="switchToLogin()"
              type="button"
            >
              התחברות
            </button>
            <button 
              class="tab-btn" 
              [class.active]="!isLoginMode"
              (click)="switchToSignUp()"
              type="button"
            >
              הרשמה
            </button>
          </div>

          <!-- Error Message -->
          <div class="error-alert" *ngIf="errorMessage" [@slideInDown]>
            <i class="fas fa-exclamation-circle" aria-hidden="true"></i>
            <span>{{ errorMessage }}</span>
            <button 
              class="error-close"
              (click)="errorMessage = ''"
              [attr.aria-label]="'סגור הודעת שגיאה'"
              type="button"
            >
              <i class="fas fa-times" aria-hidden="true"></i>
            </button>
          </div>

          <!-- Login Form -->
          <form 
            *ngIf="isLoginMode" 
            [formGroup]="loginForm" 
            (ngSubmit)="onLogin()" 
            class="auth-form"
            [@fadeInOut]
          >
            <div class="form-group" [class.error]="loginForm.get('username')?.invalid && loginForm.get('username')?.touched">
              <label for="login-username" class="form-label">
                שם משתמש או כתובת אימייל
              </label>
              <div class="input-wrapper">
                <input
                  type="text"
                  id="login-username"
                  formControlName="username"
                  class="form-input"
                  autocomplete="username"
                  placeholder="הזן שם משתמש או אימייל"
                  [disabled]="isLoading"
                >
              </div>
              <span class="error-message" *ngIf="loginForm.get('username')?.invalid && loginForm.get('username')?.touched">
                <span *ngIf="loginForm.get('username')?.errors?.['required']">שם משתמש או אימייל נדרש</span>
                <span *ngIf="loginForm.get('username')?.errors?.['email']">אימייל לא תקין</span>
              </span>
            </div>

            <div class="form-group" [class.error]="loginForm.get('password')?.invalid && loginForm.get('password')?.touched">
              <label for="login-password" class="form-label">
                סיסמה
              </label>
              <div class="input-wrapper password-wrapper">
                <input
                  [type]="showPassword ? 'text' : 'password'"
                  id="login-password"
                  formControlName="password"
                  class="form-input"
                  autocomplete="current-password"
                  placeholder="הזן סיסמה"
                  [disabled]="isLoading"
                >
                <button
                  type="button"
                  class="password-toggle"
                  (click)="showPassword = !showPassword"
                  [attr.aria-label]="showPassword ? 'הסתר סיסמה' : 'הצג סיסמה'"
                >
                  <i class="fas" [class.fa-eye]="!showPassword" [class.fa-eye-slash]="showPassword" aria-hidden="true"></i>
                </button>
              </div>
              <span class="error-message" *ngIf="loginForm.get('password')?.invalid && loginForm.get('password')?.touched">
                <span *ngIf="loginForm.get('password')?.errors?.['required']">סיסמה נדרשת</span>
                <span *ngIf="loginForm.get('password')?.errors?.['minlength']">סיסמה חייבת להכיל לפחות 3 תווים</span>
              </span>
            </div>

            <!-- Remember Me & Forgot Password Row -->
            <div class="form-options">
              <label class="remember-me">
                <input
                  type="checkbox"
                  [(ngModel)]="rememberMe"
                  [ngModelOptions]="{standalone: true}"
                  [disabled]="isLoading"
                >
                <span>זכור אותי</span>
              </label>
              <a href="#" class="forgot-password" (click)="$event.preventDefault()">
                שכחת סיסמה?
              </a>
            </div>

            <button
              type="submit"
              class="btn-submit"
              [disabled]="isLoading || loginForm.invalid"
              [class.loading]="isLoading"
            >
              <span *ngIf="!isLoading">התחבר</span>
              <span *ngIf="isLoading">
                <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
                מתחבר...
              </span>
            </button>
          </form>

          <!-- Register Form -->
          <form 
            *ngIf="!isLoginMode" 
            [formGroup]="registerForm" 
            (ngSubmit)="onSignUp()" 
            class="auth-form"
            [@fadeInOut]
          >
            <div class="form-group" [class.error]="registerForm.get('fullName')?.invalid && registerForm.get('fullName')?.touched">
              <label for="signup-fullName" class="form-label">
                שם מלא
              </label>
              <div class="input-wrapper">
                <input
                  type="text"
                  id="signup-fullName"
                  formControlName="fullName"
                  class="form-input"
                  autocomplete="name"
                  placeholder="הזן שם מלא"
                  [disabled]="isLoading"
                >
              </div>
              <span class="error-message" *ngIf="registerForm.get('fullName')?.invalid && registerForm.get('fullName')?.touched">
                שם מלא נדרש
              </span>
            </div>

            <div class="form-group" [class.error]="registerForm.get('username')?.invalid && registerForm.get('username')?.touched">
              <label for="signup-username" class="form-label">
                אימייל
              </label>
              <div class="input-wrapper">
                <input
                  type="email"
                  id="signup-username"
                  formControlName="username"
                  class="form-input"
                  autocomplete="username"
                  placeholder="your@email.com"
                  [disabled]="isLoading"
                >
              </div>
              <span class="error-message" *ngIf="registerForm.get('username')?.invalid && registerForm.get('username')?.touched">
                <span *ngIf="registerForm.get('username')?.errors?.['required']">אימייל נדרש</span>
                <span *ngIf="registerForm.get('username')?.errors?.['email']">אימייל לא תקין</span>
              </span>
            </div>

            <div class="form-group" [class.error]="registerForm.get('phone')?.invalid && registerForm.get('phone')?.touched">
              <label for="signup-phone" class="form-label">
                טלפון
              </label>
              <div class="input-wrapper">
                <input
                  type="tel"
                  id="signup-phone"
                  formControlName="phone"
                  class="form-input"
                  autocomplete="tel"
                  placeholder="052-824-0230"
                  [disabled]="isLoading"
                >
              </div>
              <span class="error-message" *ngIf="registerForm.get('phone')?.invalid && registerForm.get('phone')?.touched">
                טלפון נדרש
              </span>
            </div>

            <div class="form-group" [class.error]="registerForm.get('password')?.invalid && registerForm.get('password')?.touched">
              <label for="signup-password" class="form-label">
                סיסמה
              </label>
              <div class="input-wrapper">
                <input
                  type="password"
                  id="signup-password"
                  formControlName="password"
                  class="form-input"
                  autocomplete="new-password"
                  placeholder="הזן סיסמה (לפחות 3 תווים)"
                  [disabled]="isLoading"
                >
              </div>
              <span class="error-message" *ngIf="registerForm.get('password')?.invalid && registerForm.get('password')?.touched">
                <span *ngIf="registerForm.get('password')?.errors?.['required']">סיסמה נדרשת</span>
                <span *ngIf="registerForm.get('password')?.errors?.['minlength']">סיסמה חייבת להכיל לפחות 3 תווים</span>
              </span>
            </div>

            <div class="form-group">
              <label for="signup-address" class="form-label">
                כתובת (אופציונלי)
              </label>
              <div class="input-wrapper">
                <input
                  type="text"
                  id="signup-address"
                  formControlName="address"
                  class="form-input"
                  autocomplete="street-address"
                  placeholder="הזן כתובת למשלוח"
                  [disabled]="isLoading"
                >
              </div>
            </div>

            <button
              type="submit"
              class="btn-submit"
              [disabled]="isLoading || registerForm.invalid"
              [class.loading]="isLoading"
            >
              <span *ngIf="!isLoading">הירשם</span>
              <span *ngIf="isLoading">
                <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
                נרשם...
              </span>
            </button>
          </form>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./auth-modal.component.scss']
})
export class AuthModalComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private authModalService = inject(AuthModalService);
  private toastService = inject(ToastService);
  private fb = inject(FormBuilder);
  private destroy$ = new Subject<void>();

  isModalOpen = false;
  isLoginMode = true;
  isLoading = false;
  errorMessage = '';
  showPassword = false;
  rememberMe = false;

  loginForm!: FormGroup;
  registerForm!: FormGroup;

  ngOnInit(): void {
    // Subscribe to modal state
    this.authModalService.isModalOpen$
      .pipe(takeUntil(this.destroy$))
      .subscribe(isOpen => {
        this.isModalOpen = isOpen;
        if (isOpen) {
          // Reset forms when modal opens
          this.resetForms();
        }
      });

    // Initialize forms
    this.initForms();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  initForms(): void {
    // Login Form - username can be email or username, so we don't require email validation
    this.loginForm = this.fb.group({
      username: ['', [Validators.required]],
      password: ['', [Validators.required, Validators.minLength(3)]]
    });

    // Register Form
    this.registerForm = this.fb.group({
      fullName: ['', [Validators.required]],
      username: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.required]],
      password: ['', [Validators.required, Validators.minLength(3)]],
      address: ['']
    });
  }

  resetForms(): void {
    this.loginForm?.reset();
    this.registerForm?.reset();
    this.errorMessage = '';
    this.isLoading = false;
  }

  switchToLogin(): void {
    if (this.isLoginMode) return; // Already in login mode
    this.isLoginMode = true;
    this.errorMessage = '';
    // Reset login form errors
    this.loginForm.markAsUntouched();
  }

  switchToSignUp(): void {
    if (!this.isLoginMode) return; // Already in register mode
    this.isLoginMode = false;
    this.errorMessage = '';
    // Reset register form errors
    this.registerForm.markAsUntouched();
  }

  closeModal(): void {
    this.authModalService.closeModal();
  }

  onLogin(): void {
    if (this.loginForm.invalid) {
      // Mark all fields as touched to show errors
      Object.keys(this.loginForm.controls).forEach(key => {
        this.loginForm.get(key)?.markAsTouched();
      });
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    const credentials: LoginCredentials = {
      username: this.loginForm.value.username,
      password: this.loginForm.value.password
    };

    this.authService.login(credentials).subscribe({
      next: (response) => {
        if (response.success) {
          const userName = response.user?.fullName || response.user?.username || 'משתמש';
          this.toastService.success(`התחברות בוצעה בהצלחה! ברוך הבא ${userName}`);
          
          // Clear form and close modal after short delay
          this.loginForm.reset();
          this.errorMessage = '';
          
          setTimeout(() => {
            this.closeModal();
          }, 500);
        } else {
          // Show error but keep modal open
          this.errorMessage = response.message || 'שגיאה בהתחברות';
          this.isLoading = false;
        }
      },
      error: (error) => {
        console.error('Login error:', error);
        
        // Show error but keep modal open
        if (error.error?.message) {
          this.errorMessage = error.error.message;
        } else if (error.status === 401) {
          this.errorMessage = 'אימייל או סיסמה שגויים';
        } else if (error.status === 0) {
          this.errorMessage = 'לא ניתן להתחבר לשרת. אנא בדוק את החיבור.';
        } else {
          this.errorMessage = 'שגיאה בהתחברות. אנא נסה שוב.';
        }
        
        this.isLoading = false;
        // Modal stays open so user can retry
      }
    });
  }

  onSignUp(): void {
    if (this.registerForm.invalid) {
      // Mark all fields as touched to show errors
      Object.keys(this.registerForm.controls).forEach(key => {
        this.registerForm.get(key)?.markAsTouched();
      });
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    const credentials: RegisterCredentials = {
      fullName: this.registerForm.value.fullName,
      username: this.registerForm.value.username,
      phone: this.registerForm.value.phone,
      password: this.registerForm.value.password,
      address: this.registerForm.value.address || ''
    };

    this.authService.register(credentials).subscribe({
      next: (response) => {
        if (response.success) {
          // User is automatically logged in after registration (token is returned)
          const userName = response.user?.fullName || response.user?.username || 'משתמש';
          this.toastService.success(`הרשמה בוצעה בהצלחה! ברוך הבא ${userName}`);
          
          // Clear form and close modal after short delay
          this.registerForm.reset();
          this.errorMessage = '';
          
          setTimeout(() => {
            this.closeModal();
          }, 500);
        } else {
          // Show error but keep modal open
          this.errorMessage = response.message || 'שגיאה בהרשמה';
          this.isLoading = false;
        }
      },
      error: (error) => {
        console.error('Registration error:', error);
        
        // Show error but keep modal open
        if (error.error?.message) {
          this.errorMessage = error.error.message;
        } else if (error.status === 400) {
          this.errorMessage = 'פרטים שגויים. אנא בדוק את הטופס.';
        } else if (error.status === 0) {
          this.errorMessage = 'לא ניתן להתחבר לשרת. אנא בדוק את החיבור.';
        } else {
          this.errorMessage = 'שגיאה בהרשמה. אנא נסה שוב.';
        }
        
        this.isLoading = false;
        // Modal stays open so user can retry
      }
    });
  }
}

