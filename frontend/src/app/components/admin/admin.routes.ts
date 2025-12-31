import { Routes } from '@angular/router';
import { authGuard } from '../../guards/auth.guard';

export const adminRoutes: Routes = [
  // Redirect route - NO canActivate here (parent route already has it)
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full'
  },
  // Remove admin login route from here (it should be in main app.routes.ts)
  {
    path: 'dashboard',
    loadComponent: () => import('./dashboard/dashboard.component').then(m => m.AdminDashboardComponent),
    canActivate: [authGuard]
  },
  {
    path: 'summaries',
    loadComponent: () => import('./chat-summaries/chat-summaries.component').then(m => m.ChatSummariesComponent),
    canActivate: [authGuard]
  },
  {
    path: 'menu',
    loadComponent: () => import('./menu-management/menu-management.component').then(m => m.MenuManagementComponent),
    canActivate: [authGuard]
  },
  {
    path: 'orders',
    loadComponent: () => import('./admin-orders/admin-orders.component').then(m => m.AdminOrdersComponent),
    canActivate: [authGuard]
  }
];
