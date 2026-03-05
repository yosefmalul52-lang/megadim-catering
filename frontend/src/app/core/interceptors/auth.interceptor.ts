import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';

const SESSION_EXPIRED_MESSAGE = 'החיבור שלך פג תוקף, אנא התחבר מחדש';

/**
 * HTTP Interceptor that:
 * 1. Attaches JWT to outgoing requests (Authorization: Bearer <token>)
 * 2. On 401/403: logs out, shows toast, and rethrows (AuthService.logout() redirects to login)
 */
export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
) => {
  const authService = inject(AuthService);
  const toastService = inject(ToastService);

  const token = localStorage.getItem('auth_token');
  const reqToSend = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(reqToSend).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse && (err.status === 401 || err.status === 403)) {
        authService.logout();
        toastService.warning(SESSION_EXPIRED_MESSAGE);
      }
      return throwError(() => err);
    })
  );
};

