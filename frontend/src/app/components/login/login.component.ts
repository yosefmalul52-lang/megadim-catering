import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService, LoginCredentials, RegisterCredentials } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="login-container">
      <div class="login-card">
        <a routerLink="/" class="back-home-link"><i class="fa-solid fa-arrow-right"></i> חזרה לדף הבית</a>
        <div class="login-header">
          <div class="logo-container">
            <h1 class="login-title">התחברות</h1>
            <p class="login-subtitle">התחבר לחשבון שלך</p>
          </div>
        </div>

        <!-- Success Message -->
        <div class="success-alert" *ngIf="successMessage">
          <i class="fas fa-check-circle" aria-hidden="true"></i>
          <span>{{ successMessage }}</span>
        </div>

        <!-- Error Message -->
        <div class="error-alert" *ngIf="errorMessage">
          <i class="fas fa-exclamation-circle" aria-hidden="true"></i>
          <span>{{ errorMessage }}</span>
        </div>

        <!-- Logged In Status -->
        <div class="logged-in-status" *ngIf="isLoggedIn">
          <div class="user-info">
            <i class="fas fa-user-check" aria-hidden="true"></i>
            <div class="user-details">
              <p class="user-name">{{ currentUser?.fullName || currentUser?.username || 'משתמש מחובר' }}</p>
              <p class="user-role">{{ currentUser?.role === 'admin' ? 'מנהל' : currentUser?.role === 'user' ? 'לקוח' : 'משתמש' }}</p>
            </div>
          </div>
          <button
            type="button"
            class="btn-logout"
            (click)="onLogout()"
            [disabled]="isLoading"
          >
            <i class="fas fa-sign-out-alt" aria-hidden="true"></i>
            התנתק
          </button>
        </div>

        <!-- Login Form -->
        <form (ngSubmit)="onLogin(loginForm)" #loginForm="ngForm" class="login-form">
          <div class="form-group" [class.error]="errors.username || errorMessage">
            <label for="login-username" class="form-label">
              <i class="fas fa-envelope" aria-hidden="true"></i>
              אימייל
            </label>
            <div class="input-wrapper">
              <i class="fas fa-envelope input-icon" aria-hidden="true"></i>
              <input
                type="email"
                id="login-username"
                name="username"
                class="form-input"
                [(ngModel)]="loginCredentials.username"
                required
                email
                autocomplete="username"
                placeholder="your@email.com"
                [disabled]="isLoading"
              >
            </div>
            <span class="error-message" *ngIf="errors.username">{{ errors.username }}</span>
          </div>

          <div class="form-group" [class.error]="errors.password || errorMessage">
            <label for="login-password" class="form-label">
              <i class="fas fa-lock" aria-hidden="true"></i>
              סיסמה
            </label>
            <div class="input-wrapper">
              <i class="fas fa-lock input-icon" aria-hidden="true"></i>
              <input
                type="password"
                id="login-password"
                name="password"
                class="form-input"
                [(ngModel)]="loginCredentials.password"
                required
                autocomplete="current-password"
                placeholder="הזן סיסמה"
                [disabled]="isLoading"
              >
            </div>
            <span class="error-message" *ngIf="errors.password">{{ errors.password }}</span>
          </div>

          <button
            type="submit"
            class="btn-login"
            [disabled]="isLoading"
            [class.loading]="isLoading"
          >
            <span *ngIf="!isLoading">
              <i class="fas fa-sign-in-alt" aria-hidden="true"></i>
              התחבר
            </span>
            <span *ngIf="isLoading">
              <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
              מתחבר...
            </span>
          </button>
          <p class="auth-footer">
            אין לך חשבון? <a routerLink="/register" class="auth-footer-link">להרשמה</a>
          </p>
        </form>
      </div>
    </div>
  `,
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit {
  isLoginMode = true; // Toggle between login and sign up
  isLoading = false;
  errorMessage = '';
  successMessage = '';
  errors: { [key: string]: string } = {};
  isLoggedIn = false;
  currentUser: any = null;

  loginCredentials: LoginCredentials = {
    username: '',
    password: ''
  };

  registerCredentials: RegisterCredentials = {
    fullName: '',
    username: '',
    phone: '',
    password: '',
    address: ''
  };

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Check if user is logged in
    this.isLoggedIn = this.authService.isLoggedIn();
    this.currentUser = this.authService.currentUser;
    
    // Debug logging
    console.log('🔍 Login Component - Initial State:', {
      isLoggedIn: this.isLoggedIn,
      currentUser: this.currentUser
    });
    
    // Subscribe to auth state changes
    this.authService.isLoggedIn$.subscribe(isLoggedIn => {
      this.isLoggedIn = isLoggedIn;
      console.log('🔍 Login Component - isLoggedIn changed:', isLoggedIn);
    });
    
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
      console.log('🔍 Login Component - currentUser changed:', user);
    });
  }

  switchToLogin(): void {
    this.isLoginMode = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.errors = {};
  }

  switchToSignUp(): void {
    this.isLoginMode = false;
    this.errorMessage = '';
    this.successMessage = '';
    this.errors = {};
  }

  onLogin(loginForm?: any): void {
    // Reset errors
    this.errorMessage = '';
    this.successMessage = '';
    this.errors = {};

    // Debug: Check form validity
    if (loginForm && loginForm.invalid) {
      console.log('🔍 Form Errors:', loginForm.errors);
      console.log('🔍 Form Valid:', loginForm.valid);
      console.log('🔍 Form Invalid:', loginForm.invalid);
      
      // Log each control's errors
      if (loginForm.controls) {
        Object.keys(loginForm.controls).forEach(key => {
          const control = loginForm.controls[key];
          if (control && control.invalid) {
            console.log(`❌ Field "${key}" is invalid:`, control.errors);
          }
        });
      }
      
      console.warn('⚠️ Form is invalid, but proceeding anyway for debugging...');
    }

    // Validate
    if (!this.loginCredentials.username || !this.loginCredentials.password) {
      if (!this.loginCredentials.username) {
        this.errors.username = 'אימייל נדרש';
      }
      if (!this.loginCredentials.password) {
        this.errors.password = 'סיסמה נדרשת';
      }
      // Continue anyway for debugging
      console.warn('⚠️ Missing credentials, but proceeding anyway...');
    }

    this.isLoading = true;

    this.authService.login(this.loginCredentials).subscribe({
      next: (response) => {
        if (response.success) {
          // Update local state
          this.isLoggedIn = true;
          this.currentUser = response.user;
          
          this.successMessage = 'התחברות בוצעה בהצלחה!';
          console.log('✅ Login successful, user:', response.user);
          
          // Smart redirection based on user role
          const user = response.user;
          setTimeout(() => {
            if (user?.role === 'admin') {
              this.router.navigate(['/admin']);
            } else if (user?.role === 'driver') {
              this.router.navigate(['/admin/delivery']);
            } else {
              // Regular user - go to home or my-orders
              this.router.navigate(['/']);
            }
          }, 1000);
        } else {
          this.errorMessage = response.message || 'שגיאה בהתחברות';
        }
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Login error:', error);
        
        if (error.error && error.error.message) {
          this.errorMessage = error.error.message;
        } else if (error.status === 401) {
          this.errorMessage = 'אימייל או סיסמה שגויים';
        } else if (error.status === 0) {
          this.errorMessage = 'לא ניתן להתחבר לשרת. אנא בדוק את החיבור.';
        } else {
          this.errorMessage = 'שגיאה בהתחברות. אנא נסה שוב.';
        }
        
        this.isLoading = false;
      }
    });
  }

  onSignUp(): void {
    // Reset errors
    this.errorMessage = '';
    this.successMessage = '';
    this.errors = {};

    // Validate
    if (!this.registerCredentials.fullName || !this.registerCredentials.username || 
        !this.registerCredentials.phone || !this.registerCredentials.password) {
      if (!this.registerCredentials.fullName) {
        this.errors.fullName = 'שם מלא נדרש';
      }
      if (!this.registerCredentials.username) {
        this.errors.username = 'אימייל נדרש';
      }
      if (!this.registerCredentials.phone) {
        this.errors.phone = 'טלפון נדרש';
      }
      if (!this.registerCredentials.password) {
        this.errors.password = 'סיסמה נדרשת';
      } else if (this.registerCredentials.password.length < 3) {
        this.errors.password = 'סיסמה חייבת להכיל לפחות 3 תווים';
      }
      return;
    }

    this.isLoading = true;

    // Force role to 'user' for registration
    this.authService.register(this.registerCredentials).subscribe({
      next: (response) => {
        if (response.success) {
          this.successMessage = 'הרשמה בוצעה בהצלחה! ברוך הבא למגדים קייטרינג';
          // Smart redirection - new users always go to home
          setTimeout(() => {
            this.router.navigate(['/']);
          }, 1500);
        } else {
          this.errorMessage = response.message || 'שגיאה בהרשמה';
        }
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Registration error:', error);
        
        if (error.error && error.error.message) {
          this.errorMessage = error.error.message;
        } else if (error.status === 400) {
          this.errorMessage = 'פרטים שגויים. אנא בדוק את הטופס.';
        } else if (error.status === 0) {
          this.errorMessage = 'לא ניתן להתחבר לשרת. אנא בדוק את החיבור.';
        } else {
          this.errorMessage = 'שגיאה בהרשמה. אנא נסה שוב.';
        }
        
        this.isLoading = false;
      }
    });
  }

  onLogout(): void {
    this.isLoading = true;
    this.authService.logout();
    this.isLoggedIn = false;
    this.currentUser = null;
    this.isLoading = false;
    this.successMessage = 'התנתקת בהצלחה';
    setTimeout(() => {
      this.successMessage = '';
    }, 3000);
  }
}

