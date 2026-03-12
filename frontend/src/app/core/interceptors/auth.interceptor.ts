import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';

const SESSION_EXPIRED_MESSAGE = 'החיבור שלך פג תוקף, אנא התחבר מחדש';

/**
 * HTTP Interceptor: sends cookies with requests (withCredentials: true).
 * On 401/403: logs out, shows toast, and rethrows.
 */
export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
) => {
  const authService = inject(AuthService);
  const toastService = inject(ToastService);

  const reqToSend = req.clone({ withCredentials: true });

  return next(reqToSend).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse && (err.status === 401 || err.status === 403)) {
        const isSessionCheck = req.url.includes('/auth/me');
        if (!isSessionCheck) {
          authService.logout();
          toastService.warning(SESSION_EXPIRED_MESSAGE);
        }
      }
      return throwError(() => err);
    })
  );
};

