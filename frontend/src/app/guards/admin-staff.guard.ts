import { inject } from '@angular/core';
import { Router, CanActivateFn, RouterStateSnapshot } from '@angular/router';
import { filter, map, take } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';
import { ADMIN_STAFF_ROLES } from '../config/admin-staff-nav';

/**
 * After `authGuard`: only `admin` or `driver` may enter `/admin`.
 */
export const adminStaffGuard: CanActivateFn = (_route, state: RouterStateSnapshot) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.sessionInitDone$.pipe(
    filter((done) => done),
    take(1),
    map(() => {
      if (!authService.isLoggedIn()) {
        router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
        return false;
      }
      const role = authService.currentUser?.role;
      if (role && (ADMIN_STAFF_ROLES as readonly string[]).includes(role)) {
        return true;
      }
      router.navigate(['/']);
      return false;
    })
  );
};
