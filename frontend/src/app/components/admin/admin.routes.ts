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
        path: 'menu',
        loadComponent: () => import('./menu-management/menu-management.component').then(m => m.MenuManagementComponent)
      },
      {
        path: 'orders',
        loadComponent: () => import('./admin-orders/admin-orders.component').then(m => m.AdminOrdersComponent)
      },
      {
        path: 'customers',
        loadComponent: () => import('./admin-customers/admin-customers.component').then(m => m.AdminCustomersComponent)
      },
      {
        path: 'coupons',
        loadComponent: () => import('./admin-coupons/admin-coupons.component').then(m => m.AdminCouponsComponent)
      },
      {
        path: 'shipping',
        loadComponent: () => import('./shipping-management/shipping-management.component').then(m => m.ShippingManagementComponent)
      },
      {
        path: 'delivery',
        loadComponent: () => import('./delivery-management/delivery-management.component').then(m => m.DeliveryManagementComponent)
      },
      {
        path: 'delivery-pricing',
        loadComponent: () => import('./admin-delivery-pricing/admin-delivery-pricing.component').then(m => m.AdminDeliveryPricingComponent)
      },
      {
        path: 'shopping',
        loadComponent: () => import('./shopping-list/shopping-list.component').then(m => m.ShoppingListComponent)
      },
      {
        path: 'gallery',
        loadComponent: () => import('./unified-gallery/unified-gallery.component').then(m => m.UnifiedGalleryComponent)
      },
      {
        path: 'settings',
        loadComponent: () => import('./admin-settings/admin-settings.component').then(m => m.AdminSettingsComponent)
      }
    ]
  }
];
