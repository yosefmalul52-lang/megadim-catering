import { Routes } from '@angular/router';

export const readyForShabbatRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./ready-for-shabbat.component').then(m => m.ReadyForShabbatComponent),
    children: [
      // Landing page: Show category navigation menu
      {
        path: '',
        loadComponent: () => import('./shabbat-menu/shabbat-menu.component').then(m => m.ShabbatMenuComponent)
      },
      // Category routes - SHORT URL paths (canonical)
      {
        path: 'main',
        loadComponent: () => import('./main-dishes/main-dishes.component').then(m => m.MainDishesComponent)
      },
      {
        path: 'fish',
        loadComponent: () => import('./fish/fish.component').then(m => m.FishComponent)
      },
      {
        path: 'salads',
        loadComponent: () => import('./salads/salads.component').then(m => m.SaladsComponent)
      },
      {
        path: 'sides',
        loadComponent: () => import('./side-dishes/side-dishes.component').then(m => m.SideDishesComponent)
      },
      {
        path: 'desserts',
        loadComponent: () => import('./desserts/desserts.component').then(m => m.DessertsComponent)
      },
      {
        path: 'stuffed',
        loadComponent: () => import('./stuffed/stuffed.component').then(m => m.StuffedComponent)
      },
      {
        path: 'desserts-new',
        redirectTo: 'desserts',
        pathMatch: 'full'
      },
      // Backward compatibility - redirect old paths to new short paths
      {
        path: 'main-dishes',
        redirectTo: 'main',
        pathMatch: 'full'
      },
      {
        path: 'side-dishes',
        redirectTo: 'sides',
        pathMatch: 'full'
      },
      // Detail routes for individual items (must come after category routes)
      // Using SHORT paths for consistency
      {
        path: 'main/:id',
        loadComponent: () => import('./product-details/product-details.component').then(m => m.ProductDetailsComponent),
        data: { category: 'main' }
      },
      {
        path: 'fish/:id',
        loadComponent: () => import('./product-details/product-details.component').then(m => m.ProductDetailsComponent),
        data: { category: 'fish' }
      },
      {
        path: 'salads/:id',
        loadComponent: () => import('./salads/salad-detail/salad-detail.component').then(m => m.SaladDetailComponent)
      },
      {
        path: 'sides/:id',
        loadComponent: () => import('./product-details/product-details.component').then(m => m.ProductDetailsComponent),
        data: { category: 'sides' }
      },
      {
        path: 'desserts/:id',
        loadComponent: () => import('./product-details/product-details.component').then(m => m.ProductDetailsComponent),
        data: { category: 'desserts' }
      },
      {
        path: 'stuffed/:id',
        loadComponent: () => import('./product-details/product-details.component').then(m => m.ProductDetailsComponent),
        data: { category: 'stuffed' }
      },
      // Backward compatibility - old detail paths
      {
        path: 'main-dishes/:id',
        loadComponent: () => import('./product-details/product-details.component').then(m => m.ProductDetailsComponent),
        data: { category: 'main' }
      },
      {
        path: 'side-dishes/:id',
        loadComponent: () => import('./product-details/product-details.component').then(m => m.ProductDetailsComponent),
        data: { category: 'sides' }
      },
      // Universal product route - catches any product ID (must be last)
      {
        path: 'product/:id',
        loadComponent: () => import('./product-details/product-details.component').then(m => m.ProductDetailsComponent)
      }
    ]
  }
];
