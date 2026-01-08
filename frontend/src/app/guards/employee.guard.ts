import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';

export const employeeGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);

  const token = localStorage.getItem('employee_token');
  const employeeData = localStorage.getItem('employee_data');

  // Check if employee token exists
  if (token && employeeData) {
    return true;
  }

  // Redirect to employee login
  router.navigate(['/employee-login']);
  return false;
};
