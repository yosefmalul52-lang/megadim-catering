import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-ready-for-shabbat',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="page">
      <div class="container">
        <h1>אוכל מוכן לשבת</h1>
        <p>מנות ביתיות מוכנות לשבת קודש - נוח, טעים ומוכן להגשה</p>
        
        <div class="categories-grid">
          <div class="category-card">
            <h3>מנות עיקריות</h3>
            <p>דגים, בשר ועוף מבושל ברמה גבוהה</p>
            <a routerLink="/ready-for-shabbat/main-dishes" class="btn btn-primary">צפה במנות</a>
          </div>
          
          <div class="category-card">
            <h3>תוספות</h3>
            <p>אורז, תבשילי ירקות וקוגל</p>
            <a routerLink="/ready-for-shabbat/side-dishes" class="btn btn-primary">צפה בתוספות</a>
          </div>
          
          <div class="category-card">
            <h3>סלטים</h3>
            <p>סלטים טריים ומגוונים לשבת</p>
            <a routerLink="/ready-for-shabbat/salads" class="btn btn-primary">צפה בסלטים</a>
          </div>
          
          <div class="category-card">
            <h3>קינוחים</h3>
            <p>עוגות וקינוחים מתוקים לשבת</p>
            <a routerLink="/ready-for-shabbat/desserts" class="btn btn-primary">צפה בקינוחים</a>
          </div>
          
          <div class="category-card">
            <h3>דגים</h3>
            <p>דגים טריים ומעולים לשבת וחג</p>
            <a routerLink="/ready-for-shabbat/fish" class="btn btn-primary">צפה בדגים</a>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .page {
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
      font-size: 1.1rem;
    }
    
    .categories-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 2rem;
    }
    
    .category-card {
      background: white;
      padding: 2rem;
      border-radius: 0.75rem;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      text-align: center;
      transition: transform 0.3s ease;
    }
    
    .category-card:hover {
      transform: translateY(-4px);
    }
    
    .category-card h3 {
      color: #0E1A24;
      margin-bottom: 1rem;
      font-size: 1.5rem;
    }
    
    .category-card p {
      color: #6c757d;
      margin-bottom: 1.5rem;
      text-align: center;
    }
    
    .btn {
      display: inline-block;
      padding: 0.75rem 1.5rem;
      background-color: #cbb69e;
      color: #0E1A24;
      text-decoration: none;
      border-radius: 0.5rem;
      font-weight: 600;
      transition: all 0.3s ease;
    }
    
    .btn:hover {
      background-color: #b8a48a;
      transform: translateY(-1px);
    }
    
    @media (max-width: 768px) {
      .categories-grid {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class ReadyForShabbatComponent {}
