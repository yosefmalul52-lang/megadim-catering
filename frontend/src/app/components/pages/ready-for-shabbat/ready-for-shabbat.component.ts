import { Component, inject, OnInit, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ActivatedRoute, Router, ParamMap, RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { SaladsComponent } from './salads/salads.component';
import { FishComponent } from './fish/fish.component';
import { MainDishesComponent } from './main-dishes/main-dishes.component';
import { SideDishesComponent } from './side-dishes/side-dishes.component';
import { DessertsComponent } from './desserts/desserts.component';

@Component({
  selector: 'app-ready-for-shabbat',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    RouterModule,
    MatIconModule,
    MatButtonModule,
    SaladsComponent,
    FishComponent,
    MainDishesComponent,
    SideDishesComponent,
    DessertsComponent
  ],
  templateUrl: './ready-for-shabbat.component.html',
  styleUrls: ['./ready-for-shabbat.component.scss']
})
export class ReadyForShabbatComponent implements OnInit, AfterViewInit {
  translateService = inject(TranslateService);
  route = inject(ActivatedRoute);
  router = inject(Router);
  
  // Current category ID from route (null = Master view, string = Detail view)
  currentCategoryId: string | null = null;
  
  // Current category data for Detail view
  currentCategoryData: any = null;
  
  // All categories with their metadata
  allCategories = [
    { 
      id: 'salads', 
      nameKey: 'CATEGORIES.SALADS', 
      title: 'סלטים',
      image: 'https://res.cloudinary.com/dioklg7lx/image/upload/v1768237285/Salads-category_qyrqyf.png',
      component: 'salads'
    },
    { 
      id: 'fish', 
      nameKey: 'CATEGORIES.FISH', 
      title: 'דגים',
      image: 'https://res.cloudinary.com/dioklg7lx/image/upload/v1768906619/IMG_9719_mmhoct.jpg',
      component: 'fish'
    },
    { 
      id: 'main', 
      nameKey: 'CATEGORIES.MAIN', 
      title: 'מנות עיקריות',
      image: 'https://res.cloudinary.com/dioklg7lx/image/upload/v1768906615/IMG_9690_u75cnk.jpg',
      component: 'main-dishes'
    },
    { 
      id: 'sides', 
      nameKey: 'CATEGORIES.SIDES', 
      title: 'תוספות',
      image: 'https://res.cloudinary.com/dioklg7lx/image/upload/v1768906623/IMG_9705_voigt1.jpg',
      component: 'side-dishes'
    },
    { 
      id: 'desserts', 
      nameKey: 'CATEGORIES.DESSERTS', 
      title: 'ממולאים',
      image: 'https://res.cloudinary.com/dioklg7lx/image/upload/v1768169598/magadim-catering/zvaljwkf37merstx1wmx.jpg',
      component: 'desserts'
    },
    { 
      id: 'desserts-new', 
      nameKey: 'CATEGORIES.DESSERTS_NEW', 
      title: 'קינוחים',
      image: 'assets/images/desserts.jpg',
      component: 'desserts'
    }
  ];
  
  // For backward compatibility
  get categories() {
    return this.allCategories;
  }

  ngOnInit(): void {
    // Listen for route params to determine Master/Detail mode
    this.route.paramMap.subscribe((params: ParamMap) => {
      const categoryId = params.get('categoryId');
      
      if (categoryId) {
        // Detail View Mode
        this.currentCategoryId = categoryId;
        // Find the category data
        const category = this.allCategories.find(cat => cat.id === categoryId);
        
        // Handle aliases
        if (!category) {
          const aliasMap: { [key: string]: string } = {
            'main-dishes': 'main',
            'side-dishes': 'sides',
            'mains': 'main'
          };
          const mappedId = aliasMap[categoryId];
          if (mappedId) {
            const mappedCategory = this.allCategories.find(cat => cat.id === mappedId);
            if (mappedCategory) {
              this.currentCategoryData = mappedCategory;
              return;
            }
          }
        }
        
        if (category) {
          this.currentCategoryData = category;
        } else {
          // Invalid category, redirect to master view
          this.router.navigate(['/ready-for-shabbat']);
        }
      } else {
        // Master View Mode
        this.currentCategoryId = null;
        this.currentCategoryData = null;
      }
    });

    // Listen for query params to scroll to section (for Master view)
    this.route.queryParams.subscribe(params => {
      if (params['section'] && !this.currentCategoryId) {
        setTimeout(() => {
          const element = document.getElementById(params['section']);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 300);
      }
    });
  }

  ngAfterViewInit(): void {
    // Additional check after view init to ensure DOM is fully rendered
    this.route.queryParams.subscribe(params => {
      if (params['section'] && !this.currentCategoryId) {
        setTimeout(() => {
          const element = document.getElementById(params['section']);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 500);
      }
    });
  }

  scrollTo(elementId: string): void {
    const element = document.getElementById(elementId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
  
  getComponentName(categoryId: string): string {
    const category = this.allCategories.find(cat => cat.id === categoryId);
    return category?.component || '';
  }
}
