import { Routes } from '@angular/router';

export const readyForShabbatRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./ready-for-shabbat.component').then(m => m.ReadyForShabbatComponent)
  },
  {
    path: ':categoryId',
    loadComponent: () => import('./ready-for-shabbat.component').then(m => m.ReadyForShabbatComponent)
  },
  // Detail routes for individual items (must come after category routes)
  {
    path: 'salads/:id',
    loadComponent: () => import('./salads/salad-detail/salad-detail.component').then(m => m.SaladDetailComponent)
  },
  // Legacy routes - kept for backward compatibility
  {
    path: 'main-dishes',
    loadComponent: () => import('./main-dishes/main-dishes.component').then(m => m.MainDishesComponent)
  },
  {
    path: 'sides',
    loadComponent: () => import('./side-dishes/side-dishes.component').then(m => m.SideDishesComponent)
  },
  {
    path: 'side-dishes',
    loadComponent: () => import('./side-dishes/side-dishes.component').then(m => m.SideDishesComponent)
  },
  {
    path: 'salads',
    loadComponent: () => import('./salads/salads.component').then(m => m.SaladsComponent)
  },
  {
    path: 'desserts',
    loadComponent: () => import('./desserts/desserts.component').then(m => m.DessertsComponent)
  },
  {
    path: 'fish',
    loadComponent: () => import('./fish/fish.component').then(m => m.FishComponent)
  }
];
