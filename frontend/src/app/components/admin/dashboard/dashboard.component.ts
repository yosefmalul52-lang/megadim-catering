import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="admin-dashboard">
      <div class="container">
        <h1>לוח בקרת מנהל</h1>
        <p>ניהול תפריטים, הזמנות ועדכונים</p>
        <div class="admin-grid">
          <a routerLink="/admin/menu" class="admin-card link-card">
            <div class="card-icon">
              <i class="fas fa-utensils"></i>
            </div>
            <h3>ניהול תפריט</h3>
            <p>הוסף ועדכן פריטי תפריט</p>
          </a>
          <a routerLink="/admin/orders" class="admin-card link-card">
            <div class="card-icon">
              <i class="fas fa-shopping-cart"></i>
            </div>
            <h3>הזמנות</h3>
            <p>צפה בהזמנות האחרונות</p>
          </a>
          <div class="admin-card">
            <div class="card-icon">
              <i class="fas fa-star"></i>
            </div>
            <h3>המלצות לקוחות</h3>
            <p>נהל המלצות לקוחות</p>
          </div>
        </div>
      </div>
      
      <!-- Logout Button -->
      <div class="logout-section">
        <button class="logout-btn" (click)="logout()" title="התנתק מהמערכת">
          <i class="fas fa-sign-out-alt" aria-hidden="true"></i>
          <span>התנתק</span>
        </button>
      </div>
    </div>
  `,
  styles: [`
    .admin-dashboard {
      padding: 2rem 0;
      min-height: 60vh;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 2rem;
    }
    h1 {
      color: #0E1A24;
      margin-bottom: 1rem;
      text-align: center;
    }
    p {
      text-align: center;
      color: #6c757d;
      margin-bottom: 3rem;
    }
    .admin-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 2rem;
    }
    .admin-card {
      background: white;
      padding: 2rem;
      border-radius: 0.75rem;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      text-align: center;
      text-decoration: none;
      color: inherit;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
      transition: transform 0.3s ease, box-shadow 0.3s ease;
      cursor: pointer;
    }
    .admin-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 12px rgba(0, 0, 0, 0.15);
    }
    .admin-card h3 {
      color: #0E1A24;
      margin: 0;
    }
    .admin-card p {
      color: #6c757d;
      margin: 0;
    }
    .card-icon {
      width: 80px;
      height: 80px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f5f5f5;
      border-radius: 50%;
      margin-bottom: 1rem;
    }
    .admin-card i {
      font-size: 2.5rem;
      color: #1f3444;
    }
    .link-card {
      border: 2px solid #1f3444;
    }
    .link-card:hover {
      background: #f8f9fa;
      border-color: #2a4a5f;
    }
    
    .logout-section {
      margin-top: 3rem;
      display: flex;
      justify-content: center;
      padding-top: 2rem;
      border-top: 1px solid #e0e0e0;
    }
    
    .logout-btn {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem 1.5rem;
      background-color: #6c757d;
      color: white;
      border: none;
      border-radius: 0.5rem;
      font-size: 1rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.3s ease;
      font-family: inherit;
    }
    
    .logout-btn:hover {
      background-color: #dc3545;
      transform: translateY(-2px);
      box-shadow: 0 4px 8px rgba(220, 53, 69, 0.3);
    }
    
    .logout-btn:active {
      transform: translateY(0);
    }
    
    .logout-btn i {
      font-size: 1.1rem;
    }
  `]
})
export class AdminDashboardComponent {
  private authService = inject(AuthService);
  private router = inject(Router);

  logout(): void {
    // Clear authentication
    this.authService.logout();
    // Navigate to home page (override the default /login navigation)
    this.router.navigate(['/']);
  }
}
