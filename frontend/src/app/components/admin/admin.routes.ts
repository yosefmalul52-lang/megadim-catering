import { Routes } from '@angular/router';
import { authGuard } from '../../guards/auth.guard';

export const adminRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./admin-layout/admin-layout.component').then(m => m.AdminLayoutComponent),
    canActivate: [authGuard],
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full'
      },
      {
        path: 'dashboard',
        loadComponent: () => import('./dashboard/dashboard.component').then(m => m.AdminDashboardComponent)
      },
      {
        path: 'summaries',
        loadComponent: () => import('./chat-summaries/chat-summaries.component').then(m => m.ChatSummariesComponent)
      },
      {
        path: 'menu',
        loadComponent: () => import('./menu-management/menu-management.component').then(m => m.MenuManagementComponent)
      },
      {
        path: 'orders',
        loadComponent: () => import('./admin-orders/admin-orders.component').then(m => m.AdminOrdersComponent)
      },
      {
        path: 'delivery',
        loadComponent: () => import('./delivery-management/delivery-management.component').then(m => m.DeliveryManagementComponent)
      },
      {
        path: 'shopping',
        loadComponent: () => import('./shopping-list/shopping-list.component').then(m => m.ShoppingListComponent)
      }
    ]
  }
];
