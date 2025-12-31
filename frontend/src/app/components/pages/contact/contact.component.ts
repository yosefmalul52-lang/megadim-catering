import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="page">
      <div class="container">
        <h1>צור קשר</h1>
        <p>טלפון: 052-824-0230</p>
        <p>להזמנות ופרטים נוספים</p>
      </div>
    </div>
  `,
  styles: [`
    .page { padding: 2rem 0; min-height: 60vh; }
    .container { max-width: 800px; margin: 0 auto; padding: 0 2rem; }
    h1 { color: #0E1A24; margin-bottom: 2rem; }
    p { line-height: 1.8; color: #6c757d; margin-bottom: 1rem; }
  `]
})
export class ContactComponent {}
