import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { filter, take, map } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';

export const employeeGuard: CanActivateFn = () => {
  const router = inject(Router);
  const authService = inject(AuthService);

  return authService.sessionInitDone$.pipe(
    filter((done) => done),
    take(1),
    map(() => {
      if (authService.isLoggedIn() && authService.currentUser?.role === 'employee') {
        return true;
      }
      router.navigate(['/employee-login']);
      return false;
    })
  );
};
