import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';

// Admin App Component - minimal layout for admin dashboard
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet],
  template: `
    <div class="admin-app-container" dir="rtl">
      <router-outlet></router-outlet>
    </div>
  `,
  styles: [`
    .admin-app-container {
      min-height: 100vh;
      background-color: #f5f5f5;
    }
  `]
})
export class AdminAppComponent {}

