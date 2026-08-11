import { Routes } from '@angular/router';
import { PUBLIC_ROUTES } from './i18n/public.routes';

/**
 * Hebrew public routes stay at the root (SEO-preserving).
 * English mirrors the same tree under /en/...
 * Admin / portal / employee / kiosk stay outside locale prefixes.
 */
export const routes: Routes = [
  // Time Clock Kiosk (always Hebrew)
  {
    path: 'time-clock',
    loadComponent: () =>
      import('./components/kiosk/time-clock/time-clock.component').then((m) => m.TimeClockComponent)
  },

  // Employee Self-Service (always Hebrew)
  {
    path: 'employee-login',
    loadComponent: () =>
      import('./components/employee/employee-login/employee-login.component').then(
        (m) => m.EmployeeLoginComponent
      )
  },
  {
    path: 'my-zone',
    loadComponent: () =>
      import('./components/employee/my-zone/my-zone.component').then((m) => m.MyZoneComponent),
    canActivate: [() => import('./guards/employee.guard').then((m) => m.employeeGuard)]
  },

  // Institution B2B Portal (always Hebrew shell)
  {
    path: 'portal',
    loadChildren: () => import('./components/portal/portal.routes').then((m) => m.portalRoutes)
  },

  // Admin Dashboard (always Hebrew)
  {
    path: 'admin',
    loadChildren: () => import('./components/admin/admin.routes').then((m) => m.adminRoutes),
    canActivate: [() => import('./guards/auth.guard').then((m) => m.authGuard)]
  },

  // English public site
  {
    path: 'en',
    children: PUBLIC_ROUTES
  },

  // Hebrew public site (default, unprefixed)
  ...PUBLIC_ROUTES,

  {
    path: '**',
    redirectTo: ''
  }
];
