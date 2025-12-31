import { Routes } from '@angular/router';

// Admin-only routes - should be served on a separate port (4201)
// Access the admin dashboard at: http://localhost:4201
export const adminAppRoutes: Routes = [
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full'
  },
  {
    path: 'login',
    loadComponent: () => import('./components/admin/admin-login/admin-login.component').then(m => m.AdminLoginComponent)
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./components/admin/dashboard/dashboard.component').then(m => m.AdminDashboardComponent)
  },
  {
    path: 'summaries',
    loadComponent: () => import('./components/admin/chat-summaries/chat-summaries.component').then(m => m.ChatSummariesComponent)
  },
  {
    path: 'menu',
    loadComponent: () => import('./components/admin/menu-management/menu-management.component').then(m => m.MenuManagementComponent)
  },
  {
    path: 'orders',
    loadComponent: () => import('./components/admin/admin-orders/admin-orders.component').then(m => m.AdminOrdersComponent)
  },
  {
    path: '**',
    redirectTo: 'dashboard'
  }
];

