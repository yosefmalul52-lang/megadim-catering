import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { filter, take, map } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';
import { isInstitutionAllowedPath } from '../utils/auth-redirect';

/**
 * Blocks institution users from retail routes; sends them to /portal.
 * Use on home, cart, checkout, my-orders, and other B2C-only pages.
 */
export const institutionRetailRedirectGuard: CanActivateFn = (_route, state) => {
  const router = inject(Router);
  const authService = inject(AuthService);

  return authService.sessionInitDone$.pipe(
    filter((done) => done),
    take(1),
    map(() => {
      if (authService.currentUser?.role === 'institution' && !isInstitutionAllowedPath(state.url)) {
        router.navigate(['/portal']);
        return false;
      }
      return true;
    })
  );
};
