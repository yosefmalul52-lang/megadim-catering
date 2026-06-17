import { Routes } from '@angular/router';

export const portalRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./portal-layout/portal-layout.component').then((m) => m.PortalLayoutComponent),
    canActivate: [
      () => import('../../guards/auth.guard').then((m) => m.authGuard),
      () => import('../../guards/institution.guard').then((m) => m.institutionGuard)
    ],
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./institution-dashboard/institution-dashboard.component').then(
            (m) => m.InstitutionDashboardComponent
          )
      }
    ]
  }
];
