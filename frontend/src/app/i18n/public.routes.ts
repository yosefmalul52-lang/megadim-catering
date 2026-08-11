import { Routes } from '@angular/router';

const retailBlock = () =>
  import('../guards/institution-retail-redirect.guard').then((m) => m.institutionRetailRedirectGuard);

/**
 * Public customer-facing routes (Hebrew root and /en children share this tree).
 * Excludes admin, portal, employee, and time-clock.
 */
export const PUBLIC_ROUTES: Routes = [
  {
    path: '',
    canActivate: [retailBlock],
    loadComponent: () => import('../components/pages/home/home.component').then((m) => m.HomeComponent)
  },
  {
    path: 'about',
    loadComponent: () =>
      import('../components/pages/about-page/about-page.component').then((m) => m.AboutPageComponent)
  },
  {
    path: 'events-catering',
    loadComponent: () =>
      import('../components/pages/events-catering/events-catering.component').then(
        (m) => m.EventsCateringComponent
      )
  },
  {
    path: 'catering',
    loadComponent: () =>
      import('../components/pages/events-catering/events-catering.component').then(
        (m) => m.EventsCateringComponent
      )
  },
  {
    path: 'ready-for-shabbat',
    loadChildren: () =>
      import('../components/pages/ready-for-shabbat/ready-for-shabbat.routes').then(
        (m) => m.readyForShabbatRoutes
      )
  },
  {
    path: 'ready-food',
    loadChildren: () =>
      import('../components/pages/ready-for-shabbat/ready-for-shabbat.routes').then(
        (m) => m.readyForShabbatRoutes
      )
  },
  {
    path: 'shabbat',
    loadChildren: () =>
      import('../components/pages/ready-for-shabbat/ready-for-shabbat.routes').then(
        (m) => m.readyForShabbatRoutes
      )
  },
  {
    path: 'shabbat-events',
    loadComponent: () =>
      import('../components/pages/holiday-food/holiday-food.component').then((m) => m.HolidayFoodComponent)
  },
  {
    path: 'cholent-bar',
    loadComponent: () =>
      import('../components/pages/cholent-bar/cholent-bar.component').then((m) => m.CholentBarComponent)
  },
  {
    path: 'cholent',
    loadComponent: () =>
      import('../components/pages/cholent-bar/cholent-bar.component').then((m) => m.CholentBarComponent)
  },
  {
    path: 'holiday-food',
    loadComponent: () =>
      import('../components/pages/holiday-food/holiday-food.component').then((m) => m.HolidayFoodComponent)
  },
  {
    path: 'holiday',
    loadComponent: () =>
      import('../components/pages/holiday-food/holiday-food.component').then((m) => m.HolidayFoodComponent)
  },
  {
    path: 'kosher',
    loadComponent: () =>
      import('../components/pages/kosher-certificate/kosher-certificate.component').then(
        (m) => m.KosherCertificateComponent
      )
  },
  {
    path: 'contact',
    loadComponent: () =>
      import('../components/pages/contact/contact.component').then((m) => m.ContactComponent)
  },
  {
    path: 'cart',
    canActivate: [retailBlock],
    loadComponent: () =>
      import('../components/pages/cart-page/cart-page.component').then((m) => m.CartPageComponent)
  },
  {
    path: 'checkout',
    canActivate: [retailBlock],
    loadComponent: () =>
      import('../components/pages/checkout-page/checkout-page.component').then(
        (m) => m.CheckoutPageComponent
      )
  },
  {
    path: 'order-confirmation/:id',
    loadComponent: () =>
      import('../components/pages/order-confirmation/order-confirmation.component').then(
        (m) => m.OrderConfirmationComponent
      )
  },
  {
    path: 'my-orders',
    canActivate: [retailBlock, () => import('../guards/auth.guard').then((m) => m.authGuard)],
    loadComponent: () =>
      import('../components/pages/my-orders/my-orders.component').then((m) => m.MyOrdersComponent)
  },
  {
    path: 'my-account',
    canActivate: [retailBlock, () => import('../guards/auth.guard').then((m) => m.authGuard)],
    loadComponent: () =>
      import('@app/components/pages/user-profile/user-profile.component').then(
        (m) => m.UserProfileComponent
      )
  },
  {
    path: 'profile',
    redirectTo: 'my-account',
    pathMatch: 'full'
  },
  {
    path: 'login',
    loadComponent: () => import('../components/login/login.component').then((m) => m.LoginComponent)
  },
  {
    path: 'register',
    loadComponent: () =>
      import('../components/pages/auth/register/register.component').then((m) => m.RegisterComponent)
  },
  {
    path: 'terms',
    loadComponent: () =>
      import('../components/pages/terms/terms.component').then((m) => m.TermsComponent)
  },
  {
    path: 'accessibility',
    loadComponent: () =>
      import('../components/pages/accessibility/accessibility.component').then(
        (m) => m.AccessibilityComponent
      )
  },
  {
    path: 'privacy-policy',
    loadComponent: () =>
      import('../components/pages/privacy-policy/privacy-policy.component').then(
        (m) => m.PrivacyPolicyComponent
      )
  }
];
