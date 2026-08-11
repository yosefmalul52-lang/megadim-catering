import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { filter, take } from 'rxjs/operators';
import { AuthService, LoginCredentials, RegisterCredentials } from '../../services/auth.service';
import { navigateAfterLogin } from '../../utils/auth-redirect';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LocaleService } from '../../i18n/locale.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TranslateModule],
  template: `
    <div class="login-container">
      <div class="login-card">
        <a [routerLink]="localeService.localizePath('/')" class="back-home-link"><i class="fa-solid fa-arrow-right"></i> {{ 'AUTH.BACK_HOME' | translate }}</a>
        <div class="login-header">
          <div class="logo-container">
            <h1 class="login-title">{{ 'AUTH.LOGIN_TITLE' | translate }}</h1>
            <p class="login-subtitle">{{ 'AUTH.LOGIN_SUB' | translate }}</p>
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
              <p class="user-name">{{ currentUser?.fullName || currentUser?.username || ('AUTH.LOGGED_IN_USER' | translate) }}</p>
              <p class="user-role">{{ roleLabel }}</p>
            </div>
          </div>
          <button
            type="button"
            class="btn-logout"
            (click)="onLogout()"
            [disabled]="isLoading"
          >
            <i class="fas fa-sign-out-alt" aria-hidden="true"></i>
            {{ 'AUTH.LOGOUT' | translate }}
          </button>
        </div>

        <!-- Login Form -->
        <form (ngSubmit)="onLogin(loginForm)" #loginForm="ngForm" class="login-form">
          <div class="form-group" [class.error]="errors.username || errorMessage">
            <label for="login-username" class="form-label">
              <i class="fas fa-envelope" aria-hidden="true"></i>
              {{ 'AUTH.EMAIL' | translate }}
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
              {{ 'AUTH.PASSWORD' | translate }}
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
                [placeholder]="'AUTH.PASSWORD_PLACEHOLDER' | translate"
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
              {{ 'AUTH.SUBMIT_LOGIN' | translate }}
            </span>
            <span *ngIf="isLoading">
              <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
              {{ 'AUTH.LOGGING_IN' | translate }}
            </span>
          </button>
          <p class="auth-footer">
            {{ 'AUTH.NO_ACCOUNT_CTA' | translate }} <a [routerLink]="localeService.localizePath('/register')" class="auth-footer-link">{{ 'AUTH.REGISTER_LINK' | translate }}</a>
          </p>
        </form>
      </div>
    </div>
  `,
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit {
  readonly localeService = inject(LocaleService);
  private translate = inject(TranslateService);

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

  get roleLabel(): string {
    const role = this.currentUser?.role;
    if (role === 'admin') return this.translate.instant('AUTH.ROLE_ADMIN');
    if (role === 'user') return this.translate.instant('AUTH.ROLE_CUSTOMER');
    return this.translate.instant('AUTH.ROLE_USER');
  }

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

    this.authService.sessionInitDone$
      .pipe(filter((done) => done), take(1))
      .subscribe(() => {
        if (this.authService.currentUser?.role === 'institution') {
          this.router.navigate(['/portal']);
        }
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
        this.errors.username = this.translate.instant('AUTH.EMAIL_REQUIRED');
      }
      if (!this.loginCredentials.password) {
        this.errors.password = this.translate.instant('AUTH.PASSWORD_REQUIRED');
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
          
          // Smart redirection based on user role (immediate — no retail flash for institutions)
          navigateAfterLogin(this.router, response.user?.role);
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
        this.errors.username = this.translate.instant('AUTH.EMAIL_REQUIRED');
      }
      if (!this.registerCredentials.phone) {
        this.errors.phone = 'טלפון נדרש';
      }
      if (!this.registerCredentials.password) {
        this.errors.password = this.translate.instant('AUTH.PASSWORD_REQUIRED');
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

