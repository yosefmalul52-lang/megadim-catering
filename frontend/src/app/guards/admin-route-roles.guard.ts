import { inject } from '@angular/core';
import { Router, CanActivateFn, ActivatedRouteSnapshot } from '@angular/router';
import { filter, map, take } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';

/**
 * Uses `route.data['adminRoles']` — list of roles allowed for this child route.
 * Defaults to `['admin']` if omitted.
 */
export const adminRouteRolesGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const allowed = (route.data['adminRoles'] as string[] | undefined) ?? ['admin'];

  return authService.sessionInitDone$.pipe(
    filter((done) => done),
    take(1),
    map(() => {
      const role = authService.currentUser?.role;
      if (role && allowed.includes(role)) {
        return true;
      }
      router.navigate([role === 'driver' ? '/admin/delivery' : '/admin/dashboard']);
      return false;
    })
  );
};
