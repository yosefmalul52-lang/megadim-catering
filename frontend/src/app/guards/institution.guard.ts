import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { filter, take, map } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';

/** Only authenticated users with role `institution` may access `/portal`. */
export const institutionGuard: CanActivateFn = () => {
  const router = inject(Router);
  const authService = inject(AuthService);

  return authService.sessionInitDone$.pipe(
    filter((done) => done),
    take(1),
    map(() => {
      if (!authService.isLoggedIn()) {
        router.navigate(['/login'], { queryParams: { returnUrl: '/portal' } });
        return false;
      }
      if (authService.currentUser?.role === 'institution') {
        return true;
      }
      router.navigate(['/']);
      return false;
    })
  );
};
