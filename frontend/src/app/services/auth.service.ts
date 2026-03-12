import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError, of } from 'rxjs';
import { tap, catchError, map, take } from 'rxjs/operators';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  message?: string;
  token?: string; // Not sent when using HttpOnly cookie
  user: User;
}

export interface User {
  id: string;
  username: string;
  role: string;
  name?: string;
  fullName?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
}

export interface RegisterCredentials {
  fullName: string;
  username: string; // Email
  password: string;
  phone?: string;
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
  private apiUrl = environment.apiUrl;
  
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  private isLoggedInSubject = new BehaviorSubject<boolean>(false);
  public isLoggedIn$ = this.isLoggedInSubject.asObservable();

  /** Emits true once the initial session check (GET /auth/me) has completed. Used by guards to wait before deciding. */
  private sessionInitDoneSubject = new BehaviorSubject<boolean>(false);
  public sessionInitDone$ = this.sessionInitDoneSubject.asObservable();

  get currentUser(): User | null {
    return this.currentUserSubject.value;
  }

  constructor(
    private http: HttpClient,
    private router: Router
  ) {}

  /**
   * Verify session with backend (GET /auth/me). Updates currentUser and isLoggedIn.
   * On 401 or error, clears state gracefully. Completes without throwing.
   * Use in APP_INITIALIZER so the app waits for session rehydration before routing.
   */
  verifySession(): Observable<void> {
    return this.http.get<{ success: boolean; user?: User }>(`${this.apiUrl}/auth/me`, { withCredentials: true }).pipe(
      tap((res) => {
        if (res?.success && res?.user) {
          this.currentUserSubject.next(res.user);
          this.isLoggedInSubject.next(true);
        } else {
          this.currentUserSubject.next(null);
          this.isLoggedInSubject.next(false);
        }
      }),
      catchError(() => {
        this.currentUserSubject.next(null);
        this.isLoggedInSubject.next(false);
        // Do not navigate or call logout() – session check 401 is expected for guests
        return of(undefined);
      }),
      tap(() => this.sessionInitDoneSubject.next(true)),
      map(() => undefined as void),
      take(1)
    );
  }

  /**
   * Login with username and password
   */
  login(credentials: LoginCredentials): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/auth/login`, credentials, { withCredentials: true })
      .pipe(
        tap(response => {
          if (response.success && response.user) {
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
   * Logout: clear legacy localStorage, clear cookie on server, clear in-memory state.
   */
  logout(): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
    }
    this.http.post(`${this.apiUrl}/auth/logout`, {}, { withCredentials: true }).subscribe({ next: () => {}, error: () => {} });
    this.isLoggedInSubject.next(false);
    this.currentUserSubject.next(null);
    this.router.navigate(['/login']);
  }

  /** True if current user is in memory (session from HttpOnly cookie + /auth/me). */
  isLoggedIn(): boolean {
    return this.currentUserSubject.value != null;
  }

  /** Current user from memory (no localStorage). */
  getUser(): User | null {
    return this.currentUserSubject.value;
  }

  /** Set current user (e.g. after employee login). Cookie is set by backend. */
  setCurrentUser(user: User | null): void {
    this.currentUserSubject.next(user);
    this.isLoggedInSubject.next(user != null);
  }

  /**
   * Register a new user
   */
  register(credentials: RegisterCredentials): Observable<RegisterResponse> {
    return this.http.post<RegisterResponse>(`${this.apiUrl}/auth/register`, credentials, { withCredentials: true })
      .pipe(
        tap(response => {
          if (response.success && response.user) {
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
   * Re-validate session with backend (/auth/me).
   */
  validateToken(): Observable<{ success: boolean; valid: boolean; user?: User }> {
    return this.http.get<{ success: boolean; user?: User }>(`${this.apiUrl}/auth/me`, { withCredentials: true }).pipe(
      tap(response => {
        if (response?.success && response?.user) {
          this.currentUserSubject.next(response.user);
        } else {
          this.currentUserSubject.next(null);
          this.isLoggedInSubject.next(false);
        }
      }),
      map(response => ({
        success: response?.success ?? false,
        valid: !!(response?.success && response?.user),
        user: response?.user
      })),
      catchError(() => {
        this.currentUserSubject.next(null);
        this.isLoggedInSubject.next(false);
        return throwError(() => new Error('Session invalid'));
      })
    );
  }
}
