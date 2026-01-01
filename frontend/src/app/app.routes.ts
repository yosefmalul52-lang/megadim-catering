import { Routes } from '@angular/router';

export const routes: Routes = [
  // Public Pages
  {
    path: '',
    loadComponent: () => import('./components/pages/home/home.component').then(m => m.HomeComponent)
  },
  {
    path: 'about',
    loadComponent: () => import('./components/pages/about/about.component').then(m => m.AboutComponent)
  },
  {
    path: 'events-catering',
    loadComponent: () => import('./components/pages/events-catering/events-catering.component').then(m => m.EventsCateringComponent)
  },
  {
    path: 'ready-for-shabbat',
    loadChildren: () => import('./components/pages/ready-for-shabbat/ready-for-shabbat.routes').then(m => m.readyForShabbatRoutes)
  },
  {
    path: 'shabbat',
    loadChildren: () => import('./components/pages/ready-for-shabbat/ready-for-shabbat.routes').then(m => m.readyForShabbatRoutes)
  },
  {
    path: 'cholent-bar',
    loadComponent: () => import('./components/pages/cholent-bar/cholent-bar.component').then(m => m.CholentBarComponent)
  },
  {
    path: 'holiday-food',
    loadComponent: () => import('./components/pages/holiday-food/holiday-food.component').then(m => m.HolidayFoodComponent)
  },
  {
    path: 'kosher',
    loadComponent: () => import('./components/pages/kosher-certificate/kosher-certificate.component').then(m => m.KosherCertificateComponent)
  },
  {
    path: 'contact',
    loadComponent: () => import('./components/pages/contact/contact.component').then(m => m.ContactComponent)
  },
  {
    path: 'my-orders',
    loadComponent: () => import('./components/pages/my-orders/my-orders.component').then(m => m.MyOrdersComponent),
    canActivate: [() => import('./guards/auth.guard').then(m => m.authGuard)]
  },
  
  // Auth Pages
  {
    path: 'login',
    loadComponent: () => import('./components/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'register',
    loadComponent: () => import('./components/pages/auth/register/register.component').then(m => m.RegisterComponent)
  },
  
  // Admin Dashboard (Protected with AuthGuard)
  {
    path: 'admin',
    loadChildren: () => import('./components/admin/admin.routes').then(m => m.adminRoutes),
    canActivate: [() => import('./guards/auth.guard').then(m => m.authGuard)]
  },
  
  // Fallback route
  {
    path: '**',
    redirectTo: ''
  }
];
