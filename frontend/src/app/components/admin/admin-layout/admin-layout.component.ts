import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet, ActivatedRoute, NavigationEnd } from '@angular/router';
import { filter, map } from 'rxjs/operators';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <div class="admin-layout" [class.sidebar-open]="sidebarOpen">
      <!-- Sidebar (Right side for RTL) -->
      <aside class="admin-sidebar">
        <div class="sidebar-header">
          <h2 class="sidebar-logo">
            <i class="fas fa-crown"></i>
            <span>Megadim Admin</span>
          </h2>
        </div>
        
        <nav class="sidebar-nav">
          <a 
            routerLink="/admin/dashboard" 
            routerLinkActive="active"
            [routerLinkActiveOptions]="{exact: true}"
            class="nav-link"
            (click)="closeSidebarOnMobile()"
          >
            <i class="fas fa-chart-line"></i>
            <span>לוח בקרה</span>
          </a>
          
          <a 
            routerLink="/admin/menu" 
            routerLinkActive="active"
            class="nav-link"
            (click)="closeSidebarOnMobile()"
          >
            <i class="fas fa-utensils"></i>
            <span>ניהול תפריט</span>
          </a>
          
          <a 
            routerLink="/admin/orders" 
            routerLinkActive="active"
            class="nav-link"
            (click)="closeSidebarOnMobile()"
          >
            <i class="fas fa-shopping-cart"></i>
            <span>הזמנות</span>
          </a>
          
          <a 
            routerLink="/admin/delivery" 
            routerLinkActive="active"
            class="nav-link"
            (click)="closeSidebarOnMobile()"
          >
            <i class="fas fa-truck"></i>
            <span>ניהול משלוחים</span>
          </a>
          
          <a 
            routerLink="/admin/shopping" 
            routerLinkActive="active"
            class="nav-link"
            (click)="closeSidebarOnMobile()"
          >
            <i class="fas fa-shopping-basket"></i>
            <span>רשימת קניות</span>
          </a>
          
          <a 
            routerLink="/admin/summaries" 
            routerLinkActive="active"
            class="nav-link"
            (click)="closeSidebarOnMobile()"
          >
            <i class="fas fa-comments"></i>
            <span>סיכומי שיחה</span>
          </a>
        </nav>
        
        <div class="sidebar-footer">
          <!-- Separator -->
          <div class="sidebar-separator"></div>
          
          <!-- View Site Link -->
          <a 
            href="/" 
            class="nav-link nav-link-site"
            (click)="closeSidebarOnMobile()"
            target="_self"
          >
            <i class="fas fa-globe"></i>
            <span>מעבר לאתר</span>
          </a>
          
          <!-- Separator -->
          <div class="sidebar-separator"></div>
          <button class="logout-btn" (click)="logout()" title="התנתק מהמערכת">
            <i class="fas fa-sign-out-alt"></i>
            <span>התנתק</span>
          </button>
        </div>
      </aside>
      
      <!-- Main Content Area -->
      <div class="admin-main">
        <!-- Header with Back Button -->
        <header class="admin-header">
          <div class="header-left">
            <button 
              class="hamburger-btn" 
              (click)="toggleSidebar()"
              aria-label="תפריט"
            >
              <i class="fas fa-bars"></i>
            </button>
            
            <button 
              *ngIf="showBackButton" 
              class="back-btn"
              (click)="goBack()"
              title="חזור"
            >
              <i class="fas fa-arrow-right"></i>
              <span>חזור</span>
            </button>
          </div>
          
          <h1 class="page-title">{{ pageTitle }}</h1>
        </header>
        
        <!-- Page Content -->
        <main class="admin-content">
          <router-outlet></router-outlet>
        </main>
      </div>
      
      <!-- Mobile Overlay -->
      <div 
        class="sidebar-overlay" 
        *ngIf="sidebarOpen"
        (click)="closeSidebar()"
      ></div>
    </div>
  `,
  styles: [`
    // Productivity-First Clean SaaS Theme Variables (Refined - Less Blue)
    $sidebar-bg: #1f2937; // Neutral Dark Charcoal (removes blue overload)
    $sidebar-text: #cbd5e1; // Light Gray
    $sidebar-active-bg: #374151; // Slightly lighter charcoal for active links
    $primary-blue: #3b82f6; // Calming Azure
    $text-dark: #0f172a; // Dark Slate
    $white: #ffffff;
    $bg-light: #f3f4f6; // Cool Light Gray
    $card-shadow: 0 1px 3px rgba(0, 0, 0, 0.1); // Very subtle shadow

    .admin-layout {
      display: flex;
      min-height: 100vh;
      background-color: $bg-light;
      direction: rtl;
    }

    // Sidebar (Right side for RTL) - Clean SaaS Style
    .admin-sidebar {
      width: 250px;
      background: $sidebar-bg; // Neutral Dark Charcoal (#1f2937)
      color: $sidebar-text; // Light Gray (#cbd5e1)
      display: flex;
      flex-direction: column;
      position: fixed;
      right: 0;
      top: 0;
      height: 100vh;
      z-index: 1000;
      box-shadow: 2px 0 10px rgba(0, 0, 0, 0.1);
      transition: transform 0.3s ease;
    }

    .sidebar-header {
      padding: 2rem 1.5rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }

    .sidebar-logo {
      margin: 0;
      font-size: 1.5rem;
      font-weight: 700;
      color: $white; // White for sidebar logo
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .sidebar-logo i {
      font-size: 1.75rem;
    }

    .sidebar-nav {
      flex: 1;
      padding: 1rem 0;
      overflow-y: auto;
    }

    .nav-link {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 1rem 1.5rem;
      color: $sidebar-text; // Light Gray (#cbd5e1)
      text-decoration: none;
      transition: all 0.2s ease;
      border-right: 3px solid transparent;
      font-weight: 500;
    }

    .nav-link:hover {
      background: $sidebar-active-bg; // #334155
      color: $white;
    }

    .nav-link.active {
      background: $sidebar-active-bg; // #334155 - Slightly lighter background
      color: $white;
      border-right-color: $primary-blue; // Left Border in Blue (#3b82f6)
      font-weight: 600;
    }

    .nav-link i {
      font-size: 1.25rem;
      width: 24px;
      text-align: center;
    }

    // View Site Link - Distinct styling
    .nav-link-site {
      border: 1px solid rgba(59, 130, 246, 0.3); // Blue border
      border-radius: 0.5rem;
      margin-bottom: 1rem;
      background: rgba(59, 130, 246, 0.1);
    }

    .nav-link-site:hover {
      background: rgba(59, 130, 246, 0.2);
      border-color: $primary-blue;
      color: $white;
    }

    // Separator
    .sidebar-separator {
      height: 1px;
      background: rgba(255, 255, 255, 0.1);
      margin: 1rem 0;
    }

    .sidebar-footer {
      padding: 1.5rem;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
    }

    .logout-btn {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.75rem;
      padding: 0.75rem 1rem;
      background: rgba(220, 53, 69, 0.2);
      color: #ff6b6b;
      border: 1px solid rgba(220, 53, 69, 0.3);
      border-radius: 0.5rem;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
    }

    .logout-btn:hover {
      background: rgba(220, 53, 69, 0.3);
      border-color: rgba(220, 53, 69, 0.5);
      transform: translateY(-2px);
    }

    // Main Content Area
    .admin-main {
      flex: 1;
      margin-right: 250px;
      display: flex;
      flex-direction: column;
      min-height: 100vh;
      transition: margin-right 0.3s ease;
    }

    // Header
    .admin-header {
      background: $white;
      padding: 1rem 2rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
      border-bottom: 1px solid #e0e0e0;
      position: sticky;
      top: 0;
      z-index: 100;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .hamburger-btn {
      display: none;
      background: none;
      border: none;
      color: $text-dark; // Dark Slate
      font-size: 1.5rem;
      cursor: pointer;
      padding: 0.5rem;
      border-radius: 0.5rem;
      transition: background 0.3s ease;
    }

    .hamburger-btn:hover {
      background: $bg-light;
    }

    .back-btn {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 1rem;
      background: $bg-light;
      color: $text-dark; // Dark Slate
      border: 1px solid #e0e0e0;
      border-radius: 0.5rem;
      font-size: 0.95rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
    }

    .back-btn:hover {
      background: $primary-blue; // Royal Blue
      color: $white;
      border-color: $primary-blue;
      transform: translateX(-2px);
    }

    .back-btn i {
      font-size: 0.875rem;
    }

    .page-title {
      margin: 0;
      font-size: 1.75rem;
      font-weight: 700;
      color: $text-dark; // Dark Slate (#0f172a)
      flex: 1;
      text-align: center;
      font-family: 'Inter', 'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }

    // Content Area
    .admin-content {
      flex: 1;
      padding: 2rem;
      overflow-y: auto;
    }

    // Mobile Overlay
    .sidebar-overlay {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      z-index: 999;
    }

    // Responsive Design
    @media (max-width: 768px) {
      .admin-sidebar {
        transform: translateX(100%);
      }

      .admin-layout.sidebar-open .admin-sidebar {
        transform: translateX(0);
      }

      .admin-main {
        margin-right: 0;
      }

      .hamburger-btn {
        display: block;
      }

      .sidebar-overlay {
        display: block;
      }

      .page-title {
        font-size: 1.25rem;
        text-align: right;
      }

      .admin-content {
        padding: 1rem;
      }
    }

    @media (max-width: 480px) {
      .admin-header {
        padding: 1rem;
      }

      .page-title {
        font-size: 1.1rem;
      }

      .back-btn span {
        display: none;
      }
    }
  `]
})
export class AdminLayoutComponent implements OnInit {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private location = inject(Location);
  private authService = inject(AuthService);

  sidebarOpen = false;
  pageTitle = 'לוח בקרה';
  showBackButton = false;
  userName: string | null = null;

  // Page titles mapping
  private pageTitles: { [key: string]: string } = {
    '/admin/dashboard': 'לוח בקרה',
    '/admin/menu': 'ניהול תפריט',
    '/admin/orders': 'הזמנות',
    '/admin/summaries': 'סיכומי שיחה'
  };

  ngOnInit(): void {
    // Get current user
    this.authService.currentUser$.subscribe(user => {
      this.userName = user?.username || null;
    });

    // Track route changes to update page title and back button
    this.router.events
      .pipe(
        filter(event => event instanceof NavigationEnd),
        map(() => this.router.url)
      )
      .subscribe((url: string) => {
        this.updatePageInfo(url);
      });

    // Initial page info
    this.updatePageInfo(this.router.url);
  }

  private updatePageInfo(url: string): void {
    // Extract the path after /admin
    const pathMatch = url.match(/\/admin(\/.*)?$/);
    const adminPath = pathMatch ? (pathMatch[1] || '/dashboard') : '/dashboard';
    
    // Set page title
    const fullPath = '/admin' + adminPath;
    this.pageTitle = this.pageTitles[fullPath] || this.pageTitles[adminPath] || 'לוח בקרה';

    // Show back button if not on dashboard
    this.showBackButton = adminPath !== '' && adminPath !== '/' && adminPath !== '/dashboard';
  }

  toggleSidebar(): void {
    this.sidebarOpen = !this.sidebarOpen;
  }

  closeSidebar(): void {
    this.sidebarOpen = false;
  }

  closeSidebarOnMobile(): void {
    if (window.innerWidth <= 768) {
      this.sidebarOpen = false;
    }
  }

  goBack(): void {
    this.location.back();
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/']);
  }
}

