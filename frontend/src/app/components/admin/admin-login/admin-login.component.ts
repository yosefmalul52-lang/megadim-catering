import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="admin-login">
      <div class="container">
        <h1>כניסת מנהל</h1>
        <p>דף זה מיועד לבעלי העסק בלבד</p>
      </div>
    </div>
  `,
  styles: [`
    .admin-login {
      padding: 4rem 0;
      min-height: 60vh;
      text-align: center;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      padding: 0 2rem;
    }
    h1 {
      color: #0e1a24;
      margin-bottom: 2rem;
    }
    p {
      color: #6c757d;
      line-height: 1.8;
    }
  `]
})
export class AdminLoginComponent {}