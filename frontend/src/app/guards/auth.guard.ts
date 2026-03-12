import { inject } from '@angular/core';
import { Router, CanActivateFn, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { map, take, filter } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.sessionInitDone$.pipe(
    filter((done) => done),
    take(1),
    map(() => {
      if (authService.isLoggedIn()) {
        return true;
      }
      router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
      return false;
    })
  );
};

