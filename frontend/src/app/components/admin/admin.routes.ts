import { Routes } from '@angular/router';
import { authGuard } from '../../guards/auth.guard';
import { adminStaffGuard } from '../../guards/admin-staff.guard';
import { adminRouteRolesGuard } from '../../guards/admin-route-roles.guard';

const AD = ['admin'] as const;
const AD_DR = ['admin', 'driver'] as const;

export const adminRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./admin-layout/admin-layout.component').then(m => m.AdminLayoutComponent),
    canActivate: [authGuard, adminStaffGuard],
    children: [
      {
        path: '',
        redirectTo: 'delivery',
        pathMatch: 'full'
      },
      {
        path: 'dashboard',
        canActivate: [adminRouteRolesGuard],
        data: { adminRoles: [...AD] },
        loadComponent: () => import('./dashboard/dashboard.component').then(m => m.AdminDashboardComponent)
      },
      {
        path: 'menu',
        canActivate: [adminRouteRolesGuard],
        data: { adminRoles: [...AD] },
        loadComponent: () => import('./menu-management/menu-management.component').then(m => m.MenuManagementComponent)
      },
      {
        path: 'orders',
        canActivate: [adminRouteRolesGuard],
        data: { adminRoles: [...AD] },
        loadComponent: () => import('./admin-orders/admin-orders.component').then(m => m.AdminOrdersComponent)
      },
      {
        path: 'leads',
        canActivate: [adminRouteRolesGuard],
        data: { adminRoles: [...AD] },
        loadComponent: () => import('./admin-leads/admin-leads.component').then(m => m.AdminLeadsComponent)
      },
      {
        path: 'marketing',
        canActivate: [adminRouteRolesGuard],
        data: { adminRoles: [...AD] },
        loadComponent: () => import('./admin-marketing/admin-marketing.component').then(m => m.AdminMarketingComponent)
      },
      {
        path: 'customers',
        canActivate: [adminRouteRolesGuard],
        data: { adminRoles: [...AD] },
        loadComponent: () => import('./admin-customers/admin-customers.component').then(m => m.AdminCustomersComponent)
      },
      {
        path: 'coupons',
        canActivate: [adminRouteRolesGuard],
        data: { adminRoles: [...AD] },
        loadComponent: () => import('./admin-coupons/admin-coupons.component').then(m => m.AdminCouponsComponent)
      },
      {
        path: 'shipping',
        canActivate: [adminRouteRolesGuard],
        data: { adminRoles: [...AD] },
        loadComponent: () => import('./shipping-management/shipping-management.component').then(m => m.ShippingManagementComponent)
      },
      {
        path: 'delivery',
        canActivate: [adminRouteRolesGuard],
        data: { adminRoles: [...AD_DR] },
        loadComponent: () => import('./delivery-management/delivery-management.component').then(m => m.DeliveryManagementComponent)
      },
      {
        path: 'delivery-pricing',
        canActivate: [adminRouteRolesGuard],
        data: { adminRoles: [...AD] },
        loadComponent: () => import('./admin-delivery-pricing/admin-delivery-pricing.component').then(m => m.AdminDeliveryPricingComponent)
      },
      {
        path: 'shopping',
        canActivate: [adminRouteRolesGuard],
        data: { adminRoles: [...AD] },
        loadComponent: () => import('./shopping-list/shopping-list.component').then(m => m.ShoppingListComponent)
      },
      {
        path: 'gallery',
        canActivate: [adminRouteRolesGuard],
        data: { adminRoles: [...AD] },
        loadComponent: () => import('./unified-gallery/unified-gallery.component').then(m => m.UnifiedGalleryComponent)
      },
      {
        path: 'settings',
        canActivate: [adminRouteRolesGuard],
        data: { adminRoles: [...AD] },
        loadComponent: () => import('./admin-settings/admin-settings.component').then(m => m.AdminSettingsComponent)
      }
    ]
  }
];
