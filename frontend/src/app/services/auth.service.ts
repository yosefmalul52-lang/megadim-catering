import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  message: string;
  token: string;
  user: User;
}

export interface User {
  id: string;
  username: string;
  role: string;
  name?: string; // Optional name field for display (legacy)
  fullName?: string; // Full name for customers
  phone?: string; // Phone number
}

export interface RegisterCredentials {
  fullName: string;
  username: string; // Email
  phone: string;
  password: string;
  address?: string;
}

export interface RegisterResponse {
  success: boolean;
  message: string;
  token?: string;
  user?: User;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly TOKEN_KEY = 'auth_token';
  private readonly USER_KEY = 'auth_user';
  private apiUrl = environment.apiUrl;
  
  private isLoggedInSubject = new BehaviorSubject<boolean>(this.isLoggedIn());
  public isLoggedIn$ = this.isLoggedInSubject.asObservable();

  private currentUserSubject = new BehaviorSubject<User | null>(this.getUser());
  public currentUser$ = this.currentUserSubject.asObservable();
  
  // Getter for current user (synchronous)
  get currentUser(): User | null {
    return this.currentUserSubject.value;
  }

  constructor(
    private http: HttpClient,
    private router: Router
  ) {
    // Check if token is expired on service initialization
    this.checkTokenValidity();
  }

  /**
   * Login with username and password
   */
  login(credentials: LoginCredentials): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/auth/login`, credentials)
      .pipe(
        tap(response => {
          if (response.success && response.token) {
            this.setToken(response.token);
            this.setUser(response.user);
            this.isLoggedInSubject.next(true);
            this.currentUserSubject.next(response.user);
          }
        }),
        catchError(error => {
          console.error('Login error:', error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Logout - clear token and redirect to login
   */
  logout(): void {
    this.clearToken();
    this.clearUser();
    this.isLoggedInSubject.next(false);
    this.currentUserSubject.next(null);
    this.router.navigate(['/login']);
  }

  /**
   * Check if user is logged in
   */
  isLoggedIn(): boolean {
    const token = this.getToken();
    if (!token) {
      return false;
    }

    // Basic token expiration check (JWT tokens contain expiration)
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const expirationTime = payload.exp * 1000; // Convert to milliseconds
      
      if (Date.now() >= expirationTime) {
        // Token expired
        this.clearToken();
        this.clearUser();
        return false;
      }
      
      return true;
    } catch (error) {
      // Invalid token format
      this.clearToken();
      this.clearUser();
      return false;
    }
  }

  /**
   * Get the current token
   */
  getToken(): string | null {
    if (typeof window !== 'undefined' && window.localStorage) {
      return localStorage.getItem(this.TOKEN_KEY);
    }
    return null;
  }

  /**
   * Get the current user
   */
  getUser(): User | null {
    if (typeof window !== 'undefined' && window.localStorage) {
      const userStr = localStorage.getItem(this.USER_KEY);
      if (userStr) {
        try {
          return JSON.parse(userStr);
        } catch (error) {
          return null;
        }
      }
    }
    return null;
  }

  /**
   * Register a new user
   */
  register(credentials: RegisterCredentials): Observable<RegisterResponse> {
    return this.http.post<RegisterResponse>(`${this.apiUrl}/auth/register`, credentials)
      .pipe(
        tap(response => {
          if (response.success && response.token && response.user) {
            this.setToken(response.token);
            this.setUser(response.user);
            this.isLoggedInSubject.next(true);
            this.currentUserSubject.next(response.user);
          }
        }),
        catchError(error => {
          console.error('Register error:', error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Validate token with backend
   */
  validateToken(): Observable<{ success: boolean; valid: boolean; user?: User }> {
    const token = this.getToken();
    if (!token) {
      return throwError(() => new Error('No token available'));
    }

    return this.http.post<{ success: boolean; valid: boolean; user?: User }>(
      `${this.apiUrl}/auth/validate`,
      { token }
    ).pipe(
      tap(response => {
        if (!response.valid) {
          this.logout();
        } else if (response.user) {
          this.currentUserSubject.next(response.user);
        }
      }),
      catchError(error => {
        this.logout();
        return throwError(() => error);
      })
    );
  }

  /**
   * Private helper methods
   */
  private setToken(token: string): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(this.TOKEN_KEY, token);
    }
  }

  private clearToken(): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem(this.TOKEN_KEY);
    }
  }

  private setUser(user: User): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(this.USER_KEY, JSON.stringify(user));
    }
  }

  private clearUser(): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem(this.USER_KEY);
    }
  }

  private checkTokenValidity(): void {
    if (this.isLoggedIn()) {
      const user = this.getUser();
      if (user) {
        this.currentUserSubject.next(user);
      }
      // Optionally validate with backend on service init
      // this.validateToken().subscribe();
    } else {
      this.isLoggedInSubject.next(false);
      this.currentUserSubject.next(null);
    }
  }
}
